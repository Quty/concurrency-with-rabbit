const http = require('http');
const crypto = require('crypto');
const { inspect } = require('util');
const amqplib = require('amqplib');

const { Logger } = require('./logger');

const {
  INTERFACE = '0.0.0.0',
  AMQP_ADDRESS = 'amqp://localhost',
  QUEUE_NAME = 'queue',
} = process.env;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const INSTANCE_ID = crypto.randomBytes(10).toString('hex');

const logger = new Logger({ instanceId: INSTANCE_ID });

/**
 * @param {amqplib.Channel} channel
 * @returns {http.RequestListener}
 */
function createRequestListener(channel) {
  return (req, res) => {
    if (!req.url.match(/\/?produce\/?/)) {
      res.writeHead(404, 'Not Found');
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, 'Method Not Allowed');
      res.end();
      return;
    }

    if (req.headers['content-type'] !== 'application/json') {
      res.writeHead(415, 'Unsupported Media Type');
      res.end();
      return;
    }

    let requestBody = '';

    req.on('data', (chunk) => {
      requestBody += chunk;
    });

    req.on('end', () => {
      const { quantity = Math.random() * 40 + 10 } = JSON.parse(requestBody);

      if (!Number.isFinite(quantity) || quantity < 1) {
        res.writeHead(400, 'Bad Request');
        res.end();
        return;
      }

      for (let i = 0; i < quantity; i += 1) {
        const uuid = crypto.randomUUID();
        channel.sendToQueue(QUEUE_NAME, Buffer.from(uuid));
      }

      res.writeHead(204);
      res.end();
    });
  };
}

async function bootstrap() {
  const amqp = await amqplib.connect(AMQP_ADDRESS);

  const channel = await amqp.createChannel();
  await channel.assertQueue(QUEUE_NAME);

  const server = http.createServer(createRequestListener(channel));

  await new Promise((resolve, reject) => {
    server.listen(PORT, INTERFACE, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  logger.log(`HTTP server listening on http://${INTERFACE}:${PORT}`);

  const gracefullyShutdown = async (signal) => {
    logger.log(`Got ${signal} signal. Stopping application...`);

    server.closeIdleConnections();

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      logger.log('HTTP server stopped');

      channel.nackAll(true);
      await channel.close();
      logger.log('Queue channel closed');

      await amqp.close();
      logger.log('AMQP stopped');
    } catch (error) {
      logger.error('Unable to stop application gracefully', error);
      process.exit(1);
    }

    logger.log('Application stopped');
  };

  /**
   * @type {NodeJS.Signals[]}
   */
  const signals = ['SIGINT', 'SIGTERM'];

  signals.forEach((signal) => {
    process.on(signal, gracefullyShutdown);
  });
}

bootstrap()
  .then(() => {
    logger.log('Application started with following configuration');

    const config = {
      INTERFACE,
      PORT,
      RABBITMQ_ADDRESS: AMQP_ADDRESS,
      INSTANCE_ID,
      QUEUE_NAME,
    };

    logger.log(inspect(config, false, null, true));
  })
  .catch((error) => {
    logger.error('Unable to start application', error);
    process.exit(1);
  });

const crypto = require('crypto');
const { inspect } = require('util');
const amqplib = require('amqplib');

const { Logger } = require('./logger');

const {
  AMQP_ADDRESS = 'amqp://localhost',
  QUEUE_NAME = 'queue',
} = process.env;

const CONSUMERS_COUNT = process.env.CONSUMERS_COUNT
  ? Number(process.env.CONSUMERS_COUNT)
  : 1;

const MAX_IN_PROGRESS_PER_SECOND = process.env.MAX_IN_PROGRESS_PER_SECOND
  ? Number(process.env.MAX_IN_PROGRESS_PER_SECOND)
  : 10;

const INSTANCE_ID = crypto.randomBytes(10).toString('hex');
const MAX_IN_PROGRESS_PER_INSTANCE = Math.floor(MAX_IN_PROGRESS_PER_SECOND / CONSUMERS_COUNT);
const MIN_EXECUTION_TIME_IN_MS = Math.ceil(1000 / MAX_IN_PROGRESS_PER_INSTANCE);

const logger = new Logger({ instanceId: INSTANCE_ID });

/**
 * @param {amqplib.Message} message
 */
const handleMessage = async (message) => {
  const uuid = message.content.toString();

  const startedAt = Date.now();

  await new Promise((resolve) => {
    setTimeout(resolve, Math.floor(Math.random() * 80 + 20));
  });

  const resolvedAfter = Date.now() - startedAt;

  const timeToIdle = Math.max(0, MIN_EXECUTION_TIME_IN_MS - resolvedAfter);

  await new Promise((resolve) => {
    setTimeout(resolve, timeToIdle);
  });

  const logPayload = {
    uuid,
    resolvedAfter,
    timeToIdle,
  };

  logger.log(inspect(logPayload, false, null, true));
};

async function bootstrap() {
  logger.log('Starting application...');

  const amqp = await amqplib.connect(AMQP_ADDRESS);

  logger.log('AMQP connection created');

  const channel = await amqp.createChannel();
  await channel.prefetch(1);
  await channel.assertQueue(QUEUE_NAME);

  channel.consume(QUEUE_NAME, async (message) => {
    try {
      await handleMessage(message);
      channel.ack(message);
    } catch (error) {
      logger.error('Unable to handle error', error);
      channel.nack(message, false, true);
    }
  });

  logger.log('AMQP channel initialized');

  const gracefullyShutdown = async (signal) => {
    logger.log(`Got ${signal} signal. Stopping application...`);

    try {
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
    logger.log('Application started with following configuration', {
      AMQP_ADDRESS,
      CONSUMERS_COUNT,
      MAX_IN_PROGRESS_PER_SECOND,
      INSTANCE_ID,
      QUEUE_NAME,
      MAX_IN_PROGRESS_PER_INSTANCE,
      MIN_EXECUTION_TIME_IN_MS,
    });
  })
  .catch((error) => {
    logger.error('Unable to start application', error);
    process.exit(1);
  });

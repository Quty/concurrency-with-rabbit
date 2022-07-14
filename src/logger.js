const { stdout, stderr } = require('process');
const { inspect } = require('util');
const colors = require('colors');

class Logger {
  /**
   * @type {import('fs').WriteStream}
   */
  #out;

  /**
   * @type {import('fs').WriteStream}
   */
  #err;

  /**
   * @type {string}
   */
  #instanceId;

  constructor({
    instanceId,
    out = stdout,
    err = stderr,
  }) {
    this.#instanceId = instanceId;
    this.#out = out;
    this.#err = err;
  }

  /**
   * @param {import('fs').WriteStream} to
   * @param {string} message
   * @param  {...any} args
   */
  #print(to, message, ...args) {
    to.write(
      [
        colors.cyan(`[${this.#instanceId}]`),
        colors.blue(`${new Date().toISOString()}:`),
        colors.green(message),
        ...args.map((arg) => inspect(arg, false, 4, true)),
        '\n',
      ].join(' '),
    );
  }

  /**
   * @param {string} message
   * @param  {...any} args
   * @returns {void}
   */
  log(message, ...args) {
    this.#print(this.#out, message, ...args);
  }

  /**
   * @param {string} message
   * @param  {...any} args
   * @returns {void}
   */
  error(message, ...args) {
    this.#print(this.#err, message, ...args);
  }
}

module.exports = {
  Logger,
};

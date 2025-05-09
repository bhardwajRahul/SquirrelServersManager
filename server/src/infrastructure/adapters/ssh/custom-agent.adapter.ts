// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import pino from 'pino';
import ssh2, { Client } from 'ssh2';
import { tryResolveHost } from '../../common/dns/dns.util';
import Logger = pino.Logger;

export const getCustomAgent = (childLogger: any, opt: any) => {
  class SsmSshAgent extends ssh2.HTTPAgent {
    public logger: Logger<never>;

    constructor() {
      super(opt, { keepAlive: true });
      this.setMaxListeners(20);
      this.logger = childLogger.child(
        { module: 'SsmSshDockerAgent', moduleId: `${opt.host}` },
        { msgPrefix: '[SSH] - ' },
      );
    }

    createConnection(options, fn) {
      try {
        const conn = new Client();

        const connectTimeout = setTimeout(() => {
          this.logger.error(`SSH Connection attempt timed out - (host: ${opt.host})`);
          try {
            conn.end();
          } catch {
            /* ignore */
          }
          fn(new Error('SSH Connection attempt timed out.'));
        }, opt.readyTimeout || 30000);

        const handleError = (err: any) => {
          clearTimeout(connectTimeout);
          this.logger.error(`Handling SSH error - (host: ${opt.host}): ${err.message}`);
          try {
            conn.end();
          } catch {
            /* ignore */
          }
          try {
            this.destroy();
          } catch {
            /* ignore */
          }
          fn(err);
        };
        const decorateHttpStream = (stream) => {
          stream.setKeepAlive = () => {};
          stream.setNoDelay = () => {};
          stream.setTimeout = () => {};
          stream.ref = () => {};
          stream.unref = () => {};
          stream.destroySoon = stream.destroy;
          return stream;
        };
        (conn as Client)
          .once('ready', () => {
            clearTimeout(connectTimeout);
            conn.exec('docker system dial-stdio', (err, stream) => {
              if (err) {
                this.logger.error(`Encountering an exec SSH error - (host: ${opt.host})`);
                this.logger.error(err);
                return handleError(err);
              }
              stream.addListener('error', (err) => {
                this.logger.error(`Encountering an stream SSH error - (host: ${opt.host})`);
                this.logger.error(err);
                handleError(err);
              });
              stream.once('close', () => {
                this.logger.warn(`Stream closed - (host: ${opt.host})`);
                try {
                  conn.end();
                } catch {
                  /* ignore */
                }
                try {
                  this.destroy();
                } catch {
                  /* ignore */
                }
              });
              return fn(null, decorateHttpStream(stream));
            });
          })
          .on('error', (err) => {
            handleError(err);
          })
          .once('end', () => {
            clearTimeout(connectTimeout);
            this.logger.warn(`Agent destroy for ${opt.host}`);
            try {
              conn.end();
            } catch {
              /* ignore */
            }
            try {
              this.destroy();
            } catch {
              /* ignore */
            }
          });

        (async () => {
          try {
            const resolvedHost = await tryResolveHost(opt.host as string);
            const connectConfig = { ...opt, host: resolvedHost };
            this.logger.info(`Connecting to ${connectConfig.host}:${connectConfig.port || 22}...`);
            conn.connect(connectConfig);
          } catch (connectErr: any) {
            clearTimeout(connectTimeout);
            this.logger.error(
              `Initial SSH connection setup failed - (host: ${opt.host}): ${connectErr.message}`,
            );
            try {
              conn.end();
            } catch {
              /* ignore */
            }
            fn(connectErr);
          }
        })();
      } catch (error: any) {
        this.logger.error(`Error setting up SSH connection for ${opt.host}: ${error.message}`);
        this.logger.error(error);
        if (typeof fn === 'function') {
          fn(error);
        } else {
          console.error('SSH Agent setup failed, callback function invalid', error);
        }
      }
    }
  }
  return new SsmSshAgent();
};

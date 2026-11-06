import app from './app.js';
import config, { logger } from './config.js';
import { purgeAudioFiles } from './utils/cleanup.js';

// No client can hold a URL from a previous run, so start empty.
purgeAudioFiles();

const shutdown = () => {
  purgeAudioFiles();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
app.listen(config.server.port, () => {
  logger.info(`${config.app.name} server v${config.app.version} running at http://localhost:${config.server.port}`);
  logger.info('Registered routes:');
  app.router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      logger.info(r.route.path);
    }
  });
});

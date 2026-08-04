import type { FastifyInstance } from 'fastify';
import { startServer } from './startServer.js';

void run();

async function run(): Promise<void> {
  try {
    const app = await startServer();
    let isClosing = false;

    process.once('SIGINT', closeOnSignal);
    process.once('SIGTERM', closeOnSignal);

    function closeOnSignal(): void {
      if (isClosing) {
        return;
      }

      isClosing = true;
      void closeServer(app);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Server failed to start.', error);
    process.exitCode = 1;
  }
}

async function closeServer(app: FastifyInstance): Promise<void> {
  try {
    await app.close();
  } catch (error) {
    app.log.error({ error }, '❌ Server failed to stop cleanly.');
    process.exitCode = 1;
  }
}

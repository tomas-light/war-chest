import type * as FastifyModule from 'fastify';
import { vi } from 'vitest';

vi.mock('fastify', async (importOriginal) => {
  const fastifyModule = await importOriginal<typeof FastifyModule>();

  return {
    ...fastifyModule,
    default: createTestFastify,
  };

  function createTestFastify(options: FastifyModule.FastifyServerOptions) {
    return fastifyModule.default({ ...options, logger: false });
  }
});

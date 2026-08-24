import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function registerFeatureFlagsRoutes(app: FastifyInstance): void {
  app.get('/config/feature-flags.json', getFeatureFlags);

  async function getFeatureFlags(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> {
    try {
      const featureFlags =
        await app.serverDependencies.featureFlagsService.read();

      return reply.header('Cache-Control', 'no-store').send(featureFlags);
    } catch (error) {
      request.log.error({ error }, 'Runtime feature flags could not be read');

      return reply.code(503).send({
        error: {
          code: 'feature_flags_unavailable',
          message: 'Feature flags are unavailable.',
        },
      });
    }
  }
}

/**
 * Typed error that carries an HTTP status. The Fastify error handler maps
 * these to JSON responses. Any layer below the controller may throw this
 * to signal a known, client-facing failure.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

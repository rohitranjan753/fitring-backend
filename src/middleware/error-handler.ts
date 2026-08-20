import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../errors/http-error';

/**
 * The one place every thrown error ends up. Express recognizes this as
 * error-handling middleware because it takes four arguments — that's the
 * only "magic" here, everything else is a plain if/else.
 */

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res
      .status(err.statusCode)
      .json({ statusCode: err.statusCode, message: err.message });
  }

  if (err instanceof ZodError) {
    const message = err.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return res
      .status(400)
      .json({ statusCode: 400, message, error: 'Bad Request' });
  }

  console.error(err);
  return res
    .status(500)
    .json({ statusCode: 500, message: 'Internal server error' });
}

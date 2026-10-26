/**
 * Application error with a stable machine-readable code.
 *
 * Every error the client can act on is an AppError. Anything else is a bug and
 * gets collapsed to INTERNAL_ERROR so we never leak stack traces or SQL text.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_VIOLATION'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE_VIOLATION: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS[code];
    Error.captureStackTrace?.(this, AppError);
  }

  static notFound(what: string) {
    return new AppError('NOT_FOUND', `${what} not found`);
  }

  static forbidden(message = 'You do not have permission to do that') {
    return new AppError('FORBIDDEN', message);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError('CONFLICT', message, details);
  }

  static rule(message: string, details?: unknown) {
    return new AppError('BUSINESS_RULE_VIOLATION', message, details);
  }
}

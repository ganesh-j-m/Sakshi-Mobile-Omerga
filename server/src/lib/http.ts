import type { ZodTypeAny, infer as ZodInfer } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new AppError(404, `${what} not found`);
export const forbidden = (msg = 'You do not have permission to perform this action') => new AppError(403, msg);
export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, details);

/** Parse untrusted input with a Zod schema; throws a 400 AppError with field errors. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): ZodInfer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new AppError(400, 'Validation failed', fields);
  }
  return result.data;
}

export function toId(value: unknown, label = 'id'): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${label}`);
  return n;
}

export function paginate(page = 1, limit = 12) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  return { limit: safeLimit, offset: (safePage - 1) * safeLimit, page: safePage };
}

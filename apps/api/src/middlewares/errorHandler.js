import { logger } from "../utils/logger.js";

// ── Error factory ────────────────────────────────
// Usage: throw createError(404, 'Song not found')
//        throw createError(422, 'Validation failed', { errors: [...] })
export function createError(status, message, extras = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extras);
  return err;
}

// ── Async route wrapper ──────────────────────────
// Catches rejected promises and forwards to Express error handler.
// Usage: router.get('/songs', asyncHandler(async (req, res) => { ... }))
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ── Central error handler (must be last middleware) ──
export function errorHandler(err, _req, res, _next) {
  // An upload over its size limit is the sender's problem, not a server fault.
  if (err?.name === "MulterError" && err.code === "LIMIT_FILE_SIZE") {
    err.status = 413;
    err.message = "That file is too big to upload";
  }
  const status =
    err.status || err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // Log at appropriate level based on status code
  if (status >= 500) {
    logger.error(err.message, { status, stack: err.stack });
  } else if (status >= 400) {
    logger.warn(err.message, { status });
  }

  // Consistent error envelope matching Flowline pattern
  const body = {
    error: {
      message: err.message || "Internal server error",
      status,
      ...(err.errors && { errors: err.errors }),
      ...(process.env.NODE_ENV !== "production" && {
        stack: err.stack,
        name: err.name,
      }),
    },
  };

  res.status(status).json(body);
}


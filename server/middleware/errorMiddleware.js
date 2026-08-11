class AppError extends Error {
  constructor(message, options = {}) {
    super(message || 'Internal Server Error');
    this.name = 'AppError';
    this.status = typeof options.status === 'number' ? options.status : 500;
    this.code = options.code || 'INTERNAL_ERROR';
    this.details = options.details || null;
    this.isOperational = true;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

function notFound(req, res, next) {
  const err = new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, {
    status: 404,
    code: 'NOT_FOUND'
  });
  next(err);
}

function errorHandler(err, req, res, next) {
  const status = typeof err.status === 'number' ? err.status : 500;
  const code = err.code || (status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');
  const details = err.details || null;
  const message = err.message || err || 'Internal Server Error';

  console.error('=== Unhandled Error ===');
  console.error('Timestamp:', new Date().toISOString());
  console.error('Endpoint:', req.method, req.originalUrl);
  console.error('Status:', status);
  console.error('Code:', code);
  console.error('Message:', message);
  if (details) {
    console.error('Details:', JSON.stringify(details, null, 2));
  }
  if (err.cause) {
    console.error('Caused by:', err.cause.message || err.cause);
  }
  console.error('Stack:', err.stack);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(status).json({
    error: message,
    message,
    code,
    status,
    details: details || undefined
  });
}

module.exports = {
  AppError,
  notFound,
  errorHandler
};


export function errorHandler(err, req, res, next) {
  console.error('Server error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

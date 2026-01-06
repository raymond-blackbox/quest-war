import logger from '../services/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * Async wrapper to catch errors and pass them to the next middleware.
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Centralized error handling middleware.
 */
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const errorCode = err.errorCode || 'INTERNAL_ERROR';

    logger.error(err.message, {
        stack: err.stack,
        errorCode,
        statusCode,
        path: req.path,
        method: req.method,
        requestId: req.requestId,
    });

    res.status(statusCode).json({
        error: err.message || 'Internal server error',
        code: errorCode,
        details: err.details || null,
    });
};

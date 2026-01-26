/**
 * Error Handling Middleware
 *
 * Global error handler for Express application
 */

import { Request, Response, NextFunction } from 'express';
import { APIError, ApiResponse } from '../types';
import { logger } from '../server';

/**
 * Format error response
 */
function formatErrorResponse(error: APIError): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Global error handling middleware
 *
 * MUST be the last middleware in the chain
 */
export function errorHandler(
  error: Error | APIError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Log error
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id'],
  });

  // Handle APIError instances
  if (error instanceof APIError) {
    res.status(error.statusCode).json(formatErrorResponse(error));
    return;
  }

  // Handle validation errors from zod or other libraries
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: (error as any).details,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle Multer file upload errors
  if (error.name === 'MulterError') {
    const multerError = error as any;
    let message = 'File upload error';
    let statusCode = 400;

    switch (multerError.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size exceeds maximum allowed';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = multerError.message;
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message,
        details: { multerCode: multerError.code },
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle database errors
  if (error.name === 'QueryFailedError' || (error as any).code?.startsWith('23')) {
    const dbError = error as any;
    let message = 'Database operation failed';
    let statusCode = 500;

    // PostgreSQL error codes
    if (dbError.code === '23505') {
      // Unique violation
      message = 'Duplicate entry: resource already exists';
      statusCode = 409;
    } else if (dbError.code === '23503') {
      // Foreign key violation
      message = 'Referenced resource does not exist';
      statusCode = 400;
    } else if (dbError.code === '23502') {
      // Not null violation
      message = 'Required field is missing';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message,
        details: process.env.NODE_ENV === 'development' ? { dbCode: dbError.code } : undefined,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle network/axios errors
  if ((error as any).isAxiosError) {
    const axiosError = error as any;
    const service = axiosError.config?.url || 'external service';

    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: `Failed to communicate with ${service}`,
        details:
          process.env.NODE_ENV === 'development'
            ? {
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
              }
            : undefined,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Default: Internal Server Error
  const statusCode = 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
      details: isDevelopment
        ? {
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 5),
          }
        : undefined,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async error wrapper for route handlers
 *
 * Wraps async route handlers to catch errors and pass to error middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found error helper
 */
export function notFound(resource: string, id?: string): never {
  const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
  const error = new APIError('NOT_FOUND', message, 404);
  throw error;
}

/**
 * Validation error helper
 */
export function validationError(message: string, details?: unknown): never {
  const error = new APIError('VALIDATION_ERROR', message, 400, details);
  throw error;
}

/**
 * Conflict error helper
 */
export function conflictError(message: string, details?: unknown): never {
  const error = new APIError('CONFLICT', message, 409, details);
  throw error;
}

/**
 * Service unavailable error helper
 */
export function serviceUnavailable(service: string, details?: unknown): never {
  const error = new APIError(
    'SERVICE_UNAVAILABLE',
    `${service} is currently unavailable`,
    503,
    details
  );
  throw error;
}

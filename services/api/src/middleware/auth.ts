/**
 * Authentication Middleware
 *
 * JWT token validation and user context extraction
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, JWTPayload, AuthenticatedRequest } from '../types';
import { logger } from '../server';

const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_change_in_production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://api.adverant.ai';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'democracy-litigation-api';

/**
 * Extract and validate JWT token from Authorization header
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Invalid authorization header format. Expected: Bearer <token>');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify and decode JWT
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JWTPayload;

    // Validate required fields
    if (!decoded.userId || !decoded.email) {
      throw new AuthenticationError('Invalid token payload: missing required fields');
    }

    // Check token expiration (jwt.verify already checks this, but explicit check for clarity)
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      throw new AuthenticationError('Token has expired');
    }

    // Attach user context to request
    (req as AuthenticatedRequest).user = decoded;

    logger.debug('User authenticated', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tier: decoded.tier,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('JWT verification failed', {
        error: error.message,
        ip: req.ip,
        path: req.path,
      });

      const authError = new AuthenticationError('Invalid token: ' + error.message);
      return next(authError);
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired token', {
        expiredAt: error.expiredAt,
        ip: req.ip,
        path: req.path,
      });

      const authError = new AuthenticationError('Token has expired');
      return next(authError);
    }

    if (error instanceof AuthenticationError) {
      logger.warn('Authentication failed', {
        error: error.message,
        ip: req.ip,
        path: req.path,
      });
      return next(error);
    }

    logger.error('Unexpected authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      path: req.path,
    });

    next(new AuthenticationError('Authentication failed'));
  }
}

/**
 * Optional authentication middleware - attaches user if token present, but doesn't require it
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user context
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JWTPayload;

    (req as AuthenticatedRequest).user = decoded;

    next();
  } catch (error) {
    // Token validation failed, but that's okay for optional auth
    logger.debug('Optional auth failed, continuing without user context', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next();
  }
}

/**
 * Role-based authorization middleware factory
 */
export function requireRole(...allowedRoles: string[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn('Authorization failed: insufficient permissions', {
        userId: user.userId,
        userRole: user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      return next(
        new AuthenticationError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
}

/**
 * Tier-based authorization middleware factory
 */
export function requireTier(...allowedTiers: string[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!allowedTiers.includes(user.tier)) {
      logger.warn('Authorization failed: insufficient tier', {
        userId: user.userId,
        userTier: user.tier,
        requiredTiers: allowedTiers,
        path: req.path,
      });

      return next(
        new AuthenticationError(
          `Access denied. This feature requires: ${allowedTiers.join(' or ')} tier`
        )
      );
    }

    next();
  };
}

/**
 * Get user context from request (for use in route handlers)
 */
export function getUserContext(req: Request): JWTPayload | null {
  return (req as AuthenticatedRequest).user || null;
}

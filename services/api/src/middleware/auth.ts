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
const JWT_ISSUER = process.env.JWT_ISSUER || '';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || '';

/**
 * Build JWT verification options - only include issuer/audience if configured
 */
function getVerifyOptions(): jwt.VerifyOptions {
  const options: jwt.VerifyOptions = {};
  if (JWT_ISSUER) {
    options.issuer = JWT_ISSUER;
  }
  if (JWT_AUDIENCE) {
    options.audience = JWT_AUDIENCE;
  }
  return options;
}

/**
 * Extract user ID from JWT payload - supports multiple claim names
 * Nexus auth may use: userId, user_id, sub, or id
 */
function extractUserId(payload: Record<string, unknown>): string | undefined {
  return (
    (payload.userId as string) ||
    (payload.user_id as string) ||
    (payload.sub as string) ||
    (payload.id as string)
  );
}

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

    // Verify and decode JWT - only validate issuer/audience if configured
    const decoded = jwt.verify(token, JWT_SECRET, getVerifyOptions()) as Record<string, unknown>;

    // Extract userId from various possible claim names
    const userId = extractUserId(decoded);
    const email = decoded.email as string;

    // Validate required fields
    if (!userId) {
      throw new AuthenticationError('Invalid token payload: missing user ID');
    }

    // Check token expiration (jwt.verify already checks this, but explicit check for clarity)
    const now = Math.floor(Date.now() / 1000);
    const exp = decoded.exp as number | undefined;
    if (exp && exp < now) {
      throw new AuthenticationError('Token has expired');
    }

    // Build JWTPayload from decoded token - normalize claim names
    const userPayload: JWTPayload = {
      userId,
      email: email || (decoded.email as string) || '',
      role: (decoded.role as string) || 'user',
      tier: (decoded.tier as string) || (decoded.subscription_tier as string) || 'free',
      iss: (decoded.iss as string) || '',
      aud: (decoded.aud as string) || '',
      exp: exp || 0,
      iat: (decoded.iat as number) || 0,
    };

    // Attach user context to request
    (req as AuthenticatedRequest).user = userPayload;

    logger.debug('User authenticated', {
      userId: userPayload.userId,
      email: userPayload.email,
      role: userPayload.role,
      tier: userPayload.tier,
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

    const decoded = jwt.verify(token, JWT_SECRET, getVerifyOptions()) as Record<string, unknown>;

    // Extract userId from various possible claim names
    const userId = extractUserId(decoded);
    if (!userId) {
      return next(); // Optional auth - continue without user if no userId
    }

    // Build JWTPayload from decoded token
    const userPayload: JWTPayload = {
      userId,
      email: (decoded.email as string) || '',
      role: (decoded.role as string) || 'user',
      tier: (decoded.tier as string) || (decoded.subscription_tier as string) || 'free',
      iss: (decoded.iss as string) || '',
      aud: (decoded.aud as string) || '',
      exp: (decoded.exp as number) || 0,
      iat: (decoded.iat as number) || 0,
    };

    (req as AuthenticatedRequest).user = userPayload;

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

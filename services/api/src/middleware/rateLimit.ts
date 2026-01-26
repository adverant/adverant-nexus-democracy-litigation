/**
 * Rate Limiting Middleware
 *
 * Implements token bucket rate limiting per user
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitError, AuthenticatedRequest } from '../types';
import { logger } from '../server';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

// In-memory rate limit store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitBucket>();

// Rate limit configuration
const READ_WINDOW_MS = parseInt(process.env.RATE_LIMIT_READ_WINDOW_MS || '60000', 10);
const READ_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_READ_MAX_REQUESTS || '60', 10);
const WRITE_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WRITE_WINDOW_MS || '60000', 10);
const WRITE_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_WRITE_MAX_REQUESTS || '30', 10);

/**
 * Determine if request is a write operation
 */
function isWriteOperation(req: Request): boolean {
  const method = req.method.toUpperCase();
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

/**
 * Get rate limit key for request
 */
function getRateLimitKey(req: Request): string {
  const user = (req as AuthenticatedRequest).user;
  const userId = user?.userId || req.ip || 'anonymous';
  const operation = isWriteOperation(req) ? 'write' : 'read';
  return `democracy-litigation:${operation}:${userId}`;
}

/**
 * Refill tokens for rate limit bucket
 */
function refillBucket(
  bucket: RateLimitBucket,
  maxTokens: number,
  windowMs: number
): void {
  const now = Date.now();
  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = (timePassed / windowMs) * maxTokens;

  bucket.tokens = Math.min(bucket.tokens + tokensToAdd, maxTokens);
  bucket.lastRefill = now;
}

/**
 * Check if request is within rate limit
 */
function checkRateLimit(key: string, maxTokens: number, windowMs: number): boolean {
  let bucket = rateLimitStore.get(key);

  if (!bucket) {
    bucket = {
      tokens: maxTokens,
      lastRefill: Date.now(),
    };
    rateLimitStore.set(key, bucket);
  }

  // Refill tokens based on time passed
  refillBucket(bucket, maxTokens, windowMs);

  // Check if we have tokens available
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

/**
 * Get rate limit info for response headers
 */
function getRateLimitInfo(key: string, maxTokens: number, windowMs: number): {
  limit: number;
  remaining: number;
  reset: number;
} {
  const bucket = rateLimitStore.get(key);

  if (!bucket) {
    return {
      limit: maxTokens,
      remaining: maxTokens,
      reset: Math.ceil((Date.now() + windowMs) / 1000),
    };
  }

  refillBucket(bucket, maxTokens, windowMs);

  return {
    limit: maxTokens,
    remaining: Math.floor(bucket.tokens),
    reset: Math.ceil((bucket.lastRefill + windowMs) / 1000),
  };
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const isWrite = isWriteOperation(req);
    const maxTokens = isWrite ? WRITE_MAX_REQUESTS : READ_MAX_REQUESTS;
    const windowMs = isWrite ? WRITE_WINDOW_MS : READ_WINDOW_MS;
    const key = getRateLimitKey(req);

    // Check rate limit
    const allowed = checkRateLimit(key, maxTokens, windowMs);

    // Get rate limit info for headers
    const rateLimitInfo = getRateLimitInfo(key, maxTokens, windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    res.setHeader('X-RateLimit-Reset', rateLimitInfo.reset.toString());

    if (!allowed) {
      const retryAfter = rateLimitInfo.reset - Math.floor(Date.now() / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      logger.warn('Rate limit exceeded', {
        key,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: (req as AuthenticatedRequest).user?.userId,
      });

      throw new RateLimitError(
        `Rate limit exceeded. Maximum ${maxTokens} ${isWrite ? 'write' : 'read'} requests per ${windowMs / 1000} seconds. Retry after ${retryAfter} seconds.`
      );
    }

    next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      return next(error);
    }

    logger.error('Rate limit middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    next(error);
  }
}

/**
 * Clear rate limit for a specific key (useful for testing)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Cleanup old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const maxAge = Math.max(READ_WINDOW_MS, WRITE_WINDOW_MS) * 2;

  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      rateLimitStore.delete(key);
    }
  }

  logger.debug('Rate limit cleanup complete', {
    remainingEntries: rateLimitStore.size,
  });
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

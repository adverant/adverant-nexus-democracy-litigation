/**
 * Democracy Litigation API - Express Server
 *
 * Main entry point for the backend API service
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer, Server as HTTPServer } from 'http';
import { WebSocketServer } from 'ws';
import winston from 'winston';

// Load environment variables
dotenv.config();

// Import middleware
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { errorHandler } from './middleware/error';

// Import routes
import casesRouter from './routes/cases';
import documentsRouter from './routes/documents';
import researchRouter from './routes/research';
import geographicRouter from './routes/geographic';
import expertsRouter from './routes/experts';
import deadlinesRouter from './routes/deadlines';
import jobsRouter from './routes/jobs';

// Import services
import { DatabaseService } from './services/database';
import { WebSocketService } from './services/websocket';
import { QueueService } from './services/queue';

// ============================================
// Logger Configuration
// ============================================

const logFormat = process.env.LOG_FORMAT === 'json' ? winston.format.json() : winston.format.simple();

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// ============================================
// Express Application Setup
// ============================================

const app: Express = express();
const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';

// ============================================
// Middleware Configuration
// ============================================

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow iframes for GeoAgent integration
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
app.use(
  cors({
    origin: corsOrigins,
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID', 'X-Request-ID'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId as string;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// ============================================
// Health Check Endpoints
// ============================================

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const dbHealth = await DatabaseService.getInstance().checkHealth();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'democracy-litigation-api',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: dbHealth ? 'healthy' : 'unhealthy',
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbReady = await DatabaseService.getInstance().checkHealth();
    const queueReady = QueueService.getInstance().isReady();

    if (dbReady && queueReady) {
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbReady,
          queue: queueReady,
        },
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/live', (req: Request, res: Response) => {
  res.json({ status: 'live', timestamp: new Date().toISOString() });
});

// ============================================
// API Routes (with authentication)
// ============================================

const apiRouter = express.Router();

// Apply authentication to all API routes
apiRouter.use(authMiddleware);

// Apply rate limiting
apiRouter.use(rateLimitMiddleware);

// Mount route handlers
apiRouter.use('/cases', casesRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/research', researchRouter);
apiRouter.use('/geo', geographicRouter);
apiRouter.use('/experts', expertsRouter);
apiRouter.use('/deadlines', deadlinesRouter);
apiRouter.use('/jobs', jobsRouter);

// Mount API router at /api/v1
app.use('/api/v1', apiRouter);

// API documentation route
app.get('/api/docs', (req: Request, res: Response) => {
  res.json({
    service: 'Democracy Litigation API',
    version: '1.0.0',
    description: 'Backend API for voting rights litigation platform',
    endpoints: {
      cases: '/api/v1/cases',
      documents: '/api/v1/documents',
      research: '/api/v1/research',
      geographic: '/api/v1/geo',
      experts: '/api/v1/experts',
      deadlines: '/api/v1/deadlines',
      jobs: '/api/v1/jobs',
    },
    documentation: 'https://github.com/adverant/adverant-nexus-democracy-litigation',
  });
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use(errorHandler);

// ============================================
// Server Initialization
// ============================================

let httpServer: HTTPServer;
let wsServer: WebSocketServer | null = null;

async function startServer(): Promise<void> {
  try {
    logger.info('Initializing Democracy Litigation API...');

    // Initialize database connection
    logger.info('Connecting to database...');
    await DatabaseService.getInstance().connect();
    logger.info('Database connected successfully');

    // Initialize job queue
    logger.info('Initializing job queue...');
    await QueueService.getInstance().connect();
    logger.info('Job queue initialized');

    // Create HTTP server
    httpServer = createServer(app);

    // Initialize WebSocket server if enabled
    if (process.env.WS_ENABLED === 'true') {
      logger.info('Initializing WebSocket server...');
      wsServer = new WebSocketServer({
        server: httpServer,
        path: process.env.WS_PATH || '/ws',
      });
      WebSocketService.getInstance().initialize(wsServer);
      logger.info('WebSocket server initialized');
    }

    // Start listening
    httpServer.listen(Number(port), host, () => {
      logger.info(`Democracy Litigation API listening on ${host}:${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://${host}:${port}/health`);
      logger.info(`API documentation: http://${host}:${port}/api/docs`);
      if (wsServer) {
        logger.info(`WebSocket: ws://${host}:${port}${process.env.WS_PATH || '/ws'}`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================
// Graceful Shutdown
// ============================================

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

    // Close WebSocket connections
    if (wsServer) {
      await WebSocketService.getInstance().close();
      logger.info('WebSocket server closed');
    }

    // Close job queue
    await QueueService.getInstance().close();
    logger.info('Job queue closed');

    // Close database connections
    await DatabaseService.getInstance().disconnect();
    logger.info('Database connections closed');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

// ============================================
// Start Server
// ============================================

if (require.main === module) {
  startServer();
}

// Export for testing
export { app, startServer, shutdown };

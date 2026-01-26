/**
 * WebSocket Service
 *
 * Real-time bidirectional communication with clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../server';
import { WebSocketMessage, WebSocketEventType, JWTPayload } from '../types';

interface AuthenticatedWebSocket extends WebSocket {
  user?: JWTPayload;
  isAlive?: boolean;
  subscriptions?: Set<string>;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Set<AuthenticatedWebSocket> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(wss: WebSocketServer): void {
    if (this.wss) {
      logger.warn('WebSocket server already initialized');
      return;
    }

    this.wss = wss;

    // Handle new connections
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws as AuthenticatedWebSocket, req);
    });

    // Start heartbeat to detect dead connections
    this.startHeartbeat();

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedWebSocket, req: IncomingMessage): void {
    logger.debug('New WebSocket connection', {
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Initialize connection state
    ws.isAlive = true;
    ws.subscriptions = new Set();

    // Authenticate connection
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('auth_token');

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development_secret_change_in_production', {
          issuer: process.env.JWT_ISSUER || 'https://api.adverant.ai',
          audience: process.env.JWT_AUDIENCE || 'democracy-litigation-api',
        }) as JWTPayload;

        ws.user = decoded;

        logger.info('WebSocket authenticated', {
          userId: decoded.userId,
          email: decoded.email,
        });

        // Send authentication success message
        this.sendToClient(ws, {
          type: 'authenticated' as WebSocketEventType,
          payload: {
            userId: decoded.userId,
            email: decoded.email,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.warn('WebSocket connection without authentication token');
      }
    } catch (error) {
      logger.error('WebSocket authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      ws.send(
        JSON.stringify({
          type: 'error',
          payload: { message: 'Authentication failed' },
          timestamp: new Date().toISOString(),
        })
      );
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Add to clients set
    this.clients.add(ws);

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    // Handle disconnection
    ws.on('close', (code: number, reason: Buffer) => {
      logger.debug('WebSocket disconnected', {
        code,
        reason: reason.toString(),
        userId: ws.user?.userId,
      });

      this.clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      logger.error('WebSocket error', {
        error: error.message,
        userId: ws.user?.userId,
      });
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      logger.debug('WebSocket message received', {
        type: message.type,
        userId: ws.user?.userId,
      });

      // Handle different message types
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(ws, message.payload);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(ws, message.payload);
          break;

        case 'ping':
          this.sendToClient(ws, {
            type: 'authenticated' as WebSocketEventType,
            payload: { pong: true },
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          logger.warn('Unknown WebSocket message type', {
            type: message.type,
            userId: ws.user?.userId,
          });
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: ws.user?.userId,
      });
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(ws: AuthenticatedWebSocket, payload: any): void {
    const { channel } = payload;

    if (!channel) {
      logger.warn('Subscribe request without channel', {
        userId: ws.user?.userId,
      });
      return;
    }

    ws.subscriptions?.add(channel);

    logger.info('Client subscribed to channel', {
      userId: ws.user?.userId,
      channel,
    });

    this.sendToClient(ws, {
      type: 'authenticated' as WebSocketEventType,
      payload: {
        subscribed: true,
        channel,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribe(ws: AuthenticatedWebSocket, payload: any): void {
    const { channel } = payload;

    if (!channel) {
      logger.warn('Unsubscribe request without channel', {
        userId: ws.user?.userId,
      });
      return;
    }

    ws.subscriptions?.delete(channel);

    logger.info('Client unsubscribed from channel', {
      userId: ws.user?.userId,
      channel,
    });

    this.sendToClient(ws, {
      type: 'authenticated' as WebSocketEventType,
      payload: {
        unsubscribed: true,
        channel,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(type: WebSocketEventType, payload: unknown): void {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Broadcasting WebSocket message', {
      type,
      clientCount: this.clients.size,
    });

    for (const client of this.clients) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Broadcast message to specific user
   */
  public broadcastToUser(userId: string, type: WebSocketEventType, payload: unknown): void {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Broadcasting WebSocket message to user', {
      type,
      userId,
    });

    for (const client of this.clients) {
      if (client.user?.userId === userId) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Broadcast message to specific channel subscribers
   */
  public broadcastToChannel(channel: string, type: WebSocketEventType, payload: unknown): void {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Broadcasting WebSocket message to channel', {
      type,
      channel,
    });

    for (const client of this.clients) {
      if (client.subscriptions?.has(channel)) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    const interval = parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10);

    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (client.isAlive === false) {
          logger.debug('Terminating dead WebSocket connection', {
            userId: client.user?.userId,
          });
          client.terminate();
          this.clients.delete(client);
          continue;
        }

        client.isAlive = false;
        client.ping();
      }
    }, interval);

    logger.debug('WebSocket heartbeat started', { interval });
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.debug('WebSocket heartbeat stopped');
    }
  }

  /**
   * Get connected clients count
   */
  public getClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get authenticated clients count
   */
  public getAuthenticatedClientsCount(): number {
    let count = 0;
    for (const client of this.clients) {
      if (client.user) {
        count++;
      }
    }
    return count;
  }

  /**
   * Close WebSocket server
   */
  public async close(): Promise<void> {
    logger.info('Closing WebSocket server...');

    // Stop heartbeat
    this.stopHeartbeat();

    // Close all client connections
    for (const client of this.clients) {
      client.close(1001, 'Server shutting down');
    }

    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          logger.info('WebSocket server closed');
          resolve();
        });
      });

      this.wss = null;
    }
  }
}

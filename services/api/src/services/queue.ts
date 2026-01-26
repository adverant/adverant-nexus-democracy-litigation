/**
 * Job Queue Service
 *
 * BullMQ-based job queue for asynchronous operations
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../server';
import { JobType, JobData, JobProgress } from '../types';
import { DatabaseService } from './database';
import { WebSocketService } from './websocket';

export class QueueService {
  private static instance: QueueService;
  private connection: Redis | null = null;
  private queues: Map<JobType, Queue> = new Map();
  private workers: Map<JobType, Worker> = new Map();
  private queueEvents: Map<JobType, QueueEvents> = new Map();
  private ready: boolean = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Connect to Redis and initialize queues
   */
  public async connect(): Promise<void> {
    if (this.connection) {
      logger.warn('Queue service already connected');
      return;
    }

    try {
      // Create Redis connection
      this.connection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
      });

      this.connection.on('error', (error) => {
        logger.error('Redis connection error', { error: error.message });
      });

      this.connection.on('connect', () => {
        logger.debug('Redis connected');
      });

      // Initialize queues for each job type
      const jobTypes: JobType[] = [
        'document_triage',
        'legislative_history',
        'vra_analysis',
        'compactness_calculation',
        'h3_alignment',
        'expert_report_generation',
      ];

      for (const jobType of jobTypes) {
        await this.initializeQueue(jobType);
      }

      this.ready = true;
      logger.info('Queue service initialized', {
        queueCount: this.queues.size,
        workerCount: this.workers.size,
      });
    } catch (error) {
      logger.error('Queue service initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Initialize queue for a specific job type
   */
  private async initializeQueue(jobType: JobType): Promise<void> {
    if (!this.connection) {
      throw new Error('Redis connection not established');
    }

    // Create queue
    const queue = new Queue(jobType, { connection: this.connection });
    this.queues.set(jobType, queue);

    // Create worker
    const worker = new Worker(
      jobType,
      async (job: Job) => {
        return await this.processJob(job);
      },
      {
        connection: this.connection,
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
      }
    );

    // Worker event listeners
    worker.on('completed', (job) => {
      logger.info('Job completed', {
        jobId: job.id,
        jobType: job.name,
        duration: job.finishedOn ? job.finishedOn - (job.processedOn || 0) : 0,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Job failed', {
        jobId: job?.id,
        jobType: job?.name,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    worker.on('progress', (job, progress: JobProgress) => {
      logger.debug('Job progress', {
        jobId: job.id,
        jobType: job.name,
        progress: progress.progress,
      });

      // Emit progress via WebSocket
      WebSocketService.getInstance().broadcast('job:progress', progress);
    });

    this.workers.set(jobType, worker);

    // Create queue events listener
    const queueEvents = new QueueEvents(jobType, { connection: this.connection });

    queueEvents.on('completed', async ({ jobId }) => {
      // Update job status in database
      await this.updateJobStatus(jobId, 'completed', 100);
    });

    queueEvents.on('failed', async ({ jobId, failedReason }) => {
      // Update job status in database
      await this.updateJobStatus(jobId, 'failed', 0, failedReason);
    });

    this.queueEvents.set(jobType, queueEvents);

    logger.debug('Queue initialized', { jobType });
  }

  /**
   * Process a job
   */
  private async processJob(job: Job): Promise<any> {
    const { type, userId, caseId, params } = job.data as JobData;

    logger.info('Processing job', {
      jobId: job.id,
      jobType: type,
      userId,
      caseId,
    });

    try {
      // Update job status in database
      await this.updateJobStatus(job.id!, 'running', 0);

      // Emit job started event
      WebSocketService.getInstance().broadcast('job:started', {
        jobId: job.id,
        jobType: type,
        userId,
        caseId,
      });

      let result: any;

      // Route to appropriate handler based on job type
      switch (type) {
        case 'document_triage':
          result = await this.handleDocumentTriage(job, params);
          break;
        case 'legislative_history':
          result = await this.handleLegislativeHistory(job, params);
          break;
        case 'vra_analysis':
          result = await this.handleVRAAnalysis(job, params);
          break;
        case 'compactness_calculation':
          result = await this.handleCompactnessCalculation(job, params);
          break;
        case 'h3_alignment':
          result = await this.handleH3Alignment(job, params);
          break;
        case 'expert_report_generation':
          result = await this.handleExpertReportGeneration(job, params);
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // Update job with result
      await this.updateJobStatus(job.id!, 'completed', 100, undefined, result);

      // Emit job completed event
      WebSocketService.getInstance().broadcast('job:completed', {
        jobId: job.id,
        jobType: type,
        result,
      });

      return result;
    } catch (error) {
      logger.error('Job processing failed', {
        jobId: job.id,
        jobType: type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update job with error
      await this.updateJobStatus(job.id!, 'failed', 0, errorMessage);

      // Emit job failed event
      WebSocketService.getInstance().broadcast('job:failed', {
        jobId: job.id,
        jobType: type,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Job handler implementations
   */
  private async handleDocumentTriage(job: Job, params: any): Promise<any> {
    // Implementation will be added with DocAI integration
    await job.updateProgress({ progress: 50, status: 'triaging_documents' });
    return { triaged: params.documentIds?.length || 0 };
  }

  private async handleLegislativeHistory(job: Job, params: any): Promise<any> {
    await job.updateProgress({ progress: 50, status: 'extracting_timeline' });
    return { timelineEvents: 0 };
  }

  private async handleVRAAnalysis(job: Job, params: any): Promise<any> {
    await job.updateProgress({ progress: 50, status: 'analyzing_precedents' });
    return { precedentsFound: 0 };
  }

  private async handleCompactnessCalculation(job: Job, params: any): Promise<any> {
    await job.updateProgress({ progress: 50, status: 'calculating_metrics' });
    return { metrics: {} };
  }

  private async handleH3Alignment(job: Job, params: any): Promise<any> {
    await job.updateProgress({ progress: 50, status: 'aligning_geometries' });
    return { crosswalkSize: 0 };
  }

  private async handleExpertReportGeneration(job: Job, params: any): Promise<any> {
    await job.updateProgress({ progress: 50, status: 'generating_report' });
    return { reportGenerated: true };
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: string,
    progress: number,
    error?: string,
    result?: any
  ): Promise<void> {
    try {
      const db = DatabaseService.getInstance();

      if (status === 'running') {
        await db.query(
          `UPDATE dl.jobs SET status = $1, progress = $2, started_at = NOW() WHERE id = $3`,
          [status, progress, jobId]
        );
      } else if (status === 'completed') {
        await db.query(
          `UPDATE dl.jobs SET status = $1, progress = $2, result = $3, completed_at = NOW() WHERE id = $4`,
          [status, progress, JSON.stringify(result || {}), jobId]
        );
      } else if (status === 'failed') {
        await db.query(
          `UPDATE dl.jobs SET status = $1, progress = $2, error = $3, completed_at = NOW() WHERE id = $4`,
          [status, progress, error, jobId]
        );
      }
    } catch (err) {
      logger.error('Failed to update job status in database', {
        jobId,
        status,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Add a job to the queue
   */
  public async addJob(
    jobType: JobType,
    jobData: JobData,
    jobId: string
  ): Promise<Job> {
    const queue = this.queues.get(jobType);

    if (!queue) {
      throw new Error(`Queue for job type ${jobType} not found`);
    }

    const job = await queue.add(jobType, jobData, {
      jobId,
      attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '5000', 10),
      },
    });

    logger.info('Job added to queue', {
      jobId: job.id,
      jobType,
    });

    return job;
  }

  /**
   * Get job status
   */
  public async getJobStatus(jobType: JobType, jobId: string): Promise<Job | null> {
    const queue = this.queues.get(jobType);

    if (!queue) {
      return null;
    }

    return await queue.getJob(jobId);
  }

  /**
   * Check if queue service is ready
   */
  public isReady(): boolean {
    return this.ready;
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    logger.info('Closing queue service...');

    // Close all workers
    for (const [jobType, worker] of this.workers.entries()) {
      await worker.close();
      logger.debug('Worker closed', { jobType });
    }

    // Close all queue events
    for (const [jobType, queueEvents] of this.queueEvents.entries()) {
      await queueEvents.close();
      logger.debug('Queue events closed', { jobType });
    }

    // Close all queues
    for (const [jobType, queue] of this.queues.entries()) {
      await queue.close();
      logger.debug('Queue closed', { jobType });
    }

    // Close Redis connection
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }

    this.ready = false;
    logger.info('Queue service closed');
  }
}

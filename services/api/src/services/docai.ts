/**
 * DocAI Service
 *
 * Client for DocAI API - Document processing, OCR, triage, classification, and entity extraction
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { logger } from '../server';
import {
  DocAITriageResult,
  LegislativeTimeline,
  ServiceUnavailableError,
  APIError,
} from '../types';

/**
 * OCR extraction request
 */
export interface OCRRequest {
  filePath: string;
  extractTables?: boolean;
  extractImages?: boolean;
  language?: string;
}

/**
 * OCR extraction response
 */
export interface OCRResponse {
  text: string;
  pages: number;
  tables?: Array<{
    page: number;
    data: string[][];
  }>;
  images?: Array<{
    page: number;
    data: string; // base64
  }>;
  confidence: number;
}

/**
 * Document triage request
 */
export interface TriageRequest {
  documentId: string;
  filePath: string;
  caseContext?: {
    caseType: string;
    legalClaims: string[];
    phase: string;
  };
  relevanceThreshold?: number;
  privilegeThreshold?: number;
}

/**
 * Document classification request
 */
export interface ClassificationRequest {
  filePath: string;
  text?: string;
  possibleCategories?: string[];
}

/**
 * Document classification response
 */
export interface ClassificationResponse {
  primaryCategory: string;
  confidence: number;
  allCategories: Array<{
    category: string;
    confidence: number;
  }>;
}

/**
 * Legislative history extraction request
 */
export interface LegislativeHistoryRequest {
  documentPaths: string[];
  billNumber?: string;
  jurisdiction?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

/**
 * Entity extraction request
 */
export interface EntityExtractionRequest {
  text: string;
  entityTypes?: string[];
}

/**
 * Entity extraction response
 */
export interface EntityExtractionResponse {
  entities: Array<{
    type: string;
    text: string;
    startOffset: number;
    endOffset: number;
    confidence: number;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * DocAI Service - Document intelligence and processing
 */
export class DocAIService {
  private static instance: DocAIService;
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string | undefined;
  private timeout: number;

  private constructor() {
    this.baseURL = process.env.DOCAI_URL || 'http://localhost:8002';
    this.apiKey = process.env.DOCAI_API_KEY;
    this.timeout = parseInt(process.env.DOCAI_TIMEOUT || '60000', 10);

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('DocAI request', {
          method: config.method?.toUpperCase(),
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('DocAI request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('DocAI response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error: AxiosError) => {
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DocAIService {
    if (!DocAIService.instance) {
      DocAIService.instance = new DocAIService();
    }
    return DocAIService.instance;
  }

  /**
   * Handle axios errors
   */
  private handleError(error: AxiosError): void {
    if (error.response) {
      logger.error('DocAI API error', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
      });
    } else if (error.request) {
      logger.error('DocAI network error', {
        message: error.message,
        url: error.config?.url,
      });
    } else {
      logger.error('DocAI unknown error', {
        message: error.message,
      });
    }
  }

  /**
   * Extract text from PDF/image using OCR
   *
   * Processes documents with OCR to extract text, tables, and images.
   * Supports multiple languages and maintains layout structure.
   *
   * @param request - OCR extraction parameters
   * @returns Extracted text and structured data
   */
  public async extractText(request: OCRRequest): Promise<OCRResponse> {
    try {
      logger.info('Extracting text with OCR', {
        filePath: request.filePath,
        extractTables: request.extractTables,
        extractImages: request.extractImages,
      });

      // Verify file exists
      if (!fs.existsSync(request.filePath)) {
        throw new APIError(
          'FILE_NOT_FOUND',
          `File not found: ${request.filePath}`,
          404
        );
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', fs.createReadStream(request.filePath));
      formData.append('extract_tables', (request.extractTables || false).toString());
      formData.append('extract_images', (request.extractImages || false).toString());
      formData.append('language', request.language || 'eng');

      const response = await this.client.post('/api/v1/ocr/extract', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      const ocrResponse: OCRResponse = {
        text: response.data.text || '',
        pages: response.data.pages || 0,
        tables: response.data.tables || [],
        images: response.data.images || [],
        confidence: response.data.confidence || 0,
      };

      logger.info('OCR extraction completed', {
        pages: ocrResponse.pages,
        textLength: ocrResponse.text.length,
        confidence: ocrResponse.confidence,
      });

      return ocrResponse;
    } catch (error) {
      logger.error('OCR extraction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filePath: request.filePath,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('DocAI', {
          message: 'DocAI service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'OCR_EXTRACTION_ERROR',
        'Failed to extract text from document',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Triage documents for relevance and privilege
   *
   * Analyzes documents to determine relevance to the case and potential privilege issues.
   * Returns scores, reasons, and classification for review workflow.
   *
   * @param requests - Array of triage requests
   * @returns Triage results with scores and reasoning
   */
  public async triageDocuments(
    requests: TriageRequest[]
  ): Promise<DocAITriageResult[]> {
    try {
      logger.info('Triaging documents', {
        documentCount: requests.length,
      });

      // Process documents in parallel batches
      const batchSize = parseInt(process.env.DOCAI_BATCH_SIZE || '10', 10);
      const results: DocAITriageResult[] = [];

      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);

        const batchPromises = batch.map(async (request) => {
          // First extract text if not already extracted
          let text = '';
          try {
            const ocrResult = await this.extractText({
              filePath: request.filePath,
            });
            text = ocrResult.text;
          } catch (error) {
            logger.error('Failed to extract text for triage', {
              documentId: request.documentId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }

          // Perform triage
          const payload = {
            document_id: request.documentId,
            text: text,
            case_context: request.caseContext,
            relevance_threshold: request.relevanceThreshold || 0.5,
            privilege_threshold: request.privilegeThreshold || 0.7,
          };

          const response = await this.client.post(
            '/api/v1/triage/analyze',
            payload
          );

          return {
            document_id: response.data.document_id,
            relevance_score: response.data.relevance_score,
            relevance_reasons: response.data.relevance_reasons || [],
            privilege_score: response.data.privilege_score,
            privilege_indicators: response.data.privilege_indicators || [],
            classification: response.data.classification,
            key_entities: response.data.key_entities || [],
          } as DocAITriageResult;
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        logger.debug('Triage batch completed', {
          batchNumber: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
        });
      }

      logger.info('Document triage completed', {
        totalDocuments: results.length,
        averageRelevance:
          results.reduce((sum, r) => sum + r.relevance_score, 0) / results.length,
        averagePrivilege:
          results.reduce((sum, r) => sum + r.privilege_score, 0) / results.length,
      });

      return results;
    } catch (error) {
      logger.error('Document triage failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        documentCount: requests.length,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('DocAI', {
          message: 'DocAI service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'DOCUMENT_TRIAGE_ERROR',
        'Failed to triage documents',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Classify document into categories
   *
   * Classifies documents into predefined or custom categories using ML models.
   *
   * @param request - Classification parameters
   * @returns Primary category and confidence scores
   */
  public async classifyDocument(
    request: ClassificationRequest
  ): Promise<ClassificationResponse> {
    try {
      logger.info('Classifying document', {
        filePath: request.filePath,
        possibleCategories: request.possibleCategories,
      });

      // Extract text if not provided
      let text = request.text;
      if (!text) {
        const ocrResult = await this.extractText({
          filePath: request.filePath,
        });
        text = ocrResult.text;
      }

      const payload = {
        text: text,
        possible_categories: request.possibleCategories || [
          'court_filing',
          'discovery',
          'expert_report',
          'deposition',
          'legislative_record',
          'census_data',
          'election_results',
          'correspondence',
          'research',
          'other',
        ],
      };

      const response = await this.client.post(
        '/api/v1/classification/classify',
        payload
      );

      const classification: ClassificationResponse = {
        primaryCategory: response.data.primary_category,
        confidence: response.data.confidence,
        allCategories: response.data.all_categories || [],
      };

      logger.info('Document classification completed', {
        primaryCategory: classification.primaryCategory,
        confidence: classification.confidence,
      });

      return classification;
    } catch (error) {
      logger.error('Document classification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filePath: request.filePath,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('DocAI', {
          message: 'DocAI service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'CLASSIFICATION_ERROR',
        'Failed to classify document',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Extract legislative history timeline from documents
   *
   * Analyzes legislative documents to construct a timeline of events,
   * identify key actors, and detect discriminatory patterns.
   *
   * @param request - Legislative history parameters
   * @returns Timeline with events, actors, and analysis
   */
  public async extractLegislativeHistory(
    request: LegislativeHistoryRequest
  ): Promise<LegislativeTimeline> {
    try {
      logger.info('Extracting legislative history', {
        documentCount: request.documentPaths.length,
        billNumber: request.billNumber,
      });

      // Extract text from all documents
      const documentTexts: Array<{ path: string; text: string }> = [];

      for (const docPath of request.documentPaths) {
        try {
          const ocrResult = await this.extractText({ filePath: docPath });
          documentTexts.push({ path: docPath, text: ocrResult.text });
        } catch (error) {
          logger.warn('Failed to extract text from document', {
            path: docPath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const payload = {
        documents: documentTexts,
        bill_number: request.billNumber,
        jurisdiction: request.jurisdiction,
        date_range: request.dateRange
          ? {
              from: request.dateRange.from.toISOString().split('T')[0],
              to: request.dateRange.to.toISOString().split('T')[0],
            }
          : undefined,
      };

      const response = await this.client.post(
        '/api/v1/legislative/extract-history',
        payload,
        { timeout: 120000 } // 2 minute timeout for complex analysis
      );

      const timeline: LegislativeTimeline = {
        events: response.data.events.map((e: any) => ({
          date: e.date,
          event_type: e.event_type,
          description: e.description,
          actors: e.actors || [],
          document_ids: e.document_ids || [],
          significance: e.significance || 0,
        })),
        actors: response.data.actors.map((a: any) => ({
          name: a.name,
          role: a.role,
          party: a.party || 'Unknown',
          statements: a.statements || 0,
        })),
        key_moments: response.data.key_moments.map((m: any) => ({
          date: m.date,
          title: m.title,
          description: m.description,
          discriminatory_indicators: m.discriminatory_indicators || [],
        })),
      };

      logger.info('Legislative history extraction completed', {
        events: timeline.events.length,
        actors: timeline.actors.length,
        keyMoments: timeline.key_moments.length,
      });

      return timeline;
    } catch (error) {
      logger.error('Legislative history extraction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        documentCount: request.documentPaths.length,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('DocAI', {
          message: 'DocAI service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'LEGISLATIVE_HISTORY_ERROR',
        'Failed to extract legislative history',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Extract named entities from text
   *
   * Identifies and extracts named entities (people, organizations, dates, locations)
   * from document text using NER models.
   *
   * @param request - Entity extraction parameters
   * @returns Extracted entities with types and confidence
   */
  public async extractEntities(
    request: EntityExtractionRequest
  ): Promise<EntityExtractionResponse> {
    try {
      logger.info('Extracting entities', {
        textLength: request.text.length,
        entityTypes: request.entityTypes,
      });

      const payload = {
        text: request.text,
        entity_types: request.entityTypes || [
          'PERSON',
          'ORGANIZATION',
          'LOCATION',
          'DATE',
          'CASE_CITATION',
          'STATUTE',
          'JURISDICTION',
        ],
      };

      const response = await this.client.post(
        '/api/v1/entities/extract',
        payload
      );

      const entities: EntityExtractionResponse = {
        entities: response.data.entities.map((e: any) => ({
          type: e.type,
          text: e.text,
          startOffset: e.start_offset,
          endOffset: e.end_offset,
          confidence: e.confidence,
          metadata: e.metadata || {},
        })),
      };

      logger.info('Entity extraction completed', {
        entitiesFound: entities.entities.length,
        entityTypes: [...new Set(entities.entities.map((e) => e.type))],
      });

      return entities;
    } catch (error) {
      logger.error('Entity extraction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: request.text.length,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('DocAI', {
          message: 'DocAI service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'ENTITY_EXTRACTION_ERROR',
        'Failed to extract entities',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Check service health
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.error('DocAI health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

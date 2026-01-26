/**
 * GraphRAG Service
 *
 * Client for GraphRAG API - VRA precedent search, circuit analysis, and embeddings
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../server';
import {
  GinglesIssue,
  SenateFactor,
  GraphRAGSearchResult,
  CircuitComparison,
  DBPrecedent,
  ServiceUnavailableError,
  APIError,
} from '../types';

/**
 * GraphRAG search filters
 */
export interface GraphRAGSearchFilters {
  query: string;
  ginglesIssues?: GinglesIssue[];
  senateFactors?: SenateFactor[];
  circuits?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  courtLevels?: string[];
  limit?: number;
  offset?: number;
  minRelevanceScore?: number;
}

/**
 * Circuit comparison request
 */
export interface CircuitComparisonRequest {
  issue: GinglesIssue | SenateFactor;
  circuits: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Precedent ingestion request
 */
export interface PrecedentIngestionRequest {
  caseName: string;
  citation: string;
  circuit?: string;
  courtLevel?: string;
  decisionDate?: Date;
  ginglesIssues?: GinglesIssue[];
  senateFactors?: SenateFactor[];
  holding?: string;
  majorityOpinionText?: string;
  dissentingOpinionText?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Embedding generation request
 */
export interface EmbeddingRequest {
  text: string;
  model?: string;
}

/**
 * Embedding generation response
 */
export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
}

/**
 * GraphRAG Service - VRA precedent search and analysis
 */
export class GraphRAGService {
  private static instance: GraphRAGService;
  private client: AxiosInstance;
  private baseURL: string;
  private apiKey: string | undefined;
  private timeout: number;

  private constructor() {
    this.baseURL = process.env.GRAPHRAG_URL || 'http://localhost:8001';
    this.apiKey = process.env.GRAPHRAG_API_KEY;
    this.timeout = parseInt(process.env.GRAPHRAG_TIMEOUT || '30000', 10);

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('GraphRAG request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error('GraphRAG request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('GraphRAG response', {
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
  public static getInstance(): GraphRAGService {
    if (!GraphRAGService.instance) {
      GraphRAGService.instance = new GraphRAGService();
    }
    return GraphRAGService.instance;
  }

  /**
   * Handle axios errors
   */
  private handleError(error: AxiosError): void {
    if (error.response) {
      logger.error('GraphRAG API error', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
      });
    } else if (error.request) {
      logger.error('GraphRAG network error', {
        message: error.message,
        url: error.config?.url,
      });
    } else {
      logger.error('GraphRAG unknown error', {
        message: error.message,
      });
    }
  }

  /**
   * Search VRA precedents with filters
   *
   * Searches GraphRAG knowledge graph for relevant VRA precedents based on
   * query text, Gingles issues, Senate factors, circuits, and date ranges.
   *
   * @param filters - Search filters
   * @returns Search results with precedents and relevance scores
   */
  public async searchVRAPrecedents(
    filters: GraphRAGSearchFilters
  ): Promise<GraphRAGSearchResult> {
    try {
      logger.info('Searching VRA precedents', {
        query: filters.query.substring(0, 100),
        ginglesIssues: filters.ginglesIssues,
        circuits: filters.circuits,
      });

      const params: Record<string, unknown> = {
        query: filters.query,
        limit: filters.limit || 20,
        offset: filters.offset || 0,
      };

      // Add optional filters
      if (filters.ginglesIssues && filters.ginglesIssues.length > 0) {
        params.gingles_issues = filters.ginglesIssues.join(',');
      }

      if (filters.senateFactors && filters.senateFactors.length > 0) {
        params.senate_factors = filters.senateFactors.join(',');
      }

      if (filters.circuits && filters.circuits.length > 0) {
        params.circuits = filters.circuits.join(',');
      }

      if (filters.courtLevels && filters.courtLevels.length > 0) {
        params.court_levels = filters.courtLevels.join(',');
      }

      if (filters.dateFrom) {
        params.date_from = filters.dateFrom.toISOString().split('T')[0];
      }

      if (filters.dateTo) {
        params.date_to = filters.dateTo.toISOString().split('T')[0];
      }

      if (filters.minRelevanceScore) {
        params.min_relevance_score = filters.minRelevanceScore;
      }

      const response = await this.client.get('/api/v1/search/vra-precedents', {
        params,
      });

      const results: GraphRAGSearchResult = {
        precedents: response.data.precedents.map((p: any) => ({
          id: p.id,
          case_name: p.case_name,
          citation: p.citation,
          circuit: p.circuit || 'Unknown',
          gingles_issues: p.gingles_issues || [],
          senate_factors: p.senate_factors || [],
          holding: p.holding || '',
          relevance_score: p.relevance_score || 0,
          metadata: p.metadata || {},
        })),
        total: response.data.total || response.data.precedents.length,
      };

      logger.info('VRA precedent search completed', {
        resultsCount: results.precedents.length,
        total: results.total,
      });

      return results;
    } catch (error) {
      logger.error('VRA precedent search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('GraphRAG', {
          message: 'GraphRAG service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'GRAPHRAG_SEARCH_ERROR',
        'Failed to search VRA precedents',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Compare circuits on a specific issue
   *
   * Analyzes how different circuits have ruled on a specific Gingles issue
   * or Senate factor, providing success rates and key precedents.
   *
   * @param request - Circuit comparison request
   * @returns Circuit comparison with success rates and precedents
   */
  public async compareCircuits(
    request: CircuitComparisonRequest
  ): Promise<CircuitComparison> {
    try {
      logger.info('Comparing circuits', {
        issue: request.issue,
        circuits: request.circuits,
      });

      const params: Record<string, unknown> = {
        issue: request.issue,
        circuits: request.circuits.join(','),
      };

      if (request.dateFrom) {
        params.date_from = request.dateFrom.toISOString().split('T')[0];
      }

      if (request.dateTo) {
        params.date_to = request.dateTo.toISOString().split('T')[0];
      }

      const response = await this.client.get('/api/v1/analysis/circuit-comparison', {
        params,
      });

      const comparison: CircuitComparison = {
        issue: request.issue,
        circuits: response.data.circuits.map((c: any) => ({
          circuit: c.circuit,
          case_count: c.case_count || 0,
          plaintiff_success_rate: c.plaintiff_success_rate || 0,
          key_precedents: c.key_precedents || [],
          summary: c.summary || '',
        })),
      };

      logger.info('Circuit comparison completed', {
        issue: request.issue,
        circuitsAnalyzed: comparison.circuits.length,
      });

      return comparison;
    } catch (error) {
      logger.error('Circuit comparison failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('GraphRAG', {
          message: 'GraphRAG service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'CIRCUIT_COMPARISON_ERROR',
        'Failed to compare circuits',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Ingest a new precedent into GraphRAG
   *
   * Adds a new VRA precedent to the GraphRAG knowledge graph with full text,
   * metadata, and embeddings for semantic search.
   *
   * @param request - Precedent data to ingest
   * @returns Ingested precedent with generated ID and embedding
   */
  public async ingestPrecedent(
    request: PrecedentIngestionRequest
  ): Promise<DBPrecedent> {
    try {
      logger.info('Ingesting precedent', {
        caseName: request.caseName,
        citation: request.citation,
      });

      // Generate embedding from opinion text
      let embedding: number[] | null = null;
      if (request.majorityOpinionText) {
        const embeddingResponse = await this.generateEmbedding({
          text: request.majorityOpinionText,
        });
        embedding = embeddingResponse.embedding;
      }

      const payload = {
        case_name: request.caseName,
        citation: request.citation,
        circuit: request.circuit,
        court_level: request.courtLevel,
        decision_date: request.decisionDate?.toISOString().split('T')[0],
        gingles_issues: request.ginglesIssues || [],
        senate_factors: request.senateFactors || [],
        holding: request.holding,
        majority_opinion_text: request.majorityOpinionText,
        dissenting_opinion_text: request.dissentingOpinionText,
        embedding: embedding,
        metadata: request.metadata || {},
      };

      const response = await this.client.post(
        '/api/v1/precedents/ingest',
        payload
      );

      const precedent: DBPrecedent = {
        id: response.data.id,
        case_name: response.data.case_name,
        citation: response.data.citation,
        circuit: response.data.circuit,
        court_level: response.data.court_level,
        decision_date: response.data.decision_date
          ? new Date(response.data.decision_date)
          : null,
        gingles_issues: response.data.gingles_issues || [],
        senate_factors: response.data.senate_factors || [],
        holding: response.data.holding,
        majority_opinion_text: response.data.majority_opinion_text,
        dissenting_opinion_text: response.data.dissenting_opinion_text,
        embedding: response.data.embedding,
        metadata: response.data.metadata || {},
        created_at: new Date(response.data.created_at),
      };

      logger.info('Precedent ingested successfully', {
        id: precedent.id,
        caseName: precedent.case_name,
        embeddingDimensions: embedding?.length || 0,
      });

      return precedent;
    } catch (error) {
      logger.error('Precedent ingestion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('GraphRAG', {
          message: 'GraphRAG service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'PRECEDENT_INGESTION_ERROR',
        'Failed to ingest precedent',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Generate embedding vector for text
   *
   * Generates semantic embedding vector for text using GraphRAG's embedding model.
   * Used for precedent search and semantic similarity.
   *
   * @param request - Text to embed
   * @returns Embedding vector and metadata
   */
  public async generateEmbedding(
    request: EmbeddingRequest
  ): Promise<EmbeddingResponse> {
    try {
      logger.debug('Generating embedding', {
        textLength: request.text.length,
        model: request.model,
      });

      const payload = {
        text: request.text,
        model: request.model || 'text-embedding-3-small',
      };

      const response = await this.client.post('/api/v1/embeddings/generate', payload);

      const embeddingResponse: EmbeddingResponse = {
        embedding: response.data.embedding,
        model: response.data.model,
        dimensions: response.data.embedding.length,
      };

      logger.debug('Embedding generated', {
        dimensions: embeddingResponse.dimensions,
        model: embeddingResponse.model,
      });

      return embeddingResponse;
    } catch (error) {
      logger.error('Embedding generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: request.text.length,
      });

      if (axios.isAxiosError(error) && !error.response) {
        throw new ServiceUnavailableError('GraphRAG', {
          message: 'GraphRAG service is unreachable',
          url: this.baseURL,
        });
      }

      throw new APIError(
        'EMBEDDING_GENERATION_ERROR',
        'Failed to generate embedding',
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
      logger.error('GraphRAG health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

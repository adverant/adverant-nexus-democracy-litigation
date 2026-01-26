/**
 * Democracy Litigation Plugin Store (Zustand + Immer)
 *
 * Manages state for the Democracy Litigation dashboard including:
 * - Case state (active case, cases list)
 * - Document state (documents, triage, upload)
 * - Research state (precedents, circuit comparison, VRA search)
 * - Geographic state (geo data, compactness, H3 alignment)
 * - Expert witness state (experts, reports)
 * - Deadline state (deadlines, conflicts, alerts)
 * - Job state (async operations, progress tracking)
 * - UI state (filters, pagination, modals)
 *
 * Follows patterns from ee-design-store.ts
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type {
  DLCase,
  CaseType,
  CaseStatus,
  CasePhase,
  DLDocument,
  DocumentType,
  ProcessingStatus,
  Precedent,
  GinglesIssue,
  SenateFactor,
  GeographicData,
  GeoType,
  ExpertWitness,
  ExpertSpecialty,
  Deadline,
  DeadlineType,
  DeadlineStatus,
  DeadlinePriority,
  Job,
  JobType,
  JobStatus,
  TriageResults,
  CircuitComparisonResults,
  LegislativeHistoryTimeline,
  GinglesAnalysis,
  PatternAnalysisResults,
  OpposingCounselIntelligence,
  DeadlineConflict,
} from '@/types/democracy-litigation';

// ============================================================================
// Types
// ============================================================================

/**
 * Progress state for long-running operations
 */
interface ProgressState {
  /** Progress percentage (0-100) */
  percent: number;
  /** Current step/phase name */
  step: string;
  /** Status message */
  message: string;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/**
 * Document upload state
 */
interface UploadState {
  /** Whether upload is in progress */
  uploading: boolean;
  /** Upload progress (0-100) */
  progress: number;
  /** Current file being uploaded */
  currentFile?: string;
  /** Error message if upload failed */
  error?: string;
}

/**
 * Research job state for precedent search
 */
interface ResearchJobState {
  /** Current job ID */
  jobId: string | null;
  /** Whether research is running */
  running: boolean;
  /** Progress state */
  progress: ProgressState;
  /** Result when complete */
  result?: Precedent[];
}

/**
 * Circuit comparison job state
 */
interface CircuitComparisonJobState {
  /** Current job ID */
  jobId: string | null;
  /** Whether analysis is running */
  running: boolean;
  /** Progress state */
  progress: ProgressState;
  /** Result when complete */
  result?: CircuitComparisonResults;
}

/**
 * Geographic analysis job state
 */
interface GeoAnalysisJobState {
  /** Current job ID */
  jobId: string | null;
  /** Whether analysis is running */
  running: boolean;
  /** Progress state */
  progress: ProgressState;
  /** Analysis type */
  analysisType?: 'compactness' | 'census_alignment' | 'h3_grid';
  /** Result when complete */
  result?: unknown;
}

/**
 * Triage job state
 */
interface TriageJobState {
  /** Current job ID */
  jobId: string | null;
  /** Whether triage is running */
  running: boolean;
  /** Progress state */
  progress: ProgressState;
  /** Result when complete */
  result?: TriageResults;
}

// ============================================================================
// State Interface
// ============================================================================

interface DemocracyLitigationState {
  // ---------------------------------------------------------------------------
  // Case State
  // ---------------------------------------------------------------------------

  /** Currently active case ID */
  activeCaseId: string | null;

  /** Currently active case data */
  activeCase: DLCase | null;

  /** List of all cases */
  cases: DLCase[];

  /** Cases loading state */
  casesLoading: boolean;

  /** Cases error message */
  casesError: string | null;

  // ---------------------------------------------------------------------------
  // Document State
  // ---------------------------------------------------------------------------

  /** Documents for current case */
  documents: DLDocument[];

  /** Documents loading state */
  documentsLoading: boolean;

  /** Documents error message */
  documentsError: string | null;

  /** Document upload state */
  uploadState: UploadState;

  /** Triage job state */
  triageJob: TriageJobState;

  // ---------------------------------------------------------------------------
  // Research State
  // ---------------------------------------------------------------------------

  /** Precedent search results */
  precedents: Precedent[];

  /** Precedents loading state */
  precedentsLoading: boolean;

  /** Precedents error message */
  precedentsError: string | null;

  /** Research job state */
  researchJob: ResearchJobState;

  /** Circuit comparison job state */
  circuitComparisonJob: CircuitComparisonJobState;

  /** Legislative history timeline */
  legislativeHistory: LegislativeHistoryTimeline | null;

  /** Legislative history loading state */
  legislativeHistoryLoading: boolean;

  /** Pattern analysis results */
  patternAnalysis: PatternAnalysisResults | null;

  /** Pattern analysis loading state */
  patternAnalysisLoading: boolean;

  /** Opposing counsel intelligence */
  counselIntelligence: OpposingCounselIntelligence | null;

  /** Opposing counsel intelligence loading state */
  counselIntelligenceLoading: boolean;

  // ---------------------------------------------------------------------------
  // Geographic State
  // ---------------------------------------------------------------------------

  /** Geographic data for current case */
  geoData: GeographicData[];

  /** Geographic data loading state */
  geoDataLoading: boolean;

  /** Geographic data error message */
  geoDataError: string | null;

  /** Geographic analysis job state */
  geoAnalysisJob: GeoAnalysisJobState;

  /** Gingles analysis results */
  ginglesAnalysis: GinglesAnalysis | null;

  /** Gingles analysis loading state */
  ginglesAnalysisLoading: boolean;

  // ---------------------------------------------------------------------------
  // Expert Witness State
  // ---------------------------------------------------------------------------

  /** Expert witnesses database */
  experts: ExpertWitness[];

  /** Experts loading state */
  expertsLoading: boolean;

  /** Experts error message */
  expertsError: string | null;

  /** Currently selected expert */
  selectedExpert: ExpertWitness | null;

  /** Expert report generation job ID */
  expertReportJobId: string | null;

  /** Expert report generation progress */
  expertReportProgress: ProgressState;

  // ---------------------------------------------------------------------------
  // Deadline State
  // ---------------------------------------------------------------------------

  /** Deadlines for current case */
  deadlines: Deadline[];

  /** Deadlines loading state */
  deadlinesLoading: boolean;

  /** Deadlines error message */
  deadlinesError: string | null;

  /** Deadline conflicts */
  deadlineConflicts: DeadlineConflict[];

  /** Upcoming deadlines (next 30 days) */
  upcomingDeadlines: Deadline[];

  // ---------------------------------------------------------------------------
  // Job State (Generic async operations)
  // ---------------------------------------------------------------------------

  /** Active jobs */
  jobs: Job[];

  /** Jobs loading state */
  jobsLoading: boolean;

  // ---------------------------------------------------------------------------
  // UI State
  // ---------------------------------------------------------------------------

  /** Selected case type filter */
  selectedCaseTypeFilter: CaseType | 'all';

  /** Selected case status filter */
  selectedStatusFilter: CaseStatus | 'all';

  /** Selected case phase filter */
  selectedPhaseFilter: CasePhase | 'all';

  /** Selected jurisdiction filter */
  selectedJurisdictionFilter: string | 'all';

  /** Case search query */
  caseSearchQuery: string;

  /** Document type filter */
  selectedDocTypeFilter: DocumentType | 'all';

  /** Document processing status filter */
  selectedDocStatusFilter: ProcessingStatus | 'all';

  /** Document search query */
  documentSearchQuery: string;

  /** Deadline priority filter */
  selectedDeadlinePriorityFilter: DeadlinePriority | 'all';

  /** Deadline status filter */
  selectedDeadlineStatusFilter: DeadlineStatus | 'all';

  /** Expert specialty filter */
  selectedExpertSpecialtyFilter: ExpertSpecialty | 'all';

  /** Whether case creation dialog is open */
  isCreateCaseOpen: boolean;

  /** Whether case settings dialog is open */
  isCaseSettingsOpen: boolean;

  /** Whether document upload dialog is open */
  isDocumentUploadOpen: boolean;

  /** Whether triage config dialog is open */
  isTriageConfigOpen: boolean;

  /** Whether VRA search dialog is open */
  isVRASearchOpen: boolean;

  /** Whether circuit comparison dialog is open */
  isCircuitComparisonOpen: boolean;

  /** Whether geo analysis dialog is open */
  isGeoAnalysisOpen: boolean;

  /** Whether expert report dialog is open */
  isExpertReportOpen: boolean;

  /** Whether deadline creation dialog is open */
  isCreateDeadlineOpen: boolean;

  /** Active tab in the litigation interface */
  activeTab: 'overview' | 'documents' | 'research' | 'geographic' | 'experts' | 'deadlines';

  /** Active subtab in documents view */
  documentsSubtab: 'all' | 'expert_reports' | 'discovery' | 'pleadings';

  /** Active subtab in research view */
  researchSubtab: 'precedents' | 'legislative' | 'patterns';

  /** Active subtab in geographic view */
  geoSubtab: 'map' | 'compactness' | 'gingles';

  // ===========================================================================
  // Actions
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Case Actions
  // ---------------------------------------------------------------------------

  setActiveCase: (caseId: string | null) => void;
  setActiveCaseData: (dlCase: DLCase | null) => void;
  setCases: (cases: DLCase[]) => void;
  addCase: (dlCase: DLCase) => void;
  updateCase: (caseId: string, updates: Partial<DLCase>) => void;
  removeCase: (caseId: string) => void;
  setCasesLoading: (loading: boolean) => void;
  setCasesError: (error: string | null) => void;

  // ---------------------------------------------------------------------------
  // Document Actions
  // ---------------------------------------------------------------------------

  setDocuments: (documents: DLDocument[]) => void;
  addDocument: (document: DLDocument) => void;
  updateDocument: (documentId: string, updates: Partial<DLDocument>) => void;
  removeDocument: (documentId: string) => void;
  setDocumentsLoading: (loading: boolean) => void;
  setDocumentsError: (error: string | null) => void;
  setUploadProgress: (progress: number, currentFile?: string) => void;
  setUploadError: (error: string | null) => void;
  resetUploadState: () => void;

  // ---------------------------------------------------------------------------
  // Triage Actions
  // ---------------------------------------------------------------------------

  setTriageJobId: (jobId: string | null) => void;
  setTriageRunning: (running: boolean) => void;
  updateTriageProgress: (progress: Partial<ProgressState>) => void;
  setTriageResult: (result: TriageResults) => void;
  resetTriage: () => void;

  // ---------------------------------------------------------------------------
  // Research Actions
  // ---------------------------------------------------------------------------

  setPrecedents: (precedents: Precedent[]) => void;
  addPrecedent: (precedent: Precedent) => void;
  updatePrecedent: (precedentId: string, updates: Partial<Precedent>) => void;
  setPrecedentsLoading: (loading: boolean) => void;
  setPrecedentsError: (error: string | null) => void;
  setResearchJobId: (jobId: string | null) => void;
  setResearchRunning: (running: boolean) => void;
  updateResearchProgress: (progress: Partial<ProgressState>) => void;
  setResearchResult: (result: Precedent[]) => void;
  resetResearch: () => void;

  // ---------------------------------------------------------------------------
  // Circuit Comparison Actions
  // ---------------------------------------------------------------------------

  setCircuitComparisonJobId: (jobId: string | null) => void;
  setCircuitComparisonRunning: (running: boolean) => void;
  updateCircuitComparisonProgress: (progress: Partial<ProgressState>) => void;
  setCircuitComparisonResult: (result: CircuitComparisonResults) => void;
  resetCircuitComparison: () => void;

  // ---------------------------------------------------------------------------
  // Legislative History Actions
  // ---------------------------------------------------------------------------

  setLegislativeHistory: (timeline: LegislativeHistoryTimeline | null) => void;
  setLegislativeHistoryLoading: (loading: boolean) => void;

  // ---------------------------------------------------------------------------
  // Pattern Analysis Actions
  // ---------------------------------------------------------------------------

  setPatternAnalysis: (results: PatternAnalysisResults | null) => void;
  setPatternAnalysisLoading: (loading: boolean) => void;

  // ---------------------------------------------------------------------------
  // Opposing Counsel Intelligence Actions
  // ---------------------------------------------------------------------------

  setCounselIntelligence: (intel: OpposingCounselIntelligence | null) => void;
  setCounselIntelligenceLoading: (loading: boolean) => void;

  // ---------------------------------------------------------------------------
  // Geographic Actions
  // ---------------------------------------------------------------------------

  setGeoData: (geoData: GeographicData[]) => void;
  addGeoData: (geoData: GeographicData) => void;
  updateGeoData: (geoId: string, updates: Partial<GeographicData>) => void;
  setGeoDataLoading: (loading: boolean) => void;
  setGeoDataError: (error: string | null) => void;
  setGeoAnalysisJobId: (jobId: string | null, analysisType?: 'compactness' | 'census_alignment' | 'h3_grid') => void;
  setGeoAnalysisRunning: (running: boolean) => void;
  updateGeoAnalysisProgress: (progress: Partial<ProgressState>) => void;
  setGeoAnalysisResult: (result: unknown) => void;
  resetGeoAnalysis: () => void;

  // ---------------------------------------------------------------------------
  // Gingles Analysis Actions
  // ---------------------------------------------------------------------------

  setGinglesAnalysis: (analysis: GinglesAnalysis | null) => void;
  setGinglesAnalysisLoading: (loading: boolean) => void;

  // ---------------------------------------------------------------------------
  // Expert Witness Actions
  // ---------------------------------------------------------------------------

  setExperts: (experts: ExpertWitness[]) => void;
  addExpert: (expert: ExpertWitness) => void;
  updateExpert: (expertId: string, updates: Partial<ExpertWitness>) => void;
  setExpertsLoading: (loading: boolean) => void;
  setExpertsError: (error: string | null) => void;
  setSelectedExpert: (expert: ExpertWitness | null) => void;
  setExpertReportJobId: (jobId: string | null) => void;
  updateExpertReportProgress: (progress: Partial<ProgressState>) => void;

  // ---------------------------------------------------------------------------
  // Deadline Actions
  // ---------------------------------------------------------------------------

  setDeadlines: (deadlines: Deadline[]) => void;
  addDeadline: (deadline: Deadline) => void;
  updateDeadline: (deadlineId: string, updates: Partial<Deadline>) => void;
  removeDeadline: (deadlineId: string) => void;
  setDeadlinesLoading: (loading: boolean) => void;
  setDeadlinesError: (error: string | null) => void;
  setDeadlineConflicts: (conflicts: DeadlineConflict[]) => void;
  setUpcomingDeadlines: (deadlines: Deadline[]) => void;

  // ---------------------------------------------------------------------------
  // Job Actions
  // ---------------------------------------------------------------------------

  setJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
  setJobsLoading: (loading: boolean) => void;

  // ---------------------------------------------------------------------------
  // UI Actions
  // ---------------------------------------------------------------------------

  setSelectedCaseTypeFilter: (caseType: CaseType | 'all') => void;
  setSelectedStatusFilter: (status: CaseStatus | 'all') => void;
  setSelectedPhaseFilter: (phase: CasePhase | 'all') => void;
  setSelectedJurisdictionFilter: (jurisdiction: string | 'all') => void;
  setCaseSearchQuery: (query: string) => void;
  setSelectedDocTypeFilter: (docType: DocumentType | 'all') => void;
  setSelectedDocStatusFilter: (status: ProcessingStatus | 'all') => void;
  setDocumentSearchQuery: (query: string) => void;
  setSelectedDeadlinePriorityFilter: (priority: DeadlinePriority | 'all') => void;
  setSelectedDeadlineStatusFilter: (status: DeadlineStatus | 'all') => void;
  setSelectedExpertSpecialtyFilter: (specialty: ExpertSpecialty | 'all') => void;
  openCreateCase: () => void;
  closeCreateCase: () => void;
  openCaseSettings: () => void;
  closeCaseSettings: () => void;
  openDocumentUpload: () => void;
  closeDocumentUpload: () => void;
  openTriageConfig: () => void;
  closeTriageConfig: () => void;
  openVRASearch: () => void;
  closeVRASearch: () => void;
  openCircuitComparison: () => void;
  closeCircuitComparison: () => void;
  openGeoAnalysis: () => void;
  closeGeoAnalysis: () => void;
  openExpertReport: () => void;
  closeExpertReport: () => void;
  openCreateDeadline: () => void;
  closeCreateDeadline: () => void;
  setActiveTab: (tab: 'overview' | 'documents' | 'research' | 'geographic' | 'experts' | 'deadlines') => void;
  setDocumentsSubtab: (subtab: 'all' | 'expert_reports' | 'discovery' | 'pleadings') => void;
  setResearchSubtab: (subtab: 'precedents' | 'legislative' | 'patterns') => void;
  setGeoSubtab: (subtab: 'map' | 'compactness' | 'gingles') => void;

  // ---------------------------------------------------------------------------
  // Utility Actions
  // ---------------------------------------------------------------------------

  reset: () => void;
  resetCaseState: () => void;
  resetDocumentState: () => void;
  resetResearchState: () => void;
  resetGeoState: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialProgressState: ProgressState = {
  percent: 0,
  step: '',
  message: '',
  estimatedTimeRemaining: undefined,
};

const initialUploadState: UploadState = {
  uploading: false,
  progress: 0,
  currentFile: undefined,
  error: undefined,
};

const initialTriageJobState: TriageJobState = {
  jobId: null,
  running: false,
  progress: { ...initialProgressState },
  result: undefined,
};

const initialResearchJobState: ResearchJobState = {
  jobId: null,
  running: false,
  progress: { ...initialProgressState },
  result: undefined,
};

const initialCircuitComparisonJobState: CircuitComparisonJobState = {
  jobId: null,
  running: false,
  progress: { ...initialProgressState },
  result: undefined,
};

const initialGeoAnalysisJobState: GeoAnalysisJobState = {
  jobId: null,
  running: false,
  progress: { ...initialProgressState },
  analysisType: undefined,
  result: undefined,
};

const initialState = {
  // Case State
  activeCaseId: null,
  activeCase: null,
  cases: [],
  casesLoading: false,
  casesError: null,

  // Document State
  documents: [],
  documentsLoading: false,
  documentsError: null,
  uploadState: { ...initialUploadState },
  triageJob: { ...initialTriageJobState },

  // Research State
  precedents: [],
  precedentsLoading: false,
  precedentsError: null,
  researchJob: { ...initialResearchJobState },
  circuitComparisonJob: { ...initialCircuitComparisonJobState },
  legislativeHistory: null,
  legislativeHistoryLoading: false,
  patternAnalysis: null,
  patternAnalysisLoading: false,
  counselIntelligence: null,
  counselIntelligenceLoading: false,

  // Geographic State
  geoData: [],
  geoDataLoading: false,
  geoDataError: null,
  geoAnalysisJob: { ...initialGeoAnalysisJobState },
  ginglesAnalysis: null,
  ginglesAnalysisLoading: false,

  // Expert Witness State
  experts: [],
  expertsLoading: false,
  expertsError: null,
  selectedExpert: null,
  expertReportJobId: null,
  expertReportProgress: { ...initialProgressState },

  // Deadline State
  deadlines: [],
  deadlinesLoading: false,
  deadlinesError: null,
  deadlineConflicts: [],
  upcomingDeadlines: [],

  // Job State
  jobs: [],
  jobsLoading: false,

  // UI State
  selectedCaseTypeFilter: 'all' as const,
  selectedStatusFilter: 'all' as const,
  selectedPhaseFilter: 'all' as const,
  selectedJurisdictionFilter: 'all' as const,
  caseSearchQuery: '',
  selectedDocTypeFilter: 'all' as const,
  selectedDocStatusFilter: 'all' as const,
  documentSearchQuery: '',
  selectedDeadlinePriorityFilter: 'all' as const,
  selectedDeadlineStatusFilter: 'all' as const,
  selectedExpertSpecialtyFilter: 'all' as const,
  isCreateCaseOpen: false,
  isCaseSettingsOpen: false,
  isDocumentUploadOpen: false,
  isTriageConfigOpen: false,
  isVRASearchOpen: false,
  isCircuitComparisonOpen: false,
  isGeoAnalysisOpen: false,
  isExpertReportOpen: false,
  isCreateDeadlineOpen: false,
  activeTab: 'overview' as const,
  documentsSubtab: 'all' as const,
  researchSubtab: 'precedents' as const,
  geoSubtab: 'map' as const,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useDemocracyLitigationStore = create<DemocracyLitigationState>()(
  persist(
    immer((set) => ({
      ...initialState,

      // -------------------------------------------------------------------------
      // Case Actions
      // -------------------------------------------------------------------------

      setActiveCase: (caseId) =>
        set((state) => {
          state.activeCaseId = caseId;
          if (caseId) {
            const dlCase = state.cases.find((c) => c.id === caseId);
            state.activeCase = dlCase ?? null;
          } else {
            state.activeCase = null;
          }
          // Reset dependent state when switching cases
          state.documents = [];
          state.geoData = [];
          state.deadlines = [];
          state.precedents = [];
          state.legislativeHistory = null;
          state.patternAnalysis = null;
          state.ginglesAnalysis = null;
        }),

      setActiveCaseData: (dlCase) =>
        set((state) => {
          state.activeCase = dlCase;
          if (dlCase) {
            state.activeCaseId = dlCase.id;
            // Update in cases list if exists
            const index = state.cases.findIndex((c) => c.id === dlCase.id);
            if (index !== -1) {
              state.cases[index] = dlCase;
            }
          }
        }),

      setCases: (cases) =>
        set((state) => {
          state.cases = cases;
          state.casesError = null;
          // Update active case if it exists in new list
          if (state.activeCaseId) {
            const activeCase = cases.find((c) => c.id === state.activeCaseId);
            state.activeCase = activeCase ?? null;
          }
        }),

      addCase: (dlCase) =>
        set((state) => {
          state.cases.unshift(dlCase);
        }),

      updateCase: (caseId, updates) =>
        set((state) => {
          const index = state.cases.findIndex((c) => c.id === caseId);
          if (index !== -1 && state.cases[index]) {
            const dlCase = state.cases[index];
            Object.assign(dlCase, updates);
          }
          if (state.activeCase?.id === caseId) {
            Object.assign(state.activeCase, updates);
          }
        }),

      removeCase: (caseId) =>
        set((state) => {
          state.cases = state.cases.filter((c) => c.id !== caseId);
          if (state.activeCaseId === caseId) {
            state.activeCaseId = null;
            state.activeCase = null;
          }
        }),

      setCasesLoading: (loading) =>
        set((state) => {
          state.casesLoading = loading;
        }),

      setCasesError: (error) =>
        set((state) => {
          state.casesError = error;
        }),

      // -------------------------------------------------------------------------
      // Document Actions
      // -------------------------------------------------------------------------

      setDocuments: (documents) =>
        set((state) => {
          state.documents = documents;
          state.documentsError = null;
        }),

      addDocument: (document) =>
        set((state) => {
          state.documents.unshift(document);
        }),

      updateDocument: (documentId, updates) =>
        set((state) => {
          const index = state.documents.findIndex((d) => d.id === documentId);
          if (index !== -1 && state.documents[index]) {
            const document = state.documents[index];
            Object.assign(document, updates);
          }
        }),

      removeDocument: (documentId) =>
        set((state) => {
          state.documents = state.documents.filter((d) => d.id !== documentId);
        }),

      setDocumentsLoading: (loading) =>
        set((state) => {
          state.documentsLoading = loading;
        }),

      setDocumentsError: (error) =>
        set((state) => {
          state.documentsError = error;
        }),

      setUploadProgress: (progress, currentFile) =>
        set((state) => {
          state.uploadState.uploading = true;
          state.uploadState.progress = progress;
          state.uploadState.currentFile = currentFile;
          state.uploadState.error = undefined;
        }),

      setUploadError: (error) =>
        set((state) => {
          state.uploadState.uploading = false;
          state.uploadState.error = error ?? undefined;
        }),

      resetUploadState: () =>
        set((state) => {
          state.uploadState = { ...initialUploadState };
        }),

      // -------------------------------------------------------------------------
      // Triage Actions
      // -------------------------------------------------------------------------

      setTriageJobId: (jobId) =>
        set((state) => {
          state.triageJob.jobId = jobId;
        }),

      setTriageRunning: (running) =>
        set((state) => {
          state.triageJob.running = running;
          if (!running) {
            state.triageJob.progress = { ...initialProgressState };
          }
        }),

      updateTriageProgress: (progress) =>
        set((state) => {
          state.triageJob.progress = { ...state.triageJob.progress, ...progress };
        }),

      setTriageResult: (result) =>
        set((state) => {
          state.triageJob.result = result;
          state.triageJob.running = false;
        }),

      resetTriage: () =>
        set((state) => {
          state.triageJob = { ...initialTriageJobState };
        }),

      // -------------------------------------------------------------------------
      // Research Actions
      // -------------------------------------------------------------------------

      setPrecedents: (precedents) =>
        set((state) => {
          state.precedents = precedents;
          state.precedentsError = null;
        }),

      addPrecedent: (precedent) =>
        set((state) => {
          state.precedents.unshift(precedent);
        }),

      updatePrecedent: (precedentId, updates) =>
        set((state) => {
          const index = state.precedents.findIndex((p) => p.id === precedentId);
          if (index !== -1 && state.precedents[index]) {
            const precedent = state.precedents[index];
            Object.assign(precedent, updates);
          }
        }),

      setPrecedentsLoading: (loading) =>
        set((state) => {
          state.precedentsLoading = loading;
        }),

      setPrecedentsError: (error) =>
        set((state) => {
          state.precedentsError = error;
        }),

      setResearchJobId: (jobId) =>
        set((state) => {
          state.researchJob.jobId = jobId;
        }),

      setResearchRunning: (running) =>
        set((state) => {
          state.researchJob.running = running;
          if (!running) {
            state.researchJob.progress = { ...initialProgressState };
          }
        }),

      updateResearchProgress: (progress) =>
        set((state) => {
          state.researchJob.progress = { ...state.researchJob.progress, ...progress };
        }),

      setResearchResult: (result) =>
        set((state) => {
          state.researchJob.result = result;
          state.researchJob.running = false;
          state.precedents = result;
        }),

      resetResearch: () =>
        set((state) => {
          state.researchJob = { ...initialResearchJobState };
        }),

      // -------------------------------------------------------------------------
      // Circuit Comparison Actions
      // -------------------------------------------------------------------------

      setCircuitComparisonJobId: (jobId) =>
        set((state) => {
          state.circuitComparisonJob.jobId = jobId;
        }),

      setCircuitComparisonRunning: (running) =>
        set((state) => {
          state.circuitComparisonJob.running = running;
          if (!running) {
            state.circuitComparisonJob.progress = { ...initialProgressState };
          }
        }),

      updateCircuitComparisonProgress: (progress) =>
        set((state) => {
          state.circuitComparisonJob.progress = {
            ...state.circuitComparisonJob.progress,
            ...progress,
          };
        }),

      setCircuitComparisonResult: (result) =>
        set((state) => {
          state.circuitComparisonJob.result = result;
          state.circuitComparisonJob.running = false;
        }),

      resetCircuitComparison: () =>
        set((state) => {
          state.circuitComparisonJob = { ...initialCircuitComparisonJobState };
        }),

      // -------------------------------------------------------------------------
      // Legislative History Actions
      // -------------------------------------------------------------------------

      setLegislativeHistory: (timeline) =>
        set((state) => {
          state.legislativeHistory = timeline;
        }),

      setLegislativeHistoryLoading: (loading) =>
        set((state) => {
          state.legislativeHistoryLoading = loading;
        }),

      // -------------------------------------------------------------------------
      // Pattern Analysis Actions
      // -------------------------------------------------------------------------

      setPatternAnalysis: (results) =>
        set((state) => {
          state.patternAnalysis = results;
        }),

      setPatternAnalysisLoading: (loading) =>
        set((state) => {
          state.patternAnalysisLoading = loading;
        }),

      // -------------------------------------------------------------------------
      // Opposing Counsel Intelligence Actions
      // -------------------------------------------------------------------------

      setCounselIntelligence: (intel) =>
        set((state) => {
          state.counselIntelligence = intel;
        }),

      setCounselIntelligenceLoading: (loading) =>
        set((state) => {
          state.counselIntelligenceLoading = loading;
        }),

      // -------------------------------------------------------------------------
      // Geographic Actions
      // -------------------------------------------------------------------------

      setGeoData: (geoData) =>
        set((state) => {
          state.geoData = geoData;
          state.geoDataError = null;
        }),

      addGeoData: (geoData) =>
        set((state) => {
          state.geoData.push(geoData);
        }),

      updateGeoData: (geoId, updates) =>
        set((state) => {
          const index = state.geoData.findIndex((g) => g.id === geoId);
          if (index !== -1 && state.geoData[index]) {
            const geo = state.geoData[index];
            Object.assign(geo, updates);
          }
        }),

      setGeoDataLoading: (loading) =>
        set((state) => {
          state.geoDataLoading = loading;
        }),

      setGeoDataError: (error) =>
        set((state) => {
          state.geoDataError = error;
        }),

      setGeoAnalysisJobId: (jobId, analysisType) =>
        set((state) => {
          state.geoAnalysisJob.jobId = jobId;
          state.geoAnalysisJob.analysisType = analysisType;
        }),

      setGeoAnalysisRunning: (running) =>
        set((state) => {
          state.geoAnalysisJob.running = running;
          if (!running) {
            state.geoAnalysisJob.progress = { ...initialProgressState };
          }
        }),

      updateGeoAnalysisProgress: (progress) =>
        set((state) => {
          state.geoAnalysisJob.progress = { ...state.geoAnalysisJob.progress, ...progress };
        }),

      setGeoAnalysisResult: (result) =>
        set((state) => {
          state.geoAnalysisJob.result = result;
          state.geoAnalysisJob.running = false;
        }),

      resetGeoAnalysis: () =>
        set((state) => {
          state.geoAnalysisJob = { ...initialGeoAnalysisJobState };
        }),

      // -------------------------------------------------------------------------
      // Gingles Analysis Actions
      // -------------------------------------------------------------------------

      setGinglesAnalysis: (analysis) =>
        set((state) => {
          state.ginglesAnalysis = analysis;
        }),

      setGinglesAnalysisLoading: (loading) =>
        set((state) => {
          state.ginglesAnalysisLoading = loading;
        }),

      // -------------------------------------------------------------------------
      // Expert Witness Actions
      // -------------------------------------------------------------------------

      setExperts: (experts) =>
        set((state) => {
          state.experts = experts;
          state.expertsError = null;
        }),

      addExpert: (expert) =>
        set((state) => {
          state.experts.unshift(expert);
        }),

      updateExpert: (expertId, updates) =>
        set((state) => {
          const index = state.experts.findIndex((e) => e.id === expertId);
          if (index !== -1 && state.experts[index]) {
            const expert = state.experts[index];
            Object.assign(expert, updates);
          }
          if (state.selectedExpert?.id === expertId) {
            Object.assign(state.selectedExpert, updates);
          }
        }),

      setExpertsLoading: (loading) =>
        set((state) => {
          state.expertsLoading = loading;
        }),

      setExpertsError: (error) =>
        set((state) => {
          state.expertsError = error;
        }),

      setSelectedExpert: (expert) =>
        set((state) => {
          state.selectedExpert = expert;
        }),

      setExpertReportJobId: (jobId) =>
        set((state) => {
          state.expertReportJobId = jobId;
        }),

      updateExpertReportProgress: (progress) =>
        set((state) => {
          state.expertReportProgress = { ...state.expertReportProgress, ...progress };
        }),

      // -------------------------------------------------------------------------
      // Deadline Actions
      // -------------------------------------------------------------------------

      setDeadlines: (deadlines) =>
        set((state) => {
          state.deadlines = deadlines;
          state.deadlinesError = null;
        }),

      addDeadline: (deadline) =>
        set((state) => {
          state.deadlines.unshift(deadline);
        }),

      updateDeadline: (deadlineId, updates) =>
        set((state) => {
          const index = state.deadlines.findIndex((d) => d.id === deadlineId);
          if (index !== -1 && state.deadlines[index]) {
            const deadline = state.deadlines[index];
            Object.assign(deadline, updates);
          }
        }),

      removeDeadline: (deadlineId) =>
        set((state) => {
          state.deadlines = state.deadlines.filter((d) => d.id !== deadlineId);
        }),

      setDeadlinesLoading: (loading) =>
        set((state) => {
          state.deadlinesLoading = loading;
        }),

      setDeadlinesError: (error) =>
        set((state) => {
          state.deadlinesError = error;
        }),

      setDeadlineConflicts: (conflicts) =>
        set((state) => {
          state.deadlineConflicts = conflicts;
        }),

      setUpcomingDeadlines: (deadlines) =>
        set((state) => {
          state.upcomingDeadlines = deadlines;
        }),

      // -------------------------------------------------------------------------
      // Job Actions
      // -------------------------------------------------------------------------

      setJobs: (jobs) =>
        set((state) => {
          state.jobs = jobs;
        }),

      addJob: (job) =>
        set((state) => {
          state.jobs.unshift(job);
        }),

      updateJob: (jobId, updates) =>
        set((state) => {
          const index = state.jobs.findIndex((j) => j.id === jobId);
          if (index !== -1 && state.jobs[index]) {
            const job = state.jobs[index];
            Object.assign(job, updates);
          }
        }),

      removeJob: (jobId) =>
        set((state) => {
          state.jobs = state.jobs.filter((j) => j.id !== jobId);
        }),

      setJobsLoading: (loading) =>
        set((state) => {
          state.jobsLoading = loading;
        }),

      // -------------------------------------------------------------------------
      // UI Actions
      // -------------------------------------------------------------------------

      setSelectedCaseTypeFilter: (caseType) =>
        set((state) => {
          state.selectedCaseTypeFilter = caseType;
        }),

      setSelectedStatusFilter: (status) =>
        set((state) => {
          state.selectedStatusFilter = status;
        }),

      setSelectedPhaseFilter: (phase) =>
        set((state) => {
          state.selectedPhaseFilter = phase;
        }),

      setSelectedJurisdictionFilter: (jurisdiction) =>
        set((state) => {
          state.selectedJurisdictionFilter = jurisdiction;
        }),

      setCaseSearchQuery: (query) =>
        set((state) => {
          state.caseSearchQuery = query;
        }),

      setSelectedDocTypeFilter: (docType) =>
        set((state) => {
          state.selectedDocTypeFilter = docType;
        }),

      setSelectedDocStatusFilter: (status) =>
        set((state) => {
          state.selectedDocStatusFilter = status;
        }),

      setDocumentSearchQuery: (query) =>
        set((state) => {
          state.documentSearchQuery = query;
        }),

      setSelectedDeadlinePriorityFilter: (priority) =>
        set((state) => {
          state.selectedDeadlinePriorityFilter = priority;
        }),

      setSelectedDeadlineStatusFilter: (status) =>
        set((state) => {
          state.selectedDeadlineStatusFilter = status;
        }),

      setSelectedExpertSpecialtyFilter: (specialty) =>
        set((state) => {
          state.selectedExpertSpecialtyFilter = specialty;
        }),

      openCreateCase: () =>
        set((state) => {
          state.isCreateCaseOpen = true;
        }),

      closeCreateCase: () =>
        set((state) => {
          state.isCreateCaseOpen = false;
        }),

      openCaseSettings: () =>
        set((state) => {
          state.isCaseSettingsOpen = true;
        }),

      closeCaseSettings: () =>
        set((state) => {
          state.isCaseSettingsOpen = false;
        }),

      openDocumentUpload: () =>
        set((state) => {
          state.isDocumentUploadOpen = true;
        }),

      closeDocumentUpload: () =>
        set((state) => {
          state.isDocumentUploadOpen = false;
        }),

      openTriageConfig: () =>
        set((state) => {
          state.isTriageConfigOpen = true;
        }),

      closeTriageConfig: () =>
        set((state) => {
          state.isTriageConfigOpen = false;
        }),

      openVRASearch: () =>
        set((state) => {
          state.isVRASearchOpen = true;
        }),

      closeVRASearch: () =>
        set((state) => {
          state.isVRASearchOpen = false;
        }),

      openCircuitComparison: () =>
        set((state) => {
          state.isCircuitComparisonOpen = true;
        }),

      closeCircuitComparison: () =>
        set((state) => {
          state.isCircuitComparisonOpen = false;
        }),

      openGeoAnalysis: () =>
        set((state) => {
          state.isGeoAnalysisOpen = true;
        }),

      closeGeoAnalysis: () =>
        set((state) => {
          state.isGeoAnalysisOpen = false;
        }),

      openExpertReport: () =>
        set((state) => {
          state.isExpertReportOpen = true;
        }),

      closeExpertReport: () =>
        set((state) => {
          state.isExpertReportOpen = false;
        }),

      openCreateDeadline: () =>
        set((state) => {
          state.isCreateDeadlineOpen = true;
        }),

      closeCreateDeadline: () =>
        set((state) => {
          state.isCreateDeadlineOpen = false;
        }),

      setActiveTab: (tab) =>
        set((state) => {
          state.activeTab = tab;
        }),

      setDocumentsSubtab: (subtab) =>
        set((state) => {
          state.documentsSubtab = subtab;
        }),

      setResearchSubtab: (subtab) =>
        set((state) => {
          state.researchSubtab = subtab;
        }),

      setGeoSubtab: (subtab) =>
        set((state) => {
          state.geoSubtab = subtab;
        }),

      // -------------------------------------------------------------------------
      // Utility Actions
      // -------------------------------------------------------------------------

      reset: () =>
        set(() => ({
          ...initialState,
        })),

      resetCaseState: () =>
        set((state) => {
          state.activeCaseId = null;
          state.activeCase = null;
          state.cases = [];
          state.casesLoading = false;
          state.casesError = null;
        }),

      resetDocumentState: () =>
        set((state) => {
          state.documents = [];
          state.documentsLoading = false;
          state.documentsError = null;
          state.uploadState = { ...initialUploadState };
          state.triageJob = { ...initialTriageJobState };
        }),

      resetResearchState: () =>
        set((state) => {
          state.precedents = [];
          state.precedentsLoading = false;
          state.precedentsError = null;
          state.researchJob = { ...initialResearchJobState };
          state.circuitComparisonJob = { ...initialCircuitComparisonJobState };
          state.legislativeHistory = null;
          state.legislativeHistoryLoading = false;
          state.patternAnalysis = null;
          state.patternAnalysisLoading = false;
          state.counselIntelligence = null;
          state.counselIntelligenceLoading = false;
        }),

      resetGeoState: () =>
        set((state) => {
          state.geoData = [];
          state.geoDataLoading = false;
          state.geoDataError = null;
          state.geoAnalysisJob = { ...initialGeoAnalysisJobState };
          state.ginglesAnalysis = null;
          state.ginglesAnalysisLoading = false;
        }),
    })),
    {
      name: 'nexus-democracy-litigation',
      partialize: (state) => ({
        // Only persist user preferences and UI state
        activeCaseId: state.activeCaseId,
        selectedCaseTypeFilter: state.selectedCaseTypeFilter,
        selectedStatusFilter: state.selectedStatusFilter,
        selectedPhaseFilter: state.selectedPhaseFilter,
        selectedJurisdictionFilter: state.selectedJurisdictionFilter,
        selectedDocTypeFilter: state.selectedDocTypeFilter,
        selectedDocStatusFilter: state.selectedDocStatusFilter,
        selectedDeadlinePriorityFilter: state.selectedDeadlinePriorityFilter,
        selectedDeadlineStatusFilter: state.selectedDeadlineStatusFilter,
        selectedExpertSpecialtyFilter: state.selectedExpertSpecialtyFilter,
        activeTab: state.activeTab,
        documentsSubtab: state.documentsSubtab,
        researchSubtab: state.researchSubtab,
        geoSubtab: state.geoSubtab,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Get filtered cases based on current filters
 */
export const useFilteredCases = () =>
  useDemocracyLitigationStore((state) => {
    let filtered = state.cases;

    // Apply case type filter
    if (state.selectedCaseTypeFilter !== 'all') {
      filtered = filtered.filter((c) => c.caseType === state.selectedCaseTypeFilter);
    }

    // Apply status filter
    if (state.selectedStatusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === state.selectedStatusFilter);
    }

    // Apply phase filter
    if (state.selectedPhaseFilter !== 'all') {
      filtered = filtered.filter((c) => c.phase === state.selectedPhaseFilter);
    }

    // Apply jurisdiction filter
    if (state.selectedJurisdictionFilter !== 'all') {
      filtered = filtered.filter((c) => c.jurisdiction === state.selectedJurisdictionFilter);
    }

    // Apply search query
    if (state.caseSearchQuery) {
      const query = state.caseSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.caseNumber?.toLowerCase().includes(query) ?? false) ||
          (c.description?.toLowerCase().includes(query) ?? false) ||
          c.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  });

/**
 * Get filtered documents based on current filters
 */
export const useFilteredDocuments = () =>
  useDemocracyLitigationStore((state) => {
    let filtered = state.documents;

    // Apply document type filter
    if (state.selectedDocTypeFilter !== 'all') {
      filtered = filtered.filter((d) => d.docType === state.selectedDocTypeFilter);
    }

    // Apply processing status filter
    if (state.selectedDocStatusFilter !== 'all') {
      filtered = filtered.filter((d) => d.processingStatus === state.selectedDocStatusFilter);
    }

    // Apply search query
    if (state.documentSearchQuery) {
      const query = state.documentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.filename.toLowerCase().includes(query) ||
          (d.fullText?.toLowerCase().includes(query) ?? false) ||
          (d.summary?.toLowerCase().includes(query) ?? false) ||
          d.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  });

/**
 * Get filtered deadlines based on current filters
 */
export const useFilteredDeadlines = () =>
  useDemocracyLitigationStore((state) => {
    let filtered = state.deadlines;

    // Apply priority filter
    if (state.selectedDeadlinePriorityFilter !== 'all') {
      filtered = filtered.filter((d) => d.priority === state.selectedDeadlinePriorityFilter);
    }

    // Apply status filter
    if (state.selectedDeadlineStatusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === state.selectedDeadlineStatusFilter);
    }

    return filtered;
  });

/**
 * Get filtered experts based on current filters
 */
export const useFilteredExperts = () =>
  useDemocracyLitigationStore((state) => {
    let filtered = state.experts;

    // Apply specialty filter
    if (state.selectedExpertSpecialtyFilter !== 'all') {
      const specialty = state.selectedExpertSpecialtyFilter as ExpertSpecialty;
      filtered = filtered.filter((e) =>
        e.specialties.includes(specialty)
      );
    }

    return filtered;
  });

/**
 * Get cases by status
 */
export const useCasesByStatus = (status: CaseStatus) =>
  useDemocracyLitigationStore((state) => state.cases.filter((c) => c.status === status));

/**
 * Get cases by type
 */
export const useCasesByType = (caseType: CaseType) =>
  useDemocracyLitigationStore((state) => state.cases.filter((c) => c.caseType === caseType));

/**
 * Get cases by phase
 */
export const useCasesByPhase = (phase: CasePhase) =>
  useDemocracyLitigationStore((state) => state.cases.filter((c) => c.phase === phase));

/**
 * Get case statistics
 */
export const useCaseStats = () =>
  useDemocracyLitigationStore((state) => {
    const cases = state.cases;
    return {
      total: cases.length,
      byStatus: {
        active: cases.filter((c) => c.status === 'active').length,
        settled: cases.filter((c) => c.status === 'settled').length,
        dismissed: cases.filter((c) => c.status === 'dismissed').length,
        won: cases.filter((c) => c.status === 'won').length,
        lost: cases.filter((c) => c.status === 'lost').length,
        on_hold: cases.filter((c) => c.status === 'on_hold').length,
        appeal: cases.filter((c) => c.status === 'appeal').length,
        remanded: cases.filter((c) => c.status === 'remanded').length,
      },
      byType: {
        redistricting: cases.filter((c) => c.caseType === 'redistricting').length,
        voter_id: cases.filter((c) => c.caseType === 'voter_id').length,
        ballot_access: cases.filter((c) => c.caseType === 'ballot_access').length,
        voter_purges: cases.filter((c) => c.caseType === 'voter_purges').length,
        direct_democracy: cases.filter((c) => c.caseType === 'direct_democracy').length,
        poll_closures: cases.filter((c) => c.caseType === 'poll_closures').length,
        drop_box_restrictions: cases.filter((c) => c.caseType === 'drop_box_restrictions').length,
        early_voting: cases.filter((c) => c.caseType === 'early_voting').length,
        absentee_voting: cases.filter((c) => c.caseType === 'absentee_voting').length,
      },
      avgCompletion:
        cases.length > 0
          ? Math.round(cases.reduce((sum, c) => sum + c.completionPercent, 0) / cases.length)
          : 0,
    };
  });

/**
 * Get document statistics
 */
export const useDocumentStats = () =>
  useDemocracyLitigationStore((state) => {
    const docs = state.documents;
    return {
      total: docs.length,
      byType: {
        expert_report: docs.filter((d) => d.docType === 'expert_report').length,
        legislative_record: docs.filter((d) => d.docType === 'legislative_record').length,
        court_filing: docs.filter((d) => d.docType === 'court_filing').length,
        discovery: docs.filter((d) => d.docType === 'discovery').length,
        deposition: docs.filter((d) => d.docType === 'deposition').length,
        voter_file: docs.filter((d) => d.docType === 'voter_file').length,
        census_data: docs.filter((d) => d.docType === 'census_data').length,
        election_results: docs.filter((d) => d.docType === 'election_results').length,
      },
      byStatus: {
        pending: docs.filter((d) => d.processingStatus === 'pending').length,
        processing: docs.filter((d) => d.processingStatus === 'processing').length,
        completed: docs.filter((d) => d.processingStatus === 'completed').length,
        failed: docs.filter((d) => d.processingStatus === 'failed').length,
      },
      privilegeDetected: docs.filter((d) => d.privilegeDetected).length,
      avgRelevanceScore:
        docs.length > 0
          ? docs.reduce((sum, d) => sum + (d.relevanceScore ?? 0), 0) / docs.length
          : 0,
    };
  });

/**
 * Get deadline statistics
 */
export const useDeadlineStats = () =>
  useDemocracyLitigationStore((state) => {
    const deadlines = state.deadlines;
    const now = new Date();
    return {
      total: deadlines.length,
      byStatus: {
        pending: deadlines.filter((d) => d.status === 'pending').length,
        completed: deadlines.filter((d) => d.status === 'completed').length,
        missed: deadlines.filter((d) => d.status === 'missed').length,
        extended: deadlines.filter((d) => d.status === 'extended').length,
        cancelled: deadlines.filter((d) => d.status === 'cancelled').length,
      },
      byPriority: {
        low: deadlines.filter((d) => d.priority === 'low').length,
        normal: deadlines.filter((d) => d.priority === 'normal').length,
        high: deadlines.filter((d) => d.priority === 'high').length,
        critical: deadlines.filter((d) => d.priority === 'critical').length,
      },
      upcoming: deadlines.filter((d) => {
        const deadlineDate = new Date(d.deadlineDate);
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000);
        return daysUntil >= 0 && daysUntil <= 30 && d.status === 'pending';
      }).length,
      overdue: deadlines.filter((d) => {
        const deadlineDate = new Date(d.deadlineDate);
        return deadlineDate < now && d.status === 'pending';
      }).length,
    };
  });

/**
 * Check if any operation is currently running
 */
export const useIsOperationRunning = () =>
  useDemocracyLitigationStore(
    (state) =>
      state.triageJob.running ||
      state.researchJob.running ||
      state.circuitComparisonJob.running ||
      state.geoAnalysisJob.running ||
      state.uploadState.uploading ||
      state.legislativeHistoryLoading ||
      state.patternAnalysisLoading ||
      state.counselIntelligenceLoading ||
      state.ginglesAnalysisLoading
  );

/**
 * Get running jobs
 */
export const useRunningJobs = () =>
  useDemocracyLitigationStore((state) =>
    state.jobs.filter((j) => j.status === 'running' || j.status === 'queued')
  );

/**
 * Get completed jobs
 */
export const useCompletedJobs = () =>
  useDemocracyLitigationStore((state) => state.jobs.filter((j) => j.status === 'completed'));

/**
 * Get failed jobs
 */
export const useFailedJobs = () =>
  useDemocracyLitigationStore((state) => state.jobs.filter((j) => j.status === 'failed'));

/**
 * Get jobs by type
 */
export const useJobsByType = (jobType: JobType) =>
  useDemocracyLitigationStore((state) => state.jobs.filter((j) => j.jobType === jobType));

/**
 * Check if there are any active jobs
 */
export const useHasActiveJobs = () =>
  useDemocracyLitigationStore(
    (state) =>
      state.triageJob.jobId !== null ||
      state.researchJob.jobId !== null ||
      state.circuitComparisonJob.jobId !== null ||
      state.geoAnalysisJob.jobId !== null ||
      state.expertReportJobId !== null
  );

/**
 * Get all active job IDs
 */
export const useActiveJobIds = () =>
  useDemocracyLitigationStore((state) => {
    const jobs: Array<{ type: string; jobId: string }> = [];
    if (state.triageJob.jobId) jobs.push({ type: 'triage', jobId: state.triageJob.jobId });
    if (state.researchJob.jobId)
      jobs.push({ type: 'research', jobId: state.researchJob.jobId });
    if (state.circuitComparisonJob.jobId)
      jobs.push({ type: 'circuit_comparison', jobId: state.circuitComparisonJob.jobId });
    if (state.geoAnalysisJob.jobId)
      jobs.push({ type: 'geo_analysis', jobId: state.geoAnalysisJob.jobId });
    if (state.expertReportJobId)
      jobs.push({ type: 'expert_report', jobId: state.expertReportJobId });
    return jobs;
  });

/**
 * Get documents by type
 */
export const useDocumentsByType = (docType: DocumentType) =>
  useDemocracyLitigationStore((state) => state.documents.filter((d) => d.docType === docType));

/**
 * Get documents by processing status
 */
export const useDocumentsByStatus = (status: ProcessingStatus) =>
  useDemocracyLitigationStore((state) =>
    state.documents.filter((d) => d.processingStatus === status)
  );

/**
 * Get privileged documents
 */
export const usePrivilegedDocuments = () =>
  useDemocracyLitigationStore((state) => state.documents.filter((d) => d.privilegeDetected));

/**
 * Get precedents by Gingles issue
 */
export const usePrecedentsByGinglesIssue = (issue: GinglesIssue) =>
  useDemocracyLitigationStore((state) =>
    state.precedents.filter((p) => p.ginglesIssues.includes(issue))
  );

/**
 * Get precedents by Senate factor
 */
export const usePrecedentsBySenateFactor = (factor: SenateFactor) =>
  useDemocracyLitigationStore((state) =>
    state.precedents.filter((p) => p.senateFactors.includes(factor))
  );

/**
 * Get geographic data by type
 */
export const useGeoDataByType = (geoType: GeoType) =>
  useDemocracyLitigationStore((state) => state.geoData.filter((g) => g.geoType === geoType));

/**
 * Get experts by specialty
 */
export const useExpertsBySpecialty = (specialty: ExpertSpecialty) =>
  useDemocracyLitigationStore((state) =>
    state.experts.filter((e) => e.specialties.includes(specialty))
  );

/**
 * Get deadlines by priority
 */
export const useDeadlinesByPriority = (priority: DeadlinePriority) =>
  useDemocracyLitigationStore((state) => state.deadlines.filter((d) => d.priority === priority));

/**
 * Get deadlines by status
 */
export const useDeadlinesByStatus = (status: DeadlineStatus) =>
  useDemocracyLitigationStore((state) => state.deadlines.filter((d) => d.status === status));

/**
 * Get overdue deadlines
 */
export const useOverdueDeadlines = () =>
  useDemocracyLitigationStore((state) => {
    const now = new Date();
    return state.deadlines.filter((d) => {
      const deadlineDate = new Date(d.deadlineDate);
      return deadlineDate < now && d.status === 'pending';
    });
  });

/**
 * Get urgent deadlines (within 7 days)
 */
export const useUrgentDeadlines = () =>
  useDemocracyLitigationStore((state) => {
    const now = new Date();
    return state.deadlines.filter((d) => {
      const deadlineDate = new Date(d.deadlineDate);
      const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000);
      return daysUntil >= 0 && daysUntil <= 7 && d.status === 'pending';
    });
  });

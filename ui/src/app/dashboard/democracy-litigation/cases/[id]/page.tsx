/**
 * Democracy Litigation - Case Detail Page
 *
 * Comprehensive case view with all associated data
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { Case, Document as DLDocument, Deadline } from '@/types/democracy-litigation';

const CASE_TYPE_LABELS: Record<string, string> = {
  section2: 'Section 2 VRA',
  redistricting: 'Redistricting',
  vote_denial: 'Vote Denial',
  vote_dilution: 'Vote Dilution',
  preclearance: 'Preclearance',
  other: 'Other',
};

const CASE_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  settled: 'Settled',
  won: 'Won',
  lost: 'Lost',
  dismissed: 'Dismissed',
  appealed: 'Appealed',
  archived: 'Archived',
};

const CASE_PHASE_LABELS: Record<string, string> = {
  pre_filing: 'Pre-Filing',
  discovery: 'Discovery',
  expert_reports: 'Expert Reports',
  motions: 'Motions',
  trial: 'Trial',
  appeal: 'Appeal',
  post_judgment: 'Post-Judgment',
};

type Tab = 'overview' | 'documents' | 'deadlines' | 'geographic' | 'experts';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getCase, listDocuments, listDeadlines } = useDemocracyLitigation();

  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<DLDocument[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Load case on mount
  useEffect(() => {
    loadCase();
    loadDocuments();
    loadDeadlines();
  }, [caseId]);

  // Load case
  const loadCase = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getCase(caseId);
      setCaseData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case');
    } finally {
      setIsLoading(false);
    }
  }, [caseId, getCase]);

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      const data = await listDocuments({ caseId });
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, [caseId, listDocuments]);

  // Load deadlines
  const loadDeadlines = useCallback(async () => {
    try {
      const data = await listDeadlines({ caseId });
      setDeadlines(data);
    } catch (err) {
      console.error('Failed to load deadlines:', err);
    }
  }, [caseId, listDeadlines]);

  // Get status color
  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'settled':
      case 'won':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'lost':
      case 'dismissed':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'appealed':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  }, []);

  // Get phase color
  const getPhaseColor = useCallback((phase: string): string => {
    switch (phase) {
      case 'pre_filing':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200';
      case 'discovery':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'expert_reports':
        return 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200';
      case 'motions':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'trial':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'appeal':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading case...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error || 'Case not found'}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/democracy-litigation')}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/democracy-litigation')}
          className="mb-4 text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {caseData.name}
              </h1>
              {caseData.case_number && (
                <p className="text-lg text-gray-600 dark:text-gray-400 font-mono">
                  {caseData.case_number}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(caseData.status)}`}>
                {CASE_STATUS_LABELS[caseData.status] || caseData.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPhaseColor(caseData.phase)}`}>
                {CASE_PHASE_LABELS[caseData.phase] || caseData.phase}
              </span>
            </div>
          </div>

          {/* Case Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Case Type</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {CASE_TYPE_LABELS[caseData.case_type] || caseData.case_type}
              </p>
            </div>

            {caseData.court_name && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Court</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {caseData.court_name}
                </p>
              </div>
            )}

            {caseData.jurisdiction && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Jurisdiction</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {caseData.jurisdiction}
                </p>
              </div>
            )}

            {caseData.filing_date && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Filing Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(caseData.filing_date).toLocaleDateString()}
                </p>
              </div>
            )}

            {caseData.trial_date && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trial Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(caseData.trial_date).toLocaleDateString()}
                </p>
              </div>
            )}

            {caseData.legal_claims && caseData.legal_claims.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Legal Claims</p>
                <div className="flex flex-wrap gap-1">
                  {caseData.legal_claims.map((claim, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                    >
                      {claim}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8">
            {(['overview', 'documents', 'deadlines', 'geographic', 'experts'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plaintiffs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Plaintiffs ({caseData.plaintiffs.length})
              </h2>
              {caseData.plaintiffs.length > 0 ? (
                <ul className="space-y-2">
                  {caseData.plaintiffs.map((plaintiff, index) => (
                    <li
                      key={index}
                      className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {plaintiff.name}
                      </p>
                      {plaintiff.type && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {plaintiff.type}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-sm">No plaintiffs listed</p>
              )}
            </div>

            {/* Defendants */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Defendants ({caseData.defendants.length})
              </h2>
              {caseData.defendants.length > 0 ? (
                <ul className="space-y-2">
                  {caseData.defendants.map((defendant, index) => (
                    <li
                      key={index}
                      className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {defendant.name}
                      </p>
                      {defendant.type && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {defendant.type}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-sm">No defendants listed</p>
              )}
            </div>
          </div>

          {/* Counsel */}
          {caseData.counsel.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Counsel ({caseData.counsel.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {caseData.counsel.map((attorney, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <p className="font-medium text-gray-900 dark:text-white">
                      {attorney.name}
                    </p>
                    {attorney.firm && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {attorney.firm}
                      </p>
                    )}
                    {attorney.role && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {attorney.role}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Documents
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {documents.length}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Deadlines
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {deadlines.length}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Days to Trial
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {caseData.trial_date
                  ? Math.ceil(
                      (new Date(caseData.trial_date).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Documents ({documents.length})
            </h2>
            <button
              onClick={() => router.push(`/dashboard/democracy-litigation/discovery?caseId=${caseId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Upload Documents
            </button>
          </div>

          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => router.push(`/dashboard/democracy-litigation/documents/${doc.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {doc.filename}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {doc.doc_type} • {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              No documents uploaded yet
            </p>
          )}
        </div>
      )}

      {activeTab === 'deadlines' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Deadlines ({deadlines.length})
            </h2>
            <button
              onClick={() => router.push(`/dashboard/democracy-litigation/deadlines?caseId=${caseId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              View Calendar
            </button>
          </div>

          {deadlines.length > 0 ? (
            <div className="space-y-2">
              {deadlines
                .sort((a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime())
                .slice(0, 10)
                .map((deadline) => (
                  <div
                    key={deadline.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {deadline.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {deadline.deadline_type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(deadline.deadline_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {Math.ceil(
                          (new Date(deadline.deadline_date).getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                        )}{' '}
                        days
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              No deadlines set yet
            </p>
          )}
        </div>
      )}

      {activeTab === 'geographic' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Geographic Analysis
          </h2>
          <button
            onClick={() => router.push(`/dashboard/democracy-litigation/geographic/maps?caseId=${caseId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Open GeoAgent Analysis
          </button>
        </div>
      )}

      {activeTab === 'experts' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Expert Witnesses
          </h2>
          <button
            onClick={() => router.push('/dashboard/democracy-litigation/experts')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Experts
          </button>
        </div>
      )}
    </div>
  );
}

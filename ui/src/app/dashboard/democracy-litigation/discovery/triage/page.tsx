/**
 * Democracy Litigation - Discovery Triage Page
 *
 * Document triage interface with AI-powered relevance and privilege scoring
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { useDemocracyLitigationStore } from '@/stores/democracy-litigation-store';
import { DLDocument } from '@/types/democracy-litigation';

type TriageStatus = 'all' | 'pending' | 'triaged' | 'flagged';
type SortField = 'uploadedAt' | 'relevanceScore' | 'privilegeScore' | 'filename';
type SortOrder = 'asc' | 'desc';

export default function DiscoveryTriagePage() {
  const router = useRouter();
  const { listDocuments, triageDocuments } = useDemocracyLitigation();
  const { activeCase, documents, documentsLoading, jobs } = useDemocracyLitigationStore();

  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<TriageStatus>('all');
  const [sortField, setSortField] = useState<SortField>('uploadedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const itemsPerPage = 20;

  // Load documents for active case
  useEffect(() => {
    if (activeCase?.id) {
      listDocuments(activeCase.id);
    }
  }, [activeCase?.id, listDocuments]);

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = documents.filter((doc) => doc.caseId === activeCase?.id);

    // Filter by status
    if (filterStatus === 'pending') {
      filtered = filtered.filter((doc) => doc.triageStatus === null || doc.triageStatus === 'pending');
    } else if (filterStatus === 'triaged') {
      filtered = filtered.filter((doc) => doc.triageStatus === 'completed');
    } else if (filterStatus === 'flagged') {
      filtered = filtered.filter(
        (doc) => doc.privilegeScore !== null && doc.privilegeScore >= 0.7
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'uploadedAt') {
        aValue = new Date(a.uploadedAt).getTime();
        bValue = new Date(b.uploadedAt).getTime();
      } else if (sortField === 'relevanceScore') {
        aValue = a.relevanceScore ?? -1;
        bValue = b.relevanceScore ?? -1;
      } else if (sortField === 'privilegeScore') {
        aValue = a.privilegeScore ?? -1;
        bValue = b.privilegeScore ?? -1;
      } else {
        aValue = a.filename.toLowerCase();
        bValue = b.filename.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [documents, activeCase?.id, filterStatus, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle select document
  const handleSelectDocument = useCallback((docId: string) => {
    setSelectedDocuments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (selectedDocuments.size === paginatedDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(paginatedDocuments.map((doc) => doc.id)));
    }
  }, [paginatedDocuments, selectedDocuments.size]);

  // Handle run triage
  const handleRunTriage = useCallback(async () => {
    if (selectedDocuments.size === 0) {
      alert('Please select at least one document to triage');
      return;
    }

    if (!activeCase?.id) {
      alert('No active case selected');
      return;
    }

    const confirmed = confirm(
      `Run AI triage on ${selectedDocuments.size} document(s)? This will analyze relevance and privilege.`
    );

    if (!confirmed) return;

    try {
      await triageDocuments(activeCase.id, Array.from(selectedDocuments), 0.5, 0.7);
      alert('Triage job started. Results will appear when processing is complete.');
      setSelectedDocuments(new Set());
    } catch (error) {
      alert(`Triage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [selectedDocuments, activeCase?.id, triageDocuments]);

  // Handle toggle expand
  const handleToggleExpand = useCallback((docId: string) => {
    setExpandedDocId((prev) => (prev === docId ? null : docId));
  }, []);

  // Get relevance badge color
  const getRelevanceBadgeColor = (score: number | null): string => {
    if (score === null) return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    if (score >= 0.8) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    if (score >= 0.5) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
  };

  // Get privilege badge color
  const getPrivilegeBadgeColor = (score: number | null): string => {
    if (score === null) return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    if (score >= 0.7) return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
    if (score >= 0.4) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
  };

  // Check if there's an active triage job
  const activeTriageJob = jobs.find(
    (job) => job.jobType === 'document_triage' && job.status === 'running'
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Document Triage
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              AI-powered relevance and privilege analysis for {activeCase?.name || 'your case'}
            </p>
          </div>

          <button
            onClick={() => router.push('/dashboard/democracy-litigation/discovery')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Upload
          </button>
        </div>
      </div>

      {/* Active Job Indicator */}
      {activeTriageJob && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-900 dark:text-blue-200">
                Triage in Progress
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Progress: {activeTriageJob.progress}% - {activeTriageJob.status}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Filter by Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter
              </label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as TriageStatus);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Documents</option>
                <option value="pending">Pending Triage</option>
                <option value="triaged">Triaged</option>
                <option value="flagged">Privileged (≥70%)</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort By
              </label>
              <div className="flex gap-2">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="uploadedAt">Upload Date</option>
                  <option value="relevanceScore">Relevance Score</option>
                  <option value="privilegeScore">Privilege Score</option>
                  <option value="filename">Filename</option>
                </select>

                <button
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedDocuments.size} selected
            </p>
            <button
              onClick={handleRunTriage}
              disabled={selectedDocuments.size === 0 || !!activeTriageJob}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Run Triage ({selectedDocuments.size})
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {filteredDocuments.length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {filteredDocuments.filter((d) => d.triageStatus === null || d.triageStatus === 'pending').length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {filteredDocuments.filter((d) => d.relevanceScore !== null && d.relevanceScore >= 0.8).length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Highly Relevant</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {filteredDocuments.filter((d) => d.privilegeScore !== null && d.privilegeScore >= 0.7).length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Privileged</p>
          </div>
        </div>
      </div>

      {/* Document List */}
      {documentsLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading documents...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No documents found</p>
          <button
            onClick={() => router.push('/dashboard/democracy-litigation/discovery')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Documents
          </button>
        </div>
      ) : (
        <>
          {/* Documents Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-700 dark:text-gray-300">
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedDocuments.size === paginatedDocuments.length && paginatedDocuments.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-4">Filename</div>
              <div className="col-span-2">Relevance</div>
              <div className="col-span-2">Privilege</div>
              <div className="col-span-2">Classification</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedDocuments.map((doc) => (
                <div key={doc.id}>
                  <div className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    {/* Checkbox */}
                    <div className="col-span-1 flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.has(doc.id)}
                        onChange={() => handleSelectDocument(doc.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Filename */}
                    <div className="col-span-4">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(doc.uploadedAt).toLocaleDateString()} • {(doc.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    {/* Relevance Score */}
                    <div className="col-span-2 flex items-center">
                      {doc.relevanceScore !== null ? (
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${getRelevanceBadgeColor(doc.relevanceScore)}`}>
                              {(doc.relevanceScore * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                doc.relevanceScore >= 0.8
                                  ? 'bg-green-600'
                                  : doc.relevanceScore >= 0.5
                                  ? 'bg-yellow-600'
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${doc.relevanceScore * 100}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Not triaged</span>
                      )}
                    </div>

                    {/* Privilege Score */}
                    <div className="col-span-2 flex items-center">
                      {doc.privilegeScore !== null ? (
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium px-2 py-1 rounded ${getPrivilegeBadgeColor(doc.privilegeScore)}`}>
                              {(doc.privilegeScore * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                doc.privilegeScore >= 0.7
                                  ? 'bg-red-600'
                                  : doc.privilegeScore >= 0.4
                                  ? 'bg-yellow-600'
                                  : 'bg-green-600'
                              }`}
                              style={{ width: `${doc.privilegeScore * 100}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Not triaged</span>
                      )}
                    </div>

                    {/* Classification */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {doc.docType.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end">
                      <button
                        onClick={() => handleToggleExpand(doc.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="View details"
                      >
                        {expandedDocId === doc.id ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedDocId === doc.id && (
                    <div className="px-4 py-6 bg-gray-50 dark:bg-gray-700/20 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Relevance Details */}
                        {doc.relevanceScore !== null && (
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                              Relevance Analysis
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Score: {(doc.relevanceScore * 100).toFixed(1)}%
                            </p>
                            {doc.metadata?.relevanceReasons && (
                              <ul className="space-y-1">
                                {(doc.metadata.relevanceReasons as string[]).map((reason, i) => (
                                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                                    • {reason}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Privilege Details */}
                        {doc.privilegeScore !== null && (
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                              Privilege Analysis
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              Score: {(doc.privilegeScore * 100).toFixed(1)}%
                            </p>
                            {doc.metadata?.privilegeIndicators && (
                              <ul className="space-y-1">
                                {(doc.metadata.privilegeIndicators as string[]).map((indicator, i) => (
                                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                                    • {indicator}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {doc.tags.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tags</h4>
                          <div className="flex flex-wrap gap-2">
                            {doc.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredDocuments.length)} of{' '}
                {filteredDocuments.length} documents
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="px-4 py-2 text-gray-900 dark:text-white">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

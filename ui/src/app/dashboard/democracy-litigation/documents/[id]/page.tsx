/**
 * Democracy Litigation - Document Viewer Page
 *
 * View and interact with case documents (PDF viewer with annotations)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { Document as DLDocument } from '@/types/democracy-litigation';

const DOC_TYPE_LABELS: Record<string, string> = {
  court_filing: 'Court Filing',
  discovery: 'Discovery Document',
  expert_report: 'Expert Report',
  deposition: 'Deposition Transcript',
  legislative_record: 'Legislative Record',
  census_data: 'Census Data',
  election_results: 'Election Results',
  correspondence: 'Correspondence',
  research: 'Research Material',
  other: 'Other',
};

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { getDocument } = useDemocracyLitigation();

  const documentId = params.id as string;

  const [document, setDocument] = useState<DLDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);

  const [showOCR, setShowOCR] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  // Load document on mount
  useEffect(() => {
    loadDocument();
  }, [documentId]);

  // Load document
  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getDocument(documentId);
      setDocument(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setIsLoading(false);
    }
  }, [documentId, getDocument]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (!document) return;

    // Create download link
    const a = window.document.createElement('a');
    a.href = document.storage_path;
    a.download = document.filename;
    a.click();
  }, [document]);

  // Handle print
  const handlePrint = useCallback(() => {
    if (!document) return;
    window.print();
  }, [document]);

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
    if (score >= 0.8) return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
    if (score >= 0.5) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error || 'Document not found'}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/democracy-litigation/discovery/triage')}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          ← Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {document.filename}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {DOC_TYPE_LABELS[document.doc_type] || document.doc_type} •{' '}
                {(document.file_size_bytes / 1024 / 1024).toFixed(2)} MB •{' '}
                {new Date(document.uploaded_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOCR(!showOCR)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showOCR
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              OCR Text
            </button>
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showMetadata
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Metadata
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Print
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Download
            </button>
          </div>
        </div>

        {/* Triage Scores */}
        {(document.relevance_score !== null || document.privilege_score !== null) && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {document.relevance_score !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Relevance:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getRelevanceBadgeColor(
                    document.relevance_score
                  )}`}
                >
                  {(document.relevance_score * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {document.privilege_score !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Privilege:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getPrivilegeBadgeColor(
                    document.privilege_score
                  )}`}
                >
                  {(document.privilege_score * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {document.triage_status && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                  {document.triage_status}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">Tags:</span>
            <div className="flex flex-wrap gap-1">
              {document.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-900 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                  />
                </svg>
              </button>

              <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[60px] text-center">
                {zoom}%
              </span>

              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* PDF Display Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            <div
              className="bg-white shadow-lg"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <iframe
                src={document.storage_path}
                className="w-[800px] h-[1000px] border-0"
                title={document.filename}
              />
            </div>
          </div>
        </div>

        {/* Side Panel (OCR Text or Metadata) */}
        {(showOCR || showMetadata) && (
          <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-6">
              {showOCR && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    OCR Extracted Text
                  </h2>
                  {document.ocr_text ? (
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {document.ocr_text}
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      No OCR text available for this document
                    </p>
                  )}
                </div>
              )}

              {showMetadata && (
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    Document Metadata
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Document ID</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-white">
                        {document.id}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Filename</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {document.filename}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Document Type</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {DOC_TYPE_LABELS[document.doc_type] || document.doc_type}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">File Size</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {(document.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Uploaded</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {new Date(document.uploaded_at).toLocaleString()}
                      </p>
                    </div>

                    {document.metadata && Object.keys(document.metadata).length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Additional Metadata
                        </p>
                        <pre className="text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded overflow-auto">
                          {JSON.stringify(document.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

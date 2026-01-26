/**
 * Democracy Litigation - Discovery Upload Page
 *
 * Document upload interface for discovery documents
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { useDemocracyLitigationStore } from '@/stores/democracy-litigation-store';
import { DocumentType } from '@/types/democracy-litigation';
import { UploadZone } from '@/components/democracy-litigation/discovery/UploadZone';

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  documentId?: string;
}

export default function DiscoveryUploadPage() {
  const router = useRouter();
  const { uploadDocument } = useDemocracyLitigation();
  const { activeCase, cases } = useDemocracyLitigationStore();

  const [selectedCaseId, setSelectedCaseId] = useState<string>(activeCase?.id || '');
  const [documentType, setDocumentType] = useState<DocumentType>('discovery');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Document type options
  const documentTypes: { value: DocumentType; label: string }[] = [
    { value: 'court_filing', label: 'Court Filing' },
    { value: 'discovery', label: 'Discovery Document' },
    { value: 'expert_report', label: 'Expert Report' },
    { value: 'deposition', label: 'Deposition Transcript' },
    { value: 'legislative_record', label: 'Legislative Record' },
    { value: 'census_data', label: 'Census Data' },
    { value: 'election_results', label: 'Election Results' },
    { value: 'correspondence', label: 'Correspondence' },
    { value: 'research', label: 'Research Material' },
    { value: 'other', label: 'Other' },
  ];

  // Handle files selected from UploadZone
  const handleFilesSelected = useCallback((files: File[]) => {
    const newUploadFiles: UploadFile[] = files.map((file) => ({
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploadFiles((prev) => [...prev, ...newUploadFiles]);
  }, []);

  // Handle individual file upload
  const handleUploadFile = useCallback(
    async (uploadFile: UploadFile, index: number) => {
      if (!selectedCaseId) {
        setUploadFiles((prev) =>
          prev.map((f, i) =>
            i === index ? { ...f, status: 'error', error: 'Please select a case first' } : f
          )
        );
        return;
      }

      // Update status to uploading
      setUploadFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: 'uploading', progress: 0 } : f))
      );

      try {
        const document = await uploadDocument(
          selectedCaseId,
          uploadFile.file,
          documentType,
          tags,
          (progress) => {
            // Update progress
            setUploadFiles((prev) =>
              prev.map((f, i) => (i === index ? { ...f, progress: Math.round(progress * 100) } : f))
            );
          }
        );

        // Success
        setUploadFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: 'success', progress: 100, documentId: document.id }
              : f
          )
        );
      } catch (error) {
        // Error
        setUploadFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? {
                  ...f,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : f
          )
        );
      }
    },
    [selectedCaseId, documentType, tags, uploadDocument]
  );

  // Handle upload all files
  const handleUploadAll = useCallback(async () => {
    if (!selectedCaseId) {
      alert('Please select a case first');
      return;
    }

    setIsUploading(true);

    // Upload files sequentially (could be parallel but might overwhelm server)
    for (let i = 0; i < uploadFiles.length; i++) {
      const uploadFile = uploadFiles[i];
      if (uploadFile.status === 'pending' || uploadFile.status === 'error') {
        await handleUploadFile(uploadFile, i);
      }
    }

    setIsUploading(false);
  }, [selectedCaseId, uploadFiles, handleUploadFile]);

  // Handle remove file
  const handleRemoveFile = useCallback((index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    setUploadFiles([]);
  }, []);

  // Handle add tag
  const handleAddTag = useCallback(() => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags((prev) => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  // Handle remove tag
  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // Navigate to triage page
  const handleGoToTriage = useCallback(() => {
    router.push('/dashboard/democracy-litigation/discovery/triage');
  }, [router]);

  // Calculate upload statistics
  const uploadStats = {
    total: uploadFiles.length,
    pending: uploadFiles.filter((f) => f.status === 'pending').length,
    uploading: uploadFiles.filter((f) => f.status === 'uploading').length,
    success: uploadFiles.filter((f) => f.status === 'success').length,
    error: uploadFiles.filter((f) => f.status === 'error').length,
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Document Upload
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Upload discovery documents, expert reports, and other case materials
            </p>
          </div>

          <button
            onClick={handleGoToTriage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Triage →
          </button>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Upload Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Case Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Case *
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select a case...</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document Type *
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {documentTypes.map((dt) => (
                <option key={dt.value} value={dt.value}>
                  {dt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tags (Optional)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Enter tag and press Enter"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleAddTag}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Add Tag
            </button>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-600 dark:hover:text-blue-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Zone */}
      <UploadZone
        onFilesSelected={handleFilesSelected}
        maxFiles={50}
        maxSize={100 * 1024 * 1024} // 100MB
      />

      {/* Upload Queue */}
      {uploadFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Upload Queue ({uploadFiles.length} files)
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {uploadStats.success} successful, {uploadStats.error} failed,{' '}
                {uploadStats.pending + uploadStats.uploading} remaining
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                disabled={isUploading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Clear All
              </button>
              <button
                onClick={handleUploadAll}
                disabled={isUploading || uploadStats.pending === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : `Upload All (${uploadStats.pending})`}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {uploadFiles.map((uploadFile, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {uploadFile.file.name}
                    </p>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {uploadFile.progress}% complete
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {uploadFile.status === 'error' && uploadFile.error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {uploadFile.error}
                    </p>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {uploadFile.status === 'pending' && (
                    <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">
                      Pending
                    </span>
                  )}
                  {uploadFile.status === 'uploading' && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                      Uploading...
                    </span>
                  )}
                  {uploadFile.status === 'success' && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                      ✓ Success
                    </span>
                  )}
                  {uploadFile.status === 'error' && (
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm">
                      ✗ Failed
                    </span>
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveFile(index)}
                    disabled={uploadFile.status === 'uploading'}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
          Supported File Types
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          PDF (.pdf), Word Documents (.docx, .doc), Images (.jpg, .jpeg, .png, .tiff)
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
          Maximum file size: 100 MB per file
        </p>
      </div>
    </div>
  );
}

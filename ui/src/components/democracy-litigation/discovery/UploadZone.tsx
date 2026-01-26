/**
 * UploadZone Component
 *
 * Drag-and-drop file upload area with validation
 */

'use client';

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';

export interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: string[];
}

const DEFAULT_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.jpg',
  '.jpeg',
  '.png',
  '.tiff',
  '.tif',
];

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

export function UploadZone({
  onFilesSelected,
  maxFiles = 50,
  maxSize = DEFAULT_MAX_SIZE,
  accept = DEFAULT_ACCEPT,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file
  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      if (file.size > maxSize) {
        return `${file.name}: File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)} MB)`;
      }

      // Check file extension
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!accept.some((ext) => ext.toLowerCase() === extension)) {
        return `${file.name}: File type not allowed. Allowed types: ${accept.join(', ')}`;
      }

      return null;
    },
    [maxSize, accept]
  );

  // Validate and process files
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const errors: string[] = [];
      const validFiles: File[] = [];

      // Check max files
      if (fileArray.length > maxFiles) {
        errors.push(`Too many files. Maximum ${maxFiles} files allowed at once.`);
        return;
      }

      // Validate each file
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          validFiles.push(file);
        }
      }

      setValidationErrors(errors);

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [maxFiles, validateFile, onFilesSelected]
  );

  // Handle drag enter
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (files && files.length > 0) {
        processFiles(files);
      }

      // Reset input value so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFiles]
  );

  // Handle click to open file dialog
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Clear validation errors
  const handleClearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  return (
    <div>
      {/* Upload Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }
        `}
      >
        {/* Upload Icon */}
        <svg
          className={`mx-auto h-16 w-16 mb-4 ${
            isDragging
              ? 'text-blue-500'
              : 'text-gray-400 dark:text-gray-500'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        {/* Text */}
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Supported: {accept.join(', ')}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Maximum file size: {(maxSize / 1024 / 1024).toFixed(0)} MB
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Maximum {maxFiles} files at once
          </p>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-red-900 dark:text-red-200 mb-2">
                Validation Errors
              </h3>
              <ul className="space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm text-red-800 dark:text-red-300">
                    • {error}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleClearErrors}
              className="ml-4 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

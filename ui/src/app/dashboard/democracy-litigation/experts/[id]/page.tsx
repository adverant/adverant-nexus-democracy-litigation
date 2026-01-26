/**
 * Democracy Litigation - Expert Witness Detail Page
 *
 * View detailed expert profile and generate reports
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { ExpertWitness, Job } from '@/types/democracy-litigation';

const SPECIALTIES_LABELS: Record<string, string> = {
  demography: 'Demography',
  political_science: 'Political Science',
  statistics: 'Statistics',
  geography: 'Geography / GIS',
  sociology: 'Sociology',
  history: 'History',
  economics: 'Economics',
};

export default function ExpertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getExpert, generateExpertReport, getJobStatus } = useDemocracyLitigation();

  const expertId = params.id as string;

  const [expert, setExpert] = useState<ExpertWitness | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportJob, setReportJob] = useState<Job | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Load expert on mount
  useEffect(() => {
    loadExpert();
  }, [expertId]);

  // Poll job status
  useEffect(() => {
    if (!reportJob || reportJob.status === 'completed' || reportJob.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const job = await getJobStatus(reportJob.id);
        setReportJob(job);

        if (job.status === 'completed') {
          setIsGeneratingReport(false);
          // Download report
          if (job.result?.report_url) {
            window.open(job.result.report_url, '_blank');
          }
        } else if (job.status === 'failed') {
          setIsGeneratingReport(false);
          setReportError(job.error || 'Report generation failed');
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [reportJob, getJobStatus]);

  // Load expert
  const loadExpert = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getExpert(expertId);
      setExpert(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expert');
    } finally {
      setIsLoading(false);
    }
  }, [expertId, getExpert]);

  // Handle generate report
  const handleGenerateReport = useCallback(async () => {
    if (!expert) return;

    setIsGeneratingReport(true);
    setReportError(null);

    try {
      const job = await generateExpertReport({
        expertId: expert.id,
        includeTestimonyHistory: true,
        includeDaubertAnalysis: true,
        includePublications: true,
      });

      setReportJob(job);
    } catch (err) {
      setIsGeneratingReport(false);
      setReportError(err instanceof Error ? err.message : 'Failed to generate report');
    }
  }, [expert, generateExpertReport]);

  // Calculate Daubert success rate
  const getDaubertRate = useCallback((): number => {
    if (!expert || expert.daubert_challenges === 0) return 1;
    return expert.daubert_successes / expert.daubert_challenges;
  }, [expert]);

  // Get Daubert rate color
  const getDaubertRateColor = useCallback((rate: number): string => {
    if (rate >= 0.8) return 'text-green-600 dark:text-green-400';
    if (rate >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading expert profile...</p>
        </div>
      </div>
    );
  }

  if (error || !expert) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error || 'Expert not found'}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/democracy-litigation/experts')}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          ← Back to Experts
        </button>
      </div>
    );
  }

  const daubertRate = getDaubertRate();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/democracy-litigation/experts')}
          className="mb-4 text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to Experts
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-3xl font-bold mr-6">
              {expert.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {expert.name}
              </h1>
              {expert.affiliation && (
                <p className="mt-1 text-lg text-gray-600 dark:text-gray-400">
                  {expert.affiliation}
                </p>
              )}
              <div className="mt-2">
                <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium">
                  {SPECIALTIES_LABELS[expert.specialty] || expert.specialty}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {expert.cv_url && (
              <a
                href={expert.cv_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Download CV
              </a>
            )}
            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingReport ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Generation Status */}
      {isGeneratingReport && reportJob && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-900 dark:text-blue-200 font-medium">
              Generating expert report...
            </p>
            <span className="text-blue-700 dark:text-blue-300">
              {reportJob.progress || 0}%
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${reportJob.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Report Error */}
      {reportError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{reportError}</p>
        </div>
      )}

      {/* Biography */}
      {expert.bio && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Biography</h2>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{expert.bio}</p>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Testimony Count */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Testimonies
            </h3>
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {expert.testimony_count || 0}
          </p>
        </div>

        {/* Daubert Challenges */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Daubert Challenges
            </h3>
            <svg
              className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {expert.daubert_challenges || 0}
          </p>
        </div>

        {/* Daubert Success Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Daubert Success Rate
            </h3>
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className={`text-3xl font-bold ${getDaubertRateColor(daubertRate)}`}>
            {(daubertRate * 100).toFixed(0)}%
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {expert.daubert_successes || 0} successes / {expert.daubert_challenges || 0} challenges
          </p>
        </div>
      </div>

      {/* Daubert Analysis Chart */}
      {expert.daubert_challenges > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Daubert Challenge Analysis
          </h2>
          <div className="grid grid-cols-2 gap-8">
            {/* Success vs Failure Pie */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
                Challenge Outcomes
              </h3>
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg className="transform -rotate-90" viewBox="0 0 100 100">
                    {/* Success arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="20"
                      strokeDasharray={`${daubertRate * 251.2} 251.2`}
                    />
                    {/* Failure arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="20"
                      strokeDasharray={`${(1 - daubertRate) * 251.2} 251.2`}
                      strokeDashoffset={`-${daubertRate * 251.2}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${getDaubertRateColor(daubertRate)}`}>
                        {(daubertRate * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Success</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Successful ({expert.daubert_successes})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Failed ({expert.daubert_challenges - expert.daubert_successes})
                  </span>
                </div>
              </div>
            </div>

            {/* Bar chart comparison */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
                Comparative Analysis
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Successful Defenses
                    </span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {expert.daubert_successes}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-green-500 h-3 rounded-full"
                      style={{
                        width: `${(expert.daubert_successes / expert.daubert_challenges) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Failed Defenses
                    </span>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {expert.daubert_challenges - expert.daubert_successes}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-red-500 h-3 rounded-full"
                      style={{
                        width: `${
                          ((expert.daubert_challenges - expert.daubert_successes) /
                            expert.daubert_challenges) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Track Record */}
      {expert.track_record && Object.keys(expert.track_record).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Track Record</h2>
          <div className="space-y-4">
            {Object.entries(expert.track_record).map(([key, value]) => (
              <div
                key={key}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <h3 className="font-medium text-gray-900 dark:text-white capitalize mb-2">
                  {key.replace(/_/g, ' ')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

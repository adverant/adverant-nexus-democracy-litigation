/**
 * Democracy Litigation - Circuit Comparison Page
 *
 * Compare how different circuit courts have ruled on VRA issues
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { GinglesIssue, SenateFactor } from '@/types/democracy-litigation';

const GINGLES_ISSUES: { value: GinglesIssue; label: string }[] = [
  { value: 'numerosity_compactness', label: 'Gingles I: Numerosity & Compactness' },
  { value: 'political_cohesion', label: 'Gingles II: Political Cohesion' },
  { value: 'bloc_voting', label: 'Gingles III: Bloc Voting' },
];

const SENATE_FACTORS: { value: SenateFactor; label: string }[] = [
  { value: 'history_of_discrimination', label: 'History of Discrimination' },
  { value: 'racially_polarized_voting', label: 'Racially Polarized Voting' },
  { value: 'use_of_devices', label: 'Use of Enhancing or Diluting Devices' },
  { value: 'candidate_slating', label: 'Candidate Slating Process' },
  { value: 'discrimination_in_education', label: 'Discrimination in Education, Employment, Health' },
  { value: 'socioeconomic_disparities', label: 'Socioeconomic Disparities' },
  { value: 'racial_appeals', label: 'Racial Appeals in Political Campaigns' },
  { value: 'minority_elected_officials', label: 'Minority Elected Officials' },
  { value: 'unresponsiveness', label: 'Unresponsiveness to Minority Interests' },
];

const CIRCUITS = [
  'Supreme Court',
  'First Circuit',
  'Second Circuit',
  'Third Circuit',
  'Fourth Circuit',
  'Fifth Circuit',
  'Sixth Circuit',
  'Seventh Circuit',
  'Eighth Circuit',
  'Ninth Circuit',
  'Tenth Circuit',
  'Eleventh Circuit',
  'DC Circuit',
];

interface CircuitStats {
  circuit: string;
  total_cases: number;
  plaintiff_wins: number;
  defendant_wins: number;
  success_rate: number;
  avg_year: number;
  key_precedents: Array<{
    case_name: string;
    citation: string;
    year: number;
    outcome: 'plaintiff' | 'defendant';
  }>;
}

interface CircuitComparison {
  issue: string;
  issue_type: 'gingles' | 'senate';
  circuits: CircuitStats[];
  overall_success_rate: number;
  total_cases: number;
}

export default function CircuitComparisonPage() {
  const { compareCircuits } = useDemocracyLitigation();

  const [issueType, setIssueType] = useState<'gingles' | 'senate'>('gingles');
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [selectedCircuits, setSelectedCircuits] = useState<string[]>([]);
  const [comparison, setComparison] = useState<CircuitComparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current issue options based on type
  const issueOptions = useMemo(() => {
    return issueType === 'gingles' ? GINGLES_ISSUES : SENATE_FACTORS;
  }, [issueType]);

  // Handle toggle circuit
  const handleToggleCircuit = useCallback((circuit: string) => {
    setSelectedCircuits((prev) => {
      if (prev.includes(circuit)) {
        return prev.filter((c) => c !== circuit);
      } else {
        if (prev.length >= 4) {
          return prev; // Max 4 circuits
        }
        return [...prev, circuit];
      }
    });
  }, []);

  // Handle comparison
  const handleCompare = useCallback(async () => {
    if (!selectedIssue) {
      alert('Please select an issue to compare');
      return;
    }

    if (selectedCircuits.length < 2) {
      alert('Please select at least 2 circuits to compare');
      return;
    }

    setIsComparing(true);
    setError(null);

    try {
      const result = await compareCircuits({
        issue: selectedIssue,
        issueType: issueType,
        circuits: selectedCircuits,
      });

      setComparison(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  }, [selectedIssue, issueType, selectedCircuits, compareCircuits]);

  // Handle export to CSV
  const handleExport = useCallback(() => {
    if (!comparison) return;

    const headers = [
      'Circuit',
      'Total Cases',
      'Plaintiff Wins',
      'Defendant Wins',
      'Success Rate',
      'Avg Year',
    ];

    const rows = comparison.circuits.map((circuit) => [
      circuit.circuit,
      circuit.total_cases.toString(),
      circuit.plaintiff_wins.toString(),
      circuit.defendant_wins.toString(),
      (circuit.success_rate * 100).toFixed(1) + '%',
      circuit.avg_year.toString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `circuit-comparison-${selectedIssue}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [comparison, selectedIssue]);

  // Get success rate color
  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 0.7) return 'text-green-600 dark:text-green-400';
    if (rate >= 0.4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Get success rate bar color
  const getSuccessRateBarColor = (rate: number): string => {
    if (rate >= 0.7) return 'bg-green-500';
    if (rate >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Circuit Court Comparison
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Compare how different circuit courts have ruled on VRA Section 2 issues
        </p>
      </div>

      {/* Selection Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {/* Issue Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Issue Category
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setIssueType('gingles');
                setSelectedIssue('');
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                issueType === 'gingles'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Gingles Preconditions
            </button>
            <button
              onClick={() => {
                setIssueType('senate');
                setSelectedIssue('');
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                issueType === 'senate'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Senate Factors
            </button>
          </div>
        </div>

        {/* Specific Issue Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Specific Issue
          </label>
          <div className="flex flex-wrap gap-2">
            {issueOptions.map((issue) => (
              <button
                key={issue.value}
                onClick={() => setSelectedIssue(issue.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedIssue === issue.value
                    ? issueType === 'gingles'
                      ? 'bg-blue-600 text-white'
                      : 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {issue.label}
              </button>
            ))}
          </div>
        </div>

        {/* Circuit Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select Circuits (2-4 circuits)
          </label>
          <div className="flex flex-wrap gap-2">
            {CIRCUITS.map((circuit) => (
              <button
                key={circuit}
                onClick={() => handleToggleCircuit(circuit)}
                disabled={!selectedCircuits.includes(circuit) && selectedCircuits.length >= 4}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCircuits.includes(circuit)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {circuit}
                {selectedCircuits.includes(circuit) && ' ✓'}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {selectedCircuits.length} circuit{selectedCircuits.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Compare Button */}
        <div className="flex gap-3">
          <button
            onClick={handleCompare}
            disabled={isComparing || !selectedIssue || selectedCircuits.length < 2}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isComparing ? 'Comparing...' : 'Compare Circuits'}
          </button>

          {comparison && (
            <button
              onClick={handleExport}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isComparing && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Analyzing circuit precedents...</p>
        </div>
      )}

      {/* Results */}
      {comparison && !isComparing && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Comparison Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Issue Analyzed</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {issueOptions.find((i) => i.value === comparison.issue)?.label || comparison.issue}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Cases Analyzed</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {comparison.total_cases}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overall Success Rate</p>
                <p className={`text-lg font-semibold ${getSuccessRateColor(comparison.overall_success_rate)}`}>
                  {(comparison.overall_success_rate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Circuit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total Cases
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Plaintiff Wins
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Defendant Wins
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Success Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg Year
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {comparison.circuits
                    .sort((a, b) => b.success_rate - a.success_rate)
                    .map((circuit) => (
                      <tr key={circuit.circuit} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {circuit.circuit}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {circuit.total_cases}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600 dark:text-green-400">
                          {circuit.plaintiff_wins}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-red-600 dark:text-red-400">
                          {circuit.defendant_wins}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                              <div
                                className={`h-2 rounded-full ${getSuccessRateBarColor(circuit.success_rate)}`}
                                style={{ width: `${circuit.success_rate * 100}%` }}
                              />
                            </div>
                            <span className={`font-medium ${getSuccessRateColor(circuit.success_rate)}`}>
                              {(circuit.success_rate * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {circuit.avg_year.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Precedents by Circuit */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Key Precedents by Circuit
            </h2>

            {comparison.circuits.map((circuit) => (
              <div
                key={circuit.circuit}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {circuit.circuit}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSuccessRateColor(circuit.success_rate)}`}>
                    {(circuit.success_rate * 100).toFixed(1)}% success rate
                  </span>
                </div>

                {circuit.key_precedents.length > 0 ? (
                  <div className="space-y-3">
                    {circuit.key_precedents.map((precedent, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {precedent.case_name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                            {precedent.citation} ({precedent.year})
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            precedent.outcome === 'plaintiff'
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}
                        >
                          {precedent.outcome === 'plaintiff' ? 'Plaintiff Victory' : 'Defendant Victory'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    No key precedents available for this circuit
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Visual Chart (Bar Chart) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Success Rate Comparison
            </h2>

            <div className="space-y-4">
              {comparison.circuits
                .sort((a, b) => b.success_rate - a.success_rate)
                .map((circuit) => (
                  <div key={circuit.circuit}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {circuit.circuit}
                      </span>
                      <span className={`text-sm font-medium ${getSuccessRateColor(circuit.success_rate)}`}>
                        {(circuit.success_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full ${getSuccessRateBarColor(circuit.success_rate)} transition-all`}
                        style={{ width: `${circuit.success_rate * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!comparison && !isComparing && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400 mb-2">No comparison data yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Select an issue and at least 2 circuits to compare
          </p>
        </div>
      )}
    </div>
  );
}

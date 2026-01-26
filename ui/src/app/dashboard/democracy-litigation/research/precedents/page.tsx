/**
 * Democracy Litigation - VRA Precedent Search Page
 *
 * Search and analyze VRA case law precedents via GraphRAG
 */

'use client';

import { useState, useCallback } from 'react';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { Precedent, GinglesIssue, SenateFactor } from '@/types/democracy-litigation';

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

export default function VRAPrecedentSearchPage() {
  const { searchVRAPrecedent } = useDemocracyLitigation();

  const [query, setQuery] = useState('');
  const [selectedGingles, setSelectedGingles] = useState<GinglesIssue[]>([]);
  const [selectedSenate, setSelectedSenate] = useState<SenateFactor[]>([]);
  const [selectedCircuits, setSelectedCircuits] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [results, setResults] = useState<Precedent[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPrecedent, setExpandedPrecedent] = useState<string | null>(null);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      alert('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const precedents = await searchVRAPrecedent({
        query: query.trim(),
        ginglesIssues: selectedGingles.length > 0 ? selectedGingles : undefined,
        senatFactors: selectedSenate.length > 0 ? selectedSenate : undefined,
        circuits: selectedCircuits.length > 0 ? selectedCircuits : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 50,
      });

      setResults(precedents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedGingles, selectedSenate, selectedCircuits, dateFrom, dateTo, searchVRAPrecedent]);

  // Handle toggle Gingles issue
  const handleToggleGingles = useCallback((issue: GinglesIssue) => {
    setSelectedGingles((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  }, []);

  // Handle toggle Senate factor
  const handleToggleSenate = useCallback((factor: SenateFactor) => {
    setSelectedSenate((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor]
    );
  }, []);

  // Handle toggle circuit
  const handleToggleCircuit = useCallback((circuit: string) => {
    setSelectedCircuits((prev) =>
      prev.includes(circuit) ? prev.filter((c) => c !== circuit) : [...prev, circuit]
    );
  }, []);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setSelectedGingles([]);
    setSelectedSenate([]);
    setSelectedCircuits([]);
    setDateFrom('');
    setDateTo('');
  }, []);

  // Handle toggle expand precedent
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedPrecedent((prev) => (prev === id ? null : id));
  }, []);

  // Get relevance color
  const getRelevanceColor = (score: number): string => {
    if (score >= 0.8) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    if (score >= 0.6) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          VRA Precedent Search
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Search Section 2 case law powered by semantic search (GraphRAG)
        </p>
      </div>

      {/* Search Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {/* Search Bar */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search VRA case law (e.g., 'Gingles test compactness', 'racial gerrymandering')"
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
        >
          {showAdvanced ? '− Hide' : '+ Show'} Advanced Filters
        </button>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            {/* Gingles Issues */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Gingles Preconditions
              </label>
              <div className="flex flex-wrap gap-2">
                {GINGLES_ISSUES.map((issue) => (
                  <button
                    key={issue.value}
                    onClick={() => handleToggleGingles(issue.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedGingles.includes(issue.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {issue.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Senate Factors */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Senate Factors
              </label>
              <div className="flex flex-wrap gap-2">
                {SENATE_FACTORS.map((factor) => (
                  <button
                    key={factor.value}
                    onClick={() => handleToggleSenate(factor.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedSenate.includes(factor.value)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {factor.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Circuits */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Circuits
              </label>
              <div className="flex flex-wrap gap-2">
                {CIRCUITS.map((circuit) => (
                  <button
                    key={circuit}
                    onClick={() => handleToggleCircuit(circuit)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCircuits.includes(circuit)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {circuit}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Clear Filters */}
            {(selectedGingles.length > 0 ||
              selectedSenate.length > 0 ||
              selectedCircuits.length > 0 ||
              dateFrom ||
              dateTo) && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Results */}
      {isSearching ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Searching case law...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600 dark:text-gray-400">
              Found {results.length} precedent{results.length !== 1 ? 's' : ''}
            </p>
          </div>

          {results.map((precedent) => (
            <div
              key={precedent.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {precedent.caseName}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-mono">{precedent.citation}</span>
                    {precedent.circuit && (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        {precedent.circuit}
                      </span>
                    )}
                    {precedent.decisionDate && (
                      <span>{new Date(precedent.decisionDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRelevanceColor(precedent.relevanceScore)}`}>
                  {(precedent.relevanceScore * 100).toFixed(0)}% relevant
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {precedent.ginglesIssues.map((issue) => (
                  <span
                    key={issue}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                  >
                    {GINGLES_ISSUES.find((i) => i.value === issue)?.label || issue}
                  </span>
                ))}
                {precedent.senatFactors.map((factor) => (
                  <span
                    key={factor}
                    className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm"
                  >
                    {SENATE_FACTORS.find((f) => f.value === factor)?.label || factor}
                  </span>
                ))}
              </div>

              {/* Holding */}
              {precedent.holding && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Holding:</h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    {expandedPrecedent === precedent.id
                      ? precedent.holding
                      : precedent.holding.slice(0, 300) + (precedent.holding.length > 300 ? '...' : '')}
                  </p>
                  {precedent.holding.length > 300 && (
                    <button
                      onClick={() => handleToggleExpand(precedent.id)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-2"
                    >
                      {expandedPrecedent === precedent.id ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleToggleExpand(precedent.id)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  {expandedPrecedent === precedent.id ? 'Hide Details' : 'View Full Opinion'}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(precedent.citation)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Copy Citation
                </button>
              </div>

              {/* Expanded Opinion */}
              {expandedPrecedent === precedent.id && precedent.majorityOpinionText && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Majority Opinion:</h4>
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {precedent.majorityOpinionText}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : query && !isSearching ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No precedents found for your search</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">Try different keywords or adjust your filters</p>
        </div>
      ) : null}
    </div>
  );
}

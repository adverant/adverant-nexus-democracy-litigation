/**
 * Democracy Litigation - Expert Witness List Page
 *
 * Browse and search expert witnesses for VRA litigation
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { ExpertWitness, ExpertSpecialty } from '@/types/democracy-litigation';

const SPECIALTIES: { value: ExpertSpecialty | 'all'; label: string }[] = [
  { value: 'all', label: 'All Specialties' },
  { value: 'demography', label: 'Demography' },
  { value: 'political_science', label: 'Political Science' },
  { value: 'statistics', label: 'Statistics' },
  { value: 'geography', label: 'Geography / GIS' },
  { value: 'sociology', label: 'Sociology' },
  { value: 'history', label: 'History' },
  { value: 'economics', label: 'Economics' },
];

export default function ExpertsListPage() {
  const router = useRouter();
  const { listExperts } = useDemocracyLitigation();

  const [experts, setExperts] = useState<ExpertWitness[]>([]);
  const [filteredExperts, setFilteredExperts] = useState<ExpertWitness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<ExpertSpecialty | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'testimony_count' | 'daubert_rate'>('name');

  // Load experts on mount
  useEffect(() => {
    loadExperts();
  }, []);

  // Load experts
  const loadExperts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listExperts({
        specialty: selectedSpecialty === 'all' ? undefined : selectedSpecialty,
      });
      setExperts(data);
      setFilteredExperts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experts');
    } finally {
      setIsLoading(false);
    }
  }, [listExperts, selectedSpecialty]);

  // Filter and sort experts
  useEffect(() => {
    let filtered = experts;

    // Filter by specialty
    if (selectedSpecialty !== 'all') {
      filtered = filtered.filter((expert) => expert.specialty === selectedSpecialty);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (expert) =>
          expert.name.toLowerCase().includes(query) ||
          expert.affiliation?.toLowerCase().includes(query) ||
          expert.bio?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'testimony_count') {
        return (b.testimony_count || 0) - (a.testimony_count || 0);
      } else if (sortBy === 'daubert_rate') {
        const rateA =
          a.daubert_challenges > 0 ? a.daubert_successes / a.daubert_challenges : 0;
        const rateB =
          b.daubert_challenges > 0 ? b.daubert_successes / b.daubert_challenges : 0;
        return rateB - rateA;
      }
      return 0;
    });

    setFilteredExperts(filtered);
  }, [experts, searchQuery, selectedSpecialty, sortBy]);

  // Handle view expert
  const handleViewExpert = useCallback(
    (expertId: string) => {
      router.push(`/dashboard/democracy-litigation/experts/${expertId}`);
    },
    [router]
  );

  // Calculate Daubert success rate
  const getDaubertRate = useCallback((expert: ExpertWitness): number => {
    if (expert.daubert_challenges === 0) return 1;
    return expert.daubert_successes / expert.daubert_challenges;
  }, []);

  // Get Daubert rate color
  const getDaubertRateColor = useCallback((rate: number): string => {
    if (rate >= 0.8) return 'text-green-600 dark:text-green-400';
    if (rate >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Expert Witnesses
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Browse and search expert witnesses for VRA litigation
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, affiliation..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Specialty Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Specialty
            </label>
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value as ExpertSpecialty | 'all')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {SPECIALTIES.map((specialty) => (
                <option key={specialty.value} value={specialty.value}>
                  {specialty.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="name">Name (A-Z)</option>
              <option value="testimony_count">Most Experience</option>
              <option value="daubert_rate">Best Daubert Record</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading experts...</p>
        </div>
      ) : filteredExperts.length > 0 ? (
        <>
          {/* Results Count */}
          <div className="mb-4">
            <p className="text-gray-600 dark:text-gray-400">
              Found {filteredExperts.length} expert{filteredExperts.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Expert Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExperts.map((expert) => (
              <div
                key={expert.id}
                onClick={() => handleViewExpert(expert.id)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-md hover:border-blue-500 dark:hover:border-blue-400 transition-all"
              >
                {/* Expert Avatar */}
                <div className="flex items-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-2xl font-bold mr-4">
                    {expert.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {expert.name}
                    </h3>
                    {expert.affiliation && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {expert.affiliation}
                      </p>
                    )}
                  </div>
                </div>

                {/* Specialty Badge */}
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium">
                    {SPECIALTIES.find((s) => s.value === expert.specialty)?.label || expert.specialty}
                  </span>
                </div>

                {/* Bio Preview */}
                {expert.bio && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
                    {expert.bio}
                  </p>
                )}

                {/* Statistics */}
                <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Testimony Count
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {expert.testimony_count || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Daubert Challenges
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {expert.daubert_challenges || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Daubert Success Rate
                    </span>
                    <span className={`text-sm font-semibold ${getDaubertRateColor(getDaubertRate(expert))}`}>
                      {(getDaubertRate(expert) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* View Button */}
                <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                  View Profile
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400 mb-2">No experts found</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
}

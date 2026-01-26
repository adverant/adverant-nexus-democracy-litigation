/**
 * Democracy Litigation Plugin - Overview Dashboard
 *
 * Main dashboard showing case statistics, recent cases, and quick actions.
 * Integrates with useDemocracyLitigation hook for real-time data.
 *
 * Production implementation - NO STUBS OR PLACEHOLDERS
 */

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useTheme } from '@/stores/theme-store'
import { useThemeClasses } from '@/hooks/useThemeClasses'
import { StatCard, StatGrid } from '@/components/coinest'
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation'
import { useDemocracyLitigationStore } from '@/stores/democracy-litigation-store'

export default function DemocracyLitigationOverviewPage() {
  const { isDark } = useTheme()
  const tc = useThemeClasses()

  // Fetch real cases from the API
  const { cases, casesLoading, casesError, deadlines } = useDemocracyLitigation({
    autoFetchCases: true,
  })

  // UI state
  const openCreateCase = useDemocracyLitigationStore((state) => state.openCreateCase)

  // Calculate stats from real cases
  const stats = useMemo(() => {
    const activeCases = cases.filter((c) => c.status === 'active')
    const totalDocuments = cases.reduce((acc, c) => acc + c.documentCount, 0)

    // Calculate urgent deadlines (next 7 days)
    const now = new Date()
    const urgentDeadlines = deadlines.filter((d) => {
      const deadlineDate = new Date(d.deadlineDate)
      const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000)
      return daysUntil >= 0 && daysUntil <= 7 && d.status === 'pending'
    })

    return {
      totalCases: cases.length,
      activeCases: activeCases.length,
      documentsProcessed: totalDocuments,
      urgentDeadlines: urgentDeadlines.length,
    }
  }, [cases, deadlines])

  // Get most recent cases (sorted by updatedAt)
  const recentCases = useMemo(() => {
    return [...cases]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
  }, [cases])

  // Format relative time
  const formatRelativeTime = (date: string): string => {
    const now = new Date()
    const updated = new Date(date)
    const diffMs = now.getTime() - updated.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return updated.toLocaleDateString()
  }

  // Format case type display name
  const getCaseTypeDisplayName = (caseType: string): string => {
    const mapping: Record<string, string> = {
      redistricting: 'Redistricting',
      voter_id: 'Voter ID',
      ballot_access: 'Ballot Access',
      voter_purges: 'Voter Purges',
      direct_democracy: 'Direct Democracy',
      poll_closures: 'Poll Closures',
      drop_box_restrictions: 'Drop Box Restrictions',
      early_voting: 'Early Voting',
      absentee_voting: 'Absentee Voting',
    }
    return mapping[caseType] || caseType
  }

  // Format case status display name
  const getCaseStatusDisplayName = (status: string): string => {
    const mapping: Record<string, string> = {
      active: 'Active',
      settled: 'Settled',
      dismissed: 'Dismissed',
      won: 'Won',
      lost: 'Lost',
      on_hold: 'On Hold',
      appeal: 'Appeal',
      remanded: 'Remanded',
    }
    return mapping[status] || status
  }

  // Activity timeline items
  const activityItems = useMemo(() => {
    const items: Array<{ type: string; message: string; time: string; icon: string }> = []

    // Add recent case updates
    recentCases.slice(0, 3).forEach((c) => {
      items.push({
        type: 'case_update',
        message: `Case "${c.name}" updated`,
        time: formatRelativeTime(c.updatedAt),
        icon: 'folder',
      })
    })

    // Add recent deadline alerts
    const now = new Date()
    const upcomingDeadlines = deadlines
      .filter((d) => {
        const deadlineDate = new Date(d.deadlineDate)
        return deadlineDate > now && d.status === 'pending'
      })
      .sort((a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime())
      .slice(0, 2)

    upcomingDeadlines.forEach((d) => {
      items.push({
        type: 'deadline',
        message: `Deadline: ${d.title}`,
        time: formatRelativeTime(d.deadlineDate),
        icon: 'calendar',
      })
    })

    return items.sort((a, b) => {
      // Sort by time (most recent first)
      const timeA = a.time.includes('minute') ? 1 : a.time.includes('hour') ? 60 : 1440
      const timeB = b.time.includes('minute') ? 1 : b.time.includes('hour') ? 60 : 1440
      return timeA - timeB
    }).slice(0, 5)
  }, [recentCases, deadlines])

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${tc.textPrimary}`}>Democracy Litigation</h1>
          <p className={`text-sm mt-1 ${tc.textMuted}`}>
            AI-powered voting rights litigation platform
          </p>
        </div>
        <button
          onClick={openCreateCase}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isDark
              ? 'bg-coinest-accent-cyan text-coinest-bg-primary hover:bg-coinest-accent-cyan/90'
              : 'bg-brand-500 text-white hover:bg-brand-600'
          }`}
        >
          Create Case
        </button>
      </div>

      {/* Stats Grid */}
      <StatGrid columns={4}>
        <StatCard
          title="Total Cases"
          value={stats.totalCases.toString()}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
        />
        <StatCard
          title="Active Cases"
          value={stats.activeCases.toString()}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Documents Processed"
          value={stats.documentsProcessed.toString()}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          title="Urgent Deadlines"
          value={stats.urgentDeadlines.toString()}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          subtitle={stats.urgentDeadlines > 0 ? "next 7 days" : ""}
        />
      </StatGrid>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <div className={`lg:col-span-2 ${tc.bgSecondary} border ${tc.border} rounded-xl p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${tc.textPrimary}`}>Recent Cases</h2>
            <Link href="/dashboard/democracy-litigation/cases" className={`text-sm ${isDark ? 'text-coinest-accent-cyan' : 'text-brand-500'} hover:underline`}>
              View All
            </Link>
          </div>

          {casesLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className={`animate-pulse text-sm ${tc.textMuted}`}>Loading cases...</div>
            </div>
          ) : casesError ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <p className={`text-sm ${tc.textMuted} mb-2`}>Failed to load cases</p>
                <p className="text-xs text-red-500">{casesError}</p>
              </div>
            </div>
          ) : recentCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <svg className={`w-12 h-12 mb-3 ${tc.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className={`text-sm ${tc.textMuted} mb-2`}>No cases yet</p>
              <button
                onClick={openCreateCase}
                className={`text-sm font-medium ${isDark ? 'text-coinest-accent-cyan' : 'text-brand-500'}`}
              >
                Create your first case
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentCases.map((dlCase) => (
                <Link
                  key={dlCase.id}
                  href={`/dashboard/democracy-litigation/cases/${dlCase.id}`}
                  className={`block p-4 rounded-lg border ${tc.border} ${isDark ? 'bg-coinest-bg-tertiary hover:bg-coinest-bg-primary' : 'bg-neutral-50 hover:bg-neutral-100'} transition-colors`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className={`font-medium ${tc.textPrimary}`}>{dlCase.name}</h3>
                      <p className={`text-sm ${tc.textMuted}`}>{getCaseTypeDisplayName(dlCase.caseType)}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      dlCase.status === 'active'
                        ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                        : dlCase.status === 'won'
                          ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                          : dlCase.status === 'lost'
                            ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                            : dlCase.status === 'settled'
                              ? isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                              : isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {getCaseStatusDisplayName(dlCase.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${tc.textMuted}`}>Updated {formatRelativeTime(dlCase.updatedAt)}</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-24 h-2 rounded-full ${isDark ? 'bg-coinest-bg-primary' : 'bg-neutral-200'}`}>
                        <div
                          className={`h-full rounded-full ${isDark ? 'bg-coinest-accent-cyan' : 'bg-brand-500'}`}
                          style={{ width: `${dlCase.completionPercent}%` }}
                        />
                      </div>
                      <span className={`text-xs ${tc.textMuted}`}>{dlCase.completionPercent}%</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className={`${tc.bgSecondary} border ${tc.border} rounded-xl p-6`}>
          <h2 className={`text-lg font-semibold mb-4 ${tc.textPrimary}`}>Recent Activity</h2>

          {activityItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <svg className={`w-10 h-10 mb-2 ${tc.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`text-sm ${tc.textMuted}`}>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activityItems.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.type === 'deadline'
                      ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                      : isDark ? 'bg-coinest-accent-cyan/20 text-coinest-accent-cyan' : 'bg-brand-100 text-brand-600'
                  }`}>
                    {item.icon === 'folder' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${tc.textPrimary}`}>{item.message}</p>
                    <p className={`text-xs ${tc.textMuted} mt-0.5`}>{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={`${tc.bgSecondary} border ${tc.border} rounded-xl p-6`}>
        <h2 className={`text-lg font-semibold mb-4 ${tc.textPrimary}`}>Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/dashboard/democracy-litigation/documents"
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border ${tc.border} transition-colors ${isDark ? 'hover:bg-coinest-bg-tertiary' : 'hover:bg-neutral-50'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-coinest-bg-tertiary' : 'bg-neutral-100'}`}>
              <svg className={`w-6 h-6 ${isDark ? 'text-coinest-accent-cyan' : 'text-brand-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <span className={`text-sm font-medium ${tc.textPrimary}`}>Upload Documents</span>
          </Link>

          <Link
            href="/dashboard/democracy-litigation/research"
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border ${tc.border} transition-colors ${isDark ? 'hover:bg-coinest-bg-tertiary' : 'hover:bg-neutral-50'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-coinest-bg-tertiary' : 'bg-neutral-100'}`}>
              <svg className={`w-6 h-6 ${isDark ? 'text-coinest-accent-cyan' : 'text-brand-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className={`text-sm font-medium ${tc.textPrimary}`}>Search Precedents</span>
          </Link>

          <Link
            href="/dashboard/democracy-litigation/deadlines"
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border ${tc.border} transition-colors ${isDark ? 'hover:bg-coinest-bg-tertiary' : 'hover:bg-neutral-50'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-coinest-bg-tertiary' : 'bg-neutral-100'}`}>
              <svg className={`w-6 h-6 ${isDark ? 'text-coinest-accent-cyan' : 'text-brand-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className={`text-sm font-medium ${tc.textPrimary}`}>Check Deadlines</span>
          </Link>

          <Link
            href="/dashboard/democracy-litigation/geographic"
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border ${tc.border} transition-colors ${isDark ? 'hover:bg-coinest-bg-tertiary' : 'hover:bg-neutral-50'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-coinest-bg-tertiary' : 'bg-neutral-100'}`}>
              <svg className={`w-6 h-6 ${isDark ? 'text-coinest-accent-cyan' : 'text-brand-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <span className={`text-sm font-medium ${tc.textPrimary}`}>Geographic Analysis</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

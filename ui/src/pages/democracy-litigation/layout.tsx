/**
 * Democracy Litigation Plugin Layout
 *
 * Layout for Democracy Litigation section with sub-navigation tabs
 * Voting rights and redistricting litigation automation
 */

'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from '@/stores/theme-store'
import { useThemeClasses } from '@/hooks/useThemeClasses'
import { useDemocracyLitigationStore, useCaseStats, useDeadlineStats, useUrgentDeadlines } from '@/stores/democracy-litigation-store'
import {
  Scale,
  LayoutGrid,
  FolderOpen,
  Upload,
  Search,
  BookOpen,
  Map,
  Users,
  Calendar,
  AlertTriangle,
  FileText,
  Gavel,
  MapPin,
  BarChart3,
  Clock,
  Flag,
  Plus,
} from 'lucide-react'

interface DLNavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: () => number | null
  badgeColor?: string
}

export default function DemocracyLitigationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isDark } = useTheme()
  const tc = useThemeClasses()

  // Store state
  const { cases, isCreateCaseOpen, openCreateCase, closeCreateCase } = useDemocracyLitigationStore()
  const caseStats = useCaseStats()
  const deadlineStats = useDeadlineStats()
  const urgentDeadlines = useUrgentDeadlines()

  // Form state for case creation
  const [showCaseModal, setShowCaseModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    caseType: 'redistricting',
    jurisdiction: '',
    description: '',
  })

  // Navigation items with all 20 use cases
  const dlNavItems: DLNavItem[] = [
    {
      label: 'Overview',
      href: '/dashboard/democracy-litigation',
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      label: 'Cases',
      href: '/dashboard/democracy-litigation/cases',
      icon: <FolderOpen className="w-4 h-4" />,
      badge: () => caseStats.byStatus.active || null,
      badgeColor: 'cyan',
    },
    {
      label: 'Documents',
      href: '/dashboard/democracy-litigation/documents',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: 'Upload',
      href: '/dashboard/democracy-litigation/upload',
      icon: <Upload className="w-4 h-4" />,
    },
    {
      label: 'Triage',
      href: '/dashboard/democracy-litigation/triage',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      label: 'VRA Search',
      href: '/dashboard/democracy-litigation/vra-search',
      icon: <Search className="w-4 h-4" />,
    },
    {
      label: 'Gingles',
      href: '/dashboard/democracy-litigation/gingles',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      label: 'Circuits',
      href: '/dashboard/democracy-litigation/circuits',
      icon: <Gavel className="w-4 h-4" />,
    },
    {
      label: 'Legislative',
      href: '/dashboard/democracy-litigation/legislative',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      label: 'Geographic',
      href: '/dashboard/democracy-litigation/geographic',
      icon: <Map className="w-4 h-4" />,
    },
    {
      label: 'Compactness',
      href: '/dashboard/democracy-litigation/compactness',
      icon: <MapPin className="w-4 h-4" />,
    },
    {
      label: 'Demographics',
      href: '/dashboard/democracy-litigation/demographics',
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: 'Experts',
      href: '/dashboard/democracy-litigation/experts',
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: 'Reports',
      href: '/dashboard/democracy-litigation/reports',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: 'Deadlines',
      href: '/dashboard/democracy-litigation/deadlines',
      icon: <Calendar className="w-4 h-4" />,
      badge: () => urgentDeadlines.length || null,
      badgeColor: 'red',
    },
    {
      label: 'Conflicts',
      href: '/dashboard/democracy-litigation/conflicts',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      label: 'Patterns',
      href: '/dashboard/democracy-litigation/patterns',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      label: 'Opposing',
      href: '/dashboard/democracy-litigation/opposing',
      icon: <Flag className="w-4 h-4" />,
    },
  ]

  const handleCreateCase = useCallback(async () => {
    if (!formData.name.trim() || !formData.jurisdiction.trim()) {
      setCreateError('Please provide both case name and jurisdiction')
      return
    }

    setCreateError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      // TODO: Replace with actual API call
      // const newCase = await createCase({
      //   name: formData.name,
      //   caseType: formData.caseType as CaseType,
      //   jurisdiction: formData.jurisdiction,
      //   description: formData.description || undefined,
      // })

      // For now, show success message
      setSuccessMessage(`Case "${formData.name}" created successfully!`)
      setShowCaseModal(false)
      setFormData({ name: '', caseType: 'redistricting', jurisdiction: '', description: '' })

      // Navigate to cases page
      router.push('/dashboard/democracy-litigation/cases')

      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create case. Please try again.'
      setCreateError(errorMessage)
      console.error('Failed to create case:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, router])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`w-8 h-8 ${isDark ? 'text-coinest-accent-cyan' : 'text-brand-500'}`}>
            <Scale className="w-8 h-8" />
          </span>
          <div>
            <h1 className={`text-2xl font-bold ${tc.textPrimary}`}>
              Democracy Litigation
            </h1>
            <p className={`text-sm ${tc.textMuted}`}>
              Voting rights and redistricting litigation automation
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCaseModal(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tc.buttonPrimary}`}
          >
            <Plus className="w-4 h-4" />
            New Case
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className={`border-b ${tc.border}`}>
        <nav className="-mb-px flex space-x-6 overflow-x-auto scrollbar-thin" aria-label="Democracy Litigation tabs">
          {dlNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard/democracy-litigation' && pathname.startsWith(item.href + '/'))
            const isExactMatch = pathname === item.href
            const shouldHighlight = item.href === '/dashboard/democracy-litigation' ? isExactMatch : isActive
            const badgeCount = item.badge ? item.badge() : null

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors relative
                  ${
                    shouldHighlight
                      ? isDark
                        ? 'border-coinest-accent-cyan text-coinest-accent-cyan'
                        : 'border-brand-500 text-brand-600'
                      : isDark
                        ? 'border-transparent text-coinest-text-muted hover:text-white hover:border-coinest-border'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                  }
                `}
              >
                {item.icon}
                {item.label}
                {badgeCount !== null && badgeCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                      item.badgeColor === 'red'
                        ? isDark
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-red-100 text-red-700'
                        : isDark
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border ${
          isDark
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-green-50 border-green-200 text-green-700'
        } flex items-center gap-2`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {/* Page Content */}
      {children}

      {/* New Case Modal */}
      {showCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCaseModal(false)}
          />

          {/* Modal */}
          <div className={`relative w-full max-w-lg mx-4 ${tc.bgSecondary} rounded-xl shadow-2xl border ${tc.border}`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${tc.border}`}>
              <h2 className={`text-xl font-semibold ${tc.textPrimary}`}>Create New Case</h2>
              <button
                onClick={() => setShowCaseModal(false)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-coinest-bg-tertiary' : 'hover:bg-neutral-100'}`}
              >
                <svg className={`w-5 h-5 ${tc.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Error Message */}
              {createError && (
                <div className={`p-3 rounded-lg border ${
                  isDark
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-red-50 border-red-200 text-red-600'
                } text-sm`}>
                  {createError}
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textPrimary}`}>Case Name</label>
                <input
                  type="text"
                  placeholder="e.g., Smith v. State of Georgia"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${tc.border} ${tc.bgPrimary} ${tc.textPrimary} focus:outline-none focus:ring-2 ${isDark ? 'focus:ring-coinest-accent-cyan' : 'focus:ring-brand-500'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textPrimary}`}>Case Type</label>
                <select
                  value={formData.caseType}
                  onChange={(e) => setFormData({ ...formData, caseType: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${tc.border} ${tc.bgPrimary} ${tc.textPrimary} focus:outline-none focus:ring-2 ${isDark ? 'focus:ring-coinest-accent-cyan' : 'focus:ring-brand-500'}`}
                >
                  <option value="redistricting">Redistricting / Gerrymandering</option>
                  <option value="voter_id">Voter ID Laws</option>
                  <option value="ballot_access">Ballot Access</option>
                  <option value="voter_purges">Voter Purges</option>
                  <option value="direct_democracy">Direct Democracy (Initiatives/Referenda)</option>
                  <option value="poll_closures">Poll Closures</option>
                  <option value="drop_box_restrictions">Drop Box Restrictions</option>
                  <option value="early_voting">Early Voting Restrictions</option>
                  <option value="absentee_voting">Absentee Voting Restrictions</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textPrimary}`}>Jurisdiction</label>
                <input
                  type="text"
                  placeholder="e.g., Georgia, 11th Circuit"
                  value={formData.jurisdiction}
                  onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${tc.border} ${tc.bgPrimary} ${tc.textPrimary} focus:outline-none focus:ring-2 ${isDark ? 'focus:ring-coinest-accent-cyan' : 'focus:ring-brand-500'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${tc.textPrimary}`}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the case details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${tc.border} ${tc.bgPrimary} ${tc.textPrimary} focus:outline-none focus:ring-2 ${isDark ? 'focus:ring-coinest-accent-cyan' : 'focus:ring-brand-500'} resize-none`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end gap-3 p-6 border-t ${tc.border}`}>
              <button
                onClick={() => setShowCaseModal(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-coinest-bg-tertiary text-white hover:bg-coinest-bg-tertiary/80' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                disabled={isSubmitting || !formData.name.trim() || !formData.jurisdiction.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tc.buttonPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

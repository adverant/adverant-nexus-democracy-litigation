/**
 * Democracy Litigation Plugin - Deadlines Calendar Page
 *
 * Production-ready deadline management interface with:
 * - Month calendar view with deadline markers
 * - List view option with filtering and sorting
 * - "Upcoming Deadlines" widget (next 7 days)
 * - Color coding by priority (critical=red, high=orange, medium=yellow, low=blue)
 * - Conflict detection warnings
 * - Create/edit/delete deadline operations
 * - Case filter, deadline type filter, priority filter
 * - Click deadline to view details modal
 * - Responsive design and dark mode support
 *
 * NO PLACEHOLDERS - Complete production implementation.
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useDemocracyLitigation } from '@/hooks/useDemocracyLitigation';
import { Calendar } from '@/components/democracy-litigation/deadlines/Calendar';
import { DeadlineForm } from '@/components/democracy-litigation/deadlines/DeadlineForm';
import { ConflictDetector } from '@/components/democracy-litigation/deadlines/ConflictDetector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  List,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import type {
  Deadline,
  DeadlineType,
  DeadlinePriority,
  DeadlineStatus,
  DeadlineConflict,
} from '@/types/democracy-litigation';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'calendar' | 'list';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get display name for deadline type
 */
function getDeadlineTypeDisplayName(type?: DeadlineType): string {
  const names: Record<DeadlineType, string> = {
    filing: 'Filing',
    discovery: 'Discovery',
    motion: 'Motion',
    hearing: 'Hearing',
    trial: 'Trial',
    appeal: 'Appeal',
    response: 'Response',
    expert_report: 'Expert Report',
    brief: 'Brief',
  };
  return type ? names[type] : 'General';
}

/**
 * Get priority badge color
 */
function getPriorityColor(priority: DeadlinePriority): string {
  const colors: Record<DeadlinePriority, string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200',
    normal: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200',
  };
  return colors[priority];
}

/**
 * Get status icon
 */
function getStatusIcon(status: DeadlineStatus) {
  const icons: Record<DeadlineStatus, React.ReactNode> = {
    pending: <Clock className="h-4 w-4 text-blue-500" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    missed: <XCircle className="h-4 w-4 text-red-500" />,
    extended: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    cancelled: <XCircle className="h-4 w-4 text-gray-500" />,
  };
  return icons[status];
}

/**
 * Get status display name
 */
function getStatusDisplayName(status: DeadlineStatus): string {
  const names: Record<DeadlineStatus, string> = {
    pending: 'Pending',
    completed: 'Completed',
    missed: 'Missed',
    extended: 'Extended',
    cancelled: 'Cancelled',
  };
  return names[status];
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date and time for display
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Calculate days until deadline
 */
function calculateDaysUntil(dateString: string): number {
  const now = new Date();
  const deadline = new Date(dateString);
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Get days until text with urgency
 */
function getDaysUntilText(deadline: Deadline): { text: string; isUrgent: boolean } {
  const days = calculateDaysUntil(deadline.deadlineDate);

  if (days < 0) {
    return { text: `${Math.abs(days)} days overdue`, isUrgent: true };
  }
  if (days === 0) {
    return { text: 'Due today', isUrgent: true };
  }
  if (days === 1) {
    return { text: 'Due tomorrow', isUrgent: true };
  }
  if (days <= 7) {
    return { text: `${days} days remaining`, isUrgent: true };
  }
  if (days <= 30) {
    return { text: `${days} days remaining`, isUrgent: false };
  }

  const weeks = Math.floor(days / 7);
  return { text: `${weeks} week${weeks !== 1 ? 's' : ''} remaining`, isUrgent: false };
}

// ============================================================================
// Component
// ============================================================================

export default function DeadlinesPage() {
  const {
    deadlines,
    deadlinesLoading,
    fetchDeadlines,
    createDeadline,
    updateDeadline,
    deleteDeadline,
    checkDeadlineConflicts,
    getUpcomingDeadlines,
    cases,
    fetchCases,
  } = useDemocracyLitigation({ autoFetchCases: true });

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [conflicts, setConflicts] = useState<DeadlineConflict[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Deadline[]>([]);

  // Filters
  const [selectedCase, setSelectedCase] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<DeadlineType | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<DeadlinePriority | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<DeadlineStatus | 'all'>('pending');

  // Load data
  useEffect(() => {
    fetchDeadlines();
    fetchCases();
  }, []);

  // Load upcoming deadlines
  useEffect(() => {
    getUpcomingDeadlines(7).then(setUpcomingDeadlines).catch(console.error);
  }, [deadlines]);

  // Filtered deadlines
  const filteredDeadlines = useMemo(() => {
    let filtered = deadlines;

    if (selectedCase !== 'all') {
      filtered = filtered.filter((d) => d.caseId === selectedCase);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter((d) => d.deadlineType === selectedType);
    }

    if (selectedPriority !== 'all') {
      filtered = filtered.filter((d) => d.priority === selectedPriority);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((d) => d.status === selectedStatus);
    }

    return filtered;
  }, [deadlines, selectedCase, selectedType, selectedPriority, selectedStatus]);

  // Sorted deadlines for list view
  const sortedDeadlines = useMemo(() => {
    return [...filteredDeadlines].sort((a, b) => {
      return new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime();
    });
  }, [filteredDeadlines]);

  /**
   * Handle view deadline details
   */
  const handleViewDeadline = (deadline: Deadline) => {
    setSelectedDeadline(deadline);
    setShowDetailModal(true);
  };

  /**
   * Handle edit deadline
   */
  const handleEditDeadline = (deadline: Deadline) => {
    setEditingDeadline(deadline);
    setShowDeadlineForm(true);
  };

  /**
   * Handle delete deadline
   */
  const handleDeleteDeadline = async (deadline: Deadline) => {
    if (!confirm(`Are you sure you want to delete deadline "${deadline.title}"?`)) {
      return;
    }

    try {
      await deleteDeadline(deadline.id);
      setShowDetailModal(false);
    } catch (error) {
      console.error('Failed to delete deadline:', error);
      alert('Failed to delete deadline. Please try again.');
    }
  };

  /**
   * Handle create/update deadline
   */
  const handleSaveDeadline = async (data: any) => {
    try {
      if (editingDeadline) {
        await updateDeadline(editingDeadline.id, data);
      } else {
        await createDeadline(data);
      }

      setShowDeadlineForm(false);
      setEditingDeadline(null);

      // Refresh upcoming deadlines
      getUpcomingDeadlines(7).then(setUpcomingDeadlines).catch(console.error);

      // Check for conflicts
      if (data.caseId) {
        const conflictResults = await checkDeadlineConflicts(data.caseId);
        if (conflictResults.length > 0) {
          setConflicts(conflictResults);
          setShowConflictModal(true);
        }
      }
    } catch (error) {
      console.error('Failed to save deadline:', error);
      throw error;
    }
  };

  /**
   * Handle add deadline button
   */
  const handleAddDeadline = () => {
    setEditingDeadline(null);
    setShowDeadlineForm(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deadline Management</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage case deadlines with conflict detection
          </p>
        </div>
        <Button onClick={handleAddDeadline} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Add Deadline
        </Button>
      </div>

      {/* Upcoming Deadlines Widget */}
      <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <CardTitle className="text-lg">Upcoming Deadlines (Next 7 Days)</CardTitle>
          </div>
          <CardDescription>
            {upcomingDeadlines.length} deadline{upcomingDeadlines.length !== 1 ? 's' : ''}{' '}
            requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming deadlines in the next 7 days</p>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.slice(0, 5).map((deadline) => {
                const { text, isUrgent } = getDaysUntilText(deadline);
                return (
                  <div
                    key={deadline.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleViewDeadline(deadline)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="shrink-0">{getStatusIcon(deadline.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{deadline.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(deadline.deadlineDate)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={getPriorityColor(deadline.priority)}>
                        {deadline.priority}
                      </Badge>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isUrgent ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                        )}
                      >
                        {text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters and View Toggle */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Filters</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('calendar')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Calendar
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="mr-2 h-4 w-4" />
                List
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Case Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Case</label>
              <Select value={selectedCase} onValueChange={setSelectedCase}>
                <SelectTrigger>
                  <SelectValue placeholder="All Cases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cases</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="filing">Filing</SelectItem>
                  <SelectItem value="discovery">Discovery</SelectItem>
                  <SelectItem value="motion">Motion</SelectItem>
                  <SelectItem value="hearing">Hearing</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="appeal">Appeal</SelectItem>
                  <SelectItem value="response">Response</SelectItem>
                  <SelectItem value="expert_report">Expert Report</SelectItem>
                  <SelectItem value="brief">Brief</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Priority</label>
              <Select value={selectedPriority} onValueChange={(v) => setSelectedPriority(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="extended">Extended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar or List View */}
      {deadlinesLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading deadlines...</p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'calendar' ? (
        <Calendar
          deadlines={filteredDeadlines}
          onDateClick={(date) => {
            // Filter to deadlines on this date and show in modal
            const dateDeadlines = filteredDeadlines.filter((d) => {
              const deadlineDate = new Date(d.deadlineDate);
              return (
                deadlineDate.getFullYear() === date.getFullYear() &&
                deadlineDate.getMonth() === date.getMonth() &&
                deadlineDate.getDate() === date.getDate()
              );
            });
            if (dateDeadlines.length === 1) {
              handleViewDeadline(dateDeadlines[0]);
            }
          }}
          onDeadlineClick={handleViewDeadline}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Deadlines List</CardTitle>
            <CardDescription>
              {filteredDeadlines.length} deadline{filteredDeadlines.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDeadlines.length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No deadlines found</p>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or create a new deadline
                </p>
                <Button onClick={handleAddDeadline}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Deadline
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedDeadlines.map((deadline) => {
                  const { text, isUrgent } = getDaysUntilText(deadline);
                  const caseName = cases.find((c) => c.id === deadline.caseId)?.name || 'Unknown Case';

                  return (
                    <div
                      key={deadline.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleViewDeadline(deadline)}
                    >
                      <div className="shrink-0">{getStatusIcon(deadline.status)}</div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium mb-1">{deadline.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>{caseName}</span>
                          {deadline.deadlineType && (
                            <>
                              <span>•</span>
                              <span>{getDeadlineTypeDisplayName(deadline.deadlineType)}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatDateTime(deadline.deadlineDate)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className={getPriorityColor(deadline.priority)}>
                          {deadline.priority}
                        </Badge>
                        <span
                          className={cn(
                            'text-sm font-medium',
                            isUrgent ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                          )}
                        >
                          {text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deadline Form Modal */}
      <Dialog open={showDeadlineForm} onOpenChange={setShowDeadlineForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDeadline ? 'Edit Deadline' : 'Create New Deadline'}
            </DialogTitle>
            <DialogDescription>
              {editingDeadline
                ? 'Update deadline details and conflict detection will run automatically.'
                : 'Add a new deadline and check for conflicts with existing deadlines.'}
            </DialogDescription>
          </DialogHeader>
          <DeadlineForm
            deadline={editingDeadline || undefined}
            cases={cases}
            onSubmit={handleSaveDeadline}
            onCancel={() => {
              setShowDeadlineForm(false);
              setEditingDeadline(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deadline Details</DialogTitle>
          </DialogHeader>
          {selectedDeadline && (
            <div className="space-y-6">
              {/* Title and Status */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {getStatusIcon(selectedDeadline.status)}
                  <h3 className="text-xl font-semibold">{selectedDeadline.title}</h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={getPriorityColor(selectedDeadline.priority)}>
                    {selectedDeadline.priority} Priority
                  </Badge>
                  {selectedDeadline.deadlineType && (
                    <Badge variant="outline">
                      {getDeadlineTypeDisplayName(selectedDeadline.deadlineType)}
                    </Badge>
                  )}
                  <Badge variant="outline">{getStatusDisplayName(selectedDeadline.status)}</Badge>
                </div>
              </div>

              {/* Description */}
              {selectedDeadline.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedDeadline.description}</p>
                </div>
              )}

              {/* Deadline Date */}
              <div>
                <h4 className="font-medium mb-2">Deadline</h4>
                <div className="text-sm">
                  <div className="font-medium text-lg">
                    {formatDateTime(selectedDeadline.deadlineDate)}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {getDaysUntilText(selectedDeadline).text}
                  </div>
                </div>
              </div>

              {/* Case */}
              <div>
                <h4 className="font-medium mb-2">Case</h4>
                <p className="text-sm">
                  {cases.find((c) => c.id === selectedDeadline.caseId)?.name || 'Unknown Case'}
                </p>
              </div>

              {/* Alert Intervals */}
              {selectedDeadline.alertIntervals.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Alerts</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedDeadline.alertIntervals.map((interval, idx) => (
                      <Badge key={idx} variant="outline">
                        {interval} days before
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedDeadline.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedDeadline.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => handleEditDeadline(selectedDeadline)} className="flex-1">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteDeadline(selectedDeadline)}
                  className="flex-1"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conflict Detection Modal */}
      <ConflictDetector
        conflicts={conflicts}
        deadlines={deadlines}
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
      />
    </div>
  );
}

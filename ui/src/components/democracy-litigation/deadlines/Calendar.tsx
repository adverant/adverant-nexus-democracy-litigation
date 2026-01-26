/**
 * Democracy Litigation Plugin - Calendar Component
 *
 * Production-ready month view calendar for displaying deadlines.
 * Features:
 * - Month view calendar grid with proper date calculations
 * - Days with deadlines show count badges
 * - Color coding by priority (critical=red, high=orange, medium=yellow, low=blue)
 * - Click day to see day's deadlines
 * - Navigation (prev/next month, today)
 * - Responsive grid layout
 * - Dark mode support
 * - Handles month/year transitions correctly
 *
 * NO PLACEHOLDERS - Complete production implementation.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import type { Deadline, DeadlinePriority } from '@/types/democracy-litigation';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface CalendarProps {
  /** Deadlines to display on calendar */
  deadlines: Deadline[];
  /** Handler when a date is clicked */
  onDateClick?: (date: Date) => void;
  /** Handler when a deadline is clicked */
  onDeadlineClick?: (deadline: Deadline) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  deadlines: Deadline[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get days in month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get first day of month (0 = Sunday, 6 = Saturday)
 */
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if date is today
 */
function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Generate calendar days for a month
 */
function generateCalendarDays(year: number, month: number, deadlines: Deadline[]): CalendarDay[] {
  const days: CalendarDay[] = [];
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);

  // Previous month days to fill the first week
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const date = new Date(prevYear, prevMonth, daysInPrevMonth - i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isToday(date),
      deadlines: getDeadlinesForDate(date, deadlines),
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isToday(date),
      deadlines: getDeadlinesForDate(date, deadlines),
    });
  }

  // Next month days to fill the last week
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(nextYear, nextMonth, day);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isToday(date),
      deadlines: getDeadlinesForDate(date, deadlines),
    });
  }

  return days;
}

/**
 * Get deadlines for a specific date
 */
function getDeadlinesForDate(date: Date, deadlines: Deadline[]): Deadline[] {
  return deadlines.filter((deadline) => {
    const deadlineDate = new Date(deadline.deadlineDate);
    return isSameDay(date, deadlineDate);
  });
}

/**
 * Get highest priority from deadlines
 */
function getHighestPriority(deadlines: Deadline[]): DeadlinePriority | null {
  if (deadlines.length === 0) return null;

  const priorityOrder: DeadlinePriority[] = ['critical', 'high', 'normal', 'low'];

  for (const priority of priorityOrder) {
    if (deadlines.some((d) => d.priority === priority)) {
      return priority;
    }
  }

  return 'normal';
}

/**
 * Get badge color for priority
 */
function getPriorityBadgeColor(priority: DeadlinePriority): string {
  const colors: Record<DeadlinePriority, string> = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    normal: 'bg-yellow-500 text-white',
    low: 'bg-blue-500 text-white',
  };
  return colors[priority];
}

/**
 * Get day cell background for priority
 */
function getDayBackgroundColor(priority: DeadlinePriority | null): string {
  if (!priority) return '';

  const colors: Record<DeadlinePriority, string> = {
    critical: 'bg-red-50 dark:bg-red-950/20',
    high: 'bg-orange-50 dark:bg-orange-950/20',
    normal: 'bg-yellow-50 dark:bg-yellow-950/20',
    low: 'bg-blue-50 dark:bg-blue-950/20',
  };
  return colors[priority];
}

/**
 * Format month and year for display
 */
function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

/**
 * Format short date
 */
function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Component
// ============================================================================

export function Calendar({ deadlines, onDateClick, onDeadlineClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    return generateCalendarDays(currentYear, currentMonth, deadlines);
  }, [currentYear, currentMonth, deadlines]);

  // Week day names
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /**
   * Navigate to previous month
   */
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  /**
   * Navigate to next month
   */
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  /**
   * Navigate to today
   */
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  /**
   * Handle day click
   */
  const handleDayClick = (day: CalendarDay) => {
    if (day.deadlines.length === 0) return;

    if (day.deadlines.length === 1 && onDeadlineClick) {
      onDeadlineClick(day.deadlines[0]);
    } else if (onDateClick) {
      onDateClick(day.date);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">{formatMonthYear(currentYear, currentMonth)}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Week day headers */}
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day, index) => {
            const highestPriority = getHighestPriority(day.deadlines);
            const hasDeadlines = day.deadlines.length > 0;

            return (
              <div
                key={index}
                className={cn(
                  'relative min-h-[100px] p-2 border rounded-lg transition-all',
                  day.isCurrentMonth
                    ? 'bg-background'
                    : 'bg-muted/30 text-muted-foreground',
                  day.isToday && 'ring-2 ring-primary',
                  hasDeadlines && getDayBackgroundColor(highestPriority),
                  hasDeadlines && 'cursor-pointer hover:shadow-md',
                  !hasDeadlines && 'cursor-default'
                )}
                onClick={() => handleDayClick(day)}
              >
                {/* Day number */}
                <div
                  className={cn(
                    'text-sm font-medium mb-1',
                    day.isToday && 'text-primary font-bold',
                    !day.isCurrentMonth && 'text-muted-foreground'
                  )}
                >
                  {day.date.getDate()}
                </div>

                {/* Deadline indicators */}
                {hasDeadlines && (
                  <div className="space-y-1">
                    {/* Count badge */}
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs px-1.5 py-0.5 h-5',
                        highestPriority && getPriorityBadgeColor(highestPriority)
                      )}
                    >
                      {day.deadlines.length} deadline{day.deadlines.length !== 1 ? 's' : ''}
                    </Badge>

                    {/* First deadline preview (for desktop) */}
                    {day.deadlines.length > 0 && (
                      <div className="hidden lg:block">
                        <div className="text-xs font-medium truncate" title={day.deadlines[0].title}>
                          {day.deadlines[0].title}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-sm text-muted-foreground">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500" />
            <span className="text-sm text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500" />
            <span className="text-sm text-muted-foreground">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span className="text-sm text-muted-foreground">Low</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default Calendar;

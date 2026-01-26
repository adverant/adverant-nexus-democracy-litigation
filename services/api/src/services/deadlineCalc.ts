/**
 * Deadline Calculation Service
 *
 * Business day calculations, deadline conflict detection, and court-specific rules
 */

import {
  addDays,
  addBusinessDays,
  isWeekend,
  isBefore,
  isAfter,
  differenceInDays,
  parseISO,
  format,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { logger } from '../server';
import { DeadlineType, Priority, APIError } from '../types';

/**
 * Court-specific rules
 */
export interface CourtRules {
  courtName: string;
  jurisdiction: string;
  businessDaysOnly: boolean;
  excludeWeekends: boolean;
  federalHolidays: boolean;
  stateHolidays: boolean;
  customHolidays: Date[];
  filingCutoffTime: string; // HH:mm format
  electronicFilingEnabled: boolean;
}

/**
 * Deadline calculation request
 */
export interface DeadlineCalculationRequest {
  baseDate: Date;
  durationDays: number;
  useBusinessDays: boolean;
  courtRules?: CourtRules;
  excludeHolidays?: boolean;
}

/**
 * Deadline calculation response
 */
export interface DeadlineCalculationResponse {
  deadlineDate: Date;
  businessDays: number;
  calendarDays: number;
  excludedDates: Date[];
  warnings: string[];
}

/**
 * Conflict detection request
 */
export interface ConflictDetectionRequest {
  proposedDate: Date;
  existingDeadlines: Array<{
    id: string;
    title: string;
    deadline_date: Date;
    priority: Priority;
  }>;
  bufferDays?: number;
}

/**
 * Conflict detection response
 */
export interface ConflictDetectionResponse {
  hasConflicts: boolean;
  conflicts: Array<{
    id: string;
    title: string;
    deadline_date: Date;
    priority: Priority;
    daysDifference: number;
  }>;
  recommendations: string[];
}

/**
 * Alert dates request
 */
export interface AlertDatesRequest {
  deadlineDate: Date;
  intervals: number[]; // Days before deadline (e.g., [7, 3, 1])
  excludeWeekends?: boolean;
}

/**
 * Alert dates response
 */
export interface AlertDatesResponse {
  alertDates: Array<{
    date: Date;
    daysBefore: number;
    message: string;
  }>;
}

/**
 * Federal holidays (static for US federal courts)
 */
const US_FEDERAL_HOLIDAYS_2024: Date[] = [
  new Date('2024-01-01'), // New Year's Day
  new Date('2024-01-15'), // MLK Jr. Day
  new Date('2024-02-19'), // Presidents Day
  new Date('2024-05-27'), // Memorial Day
  new Date('2024-06-19'), // Juneteenth
  new Date('2024-07-04'), // Independence Day
  new Date('2024-09-02'), // Labor Day
  new Date('2024-10-14'), // Columbus Day
  new Date('2024-11-11'), // Veterans Day
  new Date('2024-11-28'), // Thanksgiving
  new Date('2024-12-25'), // Christmas
];

const US_FEDERAL_HOLIDAYS_2025: Date[] = [
  new Date('2025-01-01'), // New Year's Day
  new Date('2025-01-20'), // MLK Jr. Day
  new Date('2025-02-17'), // Presidents Day
  new Date('2025-05-26'), // Memorial Day
  new Date('2025-06-19'), // Juneteenth
  new Date('2025-07-04'), // Independence Day
  new Date('2025-09-01'), // Labor Day
  new Date('2025-10-13'), // Columbus Day
  new Date('2025-11-11'), // Veterans Day
  new Date('2025-11-27'), // Thanksgiving
  new Date('2025-12-25'), // Christmas
];

const US_FEDERAL_HOLIDAYS_2026: Date[] = [
  new Date('2026-01-01'), // New Year's Day
  new Date('2026-01-19'), // MLK Jr. Day
  new Date('2026-02-16'), // Presidents Day
  new Date('2026-05-25'), // Memorial Day
  new Date('2026-06-19'), // Juneteenth
  new Date('2026-07-03'), // Independence Day (observed)
  new Date('2026-09-07'), // Labor Day
  new Date('2026-10-12'), // Columbus Day
  new Date('2026-11-11'), // Veterans Day
  new Date('2026-11-26'), // Thanksgiving
  new Date('2026-12-25'), // Christmas
];

/**
 * Deadline Calculation Service
 */
export class DeadlineCalcService {
  private static instance: DeadlineCalcService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): DeadlineCalcService {
    if (!DeadlineCalcService.instance) {
      DeadlineCalcService.instance = new DeadlineCalcService();
    }
    return DeadlineCalcService.instance;
  }

  /**
   * Calculate deadline from base date
   *
   * Calculates a deadline by adding duration to base date, accounting for
   * business days, weekends, holidays, and court-specific rules.
   *
   * @param request - Calculation parameters
   * @returns Deadline date with metadata
   */
  public async calculateDeadline(
    request: DeadlineCalculationRequest
  ): Promise<DeadlineCalculationResponse> {
    try {
      logger.info('Calculating deadline', {
        baseDate: format(request.baseDate, 'yyyy-MM-dd'),
        durationDays: request.durationDays,
        useBusinessDays: request.useBusinessDays,
      });

      const excludedDates: Date[] = [];
      const warnings: string[] = [];

      // Get holidays to exclude
      const holidays = this.getHolidays(
        request.baseDate,
        request.courtRules,
        request.excludeHolidays !== false
      );

      // Calculate deadline
      let deadlineDate: Date;

      if (request.useBusinessDays) {
        // Add business days, excluding weekends and holidays
        deadlineDate = this.addBusinessDaysWithHolidays(
          request.baseDate,
          request.durationDays,
          holidays,
          excludedDates
        );
      } else {
        // Add calendar days
        deadlineDate = addDays(request.baseDate, request.durationDays);
      }

      // Check if deadline falls on weekend/holiday and adjust
      if (request.courtRules?.businessDaysOnly) {
        const adjusted = this.adjustForBusinessDay(deadlineDate, holidays);
        if (adjusted.getTime() !== deadlineDate.getTime()) {
          warnings.push(
            `Deadline adjusted from ${format(deadlineDate, 'yyyy-MM-dd')} to next business day`
          );
          deadlineDate = adjusted;
        }
      }

      // Check filing cutoff time
      if (request.courtRules?.filingCutoffTime) {
        warnings.push(
          `Court filing cutoff time: ${request.courtRules.filingCutoffTime}. ` +
          `Ensure filing is submitted before this time on ${format(deadlineDate, 'yyyy-MM-dd')}.`
        );
      }

      // Calculate metrics
      const businessDays = this.countBusinessDays(
        request.baseDate,
        deadlineDate,
        holidays
      );
      const calendarDays = differenceInDays(deadlineDate, request.baseDate);

      const response: DeadlineCalculationResponse = {
        deadlineDate,
        businessDays,
        calendarDays,
        excludedDates,
        warnings,
      };

      logger.info('Deadline calculated', {
        deadlineDate: format(deadlineDate, 'yyyy-MM-dd'),
        businessDays,
        calendarDays,
        excludedDatesCount: excludedDates.length,
      });

      return response;
    } catch (error) {
      logger.error('Deadline calculation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new APIError(
        'DEADLINE_CALCULATION_ERROR',
        'Failed to calculate deadline',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Add business days excluding holidays
   */
  private addBusinessDaysWithHolidays(
    startDate: Date,
    days: number,
    holidays: Date[],
    excludedDates: Date[]
  ): Date {
    let currentDate = startDate;
    let daysAdded = 0;

    while (daysAdded < days) {
      currentDate = addDays(currentDate, 1);

      if (!this.isExcludedDate(currentDate, holidays)) {
        daysAdded++;
      } else {
        excludedDates.push(new Date(currentDate));
      }
    }

    return currentDate;
  }

  /**
   * Check if date is excluded (weekend or holiday)
   */
  private isExcludedDate(date: Date, holidays: Date[]): boolean {
    if (isWeekend(date)) {
      return true;
    }

    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
    return holidays.some(
      (holiday) => format(startOfDay(holiday), 'yyyy-MM-dd') === dateStr
    );
  }

  /**
   * Adjust date to next business day
   */
  private adjustForBusinessDay(date: Date, holidays: Date[]): Date {
    let adjusted = date;

    while (this.isExcludedDate(adjusted, holidays)) {
      adjusted = addDays(adjusted, 1);
    }

    return adjusted;
  }

  /**
   * Count business days between dates
   */
  private countBusinessDays(
    startDate: Date,
    endDate: Date,
    holidays: Date[]
  ): number {
    let count = 0;
    let currentDate = startDate;

    while (isBefore(currentDate, endDate) || currentDate.getTime() === endDate.getTime()) {
      if (!this.isExcludedDate(currentDate, holidays)) {
        count++;
      }
      currentDate = addDays(currentDate, 1);
    }

    return count;
  }

  /**
   * Get holidays based on court rules
   */
  private getHolidays(
    baseDate: Date,
    courtRules?: CourtRules,
    excludeHolidays: boolean = true
  ): Date[] {
    if (!excludeHolidays) {
      return [];
    }

    const holidays: Date[] = [];

    // Add federal holidays
    if (!courtRules || courtRules.federalHolidays !== false) {
      holidays.push(
        ...US_FEDERAL_HOLIDAYS_2024,
        ...US_FEDERAL_HOLIDAYS_2025,
        ...US_FEDERAL_HOLIDAYS_2026
      );
    }

    // Add custom holidays from court rules
    if (courtRules?.customHolidays) {
      holidays.push(...courtRules.customHolidays);
    }

    return holidays;
  }

  /**
   * Detect deadline conflicts
   *
   * Identifies potential conflicts when scheduling a new deadline near
   * existing deadlines, considering priority and buffer periods.
   *
   * @param request - Conflict detection parameters
   * @returns Conflicts and recommendations
   */
  public async detectConflicts(
    request: ConflictDetectionRequest
  ): Promise<ConflictDetectionResponse> {
    try {
      logger.info('Detecting deadline conflicts', {
        proposedDate: format(request.proposedDate, 'yyyy-MM-dd'),
        existingDeadlinesCount: request.existingDeadlines.length,
        bufferDays: request.bufferDays,
      });

      const bufferDays = request.bufferDays || 3;
      const conflicts: ConflictDetectionResponse['conflicts'] = [];
      const recommendations: string[] = [];

      for (const existingDeadline of request.existingDeadlines) {
        const daysDifference = Math.abs(
          differenceInDays(request.proposedDate, existingDeadline.deadline_date)
        );

        // Check if within buffer period
        if (daysDifference <= bufferDays) {
          conflicts.push({
            id: existingDeadline.id,
            title: existingDeadline.title,
            deadline_date: existingDeadline.deadline_date,
            priority: existingDeadline.priority,
            daysDifference,
          });
        }
      }

      // Generate recommendations
      if (conflicts.length > 0) {
        const criticalConflicts = conflicts.filter((c) => c.priority === 'critical');
        const highConflicts = conflicts.filter((c) => c.priority === 'high');

        if (criticalConflicts.length > 0) {
          recommendations.push(
            `WARNING: ${criticalConflicts.length} critical deadline(s) within ${bufferDays} days. ` +
            `Consider rescheduling or allocating additional resources.`
          );
        }

        if (highConflicts.length > 0) {
          recommendations.push(
            `${highConflicts.length} high-priority deadline(s) nearby. ` +
            `Review workload capacity.`
          );
        }

        const sameDayConflicts = conflicts.filter((c) => c.daysDifference === 0);
        if (sameDayConflicts.length > 0) {
          recommendations.push(
            `${sameDayConflicts.length} deadline(s) on the same day. ` +
            `Ensure sufficient time for completion of all tasks.`
          );
        }
      }

      const response: ConflictDetectionResponse = {
        hasConflicts: conflicts.length > 0,
        conflicts,
        recommendations,
      };

      logger.info('Conflict detection completed', {
        hasConflicts: response.hasConflicts,
        conflictsCount: conflicts.length,
      });

      return response;
    } catch (error) {
      logger.error('Conflict detection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new APIError(
        'CONFLICT_DETECTION_ERROR',
        'Failed to detect conflicts',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Generate alert dates
   *
   * Generates alert/reminder dates before a deadline based on specified intervals.
   *
   * @param request - Alert generation parameters
   * @returns Alert dates with messages
   */
  public async generateAlertDates(
    request: AlertDatesRequest
  ): Promise<AlertDatesResponse> {
    try {
      logger.info('Generating alert dates', {
        deadlineDate: format(request.deadlineDate, 'yyyy-MM-dd'),
        intervals: request.intervals,
      });

      const alertDates: AlertDatesResponse['alertDates'] = [];

      for (const daysBefore of request.intervals) {
        let alertDate = addDays(request.deadlineDate, -daysBefore);

        // Adjust for weekends if requested
        if (request.excludeWeekends) {
          // If alert falls on weekend, move to Friday
          while (isWeekend(alertDate)) {
            alertDate = addDays(alertDate, -1);
          }
        }

        const message = this.generateAlertMessage(daysBefore, request.deadlineDate);

        alertDates.push({
          date: alertDate,
          daysBefore,
          message,
        });
      }

      // Sort by date ascending
      alertDates.sort((a, b) => a.date.getTime() - b.date.getTime());

      logger.info('Alert dates generated', {
        alertCount: alertDates.length,
      });

      return { alertDates };
    } catch (error) {
      logger.error('Alert date generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new APIError(
        'ALERT_GENERATION_ERROR',
        'Failed to generate alert dates',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Generate alert message based on days remaining
   */
  private generateAlertMessage(daysBefore: number, deadlineDate: Date): string {
    const dateStr = format(deadlineDate, 'MMMM d, yyyy');

    if (daysBefore === 0) {
      return `URGENT: Deadline is today (${dateStr})`;
    } else if (daysBefore === 1) {
      return `URGENT: Deadline is tomorrow (${dateStr})`;
    } else if (daysBefore <= 3) {
      return `REMINDER: Deadline in ${daysBefore} days (${dateStr})`;
    } else if (daysBefore <= 7) {
      return `NOTICE: Deadline in ${daysBefore} days (${dateStr})`;
    } else {
      return `Upcoming deadline in ${daysBefore} days (${dateStr})`;
    }
  }

  /**
   * Get court-specific rules
   *
   * Returns court-specific deadline rules based on jurisdiction.
   *
   * @param courtName - Name of the court
   * @param jurisdiction - Jurisdiction (federal/state)
   * @returns Court rules
   */
  public async getCourtRules(
    courtName: string,
    jurisdiction: string
  ): Promise<CourtRules> {
    try {
      logger.info('Getting court rules', {
        courtName,
        jurisdiction,
      });

      // Default federal court rules
      if (jurisdiction.toLowerCase() === 'federal') {
        return {
          courtName,
          jurisdiction,
          businessDaysOnly: true,
          excludeWeekends: true,
          federalHolidays: true,
          stateHolidays: false,
          customHolidays: [],
          filingCutoffTime: '23:59',
          electronicFilingEnabled: true,
        };
      }

      // Default state court rules (can be extended with database lookup)
      return {
        courtName,
        jurisdiction,
        businessDaysOnly: true,
        excludeWeekends: true,
        federalHolidays: true,
        stateHolidays: true,
        customHolidays: [],
        filingCutoffTime: '17:00',
        electronicFilingEnabled: true,
      };
    } catch (error) {
      logger.error('Failed to get court rules', {
        error: error instanceof Error ? error.message : 'Unknown error',
        courtName,
        jurisdiction,
      });

      throw new APIError(
        'COURT_RULES_ERROR',
        'Failed to retrieve court rules',
        500,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}

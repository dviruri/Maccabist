/**
 * Real calendar validation for dates of birth.
 *
 * Shared by the engine and the UI so there is exactly one definition of "is this a real date".
 * The previous implementation clamped every day to 28, which silently turned a chosen
 * 31 December into 28 December, and offered 29 February in a year that is not a leap year.
 *
 * A date the player chose must be stored exactly as chosen, or rejected - never quietly
 * transformed into a different date.
 */

import type { DateOfBirth } from '../types';

const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** How many days a month really has in a given year. */
export function daysInMonth(month: number, year: number): number {
  if (month < 1 || month > 12) return 0;
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1] as number;
}

/** True only for a date that exists. 29 February 2021 does not. */
export function isValidDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(month, year);
}

export function isValidDateOfBirth(dob: DateOfBirth): boolean {
  return isValidDate(dob.day, dob.month, dob.year);
}

/**
 * Normalises a requested date of birth without ever changing a valid one.
 *
 * A valid date is returned untouched. An invalid one is corrected to the last real day of the
 * requested month rather than silently sliding into a different month - so 31 April becomes
 * 30 April, and 29 February 2021 becomes 28 February 2021.
 */
export function resolveDateOfBirth(day: number, month: number, year: number): DateOfBirth {
  const safeMonth = Math.min(12, Math.max(1, Math.round(month)));
  const limit = daysInMonth(safeMonth, year);
  const safeDay = Math.min(limit, Math.max(1, Math.round(day)));
  return { day: safeDay, month: safeMonth, year };
}

/** "17.12.2021" - the way a date of birth is written on a form. */
export function formatDateOfBirth(dob: DateOfBirth): string {
  return `${dob.day}.${dob.month}.${dob.year}`;
}

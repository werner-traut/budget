import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Takes a date string (e.g., from the database) and formats it for display.
 * This function assumes the input date is a UTC date and displays it as a 'day'
 * without timezone conversion, which is often what is needed for date-only values.
 * @param date - The date string or Date object, expected to be in UTC.
 * @returns A formatted date string "yyyy-MM-dd".
 */
export function formatDateForDisplay(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  // We received a date from the database, which we assume is UTC.
  // We want to display this date as it is, without timezone conversion.
  // For example, 2024-01-01T00:00:00Z should be displayed as "2024-01-01".
  // Using format with a UTC date object will correctly format it without shifting it.
  return format(dateObj, "yyyy-MM-dd");
}

/**
 * Formats a date for API submission.
 * This function is a placeholder and assumes the date is already in the correct "yyyy-MM-dd" format.
 * @param date - The date string to be sent to the API.
 * @returns The date string in "yyyy-MM-dd" format.
 */
export function formatDateForAPI(date: string): string {
  // Assuming the input from a date picker is already in "yyyy-MM-dd" format.
  return date;
}

/**
 * Converts a date from UTC to a specified timezone.
 * This is useful for when you need to display a date in the user's actual local time.
 * @param date - The UTC date to convert.
 * @param timeZone - The target timezone (e.g., 'America/New_York').
 * @returns A new Date object in the specified timezone.
 */
export function convertToZonedTime(
  date: string | Date,
  timeZone: string
): Date {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return toZonedTime(dateObj, timeZone);
}

/**
 * Gets the current date in UTC, with the time set to the beginning of the day (00:00:00).
 * This is useful for consistent, timezone-independent date comparisons.
 * @returns A Date object representing the start of the current day in UTC.
 */
export function getTodayInUTC(): Date {
  const now = new Date();
  // Create a new date object in UTC using the year, month, and day from the local `now` object.
  // This effectively strips the time and timezone information, giving you the start of the day in UTC.
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

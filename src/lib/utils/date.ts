import { parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Takes a date string (e.g., from the database) and formats it for display.
 * This function assumes the input date is a UTC date and displays it as a 'day'
 * without timezone conversion, which is often what is needed for date-only values.
 * @param date - The date string or Date object, expected to be in UTC.
 * @returns A formatted date string "yyyy-MM-dd".
 */
export function formatDateForDisplay(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  // We must format the date in UTC to prevent timezone conversion.
  // The input date is treated as UTC midnight, and we want to display that same date,
  // not the local date in the user's browser timezone.
  return formatInTimeZone(dateObj, 'UTC', 'yyyy-MM-dd');
}

/**
 * Formats a date for API submission.
 * This function is a placeholder and assumes the date is already in the correct "yyyy-MM-dd" format.
 * @param date - The date string to be sent to the API.
 * @returns The date string in "yyyy-MM-dd" format.
 */
export function formatDateForAPI(date: string | Date): string {
  if (date instanceof Date) {
    return formatInTimeZone(date, "UTC", "yyyy-MM-dd");
  }

  if (DATE_ONLY_REGEX.test(date)) {
    return date;
  }

  const parsedDate = parseISO(date);
  return formatInTimeZone(parsedDate, "UTC", "yyyy-MM-dd");
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

/**
 * Returns the provided date (or today if omitted) as a local date string in the
 * format "yyyy-MM-dd". This should be used when capturing a user's notion of
 * "today" based on their browser timezone.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Converts a local date string (formatted as "yyyy-MM-dd") into a Date object
 * representing midnight UTC for that day. This ensures date-only values coming
 * from the client remain consistent when stored in the database.
 */
export function parseDateStringToUTC(dateString: string): Date {
  const [datePart] = dateString.split("T");

  if (!datePart) {
    throw new Error(`Invalid date string received: ${dateString}`);
  }

  const [year, month, day] = datePart.split("-").map(Number);

  if ([year, month, day].some((value) => Number.isNaN(value) || value === undefined)) {
    throw new Error(`Invalid date string received: ${dateString}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Adds the provided number of months to a date-only string (or Date object)
 * while keeping calculations purely in calendar space (UTC) to avoid timezone
 * drift when manipulating midnight UTC values in local time.
 */
export function addMonthsToDateString(
  date: string | Date,
  monthsToAdd: number
): string {
  const canonical = formatDateForAPI(date);
  const [yearStr, monthStr, dayStr] = canonical.split("-");

  let year = Number(yearStr);
  let month = Number(monthStr);
  let day = Number(dayStr);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid date string received: ${date}`);
  }

  month += monthsToAdd;

  while (month > 12) {
    month -= 12;
    year += 1;
  }

  while (month < 1) {
    month += 12;
    year -= 1;
  }

  const daysInTargetMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInTargetMonth) {
    day = daysInTargetMonth;
  }

  const normalizedMonth = String(month).padStart(2, "0");
  const normalizedDay = String(day).padStart(2, "0");

  return `${year}-${normalizedMonth}-${normalizedDay}`;
}

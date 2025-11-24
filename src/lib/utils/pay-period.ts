/**
 * Calculates the next pay period date based on the last period's date.
 * Rules:
 * - If last date was <= 15th, next is End of Month.
 * - If last date was > 15th, next is 15th of next month.
 * - Weekend adjustments:
 *   - Saturday -> Friday (previous)
 *   - Sunday -> Friday (previous)
 *   - Monday -> Saturday (previous)
 */
export function calculateNextPayPeriod(lastPeriodDate: Date | string): Date {
    const date = typeof lastPeriodDate === 'string' ? new Date(lastPeriodDate) : lastPeriodDate;

    // Use UTC methods to avoid timezone shifts
    const currentYear = date.getUTCFullYear();
    const currentMonth = date.getUTCMonth();
    const currentDay = date.getUTCDate();

    let targetDate: Date;

    if (currentDay <= 15) {
        // Current was 1st-15th, so next is End of Month of the SAME month
        // Strategy: Go to 1st of next month, then subtract 1 day
        targetDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
        targetDate.setUTCDate(targetDate.getUTCDate() - 1);
    } else {
        // Current was > 15th (EOM), so next is 15th of NEXT month
        targetDate = new Date(Date.UTC(currentYear, currentMonth + 1, 15));
    }

    // Apply weekend/Monday adjustments using UTC day
    const dayOfWeek = targetDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    if (dayOfWeek === 0) { // Sunday
        targetDate.setUTCDate(targetDate.getUTCDate() - 2); // Back to Friday
    } else if (dayOfWeek === 6) { // Saturday
        targetDate.setUTCDate(targetDate.getUTCDate() - 1); // Back to Friday
    } else if (dayOfWeek === 1) { // Monday
        // "If it falls on a monday it will be paid on the Saturday"
        targetDate.setUTCDate(targetDate.getUTCDate() - 2);
    }

    return targetDate;
}

export function formatDateForDisplay(date: string | Date): string {
  const d = new Date(date);
  // Ensure we're working with local dates by adding the timezone offset
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  return d.toISOString().split("T")[0]; // Returns YYYY-MM-DD format
}

export function formatDateForAPI(date: string): string {
  return date; // Already in YYYY-MM-DD format
}

/** Values are stored as whole minutes; the UI accepts decimal hours. */
export function hoursToMinutes(value: string, allowZero = false): number | null {
  const hours = Number(value);
  if (value.trim() === "" || !Number.isFinite(hours) || hours < 0 || (!allowZero && hours === 0)) return null;
  const minutes = Math.round(hours * 60);
  if (minutes > 600000 || (!allowZero && minutes === 0)) return null;
  return minutes;
}

export function minutesToHoursInput(minutes: number | null): string {
  return minutes === null ? "" : String(Math.round((minutes / 60) * 100) / 100);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

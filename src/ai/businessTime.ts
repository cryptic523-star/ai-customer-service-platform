// Works out "what time is it at the business" and "is it open right now".
// Done in code so the AI never has to guess.
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(index: number): string {
  return DAY_NAMES[index] ?? "";
}

export function localNow(timezone: string, now: Date = new Date()) {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).formatToParts(now);
  }
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const hhmm = `${p.hour}:${p.minute}`;
  return {
    dayIndex: DAY_NAMES.indexOf(p.weekday),
    hhmm,
    display: `${p.weekday} ${p.day} ${p.month} ${p.year}, ${formatTime12(hhmm)}`,
  };
}

/** "17:30" or "17:30:00" -> "5:30 pm" */
export function formatTime12(t: string): string {
  const [hs, ms] = t.split(":");
  const h = parseInt(hs, 10);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${ms} ${suffix}`;
}

export function isOpenNow(
  hours: { day_of_week: number; open_time: string; close_time: string }[],
  dayIndex: number,
  hhmm: string,
): boolean {
  return hours.some(
    (h) => h.day_of_week === dayIndex && h.open_time.slice(0, 5) <= hhmm && hhmm < h.close_time.slice(0, 5),
  );
}

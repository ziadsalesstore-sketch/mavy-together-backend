// All dates are stored in UTC. The admin types Cairo local time; these helpers convert both ways.
// Africa/Cairo handles daylight saving, so never hardcode an offset.
const TZ = "Africa/Cairo";

function cairoParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    y: Number(get("year")),
    mo: Number(get("month")),
    d: Number(get("day")),
    h: Number(get("hour")),
    mi: Number(get("minute")),
  };
}

function cairoOffsetMs(at: Date) {
  const p = cairoParts(at);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  return asUtc - Math.floor(at.getTime() / 60000) * 60000;
}

/** "2026-11-08T15:00" typed as Cairo local time -> the real instant. Empty/invalid -> null. */
export function cairoLocalToDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let guess = new Date(naive - cairoOffsetMs(new Date(naive)));
  guess = new Date(naive - cairoOffsetMs(guess));
  return Number.isNaN(guess.getTime()) ? null : guess;
}

/** Instant -> "YYYY-MM-DDTHH:mm" in Cairo time, for <input type="datetime-local">. */
export function dateToCairoLocal(d: Date | string | null | undefined): string {
  if (!d) return "";
  const p = cairoParts(new Date(d));
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}

export function formatCairo(d: Date | string | null | undefined): string {
  if (!d) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

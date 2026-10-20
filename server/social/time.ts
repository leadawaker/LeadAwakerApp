// Convert a wall-clock date and time in an IANA zone to a UTC Date, without a library.

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const get: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") get[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(get.year, get.month - 1, get.day, get.hour, get.minute, get.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

export function localToUtc(date: string, time: string, timeZone: string): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) throw new Error("Invalid date or time format");
  const [y, mo, da, h, mi] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  const check = new Date(wall);
  if (
    mo < 1 || mo > 12 || h > 23 || mi > 59 ||
    check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== da
  ) {
    throw new Error("Invalid date or time value");
  }
  // Throws RangeError on an unknown zone.
  new Intl.DateTimeFormat(undefined, { timeZone });

  let result = wall - zoneOffsetMs(wall, timeZone);
  const corrected = wall - zoneOffsetMs(result, timeZone);
  if (corrected !== result) result = corrected;
  return new Date(result);
}

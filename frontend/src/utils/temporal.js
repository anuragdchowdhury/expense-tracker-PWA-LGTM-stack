/**
 * Location-agnostic calendar date & year-month utilities using Temporal Plain types.
 * Prevents UTC midnight timezone drift when working with YYYY-MM-DD expense dates.
 */

let temporalReadyPromise = null;

export async function ensureTemporal() {
  if (typeof globalThis.Temporal !== 'undefined') {
    return globalThis.Temporal;
  }
  if (!temporalReadyPromise) {
    temporalReadyPromise = import('temporal-polyfill').then((mod) => {
      if (typeof globalThis.Temporal === 'undefined') {
        globalThis.Temporal = mod.Temporal;
      }
      if (!Date.prototype.toTemporalInstant && mod.toTemporalInstant) {
        Date.prototype.toTemporalInstant = mod.toTemporalInstant;
      }
      return globalThis.Temporal;
    });
  }
  return temporalReadyPromise;
}

function getTemporalSync() {
  if (typeof globalThis.Temporal === 'undefined') {
    throw new Error('Temporal not initialized. Await ensureTemporal() at app startup.');
  }
  return globalThis.Temporal;
}

export function getTodayPlainDateString() {
  const T = getTemporalSync();
  return T.Now.plainDateISO().toString();
}

export function getCurrentYearMonth() {
  const T = getTemporalSync();
  const ym = T.Now.plainDateISO().toPlainYearMonth();
  return { year: ym.year, month: ym.month };
}

export function shiftYearMonth(year, month, deltaMonths) {
  const T = getTemporalSync();
  const ym = T.PlainYearMonth.from({ year, month, calendar: 'iso8601' });
  const next =
    deltaMonths >= 0
      ? ym.add({ months: deltaMonths })
      : ym.subtract({ months: Math.abs(deltaMonths) });
  return { year: next.year, month: next.month };
}

export function formatCalendarDate(isoDate, options = { month: 'short', day: 'numeric' }) {
  const T = getTemporalSync();
  const plain = T.PlainDate.from(isoDate);
  return plain.toLocaleString(undefined, options);
}

export function formatMonthYear(year, month) {
  const T = getTemporalSync();
  const ym = T.PlainYearMonth.from({ year, month, calendar: 'iso8601' });
  // Format via PlainDate so native Temporal does not throw RangeError: Mismatched calendars
  // when the environment's default Intl calendar (e.g. 'gregory') differs from 'iso8601'.
  return ym.toPlainDate({ day: 1 }).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function getMonthDays(year, month) {
  const T = getTemporalSync();
  const ym = T.PlainYearMonth.from({ year, month, calendar: 'iso8601' });
  const result = [];
  for (let day = 1; day <= ym.daysInMonth; day += 1) {
    const plain = ym.toPlainDate({ day });
    result.push({
      date: plain.toString(),
      day,
      label: plain.toLocaleString('en-US', { month: 'short', day: 'numeric' }),
    });
  }
  return result;
}

export function getWeekDaysForPeriod(year, month, todayIso) {
  const T = getTemporalSync();
  const today = T.PlainDate.from(todayIso);
  const ym = T.PlainYearMonth.from({ year, month, calendar: 'iso8601' });

  let weekStart;
  if (today.year === year && today.month === month) {
    // Temporal dayOfWeek is 1 (Monday) .. 7 (Sunday)
    weekStart = today.subtract({ days: today.dayOfWeek - 1 });
  } else {
    const endOfMonth = ym.toPlainDate({ day: ym.daysInMonth });
    weekStart = endOfMonth.subtract({ days: 6 });
  }

  const result = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const d = weekStart.add({ days: offset });
    result.push({
      date: d.toString(),
      label: d.toLocaleString('en-US', { weekday: 'short' }),
      full_label: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }),
    });
  }
  return result;
}


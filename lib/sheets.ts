const SHEET_ID = "1VJNPP5ZHnpMuruzzT-AiTBgtONF9SsoqbJBY_tL9Aos";
const LEADS_RANGE = "Leads 26!A4:M10000";

// Wochen-Performance (echte Werte). Monatstabs (Jan 26, Jun 26, ...) enthalten Placeholder — nicht mehr verwendet.
const KW_PERF_RANGE = "KW Performance 26!A4:H60";
const KW_YEAR = 2026;

// Montag der ISO-Woche `week` im Jahr `year` (KW 1 = Woche mit erstem Donnerstag).
function isoWeekToMonday(week: number, year: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = (jan4.getDay() + 6) % 7; // 0 = Mon
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Dow + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export type Lead = {
  datum: Date;
  kampagne: string;
  adSet: string;
  adName: string;
  quelle: string;
  vorname: string;
  nachname: string;
  telefon: string;
  email: string;
  close: boolean;
  umsatz: number;
  auftragsart: string;
  sales: number;
};

function computeSales(close: boolean, auftragsart: string): number {
  if (!close) return 0;
  const a = (auftragsart || "").toLowerCase().replace(/\s+/g, "");
  if (a.includes("pv") && a.includes("wp")) return 2;
  return 1;
}

export type DailyPerf = {
  datum: Date;
  adspend: number;
  impr: number;
  klicks: number;
  leads: number;
  cpl: number;
  erstgespraeche: number;
  beratungen: number;
  sales: number;
  umsatz: number;
  cash: number;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + value * 86400 * 1000);
  }
  const s = String(value).trim();
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  const match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?\s*(\d{1,2}):(\d{2}):(\d{2})?/);
  if (match) {
    const [, d, m, y, hh, mm, ss] = match;
    return new Date(
      Number(y || new Date().getFullYear()),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss || 0)
    );
  }
  return null;
}

function parseNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const cleaned = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

async function sheetsGet(range: string): Promise<unknown[][]> {
  const key = process.env.SHEETS_API_KEY;
  if (!key) throw new Error("SHEETS_API_KEY env var fehlt");
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`
  );
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
  url.searchParams.set("key", key);
  const resp = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!resp.ok) {
    if (resp.status === 400 || resp.status === 404) return [];
    const body = await resp.text();
    throw new Error(`Sheets API ${resp.status}: ${body.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { values?: unknown[][] };
  return json.values || [];
}

export async function fetchLeads(): Promise<Lead[]> {
  const rows = await sheetsGet(LEADS_RANGE);
  const data: Lead[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const datum = parseDate(r[1]);
    if (!datum) continue;
    const close = r[10] === true || r[10] === "TRUE" || r[10] === "true";
    const auftragsart = String(r[12] || "").trim();
    data.push({
      datum,
      kampagne: String(r[2] || "").trim(),
      adSet: String(r[3] || "").trim(),
      adName: String(r[4] || "").trim(),
      quelle: String(r[5] || "").toLowerCase().trim(),
      vorname: String(r[6] || ""),
      nachname: String(r[7] || ""),
      telefon: String(r[8] || ""),
      email: String(r[9] || ""),
      close,
      umsatz: parseNumber(r[11]),
      auftragsart,
      sales: computeSales(close, auftragsart),
    });
  }
  return data;
}

export async function fetchDailyPerf(): Promise<DailyPerf[]> {
  // Liest jetzt "KW Performance 26" (die einzige Quelle mit echten Werten).
  // Semantisch sind das Wochen-Aggregate, aber wir mappen sie in die DailyPerf-Struktur:
  // datum = Montag der jeweiligen KW, damit Range-Filter (Monat/Woche/YTD) unverändert funktionieren.
  // Spalten: A=KW ("KW 22"), B=Kosten, C=Umsatz, D=ROAS, E=Leads, F=CPL, G=Kunden, H=Sales
  const rows = await sheetsGet(KW_PERF_RANGE);
  const all: DailyPerf[] = [];
  for (const row of rows) {
    const kwLabel = String(row[0] || "").trim();
    const match = kwLabel.match(/KW\s*(\d{1,2})/i);
    if (!match) continue;
    const week = Number(match[1]);
    if (!week || week < 1 || week > 53) continue;
    const adspend = parseNumber(row[1]);
    const umsatz = parseNumber(row[2]);
    const leads = parseNumber(row[4]);
    const sales = parseNumber(row[7]);
    if (adspend === 0 && leads === 0 && umsatz === 0) continue;
    all.push({
      datum: isoWeekToMonday(week, KW_YEAR),
      adspend,
      impr: 0,
      klicks: 0,
      leads,
      cpl: parseNumber(row[5]),
      erstgespraeche: 0,
      beratungen: 0,
      sales,
      umsatz,
      cash: 0,
    });
  }
  return all;
}

async function sheetsBatchGet(ranges: string[]): Promise<unknown[][][]> {
  const key = process.env.SHEETS_API_KEY;
  if (!key) throw new Error("SHEETS_API_KEY env var fehlt");
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet`
  );
  for (const r of ranges) url.searchParams.append("ranges", r);
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
  url.searchParams.set("key", key);
  const resp = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Sheets API batch ${resp.status}: ${body.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { valueRanges?: { values?: unknown[][] }[] };
  return (json.valueRanges || []).map((r) => r.values || []);
}

export type DateRangeKey =
  | "diese-woche"
  | "letzte-woche"
  | "dieser-monat"
  | "letzter-monat"
  | "ytd"
  | "custom";

export function parseYmd(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

export function getDateRange(
  key: DateRangeKey,
  customFrom?: string | null,
  customTo?: string | null
): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const dayOfWeek = (today.getDay() + 6) % 7;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);

  switch (key) {
    case "diese-woche": {
      const end = new Date(startOfWeek);
      end.setDate(startOfWeek.getDate() + 7);
      return { start: startOfWeek, end };
    }
    case "letzte-woche": {
      const start = new Date(startOfWeek);
      start.setDate(start.getDate() - 7);
      return { start, end: startOfWeek };
    }
    case "dieser-monat": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start, end };
    }
    case "letzter-monat": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end };
    }
    case "ytd": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    case "custom": {
      const start = (customFrom && parseYmd(customFrom)) || today;
      const toDate = (customTo && parseYmd(customTo)) || start;
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
  }
}

export function getPreviousRange(
  key: DateRangeKey,
  current: { start: Date; end: Date }
): { start: Date; end: Date } {
  const durationMs = current.end.getTime() - current.start.getTime();
  switch (key) {
    case "diese-woche":
    case "letzte-woche":
    case "custom": {
      const start = new Date(current.start.getTime() - durationMs);
      return { start, end: current.start };
    }
    case "dieser-monat":
    case "letzter-monat": {
      const start = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1);
      const end = new Date(current.start.getFullYear(), current.start.getMonth(), 1);
      return { start, end };
    }
    case "ytd": {
      const start = new Date(current.start.getFullYear() - 1, 0, 1);
      const end = new Date(current.start.getFullYear(), 0, 1);
      return { start, end };
    }
  }
}

export type SourceBreakdown = {
  name: string;
  leads: number;
  sales: number;
  umsatz: number;
  spend?: number;
  cpl?: number;
  cpa?: number;
  roas?: number;
};

export type CampaignBreakdown = {
  name: string;
  leads: number;
  sales: number;
  umsatz: number;
  salesQuote: number;
};

export type AdSetBreakdown = {
  name: string;
  leads: number;
  sales: number;
  umsatz: number;
  salesQuote: number;
};

export type AdBreakdown = {
  adName: string;
  adSet: string;
  leads: number;
  sales: number;
  umsatz: number;
};

export type SpendByDay = {
  day: string;
  facebook: number;
  google: number;
  ig: number;
  total: number;
};

export type Forecast = {
  daysInMonth: number;
  daysElapsed: number;
  leadsProjected: number;
  salesProjected: number;
  umsatzProjected: number;
  leadsSoFar: number;
  salesSoFar: number;
  umsatzSoFar: number;
};

export type PerfTotals = {
  spend: number;
  leads: number;
  sales: number;
  umsatz: number;
  cpl: number;
  cpa: number;
  roas: number;
};

export type DashboardStats = {
  totalLeads: number;
  salesCount: number;
  salesQuote: number;
  umsatz: number;
  bySource: SourceBreakdown[];
  weeklyTrend: { week: string; leads: number; umsatz: number }[];
  delta: {
    leads: number | null;
    sales: number | null;
    salesQuote: number | null;
    umsatz: number | null;
  };
  topCampaigns: CampaignBreakdown[];
  topAdSets: AdSetBreakdown[];
  topAds: AdBreakdown[];
  byWeekday: { day: string; leads: number }[];
  byHour: { hour: number; weekday: string; leads: number }[];
  spendByDay: SpendByDay[];
  spendTotal: { plattform: string; spend: number }[];
  spendTotalAll: number;
  perfTotals: PerfTotals;
  forecast: Forecast | null;
};

function isoWeek(d: Date): string {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNr = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `KW ${weekNr}`;
}

function pctDelta(now: number, prev: number): number | null {
  if (prev === 0) return now === 0 ? 0 : null;
  return (now - prev) / prev;
}

function weekdayLabel(dow: number): string {
  return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dow];
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function aggregateBasics(leads: Lead[], start: Date, end: Date) {
  const inRange = leads.filter((l) => l.datum >= start && l.datum < end);
  const sales = inRange.reduce((s, l) => s + l.sales, 0);
  const total = inRange.length;
  const umsatz = inRange.reduce((s, l) => s + l.umsatz, 0);
  return { inRange, sales, total, umsatz };
}

export type ViewFilter = "gesamt" | "google" | "organisch" | "deal";

function applyViewFilter(leads: Lead[], view: ViewFilter): Lead[] {
  switch (view) {
    case "google":
      return leads.filter((l) => l.quelle === "google");
    case "organisch":
      return leads.filter(
        (l) => l.quelle === "website" || l.quelle === "organic" || l.quelle === "organisch"
      );
    case "deal":
      return leads.filter(
        (l) =>
          (l.quelle === "facebook" || l.quelle === "ig" || l.quelle === "meta" || l.quelle === "instagram") &&
          l.kampagne.toLowerCase().includes("deal")
      );
    case "gesamt":
    default:
      return leads;
  }
}

export function computeStats(
  allLeads: Lead[],
  daily: DailyPerf[],
  current: { start: Date; end: Date },
  previous: { start: Date; end: Date },
  view: ViewFilter = "gesamt"
): DashboardStats {
  const leads = applyViewFilter(allLeads, view);
  const allInRange = aggregateBasics(allLeads, current.start, current.end);
  const dailyEffective = daily;
  const { inRange, sales: salesCount, total: totalLeads, umsatz } = aggregateBasics(leads, current.start, current.end);
  const prev = aggregateBasics(leads, previous.start, previous.end);

  // Source breakdown (lead-side, spend comes from daily perf totals)
  const sourceMap = new Map<string, { leads: number; sales: number; umsatz: number }>();
  for (const l of inRange) {
    const k = l.quelle || "(leer)";
    const cur = sourceMap.get(k) || { leads: 0, sales: 0, umsatz: 0 };
    cur.leads += 1;
    cur.sales += l.sales;
    cur.umsatz += l.umsatz;
    sourceMap.set(k, cur);
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Proportionale KW-zu-Range-Aufteilung: Jede KW spannt 7 Tage vom Montag an.
  // Wenn Range nur einen Teil der KW abdeckt, wird der Anteil (0..1) berechnet.
  // Beispiel: KW 27 (Mo 29.06.–So 05.07.) im "Juli"-Range: 5/7 der Werte fließen ein.
  const WEEK_MS = 7 * 86400000;
  const rangeStart = current.start.getTime();
  const rangeEnd = Math.min(current.end.getTime(), todayEnd.getTime() + 1);
  function overlapFraction(kwMonday: Date): number {
    const kwStart = kwMonday.getTime();
    const kwEnd = kwStart + WEEK_MS;
    const overlapStart = Math.max(kwStart, rangeStart);
    const overlapEnd = Math.min(kwEnd, rangeEnd);
    if (overlapEnd <= overlapStart) return 0;
    return (overlapEnd - overlapStart) / WEEK_MS;
  }

  const dailyInRange = dailyEffective
    .map((d) => ({ ...d, _frac: overlapFraction(d.datum) }))
    .filter((d) => d._frac > 0);
  const totalSpend = dailyInRange.reduce((s, d) => s + d.adspend * d._frac, 0);
  const totalDailyLeads = dailyInRange.reduce((s, d) => s + d.leads * d._frac, 0);
  const totalDailySales = dailyInRange.reduce((s, d) => s + d.sales * d._frac, 0);
  const totalDailyUmsatz = dailyInRange.reduce((s, d) => s + d.umsatz * d._frac, 0);

  const bySource: SourceBreakdown[] = Array.from(sourceMap.entries())
    .map(([name, v]) => ({
      name,
      ...v,
    }))
    .sort((a, b) => b.leads - a.leads);

  // Campaign breakdown
  const campMap = new Map<string, { leads: number; sales: number; umsatz: number }>();
  for (const l of inRange) {
    const k = l.kampagne || "(ohne Kampagne)";
    const cur = campMap.get(k) || { leads: 0, sales: 0, umsatz: 0 };
    cur.leads += 1;
    cur.sales += l.sales;
    cur.umsatz += l.umsatz;
    campMap.set(k, cur);
  }
  const topCampaigns: CampaignBreakdown[] = Array.from(campMap.entries())
    .map(([name, v]) => ({ name, ...v, salesQuote: v.leads ? v.sales / v.leads : 0 }))
    .sort((a, b) => b.umsatz - a.umsatz || b.leads - a.leads)
    .slice(0, 8);

  // Ad Set breakdown (Anzeigengruppe)
  const adSetMap = new Map<string, { leads: number; sales: number; umsatz: number }>();
  for (const l of inRange) {
    if (!l.adSet) continue;
    const k = l.adSet;
    const cur = adSetMap.get(k) || { leads: 0, sales: 0, umsatz: 0 };
    cur.leads += 1;
    cur.sales += l.sales;
    cur.umsatz += l.umsatz;
    adSetMap.set(k, cur);
  }
  const topAdSets: AdSetBreakdown[] = Array.from(adSetMap.entries())
    .map(([name, v]) => ({ name, ...v, salesQuote: v.leads ? v.sales / v.leads : 0 }))
    .sort((a, b) => b.umsatz - a.umsatz || b.leads - a.leads)
    .slice(0, 8);

  // Ad (Werbeanzeige) breakdown
  const adMap = new Map<string, { adName: string; adSet: string; leads: number; sales: number; umsatz: number }>();
  for (const l of inRange) {
    if (!l.adName && !l.adSet) continue;
    const effectiveAdName = l.adName || "(ohne Anzeigenname)";
    const key = `${l.adSet}||${effectiveAdName}`;
    const cur = adMap.get(key) || {
      adName: effectiveAdName,
      adSet: l.adSet || "—",
      leads: 0,
      sales: 0,
      umsatz: 0,
    };
    cur.leads += 1;
    cur.sales += l.sales;
    cur.umsatz += l.umsatz;
    adMap.set(key, cur);
  }
  const topAds: AdBreakdown[] = Array.from(adMap.values())
    .sort((a, b) => b.umsatz - a.umsatz || b.leads - a.leads)
    .slice(0, 10);

  // Weekday
  const weekdayCounts = new Array(7).fill(0);
  for (const l of inRange) {
    weekdayCounts[l.datum.getDay()] += 1;
  }
  const byWeekday = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
    day: weekdayLabel(dow),
    leads: weekdayCounts[dow],
  }));

  // Hourly heatmap
  const hourMap = new Map<string, number>();
  for (const l of inRange) {
    const key = `${l.datum.getDay()}-${l.datum.getHours()}`;
    hourMap.set(key, (hourMap.get(key) || 0) + 1);
  }
  const byHour: DashboardStats["byHour"] = [];
  for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
    for (let h = 0; h < 24; h++) {
      byHour.push({
        hour: h,
        weekday: weekdayLabel(dow),
        leads: hourMap.get(`${dow}-${h}`) || 0,
      });
    }
  }

  // Weekly trend (5 weeks ending at current.end)
  const weekMap = new Map<string, { leads: number; umsatz: number }>();
  const fiveWeeksBack = new Date(current.end);
  fiveWeeksBack.setDate(current.end.getDate() - 35);
  for (const l of leads) {
    if (l.datum < fiveWeeksBack || l.datum >= current.end) continue;
    const k = isoWeek(l.datum);
    const cur = weekMap.get(k) || { leads: 0, umsatz: 0 };
    cur.leads += 1;
    cur.umsatz += l.umsatz;
    weekMap.set(k, cur);
  }
  const weeklyTrend = Array.from(weekMap.entries())
    .map(([week, v]) => ({ week, ...v }))
    .slice(-5);

  // Daily spend chart (from Monatstabs)
  const spendByDay: SpendByDay[] = dailyInRange
    .filter((d) => d.adspend > 0)
    .map((d) => ({
      day: ymd(d.datum),
      facebook: 0,
      google: 0,
      ig: 0,
      total: d.adspend,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const spendTotal = totalSpend > 0 ? [{ plattform: "Gesamt", spend: totalSpend }] : [];
  const spendTotalAll = totalSpend;

  // Fallback: Wenn Leads 26 keine Sales/Umsatz hat, KW Performance-Werte nutzen.
  // Für Sub-Views proportional zum Lead-Anteil aufteilen.
  const viewRatio = view === "gesamt" ? 1 : (allInRange.total > 0 ? totalLeads / allInRange.total : 0);
  const effectiveSales = Math.round(
    salesCount === 0 && totalDailySales > 0 ? totalDailySales * viewRatio : salesCount
  );
  const effectiveUmsatz =
    umsatz === 0 && totalDailyUmsatz > 0 ? totalDailyUmsatz * viewRatio : umsatz;
  const effectiveLeads = Math.round(
    totalDailyLeads * viewRatio > totalLeads ? totalDailyLeads * viewRatio : totalLeads
  );

  // Forecast (only for "dieser-monat")
  let forecast: Forecast | null = null;
  const now = new Date();
  if (
    current.start.getFullYear() === now.getFullYear() &&
    current.start.getMonth() === now.getMonth() &&
    current.end > now
  ) {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const factor = daysInMonth / Math.max(1, daysElapsed);
    forecast = {
      daysInMonth,
      daysElapsed,
      leadsSoFar: effectiveLeads,
      salesSoFar: effectiveSales,
      umsatzSoFar: effectiveUmsatz,
      leadsProjected: Math.round(effectiveLeads * factor),
      salesProjected: Math.round(effectiveSales * factor),
      umsatzProjected: Math.round(effectiveUmsatz * factor),
    };
  }

  return {
    totalLeads: effectiveLeads,
    salesCount: effectiveSales,
    salesQuote: effectiveLeads > 0 ? effectiveSales / effectiveLeads : 0,
    umsatz: effectiveUmsatz,
    bySource,
    weeklyTrend,
    delta: {
      leads: pctDelta(effectiveLeads, prev.total),
      sales: pctDelta(effectiveSales, prev.sales),
      salesQuote: pctDelta(
        effectiveLeads ? effectiveSales / effectiveLeads : 0,
        prev.total ? prev.sales / prev.total : 0
      ),
      umsatz: pctDelta(effectiveUmsatz, prev.umsatz),
    },
    topCampaigns,
    topAdSets,
    topAds,
    byWeekday,
    byHour,
    spendByDay,
    spendTotal,
    spendTotalAll,
    perfTotals: {
      spend: totalSpend,
      leads: totalDailyLeads,
      sales: totalDailySales,
      umsatz: totalDailyUmsatz,
      cpl: totalDailyLeads ? totalSpend / totalDailyLeads : 0,
      cpa: totalDailySales ? totalSpend / totalDailySales : 0,
      roas: totalSpend ? totalDailyUmsatz / totalSpend : 0,
    },
    forecast,
  };
}

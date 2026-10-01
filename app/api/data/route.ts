import { NextRequest, NextResponse } from "next/server";
import {
  fetchLeads,
  fetchDailyPerf,
  getDateRange,
  getPreviousRange,
  computeStats,
  DateRangeKey,
  ViewFilter,
} from "@/lib/sheets";

export const revalidate = 60;

const VALID_RANGES: DateRangeKey[] = [
  "diese-woche",
  "letzte-woche",
  "dieser-monat",
  "letzter-monat",
  "ytd",
  "custom",
];

export async function GET(req: NextRequest) {
  const rangeParam = req.nextUrl.searchParams.get("range");
  const range: DateRangeKey = VALID_RANGES.includes(rangeParam as DateRangeKey)
    ? (rangeParam as DateRangeKey)
    : "dieser-monat";
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const viewParam = req.nextUrl.searchParams.get("view");
  const VALID_VIEWS: ViewFilter[] = ["gesamt", "google", "meta", "organisch"];
  const view: ViewFilter = VALID_VIEWS.includes(viewParam as ViewFilter)
    ? (viewParam as ViewFilter)
    : "gesamt";

  try {
    const [leads, daily] = await Promise.all([fetchLeads(), fetchDailyPerf()]);
    const current = getDateRange(range, from, to);
    const previous = getPreviousRange(range, current);
    const stats = computeStats(leads, daily, current, previous, view);
    return NextResponse.json({
      ok: true,
      range,
      generatedAt: new Date().toISOString(),
      ...stats,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

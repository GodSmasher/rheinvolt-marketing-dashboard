"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle2,
  Percent,
  Euro,
  Calendar,
  RefreshCw,
  Download,
  Target,
  Megaphone,
  Sparkles,
  Clock,
  Banknote,
} from "lucide-react";

type DateRange =
  | "diese-woche"
  | "letzte-woche"
  | "dieser-monat"
  | "letzter-monat"
  | "ytd"
  | "custom";

type ViewFilter = "gesamt" | "google" | "meta" | "organisch";

const viewLabels: Record<ViewFilter, string> = {
  gesamt: "Gesamt",
  google: "Google",
  meta: "META",
  organisch: "Organisch",
};

const rangeLabels: Record<DateRange, string> = {
  "diese-woche": "Diese Woche",
  "letzte-woche": "Letzte Woche",
  "dieser-monat": "Dieser Monat",
  "letzter-monat": "Letzter Monat",
  ytd: "Year-to-Date",
  custom: "Eigener Zeitraum",
};

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthAgoYmd() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type SourceBreakdown = {
  name: string;
  leads: number;
  sales: number;
  umsatz: number;
  spend?: number;
  cpl?: number;
  cpa?: number;
  roas?: number;
};

type CampaignBreakdown = {
  name: string;
  leads: number;
  sales: number;
  umsatz: number;
  salesQuote: number;
};

type AdSetBreakdown = {
  name: string;
  leads: number;
  sales: number;
  umsatz: number;
  salesQuote: number;
};

type AdBreakdown = {
  adName: string;
  adSet: string;
  leads: number;
  sales: number;
  umsatz: number;
};

type SpendByDay = {
  day: string;
  facebook: number;
  google: number;
  ig: number;
  total: number;
};

type Forecast = {
  daysInMonth: number;
  daysElapsed: number;
  leadsProjected: number;
  salesProjected: number;
  umsatzProjected: number;
  leadsSoFar: number;
  salesSoFar: number;
  umsatzSoFar: number;
};

type PerfTotals = {
  spend: number;
  leads: number;
  sales: number;
  umsatz: number;
  cpl: number;
  cpa: number;
  roas: number;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  range?: DateRange;
  generatedAt?: string;
  totalLeads?: number;
  salesCount?: number;
  salesQuote?: number;
  umsatz?: number;
  bySource?: SourceBreakdown[];
  weeklyTrend?: { week: string; leads: number; umsatz: number }[];
  delta?: {
    leads: number | null;
    sales: number | null;
    salesQuote: number | null;
    umsatz: number | null;
  };
  topCampaigns?: CampaignBreakdown[];
  topAdSets?: AdSetBreakdown[];
  topAds?: AdBreakdown[];
  byWeekday?: { day: string; leads: number }[];
  byHour?: { hour: number; weekday: string; leads: number }[];
  spendByDay?: SpendByDay[];
  spendTotal?: { plattform: string; spend: number }[];
  spendTotalAll?: number;
  perfTotals?: PerfTotals;
  forecast?: Forecast | null;
};

const sourceColors: Record<string, string> = {
  facebook: "#1877f2",
  meta: "#1877f2",
  ig: "#e1306c",
  instagram: "#e1306c",
  google: "#4285f4",
  website: "#4caf48",
  organic: "#4caf48",
  tiktok: "#000000",
  empfehlung: "#f59e0b",
  "(leer)": "#a1a1aa",
};

function colorFor(name: string): string {
  return sourceColors[name.toLowerCase()] || "#6366f1";
}

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatEurPrecise(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPct(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatDelta(d: number | null | undefined) {
  if (d === null || d === undefined) return null;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${(d * 100).toFixed(1)} %`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return s.includes(";") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(";")
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  delta?: number | null;
  icon: React.ElementType;
  accent: string;
  loading?: boolean;
}) {
  const deltaStr = formatDelta(delta);
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-sm text-zinc-700 font-medium truncate">{label}</p>
          <p className="text-3xl font-bold text-zinc-900 tabular-nums">
            {loading ? (
              <span className="inline-block w-20 h-8 bg-zinc-100 rounded animate-pulse" />
            ) : (
              value
            )}
          </p>
        </div>
        <div
          className="rounded-xl p-3 shrink-0"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon size={22} />
        </div>
      </div>
      {deltaStr && !loading && (
        <div className="flex items-center gap-1 mt-3 text-sm">
          {positive ? (
            <TrendingUp size={14} className="text-[#4caf48]" />
          ) : (
            <TrendingDown size={14} className="text-red-600" />
          )}
          <span className={positive ? "text-[#4caf48] font-medium" : "text-red-600 font-medium"}>
            {deltaStr}
          </span>
          <span className="text-zinc-600">vs Vorperiode</span>
        </div>
      )}
    </div>
  );
}

function Heatmap({ data }: { data: { hour: number; weekday: string; leads: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.leads));
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid grid-cols-[2rem_repeat(24,minmax(1rem,1fr))] gap-0.5">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[10px] text-zinc-600 text-center">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
          {weekdays.map((wd) => (
            <Fragment key={wd}>
              <div className="text-xs text-zinc-700 flex items-center">{wd}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const cell = data.find((d) => d.weekday === wd && d.hour === h);
                const v = cell?.leads || 0;
                const intensity = v / max;
                const bg =
                  v === 0
                    ? "rgb(244 244 245)"
                    : `rgba(76, 175, 72, ${0.15 + intensity * 0.85})`;
                return (
                  <div
                    key={`${wd}-${h}`}
                    title={`${wd} ${h}:00 — ${v} Lead${v === 1 ? "" : "s"}`}
                    className="aspect-square rounded-sm"
                    style={{ background: bg, minHeight: "1rem" }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<DateRange>("dieser-monat");
  const [view, setView] = useState<ViewFilter>("gesamt");
  const [customFrom, setCustomFrom] = useState<string>(monthAgoYmd());
  const [customTo, setCustomTo] = useState<string>(todayYmd());
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (r: DateRange, v: ViewFilter, from?: string, to?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range: r, view: v });
      if (r === "custom") {
        params.set("from", from ?? customFrom);
        params.set("to", to ?? customTo);
      }
      const resp = await fetch(`/api/data?${params}`, { cache: "no-store" });
      const json: ApiResponse = await resp.json();
      if (!json.ok) {
        setError(json.error || "Unbekannter Fehler");
        setData(null);
      } else {
        setData(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (range !== "custom") load(range, view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, view]);

  useEffect(() => {
    if (range === "custom") {
      const t = setTimeout(() => load("custom", view, customFrom, customTo), 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, view, customFrom, customTo]);

  const bySource = useMemo(
    () => (data?.bySource || []).map((s) => ({ ...s, color: colorFor(s.name) })),
    [data]
  );
  const weeklyTrend = data?.weeklyTrend || [];
  const topCampaigns = data?.topCampaigns || [];
  const topAdSets = data?.topAdSets || [];
  const topAds = data?.topAds || [];
  const byWeekday = data?.byWeekday || [];
  const byHour = data?.byHour || [];
  const spendByDay = data?.spendByDay || [];
  const spendTotalAll = data?.spendTotalAll || 0;
  const perf = data?.perfTotals;
  const forecast = data?.forecast;

  const handleCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Marketing Dashboard Export", rangeLabels[range]],
      ["Stand", data.generatedAt || ""],
      [],
      ["KPI", "Wert"],
      ["Leads gesamt", data.totalLeads ?? 0],
      ["Sales", data.salesCount ?? 0],
      ["Sales-Quote", `${((data.salesQuote ?? 0) * 100).toFixed(2)}%`],
      ["Umsatz (€)", (data.umsatz ?? 0).toFixed(2)],
      ["Ad Spend (€)", spendTotalAll.toFixed(2)],
      [],
      ["Quelle", "Leads", "Sales", "Umsatz", "Spend", "CPL", "CPA", "ROAS"],
      ...bySource.map((s) => [
        s.name,
        s.leads,
        s.sales,
        s.umsatz.toFixed(2),
        s.spend?.toFixed(2) ?? "",
        s.cpl?.toFixed(2) ?? "",
        s.cpa?.toFixed(2) ?? "",
        s.roas?.toFixed(2) ?? "",
      ]),
      [],
      ["Kampagne", "Leads", "Sales", "Umsatz", "Sales-Quote"],
      ...topCampaigns.map((c) => [
        c.name,
        c.leads,
        c.sales,
        c.umsatz.toFixed(2),
        `${(c.salesQuote * 100).toFixed(2)}%`,
      ]),
      [],
      ["Ad Set", "Ad Name", "Leads", "Sales", "Umsatz"],
      ...topAds.map((a) => [a.adSet, a.adName, a.leads, a.sales, a.umsatz.toFixed(2)]),
    ];
    downloadCsv(`marketing-${range}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">
              📊 Marketing Dashboard
            </h1>
            <p className="text-zinc-700 text-sm mt-1">
              Live aus dem Tracking Sheet Marketing
              {data?.generatedAt && (
                <span className="ml-2 text-xs text-zinc-600">
                  · {new Date(data.generatedAt).toLocaleString("de-DE")}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-700">
            <Calendar size={16} />
            <span className="hidden sm:inline">{rangeLabels[range]}</span>
            <button
              onClick={() => load(range, view)}
              className="ml-1 p-2 rounded-full bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors"
              title="Neu laden"
              aria-label="Neu laden"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleCsv}
              disabled={!data}
              className="ml-1 px-3 py-2 rounded-full bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors flex items-center gap-1.5 text-xs disabled:opacity-50"
              title="CSV exportieren"
            >
              <Download size={14} />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* View-Tabs */}
        <div className="flex flex-wrap gap-1 mb-4 bg-white p-1.5 rounded-2xl shadow-sm border border-zinc-200 w-fit">
          {(Object.keys(viewLabels) as ViewFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 sm:px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                view === v
                  ? "bg-[#4caf48] text-white shadow-sm"
                  : "bg-transparent text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>

        {/* Range Selector */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(Object.keys(rangeLabels) as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                range === r
                  ? "bg-[#4caf48] text-white shadow-sm"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {range === "custom" && (
          <div className="bg-white rounded-2xl p-4 mb-6 border border-zinc-200 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-zinc-700">Zeitraum:</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-700">von</label>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm bg-[#f5f5f5] focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-700">bis</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayYmd()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm bg-[#f5f5f5] focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-1 ml-auto">
              {[
                { label: "Letzte 7 T", days: 7 },
                { label: "Letzte 14 T", days: 14 },
                { label: "Letzte 30 T", days: 30 },
                { label: "Letzte 90 T", days: 90 },
              ].map((p) => (
                <button
                  key={p.days}
                  onClick={() => {
                    const to = new Date();
                    const from = new Date();
                    from.setDate(to.getDate() - p.days + 1);
                    const fmt = (d: Date) =>
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
                        d.getDate()
                      ).padStart(2, "0")}`;
                    setCustomFrom(fmt(from));
                    setCustomTo(fmt(to));
                  }}
                  className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-xs text-zinc-700 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-900">
            <strong>Fehler beim Laden:</strong> {error}
          </div>
        )}

        {/* Forecast Banner */}
        {forecast && (
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl p-2.5 bg-white text-indigo-600">
                <Target size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-indigo-900">
                  Monats-Hochrechnung · Tag {forecast.daysElapsed} von {forecast.daysInMonth}
                </p>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-indigo-700">Leads (proj.)</p>
                    <p className="text-xl font-bold text-zinc-900 tabular-nums">
                      {forecast.leadsProjected}
                    </p>
                    <p className="text-xs text-zinc-700">aktuell: {forecast.leadsSoFar}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-700">Sales (proj.)</p>
                    <p className="text-xl font-bold text-zinc-900 tabular-nums">
                      {forecast.salesProjected}
                    </p>
                    <p className="text-xs text-zinc-700">aktuell: {forecast.salesSoFar}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-700">Umsatz (proj.)</p>
                    <p className="text-xl font-bold text-zinc-900 tabular-nums">
                      {formatEur(forecast.umsatzProjected)}
                    </p>
                    <p className="text-xs text-zinc-700">aktuell: {formatEur(forecast.umsatzSoFar)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <KpiCard
            label="Leads gesamt"
            value={String(data?.totalLeads ?? 0)}
            delta={data?.delta?.leads}
            icon={Users}
            accent="#3b82f6"
            loading={loading}
          />
          <KpiCard
            label="Davon Sales"
            value={String(data?.salesCount ?? 0)}
            delta={data?.delta?.sales}
            icon={CheckCircle2}
            accent="#4caf48"
            loading={loading}
          />
          <KpiCard
            label="Sales-Quote"
            value={formatPct(data?.salesQuote ?? 0)}
            delta={data?.delta?.salesQuote}
            icon={Percent}
            accent="#f59e0b"
            loading={loading}
          />
          <KpiCard
            label="Umsatz"
            value={formatEur(data?.umsatz ?? 0)}
            delta={data?.delta?.umsatz}
            icon={Euro}
            accent="#ef4444"
            loading={loading}
          />
        </div>

        {/* KPI Row: Ad Spend / CPL / CPA / ROAS — aggregiert aus Daily-Performance Tabs, auf allen Views sichtbar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <KpiCard
            label="Ad Spend"
            value={perf && perf.spend > 0 ? formatEur(perf.spend) : "—"}
            icon={Banknote}
            accent="#8b5cf6"
            loading={loading}
          />
          <KpiCard
            label="CPL"
            value={perf && perf.cpl > 0 ? formatEurPrecise(perf.cpl) : "—"}
            icon={Users}
            accent="#0ea5e9"
            loading={loading}
          />
          <KpiCard
            label="CPA"
            value={perf && perf.cpa > 0 ? formatEur(perf.cpa) : "—"}
            icon={Sparkles}
            accent="#f97316"
            loading={loading}
          />
          <KpiCard
            label="ROAS"
            value={perf && perf.roas > 0 ? `${perf.roas.toFixed(2)}x` : "—"}
            icon={TrendingUp}
            accent={perf && perf.roas >= 3 ? "#4caf48" : perf && perf.roas >= 1 ? "#f59e0b" : "#ef4444"}
            loading={loading}
          />
        </div>

        {/* Trend + Pie Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-zinc-100">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">Leads-Trend (letzte 5 Wochen)</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="week" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e4e4e7",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="#4caf48"
                  strokeWidth={3}
                  dot={{ fill: "#4caf48", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">Quellen-Mix</h2>
            {bySource.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-zinc-600">
                Keine Daten
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={bySource}
                    dataKey="leads"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {bySource.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e4e4e7",
                      borderRadius: 12,
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Ad Spend Chart */}
        {spendByDay.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100 mb-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Ad Spend pro Woche</h2>
            <p className="text-sm text-zinc-700 mb-4">
              Tägliche Ausgaben gesamt · Periode {formatEur(spendTotalAll)}
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={spendByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="day"
                  stroke="#71717a"
                  fontSize={11}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `${v} €`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e4e4e7",
                    borderRadius: 12,
                  }}
                  formatter={(v) => formatEur(Number(v))}
                />
                <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Quellen-Tabelle */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100 mb-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-1">Quellen-Performance</h2>
          <p className="text-sm text-zinc-700 mb-4">Leads · Sales · Sales-Quote · Umsatz</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-900 uppercase border-b border-zinc-300">
                  <th className="py-2 pr-3">Quelle</th>
                  <th className="py-2 px-3 text-right">Leads</th>
                  <th className="py-2 px-3 text-right">Sales</th>
                  <th className="py-2 px-3 text-right">Close-Quote</th>
                  <th className="py-2 pl-3 text-right">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((s) => (
                  <tr key={s.name} className="border-b border-zinc-100 hover:bg-[#f5f5f5]">
                    <td className="py-2.5 pr-3 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span className="font-semibold text-zinc-900">{s.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">{s.leads}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">{s.sales}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">
                      {formatPct(s.leads ? s.sales / s.leads : 0)}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-zinc-900">{formatEur(s.umsatz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOP Kampagne */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={18} className="text-zinc-900" />
            <h2 className="text-base font-bold text-zinc-900">TOP Kampagne</h2>
          </div>
          <p className="text-sm text-zinc-700 mb-4">Sortiert nach Umsatz · Top 8</p>
          {topCampaigns.length === 0 ? (
            <p className="text-sm text-zinc-700">Keine Kampagnen-Daten im Zeitraum</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-zinc-900 uppercase border-b border-zinc-300">
                    <th className="py-2 pr-3">Kampagne</th>
                    <th className="py-2 px-3 text-right">Leads</th>
                    <th className="py-2 px-3 text-right">Sales</th>
                    <th className="py-2 px-3 text-right">Quote</th>
                    <th className="py-2 pl-3 text-right">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((c) => (
                    <tr key={c.name} className="border-b border-zinc-100 hover:bg-[#f5f5f5]">
                      <td className="py-2.5 pr-3 max-w-[24rem]">
                        <span className="font-semibold text-zinc-900 block truncate" title={c.name}>
                          {c.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">{c.leads}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">{c.sales}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">
                        {formatPct(c.salesQuote)}
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-zinc-900">
                        {formatEur(c.umsatz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TOP Anzeigengruppe */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={18} className="text-zinc-900" />
            <h2 className="text-base font-bold text-zinc-900">TOP Anzeigengruppe</h2>
          </div>
          <p className="text-sm text-zinc-700 mb-4">Ad Set / UTM Term · Top 8</p>
          {topAdSets.length === 0 ? (
            <p className="text-sm text-zinc-700">Keine Anzeigengruppen im Zeitraum</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-zinc-900 uppercase border-b border-zinc-300">
                    <th className="py-2 pr-3">Anzeigengruppe</th>
                    <th className="py-2 px-3 text-right">Leads</th>
                    <th className="py-2 px-3 text-right">Sales</th>
                    <th className="py-2 px-3 text-right">Quote</th>
                    <th className="py-2 pl-3 text-right">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  {topAdSets.map((s) => (
                    <tr key={s.name} className="border-b border-zinc-100 hover:bg-[#f5f5f5]">
                      <td className="py-2.5 pr-3 max-w-[28rem]">
                        <span className="font-semibold text-zinc-900 block truncate" title={s.name}>
                          {s.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">{s.leads}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">{s.sales}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">
                        {formatPct(s.salesQuote)}
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-zinc-900">
                        {formatEur(s.umsatz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TOP Werbeanzeige */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-zinc-900" />
            <h2 className="text-base font-bold text-zinc-900">TOP Werbeanzeige</h2>
          </div>
          <p className="text-sm text-zinc-700 mb-4">Ad Name · Top 10</p>
          {topAds.length === 0 ? (
            <p className="text-sm text-zinc-700">Keine Werbeanzeigen im Zeitraum</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-zinc-900 uppercase border-b border-zinc-300">
                    <th className="py-2 pr-3">Werbeanzeige</th>
                    <th className="py-2 px-3">Anzeigengruppe</th>
                    <th className="py-2 px-3 text-right">Leads</th>
                    <th className="py-2 px-3 text-right">Sales</th>
                    <th className="py-2 pl-3 text-right">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  {topAds.map((a, i) => {
                    const hasAdName = a.adName !== "(ohne Ad-Name)";
                    return (
                      <tr key={`${a.adSet}-${a.adName}-${i}`} className="border-b border-zinc-100 hover:bg-[#f5f5f5]">
                        <td className="py-2.5 pr-3 max-w-[24rem]">
                          {hasAdName ? (
                            <span className="font-semibold text-zinc-900 block truncate" title={a.adName}>
                              {a.adName}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic block truncate">
                              kein Ad-Name hinterlegt
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 max-w-[24rem]">
                          <span className="block truncate text-zinc-900" title={a.adSet}>
                            {a.adSet}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">{a.leads}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-zinc-900">{a.sales}</td>
                        <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-zinc-900">
                          {formatEur(a.umsatz)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Weekday + Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Wochentags-Verteilung</h2>
            <p className="text-sm text-zinc-700 mb-4">Wann kommen Leads rein</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byWeekday}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e4e4e7",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="leads" fill="#4caf48" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={18} className="text-zinc-700" />
              <h2 className="text-base font-semibold text-zinc-900">Stunden-Heatmap</h2>
            </div>
            <p className="text-sm text-zinc-700 mb-4">Lead-Aufkommen nach Wochentag × Stunde</p>
            <Heatmap data={byHour} />
          </div>
        </div>

        <div className="text-xs text-zinc-600 text-center pb-4">
          Cache 60 s · Built for Rheinvolt
        </div>
      </div>
    </div>
  );
}

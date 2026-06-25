"use client";

import { useState } from "react";
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
} from "lucide-react";

// Mock-Daten (später aus Google Sheets API)
const sourceData = [
  { name: "facebook", leads: 78, color: "#1877f2" },
  { name: "ig", leads: 92, color: "#e1306c" },
  { name: "google", leads: 41, color: "#4285f4" },
  { name: "website", leads: 28, color: "#10b981" },
];

const weeklyTrend = [
  { week: "KW 21", leads: 42, umsatz: 184000 },
  { week: "KW 22", leads: 58, umsatz: 251000 },
  { week: "KW 23", leads: 49, umsatz: 209000 },
  { week: "KW 24", leads: 67, umsatz: 312000 },
  { week: "KW 25", leads: 71, umsatz: 339500 },
];

const adSpendDaily = [
  { day: "Mo", facebook: 180, google: 120, ig: 95 },
  { day: "Di", facebook: 165, google: 140, ig: 110 },
  { day: "Mi", facebook: 195, google: 125, ig: 88 },
  { day: "Do", facebook: 170, google: 135, ig: 102 },
  { day: "Fr", facebook: 205, google: 155, ig: 120 },
  { day: "Sa", facebook: 125, google: 95, ig: 65 },
  { day: "So", facebook: 110, google: 80, ig: 58 },
];

type DateRange = "diese-woche" | "letzte-woche" | "dieser-monat" | "letzter-monat" | "ytd";

const rangeLabels: Record<DateRange, string> = {
  "diese-woche": "Diese Woche",
  "letzte-woche": "Letzte Woche",
  "dieser-monat": "Dieser Monat",
  "letzter-monat": "Letzter Monat",
  "ytd": "Year-to-Date",
};

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-zinc-900 tabular-nums">{value}</p>
        </div>
        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon size={22} />
        </div>
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1 mt-3 text-sm">
          {delta >= 0 ? (
            <TrendingUp size={16} className="text-emerald-600" />
          ) : (
            <TrendingDown size={16} className="text-red-600" />
          )}
          <span
            className={delta >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
          <span className="text-zinc-400">vs Vorperiode</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<DateRange>("dieser-monat");

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">📊 Marketing Dashboard</h1>
            <p className="text-zinc-500 mt-1">Live-Übersicht eurer Leads, Quellen und Performance</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Calendar size={16} />
            <span>{rangeLabels[range]}</span>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-wrap gap-2 mb-8">
          {(Object.keys(rangeLabels) as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                range === r
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Leads gesamt" value="239" delta={12.3} icon={Users} accent="#3b82f6" />
          <KpiCard label="Davon Close" value="27" delta={8.1} icon={CheckCircle2} accent="#10b981" />
          <KpiCard label="Close-Quote" value="11,34 %" delta={-1.2} icon={Percent} accent="#f59e0b" />
          <KpiCard label="Umsatz" value={formatEur(1295293)} delta={18.5} icon={Euro} accent="#ef4444" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Lead-Trend */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Leads-Trend (letzte 5 Wochen)</h2>
            <ResponsiveContainer width="100%" height={260}>
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
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: "#10b981", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quellen-Donut */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Quellen-Mix</h2>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={sourceData}
                  dataKey="leads"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {sourceData.map((entry) => (
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
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Ad Spend pro Tag */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
            <h2 className="text-lg font-semibold text-zinc-900 mb-1">Ad Spend pro Tag</h2>
            <p className="text-sm text-zinc-500 mb-4">Tägliche Ausgaben nach Plattform (€)</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={adSpendDaily}>
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
                <Legend />
                <Bar dataKey="facebook" fill="#1877f2" radius={[6, 6, 0, 0]} />
                <Bar dataKey="google" fill="#4285f4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="ig" fill="#e1306c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cross-Sell */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
            <h2 className="text-lg font-semibold text-zinc-900 mb-1">Cross-Sell</h2>
            <p className="text-sm text-zinc-500 mb-6">Kunden mit PV + Wärmepumpe</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50">
                <div>
                  <p className="text-sm text-zinc-500">Nur PV</p>
                  <p className="text-2xl font-bold text-zinc-900">19</p>
                </div>
                <div className="text-3xl">☀️</div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50">
                <div>
                  <p className="text-sm text-zinc-500">Nur WP</p>
                  <p className="text-2xl font-bold text-zinc-900">5</p>
                </div>
                <div className="text-3xl">🔥</div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50 border-2 border-violet-200">
                <div>
                  <p className="text-sm text-zinc-500">PV + WP</p>
                  <p className="text-2xl font-bold text-zinc-900">3</p>
                </div>
                <div className="text-3xl">✨</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Hinweis */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          ⚠️ <strong>Mockup-Daten</strong> — Sobald Google Sheets API verbunden, fließen die echten Zahlen aus
          dem Tracking Sheet Marketing live ein.
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, Euro, Target, Clock, RefreshCw, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";

type Project = {
  id: string; name: string; stage: string;
  kanbanBoardId?: string; kanbanColumnId?: string;
  columnName: string; boardNameStr: string;
  vertriebler: string; vertrieblerId?: string;
  region: "Nord" | "Mitte" | "Süd" | "Unbekannt";
  plz?: string; city?: string;
  leadSource: string;
  tags: string[];
  product: "WP" | "PV" | "Sonstige";
  requestCreatedAt?: string; offerCreatedAt?: string; installationCreatedAt?: string; updatedAt?: string;
  dealState?: string; dealDecidedAt?: string; lostReason?: string;
  nettowert: number;
  customer: string;
};

type FunnelGroup = {
  key: string;
  label: string;
  names: string[];
  color: string;
  kind: "Termin" | "Angebot" | "Nachfassen" | "Auftrag" | "Absage" | "Sonstige";
};

type ApiData = {
  client: { slug: string; label: string };
  clients: { slug: string; label: string }[];
  funnelGroups: FunnelGroup[];
  projects: Project[];
  users: { id: string; name: string; email: string }[];
  leadSources: string[];
  boards: any[];
  tasksByUser: Record<string, { total: number; open: number; done: number }>;
  tasksTotal: number;
  generatedAt: string;
};

type View = "A" | "B" | "C";
type Region = "alle" | "Nord" | "Mitte" | "Süd";

const REGION_COLORS: Record<string, string> = { Nord: "#3b82f6", Mitte: "#10b981", "Süd": "#f59e0b", Unbekannt: "#9ca3af" };
const PRODUCT_COLORS: Record<string, string> = { WP: "#ef4444", PV: "#eab308", Sonstige: "#6b7280" };

// FUNNEL_GROUPS wird jetzt pro-Client aus der API geliefert (lib/clients.ts).
function makeGroupFor(groups: FunnelGroup[]) {
  const byCol: Record<string, FunnelGroup> = {};
  for (const g of groups) for (const n of g.names) byCol[n] = g;
  return (col: string): FunnelGroup | undefined => byCol[col];
}

function daysBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function fmtEUR(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<View>("A");
  const [region, setRegion] = useState<Region>("alle");
  const [vertriebler, setVertriebler] = useState<string>("alle");
  const [produkt, setProdukt] = useState<string>("alle");
  const [client, setClient] = useState<string>("homeserve");
  const [drilldown, setDrilldown] = useState<{ title: string; projects: Project[] } | null>(null);

  const load = (slug: string = client) => {
    setLoading(true);
    setErr(null);
    fetch(`/api/reonic?client=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else {
          setData(d);
          // Filter zurücksetzen, weil Vertriebler-Optionen kundenabhängig sind
          setVertriebler("alle");
        }
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(client); }, [client]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.projects.filter(
      (p) =>
        (region === "alle" || p.region === region) &&
        (vertriebler === "alle" || p.vertriebler === vertriebler) &&
        (produkt === "alle" || p.product === produkt),
    );
  }, [data, region, vertriebler, produkt]);

  const groupFor = useMemo(() => makeGroupFor(data?.funnelGroups || []), [data]);
  const funnelGroups = data?.funnelGroups || [];

  const kpis = useMemo(() => {
    const isAbschluss = (p: Project) => p.dealState === "Won" || p.stage === "installation" || groupFor(p.columnName)?.kind === "Auftrag";
    const isAbsage = (p: Project) => p.dealState === "Lost" || groupFor(p.columnName)?.kind === "Absage";
    const won = filtered.filter(isAbschluss);
    const lost = filtered.filter(isAbsage);
    const open = filtered.filter((p) => !isAbschluss(p) && !isAbsage(p));
    const nettoWon = won.reduce((s, p) => s + (p.nettowert || 0), 0);
    const abschluss = won.length + lost.length ? won.length / (won.length + lost.length) : 0;
    const offeneAngebote = filtered.filter((p) => p.stage === "offer" && !isAbschluss(p) && !isAbsage(p));
    return {
      total: filtered.length, won: won.length, lost: lost.length, open: open.length,
      nettoWon, abschluss, offeneAngebote: offeneAngebote.length,
      wonList: won, lostList: lost, openList: open, offeneAngeboteList: offeneAngebote, totalList: filtered,
    };
  }, [filtered, groupFor]);

  const funnelData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of funnelGroups) counts[g.key] = 0;
    for (const p of filtered) {
      if (p.stage !== "offer") continue;
      const g = groupFor(p.columnName);
      if (g) counts[g.key] = (counts[g.key] || 0) + 1;
    }
    return funnelGroups.map((g) => ({ name: g.label, count: counts[g.key] || 0, color: g.color }));
  }, [filtered, funnelGroups, groupFor]);

  const regionCount = useMemo(() => {
    const m: Record<string, number> = { Nord: 0, Mitte: 0, "Süd": 0, Unbekannt: 0 };
    for (const p of filtered) m[p.region] = (m[p.region] || 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const productCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of filtered) m[p.product] = (m[p.product] || 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const leadSourceCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of filtered) m[p.leadSource] = (m[p.leadSource] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const vertrieblerRank = useMemo(() => {
    const m: Record<string, { name: string; abschluesse: number; umsatz: number; termine: number }> = {};
    for (const p of filtered) {
      const k = p.vertriebler;
      if (!m[k]) m[k] = { name: k, abschluesse: 0, umsatz: 0, termine: 0 };
      const grp = groupFor(p.columnName);
      const isAbschluss = p.dealState === "Won" || p.stage === "installation" || grp?.kind === "Auftrag";
      if (isAbschluss) { m[k].abschluesse++; m[k].umsatz += p.nettowert || 0; }
      if (grp?.kind === "Termin") m[k].termine++;
    }
    return Object.values(m).sort((a, b) => b.umsatz - a.umsatz);
  }, [filtered, groupFor]);

  // Alters-Staffel offene Angebote
  const offenAlter = useMemo(() => {
    const buckets = { "0-14": 0, "15-30": 0, "31-60": 0, "60+": 0 };
    const heute = Date.now();
    for (const p of filtered) {
      if (p.stage !== "offer" || p.dealState === "Won" || p.dealState === "Lost") continue;
      if (!p.offerCreatedAt) continue;
      const age = Math.round((heute - new Date(p.offerCreatedAt).getTime()) / 86400000);
      if (age <= 14) buckets["0-14"]++;
      else if (age <= 30) buckets["15-30"]++;
      else if (age <= 60) buckets["31-60"]++;
      else buckets["60+"]++;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const vertrieblerOptions = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.projects.map((p) => p.vertriebler))).sort();
  }, [data]);

  if (loading) return <div className="p-8 text-neutral-600">Lädt Reonic-Daten…</div>;
  if (err) return <div className="p-8 text-red-600">Fehler: {err}</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{data.client.label} Vertriebs-Dashboard</h1>
            <p className="text-xs text-neutral-500">Reonic · {data.projects.length} Projekte · Stand {new Date(data.generatedAt).toLocaleString("de-DE")}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="border border-neutral-300 rounded px-3 py-1.5 text-sm bg-white font-medium"
              title="Kunde wechseln"
            >
              {data.clients.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
            <div className="flex bg-neutral-100 rounded-lg p-1">
              {(["A", "B", "C"] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-sm rounded ${view === v ? "bg-white shadow" : "text-neutral-600"}`}>
                  {v === "A" ? "Geschäftsleitung" : v === "B" ? "Sales Performance" : "Vertriebler"}
                </button>
              ))}
            </div>
            <button onClick={() => load()} className="p-2 text-neutral-600 hover:bg-neutral-100 rounded"><RefreshCw size={16} /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <Select label="Region" value={region} onChange={(v) => setRegion(v as Region)} options={[["alle", "Alle"], ["Nord", "Nord"], ["Mitte", "Mitte"], ["Süd", "Süd"]]} />
          <Select label="Vertriebler" value={vertriebler} onChange={setVertriebler} options={[["alle", "Alle"], ...vertrieblerOptions.map((v) => [v, v] as [string, string])]} />
          <Select label="Produkt" value={produkt} onChange={setProdukt} options={[["alle", "Alle"], ["WP", "Wärmepumpe"], ["PV", "Photovoltaik"], ["Sonstige", "Sonstige"]]} />
        </div>
      </header>

      <main className="p-6 space-y-6">
        {view === "A" && <ViewA kpis={kpis} regionCount={regionCount} productCount={productCount} vertrieblerRank={vertrieblerRank} leadSources={leadSourceCount} onDrilldown={setDrilldown} />}
        {view === "B" && <ViewB filtered={filtered} funnelData={funnelData} offenAlter={offenAlter} vertrieblerRank={vertrieblerRank} />}
        {view === "C" && <ViewC filtered={filtered} vertriebler={vertriebler} groupFor={groupFor} />}
      </main>
      {drilldown && <DrilldownModal title={drilldown.title} projects={drilldown.projects} onClose={() => setDrilldown(null)} />}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="text-sm text-neutral-700 flex items-center gap-2">
      <span className="text-neutral-500">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-neutral-300 rounded px-2 py-1 bg-white">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function KPI({ icon, label, value, sub, onClick }: { icon: React.ReactNode; label: string; value: string; sub?: string; onClick?: () => void }) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-neutral-200 p-4 flex-1 min-w-[160px] ${clickable ? "cursor-pointer hover:border-neutral-400 hover:shadow-sm transition" : ""}`}
    >
      <div className="flex items-center gap-2 text-neutral-500 text-xs">{icon}<span>{label}</span></div>
      <div className="text-2xl font-bold text-neutral-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function DrilldownModal({ title, projects, onClose }: { title: string; projects: Project[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h3 className="text-lg font-semibold">{title} · {projects.length}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-neutral-500 sticky top-0 bg-white border-b border-neutral-200">
              <tr>
                <th className="text-left p-3">Kunde</th>
                <th className="text-left p-3">PLZ / Ort</th>
                <th className="text-left p-3">Vertriebler</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Produkt</th>
                <th className="text-right p-3">Netto</th>
                <th className="text-left p-3">Aktualisiert</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-neutral-500">Keine Projekte</td></tr>
              )}
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="p-3 font-medium">{p.customer || p.name}</td>
                  <td className="p-3 text-neutral-600">{[p.plz, p.city].filter(Boolean).join(" ")}</td>
                  <td className="p-3">{p.vertriebler}</td>
                  <td className="p-3 text-neutral-600">{p.columnName}</td>
                  <td className="p-3">{p.product}</td>
                  <td className="p-3 text-right">{p.nettowert ? fmtEUR(p.nettowert) : "–"}</td>
                  <td className="p-3 text-neutral-500 text-xs">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("de-DE") : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-neutral-200 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-neutral-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ViewA({ kpis, regionCount, productCount, vertrieblerRank, leadSources, onDrilldown }: any) {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <KPI icon={<Euro size={14} />} label="Netto verkauft" value={fmtEUR(kpis.nettoWon)} sub={`${kpis.won} Abschlüsse`} onClick={() => onDrilldown({ title: "Abschlüsse", projects: kpis.wonList })} />
        <KPI icon={<CheckCircle2 size={14} />} label="Abschlussquote" value={`${(kpis.abschluss * 100).toFixed(0)}%`} sub={`${kpis.won} von ${kpis.won + kpis.lost}`} onClick={() => onDrilldown({ title: "Absagen", projects: kpis.lostList })} />
        <KPI icon={<Target size={14} />} label="Offene Angebote" value={String(kpis.offeneAngebote)} onClick={() => onDrilldown({ title: "Offene Angebote", projects: kpis.offeneAngeboteList })} />
        <KPI icon={<Users size={14} />} label="Gesamt-Projekte" value={String(kpis.total)} sub={`${kpis.open} offen`} onClick={() => onDrilldown({ title: "Alle Projekte", projects: kpis.totalList })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Region-Verteilung">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={regionCount} dataKey="value" nameKey="name" outerRadius={80} label>
                {regionCount.map((e: any) => <Cell key={e.name} fill={REGION_COLORS[e.name]} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Produkt-Verteilung">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={productCount} dataKey="value" nameKey="name" outerRadius={80} label>
                {productCount.map((e: any) => <Cell key={e.name} fill={PRODUCT_COLORS[e.name] || "#9ca3af"} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Lead-Quellen">
          <div className="space-y-1 max-h-56 overflow-auto">
            {leadSources.map((s: any) => (
              <div key={s.name} className="flex justify-between text-sm">
                <span className="text-neutral-600">{s.name}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Rangliste Vertriebler">
        <table className="w-full text-sm">
          <thead className="text-neutral-500 text-xs uppercase">
            <tr className="border-b border-neutral-200">
              <th className="text-left py-2">Vertriebler</th>
              <th className="text-right">Abschlüsse</th>
              <th className="text-right">Umsatz netto</th>
              <th className="text-right">Termine (SC1+SC2)</th>
            </tr>
          </thead>
          <tbody>
            {vertrieblerRank.map((v: any) => (
              <tr key={v.name} className="border-b border-neutral-100">
                <td className="py-2">{v.name}</td>
                <td className="text-right font-semibold">{v.abschluesse}</td>
                <td className="text-right">{fmtEUR(v.umsatz)}</td>
                <td className="text-right">{v.termine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function ViewB({ filtered, funnelData, offenAlter, vertrieblerRank }: any) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Funnel-Bestand (Vertriebsprozess HomeServe)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count">
                {funnelData.map((e: any) => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Offene Angebote – Alter">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={offenAlter}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Termine je Vertriebler (SC1 + SC2 + Video)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={vertrieblerRank} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={140} fontSize={11} />
            <Tooltip />
            <Bar dataKey="termine" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-neutral-500 mt-2">Ziel: 10 Termine/Woche pro Vertriebler (aktuell aggregiert über Zeitraum)</p>
      </Card>

      <Card title="Alle Projekte">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-xs uppercase bg-neutral-50">
              <tr>
                <th className="text-left p-2">Kunde</th>
                <th className="text-left">Region</th>
                <th className="text-left">Vertriebler</th>
                <th className="text-left">Stage / Column</th>
                <th className="text-left">Lead-Quelle</th>
                <th className="text-right">Nettowert</th>
                <th className="text-left">Deal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((p: Project) => (
                <tr key={p.id} className="border-t border-neutral-100">
                  <td className="p-2">{p.customer}</td>
                  <td>{p.region}</td>
                  <td>{p.vertriebler}</td>
                  <td className="text-neutral-600">{p.stage} / {p.columnName}</td>
                  <td className="text-neutral-600">{p.leadSource}</td>
                  <td className="text-right">{fmtEUR(p.nettowert)}</td>
                  <td className={p.dealState === "Won" ? "text-emerald-600 font-semibold" : p.dealState === "Lost" ? "text-red-500" : "text-neutral-500"}>{p.dealState || "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function ViewC({ filtered, vertriebler, groupFor }: { filtered: Project[]; vertriebler: string; groupFor: (col: string) => FunnelGroup | undefined }) {
  const heute = Date.now();
  const offen = filtered.filter((p) => p.stage === "offer" && p.dealState !== "Won" && p.dealState !== "Lost");
  const alt = offen.filter((p) => p.offerCreatedAt && (heute - new Date(p.offerCreatedAt).getTime()) / 86400000 > 14);
  const monatWon = filtered.filter((p) => p.dealState === "Won" && p.dealDecidedAt && new Date(p.dealDecidedAt).getMonth() === new Date().getMonth());
  const monatSC2 = filtered.filter((p) => groupFor(p.columnName)?.kind === "Termin");
  const sc2Quote = filtered.length ? monatSC2.length / filtered.filter((p) => p.stage === "offer").length : 0;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <KPI icon={<CheckCircle2 size={14} />} label="Eigene Abschlüsse (Monat)" value={String(monatWon.length)} />
        <KPI icon={<Target size={14} />} label="SC2-Quote" value={`${(sc2Quote * 100).toFixed(0)}%`} sub={`${monatSC2.length} in SC2`} />
        <KPI icon={<AlertTriangle size={14} />} label="Angebote > 14 Tage" value={String(alt.length)} sub="ohne Kontakt" />
        <KPI icon={<Clock size={14} />} label="Offene Angebote" value={String(offen.length)} />
      </div>

      <Card title="Angebote älter als 14 Tage – dringende Nachfass-Liste">
        <table className="w-full text-sm">
          <thead className="text-neutral-500 text-xs uppercase">
            <tr className="border-b border-neutral-200">
              <th className="text-left py-2">Kunde</th>
              <th className="text-left">PLZ / Ort</th>
              <th className="text-left">Vertriebler</th>
              <th className="text-right">Alter</th>
              <th className="text-right">Nettowert</th>
            </tr>
          </thead>
          <tbody>
            {alt.map((p) => {
              const age = Math.round((heute - new Date(p.offerCreatedAt!).getTime()) / 86400000);
              return (
                <tr key={p.id} className="border-b border-neutral-100">
                  <td className="py-2">{p.customer}</td>
                  <td>{p.plz} {p.city}</td>
                  <td>{p.vertriebler}</td>
                  <td className={`text-right font-semibold ${age > 30 ? "text-red-600" : "text-orange-600"}`}>{age} Tage</td>
                  <td className="text-right">{fmtEUR(p.nettowert)}</td>
                </tr>
              );
            })}
            {alt.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-neutral-400">Keine überfälligen Angebote</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}

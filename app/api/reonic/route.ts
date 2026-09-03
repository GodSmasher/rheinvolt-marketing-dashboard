import { NextResponse } from "next/server";

const KEY = process.env.REONIC_API_KEY!;
const BASE = "https://api.reonic.de/rest/v3";

async function rfetch(path: string) {
  const r = await fetch(BASE + path, {
    headers: { "X-Authorization": KEY, "Reonic-Cache-Control": "no-cache" },
    next: { revalidate: 300 },
  });
  if (!r.ok) throw new Error(`Reonic ${r.status} on ${path}`);
  return r.json();
}

async function listAll(base: string) {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const d = await rfetch(`${base}${base.includes("?") ? "&" : "?"}page=${page}`);
    all.push(...(d.data || []));
    if (!d.pagination?.next) break;
    page++;
    if (page > 200) break;
  }
  return all;
}

// PLZ → Region (Nord/Mitte/Süd) grober Split (kann pro Kunde justiert werden)
function regionFromPLZ(plz: string | undefined): "Nord" | "Mitte" | "Süd" | "Unbekannt" {
  if (!plz) return "Unbekannt";
  const p = parseInt(plz.substring(0, 2), 10);
  if (isNaN(p)) return "Unbekannt";
  if (p >= 20 && p <= 31) return "Nord";      // HH, Bremen, Nds, S-H
  if (p >= 1 && p <= 19) return "Nord";       // Berlin/BB/MV/S-H
  if (p >= 32 && p <= 59) return "Mitte";     // NRW/Hessen
  if (p >= 60 && p <= 69) return "Mitte";     // Rhein-Main
  if (p >= 70 && p <= 99) return "Süd";       // BW/Bayern/Sachsen/Thüringen
  return "Unbekannt";
}

function productFromProject(p: any): "WP" | "PV" | "Sonstige" {
  const tagIds: string[] = p.tagIds || [];
  // Tags aus HomeServe-Reonic: WP Professor, W 360 → WP-Kontext
  // Verlässlicher: primaryOfferVariant components — braucht Detail-Call
  const name = (p.name || "").toLowerCase();
  if (name.includes("wp") || name.includes("wärmep") || name.includes("waermep")) return "WP";
  if (name.includes("pv") || name.includes("solar") || name.includes("photov")) return "PV";
  // Default WP für HomeServe (Wärmepumpen-Fokus)
  return "WP";
}

// Column-Groups für Funnelstufen (Kanban "Vertriebsprozess HomeServe" residential offer)
const COLUMN_STAGE: Record<string, string> = {
  // Offer-Board Columns (Namen — IDs werden dynamisch gemappt)
};
const STAGE_ORDER = ["Terminiert SC1", "Terminiert Vid", "Angebotserstellung", "Rücksprache mit Projektleiter", "Angebotsbesprechung SC2 beim Kunden", "Angebotsbesprechung SC2  im Haus", "Nachfassen", "Auftrag versendet", "Beauftragt", "AB verschickt", "BzA verschickt", "Absage"];

export async function GET() {
  try {
    const [projects, boards, users, leadSources, tags] = await Promise.all([
      listAll("/residentialProjects"),
      rfetch("/kanbanBoards").then((d) => d.data),
      rfetch("/users").then((d) => d.data),
      rfetch("/leadSources").then((d) => d.data),
      rfetch("/tags").then((d) => d.data),
    ]);

    // Column-ID → Name map
    const colName: Record<string, string> = {};
    const boardName: Record<string, string> = {};
    for (const b of boards) {
      boardName[b.id] = b.name;
      for (const c of b.columns || []) colName[c.id] = c.name;
    }
    const userName: Record<string, string> = {};
    for (const u of users) userName[u.id] = u.fullName || u.email;
    const leadSourceName: Record<string, string> = {};
    for (const l of leadSources) leadSourceName[l.id] = l.name;
    const tagName: Record<string, string> = {};
    for (const t of tags) tagName[t.id] = t.label;

    // Projekt anreichern
    const enriched = projects.map((p) => ({
      id: p.id,
      name: p.name,
      stage: p.stage,
      kanbanBoardId: p.kanbanBoardId,
      kanbanColumnId: p.kanbanColumnId,
      columnName: colName[p.kanbanColumnId] || "?",
      boardNameStr: boardName[p.kanbanBoardId] || "?",
      vertriebler: userName[p.keyAccountManagerId] || "Unzugeordnet",
      vertrieblerId: p.keyAccountManagerId,
      region: regionFromPLZ(p.address?.postcode),
      plz: p.address?.postcode,
      city: p.address?.city,
      leadSource: leadSourceName[p.leadSourceId] || "Unbekannt",
      tags: (p.tagIds || []).map((t: string) => tagName[t]).filter(Boolean),
      product: productFromProject(p),
      requestCreatedAt: p.requestCreatedAt,
      offerCreatedAt: p.offerCreatedAt,
      installationCreatedAt: p.installationCreatedAt,
      updatedAt: p.updatedAt,
      dealState: p.deal?.state, // Open / Won / Lost
      dealDecidedAt: p.deal?.decidedAt,
      lostReason: p.deal?.lostReason,
      nettowert: p.primaryOfferVariant?.componentsTotalPrice || 0,
      customer: p.customerContact?.fullName || p.name,
    }));

    return NextResponse.json({
      projects: enriched,
      users: users.map((u: any) => ({ id: u.id, name: u.fullName, email: u.email })),
      leadSources: leadSources.map((l: any) => l.name),
      boards: boards.map((b: any) => ({ id: b.id, name: b.name, stage: b.projectStage, domain: b.projectDomain, columns: (b.columns || []).map((c: any) => ({ id: c.id, name: c.name, archived: !!c.archivedAt })) })),
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Registry aller Reonic-Kunden für dieses Dashboard.
// Jeder Kunde hat einen eigenen API-Key + Client-ID + eigenes Column-Mapping.
// KEYS NIE mixen — ein Key = ein Reonic-Client.

export type FunnelGroup = {
  key: string;       // Kurzname für Chart/Legende
  label: string;     // Menschlich lesbar
  names: string[];   // Kanban-Column-Namen die zu dieser Gruppe zählen
  color: string;     // Chart-Farbe
  kind: "Termin" | "Angebot" | "Nachfassen" | "Auftrag" | "Absage" | "Sonstige";
};

export type ClientDef = {
  slug: string;
  label: string;
  keyEnv: string;
  clientId: string;
  funnelGroups: FunnelGroup[];
};

const HOMESERVE_FUNNEL: FunnelGroup[] = [
  { key: "SC1",         label: "Termin SC1",        names: ["Terminiert SC1"],                                                                       color: "#93c5fd", kind: "Termin" },
  { key: "Vid",         label: "Video-Termin",      names: ["Terminiert Vid"],                                                                       color: "#60a5fa", kind: "Termin" },
  { key: "Angebot",     label: "Angebot",           names: ["Angebotserstellung", "Rücksprache mit Projektleiter"],                                  color: "#3b82f6", kind: "Angebot" },
  { key: "SC2",         label: "Termin SC2",        names: ["Angebotsbesprechung SC2 beim Kunden", "Angebotsbesprechung SC2  im Haus"],              color: "#1d4ed8", kind: "Termin" },
  { key: "Nachfassen",  label: "Nachfassen",        names: ["Nachfassen"],                                                                           color: "#f59e0b", kind: "Nachfassen" },
  { key: "Auftrag",     label: "Auftrag",           names: ["Auftrag versendet", "Beauftragt", "AB verschickt", "BzA verschickt"],                   color: "#10b981", kind: "Auftrag" },
  { key: "Absage",      label: "Absage",            names: ["Absage"],                                                                               color: "#dc2626", kind: "Absage" },
];

// Egly — basierend auf sichtbaren Column-Namen im Angebot-Kanban.
// Falls Column-Namen ergänzt/umbenannt werden, hier nachziehen.
const EGLY_FUNNEL: FunnelGroup[] = [
  { key: "TerminVor",   label: "Vor-Ort Termin",    names: ["vor Ort Termin vereinbart", "vor Ort Termin abgeschlossen"],                            color: "#93c5fd", kind: "Termin" },
  { key: "Angebot",     label: "Angebot",           names: ["Angebotserstellung + Wärme 360", "Angebot versendet"],                                  color: "#3b82f6", kind: "Angebot" },
  { key: "SC2",         label: "Zweitgespräch",     names: ["Zweitgespräch (SC2)"],                                                                  color: "#1d4ed8", kind: "Termin" },
  { key: "Nachfassen",  label: "Rückfragen/Hold",   names: ["Rückfragen + evtl. Angebotsanpassung", "Angebot on-hold (manuell Wiedervorlagedatum einfügen)"], color: "#f59e0b", kind: "Nachfassen" },
  { key: "Auftrag",     label: "Auftrag",           names: [
      "Auftrag erhalten (unterschriebenes Angebot vom Kunden)",
      "AB verschickt",
      "BzA verschickt",
      "Zuwendungsbescheid (KFW) liegt vor",
      "Anzahlung über Buchhaltung beauftragt",
      "Projektübergabe (Vertrieb an PL)",
      "Auftrag an PL übergeben",
    ], color: "#10b981", kind: "Auftrag" },
  { key: "Absage",      label: "Absage",            names: ["Angebot abgelehnt"],                                                                    color: "#dc2626", kind: "Absage" },
];

export const CLIENTS: ClientDef[] = [
  {
    slug: "homeserve",
    label: "HomeServe",
    keyEnv: "REONIC_API_KEY",
    clientId: "ea6d4f18-63fd-46cb-805f-c7824c114361",
    funnelGroups: HOMESERVE_FUNNEL,
  },
  {
    slug: "egly",
    label: "Egly Klima- & Wärmetechnik",
    keyEnv: "REONIC_API_KEY_EGLY",
    clientId: "8c34bfec-2744-413d-be00-8b7064a7c4c8",
    funnelGroups: EGLY_FUNNEL,
  },
];

export const DEFAULT_CLIENT = CLIENTS[0].slug;

export function findClient(slug: string | null | undefined): ClientDef {
  return CLIENTS.find((c) => c.slug === slug) || CLIENTS[0];
}

export function keyFor(client: ClientDef): string {
  const k = process.env[client.keyEnv];
  if (!k) throw new Error(`Env-Variable ${client.keyEnv} fehlt für Client ${client.slug}`);
  return k;
}

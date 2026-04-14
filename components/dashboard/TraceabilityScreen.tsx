"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { ERP_DATA_EVENT } from "@/lib/app-events";
import { getSectionById, type DashboardSection } from "@/lib/dashboard-sections";
import {
  formatDateTime,
  formatUnits,
  getMovementStatusLabel,
  getMovementTypeLabel,
  loadLocations,
  loadMovements,
  normalizeText,
  type LocationItem,
  type MovementItem,
} from "@/lib/inventory";
import { type DocumentItem, type LotItem, type QualityEventItem } from "@/lib/operations-data";
import { loadDocuments, loadLots, loadQualityEvents } from "@/lib/operations-store";

const COPY = {
  "pt-BR": {
    eyebrow: "Fluxy",
    searchLabel: "Buscar lote, produto ou localizacao",
    searchPlaceholder: "Ex.: PFM260327, Quality Hold ou PremieR Formula",
    trackedLots: "Lotes rastreados",
    trackedLotsHelper: "Base pronta para consulta de origem, destino e situacao operacional.",
    lotsUnderReview: "Em acompanhamento",
    lotsUnderReviewHelper: "Lotes retidos ou em analise que exigem rastreio imediato.",
    qualityEvents: "Eventos de qualidade",
    qualityEventsHelper: "Ocorrencias vinculadas aos lotes monitorados.",
    evidence: "Evidencias",
    evidenceHelper: "Documentos de apoio ligados a laudos, transferencias e liberacoes.",
    currentLot: "Lote selecionado",
    currentLocation: "Localizacao atual",
    availableQuantity: "Volume rastreado",
    expiration: "Validade",
    linkedFlow: "Fluxo vinculado",
    latestMovement: "Ultima movimentacao",
    noLots: "Nenhum lote encontrado para esse filtro.",
    noMovement: "Nenhuma movimentacao relacionada encontrada para este lote.",
    noQualityEvents: "Nenhum evento de qualidade vinculado a este lote.",
    noDocuments: "Nenhum documento vinculado a este lote.",
    movementTimeline: "Linha do tempo operacional",
    movementTimelineHelper: "Entradas, transferencias e ocorrencias relacionadas ao lote selecionado.",
    qualityPanel: "Qualidade",
    qualityPanelHelper: "Eventos e pareceres que impactam a rastreabilidade.",
    documentsPanel: "Documentos",
    documentsPanelHelper: "Laudos, comprovantes e evidencias ligadas ao lote.",
    unknownLocation: "Localizacao nao informada",
    inboundTo: "Entrada em",
    outboundFrom: "Saida de",
    lotStatus: {
      Liberado: "Liberado",
      "Em análise": "Em analise",
      Retido: "Retido",
    },
    qualityStatus: {
      Liberado: "Liberado",
      "Em análise": "Em analise",
      Desvio: "Desvio",
    },
  },
  "en-US": {
    eyebrow: "Fluxy",
    searchLabel: "Search lot, product or location",
    searchPlaceholder: "Ex.: PFM260327, Quality Hold or PremieR Formula",
    trackedLots: "Tracked lots",
    trackedLotsHelper: "Base ready to review origin, destination and operational status.",
    lotsUnderReview: "Under review",
    lotsUnderReviewHelper: "Retained or under-analysis lots requiring immediate follow-up.",
    qualityEvents: "Quality events",
    qualityEventsHelper: "Occurrences linked to the monitored lots.",
    evidence: "Evidence",
    evidenceHelper: "Support documents linked to reports, transfers and releases.",
    currentLot: "Selected lot",
    currentLocation: "Current location",
    availableQuantity: "Tracked volume",
    expiration: "Expiration",
    linkedFlow: "Linked flow",
    latestMovement: "Latest movement",
    noLots: "No lots found for this filter.",
    noMovement: "No related movements found for this lot.",
    noQualityEvents: "No quality events linked to this lot.",
    noDocuments: "No documents linked to this lot.",
    movementTimeline: "Operational timeline",
    movementTimelineHelper: "Inbound, transfers and occurrences related to the selected lot.",
    qualityPanel: "Quality",
    qualityPanelHelper: "Events and decisions that impact traceability.",
    documentsPanel: "Documents",
    documentsPanelHelper: "Reports, receipts and evidence linked to the lot.",
    unknownLocation: "Location not informed",
    inboundTo: "Inbound to",
    outboundFrom: "Outbound from",
    lotStatus: {
      Liberado: "Released",
      "Em análise": "Under review",
      Retido: "Held",
    },
    qualityStatus: {
      Liberado: "Released",
      "Em análise": "Under review",
      Desvio: "Deviation",
    },
  },
  "es-ES": {
    eyebrow: "Fluxy",
    searchLabel: "Buscar lote, producto o ubicacion",
    searchPlaceholder: "Ej.: PFM260327, Quality Hold o PremieR Formula",
    trackedLots: "Lotes rastreados",
    trackedLotsHelper: "Base lista para consultar origen, destino y estado operativo.",
    lotsUnderReview: "En seguimiento",
    lotsUnderReviewHelper: "Lotes retenidos o en analisis que exigen seguimiento inmediato.",
    qualityEvents: "Eventos de calidad",
    qualityEventsHelper: "Ocurrencias vinculadas a los lotes monitoreados.",
    evidence: "Evidencias",
    evidenceHelper: "Documentos de apoyo ligados a informes, transferencias y liberaciones.",
    currentLot: "Lote seleccionado",
    currentLocation: "Ubicacion actual",
    availableQuantity: "Volumen rastreado",
    expiration: "Vencimiento",
    linkedFlow: "Flujo vinculado",
    latestMovement: "Ultimo movimiento",
    noLots: "No se encontraron lotes para este filtro.",
    noMovement: "No se encontraron movimientos relacionados con este lote.",
    noQualityEvents: "No hay eventos de calidad vinculados a este lote.",
    noDocuments: "No hay documentos vinculados a este lote.",
    movementTimeline: "Linea de tiempo operativa",
    movementTimelineHelper: "Entradas, transferencias y ocurrencias relacionadas con el lote seleccionado.",
    qualityPanel: "Calidad",
    qualityPanelHelper: "Eventos y decisiones que impactan la trazabilidad.",
    documentsPanel: "Documentos",
    documentsPanelHelper: "Informes, comprobantes y evidencias ligadas al lote.",
    unknownLocation: "Ubicacion no informada",
    inboundTo: "Entrada en",
    outboundFrom: "Salida de",
    lotStatus: {
      Liberado: "Liberado",
      "Em análise": "En analisis",
      Retido: "Retenido",
    },
    qualityStatus: {
      Liberado: "Liberado",
      "Em análise": "En analisis",
      Desvio: "Desvio",
    },
  },
} as const;

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm transition-colors">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold text-[var(--navy-900)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function formatExpirationDate(value: string, locale: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getLocationName(locations: LocationItem[], locationId?: string) {
  if (!locationId) {
    return null;
  }

  return locations.find((location) => location.id === locationId)?.name ?? null;
}

function getLotStatusTone(status: LotItem["status"]) {
  if (status === "Liberado") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Retido") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-amber-100 text-amber-700";
}

function getQualityStatusTone(status: QualityEventItem["status"]) {
  if (status === "Liberado") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Desvio") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-amber-100 text-amber-700";
}

function getMovementRoute(
  movement: MovementItem,
  locations: LocationItem[],
  copy: {
    inboundTo: string;
    outboundFrom: string;
    unknownLocation: string;
  },
) {
  if (movement.type === "entrada") {
    return `${copy.inboundTo} ${getLocationName(locations, movement.locationId) ?? copy.unknownLocation}`;
  }

  if (movement.type === "saida") {
    return `${copy.outboundFrom} ${getLocationName(locations, movement.locationId) ?? copy.unknownLocation}`;
  }

  const fromLocation = getLocationName(locations, movement.fromLocationId) ?? copy.unknownLocation;
  const toLocation = getLocationName(locations, movement.toLocationId) ?? copy.unknownLocation;
  return `${fromLocation} -> ${toLocation}`;
}

function isMovementRelatedToLot(movement: MovementItem, lot: LotItem, locations: LocationItem[]) {
  const lotCode = normalizeText(lot.code);
  const lotProduct = normalizeText(lot.product);
  const movementText = normalizeText(
    [movement.product, movement.reason, movement.notes ?? "", movement.code ?? ""].join(" "),
  );

  if (movementText.includes(lotCode)) {
    return true;
  }

  if (normalizeText(movement.product) !== lotProduct) {
    return false;
  }

  const touchedLocations = [
    getLocationName(locations, movement.locationId),
    getLocationName(locations, movement.fromLocationId),
    getLocationName(locations, movement.toLocationId),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeText(value));

  const lotLocation = normalizeText(lot.location);

  return touchedLocations.length === 0 || touchedLocations.includes(lotLocation);
}

function isDocumentRelatedToLot(document: DocumentItem, lot: LotItem) {
  const lotCode = normalizeText(lot.code);
  const lotProduct = normalizeText(lot.product);
  const documentText = normalizeText([document.title, document.type, document.area, document.owner].join(" "));

  return documentText.includes(lotCode) || documentText.includes(lotProduct);
}

export function TraceabilityScreen({ section }: { section: DashboardSection }) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const localizedSection = getSectionById(section.id, locale) ?? section;
  const [query, setQuery] = useState("");
  const [selectedLotCode, setSelectedLotCode] = useState<string | null>(null);
  const [lots, setLots] = useState<LotItem[]>(() => loadLots());
  const [movements, setMovements] = useState<MovementItem[]>(() => loadMovements());
  const [locations, setLocations] = useState<LocationItem[]>(() => loadLocations());
  const [qualityEvents, setQualityEvents] = useState<QualityEventItem[]>(() => loadQualityEvents());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => loadDocuments());

  useEffect(() => {
    const sync = () => {
      setLots(loadLots());
      setMovements(loadMovements());
      setLocations(loadLocations());
      setQualityEvents(loadQualityEvents());
      setDocuments(loadDocuments());
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(ERP_DATA_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ERP_DATA_EVENT, sync);
    };
  }, []);

  const filteredLots = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
      return lots;
    }

    return lots.filter((lot) =>
      normalizeText([lot.code, lot.product, lot.location, lot.status].join(" ")).includes(normalizedQuery),
    );
  }, [lots, query]);

  useEffect(() => {
    if (filteredLots.length === 0) {
      setSelectedLotCode(null);
      return;
    }

    if (!selectedLotCode || !filteredLots.some((lot) => lot.code === selectedLotCode)) {
      setSelectedLotCode(filteredLots[0].code);
    }
  }, [filteredLots, selectedLotCode]);

  const selectedLot = useMemo(
    () => filteredLots.find((lot) => lot.code === selectedLotCode) ?? filteredLots[0] ?? null,
    [filteredLots, selectedLotCode],
  );

  const relatedMovements = useMemo(() => {
    if (!selectedLot) {
      return [];
    }

    return movements
      .filter((movement) => isMovementRelatedToLot(movement, selectedLot, locations))
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }, [locations, movements, selectedLot]);

  const relatedQualityEvents = useMemo(() => {
    if (!selectedLot) {
      return [];
    }

    return qualityEvents.filter((event) => normalizeText(event.lot) === normalizeText(selectedLot.code));
  }, [qualityEvents, selectedLot]);

  const relatedDocuments = useMemo(() => {
    if (!selectedLot) {
      return [];
    }

    return documents.filter((document) => isDocumentRelatedToLot(document, selectedLot));
  }, [documents, selectedLot]);

  const lotsUnderReview = useMemo(
    () => lots.filter((lot) => lot.status !== "Liberado").length,
    [lots],
  );

  const latestMovement = relatedMovements[0] ?? null;

  return (
    <section className="space-y-8">
      <header className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-6 py-8 transition-colors">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">{copy.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold text-[var(--navy-900)]">{localizedSection.label}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">{localizedSection.description}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SectionCard title={copy.trackedLots} value={String(lots.length)} helper={copy.trackedLotsHelper} />
        <SectionCard title={copy.lotsUnderReview} value={String(lotsUnderReview)} helper={copy.lotsUnderReviewHelper} />
        <SectionCard title={copy.qualityEvents} value={String(qualityEvents.length)} helper={copy.qualityEventsHelper} />
        <SectionCard title={copy.evidence} value={String(documents.length)} helper={copy.evidenceHelper} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <Panel
          eyebrow={copy.currentLot}
          title={copy.searchLabel}
          description={copy.searchPlaceholder}
        >
          <div className="space-y-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />

            <div className="space-y-3">
              {filteredLots.map((lot) => (
                <button
                  key={lot.code}
                  type="button"
                  onClick={() => setSelectedLotCode(lot.code)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedLot?.code === lot.code
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                      : "border-[var(--panel-border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{lot.code}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{lot.product}</p>
                    </div>
                    <StatusPill label={copy.lotStatus[lot.status]} tone={getLotStatusTone(lot.status)} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
                    <span>{lot.location}</span>
                    <span>{formatUnits(lot.quantity, locale)}</span>
                  </div>
                </button>
              ))}

              {filteredLots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-6 text-sm text-[var(--muted-foreground)]">
                  {copy.noLots}
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          {selectedLot ? (
            <>
              <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition-colors">
                <div className="flex flex-col gap-4 border-b border-[var(--panel-border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{copy.currentLot}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--navy-900)]">{selectedLot.code}</h3>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">{selectedLot.product}</p>
                  </div>
                  <StatusPill label={copy.lotStatus[selectedLot.status]} tone={getLotStatusTone(selectedLot.status)} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SectionCard title={copy.currentLocation} value={selectedLot.location} helper={copy.linkedFlow} />
                  <SectionCard title={copy.availableQuantity} value={formatUnits(selectedLot.quantity, locale)} helper={copy.trackedLotsHelper} />
                  <SectionCard title={copy.expiration} value={formatExpirationDate(selectedLot.expiration, locale)} helper={copy.currentLot} />
                  <SectionCard
                    title={copy.latestMovement}
                    value={latestMovement ? formatDateTime(latestMovement.createdAt, locale) : "-"}
                    helper={latestMovement ? getMovementRoute(latestMovement, locations, copy) : copy.noMovement}
                  />
                </div>
              </section>

              <Panel
                eyebrow={copy.currentLot}
                title={copy.movementTimeline}
                description={copy.movementTimelineHelper}
              >
                <div className="space-y-3">
                  {relatedMovements.map((movement) => (
                    <article
                      key={movement.id}
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {getMovementTypeLabel(movement.type, locale)}
                            </p>
                            <StatusPill
                              label={getMovementStatusLabel(movement, locale)}
                              tone="bg-[var(--accent-soft)] text-[var(--accent)]"
                            />
                          </div>
                          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                            {getMovementRoute(movement, locations, copy)}
                          </p>
                        </div>
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          {formatSignedQuantity(movement.quantity, locale)}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-[var(--muted-foreground)] md:grid-cols-2 xl:grid-cols-4">
                        <p>{formatDateTime(movement.createdAt, locale)}</p>
                        <p>{movement.code ?? movement.reason}</p>
                        <p>{movement.user}</p>
                        <p>{movement.notes ?? selectedLot.product}</p>
                      </div>
                    </article>
                  ))}

                  {relatedMovements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-6 text-sm text-[var(--muted-foreground)]">
                      {copy.noMovement}
                    </div>
                  ) : null}
                </div>
              </Panel>

              <div className="grid gap-6 lg:grid-cols-2">
                <Panel
                  eyebrow={copy.currentLot}
                  title={copy.qualityPanel}
                  description={copy.qualityPanelHelper}
                >
                  <div className="space-y-3">
                    {relatedQualityEvents.map((event) => (
                      <article
                        key={`${event.title}-${event.lot}`}
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">{event.title}</p>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{event.area}</p>
                          </div>
                          <StatusPill
                            label={copy.qualityStatus[event.status]}
                            tone={getQualityStatusTone(event.status)}
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
                          <span>{event.lot}</span>
                          <span>{event.owner}</span>
                        </div>
                      </article>
                    ))}

                    {relatedQualityEvents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-6 text-sm text-[var(--muted-foreground)]">
                        {copy.noQualityEvents}
                      </div>
                    ) : null}
                  </div>
                </Panel>

                <Panel
                  eyebrow={copy.currentLot}
                  title={copy.documentsPanel}
                  description={copy.documentsPanelHelper}
                >
                  <div className="space-y-3">
                    {relatedDocuments.map((document) => (
                      <article
                        key={`${document.title}-${document.updatedAt}`}
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-[var(--foreground)]">{document.title}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
                          <span>{document.type}</span>
                          <span>{document.area}</span>
                          <span>{document.updatedAt}</span>
                          <span>{document.owner}</span>
                        </div>
                      </article>
                    ))}

                    {relatedDocuments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-6 text-sm text-[var(--muted-foreground)]">
                        {copy.noDocuments}
                      </div>
                    ) : null}
                  </div>
                </Panel>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-6 py-10 text-sm text-[var(--muted-foreground)]">
              {copy.noLots}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatSignedQuantity(value: number, locale: string) {
  const signal = value > 0 ? "+" : "";
  return `${signal}${new Intl.NumberFormat(locale).format(value)}`;
}

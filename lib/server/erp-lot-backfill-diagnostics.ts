import "server-only";

import { listLocations } from "@/lib/server/inventory-locations";
import { listLots, updateLot } from "@/lib/server/inventory-lots";
import { listProducts } from "@/lib/server/operations-products";

type BackfillConfidence = "high" | "medium" | "low";
type BackfillField = "productId" | "locationId";

type BackfillSuggestion = {
  field: BackfillField;
  currentValue: string | null;
  sourceValue: string;
  suggestion: string | null;
  suggestionLabel: string | null;
  confidence: BackfillConfidence;
  reason: string;
};

type LotBackfillRecommendation = {
  lotCode: string;
  suggestions: BackfillSuggestion[];
  safeToApply: boolean;
};

type LotBackfillDryRunReport = {
  generatedAt: string;
  dryRun: true;
  checked: {
    products: number;
    lots: number;
    locations: number;
  };
  summary: {
    lotsNeedingBackfill: number;
    lotsSafeToApply: number;
    lotsNeedingManualReview: number;
    productIdSuggestions: number;
    locationIdSuggestions: number;
  };
  recommendations: LotBackfillRecommendation[];
};

type LotBackfillApplyOptions = {
  apply?: boolean;
};

type AppliedLotBackfill = {
  lotCode: string;
  baseVersion: number;
  nextVersion: number;
  fields: BackfillField[];
};

type IgnoredLotBackfill = {
  lotCode: string;
  field: BackfillField;
  confidence: BackfillConfidence;
  reason: string;
};

type FailedLotBackfill = {
  lotCode: string;
  reason: string;
};

type LotBackfillApplyReport = Omit<LotBackfillDryRunReport, "dryRun"> & {
  dryRun: boolean;
  apply: boolean;
  applied: AppliedLotBackfill[];
  ignored: IgnoredLotBackfill[];
  failed: FailedLotBackfill[];
};

type MatchCandidate = {
  id: string;
  label: string;
  normalizedLabel: string;
};

type MatchResult = {
  suggestion: string | null;
  suggestionLabel: string | null;
  confidence: BackfillConfidence;
  reason: string;
};

function hasValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeReference(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function resolveByName(sourceValue: string, candidates: MatchCandidate[]): MatchResult {
  const normalizedSource = normalizeReference(sourceValue);

  if (!normalizedSource) {
    return {
      suggestion: null,
      suggestionLabel: null,
      confidence: "low",
      reason: "Valor de origem vazio ou invalido.",
    };
  }

  const exactMatches = candidates.filter(
    (candidate) => candidate.normalizedLabel === normalizedSource,
  );

  if (exactMatches.length === 1) {
    return {
      suggestion: exactMatches[0].id,
      suggestionLabel: exactMatches[0].label,
      confidence: "high",
      reason: "Match exato unico por nome normalizado.",
    };
  }

  if (exactMatches.length > 1) {
    return {
      suggestion: null,
      suggestionLabel: null,
      confidence: "low",
      reason: "Match exato ambiguo por nome normalizado.",
    };
  }

  const partialMatches = candidates.filter(
    (candidate) =>
      candidate.normalizedLabel.includes(normalizedSource) ||
      normalizedSource.includes(candidate.normalizedLabel),
  );

  if (partialMatches.length === 1) {
    return {
      suggestion: partialMatches[0].id,
      suggestionLabel: partialMatches[0].label,
      confidence: "medium",
      reason: "Match parcial unico por nome normalizado.",
    };
  }

  if (partialMatches.length > 1) {
    return {
      suggestion: null,
      suggestionLabel: null,
      confidence: "low",
      reason: "Match parcial ambiguo por nome normalizado.",
    };
  }

  return {
    suggestion: null,
    suggestionLabel: null,
    confidence: "low",
    reason: "Nenhum match encontrado por nome normalizado.",
  };
}

export async function getLotBackfillDryRun(): Promise<LotBackfillDryRunReport> {
  const [productsPayload, lotsPayload, locationsPayload] = await Promise.all([
    listProducts(),
    listLots(),
    listLocations(),
  ]);

  const productCandidates = productsPayload.items.map((product) => ({
    id: product.sku,
    label: product.product,
    normalizedLabel: normalizeReference(product.product),
  }));
  const locationCandidates = locationsPayload.items.map((location) => ({
    id: location.id,
    label: location.name,
    normalizedLabel: normalizeReference(location.name),
  }));
  const recommendations: LotBackfillRecommendation[] = [];

  for (const lot of lotsPayload.items) {
    const suggestions: BackfillSuggestion[] = [];

    if (!hasValue(lot.productId)) {
      const match = resolveByName(lot.product, productCandidates);

      suggestions.push({
        field: "productId",
        currentValue: lot.productId ?? null,
        sourceValue: lot.product,
        suggestion: match.suggestion,
        suggestionLabel: match.suggestionLabel,
        confidence: match.confidence,
        reason: match.reason,
      });
    }

    if (!hasValue(lot.locationId)) {
      const match = resolveByName(lot.location, locationCandidates);

      suggestions.push({
        field: "locationId",
        currentValue: lot.locationId ?? null,
        sourceValue: lot.location,
        suggestion: match.suggestion,
        suggestionLabel: match.suggestionLabel,
        confidence: match.confidence,
        reason: match.reason,
      });
    }

    if (suggestions.length > 0) {
      recommendations.push({
        lotCode: lot.code,
        suggestions,
        safeToApply: suggestions.every(
          (suggestion) =>
            suggestion.confidence === "high" && hasValue(suggestion.suggestion),
        ),
      });
    }
  }

  const lotsSafeToApply = recommendations.filter((item) => item.safeToApply).length;
  const productIdSuggestions = recommendations.reduce(
    (total, item) =>
      total + item.suggestions.filter((suggestion) => suggestion.field === "productId").length,
    0,
  );
  const locationIdSuggestions = recommendations.reduce(
    (total, item) =>
      total + item.suggestions.filter((suggestion) => suggestion.field === "locationId").length,
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    checked: {
      products: productsPayload.count,
      lots: lotsPayload.count,
      locations: locationsPayload.count,
    },
    summary: {
      lotsNeedingBackfill: recommendations.length,
      lotsSafeToApply,
      lotsNeedingManualReview: recommendations.length - lotsSafeToApply,
      productIdSuggestions,
      locationIdSuggestions,
    },
    recommendations,
  };
}

export async function applyLotBackfill(
  options?: LotBackfillApplyOptions,
): Promise<LotBackfillApplyReport> {
  const shouldApply = options?.apply === true;
  const report = await getLotBackfillDryRun();
  const lotsPayload = await listLots();
  const lotsByCode = new Map(lotsPayload.items.map((lot) => [lot.code, lot]));
  const applied: AppliedLotBackfill[] = [];
  const ignored: IgnoredLotBackfill[] = [];
  const failed: FailedLotBackfill[] = [];

  for (const recommendation of report.recommendations) {
    const lot = lotsByCode.get(recommendation.lotCode);

    if (!lot) {
      failed.push({
        lotCode: recommendation.lotCode,
        reason: "Lote nao encontrado durante a aplicacao do backfill.",
      });
      continue;
    }

    const patch: {
      productId?: string;
      product?: string;
      locationId?: string;
      location?: string;
    } = {};
    const fields: BackfillField[] = [];

    for (const suggestion of recommendation.suggestions) {
      if (suggestion.confidence !== "high" || !hasValue(suggestion.suggestion)) {
        ignored.push({
          lotCode: recommendation.lotCode,
          field: suggestion.field,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        });
        continue;
      }

      if (suggestion.field === "productId") {
        patch.productId = suggestion.suggestion;

        if (
          hasValue(suggestion.suggestionLabel) &&
          lot.product !== suggestion.suggestionLabel
        ) {
          patch.product = suggestion.suggestionLabel;
        }
      }

      if (suggestion.field === "locationId") {
        patch.locationId = suggestion.suggestion;

        if (
          hasValue(suggestion.suggestionLabel) &&
          lot.location !== suggestion.suggestionLabel
        ) {
          patch.location = suggestion.suggestionLabel;
        }
      }

      fields.push(suggestion.field);
    }

    if (fields.length === 0) {
      continue;
    }

    if (!shouldApply) {
      continue;
    }

    try {
      const updatedLot = await updateLot(recommendation.lotCode, patch, {
        baseVersion: lot.version,
      });

      applied.push({
        lotCode: recommendation.lotCode,
        baseVersion: lot.version,
        nextVersion: updatedLot.version,
        fields,
      });
    } catch (error) {
      failed.push({
        lotCode: recommendation.lotCode,
        reason: error instanceof Error ? error.message : "Erro desconhecido.",
      });
    }
  }

  return {
    ...report,
    dryRun: !shouldApply,
    apply: shouldApply,
    applied,
    ignored,
    failed,
  };
}

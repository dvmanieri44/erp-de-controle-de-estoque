import "server-only";

import { cloneErpResourceDefault, type ErpResourceId, type ErpResourceMap } from "@/lib/erp-data-resources";
import { normalizeLoginUsername, type UserRole, type UserStatus } from "@/lib/user-accounts";

type ParserMode = "read" | "write";

type BaseField = {
  optional?: boolean;
};

type StringField = BaseField & {
  kind: "string";
  trim?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  normalize?: (value: string) => string;
};

type NumberField = BaseField & {
  kind: "number";
  integer?: boolean;
  min?: number;
  max?: number;
};

type EnumField<TValue extends string> = BaseField & {
  kind: "enum";
  values: readonly TValue[];
};

type FieldSchema = StringField | NumberField | EnumField<string>;

type ObjectSchema<TValue extends Record<string, unknown>> = {
  fields: {
    [TKey in keyof TValue]-?: FieldSchema;
  };
};

type ResourceSchema<TKey extends ErpResourceId> = {
  maxItems: number;
  itemSchema: ObjectSchema<ErpResourceMap[TKey][number]>;
  identityLabel: string;
  getIdentity: (item: ErpResourceMap[TKey][number]) => string;
};

const LOCATION_TYPES = [
  "Fábrica",
  "Centro de Distribuição",
  "Expedição",
  "Qualidade",
] as const;

const LOCATION_STATUS = [
  "Ativa",
  "Inativa",
  "Em manutenção",
] as const;

const MOVEMENT_TYPES = [
  "entrada",
  "saida",
  "transferencia",
] as const;

const MOVEMENT_STATUS = [
  "concluida",
  "cancelada",
] as const;

const TRANSFER_STATUS = [
  "solicitada",
  "em_separacao",
  "em_transito",
  "recebida",
  "cancelada",
] as const;

const TRANSFER_PRIORITY = [
  "baixa",
  "media",
  "alta",
] as const;

const SPECIES = [
  "Cães",
  "Gatos",
] as const;

const PRODUCT_STATUS = [
  "Estável",
  "Atenção",
  "Crítico",
] as const;

const LOT_STATUS = [
  "Liberado",
  "Em análise",
  "Retido",
] as const;

const SUPPLIER_STATUS = [
  "Homologado",
  "Monitorado",
  "Crítico",
] as const;

const PRIORITY = [
  "Alta",
  "Média",
  "Baixa",
] as const;

const QUALITY_EVENT_STATUS = [
  "Em análise",
  "Liberado",
  "Desvio",
] as const;

const NOTIFICATION_TYPE = [
  "Alerta",
  "Aprovação",
  "Sistema",
] as const;

const NOTIFICATION_STATUS = [
  "Não lida",
  "Em andamento",
  "Concluída",
] as const;

const TASK_STATUS = [
  "Em execução",
  "Aguardando",
  "Concluída",
] as const;

const DISTRIBUTOR_STATUS = [
  "Ativo",
  "Em atenção",
] as const;

const INCIDENT_STATUS = [
  "Aberto",
  "Em tratativa",
  "Encerrado",
] as const;

const INCIDENT_SEVERITY = [
  "Alta",
  "Média",
  "Baixa",
] as const;

const CALENDAR_TYPE = [
  "Expedição",
  "Qualidade",
  "Planejamento",
  "Fornecedor",
] as const;

const USER_ROLES = [
  "administrador",
  "gestor",
  "operador",
  "consulta",
] as const satisfies readonly UserRole[];

const USER_STATUS = [
  "ativo",
  "inativo",
] as const satisfies readonly UserStatus[];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIMPLE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function stringField(overrides?: Omit<StringField, "kind">): StringField {
  return {
    kind: "string",
    trim: true,
    minLength: 1,
    maxLength: 180,
    ...overrides,
  };
}

function numberField(overrides?: Omit<NumberField, "kind">): NumberField {
  return {
    kind: "number",
    integer: true,
    min: 0,
    max: 10_000_000,
    ...overrides,
  };
}

function enumField<TValue extends string>(
  values: readonly TValue[],
  overrides?: Omit<EnumField<TValue>, "kind" | "values">,
): EnumField<TValue> {
  return {
    kind: "enum",
    values,
    ...overrides,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseField(
  fieldName: string,
  schema: FieldSchema,
  value: unknown,
) {
  if (value === undefined) {
    if (schema.optional) {
      return undefined;
    }

    throw new Error(`Campo obrigatório ausente: ${fieldName}.`);
  }

  if (schema.kind === "string") {
    if (typeof value !== "string") {
      throw new Error(`Campo inválido em ${fieldName}: esperado texto.`);
    }

    const trimmed = schema.trim === false ? value : value.trim();
    const normalized = schema.normalize ? schema.normalize(trimmed) : trimmed;

    if (normalized.length < (schema.minLength ?? 0)) {
      throw new Error(`Campo inválido em ${fieldName}: tamanho mínimo não atendido.`);
    }

    if (normalized.length > (schema.maxLength ?? Number.POSITIVE_INFINITY)) {
      throw new Error(`Campo inválido em ${fieldName}: tamanho máximo excedido.`);
    }

    if (schema.pattern && !schema.pattern.test(normalized)) {
      throw new Error(`Campo inválido em ${fieldName}: formato não suportado.`);
    }

    return normalized;
  }

  if (schema.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Campo inválido em ${fieldName}: esperado número.`);
    }

    if (schema.integer && !Number.isInteger(value)) {
      throw new Error(`Campo inválido em ${fieldName}: esperado número inteiro.`);
    }

    if (schema.min !== undefined && value < schema.min) {
      throw new Error(`Campo inválido em ${fieldName}: valor abaixo do mínimo permitido.`);
    }

    if (schema.max !== undefined && value > schema.max) {
      throw new Error(`Campo inválido em ${fieldName}: valor acima do máximo permitido.`);
    }

    return value;
  }

  if (typeof value !== "string" || !schema.values.includes(value)) {
    throw new Error(`Campo inválido em ${fieldName}: valor fora do enum permitido.`);
  }

  return value;
}

function parseObjectWithSchema<TValue extends Record<string, unknown>>(
  resource: string,
  value: unknown,
  schema: ObjectSchema<TValue>,
  mode: ParserMode,
) {
  if (!isPlainRecord(value)) {
    throw new Error(`Carga inválida para ${resource}: item precisa ser um objeto.`);
  }

  const output = {} as TValue;
  const allowedKeys = new Set(Object.keys(schema.fields));

  if (mode === "write") {
    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`Campo não permitido em ${resource}: ${key}.`);
      }
    }
  }

  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const parsedValue = parseField(fieldName, fieldSchema, value[fieldName]);

    if (parsedValue !== undefined) {
      output[fieldName as keyof TValue] = parsedValue as TValue[keyof TValue];
    }
  }

  return output;
}

function createResourceSchema<TKey extends ErpResourceId>(
  schema: ResourceSchema<TKey>,
) {
  return schema;
}

export class ErpResourceValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const ERP_RESOURCE_SCHEMAS = {
  "inventory.locations": createResourceSchema({
    maxItems: 2_000,
    itemSchema: {
      fields: {
        id: stringField({ maxLength: 80 }),
        name: stringField({ maxLength: 160 }),
        type: enumField(LOCATION_TYPES),
        address: stringField({ maxLength: 200 }),
        manager: stringField({ maxLength: 120 }),
        capacityTotal: numberField({ max: 100_000_000 }),
        status: enumField(LOCATION_STATUS),
      },
    },
    identityLabel: "id",
    getIdentity: (item) => item.id,
  }),
  "inventory.movements": createResourceSchema({
    maxItems: 20_000,
    itemSchema: {
      fields: {
        id: stringField({ maxLength: 120 }),
        product: stringField({ maxLength: 180 }),
        productId: stringField({ optional: true, maxLength: 80, normalize: (value) => value.toUpperCase() }),
        lotCode: stringField({ optional: true, maxLength: 80 }),
        type: enumField(MOVEMENT_TYPES),
        quantity: numberField({ max: 100_000_000 }),
        reason: stringField({ maxLength: 240 }),
        user: stringField({ maxLength: 120 }),
        createdAt: stringField({ pattern: ISO_DATE_TIME_PATTERN, maxLength: 32 }),
        updatedAt: stringField({ optional: true, pattern: ISO_DATE_TIME_PATTERN, maxLength: 32 }),
        locationId: stringField({ optional: true, maxLength: 120 }),
        fromLocationId: stringField({ optional: true, maxLength: 120 }),
        toLocationId: stringField({ optional: true, maxLength: 120 }),
        notes: stringField({ optional: true, maxLength: 1_000 }),
        status: enumField(MOVEMENT_STATUS, { optional: true }),
        transferStatus: enumField(TRANSFER_STATUS, { optional: true }),
        priority: enumField(TRANSFER_PRIORITY, { optional: true }),
        code: stringField({ optional: true, maxLength: 120 }),
        receivedAt: stringField({ optional: true, pattern: ISO_DATE_TIME_PATTERN, maxLength: 32 }),
      },
    },
    identityLabel: "id",
    getIdentity: (item) => item.id,
  }),
  "operations.products": createResourceSchema({
    maxItems: 5_000,
    itemSchema: {
      fields: {
        sku: stringField({ maxLength: 80, normalize: (value) => value.toUpperCase() }),
        product: stringField({ maxLength: 180 }),
        line: stringField({ maxLength: 120 }),
        species: enumField(SPECIES),
        stage: stringField({ maxLength: 80 }),
        package: stringField({ maxLength: 40 }),
        stock: numberField({ max: 100_000_000 }),
        target: numberField({ max: 100_000_000 }),
        coverageDays: numberField({ max: 3_650 }),
        status: enumField(PRODUCT_STATUS),
      },
    },
    identityLabel: "sku",
    getIdentity: (item) => item.sku,
  }),
  "operations.lots": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        code: stringField({ maxLength: 80 }),
        product: stringField({ maxLength: 180 }),
        productId: stringField({
          optional: true,
          maxLength: 80,
          normalize: (value) => value.toUpperCase(),
        }),
        locationId: stringField({ optional: true, maxLength: 120 }),
        location: stringField({ maxLength: 160 }),
        expiration: stringField({ pattern: SIMPLE_DATE_PATTERN, maxLength: 10 }),
        quantity: numberField({ max: 100_000_000 }),
        status: enumField(LOT_STATUS),
      },
    },
    identityLabel: "code",
    getIdentity: (item) => item.code,
  }),
  "operations.suppliers": createResourceSchema({
    maxItems: 4_000,
    itemSchema: {
      fields: {
        name: stringField({ maxLength: 160 }),
        category: stringField({ maxLength: 120 }),
        city: stringField({ maxLength: 120 }),
        leadTimeDays: numberField({ max: 365 }),
        score: numberField({ max: 100 }),
        status: enumField(SUPPLIER_STATUS),
      },
    },
    identityLabel: "name",
    getIdentity: (item) => item.name,
  }),
  "operations.categories": createResourceSchema({
    maxItems: 2_000,
    itemSchema: {
      fields: {
        name: stringField({ maxLength: 140 }),
        portfolio: stringField({ maxLength: 140 }),
        skus: numberField({ max: 10_000 }),
        share: stringField({ maxLength: 20 }),
        focus: stringField({ maxLength: 320 }),
      },
    },
    identityLabel: "name",
    getIdentity: (item) => item.name,
  }),
  "operations.notifications": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        title: stringField({ maxLength: 240 }),
        area: stringField({ maxLength: 120 }),
        priority: enumField(PRIORITY),
        type: enumField(NOTIFICATION_TYPE),
        status: enumField(NOTIFICATION_STATUS),
      },
    },
    identityLabel: "title",
    getIdentity: (item) => `${item.title}::${item.area}`,
  }),
  "operations.quality-events": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        id: stringField({ optional: true, maxLength: 120 }),
        title: stringField({ maxLength: 240 }),
        lot: stringField({ maxLength: 80 }),
        area: stringField({ maxLength: 120 }),
        owner: stringField({ maxLength: 120 }),
        status: enumField(QUALITY_EVENT_STATUS),
      },
    },
    identityLabel: "title/lot",
    getIdentity: (item) => item.id ?? `${item.title}::${item.lot}`,
  }),
  "operations.planning": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        route: stringField({ maxLength: 200 }),
        window: stringField({ maxLength: 80 }),
        priority: enumField(PRIORITY),
        demand: numberField({ max: 100_000_000 }),
        coverage: stringField({ maxLength: 240 }),
      },
    },
    identityLabel: "route/window",
    getIdentity: (item) => `${item.route}::${item.window}`,
  }),
  "operations.reports": createResourceSchema({
    maxItems: 2_000,
    itemSchema: {
      fields: {
        title: stringField({ maxLength: 180 }),
        owner: stringField({ maxLength: 120 }),
        cadence: stringField({ maxLength: 80 }),
        lastRun: stringField({ maxLength: 80 }),
        summary: stringField({ maxLength: 400 }),
      },
    },
    identityLabel: "title",
    getIdentity: (item) => item.title,
  }),
  "operations.pending": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        title: stringField({ maxLength: 240 }),
        owner: stringField({ maxLength: 120 }),
        area: stringField({ maxLength: 120 }),
        due: stringField({ maxLength: 80 }),
        priority: enumField(PRIORITY),
      },
    },
    identityLabel: "title/owner/due",
    getIdentity: (item) => `${item.title}::${item.owner}::${item.due}`,
  }),
  "operations.tasks": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        title: stringField({ maxLength: 240 }),
        shift: stringField({ maxLength: 60 }),
        owner: stringField({ maxLength: 120 }),
        checklist: numberField({ max: 10_000 }),
        completed: numberField({ max: 10_000 }),
        status: enumField(TASK_STATUS),
      },
    },
    identityLabel: "title/owner/shift",
    getIdentity: (item) => `${item.title}::${item.owner}::${item.shift}`,
  }),
  "operations.distributors": createResourceSchema({
    maxItems: 5_000,
    itemSchema: {
      fields: {
        name: stringField({ maxLength: 160 }),
        region: stringField({ maxLength: 120 }),
        channel: stringField({ maxLength: 120 }),
        priority: enumField(PRIORITY),
        lastSupply: stringField({ maxLength: 80 }),
        status: enumField(DISTRIBUTOR_STATUS),
      },
    },
    identityLabel: "name",
    getIdentity: (item) => item.name,
  }),
  "operations.incidents": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        title: stringField({ maxLength: 240 }),
        area: stringField({ maxLength: 120 }),
        severity: enumField(INCIDENT_SEVERITY),
        owner: stringField({ maxLength: 120 }),
        status: enumField(INCIDENT_STATUS),
      },
    },
    identityLabel: "title/owner",
    getIdentity: (item) => `${item.title}::${item.owner}`,
  }),
  "operations.documents": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        title: stringField({ maxLength: 240 }),
        type: stringField({ maxLength: 120 }),
        area: stringField({ maxLength: 120 }),
        updatedAt: stringField({ maxLength: 80 }),
        owner: stringField({ maxLength: 120 }),
      },
    },
    identityLabel: "title/type",
    getIdentity: (item) => `${item.title}::${item.type}`,
  }),
  "operations.calendar": createResourceSchema({
    maxItems: 10_000,
    itemSchema: {
      fields: {
        title: stringField({ maxLength: 240 }),
        slot: stringField({ maxLength: 80 }),
        area: stringField({ maxLength: 120 }),
        type: enumField(CALENDAR_TYPE),
      },
    },
    identityLabel: "title/slot",
    getIdentity: (item) => `${item.title}::${item.slot}`,
  }),
  "user.accounts": createResourceSchema({
    maxItems: 500,
    itemSchema: {
      fields: {
        id: stringField({ maxLength: 120 }),
        name: stringField({ maxLength: 160 }),
        username: stringField({
          maxLength: 60,
          normalize: (value) => normalizeLoginUsername(value),
        }),
        email: stringField({ maxLength: 180, pattern: EMAIL_PATTERN }),
        role: enumField(USER_ROLES),
        unit: stringField({ maxLength: 160 }),
        status: enumField(USER_STATUS),
      },
    },
    identityLabel: "id",
    getIdentity: (item) => item.id,
  }),
} satisfies {
  [TKey in ErpResourceId]: ResourceSchema<TKey>;
};

type NormalizedResourceResult<TKey extends ErpResourceId> = {
  data: ErpResourceMap[TKey];
  droppedItems: number;
};

function normalizeResourceData<TKey extends ErpResourceId>(
  resource: TKey,
  data: unknown,
  mode: ParserMode,
): NormalizedResourceResult<TKey> {
  const resourceSchema = ERP_RESOURCE_SCHEMAS[resource] as unknown as ResourceSchema<TKey>;

  if (!Array.isArray(data)) {
    if (mode === "read") {
      return {
        data: [] as ErpResourceMap[TKey],
        droppedItems: 0,
      };
    }

    throw new ErpResourceValidationError("Carga invalida para persistencia.");
  }

  if (mode === "write" && data.length > resourceSchema.maxItems) {
    throw new ErpResourceValidationError(
      `Carga invalida para ${resource}: limite de ${resourceSchema.maxItems} itens excedido.`,
    );
  }

  const items: Array<ErpResourceMap[TKey][number]> = [];
  const seenIdentities = new Set<string>();
  let droppedItems = 0;

  for (const [index, item] of data.entries()) {
    try {
      const parsedItem = parseObjectWithSchema(
        resource,
        item,
        resourceSchema.itemSchema as ObjectSchema<Record<string, unknown>>,
        mode,
      ) as ErpResourceMap[TKey][number];
      const identity = resourceSchema.getIdentity(parsedItem).trim();

      if (!identity) {
        throw new Error(`Item ${index + 1} sem ${resourceSchema.identityLabel} valido.`);
      }

      if (seenIdentities.has(identity)) {
        if (mode === "read") {
          droppedItems += 1;
          continue;
        }

        throw new Error(
          `Valor duplicado em ${resourceSchema.identityLabel} no item ${index + 1}.`,
        );
      }

      seenIdentities.add(identity);
      items.push(parsedItem);
    } catch (error) {
      if (mode === "read") {
        droppedItems += 1;
        continue;
      }

      throw new ErpResourceValidationError(
        error instanceof Error
          ? error.message
          : `Falha ao validar o item ${index + 1} de ${resource}.`,
      );
    }
  }

  return {
    data: items as ErpResourceMap[TKey],
    droppedItems,
  };
}

export function sanitizeStoredErpResourceData<TKey extends ErpResourceId>(
  resource: TKey,
  data: unknown,
) {
  return normalizeResourceData(resource, data, "read");
}

export function validateErpResourceData<TKey extends ErpResourceId>(
  resource: TKey,
  data: unknown,
) {
  return normalizeResourceData(resource, data, "write").data;
}

export function sanitizeStoredErpResourceItemData<TKey extends ErpResourceId>(
  resource: TKey,
  item: unknown,
): {
  item: ErpResourceMap[TKey][number] | null;
  droppedItems: number;
} {
  const normalized = normalizeResourceData(resource, [item], "read");

  return {
    item: normalized.data[0] ?? null,
    droppedItems: normalized.droppedItems,
  };
}

export function validateErpResourceItemData<TKey extends ErpResourceId>(
  resource: TKey,
  item: unknown,
): ErpResourceMap[TKey][number] {
  const normalized = normalizeResourceData(resource, [item], "write").data[0];

  if (!normalized) {
    throw new ErpResourceValidationError(
      `Carga invalida para ${resource}: item obrigatorio.`,
    );
  }

  return normalized;
}

export function getFallbackErpResourceData<TKey extends ErpResourceId>(resource: TKey) {
  return cloneErpResourceDefault(resource);
}

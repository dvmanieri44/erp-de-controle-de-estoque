import type {
  FirebaseAdminDbLike,
  FirebaseCollectionLike,
  FirebaseDocumentReferenceLike,
  FirebaseDocumentSnapshotLike,
  FirebaseQueryLike,
  FirebaseQuerySnapshotLike,
  FirebaseTransactionLike,
} from "@/lib/server/firebase-admin";

type StoredDocument = Record<string, unknown>;

type QueryFilter = {
  fieldPath: string;
  opStr: string;
  value: unknown;
};

type QueryOrder = {
  fieldPath: string;
  directionStr: "asc" | "desc";
};

function cloneValue<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}

function getFieldValue(document: StoredDocument, fieldPath: string) {
  return fieldPath
    .split(".")
    .reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, document);
}

class FakeDocumentSnapshot<TData extends StoredDocument>
  implements FirebaseDocumentSnapshotLike<TData>
{
  constructor(
    public readonly ref: FakeDocumentReference<TData>,
    private readonly value: TData | null,
  ) {}

  get exists() {
    return this.value !== null;
  }

  get id() {
    return this.ref.id;
  }

  data() {
    return this.value ? cloneValue(this.value) : undefined;
  }
}

class FakeQuerySnapshot<TData extends StoredDocument>
  implements FirebaseQuerySnapshotLike<TData>
{
  constructor(
    public readonly docs: Array<FirebaseDocumentSnapshotLike<TData>>,
  ) {}

  forEach(callback: (document: FirebaseDocumentSnapshotLike<TData>) => void) {
    for (const document of this.docs) {
      callback(document);
    }
  }
}

class FakeDocumentReference<TData extends StoredDocument>
  implements FirebaseDocumentReferenceLike<TData>
{
  constructor(
    private readonly database: FakeFirestoreAdminDb,
    private readonly collectionName: string,
    public readonly id: string,
  ) {}

  async get() {
    const collection = this.database.getCollectionStore(this.collectionName);
    const value = (collection.get(this.id) ?? null) as TData | null;
    return new FakeDocumentSnapshot(this, value);
  }

  async set(data: Partial<TData> | TData, options?: { merge?: boolean }) {
    const collection = this.database.getCollectionStore(this.collectionName);
    const currentValue = (collection.get(this.id) ?? null) as TData | null;
    const nextValue =
      options?.merge && currentValue
        ? ({
            ...cloneValue(currentValue),
            ...cloneValue(data as TData),
          } as TData)
        : cloneValue(data as TData);

    collection.set(this.id, nextValue);
  }

  async delete() {
    const collection = this.database.getCollectionStore(this.collectionName);
    collection.delete(this.id);
  }
}

class FakeQuery<TData extends StoredDocument>
  implements FirebaseQueryLike<TData>
{
  constructor(
    protected readonly database: FakeFirestoreAdminDb,
    protected readonly collectionName: string,
    protected readonly filters: QueryFilter[] = [],
    protected readonly order: QueryOrder | null = null,
    protected readonly limitValue: number | null = null,
  ) {}

  where(fieldPath: string, opStr: string, value: unknown) {
    if (opStr !== "==") {
      throw new Error(`Operador nao suportado no fake Firestore: ${opStr}`);
    }

    return new FakeQuery<TData>(this.database, this.collectionName, [
      ...this.filters,
      { fieldPath, opStr, value },
    ], this.order, this.limitValue);
  }

  orderBy(fieldPath: string, directionStr: "asc" | "desc" = "asc") {
    return new FakeQuery<TData>(
      this.database,
      this.collectionName,
      this.filters,
      { fieldPath, directionStr },
      this.limitValue,
    );
  }

  limit(limit: number) {
    return new FakeQuery<TData>(
      this.database,
      this.collectionName,
      this.filters,
      this.order,
      limit,
    );
  }

  async get() {
    const collection = this.database.getCollectionStore(this.collectionName);
    let documents = [...collection.entries()].map(([id, value]) => ({
      id,
      value: cloneValue(value as TData),
    }));

    for (const filter of this.filters) {
      documents = documents.filter(
        (document) =>
          getFieldValue(document.value, filter.fieldPath) === filter.value,
      );
    }

    if (this.order) {
      const direction = this.order.directionStr === "desc" ? -1 : 1;
      documents.sort((left, right) => {
        const leftValue = getFieldValue(left.value, this.order!.fieldPath);
        const rightValue = getFieldValue(right.value, this.order!.fieldPath);

        if (leftValue === rightValue) {
          return 0;
        }

        return leftValue! > rightValue! ? direction : -direction;
      });
    }

    if (typeof this.limitValue === "number") {
      documents = documents.slice(0, this.limitValue);
    }

    return new FakeQuerySnapshot(
      documents.map(
        (document) =>
          new FakeDocumentSnapshot(
            new FakeDocumentReference<TData>(
              this.database,
              this.collectionName,
              document.id,
            ),
            document.value,
          ),
      ),
    );
  }
}

class FakeCollection<TData extends StoredDocument>
  extends FakeQuery<TData>
  implements FirebaseCollectionLike<TData>
{
  doc(id: string) {
    return new FakeDocumentReference<TData>(
      this.database,
      this.collectionName,
      id,
    );
  }
}

class FakeTransaction implements FirebaseTransactionLike {
  private readonly operations: Array<() => Promise<void>> = [];

  async get<TData = Record<string, unknown>>(
    documentReference: FirebaseDocumentReferenceLike<TData>,
  ): Promise<FirebaseDocumentSnapshotLike<TData>>;
  async get<TData = Record<string, unknown>>(
    query: FirebaseQueryLike<TData>,
  ): Promise<FirebaseQuerySnapshotLike<TData>>;
  async get<TData = Record<string, unknown>>(
    reference: FirebaseDocumentReferenceLike<TData> | FirebaseQueryLike<TData>,
  ) {
    return reference.get();
  }

  set<TData = Record<string, unknown>>(
    documentReference: FirebaseDocumentReferenceLike<TData>,
    data: Partial<TData> | TData,
    options?: { merge?: boolean },
  ) {
    this.operations.push(() => documentReference.set(data, options));
  }

  delete<TData = Record<string, unknown>>(
    documentReference: FirebaseDocumentReferenceLike<TData>,
  ) {
    this.operations.push(() => documentReference.delete());
  }

  async commit() {
    for (const operation of this.operations) {
      await operation();
    }
  }
}

export class FakeFirestoreAdminDb implements FirebaseAdminDbLike {
  private readonly collections = new Map<string, Map<string, StoredDocument>>();

  collection<TData = Record<string, unknown>>(name: string) {
    return new FakeCollection<TData & StoredDocument>(this, name);
  }

  async runTransaction<TValue>(
    updateFunction: (transaction: FirebaseTransactionLike) => Promise<TValue>,
  ) {
    const transaction = new FakeTransaction();
    const result = await updateFunction(transaction);
    await transaction.commit();
    return result;
  }

  seed(collectionName: string, id: string, value: StoredDocument) {
    this.getCollectionStore(collectionName).set(id, cloneValue(value));
  }

  read(collectionName: string, id: string) {
    const value = this.getCollectionStore(collectionName).get(id);
    return value ? cloneValue(value) : null;
  }

  getCollectionStore(collectionName: string) {
    const current =
      this.collections.get(collectionName) ?? new Map<string, StoredDocument>();

    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, current);
    }

    return current;
  }
}

import type {
  DBSchema,
  IDBPDatabase,
  IDBPTransaction,
  IndexKey,
  IndexNames,
  StoreKey,
  StoreNames,
  StoreValue,
} from 'idb';

export type Table<Key, Value> = {
  delete(key: Key): Promise<void>;
  deleteAll(): Promise<void>;
  get(key: Key): Promise<Value | undefined>;
  getAll(): Promise<Value[]>;
  insert(key: Key, value: Value): Promise<Key>;
  update(key: Key, value: Value): Promise<Key | undefined>;
};

export type TableIndex<Key, Value> = {
  get(key: Key): Promise<Value | undefined>;
  getAll(query?: Key | IDBKeyRange | null, count?: number): Promise<Value[]>;
};

export type SchemaTable<
  Schema extends DBSchema,
  StoreName extends StoreNames<Schema>,
  Key extends StoreKey<Schema, StoreName> = StoreKey<Schema, StoreName>,
  Value extends StoreValue<Schema, StoreName> = StoreValue<Schema, StoreName>,
> = Table<Key, Value> & {
  index<IndexName extends IndexNames<Schema, StoreName>>(
    indexName: IndexName
  ): TableIndex<IndexKey<Schema, StoreName, IndexName>, Value>;
};

export type SchemaTableTransaction<
  Schema extends DBSchema,
  TransactionStores extends readonly StoreNames<Schema>[],
> = {
  table<StoreName extends TransactionStores[number]>(
    storeName: StoreName
  ): SchemaTable<Schema, StoreName>;
};

export function createSchemaTable<
  Schema extends DBSchema,
  StoreName extends StoreNames<Schema>,
>(
  database: IDBPDatabase<Schema>,
  storeName: StoreName
): SchemaTable<Schema, StoreName> {
  return {
    delete: deleteValue,
    deleteAll,
    get,
    getAll,
    index,
    insert,
    update,
  };

  function deleteValue(key: StoreKey<Schema, StoreName>): Promise<void> {
    return database.delete(storeName, key);
  }

  function deleteAll(): Promise<void> {
    return database.clear(storeName);
  }

  function get(
    key: StoreKey<Schema, StoreName>
  ): Promise<StoreValue<Schema, StoreName> | undefined> {
    return database.get(storeName, key);
  }

  function getAll(): Promise<StoreValue<Schema, StoreName>[]> {
    return database.getAll(storeName);
  }

  function index<IndexName extends IndexNames<Schema, StoreName>>(
    indexName: IndexName
  ): TableIndex<
    IndexKey<Schema, StoreName, IndexName>,
    StoreValue<Schema, StoreName>
  > {
    return { get: getFromIndex, getAll: getAllFromIndex };

    function getFromIndex(
      key: IndexKey<Schema, StoreName, IndexName>
    ): Promise<StoreValue<Schema, StoreName> | undefined> {
      return database.getFromIndex(storeName, indexName, key);
    }

    function getAllFromIndex(
      query?: IndexKey<Schema, StoreName, IndexName> | IDBKeyRange | null,
      count?: number
    ): Promise<StoreValue<Schema, StoreName>[]> {
      return database.getAllFromIndex(storeName, indexName, query, count);
    }
  }

  async function insert(
    key: StoreKey<Schema, StoreName>,
    value: StoreValue<Schema, StoreName>
  ): Promise<StoreKey<Schema, StoreName>> {
    return runWriteTransaction((table) => table.insert(key, value));
  }

  async function update(
    key: StoreKey<Schema, StoreName>,
    value: StoreValue<Schema, StoreName>
  ): Promise<StoreKey<Schema, StoreName> | undefined> {
    return runWriteTransaction((table) => table.update(key, value));
  }

  async function runWriteTransaction<Result>(
    operation: (table: SchemaTable<Schema, StoreName>) => Promise<Result>
  ): Promise<Result> {
    const transaction = database.transaction(storeName, 'readwrite');
    const table = createTransactionSchemaTable(transaction, storeName);
    const settledTransaction = transaction.done.catch(() => undefined);

    try {
      const result = await operation(table);
      await transaction.done;
      return result;
    } catch (error) {
      await settledTransaction;
      throw error;
    }
  }
}

export async function runSchemaTableTransaction<
  Schema extends DBSchema,
  TransactionStores extends readonly StoreNames<Schema>[],
  Result,
>(
  database: IDBPDatabase<Schema>,
  storeNames: TransactionStores,
  operation: (
    transaction: SchemaTableTransaction<Schema, TransactionStores>
  ) => Promise<Result>
): Promise<Result> {
  const transaction = database.transaction(storeNames, 'readwrite');
  const tableTransaction = { table };
  const settledTransaction = transaction.done.catch(() => undefined);

  try {
    const result = await operation(tableTransaction);
    await transaction.done;
    return result;
  } catch (error) {
    abortTransaction();
    await settledTransaction;
    throw error;
  }

  function table<StoreName extends TransactionStores[number]>(
    storeName: StoreName
  ): SchemaTable<Schema, StoreName> {
    return createTransactionSchemaTable(transaction, storeName);
  }

  function abortTransaction(): void {
    try {
      transaction.abort();
    } catch {
      // The request error may have already aborted the transaction.
    }
  }
}

export function createTransactionSchemaTable<
  Schema extends DBSchema,
  TransactionStores extends ArrayLike<StoreNames<Schema>>,
  StoreName extends TransactionStores[number] & StoreNames<Schema>,
>(
  transaction: IDBPTransaction<Schema, TransactionStores, 'readwrite'>,
  storeName: StoreName
): SchemaTable<Schema, StoreName> {
  const store = transaction.objectStore(storeName);

  return {
    delete: deleteValue,
    deleteAll,
    get,
    getAll,
    index,
    insert,
    update,
  };

  function deleteValue(key: StoreKey<Schema, StoreName>): Promise<void> {
    return store.delete(key);
  }

  function deleteAll(): Promise<void> {
    return store.clear();
  }

  function get(
    key: StoreKey<Schema, StoreName>
  ): Promise<StoreValue<Schema, StoreName> | undefined> {
    return store.get(key);
  }

  function getAll(): Promise<StoreValue<Schema, StoreName>[]> {
    return store.getAll();
  }

  function index<IndexName extends IndexNames<Schema, StoreName>>(
    indexName: IndexName
  ): TableIndex<
    IndexKey<Schema, StoreName, IndexName>,
    StoreValue<Schema, StoreName>
  > {
    const tableIndex = store.index(indexName);
    return { get: getFromIndex, getAll: getAllFromIndex };

    function getFromIndex(
      key: IndexKey<Schema, StoreName, IndexName>
    ): Promise<StoreValue<Schema, StoreName> | undefined> {
      return tableIndex.get(key);
    }

    function getAllFromIndex(
      query?: IndexKey<Schema, StoreName, IndexName> | IDBKeyRange | null,
      count?: number
    ): Promise<StoreValue<Schema, StoreName>[]> {
      return tableIndex.getAll(query, count);
    }
  }

  async function insert(
    key: StoreKey<Schema, StoreName>,
    value: StoreValue<Schema, StoreName>
  ): Promise<StoreKey<Schema, StoreName>> {
    const insertedKey =
      store.keyPath === null
        ? await store.add(value, key)
        : await store.add(value);
    assertMatchingInlineKey(key, insertedKey);
    return insertedKey;
  }

  async function update(
    key: StoreKey<Schema, StoreName>,
    value: StoreValue<Schema, StoreName>
  ): Promise<StoreKey<Schema, StoreName> | undefined> {
    if ((await store.count(key)) === 0) {
      return undefined;
    }

    const updatedKey =
      store.keyPath === null
        ? await store.put(value, key)
        : await store.put(value);
    assertMatchingInlineKey(key, updatedKey);
    return updatedKey;
  }

  function assertMatchingInlineKey(
    expectedKey: StoreKey<Schema, StoreName>,
    actualKey: StoreKey<Schema, StoreName>
  ): void {
    if (indexedDB.cmp(expectedKey, actualKey) !== 0) {
      transaction.abort();
      throw new Error('The table key does not match the inline value key.');
    }
  }
}

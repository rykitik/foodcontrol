export const CASHIER_OFFLINE_DB_NAME = 'cashier_offline_v1'
export const CASHIER_OFFLINE_DB_VERSION = 4

export const CASHIER_OFFLINE_STORES = {
  offline_queue: 'offline_queue',
  terminal_meta: 'terminal_meta',
  offline_grant: 'offline_grant',
  snapshot_meta: 'snapshot_meta',
  readiness_meta: 'readiness_meta',
  snapshot_students: 'snapshot_students',
  snapshot_tickets: 'snapshot_tickets',
  snapshot_categories: 'snapshot_categories',
  snapshot_holidays: 'snapshot_holidays',
  snapshot_lookup_restrictions: 'snapshot_lookup_restrictions',
  sync_state: 'sync_state',
} as const

export type CashierOfflineStoreName = (typeof CASHIER_OFFLINE_STORES)[keyof typeof CASHIER_OFFLINE_STORES]

let dbPromise: Promise<IDBDatabase | null> | null = null
const REQUIRED_CASHIER_OFFLINE_STORES = Object.values(CASHIER_OFFLINE_STORES) as CashierOfflineStoreName[]

function clearDbPromise(): void {
  dbPromise = null
}

function canUseIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  })
}

function createStoreIfMissing(
  database: IDBDatabase,
  transaction: IDBTransaction,
  name: CashierOfflineStoreName,
  options?: IDBObjectStoreParameters,
): IDBObjectStore {
  if (database.objectStoreNames.contains(name)) {
    return transaction.objectStore(name)
  }

  return database.createObjectStore(name, options)
}

function ensureStoreIndexes(store: IDBObjectStore, indexes: Array<{ name: string; keyPath: string | string[]; options?: IDBIndexParameters }>): void {
  indexes.forEach((index) => {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath, index.options)
    }
  })
}

function upgradeSchema(database: IDBDatabase, transaction: IDBTransaction): void {
  const offlineQueue = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.offline_queue, {
    keyPath: 'queue_item_id',
  })
  ensureStoreIndexes(offlineQueue, [
    { name: 'partition_key', keyPath: 'partition_key' },
    { name: 'terminal_id', keyPath: 'terminal_id' },
    { name: 'user_id', keyPath: 'user_id' },
    { name: 'created_at', keyPath: 'created_at' },
  ])

  const terminalMeta = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.terminal_meta, {
    keyPath: 'partition_key',
  })
  ensureStoreIndexes(terminalMeta, [
    { name: 'terminal_id', keyPath: 'terminal_id' },
    { name: 'user_id', keyPath: 'user_id' },
  ])

  const offlineGrant = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.offline_grant, {
    keyPath: 'partition_key',
  })
  ensureStoreIndexes(offlineGrant, [
    { name: 'terminal_id', keyPath: 'terminal_id' },
    { name: 'user_id', keyPath: 'user_id' },
  ])

  const snapshotMeta = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.snapshot_meta, {
    keyPath: 'partition_key',
  })
  ensureStoreIndexes(snapshotMeta, [
    { name: 'terminal_id', keyPath: 'terminal_id' },
    { name: 'user_id', keyPath: 'user_id' },
  ])

  const readinessMeta = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.readiness_meta, {
    keyPath: 'partition_key',
  })
  ensureStoreIndexes(readinessMeta, [
    { name: 'terminal_id', keyPath: 'terminal_id' },
    { name: 'user_id', keyPath: 'user_id' },
  ])

  const snapshotStudents = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.snapshot_students, {
    keyPath: 'snapshot_student_id',
  })
  ensureStoreIndexes(snapshotStudents, [
    { name: 'partition_key', keyPath: 'partition_key' },
    { name: 'student_id', keyPath: 'student_id' },
    { name: 'student_card_lower', keyPath: 'student_card_lower' },
    { name: 'full_name_lower', keyPath: 'full_name_lower' },
  ])

  const snapshotTickets = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.snapshot_tickets, {
    keyPath: 'snapshot_ticket_id',
  })
  ensureStoreIndexes(snapshotTickets, [
    { name: 'partition_key', keyPath: 'partition_key' },
    { name: 'student_id', keyPath: 'student_id' },
    { name: 'ticket_id_lower', keyPath: 'ticket_id_lower' },
    { name: 'qr_code_lower', keyPath: 'qr_code_lower' },
  ])

  const snapshotCategories = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.snapshot_categories, {
    keyPath: 'snapshot_category_id',
  })
  ensureStoreIndexes(snapshotCategories, [
    { name: 'partition_key', keyPath: 'partition_key' },
    { name: 'category_id', keyPath: 'category_id' },
  ])

  const snapshotHolidays = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.snapshot_holidays, {
    keyPath: 'snapshot_holiday_id',
  })
  ensureStoreIndexes(snapshotHolidays, [
    { name: 'partition_key', keyPath: 'partition_key' },
    { name: 'holiday_date', keyPath: 'holiday_date' },
  ])

  const snapshotLookupRestrictions = createStoreIfMissing(
    database,
    transaction,
    CASHIER_OFFLINE_STORES.snapshot_lookup_restrictions,
    {
      keyPath: 'snapshot_lookup_restriction_id',
    },
  )
  ensureStoreIndexes(snapshotLookupRestrictions, [
    { name: 'partition_key', keyPath: 'partition_key' },
    { name: 'lookup_key_lower', keyPath: 'lookup_key_lower' },
  ])

  const syncState = createStoreIfMissing(database, transaction, CASHIER_OFFLINE_STORES.sync_state, {
    keyPath: 'sync_state_id',
  })
  ensureStoreIndexes(syncState, [
    { name: 'partition_key', keyPath: 'partition_key' },
    { name: 'request_id', keyPath: 'request_id' },
    { name: 'status', keyPath: 'status' },
    { name: 'next_retry_at', keyPath: 'next_retry_at' },
  ])
}

function hasRequiredStores(database: IDBDatabase): boolean {
  return REQUIRED_CASHIER_OFFLINE_STORES.every((storeName) => database.objectStoreNames.contains(storeName))
}

function openCashierOfflineDb(version: number): Promise<IDBDatabase | null> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CASHIER_OFFLINE_DB_NAME, version)

    request.onupgradeneeded = () => {
      if (!request.transaction) {
        throw new Error('IndexedDB upgrade transaction is missing')
      }
      upgradeSchema(request.result, request.transaction)
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        clearDbPromise()
      }
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  }).catch((error) => {
    console.warn('Cashier offline IndexedDB is unavailable:', error)
    clearDbPromise()
    return null
  })
}

export function isCashierOfflineDbAvailable(): boolean {
  return canUseIndexedDb()
}

export async function getCashierOfflineDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return null
  }

  if (!dbPromise) {
    dbPromise = openCashierOfflineDb(CASHIER_OFFLINE_DB_VERSION).then(async (database) => {
      if (!database || hasRequiredStores(database)) {
        return database
      }

      const repairVersion = Math.max(CASHIER_OFFLINE_DB_VERSION, database.version + 1)
      console.warn(
        'Cashier offline IndexedDB schema is missing required stores. Reopening with schema repair:',
        {
          currentVersion: database.version,
          repairVersion,
          existingStores: Array.from(database.objectStoreNames),
        },
      )
      database.close()
      clearDbPromise()
      return openCashierOfflineDb(repairVersion)
    })
  }

  return dbPromise
}

async function resolveDatabaseWithRetry(): Promise<IDBDatabase | null> {
  const database = await getCashierOfflineDb()
  if (database) {
    return database
  }

  clearDbPromise()
  return getCashierOfflineDb()
}

export async function idbGet<T>(storeName: CashierOfflineStoreName, key: IDBValidKey): Promise<T | undefined> {
  const database = await resolveDatabaseWithRetry()
  if (!database) {
    return undefined
  }

  const transaction = database.transaction(storeName, 'readonly')
  const store = transaction.objectStore(storeName)
  const value = await waitForRequest(store.get(key))
  await waitForTransaction(transaction)
  return value as T | undefined
}

export async function idbPut<T>(storeName: CashierOfflineStoreName, value: T): Promise<boolean> {
  const database = await resolveDatabaseWithRetry()
  if (!database) {
    return false
  }

  const transaction = database.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)
  await waitForRequest(store.put(value as IDBValidKey | T))
  await waitForTransaction(transaction)
  return true
}

export async function idbDelete(storeName: CashierOfflineStoreName, key: IDBValidKey): Promise<boolean> {
  const database = await resolveDatabaseWithRetry()
  if (!database) {
    return false
  }

  const transaction = database.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)
  await waitForRequest(store.delete(key))
  await waitForTransaction(transaction)
  return true
}

export async function idbGetAllByIndex<T>(
  storeName: CashierOfflineStoreName,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const database = await resolveDatabaseWithRetry()
  if (!database) {
    return []
  }

  const transaction = database.transaction(storeName, 'readonly')
  const store = transaction.objectStore(storeName)
  if (!store.indexNames.contains(indexName)) {
    await waitForTransaction(transaction)
    return []
  }
  const index = store.index(indexName)
  const values = await waitForRequest(index.getAll(query))
  await waitForTransaction(transaction)
  return values as T[]
}

export async function idbPutMany<T>(storeName: CashierOfflineStoreName, values: T[]): Promise<boolean> {
  const database = await resolveDatabaseWithRetry()
  if (!database) {
    return false
  }

  const transaction = database.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)
  for (const value of values) {
    await waitForRequest(store.put(value as IDBValidKey | T))
  }
  await waitForTransaction(transaction)
  return true
}

export async function idbDeleteMany(storeName: CashierOfflineStoreName, keys: IDBValidKey[]): Promise<boolean> {
  const database = await resolveDatabaseWithRetry()
  if (!database) {
    return false
  }

  const transaction = database.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)
  for (const key of keys) {
    await waitForRequest(store.delete(key))
  }
  await waitForTransaction(transaction)
  return true
}

export async function idbReplaceAllByIndex<T>(
  storeName: CashierOfflineStoreName,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
  values: T[],
): Promise<boolean> {
  const database = await resolveDatabaseWithRetry()
  if (!database) {
    return false
  }

  const transaction = database.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)
  if (!store.indexNames.contains(indexName)) {
    await waitForTransaction(transaction)
    return false
  }

  const index = store.index(indexName)
  const existingKeys = await waitForRequest(index.getAllKeys(query))
  for (const key of existingKeys) {
    await waitForRequest(store.delete(key))
  }
  for (const value of values) {
    await waitForRequest(store.put(value as IDBValidKey | T))
  }

  await waitForTransaction(transaction)
  return true
}

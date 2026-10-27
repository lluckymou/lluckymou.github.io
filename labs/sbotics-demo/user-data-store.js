/**
 * FUTURE-BACKEND boundary for account-owned demo data.
 * Robots, Arenas, personal Tiles, preferences and routine replays are local in
 * IMP-UX.02; these browser stores are not an account source of truth. Program
 * documents join this boundary when their local editor arrives in IMP-UX.03.
 * Device presentation state and generated-thumbnail caches stay elsewhere.
 */
export const LOCAL_DEMO_USER_ID = "local-user";

export const USER_DATA_FUTURE_BACKEND = Object.freeze({
  robot: "IMP-03.06 account resource",
  arena: "IMP-03.06 account resource",
  tile: "IMP-03.06 account resource",
  program: "IMP-UX.03 local IndexedDB, then IMP-03.06 account resource",
  preferences: "IMP-03.05 account preferences",
  replay: "future account replay storage; local retention remains OWN-131"
});

export const LOCAL_DEMO_USER_DATA_DATABASE_NAME = "sbotics.imp-ux-02.demo-user-data";
const DATABASE_NAME = LOCAL_DEMO_USER_DATA_DATABASE_NAME;
const DATABASE_VERSION = 1;
const STORE_NAME = "records";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local user-data request failed"));
  });
}

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("Local user-data transaction aborted"));
    transaction.onerror = () => reject(transaction.error || new Error("Local user-data transaction failed"));
  });
}

export class LocalDemoUserDataStore {
  constructor(userId = LOCAL_DEMO_USER_ID) {
    this.userId = String(userId || LOCAL_DEMO_USER_ID);
    this.databaseName = DATABASE_NAME;
    this.database = null;
    this.openPromise = null;
  }

  async close() {
    if (this.openPromise) {
      try { await this.openPromise; } catch {}
    }
    this.database?.close();
    this.database = null;
    this.openPromise = null;
  }

  open() {
    if (this.database) return Promise.resolve(this.database);
    if (this.openPromise) return this.openPromise;
    if (!globalThis.indexedDB) return Promise.reject(new Error("IndexedDB is unavailable"));

    this.openPromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const records = database.createObjectStore(STORE_NAME, { keyPath: "recordKey" });
          records.createIndex("owner-kind", ["ownerId", "kind"], { unique: false });
        }
      };
      request.onerror = () => reject(request.error || new Error("Local user-data database could not be opened"));
      request.onblocked = () => reject(new Error("Local user-data database upgrade is blocked"));
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          if (this.database === database) this.database = null;
          this.openPromise = null;
        };
        this.database = database;
        resolve(database);
      };
    }).catch((error) => {
      this.openPromise = null;
      throw error;
    });
    return this.openPromise;
  }

  async list(kind) {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const completed = transactionResult(transaction);
    const range = globalThis.IDBKeyRange?.only([this.userId, kind]);
    const request = range
      ? transaction.objectStore(STORE_NAME).index("owner-kind").getAll(range)
      : transaction.objectStore(STORE_NAME).getAll();
    const [rows] = await Promise.all([requestResult(request), completed]);
    return rows
      .filter((row) => row?.ownerId === this.userId && row?.kind === kind)
      .map((row) => {
        return { id: row.id, payload: row.payload, schemaVersion: row.schemaVersion };
      });
  }

  async put(kind, id, payload) {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionResult(transaction);
    try {
      transaction.objectStore(STORE_NAME).put({
        recordKey: `${this.userId}:${kind}:${id}`,
        ownerId: this.userId,
        kind,
        id: String(id),
        schemaVersion: 1,
        persistenceBoundary: USER_DATA_FUTURE_BACKEND[kind] || "FUTURE-BACKEND",
        payload,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      try { transaction.abort(); } catch {}
      await completed.catch(() => {});
      throw error;
    }
    await completed;
  }

  async delete(kind, id) {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionResult(transaction);
    transaction.objectStore(STORE_NAME).delete(`${this.userId}:${kind}:${id}`);
    await completed;
  }
}

/**
 * Offline-first photo queue.
 *
 * A captured photo is compressed, written to IndexedDB and only then reported
 * as "saved" to the clerk. A background drain loop uploads each entry to
 * storage through a presigned URL and registers it against the report. The
 * queue survives a reload, a lost connection and a closed tab, retries with
 * backoff, and never blocks the UI thread on a network call.
 */

import { client } from "./api";
import { prepareImage } from "./images";

const DB_NAME = "in360view-photos";
const STORE = "queue";
const DB_VERSION = 1;
const MAX_ATTEMPTS = 8;

export type QueuedPhoto = {
  id: string;
  reportId: string;
  roomId: string | null;
  itemId: string | null;
  caption: string | null;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  size: number;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
};

export type QueueStatus = {
  pending: number;
  failed: number;
  uploading: string | null;
  online: boolean;
  lastError: string | null;
};

type Listener = (status: QueueStatus) => void;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("reportId", "reportId");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB is unavailable."));
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("The photo store could not be written."));
      }),
  );
}

const listeners = new Set<Listener>();
let status: QueueStatus = {
  pending: 0,
  failed: 0,
  uploading: null,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  lastError: null,
};

function publish(patch: Partial<QueueStatus>) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

export function subscribeQueue(listener: Listener) {
  listeners.add(listener);
  listener(status);
  void refreshCounts();
  return () => {
    listeners.delete(listener);
  };
}

export function queueStatus() {
  return status;
}

async function allEntries(): Promise<QueuedPhoto[]> {
  try {
    return await tx<QueuedPhoto[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedPhoto[]>);
  } catch {
    return [];
  }
}

async function refreshCounts() {
  const entries = await allEntries();
  publish({
    pending: entries.filter((e) => e.attempts < MAX_ATTEMPTS).length,
    failed: entries.filter((e) => e.attempts >= MAX_ATTEMPTS).length,
  });
}

/** Photos still waiting to upload for one report, newest first. */
export async function pendingFor(reportId: string, roomId?: string | null, itemId?: string | null) {
  const entries = await allEntries();
  return entries
    .filter((e) => e.reportId === reportId)
    .filter((e) => (roomId === undefined ? true : e.roomId === roomId))
    .filter((e) => (itemId === undefined ? true : e.itemId === itemId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export type EnqueueTarget = {
  reportId: string;
  roomId?: string | null;
  itemId?: string | null;
  caption?: string | null;
};

/** Compresses and stores one captured file. Resolves once it is safely on disk. */
export async function enqueuePhoto(file: Blob, target: EnqueueTarget) {
  const prepared = await prepareImage(file);
  const entry: QueuedPhoto = {
    id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    reportId: target.reportId,
    roomId: target.roomId ?? null,
    itemId: target.itemId ?? null,
    caption: target.caption ?? null,
    full: prepared.full,
    thumb: prepared.thumb,
    width: prepared.width,
    height: prepared.height,
    size: prepared.full.size,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
  };
  await tx("readwrite", (store) => store.put(entry));
  await refreshCounts();
  void drain();
  return entry;
}

export async function removeQueued(id: string) {
  await tx("readwrite", (store) => store.delete(id));
  await refreshCounts();
}

export async function retryFailed() {
  const entries = await allEntries();
  for (const entry of entries.filter((e) => e.attempts >= MAX_ATTEMPTS)) {
    await tx("readwrite", (store) => store.put({ ...entry, attempts: 0, nextAttemptAt: 0, lastError: null }));
  }
  await refreshCounts();
  void drain();
}

async function put(url: string, body: Blob, contentType: string) {
  const res = await fetch(url, { method: "PUT", body, headers: { "Content-Type": contentType } });
  if (!res.ok) throw new Error(`Upload rejected by storage (${res.status})`);
}

type DrainHook = (reportId: string) => void;
const uploadedHooks = new Set<DrainHook>();

/** Called after each successful upload so screens can refresh their photo lists. */
export function onPhotoUploaded(hook: DrainHook) {
  uploadedHooks.add(hook);
  return () => {
    uploadedHooks.delete(hook);
  };
}

let draining = false;
let drainRequested = false;

type UploadSlot = { storageKey: string; thumbKey: string; uploadUrl: string; thumbUploadUrl: string };
type Outcome = "uploaded" | "retry" | "offline";

/** Records a failed attempt with backoff, and drops photos the report will never accept. */
async function fail(entry: QueuedPhoto, error: unknown): Promise<Outcome> {
  const message = error instanceof Error ? error.message : "The photo could not be uploaded.";
  const attempts = entry.attempts + 1;
  await tx("readwrite", (store) =>
    store.put({
      ...entry,
      attempts,
      nextAttemptAt: Date.now() + Math.min(60_000, 2 ** attempts * 1000),
      lastError: message,
    }),
  );
  publish({ lastError: message });
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    publish({ online: false });
    return "offline";
  }
  // A locked or deleted report will never accept the photo — drop it.
  if (/locked|not found|forbidden/i.test(message)) {
    await tx("readwrite", (store) => store.delete(entry.id));
  }
  return "retry";
}

async function upload(entry: QueuedPhoto, slot: UploadSlot): Promise<Outcome> {
  try {
    // The two objects are independent — send them together, not one after the other.
    await Promise.all([
      put(slot.uploadUrl, entry.full, "image/jpeg"),
      put(slot.thumbUploadUrl, entry.thumb, "image/jpeg"),
    ]);
    await client.photos.register({
      reportId: entry.reportId,
      roomId: entry.roomId,
      itemId: entry.itemId,
      storageKey: slot.storageKey,
      thumbKey: slot.thumbKey,
      contentType: "image/jpeg",
      width: entry.width,
      height: entry.height,
      size: entry.size,
      caption: entry.caption,
      clientId: entry.id,
    });
    await tx("readwrite", (store) => store.delete(entry.id));
    publish({ lastError: null });
    return "uploaded";
  } catch (error) {
    return fail(entry, error);
  }
}

/** How many photos travel to storage at once. Enough to saturate a mobile uplink. */
const UPLOAD_CONCURRENCY = 4;

export async function drain(): Promise<void> {
  // A photo queued mid-drain must not wait for the next sweep to be noticed.
  if (draining) {
    drainRequested = true;
    return;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    publish({ online: false });
    return;
  }
  draining = true;
  publish({ online: true });
  try {
    for (;;) {
      const entries = await allEntries();
      const ready = entries
        .filter((e) => e.attempts < MAX_ATTEMPTS && e.nextAttemptAt <= Date.now())
        .sort((a, b) => a.createdAt - b.createdAt);
      if (!ready.length) break;

      // One presign round-trip covers the whole batch, so keep a batch to one report.
      const reportId = ready[0].reportId;
      const batch = ready.filter((e) => e.reportId === reportId).slice(0, UPLOAD_CONCURRENCY);

      publish({ uploading: batch[0].id });
      let outcomes: Outcome[] = [];
      try {
        const slots = await client.photos.presign({ reportId, count: batch.length, contentType: "image/jpeg" });
        outcomes = await Promise.all(batch.map((entry, i) => upload(entry, slots[i])));
        if (outcomes.includes("uploaded")) {
          for (const hook of uploadedHooks) hook(reportId);
        }
      } catch (error) {
        // Presigning failed, so it failed for every photo in the batch.
        for (const entry of batch) outcomes.push(await fail(entry, error));
      } finally {
        publish({ uploading: null });
        await refreshCounts();
      }

      if (outcomes.includes("offline")) break;
      // Nothing got through: back off rather than spinning on the same batch.
      if (!outcomes.includes("uploaded")) break;
    }
  } finally {
    draining = false;
    await refreshCounts();
  }
  if (drainRequested) {
    drainRequested = false;
    await drain();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    publish({ online: true });
    void drain();
  });
  window.addEventListener("offline", () => publish({ online: false }));
  window.setInterval(() => void drain(), 15_000);
  void drain();
}

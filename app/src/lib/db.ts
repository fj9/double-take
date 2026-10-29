/** Projects and progress live in IndexedDB on the device. Nothing is sent anywhere. */
import type { Progress, Project } from "./model";

const DB_NAME = "doubletake";
const DB_VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress", { keyPath: "projectId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | undefined;
const db = () => (dbPromise ??= open());

function run<T>(store: "projects" | "progress", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const listProjects = () => run<Project[]>("projects", "readonly", (s) => s.getAll());
export const getProject = (id: string) => run<Project | undefined>("projects", "readonly", (s) => s.get(id));
export const putProject = (p: Project) => run("projects", "readwrite", (s) => s.put(p));
export const getProgress = (id: string) => run<Progress | undefined>("progress", "readonly", (s) => s.get(id));
export const putProgress = (p: Progress) => run("progress", "readwrite", (s) => s.put(p));

export async function deleteProject(id: string): Promise<void> {
  await run("projects", "readwrite", (s) => s.delete(id));
  await run("progress", "readwrite", (s) => s.delete(id));
}

/** Ask the browser not to clear our data when space is short. Safe to call more than once. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

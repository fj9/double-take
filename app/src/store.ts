import { signal } from "@preact/signals";
import { newBlankChart, parseChartJson, validateChart } from "@doubletake/core";
import type { Chart, ChartError } from "@doubletake/core";
import leopardJson from "../../fixtures/leopard/leopard.doubletake.json";
import * as db from "./lib/db";
import { newProgress } from "./lib/model";
import type { Backup, Progress, Project } from "./lib/model";

export const projects = signal<Project[]>([]);
export const progressById = signal<Record<string, Progress>>({});
export const ready = signal(false);

/** `duration` is in milliseconds (4000 if left out). `lift` raises it above the round view's control bar. */
export const toast = signal<{ message: string; actionLabel?: string; actionName?: string; onAction?: () => void; duration?: number; lift?: boolean } | null>(null);
/** Set when a new version of the app has been downloaded and is waiting. It is never applied automatically. */
export const pendingUpdate = signal<(() => void) | null>(null);

const leopard = leopardJson as unknown as Chart;

/**
 * Database writes finish a moment after the tap, so a reload straight afterwards could lose it. Progress and
 * unsaved chart edits are also kept in localStorage, which is written at once, and the newer copy wins on start.
 */
function lsGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(`doubletake:${key}`);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}
function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(`doubletake:${key}`, JSON.stringify(value));
  } catch {
    /* full or blocked: the database copy still works */
  }
}
function lsDel(key: string): void {
  try {
    localStorage.removeItem(`doubletake:${key}`);
  } catch {
    /* nothing to do */
  }
}

export const EXAMPLES = [
  { id: "leopard", title: "Leopard", blurb: "The three-colour example from the pattern. The leopard print fades out over the crown.", build: () => structuredClone(leopard) },
] as const;

export async function init(): Promise<void> {
  const list = await db.listProjects();
  const progress: Record<string, Progress> = {};
  for (let i = 0; i < list.length; i++) {
    const p = list[i] as Project;
    const stored = (await db.getProgress(p.id)) ?? newProgress(p.id);
    const mirror = lsGet<Progress>(`progress:${p.id}`);
    const latest = mirror && mirror.updatedAt > stored.updatedAt ? mirror : stored;
    if (latest !== stored) void db.putProgress(latest);
    progress[p.id] = latest;
    const draft = lsGet<{ chart: Chart; name: string }>(`draft:${p.id}`);
    if (draft && validateChart(draft.chart).ok) {
      list[i] = { ...p, chart: draft.chart, name: draft.name || p.name, updatedAt: Date.now() };
      void db.putProject(list[i] as Project).then(() => lsDel(`draft:${p.id}`));
    } else if (draft) {
      lsDel(`draft:${p.id}`);
    }
  }
  projects.value = list.sort((a, b) => b.updatedAt - a.updatedAt);
  progressById.value = progress;
  ready.value = true;
}

export async function createProject(chart: Chart, name = chart.name, stage: Project["stage"] = "knit"): Promise<Project> {
  const now = Date.now();
  const project: Project = { id: crypto.randomUUID(), name, stage, chart, createdAt: now, updatedAt: now };
  const progress = newProgress(project.id, now);
  await db.putProject(project);
  await db.putProgress(progress);
  projects.value = [project, ...projects.value];
  progressById.value = { ...progressById.value, [project.id]: progress };
  void db.requestPersistence();
  return project;
}

/** Save new progress for a project. The screen updates at once; the save follows. */
export function saveProgress(next: Progress): void {
  progressById.value = { ...progressById.value, [next.projectId]: next };
  lsSet(`progress:${next.projectId}`, next);
  void db.putProgress(next).catch(() => {
    toast.value = { message: "Couldn’t save your progress. Free up some space on this device and try again." };
  });
}

export async function removeProject(id: string): Promise<void> {
  lsDel(`progress:${id}`);
  lsDel(`draft:${id}`);
  await db.deleteProject(id);
  projects.value = projects.value.filter((p) => p.id !== id);
  const { [id]: _gone, ...rest } = progressById.value;
  progressById.value = rest;
}

export type ImportResult = { ok: true; project: Project } | { ok: false; errors: ChartError[] };

/** Read the text of a chart file or a backup file. If anything is wrong, nothing is changed. */
export async function importText(text: string): Promise<ImportResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return parseChartJson(text) as ImportResult;
  }
  if (typeof raw === "object" && raw !== null && (raw as { kind?: unknown }).kind === "doubletake-backup/1") {
    const backup = raw as Partial<Backup>;
    const result = validateChart(backup.project?.chart);
    if (!result.ok) return result;
    if (!backup.progress || typeof backup.progress.completed !== "number") {
      return { ok: false, errors: [{ code: "backup", path: "progress", message: "That backup file has no progress in it." }] };
    }
    const now = Date.now();
    const exists = projects.value.some((p) => p.id === backup.project?.id);
    const project: Project = { ...(backup.project as Project), id: exists ? crypto.randomUUID() : (backup.project as Project).id, updatedAt: now };
    const progress: Progress = { ...backup.progress, projectId: project.id };
    await db.putProject(project);
    await db.putProgress(progress);
    projects.value = [project, ...projects.value.filter((p) => p.id !== project.id)];
    progressById.value = { ...progressById.value, [project.id]: progress };
    return { ok: true, project };
  }
  const result = validateChart(raw);
  if (!result.ok) return result;
  return { ok: true, project: await createProject(result.chart) };
}

/** A blank two-colour chart to draw on. */
export function createDrawProject(a: { name: string; hex: string }, b: { name: string; hex: string }, name = "My hat"): Promise<Project> {
  return createProject(newBlankChart(name, [a, b]), name, "design");
}

export async function saveProject(project: Project): Promise<void> {
  const next = { ...project, updatedAt: Date.now() };
  projects.value = projects.value.map((p) => (p.id === next.id ? next : p));
  try {
    await db.putProject(next);
  } catch {
    toast.value = { message: "Couldn’t save your chart. Free up some space on this device and try again." };
  }
}

export function setStage(id: string, stage: "design" | "knit"): Promise<void> {
  const project = projects.value.find((p) => p.id === id);
  return project ? saveProject({ ...project, stage }) : Promise.resolve();
}

let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave: (() => Promise<void>) | undefined;

/** Save a chart that is being edited. Edits come fast, so the save waits a moment; `flushChartSave` forces it. */
export function saveChartSoon(id: string, chart: Chart, name?: string): void {
  lsSet(`draft:${id}`, { chart, name: name ?? projects.value.find((p) => p.id === id)?.name ?? "" });
  pendingSave = async () => {
    const project = projects.value.find((p) => p.id === id);
    if (project) {
      await saveProject({ ...project, chart, name: name ?? project.name });
      lsDel(`draft:${id}`);
    }
  };
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => void flushChartSave(), 500);
}

export async function flushChartSave(): Promise<void> {
  clearTimeout(pendingTimer);
  const run = pendingSave;
  pendingSave = undefined;
  if (run) await run();
}

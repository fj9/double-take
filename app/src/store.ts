import { signal } from "@preact/signals";
import { parseChartJson, validateChart, withPlainCrown } from "@doubletake/core";
import type { Chart, ChartError } from "@doubletake/core";
import leopardJson from "../../fixtures/leopard/leopard-patterned.doubletake.json";
import * as db from "./lib/db";
import { newProgress } from "./lib/model";
import type { Backup, Progress, Project } from "./lib/model";

export const projects = signal<Project[]>([]);
export const progressById = signal<Record<string, Progress>>({});
export const ready = signal(false);

export const toast = signal<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null);
/** Set when a new version of the app has been downloaded and is waiting. It is never applied automatically. */
export const pendingUpdate = signal<(() => void) | null>(null);

const leopard = leopardJson as unknown as Chart;

export const EXAMPLES = [
  { id: "leopard-patterned", title: "Leopard, patterned crown", blurb: "The three-colour example from the pattern. The leopard print carries on through the crown.", build: () => structuredClone(leopard) },
  { id: "leopard-plain", title: "Leopard, plain crown", blurb: "The same hat with a plain crown: purple outside, pink inside, no duplicate stitch on the crown.", build: () => withPlainCrown(structuredClone(leopard), 76) },
] as const;

export async function init(): Promise<void> {
  const list = await db.listProjects();
  const progress: Record<string, Progress> = {};
  for (const p of list) {
    const pr = await db.getProgress(p.id);
    progress[p.id] = pr ?? newProgress(p.id);
  }
  projects.value = list.sort((a, b) => b.updatedAt - a.updatedAt);
  progressById.value = progress;
  ready.value = true;
}

export async function createProject(chart: Chart, name = chart.name): Promise<Project> {
  const now = Date.now();
  const project: Project = { id: crypto.randomUUID(), name, chart, createdAt: now, updatedAt: now };
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
  void db.putProgress(next).catch(() => {
    toast.value = { message: "Couldn’t save your progress. Free up some space on this device and try again." };
  });
}

export async function removeProject(id: string): Promise<void> {
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

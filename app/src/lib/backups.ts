import type { Backup, Progress, Project } from "./model";
import { download, slug } from "./files";

const key = (id: string) => `doubletake.backup.${id}`;

/** When this hat was last backed up from this device, or null. Kept only on this device. */
export function lastBackup(id: string): number | null {
  try {
    const v = Number(localStorage.getItem(key(id)));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

function remember(ids: string[]): void {
  try {
    for (const id of ids) localStorage.setItem(key(id), String(Date.now()));
  } catch {
    /* the date is a convenience */
  }
}

export const backupDate = (t: number | null) => (t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : null);

/** Save one hat with where you are. */
export function backupHat(project: Project, progress: Progress): void {
  const data: Backup = { kind: "doubletake-backup/1", project, progress };
  download(`${slug(project.name)}.doubletake-backup.json`, JSON.stringify(data));
  remember([project.id]);
}

/** Save every hat in one file. */
export function backupAllHats(hats: { project: Project; progress: Progress }[]): void {
  download("doubletake-all-hats.doubletake-backup.json", JSON.stringify({ kind: "doubletake-backup-all/1", hats: hats.map((h) => ({ kind: "doubletake-backup/1", ...h })) }));
  remember(hats.map((h) => h.project.id));
}

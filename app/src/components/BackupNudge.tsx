import { useState } from "preact/hooks";
import { backupHat } from "../lib/backups";
import type { Progress, Project } from "../lib/model";

const key = (id: string) => `doubletake.nudge.${id}`;

const MILESTONES = [
  { at: 3, message: "The body is finished and the crown is next. A good moment to save a backup of where you are." },
  { at: 2, message: "You’re at round 75, the start of the crown. A good moment to save a backup of where you are." },
  { at: 1, message: "Cast on is done. A good moment to save a backup, so the hat is safe if anything happens to this device." },
];

/** The furthest milestone reached: 1 cast on done, 2 round 75, 3 round 95. */
export function milestone(progress: Progress): number {
  if (progress.completed >= 95) return 3;
  if (progress.completed >= 75) return 2;
  return progress.steps.caston ? 1 : 0;
}

function seen(id: string): number {
  try {
    return Number(localStorage.getItem(key(id))) || 0;
  } catch {
    return 0;
  }
}

/** A gentle prompt at cast on, round 75 and round 95 to save a backup. It asks once per milestone. */
export function BackupNudge({ project, progress }: { project: Project; progress: Progress }) {
  const [, redraw] = useState(0);
  const m = milestone(progress);
  if (m === 0 || m <= seen(project.id)) return null;
  const text = MILESTONES.find((x) => x.at === m)?.message ?? "";
  const close = () => {
    try {
      localStorage.setItem(key(project.id), String(m));
    } catch {
      /* the prompt may come back */
    }
    redraw((n) => n + 1);
  };
  return (
    <div class="card note" role="region" aria-label="Back up your hat">
      <p style="margin:0 0 8px">{text}</p>
      <div class="row" style="flex-wrap:wrap">
        <button
          class="btn small primary"
          onClick={() => {
            backupHat(project, progress);
            close();
          }}
        >
          Back up my progress
        </button>
        <button class="btn small" onClick={close}>
          Not now
        </button>
      </div>
    </div>
  );
}

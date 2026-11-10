import { useState } from "preact/hooks";
import { BODY_ROUNDS, LAST_ROUND } from "@doubletake/core";
import { backupHat } from "../lib/backups";
import type { Progress, Project } from "../lib/model";

const key = (id: string) => `doubletake.nudge.${id}`;

const MILESTONES = [
  { at: 3, message: "The body is finished and the crown is next. A good moment to save a backup of where you are." },
  { at: 2, message: `You’re at round ${BODY_ROUNDS}, the start of the crown. A good moment to save a backup of where you are.` },
  { at: 1, message: "Cast on is done. A good moment to save a backup, so the hat is safe if anything happens to this device." },
];

/** The furthest milestone reached: 1 cast on done, 2 end of the body, 3 end of the crown. */
export function milestone(progress: Progress): number {
  if (progress.completed >= LAST_ROUND) return 3;
  if (progress.completed >= BODY_ROUNDS) return 2;
  return progress.steps.caston ? 1 : 0;
}

function seen(id: string): number {
  try {
    return Number(localStorage.getItem(key(id))) || 0;
  } catch {
    return 0;
  }
}

/** A gentle prompt at cast on, the end of the body and the end of the crown to save a backup. It asks once per milestone. */
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

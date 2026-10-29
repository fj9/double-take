import { useEffect, useState } from "preact/hooks";
import type { Project, Progress, Backup } from "../lib/model";
import { download, slug } from "../lib/files";
import {
  highContrast,
  keepAwake,
  setHighContrast,
  setKeepAwake,
  setShowDuplicate,
  setTheme,
  showDuplicate,
  theme,
  zoom,
  zoomBy,
  type Theme,
} from "../lib/settings";
import { removeProject, toast } from "../store";

export function MoreScreen({ project, progress }: { project: Project; progress: Progress }) {
  const [confirming, setConfirming] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const backup = () => {
    const data: Backup = { kind: "doubletake-backup/1", project, progress };
    download(`${slug(project.name)}.doubletake-backup.json`, JSON.stringify(data));
    toast.value = { message: "Backup saved. Keep the file somewhere safe." };
  };

  return (
    <div class="stack">
      <h1>More</h1>

      <section class="card" aria-labelledby="look">
        <h2 id="look">Look and feel</h2>
        <div class="stack">
          <div>
            <div id="theme-label" class="small muted">
              Colour theme
            </div>
            <div class="seg" role="group" aria-labelledby="theme-label">
              {(["system", "light", "dark"] as Theme[]).map((t) => (
                <button key={t} aria-pressed={theme.value === t} onClick={() => setTheme(t)}>
                  {t === "system" ? "System" : t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>
          <label class="check">
            <input type="checkbox" checked={highContrast.value} onChange={(e) => setHighContrast((e.currentTarget as HTMLInputElement).checked)} />
            High-contrast charts
          </label>
          <label class="check">
            <input type="checkbox" checked={showDuplicate.value} onChange={(e) => setShowDuplicate((e.currentTarget as HTMLInputElement).checked)} />
            Show duplicate stitch dots on the round view
          </label>
          <label class="check">
            <input type="checkbox" checked={keepAwake.value} onChange={(e) => setKeepAwake((e.currentTarget as HTMLInputElement).checked)} />
            Keep the screen awake while I knit
          </label>
          <div class="row">
            <span>Chart size</span>
            <div class="seg" role="group" aria-label="Chart size">
              <button aria-label="Smaller charts" onClick={() => zoomBy(-1)}>
                −
              </button>
              <button aria-label="Larger charts" onClick={() => zoomBy(1)}>
                +
              </button>
            </div>
            <span class="muted small num">{zoom.value} px a square</span>
          </div>
        </div>
      </section>

      <section class="card" aria-labelledby="yours">
        <h2 id="yours">This hat</h2>
        <p class="small">
          <strong>{project.name}</strong>. Everything is kept on this device. Nothing is sent anywhere.
        </p>
        {persisted === false && (
          <p class="small muted">Your browser may clear this data if the device runs short of space. Back up now and then, and install Doubletake to your home screen to help keep it.</p>
        )}
        <div class="row" style="flex-wrap:wrap">
          <button class="btn" onClick={backup}>
            Back up this hat
          </button>
          <button class="btn" onClick={() => download(`${slug(project.name)}.doubletake.json`, JSON.stringify(project.chart, null, 1))}>
            Save the chart file
          </button>
        </div>
        <p class="small muted">A backup has your chart and where you are. The chart file has the chart only, so you can share it.</p>
      </section>

      <section class="card" aria-labelledby="remove">
        <h2 id="remove">Remove this hat</h2>
        {!confirming ? (
          <button class="btn danger" onClick={() => setConfirming(true)}>
            Remove this hat…
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="confirm-title">
            <p id="confirm-title">
              This removes <strong>{project.name}</strong> and your progress ({progress.completed} of 95 rounds done) from this device. If you haven’t backed it up, it can’t be brought back.
            </p>
            <div class="row" style="flex-wrap:wrap">
              <button
                class="btn danger"
                onClick={async () => {
                  await removeProject(project.id);
                  location.hash = "#/";
                }}
              >
                Remove it
              </button>
              <button class="btn" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </section>

      <p>
        <a href="#/about">About Doubletake</a>
      </p>
    </div>
  );
}

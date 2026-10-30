import { useState } from "preact/hooks";
import type { Project, Progress } from "../lib/model";
import { download, downloadBytes, slug } from "../lib/files";
import { exportAll } from "../lib/exports";
import { backupDate, backupHat, lastBackup } from "../lib/backups";
import { Flat } from "../components/Flat";
import { removeProject, renameProject, toast } from "../store";

/** Everything about one hat: its name, its chart, keeping and sharing it, printing it, and removing it. */
export function HatScreen({ project, progress }: { project: Project; progress: Progress }) {
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(project.name);
  const [saved, setSaved] = useState(lastBackup(project.id));
  const last = backupDate(saved);

  return (
    <div class="stack">
      <h1>Hat</h1>

      <section class="card" aria-labelledby="hat-name">
        <h2 id="hat-name">Name</h2>
        <input class="input" aria-label="Hat name" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} onBlur={() => (name.trim() ? renameProject(project.id, name) : setName(project.name))} />
        <p class="small muted" style="margin:8px 0 0">Everything is kept on this device. Nothing is sent anywhere.</p>
      </section>

      <section class="card" aria-labelledby="the-chart">
        <h2 id="the-chart">The chart</h2>
        <Flat chart={project.chart} bodyOnly picture label={`${project.name}, outside, laid flat.`} />
        <p style="margin:8px 0 0">
          <a href={`#/p/${project.id}/review`}>Review the chart</a>
        </p>
      </section>

      <section class="card" aria-labelledby="keep">
        <h2 id="keep">Keep and share</h2>
        <div class="row" style="flex-wrap:wrap">
          <button
            class="btn"
            onClick={() => {
              backupHat(project, progress);
              setSaved(lastBackup(project.id));
              toast.value = { message: "Backup saved. Keep the file somewhere safe." };
            }}
          >
            Back up my progress
          </button>
          <button class="btn" onClick={() => download(`${slug(project.name)}.doubletake.json`, JSON.stringify(project.chart, null, 1))}>
            Share the chart (no progress)
          </button>
        </div>
        <p class="small muted" style="margin:8px 0 0">{last ? `Last backed up ${last}. ` : "Not backed up yet. "}A backup has your chart and where you are. The shared chart has the chart only.</p>
      </section>

      <section class="card" aria-labelledby="export">
        <h2 id="export">Print and export</h2>
        <div class="row" style="flex-wrap:wrap">
          <a class="btn" href={`#/p/${project.id}/print`}>
            Chart pages (PDF)
          </a>
          <button
            class="btn"
            onClick={async () => {
              try {
                const { filename, data } = await exportAll(project.chart, project.name);
                downloadBytes(filename, data, "application/zip");
                toast.value = { message: "Saved. The zip has pictures, vector pictures, spreadsheets and a shopping list." };
              } catch (e) {
                toast.value = { message: e instanceof Error ? e.message : "Couldn’t make the zip." };
              }
            }}
          >
            Download everything (zip)
          </button>
        </div>
        <p class="small muted" style="margin:8px 0 0">
          The chart pages are A4, one chart to a page, like the pattern. The zip has the chart file, PNG and SVG pictures of the outside and inside, spreadsheets (CSV) in knitting order, and a shopping list.
        </p>
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
    </div>
  );
}

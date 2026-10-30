import { useEffect, useState } from "preact/hooks";
import { APP_VERSION } from "../content";
import { backupAllHats } from "../lib/backups";
import { newProgress } from "../lib/model";
import { keepAwake, setKeepAwake, setTheme, theme, type Theme } from "../lib/settings";
import { progressById, projects, toast } from "../store";

/** Things about the app, not about one hat. */
export function SettingsScreen() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  const hats = projects.value;

  return (
    <div class="stack">
      <h1>Settings</h1>

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
            <input type="checkbox" checked={keepAwake.value} onChange={(e) => setKeepAwake((e.currentTarget as HTMLInputElement).checked)} />
            Keep the screen awake while I knit
          </label>
          <p class="small muted" style="margin:0">Chart size, letters, duplicate stitch dots and high-contrast charts are in the View button on the round screen.</p>
        </div>
      </section>

      <section class="card" aria-labelledby="storage">
        <h2 id="storage">Your hats on this device</h2>
        <p class="small">
          {hats.length} {hats.length === 1 ? "hat is" : "hats are"} kept here. Nothing is sent anywhere.
        </p>
        {persisted === false && (
          <p class="small muted">Your browser may clear this data if the device runs short of space. Back up now and then, and install Doubletake to your home screen to help keep it.</p>
        )}
        <button
          class="btn"
          disabled={hats.length === 0}
          onClick={() => {
            backupAllHats(hats.map((project) => ({ project, progress: progressById.value[project.id] ?? newProgress(project.id) })));
            toast.value = { message: "Backup saved. Keep the file somewhere safe." };
          }}
        >
          Back up all hats
        </button>
      </section>

      <section class="card" aria-labelledby="about-app">
        <h2 id="about-app">About</h2>
        <p class="small" style="margin:0 0 8px">Version {APP_VERSION}</p>
        <a href="#/about">About Doubletake, credits and what’s new</a>
      </section>
    </div>
  );
}

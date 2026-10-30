import { useEffect, useState } from "preact/hooks";
import { LINKS } from "./content";
import { AboutScreen } from "./screens/AboutScreen";
import { DrawScreen } from "./screens/DrawScreen";
import { DuplicateScreen } from "./screens/DuplicateScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MakeScreen } from "./screens/MakeScreen";
import { PrintScreen } from "./screens/PrintScreen";
import { HatScreen } from "./screens/HatScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { RoundScreen } from "./screens/RoundScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SkillScreen } from "./screens/SkillScreen";
import { StepsScreen } from "./screens/StepsScreen";
import { currentRound, newProgress, percentComplete, TOTAL_ROUNDS } from "./lib/model";
import { pendingUpdate, progressById, projects, ready, toast } from "./store";

function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash.replace(/^#\/?/, "");
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

function Wordmark() {
  return (
    <a class="wordmark" href="#/" aria-label="Doubletake, home">
      <span class="l">double</span>
      <span class="b">take</span>
    </a>
  );
}

function Footer() {
  return (
    <footer class="footer">
      <nav aria-label="Links">
        <a href="#/about">About</a>
        {LINKS.map((l) => (
          <a key={l.name} href={l.url} target="_blank" rel="noreferrer">
            {l.name}
          </a>
        ))}
      </nav>
      <p class="byline">Made by Freya’d Knot</p>
      <p class="small muted" style="margin:0">
        Enjoying Doubletake? Tips on Ko-fi are always appreciated.
      </p>
    </footer>
  );
}

function Toast() {
  const t = toast.value;
  const update = pendingUpdate.value;
  useEffect(() => {
    if (!t || update) return;
    const id = setTimeout(() => (toast.value = null), t.duration ?? 4000);
    return () => clearTimeout(id);
  }, [t, update]);
  if (update) {
    return (
      <div class="toast" role="status">
        <span>A new version is ready. Update when you reach a good stopping point.</span>
        <button class="btn" onClick={update}>
          Update now
        </button>
      </div>
    );
  }
  if (!t) return null;
  return (
    <div class={`toast ${t.lift ? "lift" : ""}`} role="status">
      <span>{t.message}</span>
      {t.actionLabel && (
        <button
          class="btn"
          aria-label={t.actionName}
          onClick={() => {
            t.onAction?.();
            toast.value = null;
          }}
        >
          {t.actionLabel}
        </button>
      )}
    </div>
  );
}

type Tab = "round" | "steps" | "duplicate" | "hat" | "draw" | "review" | "print";
const KNIT_TABS: Tab[] = ["round", "steps", "duplicate", "hat", "review", "print"];
const DESIGN_TABS: Tab[] = ["draw", "review", "hat", "print"];

/** Shown in the side rail only: which hat this is, how far along it is, and a way back to the round. */
function RailInfo({ project, progress, designing, tab }: { project: { id: string; name: string }; progress?: { completed: number }; designing: boolean; tab: Tab | null }) {
  const p = progress as Parameters<typeof percentComplete>[0] | undefined;
  return (
    <div class="rail-info">
      <strong>{project.name}</strong>
      {!designing && p && (
        <>
          <span class="small muted num">
            Round {currentRound(p)}/{TOTAL_ROUNDS}
          </span>
          <progress max={100} value={percentComplete(p)} aria-label="How much of the hat is knitted" />
          {tab !== "round" && (
            <a class="btn small" href={`#/p/${project.id}/round`}>
              Back to round
            </a>
          )}
        </>
      )}
    </div>
  );
}

export function App() {
  const route = useHash();
  const parts = route.split("/");
  const inProject = parts[0] === "p" && !!parts[1];
  const projectId = inProject ? (parts[1] as string) : null;
  const asked = (inProject ? (parts[2] === "more" ? "hat" : parts[2] || "") : "") as Tab | "";
  const project = projectId ? projects.value.find((p) => p.id === projectId) : undefined;
  const progress = projectId ? (progressById.value[projectId] ?? newProgress(projectId)) : undefined;
  const designing = project?.stage === "design";
  const hasDuplicate = (project?.chart.duplicate.length ?? 0) > 0;
  // A hat being designed shows Draw and Review; a hat being knitted shows the tracker. Anything else falls back to the first.
  const allowed = designing ? DESIGN_TABS : KNIT_TABS;
  const tab: Tab | null = inProject ? (allowed.includes(asked as Tab) ? (asked as Tab) : (allowed[0] as Tab)) : null;

  let body;
  let tool = false;
  if (route === "about") {
    body = <AboutScreen />;
  } else if (route === "make") {
    body = <MakeScreen />;
  } else if (route === "settings") {
    body = <SettingsScreen />;
  } else if (route === "skill") {
    body = <SkillScreen />;
  } else if (inProject) {
    if (!ready.value) body = <p>Loading…</p>;
    else if (!project || !progress) {
      body = (
        <div>
          <h1>That hat isn’t here</h1>
          <p>It may have been removed from this device. Nothing here yet? Start a new hat.</p>
          <a class="btn primary" href="#/">
            Back to your hats
          </a>
        </div>
      );
    } else if (tab === "draw") {
      body = <DrawScreen project={project} />;
      tool = true;
    } else if (tab === "print") {
      body = <PrintScreen project={project} />;
      tool = true;
    } else if (tab === "review") body = <ReviewScreen project={project} progress={progress} />;
    else if (tab === "steps") body = <StepsScreen chart={project.chart} progress={progress} />;
    else if (tab === "duplicate") body = <DuplicateScreen chart={project.chart} progress={progress} />;
    else if (tab === "hat") body = <HatScreen project={project} progress={progress} />;
    else {
      body = <RoundScreen chart={project.chart} progress={progress} />;
      tool = true;
    }
  } else {
    body = ready.value ? <HomeScreen /> : <p>Loading…</p>;
  }

  const showTabs = inProject && !!project && tab !== "print";
  const tabLink = (id: Tab, label: string, d: string) => (
    <a href={`#/p/${projectId}/${id}`} aria-current={tab === id ? "page" : undefined}>
      <Icon d={d} />
      {label}
    </a>
  );

  return (
    <div class={`shell ${showTabs ? "has-tabs" : ""}`}>
      <header class="topbar">
        <Wordmark />
        {project && <span class="small muted hat-name">{project.name}</span>}
        <a class="gear" href="#/settings" aria-label="Settings" aria-current={route === "settings" ? "page" : undefined}>
          <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </a>
      </header>
      <main class={`page ${showTabs ? "" : "no-tabs"} ${(tab === "round" || tab === "draw" || tab === "review" || tab === "duplicate" || route === "make") && body ? "wide" : ""}`} id="main">
        {body}
        {!tool && <Footer />}
      </main>
      {showTabs && (
        <nav class="tabs" aria-label="Sections">
          <RailInfo project={project} progress={progress} designing={designing} tab={tab} />
          {designing ? (
            <>
              {tabLink("draw", "Draw", "M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3")}
              {tabLink("review", "Review", "M5 12l4 4 10-10")}
            </>
          ) : (
            <>
              {tabLink("round", "Round", "M12 3v18M5 10l7-7 7 7")}
              {tabLink("steps", "Steps", "M4 6h16M4 12h16M4 18h10")}
              {hasDuplicate && tabLink("duplicate", "Stitch", "M12 4a8 8 0 100 16 8 8 0 000-16zM8 12l3 3 5-6")}
            </>
          )}
          {tabLink("hat", "Hat", "M4 18c0-6 3-11 8-11s8 5 8 11zM3 18h18M12 7V4")}
        </nav>
      )}
      <Toast />
    </div>
  );
}

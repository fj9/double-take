import { useEffect, useState } from "preact/hooks";
import { LINKS } from "./content";
import { AboutScreen } from "./screens/AboutScreen";
import { DuplicateScreen } from "./screens/DuplicateScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MoreScreen } from "./screens/MoreScreen";
import { RoundScreen } from "./screens/RoundScreen";
import { StepsScreen } from "./screens/StepsScreen";
import { newProgress } from "./lib/model";
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
    const id = setTimeout(() => (toast.value = null), 4000);
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
    <div class="toast" role="status">
      <span>{t.message}</span>
      {t.actionLabel && (
        <button class="btn" onClick={t.onAction}>
          {t.actionLabel}
        </button>
      )}
    </div>
  );
}

type Tab = "round" | "steps" | "duplicate" | "more";

export function App() {
  const route = useHash();
  const parts = route.split("/");
  const inProject = parts[0] === "p" && !!parts[1];
  const projectId = inProject ? (parts[1] as string) : null;
  const tab = (inProject ? (parts[2] || "round") : null) as Tab | null;
  const project = projectId ? projects.value.find((p) => p.id === projectId) : undefined;
  const progress = projectId ? (progressById.value[projectId] ?? newProgress(projectId)) : undefined;
  const hasDuplicate = (project?.chart.duplicate.length ?? 0) > 0;

  let body;
  let tool = false;
  if (route === "about") {
    body = <AboutScreen />;
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
    } else if (tab === "steps") body = <StepsScreen chart={project.chart} progress={progress} />;
    else if (tab === "duplicate") body = <DuplicateScreen chart={project.chart} progress={progress} />;
    else if (tab === "more") body = <MoreScreen project={project} progress={progress} />;
    else {
      body = <RoundScreen chart={project.chart} progress={progress} />;
      tool = true;
    }
  } else {
    body = ready.value ? <HomeScreen /> : <p>Loading…</p>;
  }

  const showTabs = inProject && !!project;
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
        {project && <span class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{project.name}</span>}
      </header>
      <main class={`page ${showTabs ? "" : "no-tabs"}`} id="main">
        {body}
        {!tool && <Footer />}
      </main>
      {showTabs && (
        <nav class="tabs" aria-label="Sections">
          {tabLink("round", "Round", "M12 3v18M5 10l7-7 7 7")}
          {tabLink("steps", "Steps", "M4 6h16M4 12h16M4 18h10")}
          {hasDuplicate && tabLink("duplicate", "Stitch", "M12 4a8 8 0 100 16 8 8 0 000-16zM8 12l3 3 5-6")}
          {tabLink("more", "More", "M5 12h.01M12 12h.01M19 12h.01")}
        </nav>
      )}
      <Toast />
    </div>
  );
}

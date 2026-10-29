import { APP_VERSION, CHANGELOG, HASHTAG, LINKS } from "../content";

export function AboutScreen() {
  return (
    <div class="stack">
      <h1>About Doubletake</h1>
      <p>
        Doubletake is a companion to the <em>doubletake</em> pattern by Freya’d Knot: a stretchy, slouchy, fully reversible double-knit beanie, worked in the round from the brim to the crown. It keeps your place round by round and tracks your duplicate stitch, patch by patch.
      </p>
      <section class="card">
        <h2>Your data</h2>
        <p style="margin:0">Your hats and progress are kept on this device only. No account, no tracking, nothing sent anywhere. Doubletake works offline once it has loaded.</p>
      </section>
      <section class="card">
        <h2>Credits and copyright</h2>
        <p>The hat’s construction follows the free Chrysanthemum hat by mirielgw.</p>
        <p style="margin:0">© 2026 Freya’d Knot. The leopard charts and the pattern are for personal use only.</p>
      </section>
      {HASHTAG && (
        <section class="card">
          <h2>Share your hat</h2>
          <p style="margin:0">Finished? Share a photo with {HASHTAG}.</p>
        </section>
      )}
      <section class="card">
        <h2>Find Freya’d Knot</h2>
        <div class="row" style="flex-wrap:wrap">
          {LINKS.map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noreferrer" style="min-height:44px;display:inline-flex;align-items:center">
              {l.name}
            </a>
          ))}
        </div>
      </section>
      <section class="card">
        <h2>Version {APP_VERSION}</h2>
        {CHANGELOG.map((c) => (
          <p key={c.version} class="small" style="margin:0">
            <strong>{c.version}</strong>, {c.date}. {c.notes}
          </p>
        ))}
      </section>
    </div>
  );
}

export function SkillScreen() {
  return (
    <div class="stack">
      <h1>Make a chart with Claude</h1>
      <p>
        The Doubletake skill lets Claude take you through the choices: it looks at your picture, suggests how many colours to use, shows you the options side by side, and gives you a chart file to import here. It uses the same code as <a href="#/make">Make a chart from a picture</a>, so the chart is the same.
      </p>
      <p class="muted small">You don’t need Claude to use Doubletake. This is an extra way to make a chart if you like talking it through.</p>

      <section class="card" aria-labelledby="how">
        <h2 id="how">How to use it</h2>
        <ol style="margin:0;padding-left:20px">
          <li style="margin-bottom:12px">
            Download the skill.
            <div style="margin-top:8px">
              <a class="btn primary" href="./skill/doubletake-chart-skill.zip" download>
                Download the skill
              </a>
            </div>
          </li>
          <li style="margin-bottom:12px">Add it to Claude as a skill (in Claude’s settings, under skills). In Claude Code, unzip it into your skills folder, <code>~/.claude/skills</code>.</li>
          <li style="margin-bottom:12px">Give Claude your picture and say: “Make me a Doubletake chart from this picture.”</li>
          <li>Claude gives you a chart file (ending <code>.doubletake.json</code>). Come back here and choose <strong>Import a chart file</strong>.</li>
        </ol>
      </section>

      <section class="card" aria-labelledby="what">
        <h2 id="what">What you need</h2>
        <p style="margin:0">A Claude account with skills turned on, and a place where Claude can run scripts. The script needs Node 18 or later and nothing else to install.</p>
      </section>

      <section class="card" aria-labelledby="privacy">
        <h2 id="privacy">Your picture</h2>
        <p style="margin:0">Doubletake itself never uploads your picture. If you give a picture to Claude, it goes to Claude, as anything you share with Claude does. Only use pictures you have the right to use.</p>
      </section>

      <p>
        <a href="#/">Back to your hats</a>
      </p>
    </div>
  );
}

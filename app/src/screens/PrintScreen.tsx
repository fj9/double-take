import { useEffect } from "preact/hooks";
import type { Chart } from "@doubletake/core";
import { LINKS } from "../content";
import { chartPages, stripeBlocks } from "../lib/pages";
import type { Project } from "../lib/model";
import { textOn } from "../lib/render";

const FOOTER_LINKS = LINKS.filter((l) => l.name !== "GitHub");
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function Heading({ name }: { name: string }) {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  const last = words.pop() ?? "chart";
  return (
    <div class="hdr">
      {words.length > 0 && <span class="l">{words.join(" ")} </span>}
      <span class="b">{last}</span>
    </div>
  );
}

function Key({ items }: { items: { hex?: string; letter?: string; text: string }[] }) {
  return (
    <div class="pkey">
      {items.map((k, i) => (
        <span key={i}>
          {k.letter && (
            <i style={k.hex ? `background:${k.hex};color:${textOn(k.hex)}` : ""}>{k.letter}</i>
          )}
          {k.text}
        </span>
      ))}
    </div>
  );
}

function Footer({ n, total, chart }: { n: number; total: number; chart: Chart }) {
  return (
    <footer>
      <div class="links">
        {FOOTER_LINKS.map((l) => (
          <a key={l.name} href={l.url}>
            <b>{l.name}</b> <u>{shortUrl(l.url)}</u>
          </a>
        ))}
      </div>
      <div class="legal">
        <span>{chart.source?.kind === "example" ? "© 2026 Freya’d Knot. Pattern for personal use only." : "Chart made with Doubletake by Freya’d Knot."}</span>
        <span>
          Page {n} of {total}
        </span>
      </div>
    </footer>
  );
}

/** The chart pages on A4 sheets, in house style. "Print" then "Save as PDF" makes the PDF. */
export function PrintScreen({ project }: { project: Project }) {
  const chart = project.chart;
  const pages = chartPages(chart);
  const total = pages.length + 1;

  useEffect(() => {
    const before = document.title;
    document.title = `${project.name} charts`;
    return () => {
      document.title = before;
    };
  }, [project.name]);

  const blocks = stripeBlocks(chart);
  const name = (id: string) => chart.yarns.find((y) => y.id === id)?.name ?? id;

  return (
    <div>
      <div class="noprint stack" style="margin-bottom:16px">
        <h1>Chart pages</h1>
        <p class="muted">
          A4 pages in house style, one chart to a page. Choose <strong>Print</strong>, then pick <strong>Save as PDF</strong> as the printer. Print at 100% size so the stitches are the right shape.
        </p>
        <div class="row" style="flex-wrap:wrap">
          <button class="btn primary" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <a class="btn" href={`#/p/${project.id}/more`}>
            Back
          </a>
        </div>
      </div>
      <div class="sheets">
        <section class="sheet" aria-label="How to read these charts">
          <Heading name={project.name} />
          <div class="rule" />
          <h2>how to read the charts</h2>
          <p class="meta">
            Each square is one stitch pair: a knit stitch (the outside) and a purl stitch (the inside) worked together. The colour of the square is the colour on the outside. Every round has 112 stitch pairs, shown in two halves: Chart A (stitch pairs 1–56) and Chart B (57–112). Work Chart A, then Chart B, to finish the round. Read every round from right to left, starting at round 1 at the bottom of each chart. Rounds 1–75 are the body, and rounds 76–95 are the crown.
          </p>
          <h3>yarns</h3>
          <Key items={chart.yarns.map((y) => ({ hex: y.hex, letter: y.id, text: `${y.name} (${y.role === "main" ? "main colour" : y.role === "stripe" ? "stripe colour" : "duplicate stitch"})` }))} />
          {blocks.length > 0 && (
            <>
              <h3>stripes</h3>
              <table class="ptable">
                <thead>
                  <tr>
                    <th>Rounds</th>
                    <th>Yarns</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.from}>
                      <td>
                        {b.from === b.to ? b.from : `${b.from}–${b.to}`}
                      </td>
                      <td>
                        {b.yarns[0]} {name(b.yarns[0])} + {b.yarns[1]} {name(b.yarns[1])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p class="meta">Change colours at the start of a round, at the marker.</p>
            </>
          )}
          <h3>yardage</h3>
          <p class="meta">
            <strong>Yardage isn’t calculated yet.</strong> Buy more than you think you need and keep some spare: it depends on your design, tension and yarn, and duplicate stitch uses the most extra.
          </p>
          <Footer n={1} total={total} chart={chart} />
        </section>
        {pages.map((p, i) => (
          <section class="sheet" key={p.id} aria-label={p.title}>
            <Heading name={project.name} />
            <div class="rule" />
            <h2>{p.title}</h2>
            <p class="meta">{p.meta}</p>
            <Key items={p.legend} />
            <div class="svgwrap" dangerouslySetInnerHTML={{ __html: p.svg }} />
            <Footer n={i + 2} total={total} chart={chart} />
          </section>
        ))}
      </div>
    </div>
  );
}

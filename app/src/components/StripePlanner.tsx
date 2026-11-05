import type { Chart, YarnId } from "@doubletake/core";

interface Block {
  from: number;
  to: number;
  pair: [YarnId, YarnId];
}

const same = (a: [YarnId, YarnId], b: [YarnId, YarnId]) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

/** Runs of rounds that are worked in the same two yarns. */
export function blocksOf(chart: Chart): Block[] {
  const out: Block[] = [];
  (chart.round_pairs ?? []).forEach((pair, i) => {
    const last = out[out.length - 1];
    if (last && same(last.pair, pair)) last.to = i + 1;
    else out.push({ from: i + 1, to: i + 1, pair: [pair[0], pair[1]] });
  });
  return out;
}

/** Every round's pair again, from blocks. */
const pairsOf = (blocks: Block[], total: number): [YarnId, YarnId][] =>
  Array.from({ length: total }, (_, i) => (blocks.find((b) => i + 1 >= b.from && i + 1 <= b.to) as Block).pair);

interface Props {
  chart: Chart;
  total: number;
  onPairs: (pairs: [YarnId, YarnId][]) => void;
}

/** Which two colours each stretch of the hat is worked in. */
export function StripePlanner({ chart, total, onPairs }: Props) {
  const blocks = blocksOf(chart);
  const name = (id: string) => chart.yarns.find((y) => y.id === id)?.name ?? id;
  const commit = (next: Block[]) => onPairs(pairsOf(next, total));

  const setPair = (i: number, slot: 0 | 1, id: YarnId) => {
    const b = blocks[i] as Block;
    const pair: [YarnId, YarnId] = slot === 0 ? [id, b.pair[1]] : [b.pair[0], id];
    if (pair[0] === pair[1]) return; // two different yarns are needed
    commit(blocks.map((x, j) => (j === i ? { ...x, pair } : x)));
  };
  /** Where one stripe stops and the next starts. */
  const setEnd = (i: number, to: number) => {
    const next = blocks.map((b) => ({ ...b }));
    const lo = (next[i] as Block).from;
    const hi = (next[i + 1] as Block).to - 1;
    const end = Math.max(lo, Math.min(hi, Math.round(to)));
    (next[i] as Block).to = end;
    (next[i + 1] as Block).from = end + 1;
    commit(next);
  };
  const split = () => {
    const widest = blocks.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
    if (widest.to - widest.from < 1) return;
    const mid = Math.floor((widest.from + widest.to) / 2);
    // The new stripe takes a pair that is different from its neighbours, keeping one yarn of the stripe it comes out of if it can
    const index = blocks.indexOf(widest);
    const after = blocks[index + 1]?.pair;
    const ids = chart.yarns.map((y) => y.id);
    const candidates = ids.flatMap((x) => ids.filter((y) => y !== x).map((y): [YarnId, YarnId] => [x, y]));
    const fresh = candidates.filter((c) => !same(c, widest.pair) && !(after && same(c, after)));
    const pick = fresh.find((c) => c.some((id) => widest.pair.includes(id))) ?? fresh[0] ?? widest.pair;
    const next: Block[] = [];
    for (const b of blocks) {
      if (b !== widest) next.push(b);
      else next.push({ ...b, to: mid }, { from: mid + 1, to: b.to, pair: pick });
    }
    commit(next);
  };
  const remove = (i: number) => {
    // The stripe above takes over the rounds, or the one below if it is the last
    const next = blocks.map((b) => ({ ...b }));
    if (i < next.length - 1) (next[i + 1] as Block).from = (next[i] as Block).from;
    else (next[i - 1] as Block).to = (next[i] as Block).to;
    next.splice(i, 1);
    commit(next);
  };

  const options = (selected: string) =>
    chart.yarns.map((y) => (
      <option key={y.id} value={y.id} selected={y.id === selected}>
        {y.name}
      </option>
    ));

  return (
    <div class="stack">
      {blocks.map((b, i) => (
        <div key={i} class="stripe-block">
          <div class="row" style="flex-wrap:wrap;gap:8px">
            <strong class="num">
              Rounds {b.from} to{" "}
              {i < blocks.length - 1 ? (
                <input
                  class="input num"
                  style="width:4.5em;display:inline-block"
                  type="number"
                  min={b.from}
                  max={(blocks[i + 1] as Block).to - 1}
                  aria-label={`Last round of stripe ${i + 1}`}
                  value={b.to}
                  onChange={(e) => setEnd(i, Number((e.currentTarget as HTMLInputElement).value))}
                />
              ) : (
                b.to
              )}
            </strong>
            {blocks.length > 1 && (
              <button class="btn small danger" onClick={() => remove(i)} aria-label={`Remove stripe ${i + 1}`}>
                Remove
              </button>
            )}
          </div>
          <div class="row" style="flex-wrap:wrap;gap:8px">
            {([0, 1] as const).map((slot) => (
              <label key={slot} class="small row" style="gap:6px">
                {slot === 0 ? "Colours" : "and"}
                <select class="select" style="width:auto" aria-label={`Stripe ${i + 1}, colour ${slot + 1}`} value={b.pair[slot]} onChange={(e) => setPair(i, slot, (e.currentTarget as HTMLSelectElement).value)}>
                  {options(b.pair[slot])}
                </select>
              </label>
            ))}
            <span class="small muted">{b.pair.map(name).join(" and ")}</span>
          </div>
        </div>
      ))}
      <button class="btn small" onClick={split} disabled={blocks.every((b) => b.to - b.from < 1)}>
        Add a stripe
      </button>
      <p class="small muted" style="margin:0">
        Each round is worked in two colours, and a stripe is a run of rounds in the same two. Changing a stripe keeps what you have drawn: a colour that is no longer in the pair is added with duplicate stitch.
      </p>
    </div>
  );
}

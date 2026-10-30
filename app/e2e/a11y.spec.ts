import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const stripes = fileURLToPath(new URL("../../fixtures/stripes/bands.doubletake.json", import.meta.url));

/** WCAG 2.2 AA is the floor (style guide). */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function check(page: Page, label: string, only?: string[]) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  for (const selector of only ?? []) builder = builder.include(selector);
  const results = await builder.analyze();
  const problems = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n   ")}`);
  expect(problems, `${label}\n${problems.join("\n")}`).toEqual([]);
}

async function screens(page: Page, scheme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Knit a reversible hat" })).toBeVisible();
  await check(page, `${scheme}: home`);

  await page.goto("/#/about");
  await expect(page.getByRole("heading", { name: "About Doubletake" })).toBeVisible();
  await check(page, `${scheme}: about`);

  await page.goto("/#/skill");
  await expect(page.getByRole("heading", { name: "Make a chart with Claude" })).toBeVisible();
  await check(page, `${scheme}: skill`);

  await page.goto("/#/make");
  await expect(page.getByRole("heading", { name: "Make a chart from a picture" })).toBeVisible();
  await check(page, `${scheme}: make`);

  // A hat to look at
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  await check(page, `${scheme}: round`);
  for (const [link, heading] of [["Steps", "Steps"], ["Stitch", "Duplicate stitch"], ["More", "More"]] as const) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await check(page, `${scheme}: ${link}`);
  }
  await page.getByRole("link", { name: "Review the chart" }).click();
  await expect(page.getByRole("heading", { name: "Review your chart" })).toBeVisible();
  await check(page, `${scheme}: review`);
  await page.goBack();
  await page.getByRole("link", { name: "Chart pages (PDF)" }).click();
  await expect(page.getByRole("heading", { name: "Chart pages" })).toBeVisible();
  // The pages hold tens of thousands of SVG shapes, so check the controls and two sheets, not every cell
  await check(page, `${scheme}: chart pages`, [".noprint", ".sheet:nth-of-type(1)", ".sheet:nth-of-type(2)"]);

  // Drawing
  await page.goto("/");
  await page.getByRole("button", { name: "Start drawing" }).click();
  await expect(page.getByRole("heading", { name: "Draw your chart" })).toBeVisible();
  await page.getByText("Trace over a picture").click();
  await page.getByText("Colours, duplicate stitch and crown").click();
  await check(page, `${scheme}: draw`);
}

test("no accessibility problems in light mode", async ({ page }) => {
  test.setTimeout(180_000);
  await screens(page, "light");
});

test("no accessibility problems in dark mode", async ({ page }) => {
  test.setTimeout(180_000);
  await screens(page, "dark");
});

test("a striped hat and the pace planner have no accessibility problems", async ({ page }) => {
  await page.goto("/");
  await page.locator("#import-file").setInputFiles(stripes);
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  for (let i = 0; i < 38; i++) await page.getByRole("button", { name: /done, next$/ }).click();
  await expect(page.getByRole("heading", { name: "New stripe" })).toBeVisible();
  await check(page, "striped round with a note");
  await page.getByRole("link", { name: "Steps", exact: true }).click();
  await page.getByRole("button", { name: "Make a plan" }).click();
  await page.getByText(/All 14 days/).click();
  await check(page, "pace planner");
});

test("everything can be reached and used with the keyboard", async ({ page }) => {
  await page.goto("/");
  // Tab through the home screen: every stop has a visible focus ring and an accessible name
  const seen: string[] = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const name = el.getAttribute("aria-label") || el.textContent?.trim() || (el as HTMLInputElement).value || "";
      return { name: name.slice(0, 40), outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 };
    });
    if (info) {
      expect(info.name, "every focus stop has a name").not.toBe("");
      expect(info.outline, `focus ring on "${info.name}"`).toBe(true);
      seen.push(info.name);
    }
  }
  expect(seen.length).toBeGreaterThan(8);
  // Start a hat and move round with the keyboard alone
  await page.getByRole("button", { name: "Use this chart" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  await page.getByRole("button", { name: /done, next$/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Round 2 of 95")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
});

test("touch targets are at least 44 px", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use this chart" }).first().click();
  await expect(page.getByText("Round 1 of 95")).toBeVisible();
  const small = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll("a, button, input, select, summary, label.btn").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const cs = getComputedStyle(el as HTMLElement);
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none") return;
      if ((el as HTMLElement).closest(".sr-only") || el.classList.contains("sr-only")) return;
      if (el.tagName === "A" && el.closest("p, li") && !el.classList.contains("btn")) return; // links inside a sentence
      if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return out;
  });
  expect(small).toEqual([]);
});

test("reduced motion removes all animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const moving = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const cs = getComputedStyle(el);
      if (parseFloat(cs.transitionDuration) > 0.001 || (cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.001)) out.push(el.tagName);
    });
    return out;
  });
  expect(moving).toEqual([]);
});

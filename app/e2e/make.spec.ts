import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deflateSync } from "node:zlib";

/** A small PNG: red spots with blue centres on cream, so it has three clear colours. */
function spotsPng(width = 320, height = 160): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const cx = (x % 40) - 20;
      const cy = (y % 40) - 20;
      const d = cx * cx + cy * cy;
      const [r, g, b] = d < 4 * 4 ? [30, 60, 190] : d < 11 * 11 ? [200, 40, 40] : [240, 230, 200];
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  return pngFrom(raw, width, height);
}

function pngFrom(raw: Buffer, width: number, height: number): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Left half red stripes on cream, right half blue stripes on cream, so moving the frame changes the colours. */
function halvesPng(width = 320, height = 160): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const stripe = Math.floor(x / 10) % 2 === 0;
      const [r, g, b] = !stripe ? [240, 230, 200] : x < width / 2 ? [200, 40, 40] : [30, 60, 190];
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  return pngFrom(raw, width, height);
}

async function openMake(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Choose a picture" }).click();
  await expect(page.getByRole("heading", { name: "Make a chart from a picture" })).toBeVisible();
}

async function pickSpots(page: Page) {
  await page.locator("#pic-file").setInputFiles({ name: "red-spots.png", mimeType: "image/png", buffer: spotsPng() });
  await expect(page.getByRole("heading", { name: /real colours found/ })).toBeVisible({ timeout: 20_000 });
}

test("a picture becomes a three-colour chart with duplicate stitch", async ({ page }) => {
  await openMake(page);
  await pickSpots(page);
  await expect(page.getByRole("heading", { name: "3 real colours found" })).toBeVisible();
  // Everything is on one screen, with the hat always in view
  await expect(page.getByRole("heading", { name: "Your picture on the hat" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Which colour is embroidered?" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("radio", { name: /Embroider/ })).toHaveCount(3);
  await expect(page.getByText("Most contrast")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Duplicate stitch", exact: true })).toBeVisible();
  await expect(page.getByText(/Duplicate stitch: \d+ patches?/)).toBeVisible();
  await page.getByRole("button", { name: "Use this chart" }).click();
  await expect(page.getByRole("heading", { name: "Review your chart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Duplicate stitch" })).toBeVisible();
  // It is a hat being designed, so the Draw tab is there to tweak it
  await expect(page.getByRole("link", { name: "Draw", exact: true })).toBeVisible();
});

test("two colours gives a plain two-colour chart", async ({ page }) => {
  await openMake(page);
  await pickSpots(page);
  await page.getByRole("group", { name: "Number of colours" }).getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your chart" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Which colour is embroidered?" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Duplicate stitch", exact: true })).toHaveCount(0);
  await page.getByLabel("Name your hat").fill("Spotty");
  await page.getByRole("button", { name: "Use this chart" }).click();
  await expect(page.getByRole("heading", { name: "Review your chart" })).toBeVisible();
  await expect(page.getByText("Spotty").first()).toBeVisible();
});

const found = (page: Page) => page.locator("#found").locator("..").locator(".swatch").evaluateAll((els) => els.map((e) => (e as HTMLElement).style.background).join("|"));

test("the colours found follow the frame", async ({ page }) => {
  await openMake(page);
  await page.locator("#pic-file").setInputFiles({ name: "halves.png", mimeType: "image/png", buffer: halvesPng() });
  await expect(page.getByRole("heading", { name: /real colours found/ })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Zoom", { exact: true }).fill("4");
  for (let i = 0; i < 30; i++) await page.getByRole("button", { name: "Move the outline left" }).click();
  await expect.poll(() => found(page), { timeout: 15_000 }).not.toContain("rgb(30, 60, 190)");
  for (let i = 0; i < 30; i++) await page.getByRole("button", { name: "Move the outline right" }).click();
  await expect.poll(() => found(page), { timeout: 15_000 }).not.toContain("rgb(200, 40, 40)");
  await expect.poll(() => found(page), { timeout: 15_000 }).toContain("rgb(30, 60, 190)");
});

test("dragging the picture moves the frame", async ({ page }) => {
  await openMake(page);
  await page.locator("#pic-file").setInputFiles({ name: "halves.png", mimeType: "image/png", buffer: halvesPng() });
  await expect(page.getByRole("heading", { name: /real colours found/ })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Zoom", { exact: true }).fill("4");
  const canvas = page.getByRole("img", { name: /Your picture with the part that will be used outlined/ });
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" })); // clear of the hat preview that stays at the top
  const box = (await canvas.boundingBox())!;
  const drag = async (from: number, to: number) => {
    await page.mouse.move(box.x + from, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + (from + to) / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + to, box.y + box.height / 2);
    await page.mouse.up();
  };
  await drag(box.width - 10, 10); // drag left: the frame moves left, to the red stripes
  await expect.poll(() => found(page), { timeout: 15_000 }).not.toContain("rgb(30, 60, 190)");
  await drag(10, box.width - 10); // drag right: to the blue stripes
  await expect.poll(() => found(page), { timeout: 15_000 }).toContain("rgb(30, 60, 190)");
  await expect.poll(() => found(page), { timeout: 15_000 }).not.toContain("rgb(200, 40, 40)");
});

test("the duplicate stitch slider changes how much there is", async ({ page }) => {
  await openMake(page);
  await pickSpots(page);
  await expect(page.getByRole("heading", { name: "Duplicate stitch", exact: true })).toBeVisible({ timeout: 20_000 });
  const slider = page.getByLabel("Amount of duplicate stitch, from less to more");
  const total = async () => Number((await page.getByText(/^Total:/).innerText()).match(/([\d.]+)%/)?.[1]);
  await slider.fill("12");
  await expect(page.getByText("Smallest patch kept: 1 square")).toBeVisible();
  const more = await total();
  await slider.fill("1");
  await expect(page.getByText("Smallest patch kept: 12 squares")).toBeVisible();
  const less = await total();
  expect(less).toBeLessThan(more);
});

test("the picture can be repeated across the hat", async ({ page }) => {
  await openMake(page);
  await pickSpots(page);
  await expect(page.getByRole("heading", { name: "Your picture on the hat" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Repeat the picture across the hat").check();
  await page.getByLabel("Copies across the hat").selectOption("8");
  await expect(page.getByLabel("Flip every other copy, so the edges match")).toBeChecked();
  await expect(page.getByRole("heading", { name: /real colours found/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use this chart" })).toBeEnabled({ timeout: 20_000 });
});

test("a sample picture can be used without a file", async ({ page }) => {
  await openMake(page);
  await page.getByRole("group", { name: "Sample pictures" }).getByRole("button", { name: /^Leopard/ }).click();
  await expect(page.getByRole("heading", { name: /real colours found/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Your picture on the hat" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use this chart" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByLabel("Name your hat")).toHaveValue("Leopard");
});

test("colours can be merged, and the merge undone", async ({ page }) => {
  await openMake(page);
  await page.getByRole("group", { name: "Sample pictures" }).getByRole("button", { name: /^Great Wave/ }).click();
  await expect(page.getByRole("heading", { name: /real colours found/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("group", { name: "Number of colours" }).getByRole("button", { name: "6" }).click();
  const names = page.getByRole("textbox", { name: /^Name of colour/ });
  await expect(names).toHaveCount(6, { timeout: 20_000 });
  await page.getByLabel("Merge colour 5 into another colour").selectOption({ label: "colour 3" });
  await expect(names).toHaveCount(5);
  const chips = await page.locator("input.colour-input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(new Set(chips).size).toBeGreaterThan(1);
  expect(chips).not.toContain("#000000");
  await page.getByLabel("Merge colour 4 into another colour").selectOption({ label: "colour 3" });
  await expect(names).toHaveCount(4);
  await expect(page.getByText("2 merges made")).toBeVisible();
  await page.getByRole("button", { name: "Undo last merge" }).click();
  await expect(names).toHaveCount(5);
});

test("there are links to free pictures, and they only open when chosen", async ({ page }) => {
  const external: string[] = [];
  const origin = new URL("http://localhost:4173").origin;
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) external.push(req.url());
  });
  await openMake(page);
  const link = page.getByRole("link", { name: "Seamless patterns" });
  await expect(link).toHaveAttribute("href", /^https:\/\/pixabay\.com\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  expect(external).toEqual([]);
});

test("a file that isn’t a picture is turned down kindly", async ({ page }) => {
  await openMake(page);
  await page.locator("#pic-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a picture") });
  await expect(page.getByRole("alert")).toContainText("isn’t a picture");
});

test("the picture is never sent anywhere", async ({ page }) => {
  const external: string[] = [];
  const posts: string[] = [];
  const origin = new URL("http://localhost:4173").origin;
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) external.push(req.url());
    if (req.method() !== "GET") posts.push(`${req.method()} ${req.url()}`);
  });
  await openMake(page);
  await pickSpots(page);
  await expect(page.getByRole("heading", { name: "Your picture on the hat" })).toBeVisible({ timeout: 20_000 });
  expect(external).toEqual([]);
  expect(posts).toEqual([]);
});

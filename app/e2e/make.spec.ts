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
  await page.getByRole("button", { name: "Next: choose the colours" }).click();
  await expect(page.getByRole("heading", { name: "Your picture on the hat" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Next: how to knit it" }).click();
  await expect(page.getByRole("heading", { name: "Which colour is embroidered?" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Embroider/ })).toHaveCount(3);
  await expect(page.getByText("Most contrast")).toHaveCount(1);
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
  await page.getByRole("button", { name: "Next: choose the colours" }).click();
  await page.getByRole("group", { name: "Number of colours" }).getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your picture on the hat" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Next: how to knit it" }).click();
  await expect(page.getByRole("heading", { name: "Which colour is embroidered?" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your chart" })).toBeVisible();
  await page.getByLabel("Name your hat").fill("Spotty");
  await page.getByRole("button", { name: "Use this chart" }).click();
  await expect(page.getByRole("heading", { name: "Review your chart" })).toBeVisible();
  await expect(page.getByText("Spotty").first()).toBeVisible();
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
  await page.getByRole("button", { name: "Next: choose the colours" }).click();
  await expect(page.getByRole("heading", { name: "Your picture on the hat" })).toBeVisible({ timeout: 20_000 });
  expect(external).toEqual([]);
  expect(posts).toEqual([]);
});

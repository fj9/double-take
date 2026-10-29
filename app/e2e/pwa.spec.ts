import { expect, test } from "@playwright/test";

test("the app can be installed: manifest, icons and a service worker are all there", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifestRes = await request.get(new URL(href as string, page.url()).toString());
  expect(manifestRes.status()).toBe(200);
  const m = await manifestRes.json();
  expect(m.name).toBe("Doubletake");
  expect(m.display).toBe("standalone");
  expect(m.lang).toBe("en-GB");
  expect(m.start_url).toBeTruthy();
  const sizes = m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ""}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512", "512x512 maskable"]));
  for (const icon of m.icons as { src: string }[]) {
    const r = await request.get(new URL(icon.src, page.url()).toString());
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(new URL(apple as string, page.url()).toString())).status()).toBe(200);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBeGreaterThan(0);
  expect(await page.locator("html").getAttribute("lang")).toBe("en-GB");
  expect(await page.locator('meta[name="viewport"]').getAttribute("content")).toContain("width=device-width");
});

test("nothing loads from any other site, even on the About and picture screens", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.protocol.startsWith("http") && u.origin !== "http://localhost:4173") external.push(req.url());
  });
  for (const hash of ["#/", "#/about", "#/make", "#/skill"]) {
    await page.goto(`/${hash}`);
    await page.waitForLoadState("networkidle");
  }
  expect(external).toEqual([]);
});

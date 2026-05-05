import { chromium } from "@playwright/test";
import { join } from "node:path";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 15000 });
await page.waitForTimeout(800);
const out = join(process.cwd(), ".builder", "welcome-screenshot.png");
await page.screenshot({ path: out, fullPage: true });
console.log(out);
await browser.close();

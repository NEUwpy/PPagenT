import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const file = (name) => new URL(`./output/${name}`, import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(file(name), "utf8"));
const [summary, input] = await Promise.all([readJson("summary.json"), readJson("input-map.json")]);
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const { id, variant, selected } of summary.pages) {
    assert.ok(selected, `${id}-${variant}`);
    await page.goto(file(`${id}-${variant}.html`).href);
    await page.evaluate(() => document.fonts.ready);
    const model = input.find((item) => item.id === id);
    const measure = await page.evaluate(() => {
      const boundary = document.querySelector("main").getBoundingClientRect();
      const entries = [...document.querySelectorAll("[data-body-id],[data-heading-id],h2")].map((element) => {
        const column = (element.closest(".flow") ?? element.closest(".group")).getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const boxes = [...range.getClientRects()].filter((box) => box.width > 0 && box.height > 0);
        return { key: element.dataset.bodyId ?? element.dataset.headingId,
          role: element.dataset.bodyId ? "body" : element.dataset.headingId ? "item-heading" : "group-heading",
          text: element.textContent, size: parseFloat(getComputedStyle(element).fontSize),
          badBounds: boxes.length === 0 || boxes.some((box) => box.top < boundary.top - 1
             || box.bottom > boundary.bottom + 1 || box.left < column.left - 1 || box.right > column.right + 1),
        };
      });
      return {
        title: document.querySelector("h1").textContent,
        intro: document.querySelector(".intro")?.textContent,
        deck: document.querySelector(".deck")?.textContent,
        entries,
      };
    });
    assert.equal(measure.title, model.title);
    assert.equal(measure.intro, model.intro);
    assert.equal(measure.deck, model.deck);
    assert.deepEqual(measure.entries.filter((entry) => entry.role === "body").map(({ key, text }) => ({ id: key, text })),
      model.groups.flatMap((group) => group.items.map(({ id, text }) => ({ id, text }))));
    assert.deepEqual(measure.entries.filter((entry) => entry.role === "group-heading").map(({ text }) => text),
      model.groups.map((group) => group.label));
    assert.deepEqual(measure.entries.filter((entry) => entry.role === "item-heading").map(({ text }) => text.replace(/。$/u, "")),
      model.groups.flatMap((group) => group.items.filter((item) => item.heading).map((item) => item.heading)));
    assert.ok(measure.entries.every((entry) => !entry.badBounds && entry.size >= 18),
      JSON.stringify(measure.entries.filter((entry) => entry.badBounds || entry.size < 18)));
    const png = await readFile(file(`${id}-${variant}.png`));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1280, 720]);
    console.log(`${id}-${variant}: visible text and bounds verified`);
  }
} finally {
  await browser.close();
}

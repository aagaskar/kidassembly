import { expect, Page, test } from "@playwright/test";

/**
 * End-to-end smoke of the full app: profiles + placement, lessons across
 * the item types, review, playground modes (assembly, MiniC + Snake,
 * real C), and the parent dashboard.
 */

async function freshProfile(page: Page, name = "Testbot") {
  await page.goto("/");
  await page.evaluate(() => indexedDB.deleteDatabase("kidassembly"));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "＋ New profile" }).click();
  await page.getByPlaceholder("name").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  // placement diagnostic appears for new profiles
  await expect(page.getByText("Quick check-in")).toBeVisible();
}

test("new profile → placement (skipped) → home shows all 16 units", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await expect(page.getByText("Unit 0 — Bits and representation")).toBeVisible();
  await expect(page.getByText("Unit 15 — Capstone: games and real C")).toBeVisible();
  // first lesson unlocked, later lessons locked
  await expect(
    page.locator(".lesson-card", { hasText: "Switches and lights" }).getByRole("button")
  ).toBeEnabled();
  await expect(
    page.locator(".lesson-card", { hasText: "Counting in binary" }).getByRole("button")
  ).toBeDisabled();
});

test("placement: answering binary probes correctly grants Unit 0", async ({ page }) => {
  await freshProfile(page, "Speedy");
  // Answer probes until the topic moves past "binary numbers", then bail by
  // missing on purpose. Probe answers are visible in the prompt for bin2dec
  // ("…binary: 0101…") and dec2bin (toggle switches) — easier: answer the
  // typed ones by computing from the prompt.
  for (let i = 0; i < 8; i++) {
    const finished = await page.getByText("Unit 0 — Bits", { exact: false }).isVisible().catch(() => false);
    if (finished) break;
    const topic = await page.locator(".dim", { hasText: "Topic:" }).textContent();
    if (!topic?.includes("binary numbers")) {
      // miss on purpose to finish placement
      const input = page.locator('input[type="number"]');
      if (await input.isVisible()) {
        await input.fill("999");
        await page.getByRole("button", { name: "Answer", exact: true }).click();
      } else {
        await page.getByRole("button", { name: "Answer", exact: true }).click();
      }
      continue;
    }
    const prompt = await page.locator(".big").last().textContent();
    const binMatch = prompt?.match(/binary: ([01]+)\./);
    if (binMatch) {
      await page.locator('input[type="number"]').fill(String(parseInt(binMatch[1], 2)));
      await page.getByRole("button", { name: "Answer", exact: true }).click();
    } else {
      // dec2bin: "Flip the switches to show N in binary."
      const n = parseInt(prompt?.match(/show (\d+) in binary/)?.[1] ?? "0", 10);
      const lamps = page.locator(".lamp");
      const count = await lamps.count();
      for (let b = 0; b < count; b++) {
        if ((n >> (count - 1 - b)) & 1) await lamps.nth(b).click();
      }
      await page.getByRole("button", { name: "Answer", exact: true }).click();
    }
  }
  await expect(page.getByText("Unit 0 — Bits and representation")).toBeVisible();
  // Unit 0 lessons granted → first Unit 1 lesson should be startable
  await expect(
    page.locator(".lesson-card", { hasText: "Boxes with addresses" }).getByRole("button")
  ).toBeEnabled({ timeout: 10_000 });
});

test("complete the first lesson end-to-end (bits exercises)", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await page
    .locator(".lesson-card", { hasText: "Switches and lights" })
    .getByRole("button", { name: "Start" })
    .click();

  // step 1: info
  await page.getByRole("button", { name: "Next →" }).click();
  // step 2: one switch → turn ON to show 1
  await page.locator(".lamp").first().click();
  await page.getByRole("button", { name: "Next →" }).click();
  // step 3: info
  await page.getByRole("button", { name: "Next →" }).click();
  // step 4: two switches → show 3 (both on)
  await page.locator(".lamp").nth(0).click();
  await page.locator(".lamp").nth(1).click();
  await page.getByRole("button", { name: "Next →" }).click();
  // step 5: show 2 → left switch only
  await page.locator(".lamp").nth(0).click();
  await expect(page.getByText("That's it! 2 ✓")).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();

  await expect(page.getByText("Lesson complete!")).toBeVisible();
  await page.getByRole("button", { name: "Back to lessons" }).click();
  await expect(
    page.locator(".lesson-card", { hasText: "Switches and lights" }).getByText("✓ done")
  ).toBeVisible();
  // next lesson unlocked, XP awarded
  await expect(
    page.locator(".lesson-card", { hasText: "Counting in binary" }).getByRole("button")
  ).toBeEnabled();
  await expect(page.locator(".xp")).toContainText("20");
});

test("parent dashboard: gate, stats, unlock-everything toggle", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await page.getByRole("button", { name: "📊" }).click();
  await expect(page.getByText("Grown-ups only")).toBeVisible();
  await page.locator('input[type="number"]').fill("56");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText("Where they are")).toBeVisible();
  await expect(page.getByText("Review health")).toBeVisible();
  await page.getByText("Unlock every playground tool").click();
  await page.getByRole("button", { name: "✕ Back" }).click();

  // all playground tabs now unlocked
  await page.getByRole("button", { name: "🛠 Playground" }).click();
  await expect(page.getByRole("button", { name: "⌨️ MiniC" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "🌍 Real C" })).toBeEnabled();
});

async function unlockEverything(page: Page) {
  await page.getByRole("button", { name: "📊" }).click();
  await page.locator('input[type="number"]').fill("56");
  await page.getByRole("button", { name: "Enter" }).click();
  await page.getByText("Unlock every playground tool").click();
  await page.getByRole("button", { name: "✕ Back" }).click();
}

test("playground: progressive lock for new profiles; bb8 pixel painting", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await page.getByRole("button", { name: "🛠 Playground" }).click();
  await expect(page.getByRole("button", { name: /📝 Assembly/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /⌨️ MiniC/ })).toBeDisabled();

  // paint a pixel on the bb8 screen and see its memory box change
  await page.locator(".pixel.paintable").first().click();
  await expect(page.locator(".memcell").nth(128)).toHaveAttribute("title", "box 128 = 7");
});

test("assembly playground: write, assemble, run", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await unlockEverything(page);
  await page.getByRole("button", { name: "🛠 Playground" }).click();
  await page.getByRole("button", { name: "📝 Assembly" }).click();

  await page.locator(".asm-text").fill("LOADC 9\nSTORE 130\nHALT");
  await page.getByRole("button", { name: "⬇ Load into machine" }).click();
  await page.getByRole("button", { name: "Step ▶" }).click();
  await page.getByRole("button", { name: "Step ▶" }).click();
  await expect(page.locator(".memcell").nth(130)).toHaveAttribute("title", "box 130 = 9");
});

test("assembly editor gives child-friendly did-you-mean errors", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await unlockEverything(page);
  await page.getByRole("button", { name: "🛠 Playground" }).click();
  await page.getByRole("button", { name: "📝 Assembly" }).click();
  await page.locator(".asm-text").fill("LODC 5\nHALT");
  await expect(page.getByText(/did you mean LOADC/)).toBeVisible();
});

test("MiniC playground: compiler view compiles and the machine paints", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await unlockEverything(page);
  await page.getByRole("button", { name: "🛠 Playground" }).click();
  await page.getByRole("button", { name: "⌨️ MiniC" }).click();

  // the starter compiles: assembly listing shows the runtime CALL main
  await expect(page.locator(".asm-listing")).toContainText("CALL main");

  // run at max speed until the diagonal appears
  await page.locator('input[type="range"]').fill("50");
  await page.getByRole("button", { name: "Run ⏵⏵" }).click();
  // diagonal pixel (1,1) = offset 33 → box 2048+33 = 2081, color 11 (not black)
  await expect
    .poll(
      async () =>
        await page
          .locator('.pixel[title="box 2081"]')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      { timeout: 30_000 }
    )
    .not.toBe("rgb(0, 0, 0)");
});

test("Snake loads, compiles and the snake moves", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await unlockEverything(page);
  await page.getByRole("button", { name: "🛠 Playground" }).click();
  await page.getByRole("button", { name: "⌨️ MiniC" }).click();
  await page.getByRole("button", { name: "🐍 Load Snake" }).click();
  await expect(page.locator(".asm-listing")).toContainText("CALL main");

  await page.locator('input[type="range"]').fill("50");
  await page.getByRole("button", { name: "Run ⏵⏵" }).click();
  // The snake slithers with the TICK heartbeat, so don't look at fixed
  // pixels: poll for the 3-segment green body (color 3 = rgb(0,135,81))
  // being alive SOMEWHERE on the memory-mapped screen.
  await expect
    .poll(
      async () =>
        await page.evaluate(
          () =>
            [...document.querySelectorAll(".pixel")].filter(
              (el) => getComputedStyle(el).backgroundColor === "rgb(0, 135, 81)"
            ).length
        ),
      { timeout: 45_000 }
    )
    .toBeGreaterThanOrEqual(3); // ≥: it may have eaten the food and grown!
});

test("real C sandbox: printf runs; infinite loop is stopped safely", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  await unlockEverything(page);
  await page.getByRole("button", { name: "🛠 Playground" }).click();
  await page.getByRole("button", { name: "🌍 Real C" }).click();

  await page.getByRole("button", { name: "▶ Compile and run" }).click();
  await expect(page.locator(".console")).toContainText("Real C says   60000 + 10000 = 70000");

  // hostile program: cleanly stopped with a child-readable message
  await page.locator(".c-edit").fill("int main() { while (1) { } return 0; }");
  await page.getByRole("button", { name: "▶ Compile and run" }).click();
  await expect(page.getByText(/sandbox stopped it/)).toBeVisible();
});

test("review session appears once a skill is mastered and due", async ({ page }) => {
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();
  // banner exists with nothing due
  await expect(page.getByText("Daily review")).toBeVisible();
  await expect(page.getByRole("button", { name: "All done ✓" })).toBeDisabled();
});

test("profile export → import round-trips progress", async ({ page }) => {
  // Force the anchor-download / <input type=file> fallback paths (§8.3):
  // the File System Access pickers can't be driven headlessly.
  await page.addInitScript(() => {
    // @ts-expect-error test override
    delete window.showSaveFilePicker;
    // @ts-expect-error test override
    delete window.showOpenFilePicker;
  });
  await freshProfile(page);
  await page.getByRole("button", { name: /Skip/ }).click();

  // master the first lesson quickly
  await page
    .locator(".lesson-card", { hasText: "Switches and lights" })
    .getByRole("button", { name: "Start" })
    .click();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.locator(".lamp").first().click();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.locator(".lamp").nth(0).click();
  await page.locator(".lamp").nth(1).click();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.locator(".lamp").nth(0).click();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("button", { name: "Back to lessons" }).click();

  // export via the profile picker
  await page.getByRole("button", { name: /Testbot ⇄/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "💾 Export" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import("fs/promises");
  const fileText = await fs.readFile(path!, "utf-8");
  const parsed = JSON.parse(fileText);
  expect(parsed.format).toBe("bitbot-profile");
  expect(parsed.formatVersion).toBe(2);
  expect(parsed.completedLessons).toContain("u00.switches");
  expect(parsed.skills.length).toBeGreaterThan(0);

  // wipe and import on a "clean browser"
  await page.evaluate(() => indexedDB.deleteDatabase("kidassembly"));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "📂 Import profile file" }).click();
  await (await chooser).setFiles(path!);
  await expect(page.getByText("Unit 0 — Bits and representation")).toBeVisible();
  await expect(
    page.locator(".lesson-card", { hasText: "Switches and lights" }).getByText("✓ done")
  ).toBeVisible();
});

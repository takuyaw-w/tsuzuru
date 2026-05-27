import { expect, type Locator, type Page, test } from "@playwright/test";

test("starter title screen enters a visual novel game screen", async ({ page }, testInfo) => {
  await page.goto("/");

  const themeRoot = page.locator(".tzr-theme-root");

  await expect(page.getByRole("heading", { name: "はじめてのTsuzuru" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Load/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Config/ })).toBeDisabled();
  await expect(themeRoot).toHaveCount(1);
  await expect(themeRoot).toHaveAttribute("data-tzr-theme", "local");
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("title-screen.png") });

  await page.getByRole("button", { name: "Start" }).click();

  const viewport = page.locator(".tzr-tsuzuru-game__viewport");
  const messageWindow = page.locator(".tzr-message-window");
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(viewport).toBeVisible();
  await expect(page.locator('img[src="/assets/images/classroom.svg"]')).toBeVisible();
  await expect(page.locator('img[src="/assets/images/mio_smile.svg"]')).toBeVisible();
  await expect(messageWindow).toContainText("放課後の教室", { timeout: 5000 });
  await expectViewportAspectRatio(viewport);
  await expectBoxInsideViewport(page, viewport, { minWidth: 900, minHeight: 500 });
  await expectBoxInsideViewport(page, messageWindow, { minWidth: 320, minHeight: 80 });
  await expect(messageWindow).toHaveClass(/tzr-message-window--narration/);
  await expect(messageWindow.locator(".tzr-message-window__speaker")).toHaveCount(0);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("game-narration-local.png") });

  await advanceUntilText(page, messageWindow, "こんにちは");
  await expect(messageWindow).toHaveClass(/tzr-message-window--dialogue/);
  await expect(messageWindow.locator(".tzr-message-window__speaker")).toHaveText("mio");
  await expect(themeRoot).toHaveAttribute("data-tzr-theme", "local");
  await expectBoxInsideViewport(page, messageWindow, { minWidth: 320, minHeight: 80 });
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("game-dialogue-local.png") });

  await advanceUntilText(page, messageWindow, "少し長めの文章でも");
  await expect(messageWindow).toContainText("メッセージウィンドウの中で読みやすく表示されるか確認できます");
  await expect(messageWindow).toHaveClass(/tzr-message-window--narration/);
  await expect(messageWindow.locator(".tzr-message-window__speaker")).toHaveCount(0);
  await expectBoxInsideViewport(page, messageWindow, { minWidth: 320, minHeight: 120 });
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("game-long-text-local.png") });

  await advanceUntilChoice(page, messageWindow, choiceLayer, "どこへ向かう？");
  await expect(messageWindow).toHaveCount(0);
  await expect(choiceLayer.getByRole("button", { name: "駅前へ行く" })).toBeVisible();
  await expect(choiceLayer.getByRole("button", { name: "部屋に戻る" })).toBeVisible();
  await expectBoxInsideViewport(page, choiceLayer, { minWidth: 320, minHeight: 120 });
  await expect(themeRoot).toHaveAttribute("data-tzr-theme", "local");
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("game-choice-local.png") });

  await choiceLayer.getByRole("button", { name: "駅前へ行く" }).click();
  await expect(page.locator('img[src="/assets/images/station.svg"]')).toBeVisible();
  await expect(page.locator('img[src="/assets/images/sora_normal.svg"]')).toBeVisible();
  await expect(messageWindow).toContainText("場所を変えると", { timeout: 5000 });

  await page.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Title" }).click();
  await expect(page.getByRole("heading", { name: "はじめてのTsuzuru" })).toBeVisible();
});

test("starter game screen fits a compact 16:9 viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/");

  await page.getByRole("button", { name: "Start" }).click();

  const viewport = page.locator(".tzr-tsuzuru-game__viewport");
  const messageWindow = page.locator(".tzr-message-window");

  await expect(viewport).toBeVisible();
  await expect(messageWindow).toContainText("放課後の教室", { timeout: 5000 });
  await expectViewportAspectRatio(viewport);
  await expectBoxInsideViewport(page, viewport, { minWidth: 700, minHeight: 390 });
  await expectBoxInsideViewport(page, messageWindow, { minWidth: 280, minHeight: 72 });
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("compact-game-narration.png") });
});

async function advanceUntilChoice(page: Page, messageWindow: Locator, choiceLayer: Locator, question: string) {
  for (let index = 0; index < 24; index += 1) {
    if (await choiceLayer.isVisible().catch(() => false)) {
      await expect(choiceLayer).toContainText(question);
      return;
    }

    if (await messageWindow.isVisible().catch(() => false)) {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(150);
  }

  await expect(choiceLayer).toContainText(question);
}

async function advanceUntilText(page: Page, messageWindow: Locator, text: string, maxSteps = 16) {
  for (let index = 0; index < maxSteps; index += 1) {
    if ((await messageWindow.textContent().catch(() => null))?.includes(text)) {
      await expect(messageWindow).toContainText(text);
      return;
    }

    if (await messageWindow.isVisible().catch(() => false)) {
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(150);
  }

  await expect(messageWindow).toContainText(text);
}

async function expectViewportAspectRatio(viewport: Locator) {
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
}

async function expectBoxInsideViewport(
  page: Page,
  locator: Locator,
  { minHeight, minWidth }: { minHeight: number; minWidth: number },
) {
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  if (viewport === null || box === null) {
    return;
  }

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(box.width).toBeGreaterThanOrEqual(minWidth);
  expect(box.height).toBeGreaterThanOrEqual(minHeight);
}

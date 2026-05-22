import { expect, type Locator, type Page, test } from "@playwright/test";

test("starter title screen enters a visual novel game screen", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "はじめてのTsuzuru" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Load/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Config/ })).toBeDisabled();
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

  await advanceUntilChoice(page, messageWindow, choiceLayer, "どこへ向かう？");
  await expect(choiceLayer.getByRole("button", { name: "駅前へ行く" })).toBeVisible();
  await expect(choiceLayer.getByRole("button", { name: "部屋に戻る" })).toBeVisible();

  await choiceLayer.getByRole("button", { name: "駅前へ行く" }).click();
  await expect(page.locator('img[src="/assets/images/station.svg"]')).toBeVisible();
  await expect(page.locator('img[src="/assets/images/sora_normal.svg"]')).toBeVisible();
  await expect(messageWindow).toContainText("場所を変えると", { timeout: 5000 });

  await page.getByRole("navigation", { name: "Game menu" }).getByRole("button", { name: "Title" }).click();
  await expect(page.getByRole("heading", { name: "はじめてのTsuzuru" })).toBeVisible();
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

async function expectViewportAspectRatio(viewport: Locator) {
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
}

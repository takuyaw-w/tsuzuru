import { expect, test } from "@playwright/test";

test("fullscreen visual novel UI smoke check", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("Step")).toHaveCount(0);
  await expect(page.locator(".debug-panel")).toHaveCount(0);

  await page.locator(".app__interaction-surface").click();
  await expect(page.locator(".tzr-message-window")).toContainText("Tsuzuru");
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("title-scene.png") });

  const messageWindow = page.locator(".tzr-message-window");
  await messageWindow.click();
  await expect(messageWindow).toContainText("Tsuzuru DSL v2 Basic");

  await messageWindow.click();
  const choiceLayer = page.locator(".tzr-choice-layer");
  await expect(choiceLayer).toContainText("Start");
  await choiceLayer.getByRole("button", { name: "はじめる" }).click();

  await expect(messageWindow).toContainText("遅いよ");

  await messageWindow.click();
  await expect(messageWindow).toContainText("遅いよ。");

  await messageWindow.click();
  await expect(messageWindow).toContainText("スコアが増えた");

  await messageWindow.click();
  await expect(messageWindow).toContainText("スコアが増えた。");

  await messageWindow.click();
  await expect(page.locator(".tzr-choice-layer")).toContainText("どうする？");

  await page.locator(".tzr-choice-layer").getByRole("button", { name: "手帳を見る" }).click();
  await expect(page.getByText("Waiting 250ms")).toHaveCount(0);
  await expect(messageWindow).toContainText("ちゃんと見ておいて");
});

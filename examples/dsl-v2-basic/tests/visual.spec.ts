import { expect, test } from "@playwright/test";

test("fullscreen visual novel UI smoke check", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("Step")).toHaveCount(0);
  await expect(page.locator(".debug-panel")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "DSL v2 Basic" })).toBeVisible();
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("title-screen.png") });
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
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

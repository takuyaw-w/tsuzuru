import { expect, test } from "@playwright/test";

test("hotspot example jumps from exploration scene to inspected scenes", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Hotspot Basic" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  const viewport = page.locator(".tzr-game-viewport");
  const messageWindow = page.locator(".tzr-message-window");

  await expect(viewport).toBeVisible();
  await expect(page.locator('img[src="/assets/images/detective-office.svg"]')).toBeVisible();
  await expect(messageWindow).toContainText("手がかりになりそうな場所", { timeout: 5000 });
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("room-search.png") });

  await messageWindow.click();
  await expect(page.getByRole("button", { name: "Hotspot desk" })).toBeEnabled();
  await page.getByRole("button", { name: "Hotspot desk" }).click();

  await expect(messageWindow).toContainText("古い手帳", { timeout: 5000 });
  await messageWindow.click();
  await expect(messageWindow).toContainText("手がかりになりそうな場所", { timeout: 5000 });

  await messageWindow.click();
  await expect(page.getByRole("button", { name: "Hotspot window" })).toBeEnabled();
  await page.getByRole("button", { name: "Hotspot window" }).click();
  await expect(messageWindow).toContainText("雨粒が街灯", { timeout: 5000 });
});

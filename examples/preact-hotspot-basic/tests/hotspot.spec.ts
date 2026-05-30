import { expect, test } from "@playwright/test";

test("hotspot example jumps from exploration scene to inspected scenes", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Hotspot Basic" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  const viewport = page.locator(".tzr-game-viewport");
  const messageWindow = page.locator(".tzr-message-window");

  await expect(viewport).toBeVisible();
  await expect(page.locator('img[src="/assets/images/detective-office.svg"]')).toBeVisible();
  await expect(messageWindow).toContainText("古い書斎に入った", { timeout: 5000 });
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("room-search.png") });

  await messageWindow.click();
  await expect(page.getByRole("button", { name: "Hotspot desk" })).toBeEnabled();
  await page.getByRole("button", { name: "Hotspot desk" }).click();

  await expect(messageWindow).toContainText("古い手帳", { timeout: 5000 });
  await messageWindow.click();
  await expect(messageWindow).toContainText("古い書斎に入った", { timeout: 5000 });

  await messageWindow.click();
  await expect(page.getByRole("button", { name: "Hotspot window" })).toBeEnabled();
  await page.getByRole("button", { name: "Hotspot window" }).click();
  await expect(messageWindow).toContainText("遠くで雨音", { timeout: 5000 });
  await messageWindow.click();
  await expect(messageWindow).toContainText("古い書斎に入った", { timeout: 5000 });

  await messageWindow.click();
  await expect(page.getByRole("button", { name: "Hotspot bookshelf" })).toBeEnabled();
  await page.getByRole("button", { name: "Hotspot bookshelf" }).click();
  await expect(messageWindow).toContainText("古い推理小説", { timeout: 5000 });
  await messageWindow.click();
  await expect(messageWindow).toContainText("古い書斎に入った", { timeout: 5000 });

  await messageWindow.click();
  await expect(page.getByRole("button", { name: "Hotspot door" })).toBeEnabled();
  await page.getByRole("button", { name: "Hotspot door" }).click();
  await expect(messageWindow).toContainText("扉には鍵", { timeout: 5000 });
});

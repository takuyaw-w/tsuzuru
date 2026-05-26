import { expect, test } from "@playwright/test";

test("sound novel example opens fullscreen novel presentation", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "雨のページ" })).toBeVisible();
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("title-screen.png") });

  await page.getByRole("button", { name: "Start" }).click();

  const novelLayer = page.locator(".tzr-novel-text-window--fullscreen");
  await expect(novelLayer).toBeVisible();
  await expect(novelLayer).toContainText("雨は夕方", { timeout: 5000 });

  await page.getByLabel("Speaker mode").selectOption("block");
  await expect(page.getByLabel("Speaker mode")).toHaveValue("block");
  await page.getByLabel("Text speed").selectOption("120");
  await expect(page.getByLabel("Text speed")).toHaveValue("120");

  await page.keyboard.press("Enter");
  await expect(novelLayer).toContainText("文字は静かに並んでいるのに");

  await page.getByRole("navigation", { name: "Preview controls" }).getByRole("button", { name: "Title" }).click();
  await expect(page.getByRole("heading", { name: "雨のページ" })).toBeVisible();
});

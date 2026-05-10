import { expect, test } from "@playwright/test";

test("navigates title, runtime, backlog, settings, and gallery", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Tsuzuru HTML Basic" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start" })).toBeVisible();

  const viewport = page.locator(".html-basic-app__viewport");
  await expect(viewport).toHaveJSProperty("clientWidth", 1280);
  await expect(viewport).toHaveJSProperty("clientHeight", 720);

  await page.getByRole("link", { name: "Start" }).click();
  await expect(page.getByRole("navigation", { name: "Runtime menu" })).toBeVisible();
  await expect(page.locator(".tzr-html-message-window")).toBeVisible();
  await page.locator(".tzr-html-viewport").click({ position: { x: 640, y: 360 } });
  await expect(page.locator(".tzr-html-background")).toBeVisible();
  await expect(page.locator(".tzr-html-sprite")).toBeVisible();

  await expect(page).toHaveURL(/#runtime$/);
  await page.getByRole("navigation", { name: "Runtime menu" }).getByRole("link", { name: "Backlog" }).click();
  await expect(page).toHaveURL(/#backlog$/);
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
  await expect(page.locator(".tzr-html-app-backlog__text")).toContainText("Preact も TSX も使わない");
  await page.getByRole("link", { name: "Back", exact: true }).click();

  await page.getByRole("navigation", { name: "Runtime menu" }).getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const fontSize = page.getByLabel("Text font size");
  await fontSize.fill("1.35");
  await expect(page.locator(".html-basic-app")).toHaveCSS("--tzr-html-app-message-font-size", "1.35rem");
  await page.getByRole("link", { name: "Back", exact: true }).click();

  await page.getByRole("navigation", { name: "Runtime menu" }).getByRole("link", { name: "Gallery" }).click();
  await expect(page.getByRole("heading", { name: "Gallery" })).toBeVisible();
  await expect(page.getByText("room")).toBeVisible();
  await expect(page.getByText("mio_smile")).toBeVisible();
  await expect(page.locator(".tzr-html-app-gallery__image").first()).toBeVisible();
  await page.getByRole("link", { name: "Back", exact: true }).click();

  await expect(page.locator(".tzr-html-message-window")).toBeVisible();
});

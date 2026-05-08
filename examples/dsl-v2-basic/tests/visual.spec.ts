import { expect, test } from "@playwright/test";

const SAVE_STORAGE_KEY = "tsuzuru:example-dsl-v2-basic:saves:v1";
const PREFERENCES_STORAGE_KEY = "tsuzuru:example-dsl-v2-basic:preferences:v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ saveStorageKey, preferencesStorageKey }) => {
      window.localStorage.removeItem(saveStorageKey);
      window.localStorage.removeItem(preferencesStorageKey);
    },
    {
      saveStorageKey: SAVE_STORAGE_KEY,
      preferencesStorageKey: PREFERENCES_STORAGE_KEY,
    },
  );
});

test("fullscreen visual novel UI smoke check", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("Step")).toHaveCount(0);
  await expect(page.locator(".debug-panel")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "DSL v2 Basic" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("title-screen.png") });
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Text reveal", { exact: true }).uncheck();
  await page.getByLabel("Text speed", { exact: true }).selectOption("120");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "DSL v2 Basic" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  await expect(messageWindow).toContainText("遅いよ。");

  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  await runtimeMenu.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Text reveal", { exact: true }).check();
  await page.getByLabel("Text speed", { exact: true }).selectOption("60");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toHaveCount(0);
  await expect(messageWindow).toContainText("遅いよ。");

  await runtimeMenu.getByRole("button", { name: "Backlog" }).click();
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
  await expect(page.locator(".backlog")).toContainText("遅いよ。");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Backlog" })).toHaveCount(0);
  await expect(messageWindow).toContainText("遅いよ");

  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();
  await runtimeMenu.getByRole("button", { name: "Title" }).click();

  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(messageWindow).toBeVisible();
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

test("auto mode advances messages and pauses at choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const autoButton = runtimeMenu.getByRole("button", { name: "Auto", exact: true });

  await expect(messageWindow).toContainText("遅いよ。", { timeout: 3000 });
  await expect(autoButton).toHaveAttribute("aria-pressed", "false");

  await autoButton.click();
  await expect(autoButton).toHaveAttribute("aria-pressed", "true");
  await expect(messageWindow).toContainText("スコアが増えた", { timeout: 5000 });

  const choiceLayer = page.locator(".tzr-choice-layer");
  await expect(choiceLayer).toContainText("どうする？", { timeout: 6000 });
  await page.waitForTimeout(1800);
  await expect(choiceLayer).toContainText("どうする？");
  await expect(messageWindow).not.toContainText("ちゃんと見ておいて");

  await autoButton.click();
  await expect(autoButton).toHaveAttribute("aria-pressed", "false");
});

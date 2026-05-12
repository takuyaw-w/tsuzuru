import { expect, type Locator, test } from "@playwright/test";

const SAVE_STORAGE_KEY = "tsuzuru:example-preact-basic:saves:v1";
const PREFERENCES_STORAGE_KEY = "tsuzuru:example-preact-basic:preferences:v1";
const READ_TRACKING_STORAGE_KEY = "tsuzuru:example-preact-basic:read-tracking:v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ preferencesStorageKey, readTrackingStorageKey, saveStorageKey }) => {
      window.localStorage.removeItem(saveStorageKey);
      window.localStorage.removeItem(preferencesStorageKey);
      window.localStorage.removeItem(readTrackingStorageKey);
    },
    {
      preferencesStorageKey: PREFERENCES_STORAGE_KEY,
      readTrackingStorageKey: READ_TRACKING_STORAGE_KEY,
      saveStorageKey: SAVE_STORAGE_KEY,
    },
  );
});

test("fullscreen visual novel UI smoke check", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("Step")).toHaveCount(0);
  await expect(page.locator(".debug-panel")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Preact Basic" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("title-screen.png") });
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Text reveal", { exact: true }).uncheck();
  await page.getByLabel("Text speed", { exact: true }).selectOption("120");
  await page.getByLabel("Text sound", { exact: true }).uncheck();
  await expect(page.getByLabel("Text sound volume", { exact: true })).toBeVisible();
  await expect(page.getByLabel("BGM volume", { exact: true })).toBeVisible();
  await expect(page.getByLabel("SE volume", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Voice volume", { exact: true })).toBeVisible();
  await setRangeValue(page.getByLabel("Text sound volume", { exact: true }), "0.4");
  await setRangeValue(page.getByLabel("BGM volume", { exact: true }), "0.35");
  await setRangeValue(page.getByLabel("SE volume", { exact: true }), "0.45");
  await setRangeValue(page.getByLabel("Voice volume", { exact: true }), "0.55");
  await expect(page.getByLabel("Text sound volume", { exact: true })).toHaveValue("0.4");
  await expect(page.getByLabel("BGM volume", { exact: true })).toHaveValue("0.35");
  await expect(page.getByLabel("SE volume", { exact: true })).toHaveValue("0.45");
  await expect(page.getByLabel("Voice volume", { exact: true })).toHaveValue("0.55");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preact Basic" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const audioLayer = page.locator('[aria-label="std-audio state"]');
  await expect(messageWindow).toContainText("夜の旧校舎");
  await expect(audioLayer).toContainText("BGM");
  await expect(audioLayer).toContainText("daily_theme");
  await expect(audioLayer).toContainText("SE");
  await expect(audioLayer).toContainText("none");
  await expect(audioLayer).toContainText("Voice");

  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  await runtimeMenu.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Text reveal", { exact: true }).check();
  await page.getByLabel("Text speed", { exact: true }).selectOption("60");
  await page.getByLabel("Text sound", { exact: true }).check();
  await setRangeValue(page.getByLabel("Text sound volume", { exact: true }), "0.55");
  await setRangeValue(page.getByLabel("BGM volume", { exact: true }), "0.6");
  await setRangeValue(page.getByLabel("SE volume", { exact: true }), "0.8");
  await setRangeValue(page.getByLabel("Voice volume", { exact: true }), "0.9");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toHaveCount(0);
  await expect(messageWindow).toContainText("夜の旧校舎");

  await runtimeMenu.getByRole("button", { name: "Backlog" }).click();
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
  await expect(page.locator(".backlog")).toContainText("夜の旧校舎");
  await expect(page.locator(".backlog__read-badge")).toContainText("Read");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Backlog" })).toHaveCount(0);
  await expect(messageWindow).toContainText("夜の旧校舎");

  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();
  await runtimeMenu.getByRole("button", { name: "Title" }).click();

  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(messageWindow).toBeVisible();
  await expect(messageWindow).toContainText("夜の旧校舎");

  await messageWindow.click();
  await expect(messageWindow).toContainText("夜の旧校舎");

  await messageWindow.click();
  await expect(messageWindow).toContainText("ようこそ");
  await expect(audioLayer).toContainText("daily_theme");
  await expect(audioLayer).toContainText("Voice");
});

test("save and load restore retained message behind choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const retainedMessage = page.locator(".app__retained-message");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await advanceMessages(messageWindow, 8);
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 3000 });
  await expect(retainedMessage).toContainText("物語の常用音");

  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();
  await runtimeMenu.getByRole("button", { name: "Title" }).click();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 3000 });
  await expect(retainedMessage).toContainText("物語の常用音");

  await runtimeMenu.getByRole("button", { name: "Title" }).click();
  await page.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 3000 });
  await expect(retainedMessage).toContainText("物語の常用音");

  await choiceLayer.getByRole("button", { name: "澄んだ tone を聞く" }).click();
  await expect(messageWindow).toContainText("では tone をもう少し詳しく", { timeout: 3000 });
  await runtimeMenu.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 3000 });
  await expect(retainedMessage).toContainText("物語の常用音");
});

test("auto mode advances messages and pauses at choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const autoButton = runtimeMenu.getByRole("button", { name: "Auto", exact: true });
  const readStatus = page.locator(".read-status");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await expect(readStatus).toHaveText("Read: 1");
  await expect(autoButton).toHaveAttribute("aria-pressed", "false");

  await autoButton.click();
  await expect(autoButton).toHaveAttribute("aria-pressed", "true");
  await expect(messageWindow).toContainText("ようこそ", { timeout: 5000 });
  await expect(readStatus).toHaveText("Read: 2");

  const choiceLayer = page.locator(".tzr-choice-layer");
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 10000 });
  await page.waitForTimeout(1800);
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？");
  await expect(messageWindow).not.toContainText("では tone をもう少し詳しく");

  await autoButton.click();
  await expect(autoButton).toHaveAttribute("aria-pressed", "false");
});

test("skip mode does not skip unread messages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const skipButton = runtimeMenu.getByRole("button", { name: "Skip", exact: true });
  const readStatus = page.locator(".read-status");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await expect(readStatus).toHaveText("Read: 1");
  await expect(skipButton).toHaveAttribute("aria-pressed", "false");

  await skipButton.click();
  await expect(skipButton).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(700);

  await expect(readStatus).toHaveText("Read: 1");
  await expect(messageWindow).toContainText("夜の旧校舎");
  await expect(messageWindow).not.toContainText("ようこそ");
});

test("skip mode skips previously read messages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const skipButton = runtimeMenu.getByRole("button", { name: "Skip", exact: true });
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();
  await expect(page.getByRole("heading", { name: "Save" })).toHaveCount(0);

  await messageWindow.click();
  await expect(messageWindow).toContainText("ようこそ、Text Sound Lab", { timeout: 4000 });

  await skipButton.click();
  await expect(skipButton).toHaveAttribute("aria-pressed", "true");
  await runtimeMenu.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();

  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 3000 });
  await expect(choiceLayer).toContainText("澄んだ tone を聞く");
});

test("skip mode pauses at choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const skipButton = runtimeMenu.getByRole("button", { name: "Skip", exact: true });
  const choiceLayer = page.locator(".tzr-choice-layer");

  await skipButton.click();
  await expect(skipButton).toHaveAttribute("aria-pressed", "true");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await page.waitForTimeout(700);
  await expect(messageWindow).toContainText("夜の旧校舎");

  await messageWindow.click();
  await expect(messageWindow).toContainText("ようこそ、Text Sound Lab", { timeout: 4000 });
  await page.waitForTimeout(700);
  await expect(messageWindow).toContainText("ようこそ、Text Sound Lab");

  await advanceMessages(messageWindow, 6);
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 3000 });
  await page.waitForTimeout(900);
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？");
  await expect(choiceLayer).toContainText("重ねた mix を聞く");
});

test("read tracking records current-session messages in runtime and backlog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const readStatus = page.locator(".read-status");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await expect(readStatus).toHaveText("Read: 1");

  await runtimeMenu.getByRole("button", { name: "Backlog" }).click();
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
  await expect(page.locator(".backlog")).toContainText("夜の旧校舎");
  await expect(page.locator(".backlog__read-badge")).toContainText("Read");

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Backlog" })).toHaveCount(0);

  await messageWindow.click();
  await expect(messageWindow).toContainText("ようこそ", { timeout: 4000 });
  await expect(readStatus).toHaveText("Read: 2");
});

async function setRangeValue(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((element, nextValue) => {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error("Expected an input element.");
    }
    element.value = nextValue;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function advanceMessages(messageWindow: Locator, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await messageWindow.click();
  }
}

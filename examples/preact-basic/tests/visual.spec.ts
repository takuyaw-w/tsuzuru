import { expect, type Locator, type Page, test } from "@playwright/test";

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

test("title, settings, runtime, backlog, and save/load smoke check", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByText("Step")).toHaveCount(0);
  await expect(page.locator(".debug-panel")).toHaveCount(0);

  await expect(page.getByRole("region", { name: "Title" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preact Basic" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("title-screen.png") });

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "CONFIG" })).toBeVisible();
  await expectWideConfigPanel(page);
  await expect(page.getByRole("dialog", { name: "Settings screen" })).toHaveCount(0);
  await setToggle(page, "Text reveal", "Off");
  await setSegment(page, "Text speed", "Fast");
  await selectConfigTab(page, "Sound");
  await setToggle(page, "Text sound", "Off");
  await expect(page.getByLabel("Text sound volume", { exact: true })).toBeVisible();
  await expect(page.getByLabel("BGM volume", { exact: true })).toBeVisible();
  await expect(page.getByLabel("SE volume", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Voice volume", { exact: true })).toBeVisible();
  await setRangeValue(page.getByLabel("Text sound volume", { exact: true }), "0.4");
  await setRangeValue(page.getByLabel("BGM volume", { exact: true }), "0.35");
  await setRangeValue(page.getByLabel("SE volume", { exact: true }), "0.45");
  await setRangeValue(page.getByLabel("Voice volume", { exact: true }), "0.55");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preact Basic" })).toBeVisible();

  await page.getByRole("button", { name: "Start" }).click();
  const messageWindow = page.locator(".tzr-message-window");
  const audioLayer = page.locator('[aria-label="std-audio state"]');
  await expect(page.locator(".tzr-std-effect-layer")).toBeAttached();
  await expectViewportAspectRatio(page);
  await expect(messageWindow).toContainText("夕暮れの駅前", { timeout: 3000 });
  await expect(audioLayer).toContainText("BGM");
  await expect(audioLayer).toContainText("daily_theme");

  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  await runtimeMenu.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "CONFIG" })).toBeVisible();
  await expectWideConfigPanel(page);
  await expect(runtimeMenu).toHaveCount(0);
  await expect(messageWindow).toHaveCount(0);
  await setToggle(page, "Text reveal", "On");
  await setSegment(page, "Text speed", "Normal");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(messageWindow).toContainText("夕暮れの駅前");

  await runtimeMenu.getByRole("button", { name: "Backlog" }).click();
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();
  const backlogScreen = page.getByRole("region", { name: "Backlog" });
  await expect(backlogScreen).toContainText("夕暮れの駅前");
  await expect(backlogScreen.getByText("Read", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();

  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();
  await runtimeMenu.getByRole("button", { name: "Title" }).click();

  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(messageWindow).toContainText("夕暮れの駅前", { timeout: 3000 });
});

test("save and load restore retained message behind the first choice", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const retainedMessage = page.locator(".app__retained-message");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(messageWindow).toContainText("夕暮れの駅前", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "最初にどこを調べる？");
  await expect(retainedMessage).toContainText("栞の先");

  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();
  await runtimeMenu.getByRole("button", { name: "Title" }).click();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(choiceLayer).toContainText("最初にどこを調べる？", { timeout: 3000 });
  await expect(retainedMessage).toContainText("栞の先");

  await runtimeMenu.getByRole("button", { name: "Title" }).click();
  await page.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();
  await expect(choiceLayer).toContainText("最初にどこを調べる？", { timeout: 3000 });

  await choiceLayer.getByRole("button", { name: "図書室で手がかりを探す" }).click();
  await expect(messageWindow).toContainText("図書室には", { timeout: 3000 });
  await runtimeMenu.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();
  await expect(choiceLayer).toContainText("最初にどこを調べる？", { timeout: 3000 });
});

test("short story branches through backgrounds, particles, and choices", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const choiceLayer = page.locator(".tzr-choice-layer");
  const visualLayer = page.locator(".tzr-tsuzuru-game__visual-layer");

  await expect(messageWindow).toContainText("夕暮れの駅前", { timeout: 3000 });
  await expectBackgroundAsset(page, "station");
  await advanceUntilChoice(messageWindow, choiceLayer, "最初にどこを調べる？");

  await choiceLayer.getByRole("button", { name: "図書室で手がかりを探す" }).click();
  await expect(messageWindow).toContainText("図書室には", { timeout: 3000 });
  await expectBackgroundAsset(page, "library");
  await expect(page.locator(".tzr-std-particle-layer--dust.tzr-std-particle-layer--light")).toBeAttached();

  await advanceUntilChoice(messageWindow, choiceLayer, "ノートをどう扱う？");
  await expectBackgroundAsset(page, "hallway");
  await expect(page.locator(".tzr-std-particle-layer")).toHaveCount(0);
  await choiceLayer.getByRole("button", { name: "二人で続きを書く" }).click();
  await expect(messageWindow).toContainText("空き教室", { timeout: 3000 });
  await expectBackgroundAsset(page, "classroom");
  await expect(visualLayer.locator(".tzr-tsuzuru-game__background").first()).toHaveCSS("pointer-events", "none");
});

test("runtime settings screen pauses keyboard advance without a modal dialog", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });

  await expect(messageWindow).toContainText("夕暮れの駅前", { timeout: 3000 });

  await runtimeMenu.getByRole("button", { name: "Settings" }).click();
  const settingsScreen = page.getByRole("region", { name: "Settings" });
  const settingsRuntimeScreen = page.locator(".app__runtime-screen");
  await expect(settingsScreen).toBeVisible();
  await expect(page.getByRole("heading", { name: "CONFIG" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Settings screen" })).toHaveCount(0);
  await expect(runtimeMenu).toHaveCount(0);
  await expect(messageWindow).toHaveCount(0);
  await settingsRuntimeScreen.focus();
  await expect(settingsRuntimeScreen).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");

  await settingsScreen.getByRole("button", { name: "Back", exact: true }).click();
  await expect(settingsScreen).toHaveCount(0);
  await expect(messageWindow).toContainText("夕暮れの駅前");
  await expect(messageWindow).not.toContainText("旧校舎の文芸部");
});

test("auto mode advances messages and pauses at choices", async ({ page }) => {
  test.setTimeout(30_000);

  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const autoButton = runtimeMenu.getByRole("button", { name: "Auto", exact: true });
  const readStatus = runtimeMenu.getByLabel("Read count");

  await expect(messageWindow).toContainText("夕暮れの駅前", { timeout: 3000 });
  await expect(readStatus).toHaveText("Read: 1");
  await expect(autoButton).toHaveAttribute("aria-pressed", "false");

  await autoButton.click();
  await expect(autoButton).toHaveAttribute("aria-pressed", "true");
  await expect(messageWindow).toContainText("文芸部が使っていた", { timeout: 5000 });
  await expect.poll(async () => readCount(readStatus)).toBeGreaterThan(1);

  const choiceLayer = page.locator(".tzr-choice-layer");
  await expect(choiceLayer).toContainText("最初にどこを調べる？", { timeout: 16_000 });
  await page.waitForTimeout(1500);
  await expect(choiceLayer).toContainText("最初にどこを調べる？");
  await expect(messageWindow).not.toContainText("図書室には");

  await autoButton.click();
  await expect(autoButton).toHaveAttribute("aria-pressed", "false");
});

test("skip mode pauses at choices after current-session read tracking", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const skipButton = runtimeMenu.getByRole("button", { name: "Skip", exact: true });
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(messageWindow).toContainText("夕暮れの駅前", { timeout: 3000 });
  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();

  await advanceUntilChoice(messageWindow, choiceLayer, "最初にどこを調べる？");

  await skipButton.click();
  await expect(skipButton).toHaveAttribute("aria-pressed", "true");
  await runtimeMenu.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();

  await expect(choiceLayer).toContainText("最初にどこを調べる？", { timeout: 3000 });
  await expect(choiceLayer).toContainText("屋上で封筒を開ける");
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

async function disableTextReveal(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await setToggle(page, "Text reveal", "Off");
  await page.getByRole("button", { name: "Back", exact: true }).click();
}

async function setToggle(page: Page, groupName: string, value: "On" | "Off"): Promise<void> {
  await page.getByRole("group", { name: groupName }).getByRole("button", { name: value }).click();
}

async function setSegment(page: Page, groupName: string, value: string): Promise<void> {
  await page.getByRole("group", { name: groupName }).getByRole("button", { name: value }).click();
}

async function selectConfigTab(page: Page, name: "Text" | "Sound"): Promise<void> {
  await page.locator(`label[for="settings-tab-${name.toLowerCase()}"]`).click();
}

async function expectWideConfigPanel(page: Page): Promise<void> {
  const box = await page.locator(".settings-config__panel").boundingBox();
  expect(box).not.toBeNull();
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeGreaterThan(1.45);
  const hasViewportScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(hasViewportScroll).toBe(false);
}

async function advanceUntilChoice(
  messageWindow: Locator,
  choiceLayer: Locator,
  question: string,
  maxClicks = 24,
): Promise<void> {
  for (let index = 0; index <= maxClicks; index += 1) {
    if (await locatorContainsText(choiceLayer, question)) {
      await expect(choiceLayer).toContainText(question, { timeout: 3000 });
      return;
    }
    if (index === maxClicks) {
      break;
    }
    await messageWindow.click();
  }
  await expect(choiceLayer).toContainText(question, { timeout: 3000 });
}

async function expectBackgroundAsset(page: Page, assetId: string): Promise<void> {
  await expect(page.locator(".tzr-tsuzuru-game__background--current")).toHaveAttribute(
    "src",
    new RegExp(`/assets/backgrounds/${assetId}\\.svg$`),
    { timeout: 3000 },
  );
}

async function expectViewportAspectRatio(page: Page): Promise<void> {
  const box = await page.locator(".app__viewport").boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  expect(box.width / box.height).toBeGreaterThan(1.76);
  expect(box.width / box.height).toBeLessThan(1.79);
}

async function locatorContainsText(locator: Locator, text: string): Promise<boolean> {
  const textContent = await locator.textContent({ timeout: 250 }).catch(() => null);
  return textContent?.includes(text) ?? false;
}

async function readCount(locator: Locator): Promise<number> {
  const textContent = await locator.textContent();
  const match = textContent?.match(/Read: (\d+)/);
  return match === null || match === undefined ? 0 : Number(match[1]);
}

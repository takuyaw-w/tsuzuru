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
  await expect(page.locator(".effect-layer")).toBeAttached();
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

  await advanceUntilText(messageWindow, "ようこそ", 10);
  await expect(audioLayer).toContainText("daily_theme");
  await expect(audioLayer).toContainText("Voice");
});

test("save and load restore retained message behind choices", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const retainedMessage = page.locator(".app__retained-message");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "どの音を先に詳しく聞く？");
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

test("effect demo choice exposes individual effect paths", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "どの音を先に詳しく聞く？");

  await choiceLayer.getByRole("button", { name: "澄んだ tone を聞く" }).click();
  await expect(messageWindow).toContainText("では tone をもう少し詳しく", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "今度は、どの effect を試す？");

  await expect(choiceLayer).toContainText("今度は、どの effect を試す？", { timeout: 3000 });
  await expect(choiceLayer.getByRole("button", { name: "shake を試す" })).toBeVisible();
  await expect(choiceLayer.getByRole("button", { name: "flash を試す" })).toBeVisible();
  await expect(choiceLayer.getByRole("button", { name: "pulse を試す" })).toBeVisible();
  await expect(choiceLayer.getByRole("button", { name: "blur を試す" })).toBeVisible();

  await choiceLayer.getByRole("button", { name: "shake を試す" }).click();
  await expect(messageWindow).toContainText("まずは shake", { timeout: 3000 });
  await advanceUntilText(messageWindow, "衝撃や落下", 3);
  await advanceUntilChoice(messageWindow, choiceLayer, "もう一度 effect を試す？", 3);

  await expect(choiceLayer).toContainText("もう一度 effect を試す？", { timeout: 3000 });
  await choiceLayer.getByRole("button", { name: "Text Sound Lab に戻る" }).click();
  await expect(choiceLayer).toContainText("camera demo を試す？", { timeout: 3000 });
  await expect(choiceLayer.getByRole("button", { name: "camera focus を見る" })).toBeVisible();
  await expect(choiceLayer.getByRole("button", { name: "Text Sound Lab に戻る" })).toBeVisible();

  await choiceLayer.getByRole("button", { name: "camera focus を見る" }).click();
  await expect(messageWindow).toContainText("まずは、僕に寄ってみよう", { timeout: 3000 });
});

test("transition demo renders 16:9 SVG backgrounds and restores interaction", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const choiceLayer = page.locator(".tzr-choice-layer");
  const visualLayer = page.locator(".visual-layer");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await expectViewportAspectRatio(page);
  await advanceUntilChoice(messageWindow, choiceLayer, "どの音を先に詳しく聞く？");
  await choiceLayer.getByRole("button", { name: "澄んだ tone を聞く" }).click();
  await expect(messageWindow).toContainText("では tone をもう少し詳しく", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "今度は、どの effect を試す？");
  await choiceLayer.getByRole("button", { name: "shake を試す" }).click();
  await expect(messageWindow).toContainText("まずは shake", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "もう一度 effect を試す？", 4);
  await choiceLayer.getByRole("button", { name: "背景切り替えを試す" }).click();

  await expect(messageWindow).toContainText("放課後の教室から", { timeout: 3000 });
  await advanceAndExpectBackground(page, messageWindow, "classroom", "まずは暗転で廊下へ");
  await advanceAndExpectBackground(page, messageWindow, "hallway", "左から景色が流れて");
  await advanceAndExpectBackground(page, messageWindow, "library", "右へ抜けるように");
  await expect(page.locator(".visual-layer__background--previous")).toHaveCount(0, { timeout: 1000 });
  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();
  await expectSavedBackgroundTransition(page, "library", "wipeLeft");

  await advanceAndExpectBackground(page, messageWindow, "rooftop", "最後は駅前で");
  await runtimeMenu.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();
  await expectBackgroundAsset(page, "library");
  await expect(page.locator(".visual-layer__background--previous")).toHaveCount(0);
  await expect(page.locator(".visual-layer__background--current")).not.toHaveClass(/transition-/);
  await expect(messageWindow).toContainText("右へ抜けるように", { timeout: 3000 });

  await advanceAndExpectBackground(page, messageWindow, "rooftop", "最後は駅前で");
  await advanceAndExpectBackground(page, messageWindow, "station", "背景切り替え demo はここまで");

  await messageWindow.click();
  await expect(choiceLayer.getByRole("button", { name: "camera focus を見る" })).toBeVisible();
  await expect(visualLayer.locator(".visual-layer__background").first()).toHaveCSS("pointer-events", "none");
});

test("particle demo renders bounded non-interactive overlay particles", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "どの音を先に詳しく聞く？");
  await choiceLayer.getByRole("button", { name: "澄んだ tone を聞く" }).click();
  await expect(messageWindow).toContainText("では tone をもう少し詳しく", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "今度は、どの effect を試す？");

  await choiceLayer.getByRole("button", { name: "shake を試す" }).click();
  await expect(messageWindow).toContainText("まずは shake", { timeout: 3000 });
  await advanceUntilChoice(messageWindow, choiceLayer, "もう一度 effect を試す？", 4);

  await choiceLayer.getByRole("button", { name: "Text Sound Lab に戻る" }).click();
  await expect(choiceLayer).toContainText("camera demo を試す？", { timeout: 3000 });
  await choiceLayer.getByRole("button", { name: "Text Sound Lab に戻る" }).click();
  await expect(choiceLayer).toContainText("particle demo を試す？", { timeout: 3000 });

  await choiceLayer.getByRole("button", { name: "雨を降らせる" }).click();
  await expect(messageWindow).toContainText("雨は、画面全体の空気を冷たくする。", { timeout: 3000 });

  const particleLayer = page.locator(".particle-layer--rain.particle-layer--normal");
  await expect(particleLayer).toBeAttached();
  await expect(particleLayer).toHaveCSS("pointer-events", "none");
  await expect(particleLayer.locator(".particle-layer__particle")).toHaveCount(38);

  await messageWindow.click();
  await expect(choiceLayer).toContainText("particle を止める？", { timeout: 3000 });
  await choiceLayer.getByRole("button", { name: "別の particle を試す" }).click();
  await expect(choiceLayer).toContainText("particle demo を試す？", { timeout: 3000 });
  await choiceLayer.getByRole("button", { name: "埃を漂わせる" }).click();
  await expect(messageWindow).toContainText("埃が光の中をゆっくり漂っている。", { timeout: 3000 });

  const dustLayer = page.locator(".particle-layer--dust.particle-layer--light");
  await expect(dustLayer).toBeAttached();
  await expect(dustLayer).toHaveCSS("pointer-events", "none");
  await expect(dustLayer.locator(".particle-layer__particle")).toHaveCount(22);

  await messageWindow.click();
  await expect(choiceLayer).toContainText("particle を止める？", { timeout: 3000 });
  await choiceLayer.getByRole("button", { name: "止める" }).click();
  await expect(page.locator(".particle-layer")).toHaveCount(0);
  await expect(messageWindow).toContainText("メトロノームが一度だけ止まり", { timeout: 3000 });
});

test("auto mode advances messages and pauses at choices", async ({ page }) => {
  test.setTimeout(45_000);

  await page.goto("/");
  await disableTextReveal(page);
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
  await expect.poll(async () => readCount(readStatus)).toBeGreaterThan(1);

  const choiceLayer = page.locator(".tzr-choice-layer");
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 26_000 });
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
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });
  const skipButton = runtimeMenu.getByRole("button", { name: "Skip", exact: true });
  const choiceLayer = page.locator(".tzr-choice-layer");

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();
  await expect(page.getByRole("heading", { name: "Save" })).toHaveCount(0);

  await advanceUntilChoice(messageWindow, choiceLayer, "どの音を先に詳しく聞く？");

  await skipButton.click();
  await expect(skipButton).toHaveAttribute("aria-pressed", "true");
  await runtimeMenu.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();

  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？", { timeout: 3000 });
  await expect(choiceLayer).toContainText("澄んだ tone を聞く");
});

test("skip mode pauses at choices", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
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
  await expect(messageWindow).toContainText("その隣で", { timeout: 4000 });
  await page.waitForTimeout(700);
  await expect(messageWindow).toContainText("その隣で");

  await advanceUntilChoice(messageWindow, choiceLayer, "どの音を先に詳しく聞く？");
  await page.waitForTimeout(900);
  await expect(choiceLayer).toContainText("どの音を先に詳しく聞く？");
  await expect(choiceLayer).toContainText("重ねた mix を聞く");
});

test("read tracking records current-session messages in runtime and backlog", async ({ page }) => {
  await page.goto("/");
  await disableTextReveal(page);
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
  await expect(messageWindow).toContainText("その隣で", { timeout: 4000 });
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

async function disableTextReveal(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Text reveal", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Back", exact: true }).click();
}

async function advanceUntilText(messageWindow: Locator, text: string, maxClicks = 24): Promise<void> {
  for (let index = 0; index <= maxClicks; index += 1) {
    if (await locatorContainsText(messageWindow, text)) {
      await expect(messageWindow).toContainText(text, { timeout: 3000 });
      return;
    }
    if (index === maxClicks) {
      break;
    }
    await messageWindow.click();
  }
  await expect(messageWindow).toContainText(text, { timeout: 3000 });
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

async function advanceAndExpectBackground(
  page: Page,
  messageWindow: Locator,
  assetId: string,
  nextText: string,
): Promise<void> {
  await messageWindow.click();
  await expectBackgroundAsset(page, assetId);
  await expect(page.locator(".visual-layer__background--current .visual-layer__scene")).toHaveAttribute(
    "aria-label",
    assetId,
  );
  await expect(page.locator(".visual-layer__background--current .visual-layer__scene-image")).toHaveAttribute(
    "src",
    new RegExp(`/assets/backgrounds/${assetId}\\.svg$`),
  );

  const choiceLayer = page.locator(".tzr-choice-layer");
  if (await locatorContainsText(choiceLayer, nextText)) {
    await expect(choiceLayer).toContainText(nextText, { timeout: 3000 });
    return;
  }
  await expect(messageWindow).toContainText(nextText, { timeout: 3000 });
}

async function expectBackgroundAsset(page: Page, assetId: string): Promise<void> {
  await expect(page.locator(".visual-layer__background--current .visual-layer__scene-image")).toHaveAttribute(
    "src",
    new RegExp(`/assets/backgrounds/${assetId}\\.svg$`),
    { timeout: 3000 },
  );
}

async function expectSavedBackgroundTransition(page: Page, assetId: string, effect: string): Promise<void> {
  const rawValue = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), SAVE_STORAGE_KEY);
  expect(rawValue).not.toBeNull();

  const parsed: unknown = JSON.parse(rawValue ?? "null");
  if (!Array.isArray(parsed)) {
    throw new Error("Expected preact-basic save storage to contain a slot array.");
  }

  const slot = getObjectRecord(parsed[0], "stored save slot");
  const data = getObjectRecord(slot.data, "stored save slot data");
  const runtime = getObjectRecord(data.runtime, "RuntimeSaveData");
  const snapshot = getObjectRecord(runtime.snapshot, "RuntimeSaveData.snapshot");
  const plugins = getObjectRecord(snapshot.plugins, "RuntimeSaveData.snapshot.plugins");
  const stdVisual = getObjectRecord(plugins.stdVisual, "RuntimeSaveData.snapshot.plugins.stdVisual");
  const background = getObjectRecord(stdVisual.background, "RuntimeSaveData.snapshot.plugins.stdVisual.background");
  const transition = getObjectRecord(
    background.transition,
    "RuntimeSaveData.snapshot.plugins.stdVisual.background.transition",
  );

  expect(background.assetId).toBe(assetId);
  expect(transition.effect).toBe(effect);
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

function getObjectRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return value;
}

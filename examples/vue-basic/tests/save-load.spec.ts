import { expect, type Page, test } from "@playwright/test";

const SAVE_STORAGE_KEY = "tsuzuru:example-vue-basic:saves:v1";
const PREFERENCES_STORAGE_KEY = "tsuzuru:example-vue-basic:preferences:v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ preferencesStorageKey, saveStorageKey }) => {
      window.localStorage.removeItem(saveStorageKey);
      window.localStorage.removeItem(preferencesStorageKey);
    },
    {
      preferencesStorageKey: PREFERENCES_STORAGE_KEY,
      saveStorageKey: SAVE_STORAGE_KEY,
    },
  );
});

test("saves to localStorage and restores the visible runtime message", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".message-window");
  const runtimeControls = page.getByRole("navigation", { name: "Runtime controls" });

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 8000 });
  await expect(runtimeControls.getByRole("button", { name: "Load" })).toBeDisabled();

  await runtimeControls.getByRole("button", { name: "Save" }).click();
  await expect(runtimeControls.getByRole("button", { name: "Load" })).toBeEnabled();

  const data = getSaveDataRecord((await readSaveSlots(page))[0]);
  expect(data.version).toBe(1);
  expectRuntimeSaveSlotEnvelope(data);

  await messageWindow.click();
  await expect(messageWindow).toContainText("ようこそ", { timeout: 4000 });

  await runtimeControls.getByRole("button", { name: "Load" }).click();
  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 8000 });

  expect(pageErrors).toEqual([]);
});

test("ignores mismatched save slots without enabling load actions", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto("/");
  await page.evaluate(
    ({ saveStorageKey, slots }) => {
      window.localStorage.setItem(saveStorageKey, JSON.stringify(slots));
    },
    {
      saveStorageKey: SAVE_STORAGE_KEY,
      slots: [createMismatchedStoredSlot()],
    },
  );
  await page.reload();

  await page.getByRole("button", { name: "Start" }).click();
  const runtimeControls = page.getByRole("navigation", { name: "Runtime controls" });
  await expect(runtimeControls.getByRole("button", { name: "Load" })).toBeDisabled();

  expect(pageErrors).toEqual([]);
});

async function disableTextReveal(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Text reveal", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Back", exact: true }).click();
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
}

async function readSaveSlots(page: Page): Promise<readonly unknown[]> {
  const rawValue = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), SAVE_STORAGE_KEY);
  expect(rawValue).not.toBeNull();

  const parsed: unknown = JSON.parse(rawValue ?? "null");
  if (!Array.isArray(parsed)) {
    throw new Error("Expected vue-basic save storage to contain a slot array.");
  }
  expect(parsed).toHaveLength(1);
  return parsed;
}

function getSaveDataRecord(slot: unknown): Readonly<Record<string, unknown>> {
  return getObjectRecord(getObjectRecord(slot, "stored save slot").data, "stored save slot data");
}

function expectRuntimeSaveSlotEnvelope(data: Readonly<Record<string, unknown>>): void {
  const saveSlot = getObjectRecord(data.saveSlot, "RuntimeSaveSlot");
  expect(saveSlot.version).toBe(1);
  expect(typeof saveSlot.scenarioId).toBe("string");
  expect(saveSlot.scenarioId).not.toBe("");

  const snapshot = getObjectRecord(saveSlot.snapshot, "RuntimeSaveSlot.snapshot");
  expect(snapshot.version).toBe(2);

  const runtime = getObjectRecord(data.runtime, "RuntimeSaveData");
  expect(runtime.version).toBe(2);
  expect(runtime.snapshot).toEqual(snapshot);
}

function createMismatchedStoredSlot(): unknown {
  const snapshot = {
    version: 2,
    pointer: {
      filePath: "scenario/main.tzr",
      instructionIndex: 1,
    },
    variables: {},
    plugins: {},
    branchFrames: [],
    pendingChoice: null,
    pendingWait: null,
    isStopped: false,
    isWaitingForClick: false,
  };
  const runtime = {
    version: 2,
    snapshot,
    event: null,
  };
  return {
    id: "slot-1",
    label: "Slot 1",
    savedAt: "2026-05-17T00:00:00.000Z",
    data: {
      version: 1,
      saveSlot: {
        version: 1,
        scenarioId: "tsuzuru.example.mismatched",
        scenarioVersion: "1",
        createdAt: "2026-05-17T00:00:00.000Z",
        snapshot,
      },
      runtime,
    },
  };
}

function getObjectRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return value;
}

import { expect, type Page, test } from "@playwright/test";

const SAVE_STORAGE_KEY = "tsuzuru:example-preact-basic:saves:v1";
const PREFERENCES_STORAGE_KEY = "tsuzuru:example-preact-basic:preferences:v1";
const READ_TRACKING_STORAGE_KEY = "tsuzuru:example-preact-basic:read-tracking:v1";
const PROJECT_ID = "tsuzuru.example.preact-basic";
const PROJECT_VERSION = "1";

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

test("saves to localStorage and restores the visible runtime message", async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto("/");
  await disableTextReveal(page);
  await page.getByRole("button", { name: "Start" }).click();

  const messageWindow = page.locator(".tzr-message-window");
  const runtimeMenu = page.getByRole("navigation", { name: "Runtime menu" });

  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });
  await runtimeMenu.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save Slot 1" }).click();

  const data = getSaveDataRecord((await readSaveSlots(page))[0]);
  expect(data.version).toBe(3);
  expectRuntimeSaveSlotEnvelope(data);

  await messageWindow.click();
  await expect(messageWindow).toContainText("その隣で", { timeout: 4000 });

  await runtimeMenu.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Load Slot 1" }).click();
  await expect(messageWindow).toContainText("夜の旧校舎", { timeout: 3000 });

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

  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

  await page.getByRole("button", { name: "Load", exact: true }).click();
  const slot = page.getByLabel("Slot 1");
  await expect(slot.getByText("Empty")).toBeVisible();
  await expect(slot.getByRole("button", { name: "Load Slot 1" })).toBeDisabled();

  expect(pageErrors).toEqual([]);
});

async function disableTextReveal(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("group", { name: "Text reveal" }).getByRole("button", { name: "Off" }).click();
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
    throw new Error("Expected preact-basic save storage to contain a slot array.");
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
  expect(saveSlot.scenarioId).toBe(PROJECT_ID);
  expect(saveSlot.scenarioVersion).toBe(PROJECT_VERSION);

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
      version: 3,
      saveSlot: {
        version: 1,
        scenarioId: "tsuzuru.example.mismatched",
        scenarioVersion: "1",
        createdAt: "2026-05-17T00:00:00.000Z",
        snapshot,
      },
      runtime,
      retainedMessageEvent: null,
    },
  };
}

function getObjectRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return value;
}

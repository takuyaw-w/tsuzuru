import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  clearClickWait,
  clearWait,
  compileTzr,
  createInitialRuntimeState,
  definePluginCommand,
  getRuntimeBlockReason,
  parseTzr,
  resolveChoice,
  stepRuntime,
  type RuntimeEvent,
  type RuntimePluginCommandHandler,
  type RuntimeState,
} from "@tsuzuru/core";

const scenarioPath = new URL("../scenario/main.tzr", import.meta.url);
const source = await readFile(scenarioPath, "utf8");
const filePath = fileURLToPath(scenarioPath);

const parsed = parseTzr(source, { filePath });
if (!parsed.ok) {
  console.error(parsed.errors);
  process.exitCode = 1;
} else {
  const compiled = compileTzr(parsed.document, {
    pluginCommands: {
      bg: definePluginCommand("bg"),
    },
  });
  if (!compiled.ok) {
    console.error(compiled.errors);
    process.exitCode = 1;
  } else {
    const commandHandlers: Record<string, RuntimePluginCommandHandler> = {
      bg(state, instruction) {
        const background = instruction.args[0];
        const value =
          background?.type === "PositionalArgument" && background.value.type === "StringValue"
            ? background.value.value
            : "unknown";

        return {
          state,
          event: { type: "pluginCommand", name: `bg:${value}` },
        };
      },
    };

    let state: RuntimeState = createInitialRuntimeState(compiled.document);
    let steps = 0;

    while (!state.isStopped && steps < 50) {
      const result = stepRuntime(compiled.document, state, { commandHandlers });
      state = result.state;
      steps += 1;

      logEvent(result.event);

      const blockReason = getRuntimeBlockReason(state);
      if (blockReason === "click") {
        state = clearClickWait(state);
      }
      if (blockReason === "wait") {
        console.log("host: clear wait immediately for this CLI example");
        state = clearWait(state);
      }
      if (blockReason === "choice") {
        console.log("host: choose item 0 for this CLI example");
        state = resolveChoice(compiled.document, state, 0).state;
      }
    }

    console.log("final variables:", state.variables);
    console.log("final flags:", state.flags);
  }
}

function logEvent(event: RuntimeEvent): void {
  switch (event.type) {
    case "scene":
      console.log(`#scene ${event.id}`);
      return;
    case "label":
      console.log(`#label ${event.id}`);
      return;
    case "narration":
      console.log(event.lines.map((line) => line.text).join("\n"));
      return;
    case "dialogue":
      console.log(`${event.speaker}: ${event.lines.map((line) => line.text).join(" ")}`);
      return;
    case "choice":
      console.log(`choice: ${event.question}`);
      event.items.forEach((item, index) => console.log(`  ${index}: ${item.text}`));
      return;
    case "waitClick":
      console.log("waitClick");
      return;
    case "page":
      console.log("page");
      return;
    case "wait":
      console.log(`wait ${event.durationMs}ms`);
      return;
    case "state":
      console.log(`state: ${event.command} ${event.name}=${String(event.value)}`);
      return;
    case "jump":
      console.log(`jump: #${event.label}`);
      return;
    case "pluginCommand":
      console.log(`plugin command: ${event.name}`);
      return;
    case "stop":
    case "end":
    case "unsupported":
    case "if":
      console.log(event);
      return;
  }
}

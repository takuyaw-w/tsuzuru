import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const target = "dist/src/client.d.ts";

await mkdir(dirname(target), { recursive: true });
await copyFile("src/client.d.ts", target);

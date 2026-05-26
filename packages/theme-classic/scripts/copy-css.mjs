import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve("src/style.css");
const destination = resolve("dist/style.css");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

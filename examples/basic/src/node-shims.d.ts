declare module "node:fs/promises" {
  export function readFile(path: URL, encoding: "utf8"): Promise<string>;
}

declare module "node:url" {
  export function fileURLToPath(url: URL): string;
}

declare const process: {
  exitCode?: number;
};

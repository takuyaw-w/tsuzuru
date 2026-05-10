import { cp, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const exampleRoot = dirname(fileURLToPath(import.meta.url));
const scenarioRoot = join(exampleRoot, "scenario");

export default defineConfig({
  plugins: [
    {
      name: "tsuzuru-html-basic-scenario-static",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
          if (!pathname.startsWith("/scenario/")) {
            next();
            return;
          }

          try {
            const source = await readFile(join(exampleRoot, pathname.slice(1)));
            response.setHeader("Content-Type", "text/plain; charset=utf-8");
            response.end(source);
          } catch {
            next();
          }
        });
      },
      async writeBundle(options) {
        await cp(scenarioRoot, join(options.dir ?? join(exampleRoot, "dist"), "scenario"), {
          recursive: true,
        });
      },
    },
  ],
});

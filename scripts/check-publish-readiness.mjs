#!/usr/bin/env node

import { checkPublishReadiness } from "./lib/check-publish-readiness.mjs";

const result = await checkPublishReadiness(process.cwd());

if (result.failures.length > 0) {
  console.error("Publish readiness check failed:");
  for (const failure of result.failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Publish readiness check passed for ${result.checkedPackages.length} package(s).`);
}

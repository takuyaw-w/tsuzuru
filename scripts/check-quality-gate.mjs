#!/usr/bin/env node

import { checkQualityGate } from "./lib/check-quality-gate.mjs";

const result = checkQualityGate(process.cwd());

if (result.failures.length > 0) {
  console.error("Quality gate inventory check failed:");
  for (const failure of result.failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Quality gate inventory check passed.");
}

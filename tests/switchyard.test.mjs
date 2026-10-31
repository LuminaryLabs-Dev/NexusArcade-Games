import test from 'node:test';
import assert from 'node:assert/strict';
import { runChecks } from '../games/switchyard/source/src/checks.mjs';
for (const result of runChecks()) test(result.name, () => assert.ok(result.passed, result.error));

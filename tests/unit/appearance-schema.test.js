import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { configSchema } from "../../src/chart/config.js";

test("appearance controls agree with configuration field choices and bounds", async () => {
  const markup = await readFile(new URL("../../src/editor/components/appearance-panel/appearance-panel.html", import.meta.url), "utf8");
  const field = (path) => path.split(".").reduce((entry, part) => entry?.[part], configSchema);
  const selects = [...markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)];
  for (const [, attributes, options] of selects) {
    const path = attributes.match(/data-config="([^"]+)"/)?.[1];
    if (!path) continue;
    const schema = field(path);
    assert.ok(schema && Object.hasOwn(schema, "effect"), `${path} is a schema field`);
    if (schema.choices) {
      const actual = [...options.matchAll(/<option\b[^>]*value="([^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(new Set(actual), new Set(schema.choices), `${path} presents every supported choice`);
    }
  }
  const controls = [...markup.matchAll(/<input\b([^>]*)>/g)];
  for (const [, attributes] of controls) {
    const path = attributes.match(/data-config="([^"]+)"/)?.[1];
    if (!path) continue;
    const schema = field(path);
    assert.ok(schema && Object.hasOwn(schema, "effect"), `${path} is a schema field`);
    if (!/type="number"/.test(attributes)) continue;
    const min = attributes.match(/\bmin="([^"]+)"/)?.[1];
    const max = attributes.match(/\bmax="([^"]+)"/)?.[1];
    const lower = schema.range?.[0] ?? (schema.signed ? -Infinity : 0);
    const upper = schema.range?.[1] ?? Infinity;
    if (min !== undefined) assert.ok(Number(min) <= lower, `${path} does not exclude a valid lower value`);
    if (max !== undefined) assert.ok(Number(max) >= upper, `${path} does not exclude a valid higher value`);
  }
  assert.ok(selects.length && controls.length, "appearance controls were inspected");
});

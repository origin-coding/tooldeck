import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { discoverBuiltinPlugins, stageBuiltinPlugins } from "../builtin-plugins.mjs";

test("stages the package file set for CLI and Desktop, with production filtering", async (t) => {
  const fixture = await createFixture(t);
  await createPlugin(fixture, "example");
  await createPlugin(fixture, "development-only", false);

  for (const target of ["cli", "desktop"]) {
    const outputRoot = path.join(fixture.root, target, "plugins");
    await mkdir(outputRoot, { recursive: true });
    await writeFile(path.join(outputRoot, "stale.txt"), "old output");
    const plugins = await stageBuiltinPlugins({ ...fixture, outputRoot });

    assert.deepEqual(
      plugins.map((plugin) => plugin.directoryName),
      ["example"],
    );
    assert.deepEqual(await readdir(outputRoot), ["example"]);
    const pluginRoot = path.join(outputRoot, "example");
    const metadata = JSON.parse(
      await readFile(path.join(pluginRoot, "tooldeck-package.json"), "utf8"),
    );
    assert.deepEqual(metadata.files, [
      "assets/value.txt",
      "dist/index.js",
      "locales/en.json",
      "manifest.json",
      "tooldeck-package.json",
    ]);
    assert.equal(
      await readFile(path.join(pluginRoot, "assets/value.txt"), "utf8"),
      "packaged asset",
    );
    // Authoring metadata and source files are not runtime package contents.
    await assert.rejects(readFile(path.join(pluginRoot, "package.json")), { code: "ENOENT" });
    await assert.rejects(readFile(path.join(pluginRoot, "source-only.txt")), { code: "ENOENT" });
    assert.deepEqual(await readdir(path.dirname(outputRoot)), ["plugins"]);
    assert.deepEqual(await readdir(fixture.temporaryRoot), []);
  }

  const outputRoot = path.join(fixture.root, "desktop", "plugins");
  await stageBuiltinPlugins({ ...fixture, outputRoot, mode: "development" });
  assert.deepEqual((await readdir(outputRoot)).sort(), ["development-only", "example"]);
  assert.deepEqual(await readdir(fixture.temporaryRoot), []);
});

test("discovery reads metadata without importing plugin code", async (t) => {
  const fixture = await createFixture(t);
  const pluginRoot = await createPlugin(fixture, "example");
  await writeFile(path.join(pluginRoot, "dist/index.js"), 'throw new Error("must not import");');
  assert.equal((await discoverBuiltinPlugins(fixture.pluginsRoot))[0].id, "dev.tooldeck.example");
});

for (const [file, diagnostic] of [
  ["manifest.json", /manifest\.json/],
  ["package.json", /package\.json/],
  ["dist/index.js", /index\.js/],
  ["locales/en.json", /en\.json/],
  ["assets/value.txt", /value\.txt/],
]) {
  test(`missing ${file} fails without replacing existing output or retaining temporary files`, async (t) => {
    const fixture = await createFixture(t);
    // Runtime/locale/asset failures happen after another plugin passed packaging;
    // missing metadata must fail earlier, during discovery.
    await createPlugin(fixture, "a-valid");
    const pluginRoot = await createPlugin(fixture, "z-invalid");
    await rm(path.join(pluginRoot, file));
    await assertFailedStagePreservesOutput(fixture, diagnostic);
  });
}

for (const [name, source, diagnostic] of [
  ["invalid module", "export default {", /not loadable/],
  ["invalid plugin export", "export default {};", /activate/],
  [
    "unpackaged dependency",
    'import "../source-only.js"; export default { activate() {} };',
    /source-only\.js/,
  ],
]) {
  test(`${name} is rejected using the expanded package`, async (t) => {
    const fixture = await createFixture(t);
    const pluginRoot = await createPlugin(fixture, "example");
    await writeFile(path.join(pluginRoot, "source-only.js"), "export const value = 1;");
    await writeFile(path.join(pluginRoot, "dist/index.js"), source);
    await assertFailedStagePreservesOutput(fixture, diagnostic);
  });
}

test("unsupported runtime is rejected even when staging skips the build", async (t) => {
  const fixture = await createFixture(t);
  const pluginRoot = await createPlugin(fixture, "example");
  const manifestPath = path.join(pluginRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.runtime.kind = "unsupported";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assertFailedStagePreservesOutput(fixture, /manifest|runtime/i);
});

test("invalid manifest structure is rejected by package validation", async (t) => {
  const fixture = await createFixture(t);
  const pluginRoot = await createPlugin(fixture, "example");
  const manifestPath = path.join(pluginRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  delete manifest.version;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assertFailedStagePreservesOutput(fixture, /manifest/i);
});

test("staging rejects paths overlapping the plugin sources", async (t) => {
  const fixture = await createFixture(t);
  const pluginRoot = await createPlugin(fixture, "example");
  for (const outputRoot of [fixture.root, fixture.pluginsRoot, path.join(pluginRoot, "out")]) {
    await assert.rejects(stageBuiltinPlugins({ ...fixture, outputRoot }), /must not overlap/);
  }
  assert.equal((await discoverBuiltinPlugins(fixture.pluginsRoot)).length, 1);
});

async function createFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "tooldeck-builtin-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pluginsRoot = path.join(root, "sources");
  const temporaryRoot = path.join(root, "temporary");
  await mkdir(pluginsRoot);
  await mkdir(temporaryRoot);
  return { root, pluginsRoot, temporaryRoot };
}

async function createPlugin(fixture, name, includeInProduction = true) {
  const root = path.join(fixture.pluginsRoot, name);
  for (const directory of ["dist", "locales", "assets"]) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: `@tooldeck/${name}`,
      type: "module",
      tooldeck: { builtinPlugin: { includeInProduction } },
    }),
  );
  await writeFile(
    path.join(root, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: `dev.tooldeck.${name}`,
      name,
      version: "0.1.0",
      runtime: { kind: "node", entry: "./dist/index.js" },
      defaultLocale: "en",
      locales: { en: "./locales/en.json" },
      contributes: { commands: [{ id: `${name}.run`, title: name }] },
    }),
  );
  await writeFile(
    path.join(root, "dist/index.js"),
    `
    import { readFileSync } from "node:fs";
    if (readFileSync(new URL("../assets/value.txt", import.meta.url), "utf8") !== "packaged asset") {
      throw new Error("Incorrect packaged asset");
    }
    export default { activate() { throw new Error("Staging must not activate plugins"); } };
  `,
  );
  await writeFile(path.join(root, "locales/en.json"), "{}");
  await writeFile(path.join(root, "assets/value.txt"), "packaged asset");
  await writeFile(path.join(root, "source-only.txt"), "not shipped");
  return root;
}

async function assertFailedStagePreservesOutput(fixture, diagnostic) {
  const outputRoot = path.join(fixture.root, "output", "plugins");
  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, "previous.txt"), "previous release");
  await assert.rejects(stageBuiltinPlugins({ ...fixture, outputRoot }), diagnostic);
  assert.deepEqual(await readdir(outputRoot), ["previous.txt"]);
  assert.equal(await readFile(path.join(outputRoot, "previous.txt"), "utf8"), "previous release");
  assert.deepEqual(await readdir(path.dirname(outputRoot)), ["plugins"]);
  assert.deepEqual(await readdir(fixture.temporaryRoot), []);
}

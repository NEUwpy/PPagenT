import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { loadRules } from "../src/runtime/rules-loader.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = promisify(execFile);

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-rules-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, "rules"));
  const index = {
    profiles: { generation: ["shared.md", "shared.md"], "content-director": ["content.md"], "visual-selector": ["visual.md"] },
    skins: { "test-skin": ["skin.md", "shared.md"] },
  };
  const writeIndex = () => fs.writeFile(path.join(dir, "rules/index.json"), JSON.stringify(index));
  await writeIndex();
  for (const name of ["shared", "content", "visual", "skin"]) {
    await fs.writeFile(path.join(dir, `rules/${name}.md`), `${name} 规则正文`);
  }
  return { dir, index, writeIndex };
}

test("规则按 profile/skin 读取正文、去重且下次调用读取修改", async (t) => {
  const { dir } = await fixture(t);
  const first = await loadRules(dir, { profile: "generation", skin: "test-skin" });
  assert.deepEqual(first.files.map((item) => item.path), ["shared.md", "skin.md"]);
  assert.match(first.text, /shared 规则正文/);
  assert.doesNotMatch(first.text, /visual 规则正文/);
  await fs.writeFile(path.join(dir, "rules/shared.md"), "更新后的现行规则");
  assert.match((await loadRules(dir, { profile: "generation" })).text, /更新后的现行规则/);
  assert.deepEqual((await loadRules(dir, { profile: "visual-selector" })).files.map((item) => item.path), ["visual.md"]);
});

test("未知 profile/skin、非法 ID 和正式导演附加 skin 均失败", async (t) => {
  const { dir } = await fixture(t);
  for (const options of [
    {}, { profile: "unknown" }, { profile: "../generation" },
    { profile: "generation", skin: "unknown" }, { profile: "generation", skin: "../test" },
    { profile: "visual-selector", skin: "test-skin" }, { profile: "content-director", skin: "test-skin" },
  ]) await assert.rejects(loadRules(dir, options));
});

test("缺失/空规则、非法清单路径均失败且不静默降级", async (t) => {
  const { dir, index, writeIndex } = await fixture(t);
  for (const invalid of ["../escape.md", "/absolute.md", "C:/absolute.md", "a\\b.md", "a/../b.md", "a//b.md", "./shared.md", "shared.json", "missing.md"]) {
    index.profiles.generation = [invalid];
    await writeIndex();
    await assert.rejects(loadRules(dir, { profile: "generation" }));
  }
  index.profiles.generation = ["shared.md"];
  await writeIndex();
  await fs.writeFile(path.join(dir, "rules/shared.md"), " \n\t");
  await assert.rejects(loadRules(dir, { profile: "generation" }), /正文为空/);
  index.profiles.extra = ["shared.md"];
  await writeIndex();
  await assert.rejects(loadRules(dir, { profile: "generation" }), /三个正式/);
});

test("目录链接也不能让规则路径逃出 rules 根", async (t) => {
  const { dir, index, writeIndex } = await fixture(t);
  await fs.mkdir(path.join(dir, "outside"));
  await fs.writeFile(path.join(dir, "outside/secret.md"), "不应读取");
  await fs.symlink(path.join(dir, "outside"), path.join(dir, "rules/linked"), "junction");
  index.profiles.generation = ["linked/secret.md"];
  await writeIndex();
  await assert.rejects(loadRules(dir, { profile: "generation" }), /越界/);
});

test("Skin bundle 真正读取已有 asset.fonts 并随配置变化，不创建第二真源", async (t) => {
  const { dir, index, writeIndex } = await fixture(t);
  const assetDir = path.join(dir, "assets/主题/测试");
  await fs.mkdir(assetDir, { recursive: true });
  const assetPath = path.join(assetDir, "asset.json");
  const asset = { id: "test-skin", kind: "skin", fonts: { display: "测试标题字体", body: "测试正文字体" } };
  await fs.writeFile(assetPath, JSON.stringify(asset));
  await fs.writeFile(path.join(dir, "rules/skin.md"), "<!-- asset-fonts: assets/主题/测试/asset.json -->\nSkin 规则");
  const first = await loadRules(dir, { profile: "generation", skin: "test-skin" });
  assert.equal(first.configurationSources.length, 1);
  assert.match(first.text, /测试标题字体/);
  asset.fonts.display = "新字体";
  await fs.writeFile(assetPath, JSON.stringify(asset));
  assert.match((await loadRules(dir, { profile: "generation", skin: "test-skin" })).text, /新字体/);
  index.profiles["visual-selector"] = ["skin.md"];
  await writeIndex();
  await assert.rejects(loadRules(dir, { profile: "visual-selector" }), /当前规则范围/);
  asset.id = "other-skin";
  await fs.writeFile(assetPath, JSON.stringify(asset));
  await assert.rejects(loadRules(dir, { profile: "generation", skin: "test-skin" }), /字体配置无效/);
});

test("CLI 输出实际规则正文及 Skin 字体配置，错误参数非零退出", async () => {
  const result = await run(process.execPath, ["src/tools/load-rules.mjs", "--profile", "generation", "--skin", "neutral-editorial-001"], { cwd: root });
  const loaded = await loadRules(root, { profile: "generation", skin: "neutral-editorial-001" });
  for (const file of loaded.files) assert.ok(result.stdout.includes(file.body.trim()));
  const asset = JSON.parse(await fs.readFile(path.join(root, "assets/主题/中性编辑排版-001/asset.json"), "utf8"));
  assert.ok(loaded.configurationSources.length > 0);
  for (const font of Object.values(asset.fonts)) assert.ok(result.stdout.includes(font));
  await assert.rejects(run(process.execPath, ["src/tools/load-rules.mjs", "--profile", "visual-selector", "--skin", "neutral-editorial-001"], { cwd: root }));
  await assert.rejects(run(process.execPath, ["src/tools/load-rules.mjs", "--profile", "generation", "--profile", "generation"], { cwd: root }));
});

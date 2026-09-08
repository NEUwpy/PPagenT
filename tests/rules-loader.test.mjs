import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { loadRules } from "../src/runtime/rules-loader.mjs";
import { northeasternUniversitySkin } from "../src/runtime/skins/northeastern-university-contract.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = promisify(execFile);

test("大学与中性 Skin 分别加载绑定排版，大学配置来自运行时契约", async () => {
  const university = await loadRules(root, { profile: "generation", skin: northeasternUniversitySkin.id });
  const neutral = await loadRules(root, { profile: "generation", skin: "neutral-editorial-001" });
  assert.equal(university.layout, "mckinsey");
  assert.equal(neutral.layout, "magazine");
  assert.ok(university.files.some((file) => file.path === "排版体系/麦肯锡式.md"));
  assert.ok(!university.files.some((file) => file.path === "排版体系/杂志风.md"));
  assert.ok(!neutral.files.some((file) => file.path === "排版体系/麦肯锡式.md"));
  assert.equal(university.configurationSources[0].value.fonts.display, northeasternUniversitySkin.typographyRoles.displayTypeface);
  assert.deepEqual(university.configurationSources[0].value.theme, northeasternUniversitySkin.componentTheme);
  for (const field of ["风格", "页面", "分析表达", "解释", "编排", "视觉层级"]) assert.ok(university.text.includes(`${field}:`));
  const cli = await run(process.execPath, ["src/tools/load-rules.mjs", "--profile", "generation", "--skin", northeasternUniversitySkin.id], { cwd: root });
  assert.ok(cli.stdout.includes(university.text));
});

test("运行时 Skin 引用不能跨 Skin 或泄漏到选择器", async (t) => {
  const { dir } = await fixture(t);
  const marker = "<!-- runtime-skin: northeastern-university-001 -->";
  await fs.writeFile(path.join(dir, "rules/skin.md"), marker);
  await assert.rejects(loadRules(dir, { profile: "generation", skin: "test-skin" }), /当前规则范围/);
  await fs.writeFile(path.join(dir, "rules/visual.md"), marker);
  await assert.rejects(loadRules(dir, { profile: "visual-selector" }), /当前规则范围/);
});

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-rules-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, "rules"));
  const index = {
    profiles: { generation: ["shared.md", "shared.md"], "content-director": ["content.md"], "visual-selector": ["visual.md"] },
    skins: { "test-skin": { rules: ["skin.md", "shared.md"], layout: "magazine" } },
    layouts: { magazine: ["layout.md", "shared.md"] },
  };
  const writeIndex = () => fs.writeFile(path.join(dir, "rules/index.json"), JSON.stringify(index));
  await writeIndex();
  for (const name of ["shared", "content", "visual", "skin", "layout"]) {
    await fs.writeFile(path.join(dir, `rules/${name}.md`), `${name} 规则正文`);
  }
  return { dir, index, writeIndex };
}

test("规则按 profile/skin 读取正文、去重且下次调用读取修改", async (t) => {
  const { dir } = await fixture(t);
  const first = await loadRules(dir, { profile: "generation", skin: "test-skin" });
  assert.deepEqual(first.files.map((item) => item.path), ["shared.md", "skin.md", "layout.md"]);
  assert.equal(first.layout, "magazine");
  assert.match(first.text, /shared 规则正文/);
  assert.doesNotMatch(first.text, /visual 规则正文/);
  await fs.writeFile(path.join(dir, "rules/shared.md"), "更新后的现行规则");
  assert.match((await loadRules(dir, { profile: "generation" })).text, /更新后的现行规则/);
  assert.deepEqual((await loadRules(dir, { profile: "visual-selector" })).files.map((item) => item.path), ["visual.md"]);
  assert.deepEqual((await loadRules(dir, { profile: "content-director" })).files.map((item) => item.path), ["content.md"]);
  assert.deepEqual((await loadRules(dir, { profile: "generation" })).files.map((item) => item.path), ["shared.md"]);
  await fs.writeFile(path.join(dir, "rules/layout.md"), "更新后的排版体系");
  assert.match((await loadRules(dir, { profile: "generation", skin: "test-skin" })).text, /更新后的排版体系/);
});

test("未知 profile/skin、非法 ID 和正式导演附加 skin 均失败", async (t) => {
  const { dir } = await fixture(t);
  for (const options of [
    {}, { profile: "unknown" }, { profile: "../generation" },
    { profile: "generation", skin: "unknown" }, { profile: "generation", skin: "../test" },
    { profile: "generation", skin: "test-skin", layout: "magazine" },
    { profile: "visual-selector", skin: "test-skin" }, { profile: "content-director", skin: "test-skin" },
  ]) await assert.rejects(loadRules(dir, options));
});

test("多个 Skin 共享一个排版体系，且只能通过 Skin 选择", async (t) => {
  const { dir, index, writeIndex } = await fixture(t);
  index.skins["other-skin"] = { rules: ["other.md"], layout: "magazine" };
  await fs.writeFile(path.join(dir, "rules/other.md"), "另一颜色体系");
  await writeIndex();
  const original = await loadRules(dir, { profile: "generation", skin: "test-skin" });
  const other = await loadRules(dir, { profile: "generation", skin: "other-skin" });
  assert.equal(other.layout, original.layout);
  assert.equal(other.files.find((file) => file.path === "layout.md").body, original.files.find((file) => file.path === "layout.md").body);
  assert.doesNotMatch(other.text, /skin 规则正文/);
  assert.match(other.text, /另一颜色体系/);
});

test("排版体系缺失、非法绑定、空文件或越界均显式失败", async (t) => {
  const { dir, index, writeIndex } = await fixture(t);
  for (const binding of [undefined, "unknown", ["magazine"], "../magazine"]) {
    index.skins["test-skin"].layout = binding;
    await writeIndex();
    await assert.rejects(loadRules(dir, { profile: "generation", skin: "test-skin" }), /排版体系/);
  }
  index.skins["test-skin"].layout = "magazine";
  for (const invalid of [[], ["missing.md"], ["../outside.md"], ["layout.json"]]) {
    index.layouts.magazine = invalid;
    await writeIndex();
    await assert.rejects(loadRules(dir, { profile: "generation", skin: "test-skin" }));
  }
  index.layouts.magazine = ["layout.md"];
  await fs.writeFile(path.join(dir, "rules/layout.md"), " \n");
  await writeIndex();
  await assert.rejects(loadRules(dir, { profile: "generation", skin: "test-skin" }), /正文为空/);
  delete index.layouts;
  await writeIndex();
  await assert.rejects(loadRules(dir, { profile: "generation", skin: "test-skin" }), /layouts/);
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
  assert.equal(loaded.layout, "magazine");
  assert.ok(loaded.files.some((file) => file.path === "排版体系/杂志风.md"));
  for (const font of Object.values(asset.fonts)) assert.ok(result.stdout.includes(font));
  await assert.rejects(run(process.execPath, ["src/tools/load-rules.mjs", "--profile", "visual-selector", "--skin", "neutral-editorial-001"], { cwd: root }));
  await assert.rejects(run(process.execPath, ["src/tools/load-rules.mjs", "--profile", "generation", "--profile", "generation"], { cwd: root }));
  await assert.rejects(run(process.execPath, ["src/tools/load-rules.mjs", "--profile", "generation", "--skin", "neutral-editorial-001", "--layout", "magazine"], { cwd: root }));
});

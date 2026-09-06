import { loadRules } from "../runtime/rules-loader.mjs";

try {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!["--root", "--profile", "--skin"].includes(key) || !value || value.startsWith("--")
      || Object.hasOwn(options, key.slice(2))) throw new Error(`非法或重复参数: ${key}`);
    options[key.slice(2)] = value;
  }
  const bundle = await loadRules(options.root ?? process.cwd(), options);
  process.stdout.write(`# 已加载规则：${bundle.profile}${bundle.skin ? ` / ${bundle.skin} / ${bundle.layout}` : ""}\n\n`);
  process.stdout.write(`${bundle.files.map((file) => `- rules/${file.path}`).join("\n")}\n\n${bundle.text}\n`);
} catch (error) {
  process.stderr.write(`rules:load 失败：${error.message}\n`);
  process.exitCode = 1;
}

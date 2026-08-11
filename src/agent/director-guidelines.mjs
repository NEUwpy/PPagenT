import fs from "node:fs/promises";
import path from "node:path";

export async function loadDirectorGuidelines(root) {
  const read = (name) => fs.readFile(path.join(root, "docs", "工作流", "正式生成", name), "utf8");
  const [content, visual] = await Promise.all([
    read("内容导演提示词.md"),
    read("视觉导演提示词.md"),
  ]);
  if (!content.trim() || !visual.trim()) throw new Error("内容导演或视觉导演提示词为空");
  return { content, visual };
}

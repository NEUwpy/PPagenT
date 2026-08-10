import fs from "node:fs/promises";
import path from "node:path";

export async function loadDirectorGuidelines(root) {
  const read = (name) => fs.readFile(path.join(root, "docs", name), "utf8");
  const [content, visual] = await Promise.all([
    read("内容导演执行准则.md"),
    read("视觉导演执行准则.md"),
  ]);
  if (!content.trim() || !visual.trim()) throw new Error("内容导演或视觉导演执行准则为空");
  return { content, visual };
}

import fs from "node:fs";
import path from "node:path";

export const NORTHEASTERN_UNIVERSITY_TEMPLATE_NAME = "PPT模板-封面正文尾页.pptx";
export const NORTHEASTERN_UNIVERSITY_BUNDLED_TEMPLATE = path.join(
  "assets",
  "主题",
  "东北大学-001",
  "runtime-template.pptx",
);

export function northeasternUniversityTemplateCandidates(root = process.cwd()) {
  return [
    {
      kind: "local-source",
      path: path.join(path.resolve(root), "PPT源", NORTHEASTERN_UNIVERSITY_TEMPLATE_NAME),
    },
    {
      kind: "bundled-runtime",
      path: path.join(path.resolve(root), NORTHEASTERN_UNIVERSITY_BUNDLED_TEMPLATE),
    },
  ];
}

export function resolveNortheasternUniversityTemplate(root = process.cwd()) {
  const resolved = northeasternUniversityTemplateCandidates(root).find((candidate) => fs.existsSync(candidate.path));
  if (resolved) return resolved;

  const error = new Error(
    `缺少东北大学 Skin 运行模板；应存在 ${NORTHEASTERN_UNIVERSITY_BUNDLED_TEMPLATE}，`
      + `或本地 PPT源/${NORTHEASTERN_UNIVERSITY_TEMPLATE_NAME}`,
  );
  error.code = "SKIN_RUNTIME_TEMPLATE_MISSING";
  error.candidates = northeasternUniversityTemplateCandidates(root).map((candidate) => candidate.path);
  throw error;
}

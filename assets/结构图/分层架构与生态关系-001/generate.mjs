import { buildLayeredArchitectureAdaptive, runGenerator } from "../../../src/asset-runtime/component-builders.mjs";
import { mapping, renderPayload } from "../../../src/render/payload-helpers.mjs";
export { buildLayeredArchitectureAdaptive };

export function mapPageContent(content, intent) {
  const sourceCount = intent.structure.dimensions?.sourceCount;
  const applicationCount = intent.structure.dimensions?.applicationCount;
  if (!Number.isInteger(sourceCount) || !Number.isInteger(applicationCount)) {
    throw new Error(`${content.pageId} 的分层架构需要 sourceCount 和 applicationCount`);
  }
  const sources = content.items.slice(0, sourceCount);
  const platform = content.items[sourceCount];
  const apps = content.items.slice(sourceCount + 1);
  return renderPayload(intent, "layered-architecture-001", {
    title: content.title,
    sources: sources.map((item) => item.title || item.body),
    platform: platform.title || platform.body,
    apps: apps.map((item) => item.title || item.body),
  }, [
    ...sources.map((item, index) => mapping(item.id, `sources[${index}]`)),
    mapping(platform.id, "platform"),
    ...apps.map((item, index) => mapping(item.id, `apps[${index}]`)),
  ]);
}

await runGenerator(import.meta.url, buildLayeredArchitectureAdaptive, {
  title: "分层架构与生态关系",
  sources: ["来源一", "来源二", "来源三", "来源四", "来源五", "来源六"],
  platform: "核心平台 / 中间层",
  apps: ["应用一", "应用二", "应用三", "应用四"]
});

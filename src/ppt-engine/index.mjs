// ⚠️ 许可受限依赖的唯一收口。
//
// 整个项目只在本文件静态 import "@oai/artifact-tool"，其余调用方一律 import 本文件。
// 该引擎是 OpenAI 的专有包（PROPRIETARY AND CONFIDENTIAL，仅限内部评估与测试，
// 禁止 production / commercial / benchmarking，可随时撤销），且不在仓库、不在 npm——
// 它经目录联接取自 Codex 运行时缓存。完整事实见 harness/外部依赖.md 的「PPT 引擎的许可限制」。
// 将来替换引擎只改这一层，不必再动 component-builders / template-utils /
// northeastern-university / html-component-runtime 等交付链路。
//
// 本层边界（写死在这里，防止它长成第二个 workflow.mjs）：
//   只做转出与探测，不实现任何构建、排版、测量或审计逻辑。
//   要加行为，加到调用方或加进替换实现，不要加进这里。

// 静态转出：引擎缺失时 import 本文件会失败，这是刻意的（与替换前行为一致，迁移是纯说明符替换）。
// 需要"动手前先问引擎在不在"的调用方，用 probe.mjs 的 probePptEngine()——它不静态依赖引擎。
export { Presentation, PresentationFile, FileBlob } from "@oai/artifact-tool";
export { PPT_ENGINE_PACKAGE, PPT_ENGINE_LICENSE, probePptEngine, mustProbePptEngine, classifyEngineSource } from "./probe.mjs";

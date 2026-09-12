// 全项目唯一的可读性下限。此前这个 12 分散在六处，而且同一套代码里还并存着 15 与 16
// 两把尺子（资产质量审计传 15、渲染审计缺省 16），据此把 32 个合规结构误判成违规。
//
// 12pt 的依据：东北大学 Skin 的 componentMeta（src/runtime/skins/northeastern-university-theme.mjs）
// 与 src/visual-runtime/html-component-theme.mjs 的 defaultComponentTypography.componentMeta
// 都是 12；正式交付门禁 src/agent/neu-renderer.mjs 也一直按 12 判定。
//
// 改了这里就等于改了全项目的下限：结构契约校验、渲染后字号审计、槽位容量推导会同时跟着变。
export const MINIMUM_READABLE_FONT_SIZE_PT = 12;

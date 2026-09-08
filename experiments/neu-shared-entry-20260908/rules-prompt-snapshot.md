# 规则与入口读取记录

本次制作不是冷启动。实际读取并执行的入口命令：

```powershell
npm run rules:load -- --profile generation --skin northeastern-university-001
```

读取文件：

- `docs/工作流/正式生成/生成任务提示词.md`
- `docs/工作流/正式生成/大学结构调用.md`
- `rules/skins/东北大学.md`
- `rules/排版体系/麦肯锡式.md`
- `.codex/skills/ppagent-structure/SKILL.md`
- `C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.826.12353/skills/presentations/SKILL.md`
- `C:/Users/ilove/.agents/skills/coworker/SKILL.md`

入口约束记录：先 `createNortheasternUniversityStarter`，再在 `1170 × 492` 正文安全区内调用 `invokeUniversityStructure`；结构使用 `preserved-design`，结构外文字按 Skin 与麦肯锡式排版组织；结构调用成功不等于整页通过。

本反馈轮父任务指出并要求修正：单字尾行与标点落行首、观点准确性、三页重复右栏、漏斗入口缺少对应标签、页外颜色/字体/字号硬编码、缺少原稿与规则快照、缺少实际字号/字体和几何审查。

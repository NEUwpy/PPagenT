# Harness 绑定约定

项目相对路径是可迁移来源，不引用个人 Codex 缓存作为生产依赖。

1. Host 启动时读取 `skills/registry.json` 的 id、description 与 stage，提供轻量发现信息。
2. 任务选中技能后，调用 `getSkillBinding(id, projectRoot)` 或 `node skills/library.mjs bind <id>`，加载其 instruction 与 integrationInstruction。按需读引用资源，不把整库塞入上下文。
3. Host 提供读取项目文件、执行进程、查看渲染结果的工具。默认工作目录为项目根。技能有 runtime.cli 时，使用 runtime.executable 和项目相对 runtime.cli 组成 argv 数组；没有 CLI 的模板技能（如 Lieflat Charts）通过读取模板并在任务构建器中适配，不能凭空拼出执行命令。进程退出码及产物作为工具结果返回。上游示例中的 bin/archify.mjs 相对 skillDirectory，不要与项目根路径混用。
4. 部署时用 `verify` 核验外部技能固定文件哈希，保留来源与许可证。运行产物放到任务输出目录，不写 vendor。
5. 保存技能 id、revision、输入、命令、退出码、修正轮次、最终产物及渲染证据。

当前已提供宿主无关的技能描述加载器，没有声称正式 Harness 已注册或自动调用。Codex 外部技能入口为 ppagent-diagrams 和 ppagent-charts，均位于 `.codex/skills/`，只是同一份库的路由适配，避免维护两个上游副本。Host 按 capability 判断关系图或数据图表，并读取 license/stage；相同 selectionPriority 不代表技能必须串行执行。

现有 ppagent-structure 的文件仍在原目录，通过 registry 引用。它依赖项目资产、运行器、Skin 和 Native PPT 工具，不是可单独复制一个 SKILL.md 就运行的纯提示词。

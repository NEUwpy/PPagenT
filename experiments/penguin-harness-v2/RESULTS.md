# Penguin / Harness Anything 路线实验结论

## 结论

PPagenT 应借鉴 Harness Anything 的不是 WPS COM 或某套固定 PPT 模板，而是它把复杂软件能力变成“Agent 可持续操作的项目状态与命令”。PPagenT 的资产基础更强，但此前交给模型的是一次性长表单；模型只能填表，不能像使用工具一样逐页观察、修改和验证。

当前最合适的形态是：**一个逻辑上的 PPT Agent，两个隔离上下文的阶段，一份持久化 Deck Project**。内容阶段先完成叙事与分页；视觉阶段读取已经冻结的页面语义，调用 Layout、Text、Media、Structure Skill；Native Builder 负责确定性编译和检查。

## 保留的四层资产

- Skin：字体、颜色、Logo、封面、目录、正文骨架与结束页。
- Layout：整页构图与区域关系，是 Text、Media、Structure 的上层组织者。
- Text / Media / Structure：进入 Layout 区域的可复用能力；Structure 不是整页的唯一形态。
- Native Builder：把最终决定编译为原生可编辑 PPTX，不承担内容理解与审美决策。

## 两轮实验说明了什么

### 旧的单 Agent 实验

- 完整稿得到 15 页，基础字号与几何 QA 通过。
- 12 张正文页中 Structure 实际使用为 0，5 页触发确定性正文兜底。
- 页面主要在少量正文 Composition 间轮换，仍有不自然换行与文章段落上屏。
- 视觉阶段只得到标题、节点数量和候选 ID，没有得到页内实际文字，无法可靠判断和绑定。

### Deck Project 增量实验

- 三段短稿生成 6 页（封面、目录、3 张正文、结束页），完整闭环用时约 332 秒。
- 内容 Agent 正确执行：初始化项目 → 一次写入 3 页 → 查看状态 → 校验。
- 视觉阶段使用全新的上下文，从持久化项目读取 3 页正文，逐页保存方案并完成一次合法修正。
- 第一轮页面内容明显更简洁，壳完整，QA 通过；Structure 使用仍为 0。
- “生成方式”已被正确识别为 5 步顺序，但现有顺序资产要求节点标题不超过 8 字；4 个标题为 9–12 字，候选在视觉选择前被程序过滤，只能退为 5 张文本卡片。
- 第二次同稿运行中，内容 Agent 把第一页正确归为四项并列；视觉 Agent 查看候选与真实预览后，从两个合法 Structure 中选择 `parallel-equal-cards-001`。最终 3 张正文页中 1 张使用核心 Structure，2 张使用合法文本兜底，证明 Agent 化接口已经能够调用现有结构库，而不是只能生成卡片。
- 尝试把 Penguin 模型配置的单轮 `max_tokens` 从 16K 收紧到 4K，但 DeepSeek 返回的推理/输出计数仍有单轮超过 4K 的情况，整轮耗时也没有降低。当前不能宣称 Token 问题已解决；需要继续检查 Penguin 的 OpenAI 兼容参数到 DeepSeek 推理参数的映射，或改用能明确约束思考预算的调用方式。
- 视觉阶段在第二次合法修正后触及 8 轮上限，外围工作流仍完成 PPTX；实验配置已把上限调为 10，避免仅差最终确认消息就被截断。

## 真正的架构缺口：PageBrief 与 PageView 没有分开

当前 `PageContent` 同时承担两件互相冲突的事：保存完整论证，以及直接充当结构图槽位文字。完整论证通常比结构图可见文字长，于是资产要么在候选阶段被删掉，要么运行时溢出。

下一版需要明确两层：

1. `PageBrief`：内容阶段产物，保存本页判断、完整语义、来源和信息层级，不受某个结构图字数限制。
2. `PageView`：视觉阶段在选定 Layout / Skill 后生成的展示视图，把来源内容绑定到页面区域，并在不改变事实的前提下形成短标签、短正文或分点；每个改写都保留 `sourceItemId` 与来源片段。

例如 `确定性代码：生成文件` 可以在顺序节点显示为 `确定性生成`，完整解释仍在 `PageBrief` 中。这个动作属于视觉适配，不是删稿，也不是为了模板反向篡改内容。

## 选定的 Agent 运行方式

```text
稿件 + Skin
   ↓
内容阶段：稿件地图 → 增量 PageBrief → 内容校验
   ↓  持久化 Deck Project（不是聊天历史）
视觉阶段：整套节奏 → Layout 区域 → 调用 Text / Media / Structure Skill
   ↓
PageView：来源内容到区域/槽位的可追溯展示适配
   ↓
Native Builder → PPTX → 渲染检查 → 精确修一页
```

内容导演和视觉导演可以保留为同一 Agent 的两个角色 Skill，不必物理拆成三个不断传话的 Agent。两个阶段使用独立上下文，避免完整稿件、工具结果和推理历史在每轮请求中反复累积。

## 下一步最小实现

不要再继续改 Prompt 或增加更多 Agent。下一步只实现一个纵向切片：

1. 在 Deck Project 中加入 `PageView` 与区域绑定；
2. 让视觉 Agent 能查看一个近似匹配的 Structure Skill 及其字数契约；
3. 允许它为该 Skill 提交可追溯的短标签/短正文，而不是修改 `PageBrief`；
4. 先用“5 步生成方式”验证顺序 Skill 能否从当前文本卡片升级为真正结构图；
5. 再验证中心辐射页，确认同一机制可复用；
6. 两页都通过后，才值得把该 Harness 方案接入正式入口。

## 参考

- Harness Anything：<https://github.com/yb2460/harness-anything>
- CLI-Anything：<https://github.com/HKUDS/CLI-Anything>

当前实验仍位于旁路分支，不应因“能跑”直接替换正式生成线。

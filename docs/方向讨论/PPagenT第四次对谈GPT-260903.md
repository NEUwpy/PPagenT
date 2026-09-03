# PPagenT 第四次对谈 GPT（2026-09-03）

> 来源：ChatGPT 分享对话《研究Agent方案》  
> 对话 ID：`6a9971a5-6fb8-83e9-853f-9839824e4d5c`  
> 原始链接：<https://chatgpt.com/share/6a9971a5-6fb8-83e9-853f-9839824e4d5c?ogimg=plain>  
> 整理日期：2026-09-03  
> 编排方式：按网页显示顺序完整保留用户与助手的对话正文；删除网页导航、按钮、思考时长、重复展开文本及孤立的来源角标，未改写核心观点。

## 用户

NEUwpy/PPagenT 这个项目是我弄的，你可以看一下项目介绍。现在出现了问题：原先这种单架构图、单结构图的形式，暂时还能将将巴地套上。但是呢，不是所有 PPT 都能套上那种现成的结构的，哪怕给它扩展了这个一个结构有很多能可选项的时候，能让它变成那种可变的拓扑结构，那也不太好是。就是经常出现的状况是，一个稿子它可能只只是有很简单的那种并列结构，那其实这样的话就一点意义都没有了。弄了30多个结构逻辑和结构，结果这个结构其实用不上。还有一个吧，我之前想的其实挺简单的。然后呢后来我想的是，相当于分为三种：结构、文字和图片。这个目前还没做好。

但其实我有一个疑问：我现在是调用这种 API。原先是想用 AI 的能力，让它弥补需要灵活机动的这一部分；但现在想想，它其实也没怎么弥补这一部分，只是把稿子变成了结构化的东西。

而且当前总失败，是因为结构化的东西不一定严格合规，所以也总失败。现在可能的方法就是反复调用、来回兜底，但这也不是长久之计。

我原先理解的是，让它像 Agent 一样来编排，像 Codex、Hermes 一样。但如果用那个，它也不能作为产品。这就让我有点陷入两难的境地。

我现在也知道有那种可以作为产品的 Agent，比如有个企鹅，Pangolin，是 Harness 还是啥来着？那个好像可以，但我具体也没调研。现在你帮我研究研究，帮我想想吧。

## 助手

我把你现在的仓库、你最新的“2+3 表达模型”、正式生成线，以及你说的 PenguinHarness 都看了一遍。我的判断是：

**PPagenT 不需要推翻重做，但现在确实到了一个应该换“控制方式”的节点。**

你前面做的“Structure Group 越扩越多”这条路，本质上已经接近收益递减。你现在真正缺的不是第 31、32、50 个结构，而是：

> 让 AI 不只是“填一张结构化表”，而是在一个受控的 PPT 环境里，能够尝试、执行、检查、修正。

这才是 Codex 类 Agent 真正比普通 API 调用强的地方。

### 一、你现在遇到的问题，其实非常典型

你仓库当前正式路线是：

```text
原稿 → 内容导演 → PageContent/Logic → 候选结构 → 视觉导演一次选择 → 程序渲染
```

而你下一版已经设计成：

```text
Structure / Text / Media + ExpressionRegion + 最多两层 Structure
```

这已经比之前好很多了。

但还有一个根本问题没有变：

**AI 仍然是在“一次调用里，把最终答案填出来”。**

比如让视觉导演一次性给你：

- 哪块内容是什么表达
- 用哪个 Structure
- 用什么 Text Layout
- 哪张图片放哪
- 谁嵌谁
- 哪个 Composition
- 哪个 Region

然后输出一个严格的 PageExpressionPlan。

这就导致两个失败源。

第一种是你已经发现的：

**Schema 失败。**

字段漏了、ID 错了、枚举写歪了、引用不存在、层级不合规。

第二种其实更严重：

**Schema 完全合法，但视觉决策是错的。**

Structured Output 只能解决“JSON 是不是合法”，并不能保证“这个结构是不是应该放这里”。即使采用 constrained decoding，也只是结构层面的保证。OpenAI 自己对 Structured Outputs 的定义也明确是通过约束解码保证 Schema 合规，而不是保证语义决策一定正确。

所以你现在靠：

```text
第一次 → 校验失败 → 第二次修复 → fallback → 再兜底
```

确实不适合作为长期架构。

### 二、我认为你之前对“AI 能做什么”的理解，需要稍微改一下

你原来可能想的是：

> 人工把结构做出来 → AI 从里面选 → AI 带来灵活性。

实际上 AI 在这个架构里面没有多少“灵活性”。

它更像一个：

> 高级分类器 + 字段填写器。

于是就变成：

> 我有 30 个 Structure Group → AI 帮我挑一个。

那当然会遇到今天的问题。

因为现实 PPT 根本不是：

> 每页都存在某一个明确的“逻辑结构图”。

很多页面就是：

- 一句核心观点 + 3 段解释。
- 左边一段话 + 右边一张图。
- 一个大数字 + 两个支撑事实。
- 三点并列，但根本没必要画三个卡片。

这种时候你强行问：

> “这是哪一种 Logic？套哪个 Structure Group？”

这个问题本身就问错了。

### 三、所以我现在反而非常认可你说的“结构、文字、图片”

但是我要把它再修正一下。

你真正应该变成的不是“3 类”。

而是：

**3 + 1**

三个内容表达：

```text
Text / Media / Structure
```

外加一个完全独立的：

```text
Composition
```

也就是：

> 内容是什么，和内容怎么占空间，是两件事。

你现在仓库里已经有 Composition 的概念，但我认为它的地位还不够高。

以后应该变成：

```text
Content
   ↓
Text / Media / Structure
   ↓
Composition
   ↓
Geometry
   ↓
HTML
   ↓
Native PPT
```

### 四、Structure 以后应该“降级”

这个非常重要。

现在：

```text
并列 → Structure
递进 → Structure
时间 → Structure
对比 → Structure
层级 → Structure
```

以后我建议改成：

**只有“拓扑本身承载语义”的时候，才使用 Structure。**

比如：

- 时间轴
- 环形循环
- 因果链
- 组织层级
- 矩阵
- 漏斗
- 树
- 路径
- 核心—辐射
- 有明确连接关系的流程

这些是真正的 Structure。

而：

> 3 个并列观点

通常根本不应该算 Structure。

它就是：

```text
Grid
 ├─ Text
 ├─ Text
 └─ Text
```

甚至可能：

```text
Stack
 ├─ Statement
 ├─ Paragraph
 ├─ Paragraph
 └─ Paragraph
```

这样一来，你现在 30 多个结构的尴尬会突然小很多。

因为你不再要求：

> “所有 PPT 页面必须命中结构资产。”

而是：

> “少数真正需要图解的页面调用 Structure Macro，大多数页面由 Composition + Text + Media 自然组合。”

我认为这是你目前最关键的一刀。

### 五、这也意味着：你的资产库要从“成品结构库”转成“视觉语法库”

我会把 PPagenT 将来的资产分成四层。

| 层 | 举例 | 谁决定 |
| --- | --- | --- |
| Skin | NEU 字体、颜色、页眉、版心 | 程序 |
| Composition | Split / Grid / Stack / Rail / Hero / Overlay | AI + 程序 |
| Expression | Text / Media / Structure | AI |
| Primitive | box / line / text / image / icon / connector | 程序 |

Structure Group 依然保留。

但是从：

> 页面骨架

变成：

> 高级 Macro。

比如：

```text
Structure.timeline
Structure.matrix
Structure.hierarchy
Structure.cycle
Structure.radial
```

这些东西很珍贵。

但三项并列不珍贵。

它应该靠 Composition 自然解决。

### 六、而你真正应该引入 Agent 的地方，也在这里

不是让 Agent 自由写 PowerPoint。

更不是给它一个 shell：

> “自己随便做一页 PPT 吧。”

那样 PPagenT 最重要的“稳定、可编辑、组织规范”全部没了。

你应该做成：

**Domain Agent**

也就是：

> 一个只懂 PPagenT 世界的 Agent。

它能使用的工具可能只有 8 个。

例如：

```text
inspect_page(pageId)
list_expressions(pageId)
list_compositions(pageId)
use_structure(contentRef, structureId)
place_text(contentRef, region)
place_media(mediaRef, region)
render_preview(pageId)
validate_page(pageId)
finish_page(pageId)
```

AI 不需要输出：

```json
{
  "expressions": [
    "..."
  ]
}
```

它只需要：

> 调一次工具。

系统执行。

把结果告诉它。

然后它再决定下一步。

### 七、这就是你现在和 Codex 最大的差别

Codex 并不是：

> 一次输出一万个字段，然后祈祷这些字段全部正确。

它是：

```text
看当前状态
↓
采取一个动作
↓
执行
↓
得到结果
↓
发现问题
↓
继续动作
↓
验证
↓
完成
```

也就是：

```text
Observe → Act → Observe → Act
```

Agent Harness 本质上就是这个东西。

微软今年对 Harness 的定义也基本如此：Harness 负责模型调用、工具调用、状态、上下文、循环、审批以及长任务执行。

所以你感觉：

> “我现在调用 AI，好像 AI 根本没有弥补灵活性。”

这个感觉是对的。

因为你目前基本没有给它“行动空间”。

你只是给了它：

> 选择空间。

这是两种完全不同的系统。

### 八、PageExpressionPlan 以后都不一定应该由 AI 一次输出

这是我对你当前设计改动最大的一点。

你现在文档写的是：

> 视觉导演输出稀疏 PageExpressionPlan。

我建议未来变成：

> PageExpressionPlan 是 Runtime State。

不是 AI Output。

例如初始：

```text
PageExpressionPlan

page-07
├── content-01 : unresolved
├── content-02 : unresolved
└── content-03 : unresolved
```

Agent：

```text
tool:
apply_composition("split-40-60")
```

程序更新：

```text
left-region
right-region
```

Agent：

```text
tool:
place_text(content-01, left-region)
```

再：

```text
tool:
use_structure(
  contents=[content-02,content-03],
  structure="comparison"
)
```

然后：

```text
render_preview()
```

得到：

```text
warning:
right region density = 0.91
body font predicted = 15.2pt
```

Agent：

```text
replace_structure(...)
```

再 render。

这时候：

> 非法 JSON 几乎不是核心问题了。

因为每次 tool schema 都非常小。

### 九、这才是你应该要的“灵活机动”

而且还有一个非常大的好处。

你可以控制 Agent 最多：

> 3～5 步。

不是无限自主。

例如：

```text
MAX_ACTIONS_PER_PAGE = 5
MAX_RENDER = 2
MAX_REPAIR = 1
```

达到门限：

```text
fallback -> editorial composition
```

这样你仍然保留 PPagenT 的核心价值：

> 可预测。

Agent 不是无限自主。

它只是：

> **Bounded Agentic Layout Search**

我觉得这个词特别适合你的系统。

### 十、甚至不应该每一页都跑 Agent

这里很关键，否则成本和速度会失控。

建议以后搞一个三级路径。

#### Fast Path

极简单页面：

```text
标题
一句核心观点
3 个分点
```

程序直接：

```text
Grid / Stack / Split
```

甚至不用视觉 Agent。

#### Macro Path

语义非常明确：

```text
时间过程
组织层级
二维矩阵
循环关系
```

Structure Group 候选唯一。

程序直接套。

最多让视觉 Agent 决定一些展示状态。

#### Agentic Path

真正复杂页面：

```text
核心观点
+ 一张截图
+ 三项解释
+ 一个结论
```

或者：

```text
两个内容块
每个块内部又有关系
```

这时才启动：

> Agent Composer。

这样大概会变成：

```text
40%-60% Fast Path
20%-30% Structure Macro
10%-30% Agentic Composition
```

实际比例以后用运行日志统计。

你现在仓库已经在记录候选、fallback、Structure 使用频率等信息，这正好可以用来判断哪些页面值得升级 Agent。

### 十一、还有一个你现在实际上比较吃亏的地方：视觉导演“看不见”

你当前文档明确写了：

> 视觉导演是文本模型角色，不看截图。

在纯 Structure Group 模式下，这很合理。

因为结构都是经过人工验证的。

但一旦进入：

```text
Text + Media + Structure 动态组合
```

我认为这个限制以后可以考虑松开。

不是每次都视觉审查。

而是在 Agentic Path 里面：

```text
Agent 编排
↓
HTML Render
↓
截图
↓
模型看一次
↓
必要时改一次
```

这个“看”非常有价值。

因为很多问题不是：

```text
overflow = true
```

才能发现。

比如：

- 左边特别重、右边特别空
- 三个模块视觉节奏奇怪
- 图片和标题抢焦点
- 连续三页构图一样
- 一页看起来特别碎
- 一页虽然没有越界，但很丑

这些全都不是 Schema 能解决的。

### 十二、你说的 Penguin，确实是 PenguinHarness

你记忆没错，是“企鹅”。

PenguinHarness 是 2026 年 7 月发布的开源 Harness，目前提供 CLI、Web UI、Server 和 TypeScript SDK，核心包是 `@prismshadow/penguin-core`，Apache-2.0，并且重点强调多模型、低成本和 agent loop。

你刚才说的 Pangolin 是另一个东西。

Pangolin 现在主要是网络访问/身份代理以及 AI Gateway，不是你想找的那种 Agent Harness。

### 十三、而且你说“Codex 不能作为产品”这件事，现在也需要更新一下认识

现在已经不是：

> CLI Agent 只能自己开发的时候用。

2026 年已经有好几条真正的“产品化 Agent”路线。

#### Claude Agent SDK

这是最像你心目中的：

> “把 Claude Code 的能力直接嵌进自己的产品。”

Anthropic 官方明确写的是：

> Agent SDK 提供和 Claude Code 相同的工具、agent loop 和 context management，可用于 Python / TypeScript 自定义应用和生产自动化。

甚至 TypeScript SDK 会带对应的运行能力。

所以它不是：

```text
调 Claude API → 自己写 while loop。
```

而是：

> Claude Code Runtime as SDK。

这个对你非常值得做实验。

#### OpenAI Responses API

OpenAI 现在其实也已经往这个方向去了。

Responses API + shell + container + skills + compaction，本质也是：

```text
模型 → 行动 → 工具执行 → 结果 → 继续行动。
```

OpenAI 官方甚至直接把这个描述为“从 model 到 agent”的路径。

所以如果以后想走 OpenAI 模型，也不存在“只有 Codex CLI，没有产品接口”的死局。

#### Microsoft Agent Framework Harness

今年已经发布正式 Harness。

它比较大的优势是：

> 模型无关。

可以在一个 Harness 中接不同 ChatClient，而且把 planning、loop、memory、approval、telemetry 等都做了。

但是你的 PPagenT 当前主要是 Node/JS，我反而不会第一时间选它，因为会增加语言栈复杂度。

#### OpenHands

OpenHands 现在也有正式的 Software Agent SDK，重点是 sandbox、生命周期、工具、模型路由和可扩展执行，甚至已经把 Harness / Orchestrator / Control Plane 明确分层。

但是它的基因还是比较明显地偏：

> 软件工程 Agent。

对 PPagenT 来说可能稍重。

### 十四、所以如果让我给你排一下优先级

| 方案 | PPagenT 适合度 | 原因 |
| --- | --- | --- |
| 自己写轻量 Domain Harness | ★★★★★ | 最符合 PPagenT |
| Claude Agent SDK | ★★★★★ | TS，成熟，最接近 Claude Code |
| PenguinHarness | ★★★★☆ | TS、开源、模型灵活、适合 DeepSeek |
| OpenAI Responses Agent | ★★★★☆ | agentic 能力强，但更绑定 API |
| Microsoft Harness | ★★★☆☆ | 很成熟，但你的 JS 栈不自然 |
| OpenHands SDK | ★★★☆☆ | 强，但偏软件 Agent、较重 |

### 十五、但我不建议你现在直接“把 PPagenT 改成 Penguin 项目”

这个区别特别重要。

不要：

```text
PPagenT
↓
重构成 PenguinHarness 应用
```

而应该：

```text
                    ┌─ PenguinHarness
                    │
PPagenT Domain API ←├─ Claude Agent SDK
                    │
                    ├─ OpenAI
                    │
                    └─ 自研 Loop
```

也就是说：

> Harness 必须是可替换件。

PPagenT 最值钱的东西是：

- PageContent
- Skin
- Composition
- Structure Macro
- Text Layout
- Region
- HTML Renderer
- Native Compiler
- Quality Gate

不是 Harness。

Harness 只是操作这些能力的驾驶员。

### 十六、所以我认为你接下来不要继续做完整 2+3 了

你仓库现在计划下一步是：

```text
多表达 HTML 工作台 → Text Layout → ExpressionRegion → 区域求解 → PageExpressionPlan……
```

这个方向不用扔。

但我会稍微调整顺序。

#### 第一阶段：先停止扩 Structure

哪怕暂时只有现在这些。

不再为了资产覆盖率：

> “缺什么 Logic 就补什么 Structure。”

#### 第二阶段：只做 5～6 个 Composition Operator

例如：

```text
Stack
Split
Grid
Rail
Hero
Overlay
```

注意它们不是“版式模板”。

它们是：

> 空间运算符。

例如：

```text
Split(0.38, 0.62)
Grid(columns=3)
Stack(gap="md")
```

浏览器帮你算最终坐标。

#### 第三阶段：把 Text / Media / Structure 全部变成可以放入 Region 的对象

也就是你现在想做的 ExpressionRegion。

这一点继续。

#### 第四阶段：先不要接现在的视觉导演

直接做一个：

> PPagenT Agent Playground

只给它 6～8 个工具。

让 Claude Agent SDK 或 PenguinHarness 来操作。

挑你仓库里那三类验证页：

```text
1+3+N
截图 + 解释 + 结论
核心观点 + 多项支撑
```

你自己的文档已经准备拿它们验证 2+3，非常合适。

### 十七、我甚至建议做一个很小的 A/B

同样 20 页。

#### A：当前方案

```text
视觉导演
↓
一次 PageExpressionPlan
↓
Render
```

#### B：Agent

```text
inspect
↓
compose
↓
render
↓
validate
↓
最多 repair 一次
```

统计：

- 首次成功率
- 最终成功率
- fallback 率
- 平均调用数
- 平均 token
- 平均耗时
- 人工偏好率
- 页面重复度
- Structure 命中率

你的方向会一下子变得非常清楚。

### 十八、如果这个实验成功，我认为 PPagenT 的一句话定义甚至会发生变化

你现在 README 是：

> AI 负责理解和结构化，规则负责约束，代码负责生成。

以后我会改成类似：

> **AI 负责理解、编排与有限迭代，视觉语法负责约束，确定性引擎负责求解与生成。**

这个变化很小。

但其实代表两代架构。

原来：

```text
AI
↓
答案
↓
Renderer
```

以后：

```text
            ┌──────────────┐
            │              ↓
AI → Action → Renderer → Feedback
            ↑              │
            └──────────────┘
                   ↓
              Native PPT
```

### 十九、最后我给你一个比较明确的结论

我不建议你放弃“确定性 PPagenT”转去做一个完全自由的 PPT Agent。

那样你会变成 PPT Master、各种 Claude/Codex PPT Skill 的同一路线，而且你的“组织模板、稳定、可审计、原生可编辑”优势反而没了。

现在已经有项目直接要求 Codex、Claude Code 等 Agent 自己完成整套 PPT 设计；例如 PPT Master 就明确依赖具备文件读写、命令执行和多轮能力的 Agent 来完成内容分析、视觉设计和 PPTX 输出。

你真正有机会做出差异的路线反而是：

> 不是自由生成。

> 也不是模板填充。

> 而是“受控视觉语法上的 Agentic Composition”。

我认为这会比你现在的：

```text
30 多种 Structure Group + 两个 Director + 巨型 Schema
```

更接近你一开始想要的那个“AI 弥补灵活部分”的 PPagenT。

如果现在由我来继续推进这个项目，下一步我会直接停止 2+3 的大面积实现，先在你现有代码旁边做一个极小的 agent-composer 实验分支：

> 6 个 Composition + Text/Media/Structure 三种节点 + 7 个工具 + 最多 5 步 Agent Loop。

先拿 20 页真实稿件和当前视觉导演正面对打。这个实验一旦成立，你后面的架构基本就定了。

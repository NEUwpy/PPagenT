# 纯内容试样

三份开发样本由独立灰稿试验的 [旧输入](../../gray-compiler-20261120/inputs/) 转写。[不足与感悟](hr.json) 保留三因素共同导致一个结果，以及仅在 BLM 条目内部成立的真实先后。[两种上线方案](options.json) 保留对照与两者共同的回退演练。[汛期值班](duty.json) 保留三个职责组、全页适用期、分级处置与跨级别要求。

[办公用品采购](procurement.json) 是留出的人工检验例。三个递增金额对应各自办法，应急采购内部才有先执行、后补办的真实先后。金额边界沿用原稿的「以下／至／以上」，边界归属待稿件确认。前三页用于形成规则，第四页只检查固定规则在同一类陷阱上能否迁移，样本由同一实验者标注。

| 字段 | 约定 |
| --- | --- |
| `schemaVersion` | `page-content@1`，是可携带的单页内容，明确表达选择后才能交给现有灰稿编译器。 |
| `page.title / claim` | 页题和主旨。所有文字字段为 `{text, sourceIds}`，文字可有来源支持的改写。 |
| `page.groups[].relation` | `independent` 各自陈述，`peer` 同级列举，`comparison` 同口径比较，`cases` 按条件分别适用。数组顺序是阅读顺序。 |
| `groups[].items[]` | 上屏 `title` 与可选 `body`。`cases` 组中 `appliesAcrossCases: true` 的条目横跨各情形。阈值、或、否定、例外等按现有文案保留。 |
| `item.detail` | 条目内可选的补充内容。可有小标题，`nodes` 为有 ID 的内容节点，节点可有补充正文。`links` 引用同一 detail 的节点并绑定来源。 |
| `links[].type` | `contributes-to` 中的 `from[]` 整组因素共同指向 `to`，不声明单项充分或因素有先后。`precedes` 的一个 `from` 先于 `to`，链可以由多条局部先后组成。无链接的节点只声明同属一个条目。 |
| `page.scopeNotes / group.scopeNotes` | 上屏限定。`appliesTo` 在页级引用组，在组级引用本组条目。 |
| `page.notes` | 讲述备注，随交付传递。 |
| `sources[]` | `id`、相对于仓库根的 `file`、逐字 `quote`。引用成立由程序检查，改写和关系是否忠实要对照原文判断。 |

页面方案的内容 ID 在页内唯一。节点链接仅在所属条目内解析。结构、归属、来源、无环性和逐字引文的可执行约定见 [Schema](../content.schema.json) 与 [引用校验](../validate-content.mjs)。

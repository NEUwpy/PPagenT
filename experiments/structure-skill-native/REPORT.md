# 结构 Skill 原生执行迁移验证

本轮将独立结构入口从参数执行器改为当前构建函数。35 个核心结构由设计目录发现，不要求先加载旧 Mapper 或固化文字框。原资产代码保留作代表样例及局部造型参考。

## 已完成

- `src/runtime/assets.mjs` 与 Skill invoke 入口执行 references + content + targetFrame + build；旧 assetId + parameters 调用明确失败，不静默回退。
- 看板结构详情展示默认 HTML 样例与特征，移除 State 控件、文字槽位、容量及叠层脚本。列表不再默认触发结构 Native 预编译。
- guide 与看板同源；35 个核心结构均有可提取特征，未逐一做人工语义精炼。
- `legacy-structure-assets.mjs` 保存旧执行器，大学 Skin 的旧 API 生产线显式引用它；生产工作台标明旧版，尚未重写导演协议和候选循环。

## 验证

34 项定向测试通过：structure-skill-profile、structure-skill-execution、skill-library、dashboard-components。新增执行测试覆盖旧尺寸／数量限制不生效、样例执行文件缺失仍可检索构建、旧参数调用失败和无对象输出不能报成功。

`build.mjs` 生成折角便签 3、6、9 项内部样例，新建原生对象分别为 18、36、54 个。输出在 `.tmp/structure-skill-native/`，PPTX 重新导入后逐页渲染检查。纸面、底影、卷页、标题带和两排居中仍可辨认；9 项首次出现不良换行，调整本次文字宽度估算后重新构建、渲染。它是程序员编写构建函数的验证，不代表模型自主整稿成功或全库视觉验收。

看板通过真实本地服务检查：折角便签 HTML 样例可见，显示 5 条提取特征，无页面脚本错误。

旧 visual-variants 测试有 3 项失败（候选清单、运行时清单、循环结构选择）；替换回原执行器作对照后同样 3 项失败，未作为新入口通过项。日志位于 `.tmp/structure-native-focused.log`、`.tmp/structure-native-tests.log`、`.tmp/structure-legacy-baseline.log`。

## 尚未完成的整体转型

旧双导演 API 的候选筛选／Mapper 生产线仍独立保留；不能称整仓已消除旧调用。35 个结构尚未逐个在多种内容下验证自主适配质量。执行器 success 只说明产出原生对象，语义、可编辑性、实际文字边界与视觉验收仍由当前制作流程验证。

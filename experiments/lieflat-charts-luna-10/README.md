# Lieflat Charts 在中性 PPT 中的应用试验

2026-09-07，非商业模拟样稿。已完成：[最终可编辑 PPT](outputs/共享仪器咨询问题分布-luna10-v2.pptx)、[最终页面 PNG](parent-final-render/slide-01.png)、[程序核验](parent-audit.json)。

## 实际使用

Luna High 读取 Lieflat Charts 的 SKILL、catalog 和 gallery，在 L2 Dot Cascade、F1 Rung Bars、F5 Tick Rows 中选择 F5。来源为 `skills/vendor/lieflat-charts/templates/basics-gallery.html` 的 `C1 · tick rows`（约370行），固定上游 commit `eace082a317b696c5570c25826a53a7fa113e984`。

保留横向计数队列、每刻线一个单位、每五次点标、行尾数值和确定性高度变化。按用户中性 Skin 与 PPT 区域改字号、颜色、间距，与右侧说明共同编排。高度扰动算法经过适配，不是上游代码逐字复制；此例为模板核心的 adapted-native 重建，不是通用转换器或带工作簿的 Office chart。没有执行不存在的 Lieflat CLI。

五类数据由父 Agent 拟定：24、18、12、9、6次咨询，合计69，前两类42次，约60.87%，显示约61%。数据不是人数，也不是真实运营证据。

## 制作与验收

- Luna 编写初稿及修订脚本，父任务反馈补回每五次点标、竖直刻线、中文单位和数据来源说明。
- Luna 在修订脚本完成后触发额度限制。父任务将 builder-v3.mjs 复制为 builder-parent-final.mjs，仅删除重复的 `const report` 声明后执行，未重画版面。该过程是监督试验，不能宣称 Luna 无辅助一次通过。
- 最终 PPT 包、布局、字体校验通过，113个原生形状、0图片；实际刻线数量为24/18/12/9/6，点标4/3/2/1/1，各行起点一致且单位间距一致。
- 父任务重新导入最终 PPT 并检查 PNG，未见裁切或遮挡。未在 PowerPoint/WPS 中复核原生应用渲染。
- SHA-256：`72f76e377935414c91fdcc6b22208478309c56b1145c2bb5f17f7a8c0d6220d3`。

## 许可和接入

上游采用 PolyForm Noncommercial，许可副本见 LIEFLAT-LICENSE.txt；商业使用需另行获得许可，当前没有商业授权记录。项目接入和技能表见 [技能库说明](../../skills/README.md)。项目入口 ppagent-charts 已出现在本会话的可用技能目录；这不代表自动路由或正式 Harness 工具注册已完成。

本例显示局部图表与正文可以共同编排。下一步验证更丰富的数据类型时，仍需保留真实模板编码和数据到对象的检查，不能把本例当作全库适配成功。

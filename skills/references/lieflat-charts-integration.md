# Lieflat Charts 在 PPagenT 中的边界

按[共享选择规则](selection.md)逐区域判断。项目结构库优先；缺少合适的数据编码时，数据比较、趋势、构成、分布等转 Lieflat Charts。架构、消息与流程关系转 Archify。二者按任务类型分工，不要求先后串行调用。

用户指定 Lieflat Charts 时直接使用，并记录实际选型。先读上游 SKILL.md、catalog 与所选 gallery 中真实实现，保留模板编号、数据单位、比例关系和核心编码。不能只借名称或配色后声称调用了模板。

在 PPT 中，Skin 与绑定排版决定页面风格、字体、字号和区域。上游整页 HTML、微小网页字号、Inter 字体及动画不覆盖用户的 PPT 要求；保留图表的诚实编码，按可用区域重排。无需为了套图制造个体数据、人数、因果关系或统计成效。

上游不直接导出原生 PPTX。图示可按类型转换或忠实重建为原生形状/连接/文字，记录来源模板与数据到对象的对应，标为 adapted-native。由形状构成的图表不等于带 Excel 数据表的 Office 原生 chart；整张 SVG/PNG 也不等于可分别编辑的图表对象。HTML/SVG 可作为中间产物，最终仍需完整 PPT 与重新导入渲染验收。

本次固定版本使用 PolyForm Noncommercial License 1.0.0，上游 README 明确商业使用需另行取得许可。保留 LICENSE、THIRD_PARTY_NOTICES 及来源，不标为 MIT 或不受限开源。当前为非商业试用，项目尚未记录商业授权；正式商业 Harness 分发或客户生产使用须先确认许可范围。

安装包真源位于 skills/vendor/lieflat-charts。用户已确认非商业使用，并要求去除每次回复的开发者署名提示；已仅删除 SKILL.md 中该建议段落，保留许可证及来源，局部修改记录在完整性清单的 localModifications。其余 vendor 内容保持固定版本；升级时保留此用户偏好并重新验证。公开分发时遵循许可证及适用的第三方声明。

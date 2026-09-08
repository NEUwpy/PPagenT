# 结构统一中性转换验证

2026-09-08，用户认可本目录对应的暖米色转换效果，代码存档 `373fe19a`。当前系统说明维护在[产品定义](../../docs/产品定义.md#结构源设计与-skin-的共享方式2026-09-08)，颜色规则维护在[中性 Skin](../../rules/skins/中性编辑排版.md)，本目录只保存实验与复现方法。

## 范围与证据

- 35 个已审批结构共用同一颜色转换，三个尺寸样板不另走配色分支。
- [预览](index.html)和 [report.json](report.json)：默认、较少、较多共 105 个 HTML 状态，响应正常、结构根节点存在，未检测到指定文字容器裁切。这不是全部视觉质量的自动判定。
- [color-checks.json](color-checks.json)：汇聚线保持不同色阶，两个漏斗的相同原色得到相同结果，循环箭头与所属环段保持同色。
- 21 项定向测试覆盖主题转换与保真构建。三个样板以外的尺寸适配、全部 Luna 整页调用和最终 PPT 未由本实验验收。

## 复现

在仓库根目录启动看板；端口可替换，不依赖本次临时服务一直存在：

```powershell
node src/tools/serve-logic-dashboard.mjs --port 4207
```

另一个终端执行：

```powershell
$env:DASHBOARD_URL='http://127.0.0.1:4207'
node experiments/structure-unified-neutral/audit.mjs
node experiments/structure-unified-neutral/check-colors.mjs
node --test tests/neutral-structure-theme.test.mjs tests/structure-theme.test.mjs tests/preserved-structure-build.test.mjs
```

脚本会重新生成本目录报告与预览。修改结构源设计或转换程序后，旧图片不会自行更新；新的审美结论必须来自新渲染。`neutral-shape-role-review` 等早期目录保留局部覆盖阶段的证据，不是现行转换规范，其旧断言也不作为当前验收标准。

# 用法

调用方只需在 Skin 的 `componentTheme` 中设置：

```js
componentTheme: {
  primaryColor: "#6F42C1",
  font: "Microsoft YaHei",
  typography: { /* 既有字号令牌 */ },
}
```

`primaryColor` 是新的唯一结构主题主色。运行时自动推导 `primaryDeep / primaryDark / primary / primaryLight / primaryPale / primaryWash`、兼容的 `accent / accentAlt / accentSoft / cyan / line`，并保留白色及中性色。

显式提供 `primaryColor` 时，旧 `accentAlt / accentSoft / cyan / line` 不能独立覆盖推导色。未提供 `primaryColor` 的旧调用仍保留历史组件颜色，避免破坏兼容；当前东北大学 Skin、正式运行、PPA 与 standalone generator 都已进入新接口。

单个资产生成器可以直接改主色，或读取包含 `primaryColor` / `componentTheme.primaryColor` 的 JSON：

```powershell
node .\assets\结构图\阶段门禁流程-004\generate.mjs --output .\output\purple.pptx --primary-color "#6F42C1"
node .\assets\结构图\阶段门禁流程-004\generate.mjs --output .\output\purple.pptx --theme .\theme.json
```

批量示例生成器使用等号参数：

```powershell
node .\src\tools\build-structure-group-examples.mjs . --assets=sequence-phase-gates-004 --primary-color=#6F42C1
node .\src\tools\build-structure-group-examples.mjs . --assets=sequence-phase-gates-004 --theme=.\theme.json
```

# 实际文件读取记录

读取时间：2026-09-11（Asia/Shanghai）

## 冻结输入

- `input/prompt.md`：11,399 bytes，已完整读取。
- `input/manuscript.md`：11,482 bytes，已完整读取。
- 输入目录未写入。

## 交付文件

- `first.pptx`：62,079 bytes，SHA-256 `53279ACB5FD217B234A394606AF72D9D0729BF790CFB894860B05A048A57D6FA`。
- `final.pptx`：62,071 bytes，SHA-256 `2652921F7E86F4033DEF26E7F2FE4997D1BAF4465A2C7312DCF083725D19AE94`。
- `deliverables/final.pptx`：62,071 bytes，与根目录 `final.pptx` SHA-256 相同。

## 读取与校验

- 最终文件从磁盘重新导入 Artifact Tool，导入成功，读取到 13 页。
- 首稿结构读取记录：13 个 slide records、168 个 textbox records。
- 最终文件实际渲染生成 `renders-final/slide-01.png` 至 `slide-13.png`，共 13 张。
- Finalizer receipt：`.codex-finalizer/final-validation.json`。
- 结构校验：13 页，包完整性通过，0 findings。
- 几何校验：13 页，0 findings，画布 13.3333 × 7.5 in。
- 字体角色校验：观察到 `Noto Serif SC` 与 `Noto Sans SC`，与设计声明一致。

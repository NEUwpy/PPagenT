# 有界运行与失败记录

1. 开始于2026-11-16，完成于2026-11-17，目录／任务ID保留起始日期。所有网络依赖隔离于本目录，没有运行模型调用或读取provider配置。
2. 首次把Slidev与Marp放在同一次npm安装中，网络 `ECONNRESET` 导致失败；保留 `failed-slidev-install.log`。改为独立 `vendor/slidev` 后安装成功。对Node25的postcss-nested engine warning未阻止本页编译。
3. SeaSlides首次全链路缺jsdom；补其公开Node依赖后视觉链运行完成。系统Python缺python-pptx，改用已具备相应依赖的bundled Python后原生PPTX运行完成，没有安装完整研究环境。
4. Marp自行浏览器截图带演示导航；改用Marp官方PNG导出。当前Marp PNG不是该带导航的诊断图。
5. Marp、Yoga首先完成为纯文字对照。审查明确后，SeaSlides HTML与Slidev另消费原灰稿的implementation.kind=diagram；没有把三张文字稿伪称图示完成。
6. 两条图示插入后的首版发生底部越界。通过调整模板容量、去除多余编号空间、加宽问题区、合规短项改四列修正，未删正文。当前SeaSlides原生DOM门 blocker=0；四份PDF均无文字span越界。未为统一气质做无界返工。
7. Typst以隔离29.6MB wheel安装；实际编译Touying 0.7.4和SeaSlides navy-formal模板，输出一页PDF/PNG/SVG。未尝试完整Typst→PPTX转换。
8. 两条原生PPTX由PowerPoint COM实际打开重渲染，已逐张检查。Slidev有标点孤行／换行漂移，SeaSlides有字体映射差异，均保留原始框架输出供比较，未改转换器、未把问题写成通过。
9. 没有运行外部Agent的自动内容生成／审查循环。这里的作者就是本次宿主Agent；工具执行通过只证明本页相应步骤可运行。
10. 最终用rebuild.ps1实际重建时，SeaSlides编译与DOM门通过，但官方delivery validator对Windows反斜杠收据路径报9项错误。保留原收据和失败输出，不改上游、不改收据制造通过；对照脚本记录该门失败后继续其他独立路线。

#import "@preview/touying:0.7.4": *
#import "template.typ": *
#show: navy-formal-theme.with(
  aspect-ratio: "16-9",
  align: top,
  config-common(breakable: false),
  config-page(width: 1280pt, height: 720pt, margin: (top: 105pt, bottom: 38pt, x: 44pt)),
  config-info(title: [存在的不足与感悟], institution: none),
)
#set text(font: "Microsoft YaHei", size: 22pt, lang: "zh")
#set par(leading: .32em, spacing: 0pt)
#slide(title: [存在的不足与感悟])[
  #cols(columns: (0.94fr, 1.16fr), gutter: 30pt)[
    #text(size: 26pt, weight: "bold", fill: palette.accent-blue)[两点不足]
    #v(16pt)
#method-card(1, [变革落地阻力重重], [顶层设计已完成；公司内部人力资源变革氛围尚未完全形成，信息系统支撑能力仍有差距，缺乏市场化管理机制。])
#v(12pt)
#method-card(2, [合规管理短板亟待提升], [2017年巡视整改取得一定成效，也暴露人力条线基础管理薄弱：认识待提升、作风待转变、能力待增强、协同待深化。])
  ][
    #text(size: 26pt, weight: "bold", fill: palette.accent-blue)[四点感悟]
    #v(16pt)
#method-card(1, [统一语言，促进业务与人力协同], [沿BLM管理模型统一语言、目标、策略，贯通业务战略、人力战略规划与落地方案，达成“三个市场化”转型目标。])
#v(10pt)
#method-card(2, [解决实际问题是唯一检验标准], [以能否解决实际问题检验变革成效，力求落地有实效。])
#v(10pt)
#method-card(3, [顶层设计持续迭代], [加速试点、小步快跑；对标行业优秀实践，结合落地成效持续优化体系。])
#v(10pt)
#method-card(4, [统筹变革、合规与作风], [变革是硬道理，合规是硬要求，作风是硬标准；以规范管理的效率强化转型力度，以优良的思想、工作和战斗作风加快转型。])
  ]
]

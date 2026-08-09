import { buildGeographicNetwork, runGenerator } from "../../../src/asset-runtime/geographic-model-builders.mjs";

export { buildGeographicNetwork };

await runGenerator(import.meta.url, buildGeographicNetwork, {
  title: "全国服务网络分布",
  locations: [
    { id: "north", name: "北部中心", value: "12 城", x: 0.54, y: 0.18 },
    { id: "east", name: "东部中心", value: "18 城", x: 0.76, y: 0.48 },
    { id: "south", name: "南部中心", value: "9 城", x: 0.60, y: 0.78 },
    { id: "west", name: "西部中心", value: "7 城", x: 0.22, y: 0.50 },
    { id: "central", name: "中部枢纽", value: "15 城", x: 0.48, y: 0.50 }
  ],
  routes: [
    { from: "central", to: "north" }, { from: "central", to: "east" },
    { from: "central", to: "south" }, { from: "central", to: "west" }
  ],
  panelTitle: "覆盖能力",
  stats: [
    { label: "覆盖城市", value: "61" },
    { label: "区域中心", value: "5" },
    { label: "平均响应", value: "2h" },
    { label: "服务半径", value: "300km" }
  ]
});

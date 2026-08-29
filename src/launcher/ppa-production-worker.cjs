const { pathToFileURL } = require("node:url");

const target = process.env.PPAGENT_PRODUCTION_TARGET;
if (!target) throw new Error("缺少 PPagenT 正式生成工作台运行目标。");

import(pathToFileURL(target).href).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

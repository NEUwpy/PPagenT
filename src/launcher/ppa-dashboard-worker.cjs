const { pathToFileURL } = require("node:url");

const target = process.env.PPAGENT_DASHBOARD_TARGET;
if (!target) throw new Error("缺少 PPA 看板运行目标。");

import(pathToFileURL(target).href).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

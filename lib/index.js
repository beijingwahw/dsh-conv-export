//#region src/index.ts
/** Stable Cordis plugin name (matches the manifest id). */
const name = "@dsh-external/dsh-conv-export";
/**
* 宿主入口：空壳。全部导出行为位于浏览器 bundle（exports["./client"]）。
* @param _ctx - host root context（不使用任何服务）。
*/
function apply(_ctx) {}
//#endregion
export { apply, name };

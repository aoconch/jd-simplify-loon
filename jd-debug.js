// jd-debug.js —— 抓包诊断脚本（v1）
// 用途：只给响应加一个标记头 X-JD-Debug: 1，不读取也不改动响应体。
// 在 HAR 里搜 X-JD-Debug 就能知道哪些请求真正被 MITM 解密了（没被解密的看不到内容）。
// 诊断完请删掉诊断插件，装回正式版 jd-simplify.plugin。
try {
  var h = Object.assign({}, $response.headers || {});
  h["X-JD-Debug"] = "1";
  $done({ status: $response.status, headers: h });
} catch (e) {
  $done({});
}

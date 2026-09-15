# 京东首页与我的页精简 · Loon 插件

基于京东 App 真实抓包逆向的 Loon 插件，用于**精简京东 App 首页与「我的」页**：掐断自定义楼层（二楼 / 浏览历史 / 为你推荐）、拦截首页弹窗与引导、REJECT 全部埋点广告域名。

## v4.0 路线变更（重要）

v3.x 一直在钩原生桥 `getRecommendPageSourceCallback`，以为它是推荐流数据源。**HAR #338 证明这条路是错的**：

- 脚本**确实注入成功了**（响应体里有 `JD-SIMPLIFY-INJECTED` 与 `v3.2.1`）——注入本身没问题；
- 但 `getRecommendPageSource` 的产出是 `window.__native_container_aid__`，最终被 push 进 `__prepare_tracking__.tasks`，**只用于 PV 埋点**，跟渲染无关 → 锁它零可见效果；
- 首页 HTML 是**空壳**：可见中文只有标题「挑好物逛京东」，SSR 仅 2 个楼层（`bottom_tips` + `customcode 127750109`），真正的内容由远程 JS 包（`ifloors`）与原生 Taro 模块（`taroNative-jdhome_B028` / `RHCDN085` 等）渲染。

因此 v4.0 **放弃 DOM/桥接层手术，改走网络层硬拦截**：

1. **掐断楼层 JS 包**：首页 HTML 里的 `//storage11.360buyimg.com/ifloors/<styleId>/static/js/main.<hash>.js` 被改成 `ifloors-disabled`，CDN 返回 404 → 自定义楼层（二楼 / 浏览历史 / 为你推荐）不渲染。
   （在脚本里改 URL 而不是在 `[Rule]` 里拦，是为了**不给图片 CDN 360buyimg 开 MITM**，避免拖慢整页。）
2. **REJECT 内容接口**：`secondFloor`、`SecFloorBrowseHistory`、`queryPagePopWindow`（首页弹窗）、`babelGetGuideTips`（引导气泡）、`appPublishUpgrade`（升级提示）。
3. **REJECT 埋点广告域名（16 条，主机级，无需 MITM）**：`mars.jd.com`、`sh.jd.com`、`mllog.jd.com`、`uranus.jd.com`、`cactus.jd.com`、`dsap.jd.com`、`jra.jd.com`、`ex.m.jd.com`、`h5speed.m.jd.com`、`im-x.jd.com`、`blackhole.m.jd.com`、`perf.m.jd.com`、`anti-sdk-report.m.jd.com`、`waapdg.jd.com`、`sdkfp.jd.com`、`consumer.fcbox.com`。
4. **保留轻量注入作为兜底**：抑制页面报错 + 按关键词隐藏漏网的推荐/广告块 + 移除已插入的 ifloors 节点。
5. **JSON 分支**：命中 `uniformRecommend`/`guessYouLike`/`recommend*` 直接返回空数据；所有可处理接口递归清理广告字段。

## 已知限制

京东首页的**主体（金刚区 / 楼层 / 主信息流）大概率是原生渲染**（抓包里能看到 `storage.jd.com` 的 `taroNative-jdhome_*` 原生模块包，但抓不到对应的数据接口）。原生渲染的部分 **MITM 够不着**，所以：

- 二楼、浏览历史、弹窗、引导、埋点 → 本插件能干净干掉；
- 首页主体楼层 → 若仍是原生渲染，本插件**改不动**。

如果你发现首页主体没变化，请抓一份 40–60 秒、期间**上下滚动首页两三屏**的包发我，我再定位真正的楼层数据请求做精准改写。

## 安装（通过 GitHub 添加）

> `raw.githubusercontent.com` 与 `main` 分支都有 CDN 缓存延迟，务必用**固定到具体 commit 的 URL**。

### 方案 A：主版（脚本走 raw.githubusercontent.com）

```
https://raw.githubusercontent.com/aoconch/jd-simplify-loon/cac0a6f4a6f0c0d7ceafd103019697e261fe4f85/jd-simplify.plugin
```

### 方案 B：jsDelivr 版（脚本走 cdn.jsdelivr.net）

若你的网络访问 `raw.githubusercontent.com` 很慢或超时（插件能装上但 Loon 提示「脚本下载失败」），改用这一版——**插件清单和 JS 脚本都走 jsDelivr**：

```
https://cdn.jsdelivr.net/gh/aoconch/jd-simplify-loon@641770c895f6bf8c3c1d18bb97a8f5b5b8cf41be/jd-simplify-jsdelivr.plugin
```

> 两个版本的 `[Rule]` 拦截规则完全一致，只有 `script-path` 的域名不同，**装一个即可，不要同时装**。

### 安装后必做

1. Loon → **插件** → **添加**（或「+」）→ 选「通过 URL 添加」，填入上面的链接。
2. 确认安装并**开启 MITM**（Loon 会提示为 `api.m.jd.com`、`pro.m.jd.com` 等开启证书信任）。
3. iOS 证书两步信任：`设置 → 通用 → VPN与设备管理` 信任 `Loon Certificate`；再进 `设置 → 关于本机 → 证书信任设置` 打开 Loon 根证书开关。
4. **彻底杀掉京东 App 再重开**（一定要冷启动，热启动会复用已加载的页面）。

## 如何确认生效

- **最硬的证据**：抓 HAR，看 `pro.m.jd.com` 首页 HTML 的响应体里是否含 `JD-SIMPLIFY-INJECTED`，且搜不到 `ifloors/`（只剩 `ifloors-disabled/`）。
- **响应头**：`X-JD-WebView: 1`（HTML 已改写）、`X-JD-Simplified: 1`（JSON 已清理）、`X-JD-Simplified: 1-feed`（推荐接口已掏空）。
  ⚠️ 京东自己的响应也常带 `x-jd-webview` 头，单独出现**不足以**证明脚本执行。
- **肉眼**：下拉二楼的「浏览历史 / 为你推荐」不再出现；首页开屏弹窗消失。

## 故障排查

1. MITM 已开 + 证书两级信任（见安装第 2/3 步）——否则脚本不触发。
2. 删掉旧插件、用上面的 commit 固定 URL 重新添加。
3. 埋点域的 REJECT 若导致 App 异常（极端情况），删掉 `jd-simplify.plugin` 中 `[Rule]` 段落对应行即可。
4. 首页主体仍无变化 → 见「已知限制」，抓长包发我。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `jd-simplify.plugin` | Loon 插件清单主版（`[Script]` 重写 + `[Mitm]` + `[Rule]` 拦截，脚本走 raw.githubusercontent.com） |
| `jd-simplify-jsdelivr.plugin` | 同上，仅 `script-path` 换成 jsDelivr CDN；raw 拉不动时用 |
| `jd-simplify.js` | http-response 重写脚本：打坏楼层 JS 包 URL + 注入兜底 + JSON 广告清理 |
| `jd-debug-mitm.plugin` | 抓包诊断版：**纯 `[Mitm]`、零脚本**，只为把接口以明文暴露在 HAR 里。用完请删 |
| `CAPTURE.md` | 抓包指引（含「购物车 / 消息页」专项步骤） |
| `tools/` | HAR 分析脚本（`har.py` 公共库 + overview / timeline / api_list / probe） |
| `README.md` | 本说明 |

## 自定义

- **增删广告判定**：改 `jd-simplify.js` 里的 `EXPLICIT_AD_KEYS` 与 `AD_KEYWORDS`。
- **更多推荐流接口**：在 `recommendFns` 数组里补充 `functionId`。
- **补充隐藏关键词**：在 `neutralize()` 内的 `kws` 数组追加。
- **关闭某条拦截**：删除 `jd-simplify.plugin` 中 `[Rule]` 段落对应行。

## 免责声明

仅供学习与研究使用。使用本插件产生的任何风险由使用者自行承担，请遵守相关平台服务条款。

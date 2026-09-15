# 京东首页与我的页精简 · Loon 插件

基于捕获的京东 App 流量逆向，编写的一个 Loon 重写插件，用于**精简京东 App 首页与「我的」页**：清空首页「猜你喜欢 / 为你推荐」信息流、过滤广告/推广/营销卡片，降低页面噪声。

## 原理（重要，v3.0 重大修正）

- **京东首页是一个 React 写的 H5 网页（host = `pro.m.jd.com`），不是原生接口渲染。** 推荐流"猜你喜欢"在网页内部通过 JSONP 回调 `getRecommendPageSourceCallback` 动态加载，数据根本不走 `api.m.jd.com` 的 JSON 接口。早期多轮"脚本在跑却没效果"的根因正是：脚本只改了 JSON 接口，对网页内容毫无作用。
- **`basicConfig` 响应约 345KB，超出 Loon `requires-body` 内部体积上限**，Loon 不会把它的 body 交给脚本，因此无法靠改写 `basicConfig` 开关来精简。
- **v3.0→v3.1 的应对**：把 `pro.m.jd.com` 加入 `[Mitm]`，并对首页网页 HTML 注入脚本：
  1. **从源头掐断原生桥**：网页源码为 `function w(...){ window.XWebView.callNative(e,n,a,t,i) }`，推荐数据经 `window.XWebView.callNative("JDURecommendH5Bridge","getRecommendPageSource",...)` 由原生层下发。v3.1 通过劫持 `window.XWebView` 的赋值、改写其 `callNative`，凡参数含 `Recommend` 的桥调用一律拦截，其余原生调用照常委托（不破坏页面）。
  2. **锁死推荐流回调（兜底）**：`Object.defineProperty` 把 `getRecommendPageSourceCallback` 锁成空函数；
  3. **内容感知隐藏（兜底）**：`MutationObserver` + 关键词（猜你喜欢/为你推荐/百亿补贴…）扫描楼层容器 `display:none`，滚动加载持续生效；
  4. **JSON 接口分支（我的页 / 小接口）**：命中 `uniformRecommend`/`guessYouLike`/`recommend*` 直接返回空数据；`secondFloor` 移除 `recommendFloor`；所有可处理接口递归清理广告字段。
- 后台埋点（`mars.jd.com/log`、`perf.m.jd.com` 等）通过 `[Rule]` 直接 REJECT，**不需要 MITM 即生效**。

## 安装（通过 GitHub 添加）

> `raw.githubusercontent.com` 的 `main` 分支有 CDN 缓存延迟，务必用**固定到具体 commit 的 URL**，确保拉到的是最新脚本：

```
https://raw.githubusercontent.com/aoconch/jd-simplify-loon/7c72c35f3a85a637633f20ecdaf99ce4ec9c958b/jd-simplify.plugin
```

1. Loon → **插件** → **添加**（或「+」）→ 选「通过 URL 添加」，填入上面的链接。
2. 确认安装并**开启 MITM**（Loon 会提示为 `api.m.jd.com`、`sh.jd.com`、`pro.m.jd.com` 等开启证书信任）。
3. iOS 证书两步信任：`设置 → 通用 → VPN与设备管理` 信任 `Loon Certificate`；再进 `设置 → 关于本机 → 证书信任设置` 打开 Loon 根证书开关。
4. 重启京东 App 即可生效。

## 如何确认脚本真的在跑（验证方法）

抓一份京东启动 + 首页滚动的 HAR，在响应头里查找：

- **`X-JD-WebView: 1`** → 首页 H5 网页已被注入去推荐脚本（注意：京东自己的响应也可能带 `x-jd-webview` 头，单独出现不足以证明我们的脚本执行；真正证明是 HAR 中 pro.m.jd.com 的 HTML body 里含有 `JD-SIMPLIFY-INJECTED` 标记与注入的 `<script>`）；
- **`X-JD-Simplified: 1`** → 某 JSON 接口已被改写（通用广告清理）；
- **`X-JD-Simplified: 1-feed`** → 某推荐流接口已被清空。

> 验证脚本是否真生效：抓 HAR 后看 pro.m.jd.com 的 HTML 响应体是否含 `JD-SIMPLIFY-INJECTED`；以及肉眼看首页"猜你喜欢"是否消失。若 body 有标记但页面没变化，说明推荐走了我们还没覆盖到的另一条加载通道，需把残留内容截图发我。

## 故障排查

1. **先确认 MITM 已开 + 证书两级信任**（见安装第 2/3 步）——否则脚本不触发。
2. **删掉旧插件、用上面的 commit 固定 URL 重新添加**，避免设备上残留早期本地副本或旧脚本。
3. 若重加后仍**无 `X-JD-WebView` 头**：说明 `pro.m.jd.com` 网页未被 MITM。检查 Loon 是否提示为 `pro.m.jd.com` 开启证书；或首页网页体积（约 100KB）可能恰好触及 Loon body 上限——此时请把抓到的 HAR 发我，我改用 `[Rule]` 直接 REJECT 推荐数据接口的方案。
4. 若 `X-JD-WebView` 出现但页面仍有推荐残留：说明隐藏规则没覆盖到该楼层，请把「仍然显示的内容」截图或文字描述发我，我据此补充关键词/选择器。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `jd-simplify.plugin` | Loon 插件清单（`[Script]` 重写 + `[Mitm]` + `[Rule]` 拦截） |
| `jd-simplify.js` | http-response 重写脚本：网页注入去推荐 + JSON 接口广告清理 |
| `README.md` | 本说明 |

## 自定义

- **增删广告判定**：改 `jd-simplify.js` 里的 `EXPLICIT_AD_KEYS` 与 `AD_KEYWORDS`。
- **更多推荐流接口**：在 `recommendFns` 数组里补充 `functionId`。
- **补充隐藏关键词**：在 `neutralize()` 内的 `kws` 数组追加。
- **关闭埋点拦截**：删除 `jd-simplify.plugin` 中 `[Rule]` 段落即可。

## 免责声明

仅供学习与研究使用。使用本插件产生的任何风险由使用者自行承担，请遵守相关平台服务条款。

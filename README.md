# 京东首页与我的页精简 · Loon 插件

基于捕获的京东 App 流量逆向，编写的一个 Loon 重写插件，用于**精简京东 App 首页与「我的」页**：清空首页「猜你喜欢 / 为你推荐」信息流、过滤广告/推广/营销卡片，降低页面噪声。

## 原理（重要）

- 京东 `basicConfig` 响应约 **345KB**，超出了 Loon `requires-body` 的内部体积上限，Loon 不会把它的 body 交给脚本，因此**无法靠改写 `basicConfig` 里的开关来精简**（这是早期多轮“装了没效果”的根因之一）。
- 所以本插件**不依赖 `basicConfig` 开关**，而是直接处理真正渲染内容的小接口：
  1. **首页推荐流**：命中 `uniformRecommend` / `guessYouLike` / `recommend*` 等接口时，直接返回空数据，干掉「猜你喜欢」无限流。
  2. **`secondFloor`**：移除 `recommendFloor` 推荐楼层 + 递归清理广告。
  3. **所有可处理接口**：递归删除明确广告字段（`adInfo`/`isAd`/`adType`/`promotionInfo`/`adTrack` 等）与命中营销关键词（领券/签到/白条/会员/补贴/抽奖/互动游戏…）且不含商品核心字段的对象。
- 后台埋点（`mars.jd.com/log`、`perf.m.jd.com` 等）通过 `[Rule]` 直接 REJECT，**不需要 MITM 即生效**。

## 安装（通过 GitHub 添加）

> 由于 `raw.githubusercontent.com` 的 `main` 分支存在 CDN 缓存延迟，建议用**固定到具体 commit 的 URL** 添加，确保拉到的是最新脚本：

```
https://raw.githubusercontent.com/aoconch/jd-simplify-loon/89beb32b0a06f9a49a9b16bb73fff0b1004c6bb8/jd-simplify.plugin
```

（如需最新版本，可改用 `.../main/jd-simplify.plugin`，但可能短暂命中缓存旧版。）

1. 打开 Loon → **插件** → **添加**（或「+」）→ 选「通过 URL 添加」，填入上面的链接。
2. 确认安装并**开启 MITM**（Loon 会提示为 `api.m.jd.com`、`sh.jd.com` 等开启证书信任）。
3. iOS 证书两步信任：`设置 → 通用 → VPN与设备管理` 信任 `Loon Certificate`；再进 `设置 → 关于本机 → 证书信任设置` 打开 Loon 根证书开关。
4. 重启京东 App 即可生效。

## 如何确认脚本真的在跑（验证方法）

抓一份京东启动 + 首页滚动的 HAR，在任意 `api.m.jd.com` 响应的响应头里查找：

- **`X-JD-Simplified: 1`** → 该接口已被改写（通用广告清理）；
- **`X-JD-Simplified: 1-feed`** → 该接口是推荐流，已被清空。

> 注意：首页「猜你喜欢」被清空后，页面该区域会变为空白/「暂无」，这是预期效果，不是崩潰。

## 故障排查

1. **先确认 MITM 已开 + 证书两级信任**（见安装第 3 步）——否则脚本不触发。
2. **删掉旧插件、用上面的 commit 固定 URL 重新添加**，避免设备上残留早期本地副本或旧脚本。
3. **埋点拦截不需 MITM**：若同步后后台请求变少但页面没变，说明 http-response 那层（需 MITM）还没生效，回头查 MITM/证书。
4. 若重加后仍无任何 `X-JD-Simplified` 头，请告知：插件里「京东精简去广告」脚本开关是否绿色开启？Loon 关于里的版本号？

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `jd-simplify.plugin` | Loon 插件清单（`[Script]` 重写 + `[Mitm]` + `[Rule]` 拦截） |
| `jd-simplify.js` | http-response 重写脚本，执行清空推荐流 + 递归广告清理 |
| `README.md` | 本说明 |

## 自定义

- **增删广告判定**：改 `jd-simplify.js` 里的 `EXPLICIT_AD_KEYS` 与 `AD_KEYWORDS`。
- **更多推荐流接口**：在 `recommendFns` 数组里补充 `functionId`。
- **关闭埋点拦截**：删除 `jd-simplify.plugin` 中 `[Rule]` 段落即可。

## 免责声明

仅供学习与研究使用。使用本插件产生的任何风险由使用者自行承担，请遵守相关平台服务条款。

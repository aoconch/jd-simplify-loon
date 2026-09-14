# 京东首页与我的页精简 · Loon 插件

基于捕获的京东 App 流量（`basicConfig` 等接口）逆向，编写的一个 Loon 重写插件，用于**精简京东 App 首页与「我的」页**——关闭首页推荐信息流、过滤广告/推广/营销模块，降低页面噪声。

## 效果

- **首页**：关闭 `TNUnionFetch.recommend` 推荐流开关，减少“为你推荐/猜你喜欢”等无限信息流。
- **首页 & 我的页**：递归过滤明确的广告对象（`adInfo` / `isAd` / `adType` / `promotionInfo` / `adTrack` 等字段），以及模板/楼层命中强广告关键词（ad、promotion、coupon、lottery、redpacket、float、popup、marketing 等）且不含商品核心字段的推广卡片。
- **后台降噪**：通过 `[Rule]` 拦截京东埋点/监控域名（`mars.jd.com/log`、`perf.m.jd.com`、`anti-sdk-report.m.jd.com`），不影响任何功能。

> 说明：本插件基于一次启动期流量捕获分析所得，京东接口字段会随版本变化。脚本采用「定向开关 + 通用广告字段过滤」双策略，对正常商品流影响较小；如遇新版字段变动，可据 `jd-simplify.js` 中的 `isAdLike` 自行增删判定规则。

## 安装（通过 GitHub 添加）

1. 打开 Loon → **插件** → **添加**（或「+」）。
2. 选择「通过 URL 添加」，填入：

   ```
   https://raw.githubusercontent.com/aoconch/jd-simplify-loon/main/jd-simplify.plugin
   ```

3. 确认安装并**开启 MITM**（Loon 会提示为 `api.m.jd.com`、`ccfjma.m.jd.com` 开启证书信任）。
4. 重启京东 App 即可生效。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `jd-simplify.plugin` | Loon 插件清单（脚本规则 + MITM + 拦截规则） |
| `jd-simplify.js` | http-response 重写脚本，执行精简逻辑 |
| `README.md` | 本说明 |

## 自定义

- **彻底关闭「我的」页推荐**：在 `jd-simplify.js` 的 `simplify()` 中取消 `t.jdmine.enable = 0` 注释（会清空「我的」页，不建议）。
- **调整广告判定**：修改 `isAdLike()` 中的 `explicitAdKeys` 与 `adWords` 正则。
- **关闭埋点拦截**：删除 `jd-simplify.plugin` 中 `[Rule]` 段落即可。

## 免责声明

仅供学习与研究使用。使用本插件产生的任何风险由使用者自行承担，请遵守相关平台服务条款。

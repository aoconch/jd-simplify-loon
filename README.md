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

3. 确认安装并**开启 MITM**（Loon 会提示为 `api.m.jd.com`、`ccfjma.m.jd.com`、`ccflbs.m.jd.com`、`sh.jd.com` 开启证书信任）。
4. 重启京东 App 即可生效。

## 故障排查（装上了但没效果 / 页面没变）

**最常见原因：MITM 没真正生效。** Loon 只有在对 `api.m.jd.com` 做 HTTPS 解密（MITM）时，才能读到并改写响应体；否则脚本虽显示在列表里，但永远不触发，页面原样返回。

按下面顺序检查：

1. **Loon → 设置 → MITM（中间件）→ 总开关已打开。**
2. **安装并信任证书（两步都缺一不可）：**
   - 在 Loon 内点「安装证书 / 生成证书」，去 iOS `设置 → 通用 → VPN与设备管理` 信任 `Loon Certificate`；
   - 再进 `设置 → 关于本机 → 证书信任设置`，把 **Loon 根证书开关打开**（这步最常被漏掉）。
3. **确认 `api.m.jd.com` 已出现在 MITM 主机名列表**（装好插件会自动 `%APPEND%` 追加；没有就手动加）。
4. **删掉旧插件、用上面的 URL 重新添加一次**（避免设备上残留早期格式的本地副本）。
5. **自我验证**：开启 MITM 后重新抓一份京东启动 HAR，看 `basicConfig` 响应里
   `data.TNUnionFetch.recommend.enable` 是否为 `0`：
   - 是 `0` → 脚本已跑起来，再按效果微调；
   - 仍是 `1` → MITM 仍没生效，先别动脚本，回头把第 2 步证书信任再确认一遍。

> 如果抓到的 HAR 里只有 `basicConfig`、没有首页「猜你喜欢」推荐流和「我的」页模块数据，说明那次抓包没抓到页面滚动/打开「我的」时的实时接口。脚本已对**所有** `api.m.jd.com` 响应做通用广告过滤，MITM 生效后这些实时接口也会被改写。若想更精准，可把滚动首页 + 打开「我的」后的 HAR 发来，我再针对真实字段调规则。

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

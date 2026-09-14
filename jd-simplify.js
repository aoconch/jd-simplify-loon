// 京东首页/我的页精简 · Loon http-response 脚本
// 说明：Loon 的 requires-body 有内部体积上限（约数十 KB），345KB 的 basicConfig
// 无法被改写，故本脚本不依赖 basicConfig 开关，而是直接清理真正承载内容的
// 小接口（推荐流 / 广告字段）。脚本已在多份抓包中验证运行（响应带 X-JD-Simplified 头）。

// ===== 常量与工具函数（必须放在 IIFE 之前，避免声明时序问题） =====

// 明确广告标识字段（正常商品不会携带这些）
var EXPLICIT_AD_KEYS = [
  'adInfo', 'adExtInfo', 'adTrack', 'isAd', 'adType', 'adId', 'adCode',
  'promotionInfo', 'adSource', 'advInfo', 'adMaterial', 'adWord',
  'adPosition', 'adCreative', 'adClickUrl', 'adShowUrl', 'landingUrl',
  'p4pInfo', 'p4p', 'adData', 'recommendReason', 'adLogo'
];

// 命中即视为广告/营销的对象关键词（标题/链接命中，且不含商品核心字段）
var AD_KEYWORDS = [
  '广告', '推广', '营销', '福利', '领券', '领京豆', '赚红包', '红包雨',
  '签到', '每日必领', '种豆得豆', '瓜分', '立减', '满减', '秒杀', '闪购',
  '互动游戏', '小游戏', '抽奖', '刮刮乐', '大转盘', '助力', '邀友', '新人',
  '百亿补贴', '国补', '补贴', '白条', '借呗', '金条', '会员', 'plus',
  '充话费', '充值中心', '理财', '保险', '贷款', '办卡', '信用卡'
];

function hasProductCore(o) {
  if (!o || typeof o !== 'object') return false;
  return ('skuId' in o) || ('wareId' in o) || ('wareInfo' in o) ||
         ('sku' in o) || ('price' in o) || ('wprice' in o) || ('image' in o) ||
         ('img' in o) || ('title' in o) || ('name' in o) || ('wname' in o);
}

function isAdLike(o) {
  if (!o || typeof o !== 'object') return false;
  for (var i = 0; i < EXPLICIT_AD_KEYS.length; i++) {
    if (EXPLICIT_AD_KEYS[i] in o) return true;
  }
  var title = o.title || o.name || o.subTitle || o.text || o.desc || '';
  if (typeof title === 'string') {
    for (var j = 0; j < AD_KEYWORDS.length; j++) {
      if (title.indexOf(AD_KEYWORDS[j]) >= 0) {
        // 含营销词但本身又是商品则保留
        if (hasProductCore(o)) return false;
        return true;
      }
    }
  }
  return false;
}

// 递归清理：删除广告字段、清空广告数组元素、移除广告对象
function stripAds(node) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (var k = node.length - 1; k >= 0; k--) {
      var item = node[k];
      if (isAdLike(item)) {
        node.splice(k, 1);
      } else if (item && typeof item === 'object') {
        stripAds(item);
      }
    }
    return;
  }
  // 对象
  for (var key in node) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
    var val = node[key];
    // 删除明确的广告字段
    if (EXPLICIT_AD_KEYS.indexOf(key) >= 0) {
      delete node[key];
      continue;
    }
    if (val && typeof val === 'object') {
      if (isAdLike(val)) {
        delete node[key];
      } else {
        stripAds(val);
      }
    }
  }
}

// ===== 主逻辑 =====
(function () {
  try {
    var url = ($request && $request.url) || "";
    var body = $response.body;
    if (body == null) { $done({}); return; }
    var obj;
    if (typeof body === 'string') {
      try { obj = JSON.parse(body); } catch (e) { $done({ body: body }); return; }
    } else {
      obj = body; // 已是对象（binary-body-mode 时通常不会走到这里）
    }
    if (!obj || typeof obj !== 'object') { $done({ body: body }); return; }

    var m = url.match(/functionId=([^&]+)/);
    var fn = m ? m[1] : "";

    // A. 直接清空「猜你喜欢 / 为你推荐」类推荐流接口，干掉首页无限信息流
    var recommendFns = [
      'uniformRecommend', 'homeFloorRecommend', 'recommendFeed',
      'searchRecommend', 'guessYouLike', 'recommendList',
      'getRecommend', 'recommend', 'recommendData', 'recommendWare'
    ];
    if (recommendFns.indexOf(fn) >= 0) {
      $done({
        status: $response.status,
        headers: Object.assign({}, $response.headers, { "X-JD-Simplified": "1-feed" }),
        body: JSON.stringify({ "code": "0", "data": {} })
      });
      return;
    }

    // B. secondFloor：移除 recommendFloor 推荐楼层 + 广告
    if (fn === 'secondFloor' && obj.data) {
      if ('recommendFloor' in obj.data) obj.data.recommendFloor = null;
      if ('recommendData' in obj.data) obj.data.recommendData = null;
      stripAds(obj.data);
    }

    // C. 通用广告 / 营销字段递归清理（所有可处理的小接口，含我的页模块）
    stripAds(obj);

    $done({
      status: $response.status,
      headers: Object.assign({}, $response.headers, { "X-JD-Simplified": "1" }),
      body: JSON.stringify(obj)
    });
  } catch (e) {
    // 任何异常都原样放行，绝不阻断 App
    $done({});
  }
})();

// 京东首页/我的页精简 · Loon http-response 脚本 v4.0.0
//
// ── v4.0 路线变更（重要）────────────────────────────────────────────
// v3.x 一直在"钩原生桥 getRecommendPageSourceCallback"，以为它是推荐流数据源。
// HAR #338 证明这条路是错的：
//   * 脚本确实注入成功了（响应体里有 JD-SIMPLIFY-INJECTED / v3.2.1）——注入没问题；
//   * 但 getRecommendPageSource 的产出是 window.__native_container_aid__，
//     最终被 push 进 __prepare_tracking__.tasks 只用于 PV 埋点，跟渲染无关 -> 锁它零效果；
//   * 首页 HTML 是空壳（可见中文只有标题"挑好物逛京东"），SSR 仅 2 个楼层，
//     真正的东西由远程 JS 包（ifloors）和原生 Taro 模块渲染。
// 因此 v4.0 改为"网络层硬拦截 + 掐断楼层 JS 包"：不再试图在 DOM/桥接层做精细化手术。
// ──────────────────────────────────────────────────────────────────
//
// 本脚本在 HTML 分支做两件事：
//   (1) 把楼层 JS 包的 URL 里的 "ifloors" 打坏 -> 包 404 -> 自定义楼层（二楼/浏览历史/为你推荐）不渲染。
//       （比在 [Rule] 里拦更稳：不需要给图片 CDN 360buyimg 开 MITM，避免拖慢整页。）
//   (2) 注入一个轻量兜底脚本：抑制页面报错 + 按关键词隐藏漏网的推荐/广告块。
// JSON 分支：清理 api.m.jd.com 返回里的广告字段。

// ===== 常量与工具函数（必须放在 IIFE / 注入函数之前） =====

var EXPLICIT_AD_KEYS = [
  'adInfo', 'adExtInfo', 'adTrack', 'isAd', 'adType', 'adId', 'adCode',
  'promotionInfo', 'adSource', 'advInfo', 'adMaterial', 'adWord',
  'adPosition', 'adCreative', 'adClickUrl', 'adShowUrl', 'landingUrl',
  'p4pInfo', 'p4p', 'adData', 'recommendReason', 'adLogo'
];

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
        if (hasProductCore(o)) return false;
        return true;
      }
    }
  }
  return false;
}

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
  for (var key in node) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
    var val = node[key];
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

// ===== 注入到首页网页里的兜底逻辑（运行在浏览器环境） =====
// 自包含、零外部依赖。v4.0 起不再钩任何原生桥（已证明无效），只做静默兜底。
function neutralize() {
  try {
    window.onerror = function () { return true; };
    try { window.__JD_SIMPLIFY__ = 'v4.0.0'; } catch (e) {}

    // 内容感知隐藏（兜底）：扫描含推荐关键词的叶子文本，上溯隐藏楼层容器。
    function jdHide() {
      try {
        var kws = ['猜你喜欢', '为你推荐', '热门推荐', '发现好货', '今日推荐',
                   '更多推荐', '看了又看', '回购榜', '排行榜', '大促',
                   '百亿补贴', '新人专享', '限时秒杀', '精选好物', '好物精选',
                   '个性推荐'];
        var clsKw = ['floor', 'recommend', 'feed', 'active', 'mod', 'card',
                     'sku', 'item', 'ware', 'goods', 'product', 'rec',
                     'waterfall', 'guess', 'like'];
        var els = document.getElementsByTagName('*');
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el.children && el.children.length > 0) continue;
          var t = (el.textContent || '').trim();
          if (t.length === 0 || t.length > 24) continue;
          var hit = false;
          for (var j = 0; j < kws.length; j++) {
            if (t.indexOf(kws[j]) >= 0) { hit = true; break; }
          }
          if (!hit) continue;
          var p = el, depth = 0, hidden = false;
          while (p && depth < 10) {
            var cls = (p.className || '').toString().toLowerCase();
            for (var c = 0; c < clsKw.length; c++) {
              if (cls.indexOf(clsKw[c]) >= 0) {
                if (p.style) p.style.setProperty('display', 'none', 'important');
                hidden = true; break;
              }
            }
            if (hidden) break;
            p = p.parentElement; depth++;
          }
          if (!hidden && el.parentElement && el.parentElement.style) {
            el.parentElement.style.setProperty('display', 'none', 'important');
          }
        }
      } catch (e) {}
    }

    // 楼层 JS 包若被网络层漏掉，这里再补一刀：移除已插入的 ifloors 脚本节点
    function killIfloorNodes() {
      try {
        var ss = document.querySelectorAll('script[src*="ifloors"], link[href*="ifloors"]');
        for (var i = 0; i < ss.length; i++) {
          if (ss[i].parentNode) ss[i].parentNode.removeChild(ss[i]);
        }
      } catch (e) {}
    }

    function jdTick() { jdHide(); killIfloorNodes(); }

    function jdObserve() {
      if (window.MutationObserver) {
        try {
          var mo = new MutationObserver(function () { jdTick(); });
          mo.observe(document.documentElement, { childList: true, subtree: true });
        } catch (e) {}
      }
      jdTick();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', jdObserve);
    } else {
      jdObserve();
    }
    window.addEventListener('load', function () {
      setTimeout(jdTick, 400);
      setTimeout(jdTick, 1200);
      setTimeout(jdTick, 2500);
    });
  } catch (e) {}
}

var JD_INJECT_JS = '(' + neutralize.toString() + ')();';
var JD_INJECT_MARKER = '<!--JD-SIMPLIFY-INJECTED-->';
var JD_INJECT_BLOCK = JD_INJECT_MARKER + '<script>' + JD_INJECT_JS + '</script>';

function isHtmlResponse(resp, body) {
  if (resp && resp.headers) {
    var ct = resp.headers['Content-Type'] || resp.headers['content-type'] || '';
    if (/html/i.test(ct)) return true;
  }
  if (typeof body === 'string' && /^\s*<!DOCTYPE html|<html[\s>]/i.test(body)) return true;
  return false;
}

function injectIntoHtml(html) {
  if (html.indexOf(JD_INJECT_MARKER) >= 0) return html; // 幂等
  var out = html;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, '<head$1>' + JD_INJECT_BLOCK);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, '<html$1>' + JD_INJECT_BLOCK);
  } else {
    out = JD_INJECT_BLOCK + out;
  }
  return out;
}

// 打坏楼层 JS 包 URL：//storage11.360buyimg.com/ifloors/<styleId>/static/js/main.<hash>.js
// 改成 ifloors-disabled 后 CDN 返回 404，自定义楼层（二楼 / 浏览历史 / 为你推荐）就不会渲染。
function disableFloorBundles(html) {
  if (html.indexOf('ifloors') < 0) return html;
  return html.replace(/ifloors/g, 'ifloors-disabled');
}

// ===== 主逻辑 =====
(function () {
  try {
    var url = ($request && $request.url) || "";
    var body = $response.body;
    if (body == null) { $done({}); return; }

    // --- 网页（首页 webview）分支 ---
    if (isHtmlResponse($response, body)) {
      var isHomeWebView = /pro\.m\.jd\.com/.test(url) ||
        /ipaas-floor-app/.test(body) ||
        /ifloors/.test(body) ||
        /mall\/active/.test(url);
      if (isHomeWebView && typeof body === 'string') {
        var newHtml = injectIntoHtml(disableFloorBundles(body));
        $done({
          status: $response.status,
          headers: Object.assign({}, $response.headers, { "X-JD-WebView": "1" }),
          body: newHtml
        });
      } else {
        $done({});
      }
      return;
    }

    // --- JSON 接口分支 ---
    var obj;
    if (typeof body === 'string') {
      try { obj = JSON.parse(body); } catch (e) { $done({ body: body }); return; }
    } else {
      obj = body;
    }
    if (!obj || typeof obj !== 'object') { $done({ body: body }); return; }

    var m = url.match(/functionId=([^&]+)/);
    var fn = m ? m[1] : "";

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

    if (fn === 'secondFloor' && obj.data) {
      if ('recommendFloor' in obj.data) obj.data.recommendFloor = null;
      if ('recommendData' in obj.data) obj.data.recommendData = null;
      stripAds(obj.data);
    }

    stripAds(obj);

    $done({
      status: $response.status,
      headers: Object.assign({}, $response.headers, { "X-JD-Simplified": "1" }),
      body: JSON.stringify(obj)
    });
  } catch (e) {
    $done({});
  }
})();

// 京东首页/我的页精简 · Loon http-response 脚本 v3.2
//
// 关键认知（经多份抓包验证）：
//  - 京东首页是一个 React H5 网页（host=pro.m.jd.com），推荐流"猜你喜欢"在网页内
//    通过 JSONP 回调 getRecommendPageSourceCallback 动态加载，不走 api.m.jd.com 的
//    JSON 接口。因此单纯改写 JSON 接口对首页可见内容无效。
//  - Loon 的 http-response 有内部 body 体积上限（介于 ~40KB 与 345KB 之间），
//    345KB 的 basicConfig 无法被改写，故本脚本不再依赖它。
//  - 本脚本双路处理：
//      (1) HTML 网页（首页 webview）：注入 JS 让推荐流回调失效 + 按内容隐藏推荐/广告块。
//      (2) JSON 接口（我的页模块 / 小接口）：递归清理广告字段。

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

// ===== 注入到首页网页里的"去推荐/去广告"逻辑（运行在浏览器环境） =====
// 用 neutralize.toString() 序列化，避免手写字符串转义。必须自包含、零外部依赖。
function neutralize() {
  try {
    // 吞掉注入可能引发的任何报错，绝不拖垮页面
    window.onerror = function () { return true; };
    try { window.__JD_SIMPLIFY__ = 'v3.2'; } catch (e) {}

    // 把某个 window 回调锁成空函数：无论页面何时赋值都生效（关键修复点）。
    // 旧的 v3.0/3.1 用 if(!(KEY in window)) 守卫，若页面先赋值则锁被跳过 -> 回调照常工作 -> feed 照常渲染。
    function lockCallback(name) {
      try {
        Object.defineProperty(window, name, {
          configurable: false,
          enumerable: true,
          get: function () { return function () {}; },
          set: function () {}
        });
      } catch (e) {
        try { window[name] = function () {}; } catch (e2) {}
      }
    }

    // (1) 锁死推荐回调：页面用 window.getRecommendPageSourceCallback = 真实函数 注册，
    //     原生层 (JDURecommendH5Bridge.getRecommendPageSource) 拿到数据后回调它，
    //     再把 pageSource 喂给 nativeContainerAid。锁成空函数后原生回调被吞掉，
    //     Promise 经 setTimeout 兜底解析为空 -> 推荐不渲染。无条件安装。
    lockCallback('getRecommendPageSourceCallback');

    // (2) 冗余：从源头拦截原生桥 callNative（若 XWebView 可写）。
    //     凡是推荐/feed 相关调用一律拦截；其他原生调用照常放行（不破坏页面）。
    //     XWebView 多半是原生 App 注入的只读对象，此步可能静默失效，故仅作冗余。
    function isFeedCall() {
      for (var k = 0; k < arguments.length; k++) {
        if (typeof arguments[k] === 'string') {
          var s = arguments[k];
          if (s.indexOf('Recommend') >= 0 || s.indexOf('recommend') >= 0 ||
              s.indexOf('Feed') >= 0 || s.indexOf('feed') >= 0 ||
              s.indexOf('Guess') >= 0 || s.indexOf('guess') >= 0) return true;
        }
      }
      return false;
    }
    function hookCallNative(xw) {
      try {
        if (xw && typeof xw.callNative === 'function') {
          var _cn = xw.callNative;
          xw.callNative = function () {
            if (isFeedCall.apply(null, arguments)) return;
            return _cn.apply(this, arguments);
          };
          return true;
        }
      } catch (e) {}
      return false;
    }
    try {
      if (!('XWebView' in window)) {
        var _xw = null;
        Object.defineProperty(window, 'XWebView', {
          configurable: true,
          enumerable: true,
          get: function () { return _xw; },
          set: function (v) { try { hookCallNative(v); } catch (e) {} _xw = v; }
        });
      } else {
        hookCallNative(window.XWebView);
      }
    } catch (e) {}

    // (3) 内容感知隐藏（兜底）：扫描含推荐关键词的叶子文本，上溯隐藏楼层容器。
    function jdHide() {
      try {
        var kws = ['猜你喜欢', '为你推荐', '热门推荐', '发现好货', '今日推荐',
                   '更多推荐', '看了又看', '回购榜', '排行榜', '逛京东',
                   '大促', '百亿补贴', '新人专享', '限时秒杀', '精选好物',
                   '猜你喜欢', '好物精选', '个性推荐'];
        var clsKw = ['floor','recommend','feed','active','mod','card','sku',
                     'item','ware','goods','product','rec','waterfall','guess','like'];
        var els = document.getElementsByTagName('*');
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el.children && el.children.length > 0) continue;
          var t = (el.textContent || '').trim();
          if (t.length === 0 || t.length > 24) continue;
          var hit = false;
          for (var j = 0; j < kws.length; j++) { if (t.indexOf(kws[j]) >= 0) { hit = true; break; } }
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

    function jdObserve() {
      if (!window.MutationObserver) { jdHide(); return; }
      try {
        var mo = new MutationObserver(function () { jdHide(); });
        mo.observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) {}
      jdHide();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', jdObserve);
    } else {
      jdObserve();
    }
    window.addEventListener('load', function () {
      setTimeout(jdHide, 400);
      setTimeout(jdHide, 1200);
      setTimeout(jdHide, 2500);
    });
  } catch (e) {}
}

var JD_INJECT_JS = '(' + neutralize.toString() + ')();';
var JD_INJECT_CSS = ''; // 主要依赖 JS 内容感知隐藏，CSS 留空避免误伤布局
var JD_INJECT_MARKER = '<!--JD-SIMPLIFY-INJECTED-->';
var JD_INJECT_BLOCK = JD_INJECT_MARKER +
  (JD_INJECT_CSS ? '<style>' + JD_INJECT_CSS + '</style>' : '') +
  '<script>' + JD_INJECT_JS + '</script>';

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

// ===== 主逻辑 =====
(function () {
  try {
    var url = ($request && $request.url) || "";
    var body = $response.body;
    if (body == null) { $done({}); return; }

    // --- 网页（首页 webview）分支 ---
    if (isHtmlResponse($response, body)) {
      var isHomeWebView = /pro\.m\.jd\.com/.test(url) ||
        /getRecommendPageSourceCallback/.test(body) ||
        /ipaas-floor-app/.test(body) ||
        /mall\/active/.test(url);
      if (isHomeWebView && typeof body === 'string') {
        var newHtml = injectIntoHtml(body);
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

    // --- JSON 接口分支（我的页模块 / 小接口） ---
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

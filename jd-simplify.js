/*
 * 京东首页 & 我的页 精简脚本 v2 (Loon http-response)
 *
 * 目标（对照截图）：
 *   首页：关闭「为你推荐」信息流、去除顶部 banner / 营销 icon 行 / 推广楼层
 *   我的页：精简钱包/服务/游戏等推广模块、去除签到 banner 和广告卡片
 *
 * 前提：Loon MITM 已开启且证书已信任。
 */

(function () {
  try {
    var body = $response.body;
    if (body == null) { $done({}); return; }
    var obj;
    if (typeof body === 'string') {
      try { obj = JSON.parse(body); } catch (e) { $done({ body: body }); return; }
    } else {
      obj = body;
    }
    if (!obj || typeof obj !== 'object') { $done({ body: body }); return; }

    simplify(obj);

    // 执行证明：打一个响应头，方便在 HAR 里确认脚本是否真的跑过
    var hdrs = ($response.headers && typeof $response.headers === 'object') ? $response.headers : {};
    hdrs['X-JD-Simplified'] = '1';
    $done({ body: JSON.stringify(obj), headers: hdrs });
  } catch (e) {
    $done({});
  }
})();

function simplify(obj) {
  var data = obj && obj.data;
  if (!data) return;

  // ── 1) basicConfig 主开关 ──
  // 关闭首页「猜你喜欢/为你推荐」推荐流聚合
  if (data.TNUnionFetch) {
    var t = data.TNUnionFetch;
    if (t.recommend && t.recommend.enable !== undefined) t.recommend.enable = 0;
    if (t.jdhome && t.jdhome.enable !== undefined) t.jdhome.enable = 0;
    if (t.jdmine && t.jdmine.enable !== undefined) t.jdmine.enable = 0;
  }

  // ── 2) 广告/营销模块级开关置零 ──
  var advKeys = ['JDAD', 'JDAdsCore', 'JDUniformRecommend', 'JDMarket',
                  'JDWidgetManager', 'LaunchOption'];
  for (var ai = 0; ai < advKeys.length; ai++) {
    var mod = data[advKeys[ai]];
    if (mod && typeof mod === 'object') {
      for (var sk in mod) {
        if (!mod.hasOwnProperty(sk)) continue;
        var sv = mod[sk];
        if (sv && typeof sv === 'object') {
          if ('enable' in sv && sv.enable !== 0) sv.enable = 0;
          if ('value' in sv && sv.value !== '0' && sv.value !== 0) sv.value = '0';
          if ('switch' in sv && sv.switch !== '0') sv.switch = '0';
        }
      }
    }
  }

  // ── 3) JDMyJd 「我的」页配置降级 ──
  if (data.JDMyJd && typeof data.JDMyJd === 'object') {
    var mineKeys = ['recommendPreloadSwitchV15110', 'feedbackButton',
                    'taroHomePageDegrade', 'navigationBgImage',
                    'RecommendElderSwitchV15330', 'UDOptEnabledV1570'];
    for (var mi = 0; mi < mineKeys.length; mi++) {
      var mk = data.JDMyJd[mineKeys[mi]];
      if (mk && typeof mk === 'object') {
        if ('enable' in mk) mk.enable = 0;
        if ('value' in mk) mk.value = '0';
        if ('isClose' in mk) mk.isClose = '1';
      }
    }
  }

  // ── 4) 递归清除广告对象 ──
  stripAds(obj);
}

/* ──── 广告判定 ──── */
function isAdLike(o) {
  if (!o || typeof o !== 'object') return false;

  var explicitAdKeys = [
    'adInfo','adExtInfo','adTrack','isAd','adType','adId','adCode',
    'promotionInfo','adSource','advInfo','adMaterial','adWord',
    'adData','advertInfo','advertisement','sponsorInfo',
    'floatInfo','popupInfo','redPacketInfo','couponInfo',
    'activityInfo','gameInfo','lotteryInfo','signInfo'
  ];
  for (var i = 0; i < explicitAdKeys.length; i++) {
    var k = explicitAdKeys[i];
    if (o[k] !== undefined) {
      if (k === 'isAd') { if (o[k] === true || o[k] === 1 || o[k] === '1') return true; }
      else if (['adType','adId','adCode','adSource','advInfo','adMaterial','adWord'].indexOf(k) >= 0) return true;
      else if (o[k] && typeof o[k] === 'object') return true;
      else if (typeof o[k] === 'string' && o[k].length > 0) return true;
    }
  }

  var hasProductCore = !!(
    o.skuId || o.wareId || o.wareInfo || o.productName ||
    o.priceInfo || o.price || o.imageUrl || o.imgUrl ||
    o.picUrl || o.imageList || o.materialUrl || o.skuName
  );
  if (!hasProductCore) {
    var markerFields = ['templateId','template','floorId','type','style',
                         'subType','bizType','expParam','skuType',
                         'scene','modType','showType','name','title'];
    var adWords = /(^|[^a-z])(ad|advert|promotion|recommend|rec|coupon|activity|act|game|lottery|lucky|float|banner|redpacket|redpack|signin|sign|popup|pop|marketing|vip|plus|adver|每日必领|签到|领京豆|赚红包|互动游戏|刮刮乐|潮流好货)/i;
    for (var f = 0; f < markerFields.length; f++) {
      var v = o[markerFields[f]];
      if (typeof v === 'string' && adWords.test(v)) return true;
      if (typeof v === 'number' && adWords.test(String(v))) return true;
    }
  }

  if (o.expParam && typeof o.expParam === 'string') {
    if (/(^|[^a-z])(ad|advert|promotion|marketing|float|popup|redpacket)/.test(o.expParam.toLowerCase())) return true;
  }

  return false;
}

/* ──── 递归遍历清除 ──── */
function stripAds(node) {
  if (Array.isArray(node)) {
    for (var i = node.length - 1; i >= 0; i--) {
      var item = node[i];
      if (isAdLike(item)) {
        node.splice(i, 1);
      } else if (item && typeof item === 'object') {
        stripAds(item);
      }
    }
  } else if (node && typeof node === 'object') {
    for (var k in node) {
      if (!node.hasOwnProperty(k)) continue;
      var v = node[k];
      if (Array.isArray(v)) stripAds(v);
      else if (v && typeof v === 'object') stripAds(v);
    }
  }
}

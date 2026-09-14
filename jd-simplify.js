/*
 * 京东首页 & 我的页 精简脚本 (Loon http-response)
 * 目标：① 关闭首页「猜你喜欢/为你推荐」信息流 ② 去除首页广告/营销卡片 ③ 精简「我的」页推广入口
 * 依赖：Loon 已开启 MITM 并信任证书，且 api.m.jd.com 已在 MITM 主机名列表。
 */

(function () {
  try {
    let body = $response.body;
    if (body == null) { $done({}); return; }
    // Loon 可能直接给字符串，也可能给已解析对象，统一转成对象
    let obj;
    if (typeof body === 'string') {
      try { obj = JSON.parse(body); } catch (e) { $done({ body }); return; }
    } else {
      obj = body;
    }
    if (!obj || typeof obj !== 'object') { $done({ body }); return; }

    simplify(obj);

    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    $done({});
  }
})();

function simplify(obj) {
  const data = obj && obj.data;

  // 1) basicConfig：关闭首页推荐流聚合（猜你喜欢/为你推荐）
  if (data && data.TNUnionFetch) {
    const t = data.TNUnionFetch;
    if (t.recommend && t.recommend.enable !== undefined) t.recommend.enable = 0;
    // 我的页内的推荐聚合（如存在，保守关闭）
    if (t.jdmine && t.jdmine.enable !== undefined) t.jdmine.enable = 0;
  }

  // 2) 关闭常见广告/营销聚合开关（basicConfig 内的模块级开关）
  const advKeys = ['JDAD', 'JDAdsCore', 'JDUniformRecommend', 'JDWidgetManager', 'JDMarket'];
  if (data) {
    for (const k of advKeys) {
      const v = data[k];
      if (v && typeof v === 'object') {
        for (const sk of Object.keys(v)) {
          const sv = v[sk];
          if (sv && typeof sv === 'object' && 'enable' in sv && sv.enable !== 0) sv.enable = 0;
          else if (sv && typeof sv === 'object' && 'value' in sv && sv.value !== '0' && sv.value !== 0) sv.value = '0';
        }
      }
    }
  }

  // 3) 通用递归：清除明确的广告/推广对象
  stripAds(obj);
}

/* 判定一个对象是否为广告/推广 */
function isAdLike(o) {
  if (!o || typeof o !== 'object') return false;

  // 3.1 明确的广告标识字段（正常商品不会携带）
  const explicitAdKeys = ['adInfo', 'adExtInfo', 'adTrack', 'isAd', 'adType', 'adId', 'adCode', 'promotionInfo', 'adSource', 'advInfo', 'adMaterial', 'adWord', 'adData', 'advertInfo', 'advertisement', 'sponsorInfo', 'floatInfo', 'popupInfo', 'redPacketInfo', 'couponInfo', 'activityInfo', 'gameInfo', 'lotteryInfo'];
  for (const k of explicitAdKeys) {
    if (o[k] !== undefined) {
      if (k === 'isAd') { if (o.isAd === true || o.isAd === 1 || o.isAd === '1') return true; }
      else if (['adType', 'adId', 'adCode', 'adSource', 'advInfo', 'adMaterial', 'adWord'].includes(k)) return true;
      else if (o[k] && typeof o[k] === 'object') return true;
      else if (typeof o[k] === 'string' && o[k].length > 0) return true;
    }
  }

  // 3.2 通过模板/楼层/类型字段匹配强广告关键词，且缺乏正常商品核心字段
  const hasProductCore = !!(o.skuId || o.wareId || o.wareInfo || o.productName || o.priceInfo || o.price || o.imageUrl || o.imgUrl || o.picUrl || o.imageList || o.materialUrl || o.skuName);
  if (!hasProductCore) {
    const markerFields = ['templateId', 'template', 'floorId', 'type', 'style', 'subType', 'bizType', 'expParam', 'skuType', 'scene', 'modType', 'showType'];
    const adWords = /(^|[^a-z])(ad|advert|promotion|recommend|rec|coupon|activity|act|game|lottery|lucky|float|banner|redpacket|redpack|signin|sign|popup|pop|marketing|vip|plus|adver)/i;
    for (const f of markerFields) {
      const v = o[f];
      if (typeof v === 'string' && adWords.test(v)) return true;
      if (typeof v === 'number' && adWords.test(String(v))) return true;
    }
  }

  // 3.3 标记字段命中（expParam 含 ad/promotion 等）
  if (o.expParam && typeof o.expParam === 'string') {
    const ex = o.expParam.toLowerCase();
    if (/(^|[^a-z])(ad|advert|promotion|marketing|float|popup|redpacket)/.test(ex)) return true;
  }
  return false;
}

/* 递归遍历：对数组移除广告项，对对象继续深入 */
function stripAds(node) {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const item = node[i];
      if (isAdLike(item)) {
        node.splice(i, 1);
      } else if (item && typeof item === 'object') {
        stripAds(item);
      }
    }
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) stripAds(v);
      else if (v && typeof v === 'object') stripAds(v);
    }
  }
}

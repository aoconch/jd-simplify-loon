/*
 * 京东首页 & 我的页 精简脚本 (Loon http-response)
 * 作用：拦截京东 App 的配置与信息流接口，移除广告/推广/营销模块，精简首页与「我的」页。
 * 原理：基于捕获的 basicConfig 逆向，并结合通用广告字段递归过滤。
 */

(function () {
  try {
    let body = $response.body;
    if (body == null) { $done({}); return; }
    if (typeof body !== 'string') body = JSON.stringify(body);

    let obj;
    try { obj = JSON.parse(body); } catch (e) { $done({ body }); return; }
    if (!obj || typeof obj !== 'object') { $done({ body }); return; }

    simplify(obj);

    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    // 任何异常都原样返回，保证 App 正常
    $done({});
  }
})();

function simplify(obj) {
  // 1) basicConfig 定向精简：关闭首页「为你推荐 / 猜你喜欢」信息流
  if (obj && obj.data && obj.data.TNUnionFetch) {
    const t = obj.data.TNUnionFetch;
    if (t.recommend && t.recommend.enable !== undefined) {
      t.recommend.enable = 0;            // 首页推荐流开关 -> 关
    }
    if (t.jdmine && t.jdmine.enable !== undefined) {
      // 保留「我的」页主体，仅关闭其内的推荐聚合（如有）
      // t.jdmine.enable = 0; // 如需彻底关闭可取消注释，但会清空「我的」页，不建议
    }
  }

  // 2) 通用递归：清除明确的广告/推广对象
  stripAds(obj);
}

/* 判定一个对象是否为广告/推广 */
function isAdLike(o) {
  if (!o || typeof o !== 'object') return false;

  // 2.1 明确的广告标识字段（正常商品不会携带）
  const explicitAdKeys = ['adInfo', 'adExtInfo', 'adTrack', 'isAd', 'adType', 'adId', 'adCode', 'promotionInfo', 'adSource', 'advInfo', 'adMaterial'];
  for (const k of explicitAdKeys) {
    if (o[k] !== undefined) {
      if (k === 'isAd') { if (o.isAd === true || o.isAd === 1 || o.isAd === '1') return true; }
      else if (k === 'adType' || k === 'adId' || k === 'adCode' || k === 'adSource' || k === 'advInfo' || k === 'adMaterial') return true;
      else if (o[k] && typeof o[k] === 'object') return true;       // adInfo / adExtInfo / adTrack / promotionInfo 等对象
      else if (typeof o[k] === 'string' && o[k].length > 0) return true;
    }
  }

  // 2.2 通过模板/楼层/类型字段匹配强广告关键词，且对象缺乏正常商品核心字段
  const hasProductCore = !!(o.skuId || o.wareId || o.wareInfo || o.productName || o.priceInfo || o.price || o.imageUrl || o.imgUrl || o.picUrl || o.imageList);
  if (!hasProductCore) {
    const markerFields = ['templateId', 'template', 'floorId', 'type', 'style', 'subType', 'bizType', 'expParam', 'skuType', 'scene'];
    const adWords = /(^|[^a-z])(ad|advert|promotion|recommend|rec|coupon|activity|act|game|lottery|lucky|float|banner|redpacket|redpack|signin|sign|popup|pop|marketing|vip|plus)/i;
    for (const f of markerFields) {
      const v = o[f];
      if (typeof v === 'string' && adWords.test(v)) return true;
    }
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

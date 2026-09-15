# -*- coding: utf-8 -*-
import sys, re, json
sys.path.insert(0, '.')
import har

path = sys.argv[1]
kws = sys.argv[2:] or ['cart','Cart','message','msg','榜单','来看看','recommend']
h = har.load(path)
for e in har.entries(h):
    u = har.url_of(e)
    host = har.host_of(e)
    # 跳过纯图片/视频 CDN 的 URL 匹配（但保留 body 扫描）
    hay = u
    try:
        pd = e['request'].get('postData', {})
        if pd.get('text'):
            hay += '\n<<POST>>' + pd['text'][:3000]
    except Exception:
        pass
    hits = [k for k in kws if k in hay]
    if hits:
        print("---", hits)
        print("  [%s] %s %s" % (har.started_of(e)[11:19], har.status_of(e), u[:180]))

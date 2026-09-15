# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '.')
import har

path = sys.argv[1]
h = har.load(path)
for e in har.entries(h):
    u = har.url_of(e)
    host = har.host_of(e)
    if 'raw.githubusercontent' in host or 'loon.103516' in host or 'jsdelivr' in host:
        print("=== 脚本拉取 ===")
        print("URL:", u)
        print("status:", har.status_of(e), "size:", har.size_of(e))
        b = har.body_of(e)
        print("body[:300]:", repr(b[:300]))
        print()
    if host == 'pro.m.jd.com':
        b = har.body_of(e)
        print("=== 首页 HTML ===")
        print("URL:", u[:160])
        print("status:", har.status_of(e), "len:", len(b))
        print("INJECTED:", 'JD-SIMPLIFY-INJECTED' in b)
        import re
        m = re.search(r"__JD_SIMPLIFY__\s*=\s*['\"]([^'\"]+)", b)
        print("version:", m.group(1) if m else None)
        print("ifloors/ 出现次数:", b.count('ifloors/'))
        print("ifloors-disabled/ 次数:", b.count('ifloors-disabled/'))
        print()

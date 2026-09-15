# -*- coding: utf-8 -*-
import sys, collections
sys.path.insert(0, '.')
import har

path = sys.argv[1]
h = har.load(path)
es = har.entries(h)
print("总请求数:", len(es))
t0, t1, n = har.time_range(h)
print("时间跨度:", t0, "->", t1)
print()
cnt = collections.Counter()
siz = collections.Counter()
for e in es:
    host = har.host_of(e)
    cnt[host] += 1
    siz[host] += har.size_of(e)
print("%-40s %6s %10s" % ("HOST", "次数", "响应字节"))
for host, c in cnt.most_common(50):
    print("%-40s %6d %10d" % (host, c, siz[host]))

# -*- coding: utf-8 -*-
import sys, re, collections
sys.path.insert(0, '.')
import har

path = sys.argv[1]
h = har.load(path)
# 每 5 秒一桶，统计 host
buckets = collections.OrderedDict()
for e in har.entries(h):
    t = har.started_of(e)[11:19]
    if not t: continue
    hms = t.split(':')
    sec = int(hms[0])*3600 + int(hms[1])*60 + int(hms[2])
    b = sec - sec % 5
    buckets.setdefault(b, collections.Counter())[har.host_of(e)] += 1
for b in sorted(buckets):
    hh = b//3600; mm=(b%3600)//60; ss=b%60
    top = ', '.join('%s:%d' % (k,v) for k,v in buckets[b].most_common(6))
    print("%02d:%02d:%02d  %s" % (hh,mm,ss, top))

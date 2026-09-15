# -*- coding: utf-8 -*-
import sys, re
sys.path.insert(0, '.')
import har

path = sys.argv[1]
h = har.load(path)
print("%-6s %-9s %8s  %s" % ("时间","状态","字节","URL(截断)"))
for e in har.entries(h):
    host = har.host_of(e)
    if host not in ('api.m.jd.com','ccfjma.m.jd.com','ccflbs.m.jd.com','storage.360buyimg.com','storage11.360buyimg.com','storage23.360buyimg.com','apk.360buyimg.com','whatshub.top','policy.jd.com','device-security-url.jd.com'):
        continue
    u = har.url_of(e)
    t = har.started_of(e)[11:23]
    print("%-6s %-9s %8d  %s" % (t, har.status_of(e), har.size_of(e), u[:150]))

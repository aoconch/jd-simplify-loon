#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HAR 分析公共库：统一处理 base64 / 转义，供各分析脚本复用。"""
import base64
import json
import re
import sys
from urllib.parse import urlparse


def load(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return json.load(f)


def body_of(entry):
    """返回响应体的 str（已处理 base64），失败返回 ''。"""
    try:
        c = entry["response"]["content"]
    except Exception:
        return ""
    text = c.get("text")
    if not text:
        return ""
    if c.get("encoding") == "base64":
        try:
            return base64.b64decode(text).decode("utf-8", errors="replace")
        except Exception:
            return ""
    return text


def body_bytes(entry):
    try:
        c = entry["response"]["content"]
    except Exception:
        return b""
    text = c.get("text")
    if not text:
        return b""
    if c.get("encoding") == "base64":
        try:
            return base64.b64decode(text)
        except Exception:
            return b""
    return text.encode("utf-8", errors="replace")


def entries(har):
    return har.get("log", {}).get("entries", [])


def url_of(entry):
    return entry.get("request", {}).get("url", "")


def host_of(entry):
    return urlparse(url_of(entry)).hostname or ""


def status_of(entry):
    return entry.get("response", {}).get("status", 0)


def size_of(entry):
    try:
        return entry["response"]["content"].get("size", 0) or 0
    except Exception:
        return 0


def ctype_of(entry):
    try:
        return entry["response"]["content"].get("mimeType", "")
    except Exception:
        return ""


def started_of(entry):
    return entry.get("startedDateTime", "")


def iter_all(har):
    for e in entries(har):
        yield e


def time_range(har):
    ts = [started_of(e) for e in entries(har) if started_of(e)]
    ts.sort()
    return (ts[0], ts[-1], len(ts)) if ts else ("", "", 0)

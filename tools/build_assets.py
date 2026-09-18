#!/usr/bin/env python3
"""素材与静态站构建脚本。

职责（单一数据源原则）：
1. 以仓库根目录 songs.json 为曲目唯一数据源，生成前端数据文件 builtin_songs.js；
2. 把 static/ 下的 js/css/images/screenshots/audio 同步到 docs/static/；
3. 把 templates/*.html 转换为 docs/*.html（把 Flask 的 url_for 替换为静态相对路径）。

用法：
  python3 tools/build_assets.py            # 生成 + 同步
  python3 tools/build_assets.py --check    # 只检查是否已同步（供 CI 使用，有差异则退出码 1）
  python3 tools/build_assets.py --full     # 强制重拷所有素材（含音频）
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

STATIC_DIR = os.path.join(ROOT, 'static')
DOCS_DIR = os.path.join(ROOT, 'docs')
TEMPLATES_DIR = os.path.join(ROOT, 'templates')

# 同步到 docs/static 的子目录
SYNC_SUBDIRS = ['js', 'css', 'images', 'screenshots', 'audio', 'vendor']
# 体积较大的目录：默认仅在缺失或大小变化时按大小比较
LARGE_SUBDIRS = {'audio'}

GENERATED_HEADER = (
    '// 本文件由 tools/build_assets.py 从 songs.json 自动生成，请勿手工修改。\n'
    '// 曲目唯一数据源：仓库根目录 songs.json\n'
)

JINJA_STATIC = re.compile(
    r"\{\{\s*url_for\(\s*['\"]static['\"]\s*,\s*filename\s*=\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}"
)
JINJA_ROUTE = re.compile(r"\{\{\s*url_for\(\s*['\"]([A-Za-z_][A-Za-z0-9_]*)['\"]\s*\)\s*\}\}")


def load_songs():
    with open(os.path.join(ROOT, 'songs.json'), encoding='utf-8') as f:
        return json.load(f)


def render_builtin_songs_js(songs):
    payload = json.dumps(songs, ensure_ascii=False, indent=2)
    return GENERATED_HEADER + 'window.BUILTIN_SONGS_DATA = ' + payload + ';\n'


def render_docs_html(html):
    """把 Flask 模板转换为可静态部署的 HTML。"""
    html = JINJA_STATIC.sub(lambda m: 'static/' + m.group(1), html)
    html = JINJA_ROUTE.sub(
        lambda m: 'index.html' if m.group(1) == 'index' else m.group(1) + '.html', html
    )
    return html


def write_text(path, text, check, changed):
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            if f.read() == text:
                return
    if check:
        changed.append(path)
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    changed.append(path)


def sync_file(src, dst, check, changed, large=False, force=False):
    if force or not os.path.exists(dst):
        pass
    else:
        src_size = os.path.getsize(src)
        dst_size = os.path.getsize(dst)
        if large:
            if src_size == dst_size:
                return
        else:
            with open(src, 'rb') as a, open(dst, 'rb') as b:
                if a.read() == b.read():
                    return
    if check:
        changed.append(dst)
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(src, 'rb') as a, open(dst, 'wb') as b:
        b.write(a.read())
    changed.append(dst)


def build(check=False, force=False):
    changed = []
    songs = load_songs()

    # 1. 生成前端曲目数据（后端也读取同一份 songs.json）
    js_text = render_builtin_songs_js(songs)
    write_text(os.path.join(STATIC_DIR, 'js', 'builtin_songs.js'), js_text, check, changed)
    write_text(os.path.join(DOCS_DIR, 'static', 'js', 'builtin_songs.js'), js_text, check, changed)

    # 2. 同步静态资源
    for sub in SYNC_SUBDIRS:
        src_root = os.path.join(STATIC_DIR, sub)
        if not os.path.isdir(src_root):
            continue
        for dirpath, _dirnames, filenames in os.walk(src_root):
            for name in filenames:
                src = os.path.join(dirpath, name)
                rel = os.path.relpath(src, STATIC_DIR)
                dst = os.path.join(DOCS_DIR, 'static', rel)
                sync_file(src, dst, check, changed,
                          large=(sub in LARGE_SUBDIRS), force=force)

    # 3. 模板 -> 静态 HTML
    for name in sorted(os.listdir(TEMPLATES_DIR)):
        if not name.endswith('.html'):
            continue
        with open(os.path.join(TEMPLATES_DIR, name), encoding='utf-8') as f:
            html = render_docs_html(f.read())
        write_text(os.path.join(DOCS_DIR, name), html, check, changed)

    return changed


def main():
    parser = argparse.ArgumentParser(description='生成前端曲目数据并同步 docs/ 静态站')
    parser.add_argument('--check', action='store_true', help='只检查是否有未同步的差异')
    parser.add_argument('--full', action='store_true', help='强制重拷全部素材')
    args = parser.parse_args()

    changed = build(check=args.check, force=args.full)
    if args.check:
        if changed:
            print('以下文件未同步（请运行 python3 tools/build_assets.py）：')
            for path in changed:
                print('  ' + os.path.relpath(path, ROOT))
            return 1
        print('docs/ 与 songs.json 已同步')
        return 0

    if changed:
        print('已同步 %d 个文件：' % len(changed))
        for path in changed:
            print('  ' + os.path.relpath(path, ROOT))
    else:
        print('无需更新，已是最新')
    return 0


if __name__ == '__main__':
    sys.exit(main())

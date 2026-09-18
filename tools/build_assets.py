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
import hashlib
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


def file_sha1(path, chunk_size=1 << 20):
    digest = hashlib.sha1()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(chunk_size), b''):
            digest.update(chunk)
    return digest.hexdigest()


def files_equal(a, b):
    """按内容比较（含体积与 sha1），避免“同大小不同内容”被漏判。"""
    if os.path.getsize(a) != os.path.getsize(b):
        return False
    return file_sha1(a) == file_sha1(b)


def sync_file(src, dst, check, changed, force=False):
    if not force and os.path.exists(dst) and files_equal(src, dst):
        return
    if check:
        changed.append(dst)
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(src, 'rb') as a, open(dst, 'wb') as b:
        b.write(a.read())
    changed.append(dst)


def prune(check, changed):
    """删除 docs/ 中源文件已不存在的产物（含已删除的音频与模板）。

    只清理 SYNC_SUBDIRS 下的文件与 docs/*.html，保持 docs/ 与源严格一致。
    """
    docs_static = os.path.join(DOCS_DIR, 'static')
    for sub in SYNC_SUBDIRS:
        dst_root = os.path.join(docs_static, sub)
        if not os.path.isdir(dst_root):
            continue
        for dirpath, _dirnames, filenames in os.walk(dst_root):
            for name in filenames:
                dst = os.path.join(dirpath, name)
                rel = os.path.relpath(dst, docs_static)
                src = os.path.join(STATIC_DIR, rel)
                if os.path.exists(src):
                    continue
                if check:
                    changed.append(dst)
                else:
                    os.remove(dst)
                    changed.append(dst)

    valid_templates = {n for n in os.listdir(TEMPLATES_DIR) if n.endswith('.html')}
    for name in os.listdir(DOCS_DIR):
        if not name.endswith('.html') or name in valid_templates:
            continue
        path = os.path.join(DOCS_DIR, name)
        if check:
            changed.append(path)
        else:
            os.remove(path)
            changed.append(path)


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
                sync_file(src, dst, check, changed, force=force)

    # 3. 模板 -> 静态 HTML
    for name in sorted(os.listdir(TEMPLATES_DIR)):
        if not name.endswith('.html'):
            continue
        with open(os.path.join(TEMPLATES_DIR, name), encoding='utf-8') as f:
            html = render_docs_html(f.read())
        write_text(os.path.join(DOCS_DIR, name), html, check, changed)

    # 4. 清理源文件已删除的产物
    prune(check, changed)

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

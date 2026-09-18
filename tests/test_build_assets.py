"""songs.json 单一数据源与 docs/ 构建一致性测试。"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))

import build_assets  # noqa: E402


def load_songs():
    with open(os.path.join(ROOT, 'songs.json'), encoding='utf-8') as f:
        return json.load(f)


def test_songs_json_is_valid_list():
    songs = load_songs()
    assert isinstance(songs, list)
    assert len(songs) >= 20
    for song in songs:
        assert song['title']
        assert song['jianpu']
        assert song.get('key')


def test_songs_json_ids_are_unique():
    songs = load_songs()
    ids = [song.get('id') for song in songs]
    assert all(i is not None for i in ids), 'songs.json 存在缺少 id 的曲目'
    assert len(ids) == len(set(ids)), 'songs.json 存在重复 id'

    allowed_ts = {'2/4', '3/4', '4/4', '6/8', '9/8', '12/8'}
    for song in songs:
        if song.get('time_signature'):
            assert song['time_signature'] in allowed_ts, '不支持的拍号: %s' % song['time_signature']
        if song.get('tempo') is not None:
            assert 20 <= song['tempo'] <= 300, 'tempo 越界: %s' % song['tempo']


def test_generated_builtin_songs_matches_songs_json():
    songs = load_songs()
    expected = build_assets.render_builtin_songs_js(songs)
    with open(os.path.join(ROOT, 'static', 'js', 'builtin_songs.js'), encoding='utf-8') as f:
        assert f.read() == expected


def test_docs_is_in_sync():
    """docs/ 必须与 templates/static 完全同步（否则说明忘了跑构建脚本）。"""
    changed = build_assets.build(check=True)
    assert changed == [], 'docs/ 未同步，请运行 python3 tools/build_assets.py'


def test_docs_html_has_no_jinja_leftovers():
    for name in os.listdir(os.path.join(ROOT, 'docs')):
        if not name.endswith('.html'):
            continue
        with open(os.path.join(ROOT, 'docs', name), encoding='utf-8') as f:
            content = f.read()
        assert '{{' not in content and '{%' not in content, '%s 仍残留 Jinja 语法' % name

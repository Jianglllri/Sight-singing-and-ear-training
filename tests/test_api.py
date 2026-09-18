"""后端 API 边界、校验与持久化策略测试。"""
import json

BIG_JIANPU = '1' * 1_000_000


def test_songs_from_songs_json(client):
    res = client.get('/api/jianpu/songs')
    assert res.status_code == 200
    songs = res.get_json()['songs']
    builtins = [s for s in songs if s['is_builtin']]
    assert len(builtins) >= 20


def test_post_non_object_json(client):
    res = client.post('/api/jianpu/songs', json=[1, 2, 3])
    assert res.status_code == 400


def test_post_title_must_be_string(client):
    res = client.post('/api/jianpu/songs', json={'title': 123, 'jianpu': '1 2 3'})
    assert res.status_code == 400


def test_post_oversized_jianpu_rejected(client):
    res = client.post('/api/jianpu/songs', json={'title': 'x', 'jianpu': BIG_JIANPU})
    assert res.status_code == 400


def test_post_invalid_key(client):
    res = client.post('/api/jianpu/songs', json={'title': 'a', 'jianpu': '1', 'key': 'H'})
    assert res.status_code == 400


def test_post_invalid_tempo(client):
    res = client.post('/api/jianpu/songs', json={'title': 'a', 'jianpu': '1', 'tempo': 999})
    assert res.status_code == 400


def test_post_invalid_time_signature(client):
    res = client.post('/api/jianpu/songs', json={'title': 'a', 'jianpu': '1', 'time_signature': '4-4'})
    assert res.status_code == 400


def test_custom_song_crud(client):
    res = client.post('/api/jianpu/songs', json={
        'title': '测试曲', 'jianpu': '1 2 3', 'key': 'D', 'tempo': 100, 'time_signature': '3/4'
    })
    assert res.status_code == 201
    song_id = res.get_json()['song']['id']

    res = client.put('/api/jianpu/songs/%d' % song_id, json={'jianpu': '1 2 3 4'})
    assert res.status_code == 200

    res = client.delete('/api/jianpu/songs/%d' % song_id)
    assert res.status_code == 200


def test_builtin_song_is_read_only(client):
    songs = client.get('/api/jianpu/songs').get_json()['songs']
    builtin_id = next(s['id'] for s in songs if s['is_builtin'])

    assert client.put('/api/jianpu/songs/%d' % builtin_id, json={'jianpu': '1 1 1'}).status_code == 403
    assert client.delete('/api/jianpu/songs/%d' % builtin_id).status_code == 403


def test_request_too_large(client):
    res = client.post('/api/jianpu/songs', data=b'x' * (11 * 1024 * 1024),
                      content_type='application/json')
    assert res.status_code == 413


def test_ocr_requires_file(client):
    assert client.post('/api/ocr_jianpu').status_code == 400


def test_builtin_seed_once_keeps_user_edits(client, app_module):
    """重启（再次 init_db）后不能覆盖已有内置记录。"""
    import sqlite3
    songs = client.get('/api/jianpu/songs').get_json()['songs']
    builtin_id = next(s['id'] for s in songs if s['is_builtin'])

    conn = sqlite3.connect(app_module.DATABASE_PATH)
    conn.execute("UPDATE songs SET jianpu = 'CHANGED_BY_USER' WHERE id = ?", (builtin_id,))
    conn.commit()
    conn.close()

    app_module.init_db()  # 模拟重启

    conn = sqlite3.connect(app_module.DATABASE_PATH)
    value = conn.execute('SELECT jianpu FROM songs WHERE id = ?', (builtin_id,)).fetchone()[0]
    conn.close()
    assert value == 'CHANGED_BY_USER'


def test_ocr_keeps_underscore_for_note_duration(app_module):
    """OCR 后处理必须保留减时线（_ 表示八分/十六分音符时值）。"""
    text, _key = app_module.extract_jianpu_text('1_ 2_ 3__ 4 | 5 6')
    assert '1_' in text
    assert '_' in text


def test_normalize_keeps_underscore(app_module):
    normalized = app_module.normalize_jianpu_chars('1_ 5__')
    assert normalized.count('_') == 3

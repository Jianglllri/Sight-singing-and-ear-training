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


def _png_bytes():
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (2, 2), (255, 0, 0)).save(buf, format='PNG')
    return buf.getvalue()


def test_builtin_songs_expose_static_image_and_source_id(client):
    """全新数据库也应能看到内置静态谱图路径（不把图片重复存进 SQLite）。"""
    songs = client.get('/api/jianpu/songs').get_json()['songs']
    builtins = [s for s in songs if s['is_builtin']]
    with_static = [s for s in builtins if s.get('static_image')]

    assert len(with_static) >= 10, '内置静态谱图数量不足: %d' % len(with_static)
    assert all(s.get('source_id') for s in builtins), '内置曲目缺失 source_id'

    sample = with_static[0]
    assert sample['has_image'] is False          # 未把图片写入 SQLite
    assert sample['static_image'].endswith('.png')


def test_put_preserves_unspecified_metadata(client):
    """只改简谱时，调号/拍号/速度必须保留（问题1）。"""
    res = client.post('/api/jianpu/songs', json={
        'title': '元数据保留', 'jianpu': '1 2 3', 'key': 'D', 'time_signature': '3/4', 'tempo': 100
    })
    assert res.status_code == 201
    song_id = res.get_json()['song']['id']

    res = client.put('/api/jianpu/songs/%d' % song_id, json={'jianpu': '1 2 3 4'})
    assert res.status_code == 200
    song = res.get_json()['song']
    assert (song['key'], song['time_signature'], song['tempo']) == ('D', '3/4', 100)
    assert song['jianpu'] == '1 2 3 4'

    client.delete('/api/jianpu/songs/%d' % song_id)


def test_put_can_update_metadata_explicitly(client):
    res = client.post('/api/jianpu/songs', json={'title': '改元数据', 'jianpu': '1', 'key': 'C'})
    song_id = res.get_json()['song']['id']
    res = client.put('/api/jianpu/songs/%d' % song_id,
                     json={'key': 'G', 'time_signature': '6/8', 'tempo': 120})
    song = res.get_json()['song']
    assert (song['key'], song['time_signature'], song['tempo']) == ('G', '6/8', 120)
    client.delete('/api/jianpu/songs/%d' % song_id)


def test_write_endpoints_require_no_token(client):
    """应用层不再强制管理员 token（写保护交由反向代理），默认写接口可直接使用。"""
    res = client.post('/api/jianpu/songs', json={'title': '无 token 写入', 'jianpu': '1 2'})
    assert res.status_code == 201
    client.delete('/api/jianpu/songs/%d' % res.get_json()['song']['id'])


def test_builtin_image_is_read_only(client):
    """内置曲目的图片上传/删除也必须被拒绝（问题4）。"""
    songs = client.get('/api/jianpu/songs').get_json()['songs']
    builtin_id = next(s['id'] for s in songs if s['is_builtin'])

    res = client.put('/api/jianpu/songs/%d/image' % builtin_id,
                     data={'image': (__import__('io').BytesIO(_png_bytes()), 'x.png', 'image/png')},
                     content_type='multipart/form-data')
    assert res.status_code == 403

    assert client.delete('/api/jianpu/songs/%d/image' % builtin_id).status_code == 403


def test_custom_song_image_upload_and_delete(client):
    import io
    res = client.post('/api/jianpu/songs', json={'title': '带图曲目', 'jianpu': '1 2'})
    song_id = res.get_json()['song']['id']

    res = client.put('/api/jianpu/songs/%d/image' % song_id,
                     data={'image': (io.BytesIO(_png_bytes()), 'x.png', 'image/png')},
                     content_type='multipart/form-data')
    assert res.status_code == 200
    assert client.get('/api/jianpu/songs/%d/image' % song_id).status_code == 200
    assert client.delete('/api/jianpu/songs/%d/image' % song_id).status_code == 200
    client.delete('/api/jianpu/songs/%d' % song_id)


def test_put_without_fields_is_rejected(client):
    res = client.post('/api/jianpu/songs', json={'title': '空更新', 'jianpu': '1'})
    song_id = res.get_json()['song']['id']
    assert client.put('/api/jianpu/songs/%d' % song_id, json={}).status_code == 400
    client.delete('/api/jianpu/songs/%d' % song_id)


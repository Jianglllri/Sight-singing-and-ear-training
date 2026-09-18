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


def test_invalid_time_signatures_rejected(client):
    """只校验格式是不够的：00/00、99/99、3/0、7/8 都必须被拒绝。"""
    for ts in ['00/00', '99/99', '3/0', '7/8', '4-4']:
        res = client.post('/api/jianpu/songs', json={'title': 'ts', 'jianpu': '1', 'time_signature': ts})
        assert res.status_code == 400, '非法拍号未被拒绝: %s' % ts


def test_valid_time_signature_accepted(client):
    for ts in ['2/4', '4/4', '6/8', '12/8']:
        res = client.post('/api/jianpu/songs', json={'title': 'ts', 'jianpu': '1', 'time_signature': ts})
        assert res.status_code == 201, ts
        client.delete('/api/jianpu/songs/%d' % res.get_json()['song']['id'])


def test_songs_json_ids_unique(app_module):
    assert app_module.find_duplicate_source_ids(app_module.BUILTIN_SONGS) == []


def test_source_id_unique_index_exists(app_module):
    import sqlite3
    conn = sqlite3.connect(app_module.DATABASE_PATH)
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_songs_source_id'"
    ).fetchone()
    conn.close()
    assert row is not None


def test_builtin_migration_updates_title_and_soft_deletes(client, app_module):
    """songs.json 改名/移除时：标题同步更新，被移除的曲目软删除且 API 不再返回。"""
    import copy
    import sqlite3

    original_songs = app_module.BUILTIN_SONGS
    original_version = app_module.BUILTIN_DATA_VERSION
    try:
        modified = copy.deepcopy(original_songs)
        renamed_id = modified[0]['id']
        removed_id = modified[1]['id']
        modified[0]['title'] = 'RENAMED_IN_SOURCE'
        modified = [s for s in modified if s['id'] != removed_id]

        app_module.BUILTIN_SONGS = modified
        app_module.BUILTIN_DATA_VERSION = app_module.compute_data_version(modified)
        app_module.init_db()

        conn = sqlite3.connect(app_module.DATABASE_PATH)
        title = conn.execute('SELECT title FROM songs WHERE source_id = ?', (renamed_id,)).fetchone()[0]
        active = conn.execute('SELECT is_active FROM songs WHERE source_id = ?', (removed_id,)).fetchone()[0]
        conn.close()
        assert title == 'RENAMED_IN_SOURCE'
        assert active == 0

        served = [s['source_id'] for s in client.get('/api/jianpu/songs').get_json()['songs']]
        assert removed_id not in served
        assert renamed_id in served
    finally:
        # 恢复原始数据，避免影响其它测试
        app_module.BUILTIN_SONGS = original_songs
        app_module.BUILTIN_DATA_VERSION = original_version
        app_module.init_db()

    conn = sqlite3.connect(app_module.DATABASE_PATH)
    restored = conn.execute(
        'SELECT title, is_active FROM songs WHERE source_id = ?', (original_songs[0]['id'],)
    ).fetchone()
    conn.close()
    assert restored[0] == original_songs[0]['title']
    assert restored[1] == 1



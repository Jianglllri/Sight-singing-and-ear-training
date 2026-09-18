"""听音训练 Flask 后端。

安全说明（公开部署）：
    本应用默认按“单用户 / 内网”场景设计，写接口不做应用层鉴权。
    若需暴露到公网，请通过反向代理（Nginx/Caddy 等）配置认证（Basic Auth / OAuth 等）
    或限制访问来源，不要依赖应用自身的鉴权。
"""
import hashlib
import io
import json
import os
import re
import shutil
import sqlite3

from flask import Flask, render_template, request, jsonify, send_file

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# OCR 依赖为可选：未安装时接口返回明确提示，不影响其它功能
try:
    import pytesseract
    OCR_AVAILABLE = PIL_AVAILABLE and shutil.which('tesseract') is not None
except ImportError:
    OCR_AVAILABLE = False

app = Flask(__name__)

# 请求体上限：JSON / 图片 / OCR 均受此约束，超出由 Flask 直接返回 413
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

# ==================== 内置曲库：唯一数据源 songs.json ====================
SONGS_JSON_PATH = os.path.join(os.path.dirname(__file__), 'songs.json')


def load_builtin_songs():
    """从 songs.json 读取内置曲目；文件缺失或损坏时返回空列表并告警。"""
    try:
        with open(SONGS_JSON_PATH, encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        app.logger.warning('songs.json 结构应为数组，已忽略')
    except (OSError, ValueError) as exc:
        app.logger.warning('无法读取 songs.json：%s', exc)
    return []


BUILTIN_SONGS = load_builtin_songs()


def compute_data_version(songs):
    """用 songs.json 内容哈希作为内置曲库数据版本，用于判断是否需要迁移。"""
    payload = json.dumps(songs, sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(payload.encode('utf-8')).hexdigest()[:12]


BUILTIN_DATA_VERSION = compute_data_version(BUILTIN_SONGS)

# ==================== 简谱持久化曲库数据库（SQLite） ====================
# 用户数据库放在 instance/ 下并加入 .gitignore；首次启动时按 songs.json 播种。
INSTANCE_DIR = os.path.join(os.path.dirname(__file__), 'instance')
os.makedirs(INSTANCE_DIR, exist_ok=True)
DATABASE_PATH = os.environ.get('JIANPU_DB_PATH') or os.path.join(INSTANCE_DIR, 'jianpu_library.db')

# 兼容旧版本：数据库曾放在仓库根目录，若存在则迁移到 instance/，避免用户数据丢失
LEGACY_DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'jianpu_library.db')
if not os.path.exists(DATABASE_PATH) and os.path.exists(LEGACY_DATABASE_PATH):
    shutil.copy2(LEGACY_DATABASE_PATH, DATABASE_PATH)

MAX_SONG_IMAGE_BYTES = 8 * 1024 * 1024
MAX_OCR_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 30_000_000
MAX_TITLE_LENGTH = 100
MAX_JIANPU_LENGTH = 200_000
ALLOWED_SONG_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
ALLOWED_KEYS = {
    'C', 'B#', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'Fb', 'F', 'E#',
    'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb',
}
TEMPO_MIN, TEMPO_MAX = 20, 300
TIME_SIGNATURE_RE = re.compile(r'^\d{1,2}/\d{1,2}$')


def sync_builtin_songs(cursor):
    """按 source_id 同步内置曲目。

    - 新曲目（按 source_id 未匹配）插入；
    - 已存在曲目按 source_id 匹配，仅更新内容字段（简谱/调号/拍号/速度/静态谱图），
      **不修改标题**，因此修改 songs.json 的标题不会再产生重复曲目；
    - 仅当 songs.json 数据版本变化时才执行内容更新，避免每次启动都写库。
    """
    stored_version = None
    row = cursor.execute("SELECT value FROM meta WHERE key = 'builtin_data_version'").fetchone()
    if row:
        stored_version = row[0]

    for song in BUILTIN_SONGS:
        source_id = song.get('id')
        target = None
        if source_id is not None:
            target = cursor.execute(
                'SELECT id FROM songs WHERE source_id = ? AND is_builtin = 1 LIMIT 1',
                (source_id,)
            ).fetchone()
        if target is None:
            # 兼容旧库：按标题匹配已有内置记录，随后回填 source_id
            target = cursor.execute(
                'SELECT id FROM songs WHERE title = ? AND is_builtin = 1 ORDER BY id ASC LIMIT 1',
                (song.get('title'),)
            ).fetchone()

        if target is None:
            cursor.execute(
                '''INSERT INTO songs
                   (title, jianpu, key_signature, time_signature, tempo, static_image, source_id, is_builtin)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1)''',
                (song.get('title'), song.get('jianpu', ''), song.get('key', 'C'),
                 song.get('time_signature', '4/4'), song.get('tempo'),
                 song.get('static_image'), source_id)
            )
            continue

        song_pk = target[0]
        # 旧库升级：回填 source_id
        cursor.execute(
            'UPDATE songs SET source_id = ? WHERE id = ? AND (source_id IS NULL OR source_id <> ?)',
            (source_id, song_pk, source_id)
        )
        if stored_version != BUILTIN_DATA_VERSION:
            cursor.execute(
                '''UPDATE songs
                   SET jianpu = ?, key_signature = ?, time_signature = ?, tempo = ?, static_image = ?
                   WHERE id = ?''',
                (song.get('jianpu', ''), song.get('key', 'C'), song.get('time_signature', '4/4'),
                 song.get('tempo'), song.get('static_image'), song_pk)
            )

    cursor.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('builtin_data_version', ?)",
        (BUILTIN_DATA_VERSION,)
    )


def init_db():
    """初始化数据库，并按 source_id 同步内置曲目（seed-once 之外的增量迁移）。"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            jianpu TEXT NOT NULL,
            key_signature TEXT DEFAULT 'C',
            is_builtin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)')

    # 兼容已有数据库：SQLite 不支持 ADD COLUMN IF NOT EXISTS，因此按现有字段迁移。
    cursor.execute('PRAGMA table_info(songs)')
    columns = {row[1] for row in cursor.fetchall()}
    migrations = {
        'image_data': 'BLOB',
        'image_mime_type': 'TEXT',
        'image_filename': 'TEXT',
        'image_updated_at': 'TIMESTAMP',
        'time_signature': "TEXT DEFAULT '4/4'",
        'tempo': 'INTEGER',
        'source_id': 'INTEGER',      # songs.json 中的稳定曲目 id
        'static_image': 'TEXT',      # 内置静态谱图文件名（仅路径，不把图片写进数据库）
    }
    for name, column_type in migrations.items():
        if name not in columns:
            cursor.execute(f'ALTER TABLE songs ADD COLUMN {name} {column_type}')
    conn.commit()

    sync_builtin_songs(cursor)
    conn.commit()
    conn.close()


init_db()


# 页面路由配置：路由名 -> (模板文件, 页面标题)
PAGES = {
    'index': ('index.html', '听音训练'),
    'c_major_scale': ('c_major_scale.html', '自然大调音阶练习'),
    'piano_simulator': ('piano_simulator.html', '自由训练·模拟钢琴'),
    'pitch_training': ('pitch_training.html', '音高训练'),
    'jianpu_training': ('jianpu_training.html', '简谱听写'),
}


def _register_page(route_name, template_name):
    def view():
        return render_template(template_name)

    view.__name__ = route_name  # endpoint 必须与模板中 url_for() 引用的名称一致
    rule = '/' if route_name == 'index' else f'/{route_name}'
    app.add_url_rule(rule, endpoint=route_name, view_func=view)


for _name, (_template, _title) in PAGES.items():
    _register_page(_name, _template)


# ==================== 请求校验工具 ====================
def validate_image_bytes(image_data, max_bytes, label='图片'):
    """校验图片体积与真实图像内容，返回错误信息（合法则返回 None）。"""
    if not image_data:
        return '%s内容为空' % label
    if len(image_data) > max_bytes:
        return '%s不能超过 %d MB' % (label, max_bytes // (1024 * 1024))
    if PIL_AVAILABLE:
        try:
            with Image.open(io.BytesIO(image_data)) as probe:
                probe.verify()
            with Image.open(io.BytesIO(image_data)) as probe:
                width, height = probe.size
        except Exception:
            return '无法识别的图片内容，请上传 JPG/PNG/GIF/WebP'
        if width * height > MAX_IMAGE_PIXELS:
            return '图片像素过大（上限 %d 万像素）' % (MAX_IMAGE_PIXELS // 10000)
    return None


def _validate_title(value):
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, 'title 必须是字符串'
    value = value.strip()
    if not value:
        return None, '歌曲标题不能为空'
    if len(value) > MAX_TITLE_LENGTH:
        return None, '标题不能超过 %d 个字符' % MAX_TITLE_LENGTH
    return value, None


def _validate_jianpu(value):
    if value is None:
        return None, None
    if not isinstance(value, str) or not value.strip():
        return None, '简谱内容不能为空'
    value = value.strip()
    if len(value) > MAX_JIANPU_LENGTH:
        return None, '简谱内容过长（上限 %d 字符）' % MAX_JIANPU_LENGTH
    return value, None


def _validate_key(value):
    if value is None:
        return None, None
    if not isinstance(value, str) or value not in ALLOWED_KEYS:
        return None, '调号无效，必须是 %s 之一' % '、'.join(sorted(ALLOWED_KEYS))
    return value, None


def _validate_time_signature(value):
    if value is None:
        return None, None
    if not isinstance(value, str) or not TIME_SIGNATURE_RE.match(value.strip()):
        return None, '拍号格式无效，应形如 4/4'
    return value.strip(), None


def _validate_tempo(value):
    if value is None or value == '':
        return None, None
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        return None, 'tempo 必须是整数'
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None, 'tempo 必须是整数'
    if not (TEMPO_MIN <= value <= TEMPO_MAX):
        return None, 'tempo 需在 %d-%d 之间' % (TEMPO_MIN, TEMPO_MAX)
    return value, None


def parse_song_create(data):
    """校验“新增歌曲”请求，返回 (payload, error)。"""
    if not isinstance(data, dict):
        return None, '请求体必须是 JSON 对象'

    title, err = _validate_title(data.get('title'))
    if err:
        return None, err
    if not title:
        return None, '歌曲标题不能为空'

    jianpu, err = _validate_jianpu(data.get('jianpu'))
    if err:
        return None, err
    if not jianpu:
        return None, '简谱内容不能为空'

    key, err = _validate_key(data.get('key') or 'C')
    if err:
        return None, err

    time_signature, err = _validate_time_signature(data.get('time_signature') or '4/4')
    if err:
        return None, err

    tempo, err = _validate_tempo(data.get('tempo'))
    if err:
        return None, err

    return {
        'title': title, 'jianpu': jianpu, 'key': key,
        'time_signature': time_signature, 'tempo': tempo,
    }, None


def parse_song_update(data):
    """校验“更新歌曲”请求：只返回请求中实际提供的字段，未提供的字段保持数据库旧值。"""
    if not isinstance(data, dict):
        return None, '请求体必须是 JSON 对象'

    payload = {}
    if 'title' in data:
        title, err = _validate_title(data['title'])
        if err:
            return None, err
        if not title:
            return None, '歌曲标题不能为空'
        payload['title'] = title
    if 'jianpu' in data:
        jianpu, err = _validate_jianpu(data['jianpu'])
        if err:
            return None, err
        if not jianpu:
            return None, '简谱内容不能为空'
        payload['jianpu'] = jianpu
    if 'key' in data:
        key, err = _validate_key(data['key'])
        if err:
            return None, err
        payload['key'] = key
    if 'time_signature' in data:
        time_signature, err = _validate_time_signature(data['time_signature'])
        if err:
            return None, err
        payload['time_signature'] = time_signature
    if 'tempo' in data:
        tempo, err = _validate_tempo(data['tempo'])
        if err:
            return None, err
        payload['tempo'] = tempo

    if not payload:
        return None, '没有可更新的字段'
    return payload, None


@app.route('/api/ocr_jianpu', methods=['POST'])
def ocr_jianpu():
    """识别上传的简谱图片，提取简谱文本。

    使用 tesseract（chi_sim+eng）识别，结果过滤掉歌词等中文行，
    仅保留简谱记号；识别结果可能需要人工校对。
    """
    if 'image' not in request.files:
        return jsonify({'error': '请上传图片文件（字段名 image）'}), 400
    file = request.files['image']
    if not file or not file.filename:
        return jsonify({'error': '未选择文件'}), 400

    # 在读取前先按 Content-Length 粗筛，避免直接 file.read() 吞下超大请求
    if request.content_length and request.content_length > MAX_OCR_IMAGE_BYTES + 4096:
        return jsonify({'error': '图片不能超过 %d MB' % (MAX_OCR_IMAGE_BYTES // (1024 * 1024))}), 413

    if not OCR_AVAILABLE:
        return jsonify({'error': '服务器未安装 tesseract OCR，无法自动识别；请手动粘贴简谱，或安装：brew install tesseract tesseract-lang'}), 501

    image_data = file.read()
    err = validate_image_bytes(image_data, MAX_OCR_IMAGE_BYTES)
    if err:
        return jsonify({'error': err}), 400

    try:
        img = Image.open(io.BytesIO(image_data))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        # 放大提高小字识别率，再灰度化 + 二值化增强
        width, height = img.size
        scale = max(1.0, min(3.0, 2000.0 / max(width, height)))
        if scale > 1.0:
            img = img.resize((int(width * scale), int(height * scale)), Image.LANCZOS)
        img = img.convert('L').point(lambda p: 255 if p > 150 else 0)
        raw = pytesseract.image_to_string(img, lang='chi_sim+eng', config='--psm 6')
    except Exception as exc:
        return jsonify({'error': 'OCR 处理失败：%s' % exc}), 500

    jianpu_text, key_hint = extract_jianpu_text(raw)
    if not jianpu_text:
        return jsonify({'error': '未能从图片中识别出简谱记号，请换一张更清晰的图片或手动输入', 'raw': raw}), 422

    return jsonify({'text': jianpu_text, 'key': key_hint})


# 简谱高/低音点使用组合变音符号（如 U+0307 高音点、U+0323 低音点），
# 需在清洗时保留，否则会丢失音区信息。这里覆盖整个组合变音符号区。
_COMBINING_DIACRITICS = ''.join(chr(cp) for cp in range(0x0300, 0x0370))


def normalize_jianpu_chars(text):
    """将 OCR 识别文本中的全角、形似字符归一化为标准简谱记号"""
    # 全角数字转半角
    full_to_half = str.maketrans('０１２３４５６７８９', '0123456789')
    text = text.translate(full_to_half)

    # 音乐符号归一化
    text = text.replace('♭', 'b').replace('♯', '#').replace('♮', '')

    # 简谱排版常用字母替代符号归一化：
    # 1) 简谱中印刷的小写字母 i（或其变体）是天然的高音 1（1̇）
    dot_one = '1\u0307'
    text = text.replace('i', dot_one).replace('I', dot_one)

    # 2) 字母 o / O 经常为 OCR 识别的休止符 0
    text = re.sub(r'(?<=[0-7|\-\s])[oO](?=[0-7|\-\s]|$)', '0', text)
    text = re.sub(r'^[oO](?=[0-7|\-\s]|$)', '0', text)

    # 3) 附点：· / • / ● / · 统一为标准小数点 .
    text = re.sub(r'[\u00b7\u2022\u25cf\uff0e]', '.', text)

    # 4) 减时线（下划线 _ 或组合下划线 U+0332）保留：它表示八分/十六分音符时值，
    #    与前端 parseJianpuToken() 使用同一套记号语义，不能删除。
    text = text.replace('\u0332', '_')

    return text


def extract_jianpu_text(raw):
    """从 OCR 原文中筛出简谱行：丢弃歌词等中文主导行，保留数字记号行。"""
    lines = []
    key_hint = None
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue

        # 调号行检测，如 1=C / 1 = C / 1=bB：记录调号后跳过当前行
        m_key = re.search(r'1\s*[=＝]\s*([A-G][b#]?)', line)
        if m_key:
            if not key_hint:
                key_hint = m_key.group(1)
            continue

        # 纯速度/拍号行，如 J=69 / 4/4 / ♩=69 等跳过
        if re.search(r'^[Jj♩]?\s*=\s*\d+', line) or re.match(r'^\d+/\d+$', line):
            continue

        # 词曲作者信息行（如“周杰伦 词”、“人工卫星 曲”等），跳过
        if re.search(r'(词|曲|编曲|演唱|制作|作词|作曲)\s*[：:]', line) or re.search(r'[\u4e00-\u9fff]{2,4}\s*(词|曲)', line):
            continue

        # 歌词行判断：包含较多中文字符，丢弃
        cjk = sum(1 for ch in line if '\u4e00' <= ch <= '\u9fff')
        if cjk * 2 > len(line) or cjk >= 3:
            continue

        # 纯英文唱名/单词歌词行检测（如 re Sol sol si do si la sol la）
        words = line.split()
        if words and all(w.isalpha() and not any(ch in '01234567' for ch in w) for w in words):
            continue

        # 字符归一化
        line = normalize_jianpu_chars(line)

        # 保留简谱合法字符：数字 0-7、升降号 # b B、小节线 |、延音线 -、附点 .、
        # 减时线 _、撇号/逗号、组合高低音点
        cleaned = re.sub(r'[^0-7#bB|\-\s.,\'′″_' + _COMBINING_DIACRITICS + r']', ' ', line)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        # 只要包含至少一个简谱数字即可保留
        digits = sum(1 for ch in cleaned if ch in '01234567')
        if cleaned and digits >= 1:
            lines.append(cleaned)

    return '\n'.join(lines), key_hint


# ==================== 曲库 RESTful API（查、增、改、删） ====================
def _song_row_to_dict(row):
    return {
        'id': row[0],
        'title': row[1],
        'jianpu': row[2],
        'key': row[3],
        'time_signature': row[4] or '4/4',
        'tempo': row[5],
        'is_builtin': bool(row[6]),
        'has_image': bool(row[7]),
        'static_image': row[8],
        'source_id': row[9],
    }


@app.route('/api/jianpu/songs', methods=['GET'])
def get_jianpu_songs():
    """获取所有简谱歌曲（包括内置与用户自建）。"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        '''SELECT id, title, jianpu, key_signature, time_signature, tempo, is_builtin,
                  image_data IS NOT NULL, static_image, source_id
           FROM songs ORDER BY is_builtin DESC, id ASC'''
    )
    rows = cursor.fetchall()
    conn.close()
    return jsonify({'songs': [_song_row_to_dict(r) for r in rows]})


@app.route('/api/jianpu/songs', methods=['POST'])
def save_jianpu_song():
    """保存用户自建简谱歌曲到数据库。"""
    data = request.get_json(silent=True)
    payload, error = parse_song_create(data if data is not None else {})
    if error:
        return jsonify({'error': error}), 400

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO songs (title, jianpu, key_signature, time_signature, tempo, is_builtin) VALUES (?, ?, ?, ?, ?, 0)',
        (payload['title'], payload['jianpu'], payload['key'], payload['time_signature'], payload['tempo'])
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        'status': 'ok',
        'song': {
            'id': new_id,
            'title': payload['title'],
            'jianpu': payload['jianpu'],
            'key': payload['key'],
            'time_signature': payload['time_signature'],
            'tempo': payload['tempo'],
            'is_builtin': False
        }
    }), 201


@app.route('/api/jianpu/songs/<int:song_id>', methods=['PUT'])
def update_jianpu_song(song_id):
    """部分更新自建歌曲：只写请求中提供的字段，未提供的字段保持旧值。

    内置曲目只读，需在界面使用「另存为副本」。
    """
    data = request.get_json(silent=True)
    payload, error = parse_song_update(data if data is not None else {})
    if error:
        return jsonify({'error': error}), 400

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, is_builtin FROM songs WHERE id = ?', (song_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '未找到指定歌曲'}), 404
    if row[1] == 1:
        conn.close()
        return jsonify({'error': '内置曲目为只读，请使用「另存为副本」保存你的修改'}), 403

    column_map = {
        'title': 'title',
        'jianpu': 'jianpu',
        'key': 'key_signature',
        'time_signature': 'time_signature',
        'tempo': 'tempo',
    }
    fields = []
    values = []
    for field, column in column_map.items():
        if field in payload:
            fields.append(column + ' = ?')
            values.append(payload[field])
    values.append(song_id)
    cursor.execute('UPDATE songs SET ' + ', '.join(fields) + ' WHERE id = ?', values)
    conn.commit()

    cursor.execute(
        '''SELECT id, title, jianpu, key_signature, time_signature, tempo, is_builtin,
                  image_data IS NOT NULL, static_image, source_id
           FROM songs WHERE id = ?''',
        (song_id,)
    )
    r = cursor.fetchone()
    conn.close()
    return jsonify({'status': 'ok', 'song': _song_row_to_dict(r)})


def _fetch_song_builtin_flag(song_id):
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    row = cursor.execute('SELECT is_builtin FROM songs WHERE id = ?', (song_id,)).fetchone()
    conn.close()
    return row


@app.route('/api/jianpu/songs/<int:song_id>/image', methods=['GET'])
def get_jianpu_song_image(song_id):
    """读取歌曲关联的谱图二进制数据。"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        'SELECT image_data, image_mime_type, image_filename FROM songs WHERE id = ?',
        (song_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': '未找到指定歌曲'}), 404
    if not row[0]:
        return jsonify({'error': '该歌曲尚未保存谱图'}), 404
    return send_file(
        io.BytesIO(row[0]),
        mimetype=row[1] or 'application/octet-stream',
        download_name=row[2] or 'jianpu-image',
        max_age=0
    )


@app.route('/api/jianpu/songs/<int:song_id>/image', methods=['PUT'])
def put_jianpu_song_image(song_id):
    """上传或替换歌曲谱图，图片以 BLOB 直接保存在 SQLite 中（内置曲目只读）。"""
    file = request.files.get('image')
    if not file or not file.filename:
        return jsonify({'error': '请选择要保存的谱图图片'}), 400
    if file.mimetype not in ALLOWED_SONG_IMAGE_TYPES:
        return jsonify({'error': '仅支持 JPG、PNG、GIF 或 WebP 图片'}), 400

    row = _fetch_song_builtin_flag(song_id)
    if not row:
        return jsonify({'error': '未找到指定歌曲'}), 404
    if row[0] == 1:
        return jsonify({'error': '内置曲目为只读，请先「另存为副本」再上传谱图'}), 403

    image_data = file.read()
    err = validate_image_bytes(image_data, MAX_SONG_IMAGE_BYTES)
    if err:
        return jsonify({'error': err}), 400

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        '''UPDATE songs
           SET image_data = ?, image_mime_type = ?, image_filename = ?,
               image_updated_at = CURRENT_TIMESTAMP
           WHERE id = ?''',
        (sqlite3.Binary(image_data), file.mimetype, os.path.basename(file.filename), song_id)
    )
    conn.commit()
    conn.close()
    return jsonify({
        'status': 'ok',
        'image_url': f'/api/jianpu/songs/{song_id}/image',
        'size': len(image_data),
        'filename': os.path.basename(file.filename)
    })


@app.route('/api/jianpu/songs/<int:song_id>/image', methods=['DELETE'])
def delete_jianpu_song_image(song_id):
    """删除歌曲关联的谱图（内置曲目只读），不会删除简谱文本或歌曲记录。"""
    row = _fetch_song_builtin_flag(song_id)
    if not row:
        return jsonify({'error': '未找到指定歌曲'}), 404
    if row[0] == 1:
        return jsonify({'error': '内置曲目为只读，无法删除其谱图'}), 403

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        '''UPDATE songs
           SET image_data = NULL, image_mime_type = NULL, image_filename = NULL,
               image_updated_at = NULL
           WHERE id = ?''',
        (song_id,)
    )
    conn.commit()
    conn.close()
    return jsonify({'status': 'ok', 'deleted_id': song_id})


@app.route('/api/jianpu/songs/<int:song_id>', methods=['DELETE'])
def delete_jianpu_song(song_id):
    """从数据库删除用户自建的歌曲（内置经典曲目受保护）。"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT is_builtin FROM songs WHERE id = ?', (song_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '未找到指定歌曲'}), 404
    if row[0] == 1:
        conn.close()
        return jsonify({'error': '内置经典曲目受保护，无法删除'}), 403

    cursor.execute('DELETE FROM songs WHERE id = ?', (song_id,))
    conn.commit()
    conn.close()

    return jsonify({'status': 'ok', 'deleted_id': song_id})


@app.route('/healthz')
def healthz():
    """健康检查接口，便于部署探活。"""
    return {'status': 'ok'}, 200


@app.errorhandler(413)
def request_entity_too_large(_error):
    """请求体超过 MAX_CONTENT_LENGTH 时返回 JSON 而不是 HTML。"""
    return jsonify({'error': '请求体过大（上限 %d MB）' % (app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024))}), 413


@app.errorhandler(404)
def not_found(_error):
    return render_template('index.html'), 404


if __name__ == '__main__':
    # 默认关闭 debug：公开部署不应使用 Flask 调试器。需要本地调试时显式设 FLASK_DEBUG=1。
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    host = os.environ.get('FLASK_HOST', '127.0.0.1')
    port = int(os.environ.get('FLASK_PORT', '5000'))
    app.run(debug=debug, host=host, port=port)

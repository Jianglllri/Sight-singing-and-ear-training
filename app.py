import io
import json
import os
import re
import shutil
import sqlite3
from functools import wraps

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

# 写操作保护：设置该环境变量后，所有写接口必须携带 X-Admin-Token
ADMIN_TOKEN = os.environ.get('FLASK_ADMIN_TOKEN', '').strip()


def write_protected(view):
    """可选写保护：仅在配置了 FLASK_ADMIN_TOKEN 时校验请求头（本地单用户默认不开启）。"""

    @wraps(view)
    def wrapper(*args, **kwargs):
        if ADMIN_TOKEN:
            token = request.headers.get('X-Admin-Token', '')
            if token != ADMIN_TOKEN:
                return jsonify({'error': '未授权：缺少或错误的 X-Admin-Token'}), 401
        return view(*args, **kwargs)

    return wrapper


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


def init_db():
    """初始化数据库，并仅在首次建库时播种内置曲目。

    内置曲目只在缺失时插入，已存在的记录不再更新，避免覆盖用户对谱面/调号/速度的修改。
    """
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
    # 兼容已有数据库：SQLite 不支持 ADD COLUMN IF NOT EXISTS，因此按现有字段迁移。
    cursor.execute('PRAGMA table_info(songs)')
    columns = {row[1] for row in cursor.fetchall()}
    image_columns = {
        'image_data': 'BLOB',
        'image_mime_type': 'TEXT',
        'image_filename': 'TEXT',
        'image_updated_at': 'TIMESTAMP'
    }
    for name, column_type in image_columns.items():
        if name not in columns:
            cursor.execute(f'ALTER TABLE songs ADD COLUMN {name} {column_type}')

    # 节奏元数据：拍号 / 速度，替代默认 4/4
    extra_meta_columns = {
        'time_signature': "TEXT DEFAULT '4/4'",
        'tempo': 'INTEGER'
    }
    for name, column_type in extra_meta_columns.items():
        if name not in columns:
            cursor.execute(f'ALTER TABLE songs ADD COLUMN {name} {column_type}')
    conn.commit()

    # 内置曲库仅在“尚不存在”时插入（seed-once），不覆盖已有内置记录
    for s in BUILTIN_SONGS:
        cursor.execute(
            'SELECT id FROM songs WHERE title = ? AND is_builtin = 1 ORDER BY id ASC LIMIT 1',
            (s.get('title'),)
        )
        if cursor.fetchone():
            continue
        cursor.execute(
            'INSERT INTO songs (title, jianpu, key_signature, time_signature, tempo, is_builtin) VALUES (?, ?, ?, ?, ?, 1)',
            (s.get('title'), s.get('jianpu', ''), s.get('key', 'C'),
             s.get('time_signature', '4/4'), s.get('tempo'))
        )
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


def parse_song_payload(data):
    """校验并规范化歌曲写入请求。

    返回 (payload, error)。payload 中 title 可能为 None（PUT 允许不修改标题）。
    """
    if not isinstance(data, dict):
        return None, '请求体必须是 JSON 对象'

    title = data.get('title')
    if title is not None:
        if not isinstance(title, str):
            return None, 'title 必须是字符串'
        title = title.strip()
        if not title:
            return None, '歌曲标题不能为空'
        if len(title) > MAX_TITLE_LENGTH:
            return None, '标题不能超过 %d 个字符' % MAX_TITLE_LENGTH

    jianpu = data.get('jianpu')
    if not isinstance(jianpu, str) or not jianpu.strip():
        return None, '简谱内容不能为空'
    jianpu = jianpu.strip()
    if len(jianpu) > MAX_JIANPU_LENGTH:
        return None, '简谱内容过长（上限 %d 字符）' % MAX_JIANPU_LENGTH

    key = data.get('key') or 'C'
    if not isinstance(key, str) or key not in ALLOWED_KEYS:
        return None, '调号无效，必须是 %s 之一' % '、'.join(sorted(ALLOWED_KEYS))

    time_signature = data.get('time_signature') or '4/4'
    if not isinstance(time_signature, str) or not TIME_SIGNATURE_RE.match(time_signature.strip()):
        return None, '拍号格式无效，应形如 4/4'

    tempo = data.get('tempo')
    if tempo is None or tempo == '':
        tempo = None
    else:
        if isinstance(tempo, bool) or not isinstance(tempo, (int, str)):
            return None, 'tempo 必须是整数'
        try:
            tempo = int(tempo)
        except (TypeError, ValueError):
            return None, 'tempo 必须是整数'
        if not (TEMPO_MIN <= tempo <= TEMPO_MAX):
            return None, 'tempo 需在 %d-%d 之间' % (TEMPO_MIN, TEMPO_MAX)

    return {
        'title': title,
        'jianpu': jianpu,
        'key': key,
        'time_signature': time_signature.strip(),
        'tempo': tempo,
    }, None


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
@app.route('/api/jianpu/songs', methods=['GET'])
def get_jianpu_songs():
    """获取所有简谱歌曲（包括内置与用户自建）"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, title, jianpu, key_signature, time_signature, tempo, is_builtin, image_data IS NOT NULL FROM songs ORDER BY is_builtin DESC, id ASC')
    rows = cursor.fetchall()
    conn.close()
    songs = []
    for r in rows:
        songs.append({
            'id': r[0],
            'title': r[1],
            'jianpu': r[2],
            'key': r[3],
            'time_signature': r[4] or '4/4',
            'tempo': r[5],
            'is_builtin': bool(r[6]),
            'has_image': bool(r[7])
        })
    return jsonify({'songs': songs})


@app.route('/api/jianpu/songs', methods=['POST'])
@write_protected
def save_jianpu_song():
    """保存用户自建简谱歌曲到数据库"""
    data = request.get_json(silent=True)
    payload, error = parse_song_payload(data if data is not None else {})
    if error:
        return jsonify({'error': error}), 400
    if not payload['title']:
        return jsonify({'error': '歌曲标题不能为空'}), 400

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
@write_protected
def update_jianpu_song(song_id):
    """编辑并保存用户自建歌曲。内置曲目只读，需另存为副本。"""
    data = request.get_json(silent=True)
    payload, error = parse_song_payload(data if data is not None else {})
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

    fields = ['jianpu = ?', 'key_signature = ?', 'time_signature = ?', 'tempo = ?']
    values = [payload['jianpu'], payload['key'], payload['time_signature'], payload['tempo']]
    if payload['title']:
        fields.append('title = ?')
        values.append(payload['title'])

    values.append(song_id)
    cursor.execute(f'UPDATE songs SET {", ".join(fields)} WHERE id = ?', values)
    conn.commit()

    cursor.execute(
        'SELECT id, title, jianpu, key_signature, time_signature, tempo, is_builtin FROM songs WHERE id = ?',
        (song_id,)
    )
    r = cursor.fetchone()
    conn.close()
    return jsonify({
        'status': 'ok',
        'song': {
            'id': r[0], 'title': r[1], 'jianpu': r[2], 'key': r[3],
            'time_signature': r[4] or '4/4', 'tempo': r[5], 'is_builtin': bool(r[6])
        }
    })


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
@write_protected
def put_jianpu_song_image(song_id):
    """上传或替换歌曲谱图，图片以 BLOB 直接保存在 SQLite 中。"""
    file = request.files.get('image')
    if not file or not file.filename:
        return jsonify({'error': '请选择要保存的谱图图片'}), 400
    if file.mimetype not in ALLOWED_SONG_IMAGE_TYPES:
        return jsonify({'error': '仅支持 JPG、PNG、GIF 或 WebP 图片'}), 400

    image_data = file.read()
    err = validate_image_bytes(image_data, MAX_SONG_IMAGE_BYTES)
    if err:
        return jsonify({'error': err}), 400

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM songs WHERE id = ?', (song_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': '未找到指定歌曲'}), 404
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
@write_protected
def delete_jianpu_song_image(song_id):
    """删除歌曲关联的谱图，不会删除简谱文本或歌曲记录。"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM songs WHERE id = ?', (song_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': '未找到指定歌曲'}), 404
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
@write_protected
def delete_jianpu_song(song_id):
    """从数据库删除用户自建的歌曲（内置经典曲目受保护）"""
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

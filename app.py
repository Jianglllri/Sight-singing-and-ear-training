import io
import os
import re
import shutil
import sqlite3

from flask import Flask, render_template, request, jsonify, send_file

app = Flask(__name__)

# OCR 依赖为可选：未安装时接口返回明确提示，不影响其它功能
try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = shutil.which('tesseract') is not None
except ImportError:
    OCR_AVAILABLE = False

# ==================== 简谱持久化曲库数据库（SQLite） ====================
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'jianpu_library.db')
MAX_SONG_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_SONG_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}

BUILTIN_SONGS = [
    {
        'title': '两难（加木）',
        'key': 'C',
        'jianpu': '0 0 0 6 5 6 6 | 6 3 2 3 3 4 5 5 | 5 3 2 3 3 3 2 3 2 3 | 6 7 1 5 5 5 5 | 6 7 1 6 6 6 5 6 6 | 6 3 2 3 3 4 5 5 | 5 3 2 3 3 3 2 3 2 3 | 6 7 1 5 5 5 5 | 6 7 1 1̇ 1̇ 7 6 3 | 6 6 3 3 3 3 3 3 2 3 2 | 3 3 3 3 3 3 3 2 3. 6 | 6 1 6 1 3 3 2 3 2 3 | 3 3 3 2 3 0 2 3 3 | 6 6 3 3 3 1 2 1 2 | 6̣. 3 3 5 5 1 2 1 2 | 6̣. 3 3 5 5 1 2 1 2 | 6 3 3 3 5 3 5 3 1 1 | 1 1 5 3 1 1 1 1̣ 3 | 0 1 1 1'
    },
    {
        'title': '问风（金渔）',
        'key': 'Ab',
        'time_signature': '4/4',
        'tempo': 125,
        'jianpu': '6̣ 3 2 3 6̣ 3 2 3 | 6̣ 3 2 3 7̣ 3 2 3 | 7̣ 1 7̣ 5̣ 3 2 3 5 | 3 2 3 5 1 7 1 2 | 3 2 3 2 3 3 2 | 3 2 3 3 2 3 5 | 3 6̣ - - | 3 2 3 2 3 3 2 | 3 2 3 3 2 3 5 | 5 6̣ 6̣ - - | 1̇ 6 6 5 3 | 5 3 2 3 3 2 1 | 2 2 2 3 3 - | 6̣ 6̣ 6̣ 6̣ 6̣ 6̣ | 5 5 5 5 1 7 6 | 6̣ - - - | 3 6̣ 5 6̣ 5 6̣ 5 | 6̣ - 6 6 6 6 | 3 6̣ 5 6̣ 5 6̣ 5 | 3 - 6 6 6 6 | 3 6̣ 3 6 | 2 1 2 1 2 3 | 2 1 6̣ - - -'
    },
    {
        'title': '暖暖（梁静茹）',
        'key': 'B',
        'jianpu': '2 3 3 2 3 3 | 2 3 5 3 1 1 5 | 6̣. 3 2 1 2 | 3 - 0 5 1 2 | 2 3 3 2 3 3 | 2 3 5 3 1 1 7 6̣ | 3 2 1 2 1 - - | 1 7 6̣ 1 2 1 2 | 3 5 2 3 1 1 7 6 | 1 2 3 2 1 2 | 3 - 1 7 | 6 1 2 3 2 1 2 | 3 5 5 3 6 3 2 1. | 3 2 2 1 2 1 - 0 1 3 4 | 5 1 3 4 5 6 7 | 1̇ 3 3 4 5 - 6 | 5 4 5 1 6 6 7 1̇ | 7 5 3 4 5 6 7 | 1 7 6 5 - | 4 5 6 4 5 1̇ | 1̇ 7 5 1 3 2 1 | 1 - - -'
    },
    {
        'title': '青花瓷（周杰伦）',
        'key': 'A',
        'time_signature': '4/4',
        'jianpu': '0_ 2_ 1_ 6̣ | 1_ 1_ 6̣_ 1_ 1_ 6̣_ 1_ 6̣_ | 5̣_ 0_ 2_ 1_ 6̣ 1_ 1_ 6̣_ | 1_ 1_ 3_ 2_ 1_ 1_ 0_ 5_ | 6̣_ 3̣ 3_ 3_ 2_ 3_ 3_ 2_ | 3_ 5_ 3_ 3_ 0_ 3_ 3_ 3_ | 2_ 2_ 2_ 2_ 2_ 1_ 3_ 2_. | 0_ 2_ 1_ 6̣ 1_ 1_ 6̣ 1_ | 1_ 6̣_ 5̣_ 0_ 5_ 6̣_ 3̣ 5_ | 5_ 3_ 5_ 5_ 3_ 2_ 1_ 1_ | 0_ 2_ 1_ 2_ 3_ 2_ 2_ 1_ | 2_ 1_ 6̣_ 2_ 1_ 1_ 6̣_ 1_ | 1_ 1_ 1_ 1_ 0_ 5_ 5_ 3_ | 2_ 3_ 6̣_ 2_ 3_ 5_ 3_ 2_ | 0_ 5_ 5_ 3_ 2_ 3_ 5_ 2_ | 3_ 5_ 2_ 1_ 0_ 1_ 2_ 3_ | 5_ 6̣_ 5_ 4_ 5_ 3_ 3_ 2_ | 2_ 0_ 1_ 2_ 1_ 2_ 1_ 2_ | 2_ 3_ 5_ 3_ 3_. 0_ 5_ | 5_ 3_ 2_ 3_ 6̣_ 2_ 3_ 5_ | 3_ 2_ 0_ 5_ 5_ 3_ 2_ 3_ | 5_ 2_ 3_ 5_ 2_ 1_ 0_ 1_ | 2_ 3_ 5_ 6̣_ 5_ 4_ 5_ 3_ | 3_ 3_ 2_ 2_. 5_ 3_ 2_ 2_ | 2_ 1_. 1 - 0_ 2_ | 1_ 6̣ 2_ 1_. 1 - 0_ 5_ | 5_ 3_ 2_ 1_. 1 - 0'
    },
    {
        'title': '时间煮雨（郁可唯）',
        'key': 'C',
        'time_signature': '4/4',
        'tempo': 86,
        'jianpu': '3 5 6 5 3 2 1 | 3 5 6 5 3 2 3 | 5 6 1̇ 6 5 3 2 1 | 3 5 2 3 2 1 1 - | 1̇ 7 6 5 6 5 3 | 5 6 1̇ 2̇ 1̇ 7 6 - | 1̇ 7 6 5 6 5 3 2 1 | 3 5 2 3 2 1 1 -'
    },
    {
        'title': '消愁（毛不易）',
        'key': 'Ab',
        'time_signature': '4/4',
        'tempo': 110,
        'jianpu': '1 1 1 6̣ 1 2 3 | 2 2 2 1 2 3 1 - | 3 3 3 2 3 5 6 | 5 5 5 3 5 6 3 - | 6 6 6 5 6 1̇ 2̇ | 1̇ 1̇ 1̇ 6 1̇ 2̇ 6 - | 5 5 5 3 5 6 1̇ 2 | 3 2 1 2 1 - - -'
    },
    {
        'title': '像我这样的人（毛不易）',
        'key': 'Db',
        'time_signature': '4/4',
        'tempo': 62,
        'jianpu': '1 2 3 5 3 2 1 6̣ | 1 2 3 2 1 2 - - | 1 2 3 5 3 2 1 6̣ | 1 2 3 2 1 1 - - | 3 5 6 1̇ 6 5 3 2 | 1 2 3 2 1 2 - - | 3 5 6 1̇ 6 5 3 2 | 1 2 3 2 1 1 - -'
    },
    {
        'title': '平凡的一天（毛不易）',
        'key': 'Gb',
        'time_signature': '4/4',
        'tempo': 60,
        'jianpu': '1 2 3 5 5 6 5 3 | 2 3 2 1 2 - - - | 1 2 3 5 5 6 5 3 | 2 3 2 1 1 - - - | 3 5 6 1̇ 1̇ 6 5 3 | 2 3 2 1 2 - - - | 3 5 6 1̇ 1̇ 6 5 3 | 2 3 2 1 1 - - -'
    },
    {
        'title': '小星星',
        'key': 'C',
        'jianpu': '1 1 5 5 6 6 5 - | 4 4 3 3 2 2 1 - | 5 5 4 4 3 3 2 - | 5 5 4 4 3 3 2 -'
    },
    {
        'title': '两只老虎',
        'key': 'C',
        'jianpu': '1 2 3 1 | 1 2 3 1 | 3 4 5 - | 3 4 5 - | 5̇ 6 5̇ 4 3 1 | 5̇ 6 5̇ 4 3 1 | 2 5 1 - | 2 5 1 -'
    },
    {
        'title': '欢乐颂',
        'key': 'C',
        'jianpu': '3 3 4 5 5 4 3 2 | 1 1 2 3 3 2 2 - | 3 3 4 5 5 4 3 2 | 1 1 2 3 2 1 1 -'
    },
    {
        'title': '生日快乐',
        'key': 'C',
        'jianpu': '5 5 6 5 1̇ 7 | 5 5 6 5 2̇ 1̇ | 5̇ 5̇ 3̇ 1̇ 7 6 | 4̇ 4̇ 3̇ 1̇ 2̇ 1̇'
    },
    {
        'title': '送别',
        'key': 'C',
        'jianpu': '5 3 5 1̇ - | 7 6 1̇ - | 5 1 2 3 2 1 | 2 - - -'
    },
    {
        'title': '茉莉花',
        'key': 'C',
        'jianpu': '3 3 5 6 1̇ 1̇ 6 | 5 5 6 5 - | 3 3 5 6 1̇ 1̇ 6 | 5 5 6 5 -'
    },
    {
        'title': '🎵 时值练习·八分音符',
        'key': 'C',
        'jianpu': '1 2 3 1 1 2 3 1 | 1_ 2_ 3_ 1_ 1_ 2_ 3_ 1_ | 3 4 5 - 3 4 5 - | 3_ 4_ 5_ -_ 3_ 4_ 5_ -_ | 5̇ 6 5̇ 4 3 1 5̇ 6 5̇ 4 3 1 | 5̇_ 6_ 5̇_ 4_ 3_ 1_ 5̇_ 6_ 5̇_ 4_ 3_ 1_ | 2 5 1 - 2 5 1 - | 2_ 5_ 1_ -_ 2_ 5_ 1_ -_'
    },
    {
        'title': '🎵 时值练习·附点四分音符',
        'key': 'C',
        'jianpu': '1. 1 1. 1 | 5 1. 1 1. | 6. 6 5 3 | 2 1 2 - | 3. 2 1. 5 | 6 5 6 1 | 1 - - -'
    },
    {
        'title': '🎵 时值练习·十六分音符',
        'key': 'C',
        'jianpu': '1__ 5__ 5__ 1__ 1__ 5__ 5__ 1__ | 5__ 5__ 6__ 5__ 4__ 3__ 2__ 1__ | 1__ 2__ 3__ 4__ 5__ 6__ 7__ 1̇__ | 1̇__ 1̇__ 1̇__ -__ 1̇__ 1̇__ 1̇__ -__ | 1 1 1 - | 3 3 3 - | 2 2 2 - | 1 - - -'
    },
    {
        'title': '🎵 时值练习·混合时值',
        'key': 'C',
        'jianpu': '1_ 5_ 6 5 | 3. 5 1 2 | 1__ 2__ 3__ 5__ | 1̇ 6 5 3 | 2_ 1_ -_ 5_ | 6 5 3 - | 1 2 3 5 | 5_ 5_ 5_ 3_ | 1 - - -'
    },
    {
        'title': '匆匆那年（王菲）',
        'key': 'Db',
        'time_signature': '3/4',
        'tempo': 126,
        'jianpu': '3 - 4_3_ | 3. 1_ 2 | 3 2 1 | 2 - - | 1 - 1 | 2. 1_ 2 | 3 - - | 3 - - | 3 - 4_3_ | 3. 1_ 2 | 3 1̇ 7 | 2 - - | 1 - 1 | 2 - 2 | 1̣7̣_ 6̣ - | 6̣ - - | 3_3_ 3_6_ 7_1̇_ | 3_3_ 3_6_ 7_1̇_ | 3_3_ 3_3_ 2_1_ | 6 - - | 1̇_1̇_ 6_7_ 1̇_1̇_ | 2̇_2̇_ 2̇_5̇_ 5̇_5̇_ | 3̇_3̇_ 3̇_2̇_ 1̇ - | 3̇ - - | 3̇_3̇_ 6̇_7̇_ 1̇_1̇_ | 3̇_3̇_ 3̇_2̇_ 1̇ - | 6̇ - - | 1̇_1̇_ 1̇_7_ 6_5_ | 6_6_ 5_4_ 2_4_ | 4_5_ 4_2_ 3_2_ | 3 - - | 2_2_ 1_2_ 2_3_ | 4_2_ 1_3_ 3_2_ | 2_3_ 4_2_ - | 7_7_ 7_6_ 6_5_ | 6_6_ 5_6_ 5_6_ | 7 - - | 3_3_ 3_2_ 1̇_6_ | 1̇_1̇_ 1̇_7_ 6_5_ | 3 - - | 6_5_ 6_7_ 1̇_6_ | 5 - - | 4_5_ 4_3_ 2_1_ | 2_2_ 2_3_ 4_2_ | 3 - - | 1̇_7_ 1̇_7_ 1̇_6_ | 7 - - | 6_5_ 6_5_ 6_1̇_ | 1̇_3̇_ 3̇_4̇_ 3̇_2̇_ | 3̇_2̇_ 3̇_2̇_ 1̇ - | 3̇ - - | 3̇_3̇_ 6̇_7̇_ 1̇_1̇_ | 3̇_3̇_ 3̇_2̇_ 1̇ - | 6̇ - - | 1̇_1̇_ 1̇_7_ 6_5_ | 6_6_ 5_4_ 2_4_ | 4_5_ 4_2_ 3_2_ | 3 - -'
    },
    {
        'title': '🌟 水星记（郭顶）',
        'key': 'F',
        'time_signature': '4/4',
        'tempo': 67,
        'jianpu': '0 - - - | 0. 5̣_ 3_ 2_ 2__1__ 1_ | 1_ 0._ 5̣__ 3_ 2_ 2__1__ 1_ | 1_ 0._ 5̣__ 3_ 2_ 2__1__ 4_ | 4__ 3__ 0._ 1__ 5_ 3_ 2_ 2__1__. | 1_ 6. 5_ 3_ 2_ 2__1__ 2_ | 2 - 0 0 | 0 - - 0 | 0. 5̣_ 3_ 2_ 2__1__ 1_ | 1_ 0._ 5̣__ 3_ 2_ 2__1__ 1_ | 1_ 0._ 5̣__ 3_ 2_ 2__1__ 4_ | 4__ 3__ 0._ 1__ 5_ 3_ 2_ 2__1__. | 1_ 6. 5_ 3_ 2_ 2__1__ 2_ | 2 - 5_ 3_ 2_ 2__1__ 2_. | 0__ 6̣__5̣__ 5̣ - 0__5̣__ 1_ 2_ | 3. 3_ 3__4__ 3 2 0_ 3_ | 4 3_ 2__2__1__1__ 3_ 3__2__ 2_ | 2 - 2_ 1_ 2_ 1_ | 1 - - - | 0 0 1_ 2_ 3_ 5_ | 6_ 5_ 4_ 6_ 5_ 3_ 6_ | 6 - 6_ 5_ 1̇_ 3_ | 3__2__ 5_ 3_ 2_ 5__3__ | 3 - 1_ 2_ 3_ 5_ | 6_ 5_ 3_ 6_ 5_ 3_ b6 | b6_ 5_ 4_ 4_. 0 1̇ 2̇ 1̇ | 1̇ 5 5_5_3_ 2__1__. | 1 - 1_ 2_ 3_ 1_ | 1̇ 1_. 1_ 2_ 3_ 4_ | 4__3__2__ 2_ 3_ 2_. 1_. | 1 - 0 0 | 0 0 1_ 2_ 3_ 5_ | 6_ 5_ 4_ 6_ 5_ 3_ 6_ | 6 - 6_ 5_ 1̇_ 3_ | 3__2__ 5_ 3_ 2_ 5__3__ | 3 - 1_ 2_ 3_ 5_ | 6_ 5_ 3_ 6_ 5_ 3_ b6 | b6_ 5_ 4_ 4_. 0 1̇ 2̇ 1̇ | 1̇ 5 5_5_1̇ 2̇ 3̇ | 3__2__ 1̇ 1̇ 1̇_ 1̇_ 6_ 5_ | 6_ 5_ 3_ 6_ 5_ 3_ 6_ | 6 - 6_ 5_ 1̇_ 3_ | 3__2__ 5_ 3_ 2__2__1__ | 6 - 1_ 2_ 3_ 1_ | 6̣_ 1̇_. 1_ 2_ 3_ 4__3__ | 2 - 3 2__1__. | 1 - - 0'
    }
]


def init_db():
    """初始化数据库并播种内置经典曲目"""
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

    # 内置曲库按曲名增量同步：已有曲目更新谱例与调号，新曲目插入。
    # 只操作 is_builtin=1 的记录，不会覆盖用户自建歌曲。
    for s in BUILTIN_SONGS:
        cursor.execute(
            'SELECT id FROM songs WHERE title = ? AND is_builtin = 1 ORDER BY id ASC LIMIT 1',
            (s['title'],)
        )
        row = cursor.fetchone()
        if row:
            cursor.execute(
                'UPDATE songs SET jianpu = ?, key_signature = ?, time_signature = ?, tempo = ? WHERE id = ?',
                (s['jianpu'], s.get('key', 'C'), s.get('time_signature', '4/4'), s.get('tempo'), row[0])
            )
        else:
            cursor.execute(
                'INSERT INTO songs (title, jianpu, key_signature, time_signature, tempo, is_builtin) VALUES (?, ?, ?, ?, ?, 1)',
                (s['title'], s['jianpu'], s.get('key', 'C'), s.get('time_signature', '4/4'), s.get('tempo'))
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

    if not OCR_AVAILABLE:
        return jsonify({'error': '服务器未安装 tesseract OCR，无法自动识别；请手动粘贴简谱，或安装：brew install tesseract tesseract-lang'}), 501

    try:
        img = Image.open(io.BytesIO(file.read()))
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

    # 4) 下划线（减时线）清理掉，避免干扰音符
    text = text.replace('_', '')

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

        # 保留简谱合法字符：数字 0-7、升降号 # b B、小节线 |、延音线 -、点 .、撇号/逗号、组合高低音点
        cleaned = re.sub(r'[^0-7#bB|\-\s.,\'′″' + _COMBINING_DIACRITICS + r']', ' ', line)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        # 只要包含至少一个简谱数字即可保留
        digits = sum(1 for ch in cleaned if ch in '01234567')
        if cleaned and digits >= 1:
            lines.append(cleaned)

    return '\n'.join(lines), key_hint


# ==================== 曲库 RESTful API（查、增、删） ====================
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
def save_jianpu_song():
    """保存用户自建简谱歌曲到数据库"""
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    jianpu = (data.get('jianpu') or '').strip()
    key_signature = (data.get('key') or 'C').strip()

    if not title:
        return jsonify({'error': '歌曲标题不能为空'}), 400
    if not jianpu:
        return jsonify({'error': '简谱内容不能为空'}), 400

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO songs (title, jianpu, key_signature, is_builtin) VALUES (?, ?, ?, 0)',
        (title, jianpu, key_signature)
    )
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        'status': 'ok',
        'song': {
            'id': new_id,
            'title': title,
            'jianpu': jianpu,
            'key': key_signature,
            'is_builtin': False
        }
    }), 201


@app.route('/api/jianpu/songs/<int:song_id>', methods=['PUT'])
def update_jianpu_song(song_id):
    """编辑并保存已有歌曲（曲谱文本 / 调号 / 拍号 / 速度 / 标题）。内置与自建歌曲均可修正。"""
    data = request.get_json() or {}
    jianpu = (data.get('jianpu') or '').strip()
    key_signature = (data.get('key') or '').strip()
    time_signature = (data.get('time_signature') or '').strip()
    tempo = data.get('tempo')
    title = (data.get('title') or '').strip()

    if not jianpu:
        return jsonify({'error': '简谱内容不能为空'}), 400

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, title FROM songs WHERE id = ?', (song_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '未找到指定歌曲'}), 404

    # 动态构建更新字段：只更新请求中提供的字段
    fields = ['jianpu = ?']
    values = [jianpu]
    if title:
        fields.append('title = ?')
        values.append(title)
    if key_signature:
        fields.append('key_signature = ?')
        values.append(key_signature)
    if time_signature:
        fields.append('time_signature = ?')
        values.append(time_signature)
    if tempo is not None:
        try:
            tempo_val = int(tempo)
            fields.append('tempo = ?')
            values.append(tempo_val if tempo_val > 0 else None)
        except (TypeError, ValueError):
            pass

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
def put_jianpu_song_image(song_id):
    """上传或替换歌曲谱图，图片以 BLOB 直接保存在 SQLite 中。"""
    file = request.files.get('image')
    if not file or not file.filename:
        return jsonify({'error': '请选择要保存的谱图图片'}), 400
    if file.mimetype not in ALLOWED_SONG_IMAGE_TYPES:
        return jsonify({'error': '仅支持 JPG、PNG、GIF 或 WebP 图片'}), 400

    image_data = file.read()
    if not image_data:
        return jsonify({'error': '图片内容为空'}), 400
    if len(image_data) > MAX_SONG_IMAGE_BYTES:
        return jsonify({'error': '图片不能超过 8 MB'}), 413

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


@app.errorhandler(404)
def not_found(_error):
    return render_template('index.html'), 404


if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    host = os.environ.get('FLASK_HOST', '127.0.0.1')
    port = int(os.environ.get('FLASK_PORT', '5000'))
    app.run(debug=debug, host=host, port=port)

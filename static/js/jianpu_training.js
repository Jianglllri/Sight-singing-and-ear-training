// 简谱听写训练：内置曲库 + 自定义导入 + 三档难度（听走向 / 听唱名 / 听写全谱）
// 八度标记：组合高音点 1̇（U+0307）、组合低音点（U+0323），兼容 1' / 1, 写法
(function () {
    // ===== 内置简谱曲库（默认 1 = C，C4 为基准） =====
    var DEFAULT_STATIC_SONGS = [
        { id: 1, title: '两难（加木）', key: 'C', is_builtin: 1, jianpu: '0 0 0 6 5 6 6 | 6 3 2 3 3 4 5 5 | 5 3 2 3 3 3 2 3 2 3 | 6 7 1 5 5 5 5 | 6 7 1 6 6 6 5 6 6 | 6 3 2 3 3 4 5 5 | 5 3 2 3 3 3 2 3 2 3 | 6 7 1 5 5 5 5 | 6 7 1 1̇ 1̇ 7 6 3 | 6 6 3 3 3 3 3 3 2 3 2 | 3 3 3 3 3 3 3 2 3. 6 | 6 1 6 1 3 3 2 3 2 3 | 3 3 3 2 3 0 2 3 3 | 6 6 3 3 3 1 2 1 2 | 6̣. 3 3 5 5 1 2 1 2 | 6̣. 3 3 5 5 1 2 1 2 | 6 3 3 3 5 3 5 3 1 1 | 1 1 5 3 1 1 1 1̣ 3 | 0 1 1 1' },
        { id: 2, title: '问风（金渔）', key: 'Ab', is_builtin: 1, jianpu: '6̣ 3 2 3 6̣ 3 2 3 | 6̣ 3 2 3 7̣ 3 2 3 | 7̣ 1 7̣ 5̣ 3 2 3 5 | 3 2 3 5 1 7 1 2 | 3 2 3 2 3 3 2 | 3 2 3 3 2 3 5 | 3 6̣ - - | 3 2 3 2 3 3 2 | 3 2 3 3 2 3 5 | 5 6̣ 6̣ - - | 1̇ 6 6 5 3 | 5 3 2 3 3 2 1 | 2 2 2 3 3 - | 6̣ 6̣ 6̣ 6̣ 6̣ 6̣ | 5 5 5 5 1 7 6 | 6̣ - - - | 3 6̣ 5 6̣ 5 6̣ 5 | 6̣ - 6 6 6 6 | 3 6̣ 5 6̣ 5 6̣ 5 | 3 - 6 6 6 6 | 3 6̣ 3 6 | 2 1 2 1 2 3 | 2 1 6̣ - - -' },
        { id: 3, title: '暖暖（梁静茹）', key: 'Bb', is_builtin: 1, jianpu: '2 3 3 2 3 3 | 2 3 5 3 1 1 5 | 6̣. 3 2 1 2 | 3 - 0 5 1 2 | 2 3 3 2 3 3 | 2 3 5 3 1 1 7 6̣ | 3 2 1 2 1 - - | 1 7 6̣ 1 2 1 2 | 3 5 2 3 1 1 7 6 | 1 2 3 2 1 2 | 3 - 1 7 | 6 1 2 3 2 1 2 | 3 5 5 3 6 3 2 1. | 3 2 2 1 2 1 - 0 1 3 4 | 5 1 3 4 5 6 7 | 1̇ 3 3 4 5 - 6 | 5 4 5 1 6 6 7 1̇ | 7 5 3 4 5 6 7 | 1 7 6 5 - | 4 5 6 4 5 1̇ | 1̇ 7 5 1 3 2 1 | 1 - - -' },
        { id: 4, title: '青花瓷（周杰伦）', key: 'D', is_builtin: 1, jianpu: '3 5 6 1̇ 1̇ 6 1̇ 2̇ 1̇ | 1̇ 6 5 3 5 6 5 3 2 | 3 5 6 1̇ 1̇ 6 1̇ 2̇ 1̇ | 1̇ 6 5 3 2 3 2 1 - | 3 5 6 1̇ 1̇ 6 1̇ 2̇ 1̇ | 1̇ 6 5 3 5 6 5 3 2 | 3 5 6 1̇ 1̇ 6 1̇ 2̇ 1̇ | 1̇ 6 5 3 2 1 2 1 -' },
        { id: 5, title: '时间煮雨（郁可唯）', key: 'Bb', is_builtin: 1, jianpu: '3 5 6 5 3 2 1 | 3 5 6 5 3 2 3 | 5 6 1̇ 6 5 3 2 1 | 3 5 2 3 2 1 1 - | 1̇ 7 6 5 6 5 3 | 5 6 1̇ 2̇ 1̇ 7 6 - | 1̇ 7 6 5 6 5 3 2 1 | 3 5 2 3 2 1 1 -' },
        { id: 6, title: '消愁（毛不易）', key: 'C', is_builtin: 1, jianpu: '1 1 1 6̣ 1 2 3 | 2 2 2 1 2 3 1 - | 3 3 3 2 3 5 6 | 5 5 5 3 5 6 3 - | 6 6 6 5 6 1̇ 2̇ | 1̇ 1̇ 1̇ 6 1̇ 2̇ 6 - | 5 5 5 3 5 6 1̇ 2 | 3 2 1 2 1 - - -' },
        { id: 7, title: '像我这样的人（毛不易）', key: 'C', is_builtin: 1, jianpu: '1 2 3 5 3 2 1 6̣ | 1 2 3 2 1 2 - - | 1 2 3 5 3 2 1 6̣ | 1 2 3 2 1 1 - - | 3 5 6 1̇ 6 5 3 2 | 1 2 3 2 1 2 - - | 3 5 6 1̇ 6 5 3 2 | 1 2 3 2 1 1 - -' },
        { id: 8, title: '平凡的一天（毛不易）', key: 'C', is_builtin: 1, jianpu: '1 2 3 5 5 6 5 3 | 2 3 2 1 2 - - - | 1 2 3 5 5 6 5 3 | 2 3 2 1 1 - - - | 3 5 6 1̇ 1̇ 6 5 3 | 2 3 2 1 2 - - - | 3 5 6 1̇ 1̇ 6 5 3 | 2 3 2 1 1 - - -' },
        { id: 9, title: '小星星', key: 'C', is_builtin: 1, jianpu: '1 1 5 5 6 6 5 - | 4 4 3 3 2 2 1 - | 5 5 4 4 3 3 2 - | 5 5 4 4 3 3 2 -' },
        { id: 10, title: '两只老虎', key: 'C', is_builtin: 1, jianpu: '1 2 3 1 | 1 2 3 1 | 3 4 5 - | 3 4 5 - | 5̇ 6 5̇ 4 3 1 | 5̇ 6 5̇ 4 3 1 | 2 5 1 - | 2 5 1 -' },
        { id: 11, title: '欢乐颂', key: 'C', is_builtin: 1, jianpu: '3 3 4 5 5 4 3 2 | 1 1 2 3 3 2 2 - | 3 3 4 5 5 4 3 2 | 1 1 2 3 2 1 1 -' },
        { id: 12, title: '生日快乐', key: 'C', is_builtin: 1, jianpu: '5 5 6 5 1̇ 7 | 5 5 6 5 2̇ 1̇ | 5̇ 5̇ 3̇ 1̇ 7 6 | 4̇ 4̇ 3̇ 1̇ 2̇ 1̇' },
        { id: 13, title: '送别', key: 'C', is_builtin: 1, jianpu: '5 3 5 1̇ - | 7 6 1̇ - | 5 1 2 3 2 1 | 2 - - -' },
        { id: 14, title: '茉莉花', key: 'C', is_builtin: 1, jianpu: '3 3 5 6 1̇ 1̇ 6 | 5 5 6 5 - | 3 3 5 6 1̇ 1̇ 6 | 5 5 6 5 -' },
        { id: 15, title: '🎵 时值练习·八分音符', key: 'C', is_builtin: 1, jianpu: '1 2 3 1 1 2 3 1 | 1_ 2_ 3_ 1_ 1_ 2_ 3_ 1_ | 3 4 5 - 3 4 5 - | 3_ 4_ 5_ -_ 3_ 4_ 5_ -_ | 5̇ 6 5̇ 4 3 1 5̇ 6 5̇ 4 3 1 | 5̇_ 6_ 5̇_ 4_ 3_ 1_ 5̇_ 6_ 5̇_ 4_ 3_ 1_ | 2 5 1 - 2 5 1 - | 2_ 5_ 1_ -_ 2_ 5_ 1_ -_' },
        { id: 16, title: '🎵 时值练习·附点四分音符', key: 'C', is_builtin: 1, jianpu: '1. 1 1. 1 | 5 1. 1 1. | 6. 6 5 3 | 2 1 2 - | 3. 2 1. 5 | 6 5 6 1 | 1 - - -' },
        { id: 17, title: '🎵 时值练习·十六分音符', key: 'C', is_builtin: 1, jianpu: '1__ 5__ 5__ 1__ 1__ 5__ 5__ 1__ | 5__ 5__ 6__ 5__ 4__ 3__ 2__ 1__ | 1__ 2__ 3__ 4__ 5__ 6__ 7__ 1̇__ | 1̇__ 1̇__ 1̇__ -__ 1̇__ 1̇__ 1̇__ -__ | 1 1 1 - | 3 3 3 - | 2 2 2 - | 1 - - -' },
        { id: 18, title: '🎵 时值练习·混合时值', key: 'C', is_builtin: 1, jianpu: '1_ 5_ 6 5 | 3. 5 1 2 | 1__ 2__ 3__ 5__ | 1̇ 6 5 3 | 2_ 1_ -_ 5_ | 6 5 3 - | 1 2 3 5 | 5_ 5_ 5_ 3_ | 1 - - -' }
    ];

    var JIANPU_LIBRARY = DEFAULT_STATIC_SONGS;

    var HIGH_DOT = '\u0307'; // 组合高音点
    var LOW_DOT = '\u0323';  // 组合低音点
    var SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // 唱名到半音数
    var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    var BASE_MIDI = 60; // 默认 1 = C4
    var PLAY_GAP_MS = 800;

    // 完整的 12 个半音调号移调偏移字典（支持任意原调/变调转换，如 1=C 转 1=A、1=bA、1=bB 等）
    var KEY_OFFSETS = {
        'C': 0, 'B#': 0,
        'C#': 1, 'Db': 1,
        'D': 2,
        'D#': 3, 'Eb': 3,
        'E': 4, 'Fb': 4,
        'F': 5, 'E#': 5,
        'F#': 6, 'Gb': 6,
        'G': 7,
        'G#': 8, 'Ab': 8,
        'A': 9,
        'A#': 10, 'Bb': 10,
        'B': 11, 'Cb': 11
    };

    // 动态获取当前选定的基准 MIDI 音高（结合播放调号与升降八度设置）
    function getCurrentBaseMidi() {
        var keySelect = document.getElementById('jianpu-play-key');
        var octaveSelect = document.getElementById('jianpu-octave-shift');
        var key = keySelect ? keySelect.value : 'C';
        var octShift = octaveSelect ? parseInt(octaveSelect.value, 10) : 0;
        var offset = KEY_OFFSETS[key] !== undefined ? KEY_OFFSETS[key] : 0;
        return BASE_MIDI + offset + (octShift * 12);
    }

    var correctCount = 0;
    var totalCount = 0;
    var songNotes = [];   // 当前曲谱解析结果
    var current = null;   // 当前题：{notes:[{note,octave,midi,src}]}
    var answered = false;
    var playing = false;
    var userPicks = [];   // 听唱名的选择
    var lastSegment = null; // 供重听

    // ===== 简谱解析（支持四分音符 1拍、八分音符 0.5拍、十六分音符 0.25拍、附点及延音） =====

    // 解析单个记号：如 1 (四分) / 1_ 或 1̲ (八分) / 1__ (十六分) / 1. (附点四分1.5拍) / 1_. (附点八分0.75拍) / #4_ / b7_ / 1̇_ / 0_
    function parseJianpuToken(token) {
        if (!token) return null;
        var raw = token;

        // 检测减时线（下划线 _ 或 Unicode 组合下划线 \u0332 或反斜杠 \）
        var underlineCount = (raw.match(/[_\\|\u0332]/g) || []).length;
        // 检测附点 .
        var isDotted = raw.indexOf('.') !== -1;

        // 计算拍数 beats：默认四分音符为 1 拍，每条减时线将时值减半
        var beats = 1.0;
        if (underlineCount === 1) {
            beats = 0.5;   // 八分音符（半拍）
        } else if (underlineCount >= 2) {
            beats = 0.25;  // 十六分音符（四分之一拍）
        }
        if (isDotted) {
            beats *= 1.5;  // 附点增加一半时值
        }

        // 清理时值标记以提取音高
        var cleanToken = raw.replace(/[_\\|\u0332.]/g, '');
        if (cleanToken === '0' || cleanToken === 'o' || cleanToken === 'O') {
            return { isRest: true, degree: 0, accidental: 0, octave: 0, beats: beats, rawToken: raw, isEighth: underlineCount === 1, isSixteenth: underlineCount >= 2, isDotted: isDotted };
        }

        // 归一化音乐符号：♭→b、♯→#，大写 B 视为降号（OCR 常见），i/I 视为高音 1
        var t = cleanToken.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/B/g, 'b')
                          .replace(/[iI]/g, '1\u0307');
        var accidental = 0;
        if (t.charAt(0) === '#') { accidental = 1; t = t.slice(1); }
        else if (t.charAt(0) === 'b') { accidental = -1; t = t.slice(1); }

        var degree = parseInt(t.charAt(0), 10);
        if (!(degree >= 1 && degree <= 7)) return null;
        t = t.slice(1);

        // 高音点：组合符 U+0307 或 ASCII '；低音点：组合符 U+0323 或 ASCII ,
        var highDots = (t.match(/[\u0307']/g) || []).length;
        var lowDots = (t.match(/[\u0323,]/g) || []).length;
        var octave = highDots - lowDots;

        return {
            isRest: false,
            degree: degree,
            accidental: accidental,
            octave: octave,
            beats: beats,
            rawToken: raw,
            isEighth: underlineCount === 1,
            isSixteenth: underlineCount >= 2,
            isDotted: isDotted
        };
    }

    // 解析整段简谱文本 -> 音符数组（- 延音累加 beats，| 分小节只做分组）
    function parseJianpu(text) {
        var bars = String(text || '').split('|');
        var result = [];
        var ok = true;
        bars.forEach(function (bar) {
            bar = bar.trim();
            if (!bar) return;
            // 归一化：全角数字、音乐符号、字母 i（高音 1）、字母 o（休止符 0）、中文附点
            bar = bar.replace(/[０-９]/g, function (s) { return String.fromCharCode(s.charCodeAt(0) - 0xfee0); });
            bar = bar.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/B/g, 'b');
            bar = bar.replace(/[iI]/g, '1\u0307');
            bar = bar.replace(/[\u00b7\u2022\u25cf\uff0e]/g, '.');
            bar = bar.replace(/(?<=[0-7|\-\s])[oO](?=[0-7|\-\s]|$)/g, '0');
            bar = bar.replace(/^[oO](?=[0-7|\-\s]|$)/g, '0');

            // 按音符记号切分：升降号 + 数字 + 高低音点 + 可选减时线(_ / \u0332 / \) + 可选附点 .，以及延音线「-」
            var tokens = bar.match(/(?:[#b]?[0-7][\u0307'\u0323,._\u0332\\]*)|-/g) || [];
            tokens.forEach(function (token) {
                if (token === '-') {
                    var last = result[result.length - 1];
                    if (last) last.beats += 1;
                    return;
                }
                var note = parseJianpuToken(token);
                if (note) {
                    note.barText = bar;
                    result.push(note);
                } else {
                    ok = false;
                }
            });
        });
        result.allValid = ok;
        return result;
    }

    // 音符 -> 规范简谱记号（用组合点字符展示）
    function noteToToken(note) {
        if (note.isRest) return '0';
        var s = (note.accidental === 1 ? '#' : note.accidental === -1 ? 'b' : '') + note.degree;
        if (note.octave > 0) s += HIGH_DOT.repeat(note.octave);
        if (note.octave < 0) s += LOW_DOT.repeat(-note.octave);
        return s;
    }

    // 归一化用户输入，便于与规范记号比对
    function normalizeTokenInput(text) {
        var note = parseJianpuToken(String(text || '').trim().replace(/\s+/g, ''));
        return note ? noteToToken(note) : null;
    }

    function jianpuToMidi(note) {
        if (note.isRest) return null;
        var base = getCurrentBaseMidi();
        return base + SEMITONES[note.degree - 1] + note.accidental + 12 * note.octave;
    }

    function midiToPlayable(midi) {
        return { note: NOTE_NAMES[midi % 12], octave: Math.floor(midi / 12) - 1 };
    }

    // ===== 曲谱载入与预览 =====

    function loadSource(silent) {
        var text = document.getElementById('jianpu-text').value;
        var notes = parseJianpu(text);
        if (!notes.length) {
            setStatus('未能解析出任何音符，请检查简谱格式', 'bad');
            return false;
        }
        if (!notes.allValid && !silent) {
            setStatus('部分记号无法识别（已忽略），请检查标红记号', 'bad');
        }
        songNotes = notes;
        renderPreview();
        renderRichPreview();
        if (notes.allValid || silent) {
            setStatus('曲谱解析成功，共 ' + notes.length + ' 个音符，点击「下一题」开始', 'ok');
        }
        return true;
    }

    function renderPreview() {
        var preview = document.getElementById('jianpu-preview');
        preview.innerHTML = '';
        preview.style.display = 'block';

        // 按小节分组展示
        var bars = [];
        var cur = null;
        var curBarText = null;
        songNotes.forEach(function (note) {
            if (note.barText !== curBarText) {
                cur = [];
                bars.push(cur);
                curBarText = note.barText;
            }
            cur.push(note);
        });

        function lineTypeOf(note) {
            if (note.isRest) return 0;
            if (note.isSixteenth) return 2;
            if (note.isEighth) return 1;
            return 0;
        }

        function makeTok(note, idx) {
            var tok = document.createElement('span');
            tok.className = 'jianpu-note-tok';
            tok.setAttribute('data-note-idx', idx);
            if (note.isRest) tok.classList.add('rest');
            if (note.isDotted) tok.classList.add('is-dotted');
            tok.textContent = noteToToken(note);
            return tok;
        }

        var globalIndex = 0;
        bars.forEach(function (bar) {
            var barSpan = document.createElement('span');
            barSpan.className = 'bar';
            var i = 0;
            while (i < bar.length) {
                var note = bar[i];
                var lt = lineTypeOf(note);
                // 休止符、四分音符、附点音符单独渲染（不参与 beam）
                if (lt === 0 || note.isDotted) {
                    barSpan.appendChild(makeTok(note, globalIndex++));
                    barSpan.appendChild(document.createTextNode(' '));
                    i++;
                    continue;
                }
                // 收集连续相同 lineType（且不带附点）的音符，组成 beam
                var beam = document.createElement('span');
                beam.className = 'jianpu-beam' + (lt === 2 ? ' beam-double' : ' beam-single');
                while (i < bar.length) {
                    var n = bar[i];
                    if (lineTypeOf(n) !== lt) break;
                    if (n.isDotted) break;
                    beam.appendChild(makeTok(n, globalIndex++));
                    i++;
                }
                barSpan.appendChild(beam);
                barSpan.appendChild(document.createTextNode(' '));
            }
            preview.appendChild(barSpan);
        });
    }

    // ===== 出题 =====

    // 从曲谱中抽取连续、不含休止符的片段
    function pickSegment() {
        var lenSel = document.getElementById('jianpu-length').value;
        var usable = songNotes.filter(function (n) { return !n.isRest; });
        if (!usable.length) return null;

        var picked;
        if (lenSel === 'bar') {
            var barTexts = [];
            usable.forEach(function (n) {
                if (barTexts.indexOf(n.barText) === -1) barTexts.push(n.barText);
            });
            var bar = barTexts[Math.floor(Math.random() * barTexts.length)];
            picked = usable.filter(function (n) { return n.barText === bar; });
        } else {
            var want = parseInt(lenSel, 10);
            if (usable.length < want) picked = usable.slice();
            else {
                var start = Math.floor(Math.random() * (usable.length - want + 1));
                picked = usable.slice(start, start + want);
            }
        }
        return picked.map(function (note) {
            var midi = jianpuToMidi(note);
            var playable = midiToPlayable(midi);
            return {
                degree: note.degree,
                accidental: note.accidental,
                octave: note.octave,
                beats: note.beats || 1.0,
                isEighth: note.isEighth,
                isSixteenth: note.isSixteenth,
                isDotted: note.isDotted,
                midi: midi,
                note: playable.note,
                pcOctave: playable.octave,
                token: noteToToken(note)
            };
        });
    }

    // 动态真实节拍发声：根据音符时值（四分/八分/十六分/附点/延音）计算真实毫秒时长
    function playSegment(notes, force) {
        if (!window.audioSystem || !notes || !notes.length) return;
        if (playing && !force) return;
        playing = true;
        var bpm = 82;
        var beatMs = 60000 / bpm;
        var t = 0;
        notes.forEach(function (p, i) {
            var b = p.beats || 1.0;
            var durMs = b * beatMs;
            setTimeout(function () {
                var playSec = Math.max(0.18, durMs * 0.00085);
                audioSystem.playNote(p.note, p.pcOctave, playSec);
                if (i === notes.length - 1) {
                    setTimeout(function () { playing = false; }, durMs + 100);
                }
            }, t);
            t += durMs;
        });
    }

    function setStatus(text, kind) {
        var el = document.getElementById('jianpu-status');
        el.textContent = text;
        el.classList.remove('ok', 'bad');
        if (kind) el.classList.add(kind);
    }

    function rateText() {
        if (!totalCount) return '-';
        return Math.round((correctCount / totalCount) * 1000) / 10 + '%';
    }

    function updateScore() {
        document.getElementById('jianpu-correct').textContent = String(correctCount);
        document.getElementById('jianpu-total').textContent = String(totalCount);
        document.getElementById('jianpu-rate').textContent = rateText();
    }

    function directionOf(midi, prevMidi) {
        return midi > prevMidi ? 'up' : midi < prevMidi ? 'down' : 'flat';
    }

    function directionText(dir) {
        return dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
    }

    // ===== 三档难度的答题区渲染 =====

    function renderAnswers() {
        var area = document.getElementById('jianpu-answer-area');
        area.innerHTML = '';
        var difficulty = document.getElementById('jianpu-difficulty').value;
        userPicks = new Array(current.length).fill(null);

        if (difficulty === 'contour') {
            // 听走向：每对相邻音一组 ↑ → ↓
            var wrap = document.createElement('div');
            wrap.className = 'jianpu-answer-note-row';
            for (var i = 1; i < current.length; i++) {
                (function (idx) {
                    var label = document.createElement('span');
                    label.className = 'note-index';
                    label.textContent = idx + '→' + (idx + 1);
                    wrap.appendChild(label);

                    [['up', '↑'], ['flat', '→'], ['down', '↓']].forEach(function (opt) {
                        var btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'btn btn-outline-primary jianpu-degree-btn';
                        btn.textContent = opt[1];
                        btn.addEventListener('click', function () {
                            if (answered) return;
                            userPicks[idx] = opt[0];
                            wrap.querySelectorAll('[data-pair="' + idx + '"]').forEach(function (b) {
                                b.classList.toggle('active', b === btn);
                            });
                        });
                        btn.setAttribute('data-pair', idx);
                        wrap.appendChild(btn);
                    });
                })(i);
            }
            area.appendChild(wrap);
        } else if (difficulty === 'degree') {
            // 听唱名：每个音选 1-7
            current.forEach(function (p, idx) {
                var row = document.createElement('div');
                row.className = 'jianpu-answer-note-row';

                var label = document.createElement('span');
                label.className = 'note-index';
                label.textContent = '第 ' + (idx + 1) + ' 个音';
                row.appendChild(label);

                for (var d = 1; d <= 7; d++) {
                    (function (deg) {
                        var btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'btn btn-outline-primary jianpu-degree-btn';
                        btn.textContent = String(deg);
                        btn.addEventListener('click', function () {
                            if (answered) return;
                            userPicks[idx] = deg;
                            row.querySelectorAll('button').forEach(function (b) {
                                b.classList.toggle('active', b === btn);
                            });
                        });
                        row.appendChild(btn);
                    })(d);
                }
                area.appendChild(row);
            });
        } else {
            // 听写全谱：每个音一个输入框
            current.forEach(function (p, idx) {
                var row = document.createElement('div');
                row.className = 'jianpu-answer-note-row';

                var label = document.createElement('span');
                label.className = 'note-index';
                label.textContent = '第 ' + (idx + 1) + ' 个音';
                row.appendChild(label);

                var input = document.createElement('input');
                input.className = 'jianpu-dictation-input';
                input.placeholder = '如 5 或 #4̇';
                input.autocomplete = 'off';
                input.spellcheck = false;
                input.addEventListener('input', function () {
                    if (!answered) userPicks[idx] = input.value;
                });
                row.appendChild(input);
                area.appendChild(row);
            });
        }

        var submit = document.createElement('button');
        submit.className = 'btn btn-primary';
        submit.textContent = '提交答案';
        submit.addEventListener('click', submitAnswers);
        area.appendChild(submit);
    }

    function submitAnswers() {
        if (answered || !current) return;
        answered = true;
        totalCount += 1;
        var difficulty = document.getElementById('jianpu-difficulty').value;
        var reveal = document.getElementById('jianpu-reveal');
        reveal.innerHTML = '';

        var okAll = true;
        var userTexts = [];
        var correctTexts = [];

        current.forEach(function (p, idx) {
            var ok;
            var userText;
            if (difficulty === 'contour') {
                if (idx === 0) return; // 第一个音无走向
                var dir = directionOf(p.midi, current[idx - 1].midi);
                ok = userPicks[idx] === dir;
                userText = userPicks[idx] ? directionText(userPicks[idx]) : '未作答';
                correctTexts.push(directionText(dir));
                userTexts.push(userText);
            } else if (difficulty === 'degree') {
                ok = userPicks[idx] === p.degree;
                userText = userPicks[idx] ? String(userPicks[idx]) : '未作答';
                correctTexts.push(p.token);
                userTexts.push(userText);
            } else {
                var norm = normalizeTokenInput(userPicks[idx]);
                ok = norm === p.token;
                userText = norm || (userPicks[idx] ? String(userPicks[idx]) : '未作答');
                correctTexts.push(p.token);
                userTexts.push(userText);
            }
            if (!ok) okAll = false;

            var item = document.createElement('span');
            item.className = ok ? 'ok' : 'bad';
            item.style.marginRight = '0.75rem';
            item.textContent = (difficulty === 'contour' && idx > 0 ? '' : '音' + (idx + 1) + '：') +
                userText + (ok ? ' ✓' : '（应为 ' + (difficulty === 'contour' ? correctTexts[correctTexts.length - 1] : p.token) + '）');
            reveal.appendChild(item);
        });

        if (okAll) correctCount += 1;
        setStatus(okAll ? '回答正确！' : '回答错误，正确答案：' + correctTexts.join(' '), okAll ? 'ok' : 'bad');
        updateScore();
        disableAnswers();
    }

    function disableAnswers() {
        document.querySelectorAll('#jianpu-answer-area button, #jianpu-answer-area input').forEach(function (el) {
            el.disabled = true;
        });
    }

    function nextQuestion() {
        if (!songNotes.length) {
            setStatus('请先解析曲谱（点击「解析曲谱」）', 'bad');
            return;
        }
        var segment = pickSegment();
        if (!segment || segment.length < 2) {
            setStatus('曲谱可用音符太少，无法出题', 'bad');
            return;
        }
        current = segment;
        lastSegment = segment;
        answered = false;
        document.getElementById('jianpu-reveal').innerHTML = '';
        setStatus('听这段旋律（共 ' + segment.length + ' 个音）');
        renderAnswers();
        playSegment(segment);
    }

    // ===== 整曲弹奏 =====
    var playAllToken = 0;

    function playAll() {
        var btn = document.getElementById('jianpu-playall');
        var preview = document.getElementById('jianpu-preview');
        if (!songNotes.length) {
            setStatus('请先解析曲谱（点击「解析曲谱」）', 'bad');
            return;
        }
        if (btn.textContent.indexOf('停止') !== -1) { // 正在弹奏 → 停止
            playAllToken += 1;
            btn.textContent = '▶ 弹奏整曲';
            if (preview) preview.querySelectorAll('.jianpu-note-tok').forEach(function(el) { el.classList.remove('playing'); });
            return;
        }
        playAllToken += 1;
        var token = playAllToken;
        btn.textContent = '■ 停止';
        if (preview) preview.querySelectorAll('.jianpu-note-tok').forEach(function(el) { el.classList.remove('playing'); });

        var t = 0;
        var bpm = 82; // 默认基准拍速 (约 730ms 每四分音符)
        var beatMs = 60000 / bpm;
        songNotes.forEach(function (note, idx) {
            var beats = note.beats || 1.0;
            var noteDurMs = beats * beatMs;
            setTimeout(function () {
                if (token !== playAllToken) return;
                // 更新高亮跳动光标
                if (preview) {
                    preview.querySelectorAll('.jianpu-note-tok').forEach(function(el) { el.classList.remove('playing'); });
                    var currentTok = preview.querySelector('.jianpu-note-tok[data-note-idx="' + idx + '"]');
                    if (currentTok) {
                        currentTok.classList.add('playing');
                    }
                }
                if (!note.isRest) {
                    var midi = jianpuToMidi(note);
                    var p = midiToPlayable(midi);
                    var durSec = Math.max(0.18, noteDurMs * 0.00085);
                    window.audioSystem.playNote(p.note, p.octave, durSec);
                }
            }, t);
            t += noteDurMs;
        });
        setTimeout(function () {
            if (token === playAllToken) {
                btn.textContent = '▶ 弹奏整曲';
                if (preview) preview.querySelectorAll('.jianpu-note-tok').forEach(function(el) { el.classList.remove('playing'); });
            }
        }, t + 300);
    }

    // ===== 简谱图片导入：预览（缩放/拖动）+ OCR 识别 =====
    var lastImageFile = null;
    var imageZoom = 100;

    function setOcrStatus(text, kind) {
        var el = document.getElementById('jianpu-ocr-status');
        el.textContent = text;
        el.classList.remove('ok', 'bad');
        if (kind) el.classList.add(kind);
    }

    function applyImageZoom() {
        var img = document.getElementById('jianpu-image');
        if (!img.naturalWidth) return;
        document.getElementById('jianpu-zoom-label').textContent = imageZoom + '%';
        img.style.width = Math.round(img.naturalWidth * imageZoom / 100) + 'px';
    }

    function setImageZoom(zoom) {
        imageZoom = Math.max(40, Math.min(300, zoom));
        document.getElementById('jianpu-zoom').value = String(imageZoom);
        applyImageZoom();
    }

    function setImageFile(file) {
        if (!file || file.type.indexOf('image') !== 0) {
            setOcrStatus('请选择图片文件', 'bad');
            return;
        }
        lastImageFile = file;
        var reader = new FileReader();
        reader.onload = function () {
            var img = document.getElementById('jianpu-image');
            img.onload = function () {
                document.getElementById('jianpu-image-panel').style.display = 'block';
                setImageZoom(100);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
        document.getElementById('jianpu-ocr').disabled = false;
        setOcrStatus('图片已载入，点击「自动识别为简谱」', '');
    }

    function runOcr() {
        if (!lastImageFile) return;
        var btn = document.getElementById('jianpu-ocr');
        btn.disabled = true;
        setOcrStatus('识别中，请稍候…', '');
        var fd = new FormData();
        fd.append('image', lastImageFile);
        fetch('/api/ocr_jianpu', { method: 'POST', body: fd })
            .then(function (resp) {
                return resp.json().then(function (data) { return { ok: resp.ok, data: data }; });
            })
            .then(function (result) {
                btn.disabled = false;
                if (!result.ok) {
                    setOcrStatus(result.data.error || '识别失败', 'bad');
                    return;
                }
                var text = result.data.text || '';
                var key = result.data.key;
                // 按识别到的调号自动更新播放调号选择器
                if (key && KEY_OFFSETS[key] !== undefined) {
                    var playKeySelect = document.getElementById('jianpu-play-key');
                    if (playKeySelect) playKeySelect.value = key;
                }
                document.getElementById('jianpu-text').value = text;
                loadSource(true);
                var keyMsg = (key && key !== 'C') ? '（已自动对齐为 1=' + key + ' 播放，支持随时改调或升八度）' : '';
                setOcrStatus('识别完成' + keyMsg + '，OCR 可能有轻微偏差，可微调校对后点击「解析曲谱」', 'ok');
            })
            .catch(function () {
                btn.disabled = false;
                setOcrStatus('识别请求失败，请重试', 'bad');
            });
    }

    function enableImagePan() {
        var view = document.getElementById('jianpu-image-view');
        var down = false, sx = 0, sy = 0, sl = 0, st = 0;
        view.addEventListener('pointerdown', function (e) {
            down = true;
            sx = e.clientX; sy = e.clientY;
            sl = view.scrollLeft; st = view.scrollTop;
            view.classList.add('dragging');
        });
        window.addEventListener('pointermove', function (e) {
            if (!down) return;
            view.scrollLeft = sl - (e.clientX - sx);
            view.scrollTop = st - (e.clientY - sy);
        });
        window.addEventListener('pointerup', function () {
            down = false;
            view.classList.remove('dragging');
        });
    }

    function initImageImport() {
        var fileInput = document.getElementById('jianpu-image-file');
        document.getElementById('jianpu-image-btn').addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            if (fileInput.files[0]) setImageFile(fileInput.files[0]);
        });
        document.getElementById('jianpu-ocr').addEventListener('click', runOcr);

        // 支持直接粘贴截图
        document.addEventListener('paste', function (e) {
            var items = (e.clipboardData || {}).items || [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') === 0) {
                    setImageFile(items[i].getAsFile());
                    break;
                }
            }
        });

        // 缩放控制
        document.getElementById('jianpu-zoom').addEventListener('input', function () {
            imageZoom = parseInt(this.value, 10);
            applyImageZoom();
        });
        document.getElementById('jianpu-zoom-in').addEventListener('click', function () { setImageZoom(imageZoom + 20); });
        document.getElementById('jianpu-zoom-out').addEventListener('click', function () { setImageZoom(imageZoom - 20); });
        document.getElementById('jianpu-zoom-reset').addEventListener('click', function () { setImageZoom(100); });
        enableImagePan();
    }

    // ===== 简谱曲库（从 SQLite 数据库异步加载并支持增删） =====
    var songLibraryList = [];

    // 本地持久化曲库辅助函数（支持在 GitHub Pages 等纯前端静态部署环境下运行）
    function getLocalStorageSongs() {
        try {
            var raw = localStorage.getItem('user_jianpu_songs');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function setLocalStorageSongs(songs) {
        try {
            localStorage.setItem('user_jianpu_songs', JSON.stringify(songs));
        } catch (e) {}
    }

    // 从数据库或静态回退曲库异步载入曲库
    function loadLibraryFromDB(selectSongId) {
        return fetch('/api/jianpu/songs')
            .then(function (res) {
                if (!res.ok) throw new Error('API 不可用');
                return res.json();
            })
            .then(function (data) {
                if (data && data.songs && data.songs.length > 0) {
                    songLibraryList = data.songs;
                } else {
                    fallbackLocalLibrary();
                }
                renderLibrarySelect(selectSongId);
            })
            .catch(function () {
                // 静态环境（如 GitHub Pages）或无后端环境时的优雅降级
                fallbackLocalLibrary();
                renderLibrarySelect(selectSongId);
            });
    }

    function fallbackLocalLibrary() {
        var localCustoms = getLocalStorageSongs();
        songLibraryList = DEFAULT_STATIC_SONGS.concat(localCustoms);
    }

    // 渲染曲谱下拉列表（分组：经典流行曲目 + 自建曲库 + 自定义）
    function renderLibrarySelect(selectSongId) {
        var select = document.getElementById('jianpu-song');
        if (!select) return;
        select.innerHTML = '';

        var builtins = songLibraryList.filter(function (s) { return s.is_builtin; });
        var customs = songLibraryList.filter(function (s) { return !s.is_builtin; });

        // 内置经典流行与名曲分组
        if (builtins.length > 0) {
            var gBuiltin = document.createElement('optgroup');
            gBuiltin.label = '🌟 经典流行与练耳名曲';
            builtins.forEach(function (song) {
                var opt = document.createElement('option');
                opt.value = String(song.id);
                opt.textContent = song.title + (song.key && song.key !== 'C' ? ' (1=' + song.key + ')' : '');
                gBuiltin.appendChild(opt);
            });
            select.appendChild(gBuiltin);
        }

        // 自建曲库分组
        if (customs.length > 0) {
            var gCustom = document.createElement('optgroup');
            gCustom.label = '📁 我的自建曲库';
            customs.forEach(function (song) {
                var opt = document.createElement('option');
                opt.value = String(song.id);
                opt.textContent = song.title + ' [自建]';
                gCustom.appendChild(opt);
            });
            select.appendChild(gCustom);
        }

        // 自定义输入项
        var optCustomInput = document.createElement('option');
        optCustomInput.value = 'custom';
        optCustomInput.textContent = '✍️ 自定义导入 / 编写…';
        select.appendChild(optCustomInput);

        // 默认选中项处理
        if (selectSongId) {
            select.value = String(selectSongId);
        } else if (builtins.length > 0) {
            select.value = String(builtins[0].id);
        }

        applySelectedSong();
    }

    // 应用当前选中的歌曲
    function applySelectedSong() {
        var select = document.getElementById('jianpu-song');
        var delBtn = document.getElementById('jianpu-delete-btn');
        var val = select.value;

        if (val === 'custom') {
            document.getElementById('jianpu-text').value = '';
            document.getElementById('jianpu-preview').style.display = 'none';
            if (delBtn) delBtn.style.display = 'none';
            setStatus('粘贴或输入你的简谱后，点击「解析曲谱」，亦可存入曲库');
            return;
        }

        var found = songLibraryList.find(function (s) { return String(s.id) === val; });
        if (found) {
            document.getElementById('jianpu-text').value = found.jianpu;
            // 自动同步播放调号选择器与八度
            var key = found.key || 'C';
            var playKeySelect = document.getElementById('jianpu-play-key');
            var octaveSelect = document.getElementById('jianpu-octave-shift');
            if (playKeySelect && KEY_OFFSETS[key] !== undefined) {
                playKeySelect.value = key;
            }
            if (octaveSelect) {
                octaveSelect.value = '0';
            }
            loadSource(true);
            // 只有自建歌曲才显示删除按钮
            if (delBtn) {
                delBtn.style.display = found.is_builtin ? 'none' : 'inline-block';
            }
        }
    }

    // 初始化曲库相关事件（保存、删除、切换）
    function initLibraryCRUD() {
        var select = document.getElementById('jianpu-song');
        var toggleSaveBtn = document.getElementById('jianpu-toggle-save');
        var saveBar = document.getElementById('jianpu-save-bar');
        var saveBtn = document.getElementById('jianpu-save-btn');
        var delBtn = document.getElementById('jianpu-delete-btn');

        // 切换曲目
        select.addEventListener('change', applySelectedSong);

        // 切换保存栏显示/隐藏
        if (toggleSaveBtn && saveBar) {
            toggleSaveBtn.addEventListener('click', function () {
                var isHidden = saveBar.style.display === 'none';
                saveBar.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    var input = document.getElementById('jianpu-custom-title');
                    if (input) input.focus();
                }
            });
        }

        // 保存自建曲谱到数据库
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var title = (document.getElementById('jianpu-custom-title').value || '').trim();
                var jianpu = (document.getElementById('jianpu-text').value || '').trim();
                var key = document.getElementById('jianpu-custom-key').value || 'C';

                if (!title) {
                    setStatus('请输入歌曲名称！', 'bad');
                    return;
                }
                if (!jianpu) {
                    setStatus('简谱内容不能为空！请先输入或粘贴简谱', 'bad');
                    return;
                }

                saveBtn.disabled = true;
                saveBtn.textContent = '保存中…';

                fetch('/api/jianpu/songs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: title, jianpu: jianpu, key: key })
                })
                    .then(function (res) {
                        if (!res.ok) throw new Error('API 不可用');
                        return res.json();
                    })
                    .then(function (data) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = '💾 确认存入数据库';
                        if (data.error) {
                            setStatus(data.error, 'bad');
                            return;
                        }
                        setStatus('歌曲「' + title + '」已成功存入曲库！', 'ok');
                        if (saveBar) saveBar.style.display = 'none';
                        document.getElementById('jianpu-custom-title').value = '';
                        loadLibraryFromDB(data.song.id);
                    })
                    .catch(function () {
                        // 静态部署/前端本地存储回退
                        var customs = getLocalStorageSongs();
                        var newId = 'local_' + Date.now();
                        var newSong = { id: newId, title: title, jianpu: jianpu, key: key, is_builtin: 0 };
                        customs.push(newSong);
                        setLocalStorageSongs(customs);

                        saveBtn.disabled = false;
                        saveBtn.textContent = '💾 确认存入数据库';
                        setStatus('已成功保存歌曲「' + title + '」至本地曲库！', 'ok');
                        if (saveBar) saveBar.style.display = 'none';
                        document.getElementById('jianpu-custom-title').value = '';
                        loadLibraryFromDB(newId);
                    });
            });
        }

        // 删除当前选中的自建歌曲
        if (delBtn) {
            delBtn.addEventListener('click', function () {
                var curId = select.value;
                var found = songLibraryList.find(function (s) { return String(s.id) === curId; });
                if (!found || found.is_builtin) return;

                if (!confirm('确定要从数据库中删除歌曲「' + found.title + '」吗？')) {
                    return;
                }

                delBtn.disabled = true;

                // 如果是本地存储的歌曲或无后端静态环境
                if (String(curId).indexOf('local_') === 0) {
                    var customs = getLocalStorageSongs();
                    customs = customs.filter(function (s) { return String(s.id) !== String(curId); });
                    setLocalStorageSongs(customs);
                    delBtn.disabled = false;
                    setStatus('歌曲「' + found.title + '」已从本地曲库删除！', 'ok');
                    loadLibraryFromDB();
                    return;
                }

                fetch('/api/jianpu/songs/' + curId, { method: 'DELETE' })
                    .then(function (res) {
                        if (!res.ok) throw new Error('API 不可用');
                        return res.json();
                    })
                    .then(function (data) {
                        delBtn.disabled = false;
                        if (data.error) {
                            setStatus(data.error, 'bad');
                            return;
                        }
                        setStatus('歌曲「' + found.title + '」已成功删除！', 'ok');
                        // 重新加载曲库
                        loadLibraryFromDB();
                    })
                    .catch(function () {
                        // 降级检查 localStorage
                        var customs = getLocalStorageSongs();
                        customs = customs.filter(function (s) { return String(s.id) !== String(curId); });
                        setLocalStorageSongs(customs);
                        delBtn.disabled = false;
                        setStatus('歌曲「' + found.title + '」已从本地存储删除！', 'ok');
                        loadLibraryFromDB();
                    });
            });
        }

        // 移调与八度升降控制器切换事件
        var playKeySelect = document.getElementById('jianpu-play-key');
        var octaveSelect = document.getElementById('jianpu-octave-shift');
        function onTransposeChange() {
            var k = playKeySelect ? playKeySelect.value : 'C';
            var o = octaveSelect ? octaveSelect.value : '0';
            var oText = o === '1' ? '，升八度 ▲' : (o === '-1' ? '，降八度 ▼' : '');
            setStatus('当前播放设置已生效：1=' + k + oText + '。点击「▶ 弹奏整曲」即可按新调号发声！', 'ok');
        }
        if (playKeySelect) playKeySelect.addEventListener('change', onTransposeChange);
        if (octaveSelect) octaveSelect.addEventListener('change', onTransposeChange);
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById('jianpu-song')) return;

        initLibraryCRUD();
        loadLibraryFromDB();
        updateScore();
        initImageImport();
        initInputToolbar();

        document.getElementById('jianpu-playall').addEventListener('click', playAll);

        document.getElementById('jianpu-load').addEventListener('click', function () {
            baseMidi = BASE_MIDI; // 手动解析/切换曲库时回到 1=C
            if (loadSource(false)) {
                current = null;
                document.getElementById('jianpu-answer-area').innerHTML = '';
                document.getElementById('jianpu-reveal').innerHTML = '';
                answered = false;
            }
        });
        document.getElementById('jianpu-new').addEventListener('click', nextQuestion);
        document.getElementById('jianpu-replay').addEventListener('click', function () {
            if (lastSegment) playSegment(lastSegment, true);
        });
        document.getElementById('jianpu-difficulty').addEventListener('change', function () {
            if (current && !answered) {
                answered = false;
                document.getElementById('jianpu-reveal').innerHTML = '';
                setStatus('题型已切换，点击「下一题」重新出题');
            }
        });
    });

    // ===== 简谱输入助手工具栏：点击按钮在 textarea 光标处插入字符 =====
    function insertAtCursor(textarea, text) {
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        var value = textarea.value;
        textarea.value = value.substring(0, start) + text + value.substring(end);
        var newPos = start + text.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
        // 触发 input 事件以便其他监听器响应
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function initInputToolbar() {
        var textarea = document.getElementById('jianpu-text');
        if (!textarea) return;
        document.querySelectorAll('#jianpu-input-toolbar [data-insert]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                var text = btn.getAttribute('data-insert') || '';
                insertAtCursor(textarea, text);
            });
        });
        // 实时富文本简谱预览
        textarea.addEventListener('input', renderRichPreview);
        renderRichPreview();
    }

    // ===== 实时富文本简谱预览：textarea 输入时即时渲染带下划线的简谱 =====
    function renderRichPreview() {
        var srcEl = document.getElementById('jianpu-text');
        var targetEl = document.getElementById('jianpu-rich-preview');
        if (!srcEl || !targetEl) return;

        var src = srcEl.value || '';
        var notes = parseJianpu(src);

        targetEl.innerHTML = '';
        if (!notes.length) return;

        // 按小节分组
        var bars = [];
        var cur = null;
        var curBarText = null;
        notes.forEach(function (note) {
            if (note.barText !== curBarText) {
                cur = [];
                bars.push(cur);
                curBarText = note.barText;
            }
            cur.push(note);
        });

        function lineTypeOf(note) {
            if (note.isRest) return 0;
            if (note.isSixteenth) return 2;
            if (note.isEighth) return 1;
            return 0;
        }

        function makeRpNote(note) {
            var span = document.createElement('span');
            span.className = 'rp-note';
            if (note.isRest) span.classList.add('rp-rest');
            if (note.isDotted) span.classList.add('rp-dotted');
            var text = noteToToken(note);
            if (note.isDotted) text += '·';
            span.textContent = text;
            return span;
        }

        bars.forEach(function (bar, barIdx) {
            if (barIdx > 0) {
                var sep = document.createElement('span');
                sep.className = 'rp-bar-sep';
                sep.textContent = '|';
                targetEl.appendChild(sep);
            }
            var i = 0;
            while (i < bar.length) {
                var note = bar[i];
                var lt = lineTypeOf(note);
                if (lt === 0 || note.isDotted) {
                    targetEl.appendChild(makeRpNote(note));
                    i++;
                    continue;
                }
                var beam = document.createElement('span');
                beam.className = 'rp-beam ' + (lt === 2 ? 'rp-sixteenth' : 'rp-eighth');
                while (i < bar.length) {
                    var n = bar[i];
                    if (lineTypeOf(n) !== lt) break;
                    if (n.isDotted) break;
                    beam.appendChild(makeRpNote(n));
                    i++;
                }
                targetEl.appendChild(beam);
            }
        });
    }
})();

// 简谱听写训练：内置曲库 + 自定义导入 + 三档难度（听走向 / 听唱名 / 听写全谱）
// 八度标记：组合高音点 1̇（U+0307）、组合低音点（U+0323），兼容 1' / 1, 写法
(function () {
    // ===== 内置简谱曲库（默认 1 = C，C4 为基准） =====
    // 内置曲库的唯一数据源是仓库根目录 songs.json，
    // 由 tools/build_assets.py 生成 static/js/builtin_songs.js（window.BUILTIN_SONGS_DATA）。
    var DEFAULT_STATIC_SONGS = window.BUILTIN_SONGS_DATA || [];

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
    var current = null;     // 当前题的时间轴（可能包含休止符，休止符只占时值不发声）
    var currentAnswer = []; // 当前题需要作答的音（已剔除休止符）
    var currentSong = null; // 当前加载歌曲的元数据 {key, tempo, timeSignature, title}
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
        bars.forEach(function (bar, barIndex) {
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
                    note.barIndex = barIndex; // 小节唯一标识：相同文本的小节也不会被合并
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
        // 谱面预览只保留 SVG 一份，避免重复显示
        renderSVGPreview();
        if (notes.allValid || silent) {
            setStatus('曲谱解析成功，共 ' + notes.length + ' 个音符，点击「下一题」开始', 'ok');
        }
        return true;
    }

    // 旧的文本预览已彻底移除（与 SVG 预览重复），统一走 renderSVGPreview
    function renderPreview() {
        renderSVGPreview();
    }

    // ===== 出题 =====

    // 将解析后的曲谱按休止符切分为「连续可听片段」：休止符是分句边界，不参与作答
    function buildPlayableRuns() {
        var runs = [];
        var run = [];
        songNotes.forEach(function (n) {
            if (n.isRest) {
                if (run.length) { runs.push(run); run = []; }
            } else {
                run.push(n);
            }
        });
        if (run.length) runs.push(run);
        return runs;
    }

    // 解析音符 -> 题目用音符对象（休止符保留时值，但不含音高）
    function toSegmentNote(note) {
        var midi = note.isRest ? null : jianpuToMidi(note);
        var playable = midi === null ? null : midiToPlayable(midi);
        return {
            isRest: !!note.isRest,
            degree: note.degree,
            accidental: note.accidental,
            octave: note.octave,
            beats: note.beats || 1.0,
            barIndex: note.barIndex,
            isEighth: note.isEighth,
            isSixteenth: note.isSixteenth,
            isDotted: note.isDotted,
            midi: midi,
            note: playable ? playable.note : null,
            pcOctave: playable ? playable.octave : null,
            token: noteToToken(note)
        };
    }

    // 从曲谱中抽取片段：按唯一小节抽取，或在单个连续片段内抽取 N 个音
    function pickSegment() {
        var lenSel = document.getElementById('jianpu-length').value;

        if (lenSel === 'bar') {
            // 按唯一 barIndex 分组，避免两个文本相同的小节被合并抽取
            var barGroups = {};
            songNotes.forEach(function (n) {
                if (n.barIndex === undefined) return;
                (barGroups[n.barIndex] = barGroups[n.barIndex] || []).push(n);
            });
            var barKeys = Object.keys(barGroups);
            if (!barKeys.length) return null;
            // 优先抽取至少含 2 个可作答音的小节
            var playableKeys = barKeys.filter(function (k) {
                return barGroups[k].filter(function (n) { return !n.isRest; }).length >= 2;
            });
            var pool = playableKeys.length ? playableKeys : barKeys;
            var bar = pool[Math.floor(Math.random() * pool.length)];
            return barGroups[bar].map(toSegmentNote);
        }

        // 固定音数：只在单个连续可听片段内取窗口，绝不跨过休止符拼接
        var want = parseInt(lenSel, 10) || 2;
        var runs = buildPlayableRuns();
        if (!runs.length) return null;
        var candidates = runs.filter(function (r) { return r.length >= want; });
        var run = candidates.length
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : runs.reduce(function (a, b) { return b.length > a.length ? b : a; }, runs[0]);
        if (run.length < want) want = run.length;
        var start = Math.floor(Math.random() * (run.length - want + 1));
        return run.slice(start, start + want).map(toSegmentNote);
    }

    // 动态真实节拍发声：根据音符时值（四分/八分/十六分/附点/延音）计算真实毫秒时长
    function playSegment(notes) {
        if (!window.audioSystem || !notes || !notes.length) return;
        // 先停掉上一段（音源 + 未触发定时器），避免重听/下一题时叠音
        window.audioSystem.stopAll();
        playing = true;
        // 使用当前歌曲自身标注的 tempo，未标注时回退 82 BPM
        var bpm = (currentSong && currentSong.tempo) || 82;
        var beatMs = 60000 / bpm;
        var t = 0;
        notes.forEach(function (p, i) {
            var b = p.beats || 1.0;
            var durMs = b * beatMs;
            window.audioSystem.scheduleTimer(function () {
                if (!p.isRest) { // 休止符只占时间轴，不发声
                    var playSec = Math.max(0.18, durMs * 0.00085);
                    audioSystem.playNote(p.note, p.pcOctave, playSec);
                }
                if (i === notes.length - 1) {
                    window.audioSystem.scheduleTimer(function () { playing = false; }, durMs + 100);
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
        userPicks = new Array(currentAnswer.length).fill(null);

        if (difficulty === 'contour') {
            // 听走向：每对相邻音一组 ↑ → ↓
            var wrap = document.createElement('div');
            wrap.className = 'jianpu-answer-note-row';
            for (var i = 1; i < currentAnswer.length; i++) {
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
            currentAnswer.forEach(function (p, idx) {
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
            currentAnswer.forEach(function (p, idx) {
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

        currentAnswer.forEach(function (p, idx) {
            var ok;
            var userText;
            if (difficulty === 'contour') {
                if (idx === 0) return; // 第一个音无走向
                var dir = directionOf(p.midi, currentAnswer[idx - 1].midi);
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
        if (!segment) {
            setStatus('曲谱可用音符太少，无法出题', 'bad');
            return;
        }
        current = segment; // 时间轴（含休止符）
        currentAnswer = segment.filter(function (n) { return !n.isRest; }); // 需作答的音
        if (currentAnswer.length < 2) {
            setStatus('曲谱可用音符太少，无法出题', 'bad');
            return;
        }
        lastSegment = segment;
        answered = false;
        document.getElementById('jianpu-reveal').innerHTML = '';
        setStatus('听这段旋律（共 ' + currentAnswer.length + ' 个音）');
        renderAnswers();
        playSegment(segment);
    }

    // ===== 整曲弹奏 =====
    var playAllToken = 0;

    function playAll() {
        var btn = document.getElementById('jianpu-playall');
        var preview = document.getElementById('jianpu-svg-preview');
        var noteEls = function () { return preview.querySelectorAll('text.jp-note'); };
        if (!songNotes.length) {
            setStatus('请先解析曲谱（点击「解析曲谱」）', 'bad');
            return;
        }
        if (btn.textContent.indexOf('停止') !== -1) { // 正在弹奏 → 停止
            playAllToken += 1;
            // 真正停止：关闭当前音源并清除所有未触发的定时回调
            if (window.audioSystem) window.audioSystem.stopAll();
            playing = false;
            btn.textContent = '▶ 弹奏整曲';
            if (preview) noteEls().forEach(function(el) { el.classList.remove('playing'); });
            return;
        }
        playAllToken += 1;
        var token = playAllToken;
        // 开始整曲前先清空上一轮残留
        if (window.audioSystem) window.audioSystem.stopAll();
        btn.textContent = '■ 停止';
        if (preview) noteEls().forEach(function(el) { el.classList.remove('playing'); });

        var t = 0;
        var bpm = (currentSong && currentSong.tempo) || 82; // 使用歌曲 tempo，默认约 730ms 每四分音符
        var beatMs = 60000 / bpm;
        songNotes.forEach(function (note, idx) {
            var beats = note.beats || 1.0;
            var noteDurMs = beats * beatMs;
            window.audioSystem.scheduleTimer(function () {
                if (token !== playAllToken) return;
                // 更新高亮跳动光标（SVG 里的数字 text）
                if (preview) {
                    noteEls().forEach(function(el) { el.classList.remove('playing'); });
                    var currentTok = preview.querySelector('text.jp-note[data-note-idx="' + idx + '"]');
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
window.audioSystem.scheduleTimer(function () {
if (token === playAllToken) {
btn.textContent = '▶ 弹奏整曲';
if (preview) noteEls().forEach(function(el) { el.classList.remove('playing'); });
}
}, t + 300);
    }

    // ===== 当前歌曲谱图：本地预览 + SQLite BLOB 保存/替换/删除 =====
    var lastImageFile = null;
    var imageZoom = 100;
    var SONG_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

    function setOcrStatus(text, kind) {
        var el = document.getElementById('jianpu-ocr-status');
        el.textContent = text;
        el.classList.remove('ok', 'bad');
        if (kind) el.classList.add(kind);
    }

    function setImageMeta(text) {
        var el = document.getElementById('jianpu-image-meta');
        if (el) el.textContent = text;
    }

function getSelectedDatabaseSong() {
var select = document.getElementById('jianpu-song');
if (!select || select.value === 'custom' || String(select.value).indexOf('local_') === 0) return null;
return songLibraryList.find(function (song) { return String(song.id) === String(select.value); }) || null;
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

    function showImageEmpty(message) {
        var img = document.getElementById('jianpu-image');
        var empty = document.getElementById('jianpu-image-empty');
        img.hidden = true;
        img.removeAttribute('src');
        img.style.width = '';
        empty.hidden = false;
        empty.innerHTML = message;
        document.getElementById('jianpu-remove-image-btn').disabled = true;
    }

    function showImageSource(source, meta) {
        var img = document.getElementById('jianpu-image');
        var empty = document.getElementById('jianpu-image-empty');
        img.onload = function () {
            img.hidden = false;
            empty.hidden = true;
            setImageZoom(100);
        };
        img.onerror = function () {
            showImageEmpty('谱图读取失败，请尝试重新上传。');
            setImageMeta('图片读取失败');
        };
        img.src = source;
        setImageMeta(meta || '图片存于 SQLite 数据库');
    }

    function loadSelectedSongImage() {
        var song = getSelectedDatabaseSong();
        var saveBtn = document.getElementById('jianpu-save-image-btn');
        lastImageFile = null;
        saveBtn.disabled = true;
        document.getElementById('jianpu-image-file').value = '';
        if (!song) {
            showImageEmpty('静态曲库或自定义输入仅支持本地预览。<br>启动 Flask 版本后，选择数据库中的歌曲即可保存图片。');
            setImageMeta('当前未选择数据库歌曲');
            return;
        }
        if (!song.has_image && !song.static_image) {
            showImageEmpty('这首歌尚未保存谱图。<br>点击左侧「选择简谱图片」后，可保存并在此显示。');
            setImageMeta('图片存于 SQLite 数据库 · 尚未上传');
            return;
        }
        // 静态部署环境（如 GitHub Pages）：无后端，改从内置静态谱图文件加载
        if (!libraryUsesBackend) {
            document.getElementById('jianpu-remove-image-btn').disabled = true;
            if (song.static_image) {
                showImageSource('static/images/scores/' + song.static_image, '内置静态谱图（保存/替换需启动 Flask 版本）');
            } else {
                showImageEmpty('这首歌暂无内置谱图。<br>谱图的保存与展示需要启动 Flask 版本。');
                setImageMeta('静态部署环境 · 无后端谱图');
            }
            return;
        }
        document.getElementById('jianpu-remove-image-btn').disabled = false;
        showImageSource('/api/jianpu/songs/' + encodeURIComponent(song.id) + '/image?t=' + Date.now(), '已从 SQLite 数据库加载谱图');
    }

    function setImageFile(file) {
        if (!file || file.type.indexOf('image/') !== 0) {
            setOcrStatus('请选择图片文件', 'bad');
            return;
        }
        if (file.size > SONG_IMAGE_MAX_BYTES) {
            setOcrStatus('图片不能超过 8 MB', 'bad');
            return;
        }
        lastImageFile = file;
        var song = getSelectedDatabaseSong();
        document.getElementById('jianpu-save-image-btn').disabled = !song;
        document.getElementById('jianpu-ocr').disabled = false;
        showImageSource(URL.createObjectURL(file), '待保存：' + file.name + '（' + Math.ceil(file.size / 1024) + ' KB）');
        setOcrStatus(song ? '图片已载入，可识别简谱或保存/替换当前歌曲谱图' : '图片已本地预览；请选择数据库歌曲后才能保存', '');
    }

    function saveCurrentSongImage() {
        var song = getSelectedDatabaseSong();
        var btn = document.getElementById('jianpu-save-image-btn');
        if (!song) {
            setOcrStatus('请先选择数据库中的歌曲，再保存谱图', 'bad');
            return;
        }
        if (!libraryUsesBackend) {
            setOcrStatus('静态部署环境无法保存谱图，请启动 Flask 版本后操作', 'bad');
            return;
        }
        if (!lastImageFile) {
            setOcrStatus('请先选择一张谱图图片', 'bad');
            return;
        }
        btn.disabled = true;
        btn.textContent = song.has_image ? '替换中…' : '保存中…';
        var fd = new FormData();
        fd.append('image', lastImageFile);
        fetch('/api/jianpu/songs/' + encodeURIComponent(song.id) + '/image', { method: 'PUT', body: fd })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok) throw new Error(result.data.error || '保存失败');
                song.has_image = true;
                lastImageFile = null;
                document.getElementById('jianpu-image-file').value = '';
                btn.textContent = '💾 保存到当前歌曲';
                btn.disabled = true;
                document.getElementById('jianpu-remove-image-btn').disabled = false;
                showImageSource('/api/jianpu/songs/' + encodeURIComponent(song.id) + '/image?t=' + Date.now(), '已保存到 SQLite：' + (result.data.filename || '谱图'));
                setOcrStatus('已保存当前歌曲谱图；下次打开或切换歌曲时会自动显示', 'ok');
            })
            .catch(function (error) {
                btn.textContent = '💾 保存到当前歌曲';
                btn.disabled = false;
                setOcrStatus(error.message || '保存图片失败，请确认正在使用 Flask 版本', 'bad');
            });
    }

    function removeCurrentSongImage() {
        var song = getSelectedDatabaseSong();
        var btn = document.getElementById('jianpu-remove-image-btn');
        if (!song) return;
        if (!libraryUsesBackend) {
            setOcrStatus('静态部署环境的内置谱图无法移除，请启动 Flask 版本后操作', 'bad');
            return;
        }
        if (!song.has_image) return;
        if (!confirm('确定移除「' + song.title + '」的谱图吗？简谱文字不会受影响。')) return;
        btn.disabled = true;
        fetch('/api/jianpu/songs/' + encodeURIComponent(song.id) + '/image', { method: 'DELETE' })
            .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok) throw new Error(result.data.error || '删除失败');
                song.has_image = false;
                showImageEmpty('这首歌尚未保存谱图。<br>选择新图片后可再次上传。');
                setImageMeta('图片已从 SQLite 数据库移除');
                setOcrStatus('已移除当前歌曲谱图，简谱文字未受影响', 'ok');
            })
            .catch(function (error) {
                btn.disabled = false;
                setOcrStatus(error.message || '删除图片失败', 'bad');
            });
    }

    function runOcr() {
        if (!lastImageFile) return;
        var btn = document.getElementById('jianpu-ocr');
        btn.disabled = true;
        setOcrStatus('识别中，请稍候…', '');
        var fd = new FormData();
        fd.append('image', lastImageFile);
        fetch('/api/ocr_jianpu', { method: 'POST', body: fd })
            .then(function (resp) { return resp.json().then(function (data) { return { ok: resp.ok, data: data }; }); })
            .then(function (result) {
                btn.disabled = false;
                if (!result.ok) {
                    setOcrStatus(result.data.error || '识别失败', 'bad');
                    return;
                }
                var text = result.data.text || '';
                var key = result.data.key;
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
            if (document.getElementById('jianpu-image').hidden) return;
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
        document.getElementById('jianpu-save-image-btn').addEventListener('click', saveCurrentSongImage);
        document.getElementById('jianpu-remove-image-btn').addEventListener('click', removeCurrentSongImage);

        document.addEventListener('paste', function (e) {
            var items = (e.clipboardData || {}).items || [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') === 0) {
                    setImageFile(items[i].getAsFile());
                    break;
                }
            }
        });

        document.getElementById('jianpu-zoom').addEventListener('input', function () {
            imageZoom = parseInt(this.value, 10);
            applyImageZoom();
        });
        document.getElementById('jianpu-zoom-in').addEventListener('click', function () { setImageZoom(imageZoom + 20); });
        document.getElementById('jianpu-zoom-out').addEventListener('click', function () { setImageZoom(imageZoom - 20); });
        document.getElementById('jianpu-zoom-reset').addEventListener('click', function () { setImageZoom(100); });
        enableImagePan();
        showImageEmpty('切换歌曲后将在这里显示已保存的谱图。<br>也可选择图片后保存到当前歌曲。');
    }

    // ===== 简谱曲库（从 SQLite 数据库异步加载并支持增删） =====
    var songLibraryList = [];
var libraryUsesBackend = false;

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

    // 把一首歌写入浏览器本地曲库（仅静态部署/网络异常时使用），返回新 id
    function saveLocalCopy(title, jianpu, key) {
        var customs = getLocalStorageSongs();
        var newId = 'local_' + Date.now();
        customs.push({ id: newId, title: title, jianpu: jianpu, key: key || 'C', is_builtin: 0 });
        setLocalStorageSongs(customs);
        return newId;
    }

    // 从后端错误响应中提取可展示的错误信息
    function apiError(status, data) {
        if (data && data.error) return data.error;
        return '服务器返回错误（HTTP ' + status + '）';
    }

    // 在页面上明确展示当前曲库数据来源
    function setLibrarySource(text, kind) {
        var el = document.getElementById('jianpu-library-source');
        if (!el) return;
        el.textContent = text || '';
        el.classList.remove('ok', 'bad');
        if (kind) el.classList.add(kind);
    }

    // 从数据库或静态回退曲库异步载入曲库
    function loadLibraryFromDB(selectSongId) {
        return fetch('/api/jianpu/songs')
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && data.songs && data.songs.length > 0) {
                    libraryUsesBackend = true;
                    songLibraryList = data.songs;
                    setLibrarySource('数据来源：服务器数据库（可增删改，多设备共享）', 'ok');
                } else {
                    libraryUsesBackend = false;
                    fallbackLocalLibrary();
                    setLibrarySource('数据来源：浏览器本地（未连接后端，修改仅保存在本机）');
                }
                renderLibrarySelect(selectSongId);
            })
            .catch(function () {
                // 无后端（如 GitHub Pages 静态部署）时降级到本地曲库
                libraryUsesBackend = false;
                fallbackLocalLibrary();
                setLibrarySource('数据来源：浏览器本地（未检测到后端服务，修改仅保存在本机）');
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
        var updateBtn = document.getElementById('jianpu-update-btn');
        var val = select.value;

        // 「保存修改/另存副本」只在选中曲库歌曲时可用
        if (updateBtn) {
            var selSong = songLibraryList.find(function (s) { return String(s.id) === val; });
            var isLibSong = val !== 'custom' && !!selSong;
            updateBtn.style.display = isLibSong ? 'inline-block' : 'none';
            if (isLibSong) {
                var isBuiltinSong = !!selSong.is_builtin;
                updateBtn.textContent = isBuiltinSong ? '📄 另存为副本' : '💾 保存修改到当前歌曲';
                updateBtn.title = isBuiltinSong
                    ? '内置曲目为只读，将把你的修改另存为一份自建副本'
                    : '将编辑后的简谱文本保存回当前选中的歌曲';
            }
        }

if (val === 'custom') {
document.getElementById('jianpu-text').value = '';
// 清空 SVG 预览
var svgPreview = document.getElementById('jianpu-svg-preview');
if (svgPreview) svgPreview.innerHTML = '';
currentSong = null;
if (delBtn) delBtn.style.display = 'none';
loadSelectedSongImage();
setStatus('粘贴或输入你的简谱后，点击「解析曲谱」，亦可存入曲库');
return;
}

        var found = songLibraryList.find(function (s) { return String(s.id) === val; });
        if (found) {
            document.getElementById('jianpu-text').value = found.jianpu;
            // 记录当前歌曲元数据，供 SVG 预览显示调号/速度
            currentSong = {
                key: found.key || 'C',
                title: found.title || '',
                time_signature: found.time_signature || '4/4',
                tempo: found.tempo || null
            };
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
loadSelectedSongImage();
}
}

    // 初始化曲库相关事件（保存、删除、切换）
function initLibraryCRUD() {
var select = document.getElementById('jianpu-song');
var toggleSaveBtn = document.getElementById('jianpu-toggle-save');
var saveBar = document.getElementById('jianpu-save-bar');
var updateBtn = document.getElementById('jianpu-update-btn');
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
                        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
                    })
                    .then(function (result) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = '💾 确认存入数据库';
                        if (!result.ok) {
                            // 服务器明确报错：展示真实错误，不再伪装成本地保存成功
                            setStatus(apiError(result.status, result.data), 'bad');
                            return;
                        }
                        setStatus('歌曲「' + title + '」已成功存入服务器曲库！', 'ok');
                        if (saveBar) saveBar.style.display = 'none';
                        document.getElementById('jianpu-custom-title').value = '';
                        loadLibraryFromDB(result.data.song.id);
                    })
                    .catch(function () {
                        saveBtn.disabled = false;
                        saveBtn.textContent = '💾 确认存入数据库';
                        // 仅在确认无后端（静态部署）时才自动保存到本地
                        if (!libraryUsesBackend) {
                            var localId = saveLocalCopy(title, jianpu, key);
                            setStatus('未检测到后端服务，已保存到浏览器本地曲库「' + title + '」', 'ok');
                            if (saveBar) saveBar.style.display = 'none';
                            document.getElementById('jianpu-custom-title').value = '';
                            loadLibraryFromDB(localId);
                            return;
                        }
                        // 后端存在但网络异常：询问用户是否改存本地
                        if (confirm('保存到服务器失败（网络异常）。是否改存到浏览器本地？\n注意：本地数据仅当前浏览器可见。')) {
                            saveLocalCopy(title, jianpu, key);
                            if (saveBar) saveBar.style.display = 'none';
                            document.getElementById('jianpu-custom-title').value = '';
                            setStatus('已改存到浏览器本地「' + title + '」（服务器未保存）', 'ok');
                        } else {
                            setStatus('保存失败：无法连接服务器，数据未保存', 'bad');
                        }
                    });
            });
        }

        // 保存修改：将编辑后的简谱写回当前选中的歌曲（内置与自建均可）
        if (updateBtn) {
            updateBtn.addEventListener('click', function () {
                var curId = select.value;
                var found = songLibraryList.find(function (s) { return String(s.id) === String(curId); });
                if (!found) {
                    setStatus('请先从曲库选择一首歌曲再保存修改', 'bad');
                    return;
                }
                var jianpu = (document.getElementById('jianpu-text').value || '').trim();
                if (!jianpu) {
                    setStatus('简谱内容不能为空！', 'bad');
                    return;
                }

                var isBuiltin = !!found.is_builtin;
                var isLocalSong = String(found.id).indexOf('local_') === 0;

                // 本地曲库（静态部署）：直接写 localStorage
                if (isLocalSong || !libraryUsesBackend) {
                    var customs = getLocalStorageSongs();
                    var item = customs.find(function (s) { return String(s.id) === String(found.id); });
                    if (item) {
                        item.jianpu = jianpu;
                        setLocalStorageSongs(customs);
                        found.jianpu = jianpu;
                        setStatus('已保存修改到浏览器本地曲库「' + found.title + '」！', 'ok');
                    } else {
                        setStatus('该曲目不在本地曲库中，且未连接后端，无法保存', 'bad');
                    }
                    return;
                }

                updateBtn.disabled = true;
                updateBtn.textContent = isBuiltin ? '另存中…' : '保存中…';

                // 内置曲目只读：改为新建一份自建副本；自建曲目直接 PUT
                var endpoint = isBuiltin ? '/api/jianpu/songs' : ('/api/jianpu/songs/' + found.id);
                var method = isBuiltin ? 'POST' : 'PUT';
                var payload = isBuiltin
                    ? {
                        title: (found.title || '未命名') + '（副本）',
                        jianpu: jianpu,
                        key: found.key || 'C',
                        time_signature: found.time_signature || '4/4',
                        tempo: found.tempo || null
                    }
                    : { jianpu: jianpu };

                fetch(endpoint, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                    .then(function (res) {
                        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
                    })
                    .then(function (result) {
                        updateBtn.disabled = false;
                        updateBtn.textContent = isBuiltin ? '📄 另存为副本' : '💾 保存修改到当前歌曲';
                        if (!result.ok) {
                            setStatus(apiError(result.status, result.data), 'bad');
                            return;
                        }
                        if (isBuiltin) {
                            setStatus('内置曲目为只读，已另存为副本「' + payload.title + '」', 'ok');
                            loadLibraryFromDB(result.data.song.id);
                            return;
                        }
                        // 同步本地列表中的谱面，避免切歌后丢失修改
                        found.jianpu = jianpu;
                        setStatus('歌曲「' + found.title + '」的简谱已更新保存到服务器！', 'ok');
                    })
                    .catch(function () {
                        updateBtn.disabled = false;
                        updateBtn.textContent = isBuiltin ? '📄 另存为副本' : '💾 保存修改到当前歌曲';
                        setStatus('保存失败：无法连接服务器，修改未保存', 'bad');
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

                // 本地曲库（静态部署）：只删除浏览器本地记录
                if (String(curId).indexOf('local_') === 0 || !libraryUsesBackend) {
                    var customs = getLocalStorageSongs();
                    customs = customs.filter(function (s) { return String(s.id) !== String(curId); });
                    setLocalStorageSongs(customs);
                    delBtn.disabled = false;
                    setStatus('歌曲「' + found.title + '」已从浏览器本地曲库删除！', 'ok');
                    loadLibraryFromDB();
                    return;
                }

                fetch('/api/jianpu/songs/' + curId, { method: 'DELETE' })
                    .then(function (res) {
                        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
                    })
                    .then(function (result) {
                        delBtn.disabled = false;
                        if (!result.ok) {
                            // 服务器删除失败：展示真实错误，不能只删本地记录
                            setStatus(apiError(result.status, result.data), 'bad');
                            return;
                        }
                        setStatus('歌曲「' + found.title + '」已从服务器删除！', 'ok');
                        loadLibraryFromDB();
                    })
                    .catch(function () {
                        delBtn.disabled = false;
                        setStatus('删除失败：无法连接服务器，记录未删除', 'bad');
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
                currentAnswer = [];
                document.getElementById('jianpu-answer-area').innerHTML = '';
                document.getElementById('jianpu-reveal').innerHTML = '';
                answered = false;
            }
        });
        document.getElementById('jianpu-new').addEventListener('click', nextQuestion);
        document.getElementById('jianpu-replay').addEventListener('click', function () {
            if (lastSegment) playSegment(lastSegment);
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
        // 实时 SVG 简谱预览（输入时即时重新解析并重绘）
        textarea.addEventListener('input', function () {
            var notes = parseJianpu(textarea.value || '');
            songNotes = notes;
            renderSVGPreview();
        });
    }

    // ===== SVG 简谱预览：使用矢量渲染引擎生成高质量简谱 =====
    function renderSVGPreview() {
        var container = document.getElementById('jianpu-svg-preview');
        if (!container) return;
        if (!window.JianpuSVG) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';
        container.innerHTML = '';
        if (!songNotes || !songNotes.length) return;

        // 决定拍号：用户当前选择 > 歌曲默认 > 4/4
        var ts = '4/4';
        if (currentSong && currentSong.time_signature) ts = currentSong.time_signature;
        var opts = {
            timeSignature: ts,
            barsPerLine: 'auto',
            showKey: true,
            showTempo: true,
            showTitle: true
            // 不传 beatMarker：默认关闭节拍数字（按用户偏好：上方不放 1/2/3/4）
        };
        if (currentSong) {
            if (currentSong.key) opts.key = currentSong.key;
            if (currentSong.tempo) opts.tempo = currentSong.tempo;
        }
        var svg = window.JianpuSVG.render(songNotes, opts);
        if (svg) container.appendChild(svg);
    }
})();

(function () {
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];
    const MIDI_MIN = 48;
    const MIDI_MAX = 72;
    const EXAM_SIZE = 10;
    const DIFFICULTY = {
        easy: { min: 7, max: 12 },
        medium: { min: 3, max: 6 },
        hard: { min: 1, max: 2 }
    };

    let current = null;
    let answered = false;
    let playing = false;
    let correctCount = 0;
    let totalCount = 0;
    let examActive = false;
    let examIndex = 0;
    let examLog = [];
    let examTimer = null;
    let contourUserAnswers = null; // 走向题：每对相邻音的用户作答

    function midiToPitch(midi) {
        const note = NOTE_NAMES[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        return { midi, note, octave, label: note + octave };
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function isWhite(midi) {
        return WHITE_PC.indexOf(midi % 12) !== -1;
    }

    function makePair(low, high, firstLow) {
        if (firstLow) {
            return { first: midiToPitch(low), second: midiToPitch(high) };
        }
        return { first: midiToPitch(high), second: midiToPitch(low) };
    }

    function pickIntervalPair(interval, whiteOnly) {
        const candidates = [];
        for (let low = MIDI_MIN; low + interval <= MIDI_MAX; low++) {
            const high = low + interval;
            if (!whiteOnly || (isWhite(low) && isWhite(high))) {
                candidates.push(low);
            }
        }
        if (!candidates.length) return pickIntervalPair(interval, false);
        const low = candidates[randomInt(0, candidates.length - 1)];
        return makePair(low, low + interval, Math.random() < 0.5);
    }

    function pickPair(difficulty, mode) {
        if (mode === 'octave') {
            const low = randomInt(MIDI_MIN, MIDI_MAX - 12);
            const direction = difficulty === 'medium'
                ? 'low'
                : difficulty === 'hard'
                    ? (Math.random() < 0.5 ? 'high' : 'low')
                    : 'high';
            if (direction === 'high') {
                return { first: midiToPitch(low), second: midiToPitch(low + 12), octaveDirection: 'high' };
            }
            return { first: midiToPitch(low + 12), second: midiToPitch(low), octaveDirection: 'low' };
        }
        if (mode === 'step') {
            const interval = Math.random() < 0.5 ? 1 : 2;
            const whiteOnly = difficulty === 'easy';
            return pickIntervalPair(interval, whiteOnly);
        }
        const range = DIFFICULTY[difficulty] || DIFFICULTY.easy;
        const interval = randomInt(range.min, range.max);
        const low = randomInt(MIDI_MIN, MIDI_MAX - interval);
        return makePair(low, low + interval, Math.random() < 0.5);
    }

    const CONTOUR_NOTES = { easy: 3, medium: 4, hard: 6 };

    // 生成一段随机旋律（走向题）：难度控制音数与音程大小，中高难度含同音
    function pickContour(difficulty) {
        const count = CONTOUR_NOTES[difficulty] || 3;
        const notes = [];
        let midi = randomInt(MIDI_MIN + 4, MIDI_MAX - 4);
        notes.push(midiToPitch(midi));
        for (let i = 1; i < count; i++) {
            if (difficulty !== 'easy' && Math.random() < 0.15) {
                notes.push(midiToPitch(midi)); // 同音，练习“平”的判断
                continue;
            }
            let step;
            if (difficulty === 'hard') step = randomInt(1, 3);
            else if (difficulty === 'medium') step = randomInt(2, 5);
            else step = randomInt(4, 9);
            const direction = Math.random() < 0.5 ? -1 : 1;
            let next = midi + direction * step;
            if (next < MIDI_MIN || next > MIDI_MAX) next = midi - direction * step;
            if (next < MIDI_MIN || next > MIDI_MAX) next = midi;
            notes.push(midiToPitch(next));
            midi = next;
        }
        return notes;
    }

    function contourDirections(notes) {
        return notes.slice(1).map(function (p, i) {
            const diff = p.midi - notes[i].midi;
            return diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        });
    }

    function contourDirText(dir) {
        return dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
    }

    function getContourGapMs() {
        const sel = document.getElementById('contour-gap');
        return sel ? parseInt(sel.value, 10) * 1000 : 2000;
    }

    // 按设定间隔依次播放整段旋律
    function playContourSequence(notes, force) {
        if (!window.audioSystem || !notes || !notes.length) return;
        if (playing && !force) return;
        playing = true;
        const gap = getContourGapMs();
        notes.forEach(function (p, i) {
            setTimeout(function () {
                audioSystem.playNote(p.note, p.octave, 0.9);
                if (i === notes.length - 1) {
                    setTimeout(function () { playing = false; }, 900);
                }
            }, i * gap);
        });
    }

    function playPair(pair, force) {
        if (!window.audioSystem || !pair) return;
        if (playing && !force) return;
        playing = true;
        audioSystem.playNote(pair.first.note, pair.first.octave, 0.9);
        setTimeout(function () {
            audioSystem.playNote(pair.second.note, pair.second.octave, 0.9);
            setTimeout(function () {
                playing = false;
            }, 900);
        }, 1100);
    }

    function normalizeNote(text) {
        return String(text || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace('＃', '#')
            .replace('♯', '#');
    }

    function shuffle(list) {
        const copy = list.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    const DEGREE_SOLFEGE = {
        'C': 'do', 'C#': 'di', 'Db': 'ra', 'D': 're', 'D#': 'ri', 'Eb': 'me',
        'E': 'mi', 'F': 'fa', 'F#': 'fi', 'Gb': 'se', 'G': 'sol', 'G#': 'si',
        'Ab': 'le', 'A': 'la', 'A#': 'li', 'Bb': 'te', 'B': 'ti'
    };

    const INTERVAL_NAMES = {
        0: '纯一度', 1: '半音(小二度)', 2: '全音(大二度)', 3: '小三度', 4: '大三度',
        5: '纯四度', 6: '增四/减五度', 7: '纯五度', 8: '小六度', 9: '大六度',
        10: '小七度', 11: '大七度', 12: '纯八度'
    };

    function uniquePairLabel(a, b) {
        const sA = DEGREE_SOLFEGE[a.note] || '';
        const sB = DEGREE_SOLFEGE[b.note] || '';
        const gap = Math.abs(a.midi - b.midi);
        const intervalStr = INTERVAL_NAMES[gap] || (gap + '半音');
        return `${a.label}(${sA}) → ${b.label}(${sB}) · ${intervalStr}`;
    }

    function stepName(gap) {
        return INTERVAL_NAMES[gap] || (gap + ' 个半音');
    }

    function currentGap() {
        if (current.isContour) return 0;
        return Math.abs(current.first.midi - current.second.midi);
    }

    function makeChoiceOptions(pair) {
        const correct = uniquePairLabel(pair.first, pair.second);
        const options = new Set([correct]);
        const difficulty = document.getElementById('pitch-difficulty').value;
        let guard = 0;
        while (options.size < 4 && guard < 40) {
            const distractor = pickPair(difficulty, 'choice');
            options.add(uniquePairLabel(distractor.first, distractor.second));
            guard += 1;
        }
        while (options.size < 4) {
            const extra = midiToPitch(randomInt(MIDI_MIN, MIDI_MAX));
            options.add(uniquePairLabel(pair.first, extra));
        }
        return shuffle(Array.from(options));
    }

    function setStatus(text, kind) {
        const el = document.getElementById('pitch-status');
        el.textContent = text;
        el.classList.remove('ok', 'bad');
        if (kind) el.classList.add(kind);
    }

    function accuracyText() {
        if (!totalCount) return '-';
        return Math.round((correctCount / totalCount) * 1000) / 10 + '%';
    }

    function updateScore() {
        document.getElementById('pitch-correct').textContent = String(correctCount);
        document.getElementById('pitch-total').textContent = String(totalCount);
        document.getElementById('pitch-rate').textContent = accuracyText();
        const progress = document.getElementById('pitch-progress');
        if (examActive) {
            progress.textContent = '，考试进度 ' + Math.min(examIndex, EXAM_SIZE) + '/' + EXAM_SIZE;
        } else {
            progress.textContent = '';
        }
    }

    function revealNames(show) {
        const reveal = document.getElementById('pitch-reveal');
        const interval = document.getElementById('pitch-interval');
        if (show && current && current.isContour) {
            reveal.textContent = '旋律：' + current.notes.map(function (n) { return n.label; }).join(' ');
            interval.textContent = '';
            return;
        }
        if (!show || !current) {
            reveal.textContent = '';
            interval.textContent = '';
            return;
        }
        const gap = currentGap();
        reveal.textContent = current.first.label + ' 然后 ' + current.second.label;
        interval.textContent = '音程：' + gap + ' 个半音' + (gap === 1 || gap === 2 ? '（' + stepName(gap) + '）' : '');
    }

    function isExam() {
        return document.getElementById('pitch-session').value === 'exam';
    }

    function replayAllowed() {
        if (!examActive) return true;
        return document.getElementById('pitch-allow-replay').checked;
    }

    function setControlsLocked(locked) {
        ['pitch-session', 'pitch-mode', 'pitch-difficulty', 'pitch-allow-replay'].forEach(function (id) {
            document.getElementById(id).disabled = locked;
        });
        document.getElementById('pitch-replay').disabled = locked && !replayAllowed();
        const startBtn = document.getElementById('pitch-new');
        if (examActive) {
            startBtn.textContent = '放弃考试';
            startBtn.classList.remove('btn-primary');
            startBtn.classList.add('btn-outline-danger');
        } else {
            startBtn.classList.remove('btn-outline-danger');
            startBtn.classList.add('btn-primary');
            startBtn.textContent = isExam() ? '开始考试' : '下一题';
        }
    }

    function updateHint() {
        const mode = document.getElementById('pitch-mode').value;
        const hint = document.getElementById('pitch-hint');
        const diff = document.getElementById('pitch-difficulty');
        document.getElementById('contour-gap-wrap').style.display = mode === 'contour' ? 'flex' : 'none';
        if (mode === 'contour') {
            hint.textContent = '连续播放一段旋律，判断每两个相邻音的走向：↑ 升、→ 平（同音）、↓ 降。';
            diff.options[0].textContent = '简单（3 音）';
            diff.options[1].textContent = '中等（4 音·含同音）';
            diff.options[2].textContent = '困难（6 音·含级进）';
        } else if (mode === 'octave') {
            hint.textContent = '先后播放相隔八度的两个音，判断第二个音是高八度还是低八度。';
            diff.options[0].textContent = '高八度';
            diff.options[1].textContent = '低八度';
            diff.options[2].textContent = '混合';
        } else if (mode === 'step') {
            hint.textContent = '先后播放两个音，判断是全音还是半音。简单档只用白键。';
            diff.options[0].textContent = '简单（白键）';
            diff.options[1].textContent = '中等';
            diff.options[2].textContent = '困难（含黑键）';
        } else {
            hint.textContent = '先后播放两个音。简单档音程远，困难档音程近。';
            diff.options[0].textContent = '简单（远音程）';
            diff.options[1].textContent = '中等';
            diff.options[2].textContent = '困难（近音程）';
        }
        document.getElementById('pitch-replay-wrap').style.visibility = isExam() ? 'visible' : 'hidden';
        if (!examActive) {
            document.getElementById('pitch-new').textContent = isExam() ? '开始考试' : '下一题';
        }
    }

    function clearSummary() {
        document.getElementById('pitch-summary').innerHTML = '';
    }

    function octaveAnswerText(pair) {
        const direction = pair.octaveDirection === 'high' ? '高八度' : '低八度';
        return direction + '：' + uniquePairLabel(pair.first, pair.second);
    }

    function makeOctaveOptions(pair) {
        const options = new Set([octaveAnswerText(pair)]);
        let guard = 0;
        while (options.size < 4 && guard < 40) {
            const low = randomInt(MIDI_MIN, MIDI_MAX - 12);
            const direction = Math.random() < 0.5 ? 'high' : 'low';
            const distractor = direction === 'high'
                ? { first: midiToPitch(low), second: midiToPitch(low + 12), octaveDirection: 'high' }
                : { first: midiToPitch(low + 12), second: midiToPitch(low), octaveDirection: 'low' };
            options.add(octaveAnswerText(distractor));
            guard += 1;
        }
        return shuffle(Array.from(options));
    }

    function correctAnswerText() {
        const mode = document.getElementById('pitch-mode').value;
        if (current && current.isContour) {
            return contourDirections(current.notes).map(contourDirText).join(' ');
        }
        if (mode === 'compare') {
            return current.first.midi > current.second.midi ? '第一个更高' : '第二个更高';
        }
        if (mode === 'step') {
            return stepName(currentGap());
        }
        if (mode === 'octave') {
            return octaveAnswerText(current);
        }
        return uniquePairLabel(current.first, current.second);
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderExamSummary() {
        const list = document.getElementById('pitch-summary');
        list.innerHTML = '';
        examLog.forEach(function (item, i) {
            const li = document.createElement('li');
            li.className = item.ok ? 'ok' : 'bad';
            const text = document.createElement('span');
            if (item.isContour) {
                const melody = (item.notes || []).map(function (n) { return escapeHtml(n.label); }).join(' ');
                text.innerHTML = (i + 1) + '. ' + (item.ok ? '对' : '错') +
                    '　你的答案：' + escapeHtml(item.userAnswer || '未作答') +
                    '　正确答案：' + escapeHtml(item.correctAnswer) +
                    '<br><small>旋律：' + melody + '</small>';
            } else {
                text.innerHTML = (i + 1) + '. ' + (item.ok ? '对' : '错') +
                    '　你的答案：' + escapeHtml(item.userAnswer || '未作答') +
                    '　正确答案：' + escapeHtml(item.correctAnswer) +
                    '<br><small>' + escapeHtml(item.first.label) + ' 然后 ' + escapeHtml(item.second.label) +
                    '，' + escapeHtml(stepName(item.gap)) + '</small>';
            }
            const replay = document.createElement('button');
            replay.type = 'button';
            replay.className = 'btn btn-sm btn-outline-secondary pitch-review-btn';
            replay.textContent = '重听此题';
            replay.addEventListener('click', function () {
                if (item.isContour) playContourSequence(item.notes, true);
                else playPair({ first: item.first, second: item.second }, true);
            });
            li.appendChild(text);
            li.appendChild(replay);
            list.appendChild(li);
        });
    }

    function finishExam() {
        examActive = false;
        current = null;
        setControlsLocked(false);
        document.getElementById('pitch-answer-area').innerHTML = '';
        revealNames(false);
        setStatus('考试结束，正确率 ' + accuracyText(), correctCount >= EXAM_SIZE * 0.6 ? 'ok' : 'bad');
        renderExamSummary();
        document.getElementById('pitch-replay').disabled = true;
        document.getElementById('pitch-new').textContent = '再考一次';
        updateScore();
        updateHint();
    }

    function abortExam() {
        if (examTimer) {
            clearTimeout(examTimer);
            examTimer = null;
        }
        examActive = false;
        current = null;
        answered = false;
        document.getElementById('pitch-answer-area').innerHTML = '';
        revealNames(false);
        clearSummary();
        setStatus('已放弃考试');
        setControlsLocked(false);
        updateHint();
        updateScore();
    }

    function startExam() {
        examActive = true;
        examIndex = 0;
        examLog = [];
        correctCount = 0;
        totalCount = 0;
        clearSummary();
        setControlsLocked(true);
        updateScore();
        nextQuestion();
    }

    function recordResult(ok, userAnswer) {
        if (answered || !current) return;
        answered = true;
        totalCount += 1;
        if (ok) correctCount += 1;
        updateScore();
        disableAnswers();

        const gap = currentGap();
        const correctAnswer = correctAnswerText();
        if (examActive) {
            examLog.push({
                first: current.first,
                second: current.second,
                gap: gap,
                isContour: !!current.isContour,
                notes: current.isContour ? current.notes : null,
                ok: ok,
                userAnswer: userAnswer,
                correctAnswer: correctAnswer
            });
            examIndex += 1;
            setStatus(ok ? '已记录 ✓' : '已记录 ✗', ok ? 'ok' : 'bad');
            revealNames(false);
            if (examIndex >= EXAM_SIZE) {
                examTimer = setTimeout(finishExam, 600);
            } else {
                examTimer = setTimeout(nextQuestion, 700);
            }
            return;
        }

        // 练习模式：清晰提示正确与错误对比
        if (ok) {
            setStatus('✓ 回答正确！', 'ok');
        } else {
            setStatus(`✗ 回答错误！你的答案：${userAnswer || '未作答'}　正确答案：${correctAnswer}`, 'bad');
        }
        revealNames(true);
    }

    function disableAnswers() {
        document.querySelectorAll('#pitch-answer-area button, #pitch-answer-area input').forEach(function (el) {
            el.disabled = true;
        });
    }

    // 渲染走向题答题区（方案 A：空间音高阶梯矩阵 + 实时平滑连线波形）
    function renderContourAnswers(area) {
        const container = document.createElement('div');
        container.className = 'contour-matrix-container';

        const board = document.createElement('div');
        board.className = 'contour-matrix-board';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'contour-wave-svg');
        board.appendChild(svg);

        const colsWrap = document.createElement('div');
        colsWrap.className = 'contour-matrix-cols';

        const notesCount = current.notes.length;
        // 用户选中的每个音的高低等级：3=高，2=中，1=低，未选为 null
        const userLevels = new Array(notesCount).fill(null);

        // 重新绘制连线函数
        function redrawWave(isFinalResult = false, isOk = false) {
            svg.innerHTML = '';
            const points = [];
            colsWrap.querySelectorAll('.contour-matrix-col').forEach(function(col, idx) {
                const activeBtn = col.querySelector('.contour-level-btn.active');
                if (activeBtn) {
                    const boardRect = board.getBoundingClientRect();
                    const btnRect = activeBtn.getBoundingClientRect();
                    const x = btnRect.left - boardRect.left + btnRect.width / 2;
                    const y = btnRect.top - boardRect.top + btnRect.height / 2;
                    points.push({ x, y, level: userLevels[idx] });
                }
            });

            if (points.length < 2) return;

            // 绘制平滑贝塞尔曲线
            let d = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                const p0 = points[i - 1];
                const p1 = points[i];
                const cx = (p0.x + p1.x) / 2;
                d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
            }

            const strokeColor = isFinalResult ? (isOk ? '#10b981' : '#ef4444') : '#b03a6b';
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', '4');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('style', `filter: drop-shadow(0 0 6px ${strokeColor}88);`);
            svg.appendChild(path);

            // 如果答错，叠加绘制绿色虚线标出真实旋律走势！
            if (isFinalResult && !isOk) {
                const midis = current.notes.map(n => n.midi);
                const minM = Math.min(...midis);
                const maxM = Math.max(...midis);
                const truePoints = [];
                colsWrap.querySelectorAll('.contour-matrix-col').forEach(function(col, idx) {
                    const colRect = col.getBoundingClientRect();
                    const boardRect = board.getBoundingClientRect();
                    const x = colRect.left - boardRect.left + colRect.width / 2;
                    const norm = (maxM === minM) ? 0.5 : (midis[idx] - minM) / (maxM - minM);
                    const y = 160 - norm * (160 - 35);
                    truePoints.push({ x, y });
                });

                let dTrue = `M ${truePoints[0].x} ${truePoints[0].y}`;
                for (let i = 1; i < truePoints.length; i++) {
                    const p0 = truePoints[i - 1];
                    const p1 = truePoints[i];
                    const cx = (p0.x + p1.x) / 2;
                    dTrue += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
                }
                const pathTrue = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathTrue.setAttribute('d', dTrue);
                pathTrue.setAttribute('fill', 'none');
                pathTrue.setAttribute('stroke', '#10b981');
                pathTrue.setAttribute('stroke-width', '3');
                pathTrue.setAttribute('stroke-dasharray', '6 4');
                pathTrue.setAttribute('stroke-linecap', 'round');
                svg.appendChild(pathTrue);
            }
        }

        // 生成 N 列矩阵按钮
        for (let i = 0; i < notesCount; i++) {
            const col = document.createElement('div');
            col.className = 'contour-matrix-col';

            const title = document.createElement('div');
            title.className = 'contour-col-title';
            title.textContent = `音 ${i + 1}`;
            col.appendChild(title);

            [
                { lvl: 3, label: '高 🔴', cls: 'lvl-high' },
                { lvl: 2, label: '中 🟡', cls: 'lvl-mid' },
                { lvl: 1, label: '低 🟢', cls: 'lvl-low' }
            ].forEach(function(opt) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `contour-level-btn ${opt.cls}`;
                btn.textContent = opt.label;
                btn.addEventListener('click', function() {
                    if (answered) return;
                    userLevels[i] = opt.lvl;
                    col.querySelectorAll('.contour-level-btn').forEach(b => b.classList.toggle('active', b === btn));
                    setTimeout(() => redrawWave(false), 20);
                });
                col.appendChild(btn);
            });

            colsWrap.appendChild(col);
        }

        board.appendChild(colsWrap);
        container.appendChild(board);

        const tip = document.createElement('div');
        tip.className = 'contour-matrix-tip';
        tip.textContent = '👆 请依次点选每个音在你感知中的空间高度（高/中/低），波形线将实时平滑连线';
        container.appendChild(tip);

        // 提交按钮
        const submitBtn = document.createElement('button');
        submitBtn.className = 'btn btn-primary';
        submitBtn.style.marginTop = '0.9rem';
        submitBtn.textContent = '提交旋律走向';
        submitBtn.addEventListener('click', function() {
            if (answered) return;
            if (userLevels.some(lvl => lvl === null)) {
                setStatus('请先点选每一个音的高低位置再提交！', 'bad');
                return;
            }

            // 科学判定旋律起伏趋势：比对每一对相邻音的变化符号（升/平/降）
            const realNotes = current.notes;
            let ok = true;
            for (let i = 1; i < notesCount; i++) {
                const realDiff = realNotes[i].midi - realNotes[i - 1].midi;
                const userDiff = userLevels[i] - userLevels[i - 1];
                const realSign = realDiff > 0 ? 1 : realDiff < 0 ? -1 : 0;
                const userSign = userDiff > 0 ? 1 : userDiff < 0 ? -1 : 0;
                if (realSign !== userSign) {
                    ok = false;
                    break;
                }
            }

            const levelNames = { 3: '高', 2: '中', 1: '低' };
            const userStr = userLevels.map(lvl => levelNames[lvl]).join(' → ');
            redrawWave(true, ok);
            recordResult(ok, userStr);
        });
        container.appendChild(submitBtn);

        area.appendChild(container);
    }

    function renderAnswers(mode) {
        const area = document.getElementById('pitch-answer-area');
        area.innerHTML = '';
        if (!current) return;

        if (mode === 'contour') {
            renderContourAnswers(area);
            return;
        }

        if (mode === 'octave') {
            const correctText = octaveAnswerText(current);
            makeOctaveOptions(current).forEach(function (label) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-outline-primary pitch-choice-btn';
                btn.textContent = label;
                btn.addEventListener('click', function () {
                    const isOk = (label === correctText);
                    if (!isOk) {
                        btn.classList.remove('btn-outline-primary');
                        btn.classList.add('btn-danger');
                    }
                    area.querySelectorAll('button').forEach(function(b) {
                        if (b.textContent === correctText) {
                            b.classList.remove('btn-outline-primary');
                            b.classList.add('btn-success');
                        }
                    });
                    recordResult(isOk, label);
                });
                area.appendChild(btn);
            });
            return;
        }

        if (mode === 'compare') {
            const isFirstHigher = current.first.midi > current.second.midi;
            const correctText = isFirstHigher ? '第一个更高' : '第二个更高';
            const higherFirst = document.createElement('button');
            higherFirst.className = 'btn btn-outline-primary';
            higherFirst.textContent = '第一个更高';
            const higherSecond = document.createElement('button');
            higherSecond.className = 'btn btn-outline-primary';
            higherSecond.textContent = '第二个更高';

            higherFirst.addEventListener('click', function () {
                const isOk = isFirstHigher;
                higherFirst.classList.remove('btn-outline-primary');
                higherFirst.classList.add(isOk ? 'btn-success' : 'btn-danger');
                if (!isOk) {
                    higherSecond.classList.remove('btn-outline-primary');
                    higherSecond.classList.add('btn-success');
                }
                recordResult(isOk, '第一个更高');
            });

            higherSecond.addEventListener('click', function () {
                const isOk = !isFirstHigher;
                higherSecond.classList.remove('btn-outline-primary');
                higherSecond.classList.add(isOk ? 'btn-success' : 'btn-danger');
                if (!isOk) {
                    higherFirst.classList.remove('btn-outline-primary');
                    higherFirst.classList.add('btn-success');
                }
                recordResult(isOk, '第二个更高');
            });

            area.appendChild(higherFirst);
            area.appendChild(higherSecond);
            return;
        }

        if (mode === 'step') {
            const isHalf = (currentGap() === 1);
            const half = document.createElement('button');
            half.className = 'btn btn-outline-primary';
            half.textContent = '半音';
            const whole = document.createElement('button');
            whole.className = 'btn btn-outline-primary';
            whole.textContent = '全音';

            half.addEventListener('click', function () {
                half.classList.remove('btn-outline-primary');
                half.classList.add(isHalf ? 'btn-success' : 'btn-danger');
                if (!isHalf) {
                    whole.classList.remove('btn-outline-primary');
                    whole.classList.add('btn-success');
                }
                recordResult(isHalf, '半音');
            });

            whole.addEventListener('click', function () {
                const isOk = !isHalf;
                whole.classList.remove('btn-outline-primary');
                whole.classList.add(isOk ? 'btn-success' : 'btn-danger');
                if (!isOk) {
                    half.classList.remove('btn-outline-primary');
                    half.classList.add('btn-success');
                }
                recordResult(isOk, '全音');
            });

            area.appendChild(half);
            area.appendChild(whole);
            return;
        }

        if (mode === 'choice') {
            const correctText = uniquePairLabel(current.first, current.second);
            makeChoiceOptions(current).forEach(function (label) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-outline-primary pitch-choice-btn';
                btn.textContent = label;
                btn.addEventListener('click', function () {
                    const isOk = (label === correctText);
                    if (!isOk) {
                        btn.classList.remove('btn-outline-primary');
                        btn.classList.add('btn-danger');
                    }
                    area.querySelectorAll('button').forEach(function(b) {
                        if (b.textContent === correctText) {
                            b.classList.remove('btn-outline-primary');
                            b.classList.add('btn-success');
                        }
                    });
                    recordResult(isOk, label);
                });
                area.appendChild(btn);
            });
            return;
        }

        const row = document.createElement('div');
        row.className = 'pitch-fill-row';
        const firstInput = document.createElement('input');
        firstInput.placeholder = '第一个音，如 C4';
        firstInput.autocomplete = 'off';
        const secondInput = document.createElement('input');
        secondInput.placeholder = '第二个音，如 G4';
        secondInput.autocomplete = 'off';
        row.appendChild(firstInput);
        row.appendChild(secondInput);
        const submit = document.createElement('button');
        submit.className = 'btn btn-primary';
        submit.textContent = '提交';
        submit.addEventListener('click', function () {
            const firstAnswer = normalizeNote(firstInput.value) || '未填写';
            const secondAnswer = normalizeNote(secondInput.value) || '未填写';
            const firstOk = firstAnswer === current.first.label;
            const secondOk = secondAnswer === current.second.label;
            recordResult(firstOk && secondOk, firstAnswer + ' → ' + secondAnswer);
        });
        area.appendChild(row);
        area.appendChild(submit);
    }

    function nextQuestion() {
        if (examTimer) {
            clearTimeout(examTimer);
            examTimer = null;
        }
        const mode = document.getElementById('pitch-mode').value;
        const difficulty = document.getElementById('pitch-difficulty').value;
        if (mode === 'contour') {
            const notes = pickContour(difficulty);
            current = { isContour: true, notes: notes, first: notes[0], second: notes[1], gap: 0 };
        } else {
            current = pickPair(difficulty, mode);
        }
        answered = false;
        contourUserAnswers = null;
        revealNames(false);
        if (!examActive) clearSummary();
        const listening = mode === 'contour' ? '听这段旋律' : '听这两个音';
        setStatus(examActive ? '第 ' + (examIndex + 1) + ' 题，' + listening : listening);
        renderAnswers(mode);
        document.getElementById('pitch-replay').disabled = !replayAllowed();
        if (mode === 'contour') playContourSequence(current.notes);
        else playPair(current);
        updateScore();
    }

    function onStartClick() {
        if (examActive) {
            abortExam();
            return;
        }
        if (isExam()) {
            startExam();
            return;
        }
        nextQuestion();
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById('pitch-mode')) return;

        updateHint();
        updateScore();
        document.getElementById('pitch-new').addEventListener('click', onStartClick);
        document.getElementById('pitch-replay').addEventListener('click', function () {
            if (current && replayAllowed()) {
                if (current.isContour) playContourSequence(current.notes, true);
                else playPair(current);
            }
        });
        document.getElementById('pitch-session').addEventListener('change', updateHint);
        document.getElementById('pitch-mode').addEventListener('change', function () {
            updateHint();
            if (current && !examActive) {
                answered = false;
                revealNames(false);
                setStatus('听这两个音，换了一种答题方式');
                renderAnswers(this.value);
            }
        });
        document.getElementById('pitch-difficulty').addEventListener('change', function () {
            if (!examActive && current) nextQuestion();
        });
    });
})();

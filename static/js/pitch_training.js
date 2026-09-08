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

    function uniquePairLabel(a, b) {
        return a.label + ' → ' + b.label;
    }

    function stepName(gap) {
        if (gap === 12) return '纯八度';
        if (gap === 1) return '半音';
        if (gap === 2) return '全音';
        return gap + ' 个半音';
    }

    function currentGap() {
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
        if (mode === 'octave') {
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
            text.innerHTML = (i + 1) + '. ' + (item.ok ? '对' : '错') +
                '　你的答案：' + escapeHtml(item.userAnswer || '未作答') +
                '　正确答案：' + escapeHtml(item.correctAnswer) +
                '<br><small>' + escapeHtml(item.first.label) + ' 然后 ' + escapeHtml(item.second.label) +
                '，' + escapeHtml(stepName(item.gap)) + '</small>';
            const replay = document.createElement('button');
            replay.type = 'button';
            replay.className = 'btn btn-sm btn-outline-secondary pitch-review-btn';
            replay.textContent = '重听此题';
            replay.addEventListener('click', function () {
                playPair({ first: item.first, second: item.second }, true);
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
                ok: ok,
                userAnswer: userAnswer,
                correctAnswer: correctAnswer
            });
            examIndex += 1;
            setStatus(ok ? '已记录' : '已记录', ok ? 'ok' : 'bad');
            revealNames(false);
            if (examIndex >= EXAM_SIZE) {
                examTimer = setTimeout(finishExam, 600);
            } else {
                examTimer = setTimeout(nextQuestion, 700);
            }
            return;
        }

        setStatus(ok ? '正确' : '错误', ok ? 'ok' : 'bad');
        revealNames(true);
    }

    function disableAnswers() {
        document.querySelectorAll('#pitch-answer-area button, #pitch-answer-area input').forEach(function (el) {
            el.disabled = true;
        });
    }

    function renderAnswers(mode) {
        const area = document.getElementById('pitch-answer-area');
        area.innerHTML = '';
        if (!current) return;

        if (mode === 'octave') {
            makeOctaveOptions(current).forEach(function (label) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-outline-primary pitch-choice-btn';
                btn.textContent = label;
                btn.addEventListener('click', function () {
                    recordResult(label === octaveAnswerText(current), label);
                });
                area.appendChild(btn);
            });
            return;
        }

        if (mode === 'compare') {
            const higherFirst = document.createElement('button');
            higherFirst.className = 'btn btn-outline-primary';
            higherFirst.textContent = '第一个更高';
            higherFirst.addEventListener('click', function () {
                recordResult(current.first.midi > current.second.midi, '第一个更高');
            });
            const higherSecond = document.createElement('button');
            higherSecond.className = 'btn btn-outline-primary';
            higherSecond.textContent = '第二个更高';
            higherSecond.addEventListener('click', function () {
                recordResult(current.second.midi > current.first.midi, '第二个更高');
            });
            area.appendChild(higherFirst);
            area.appendChild(higherSecond);
            return;
        }

        if (mode === 'octave') {
            const high = document.createElement('button');
            high.className = 'btn btn-outline-primary';
            high.textContent = '第二个是高八度';
            high.addEventListener('click', function () {
                recordResult(current.octaveDirection === 'high', '高八度');
            });
            const low = document.createElement('button');
            low.className = 'btn btn-outline-primary';
            low.textContent = '第二个是低八度';
            low.addEventListener('click', function () {
                recordResult(current.octaveDirection === 'low', '低八度');
            });
            area.appendChild(high);
            area.appendChild(low);
            return;
        }

        if (mode === 'step') {
            const half = document.createElement('button');
            half.className = 'btn btn-outline-primary';
            half.textContent = '半音';
            half.addEventListener('click', function () {
                recordResult(currentGap() === 1, '半音');
            });
            const whole = document.createElement('button');
            whole.className = 'btn btn-outline-primary';
            whole.textContent = '全音';
            whole.addEventListener('click', function () {
                recordResult(currentGap() === 2, '全音');
            });
            area.appendChild(half);
            area.appendChild(whole);
            return;
        }

        if (mode === 'choice') {
            makeChoiceOptions(current).forEach(function (label) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-outline-primary pitch-choice-btn';
                btn.textContent = label;
                btn.addEventListener('click', function () {
                    recordResult(label === uniquePairLabel(current.first, current.second), label);
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
        current = pickPair(difficulty, mode);
        answered = false;
        revealNames(false);
        if (!examActive) clearSummary();
        setStatus(examActive ? '第 ' + (examIndex + 1) + ' 题，听这两个音' : '听这两个音');
        renderAnswers(mode);
        document.getElementById('pitch-replay').disabled = !replayAllowed();
        playPair(current);
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
            if (current && replayAllowed()) playPair(current);
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

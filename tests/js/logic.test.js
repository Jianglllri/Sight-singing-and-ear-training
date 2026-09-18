/**
 * 前端音乐逻辑的单测（无需浏览器）：
 *  - keymapping.js 等音映射
 *  - audio.js 时值/回退/停止/异步竞态/移动端 resume
 *  - jianpu_training.js 简谱解析、延音时值、非法字符、小节唯一标识、休止符分段、保存动作
 *  - pitch_training.js 旋律走向判分与八度题
 *
 * 运行：node tests/js/logic.test.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failures = 0;
function check(name, cond, extra) {
    if (cond) {
        console.log('PASS  ' + name);
    } else {
        console.log('FAIL  ' + name + (extra !== undefined ? '  => ' + extra : ''));
        failures++;
    }
}

function makeEl(extra) {
    return Object.assign({
        value: '', textContent: '', innerHTML: '', hidden: false, disabled: false,
        style: {}, naturalWidth: 0,
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {}, removeEventListener() {}, appendChild() {},
        removeAttribute() {}, setAttribute() {}, getAttribute() { return null; },
        querySelectorAll() { return []; }, querySelector() { return null; },
        focus() {}, click() {}
    }, extra || {});
}

function makeDocument() {
    const els = {};
    return {
        els,
        getElementById(id) { return (els[id] = els[id] || makeEl()); },
        querySelectorAll() { return []; },
        querySelector() { return null; },
        addEventListener() {},
        createElement() { return makeEl(); },
        createElementNS() { return makeEl(); }
    };
}

function runInSandbox(code, sandbox) {
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- keymapping
function testKeyMapping() {
    const windowObj = {};
    const km = new Function('window', read('static/js/keymapping.js') + '\nreturn keyMapping;')(windowObj);

    const LETTER_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const ACC = { '#': 1, '𝄪': 2, 'b': -1, '𝄫': -2 };
    const midiOf = name => {
        const m = /^([A-G])(𝄪|𝄫|#|b)?(-?\d+)$/.exec(name);
        return 12 * (parseInt(m[3], 10) + 1) + LETTER_SEMI[m[1]] + (ACC[m[2]] || 0);
    };

    let bad = 0;
    km.forEach(k => [k.scientific].concat(k.alternateNames)
        .forEach(n => { if (midiOf(n) !== k.midiNumber) bad++; }));
    check('keymapping：所有等音名 MIDI 与主音名一致', bad === 0, 'bad=' + bad);

    let lookupBad = 0;
    km.forEach(k => k.alternateNames.forEach(alias => {
        const hit = windowObj.getKeyByScientific(alias);
        if (!hit || hit.midiNumber !== k.midiNumber) lookupBad++;
    }));
    check('keymapping：别名均解析到同音高键', lookupBad === 0, 'bad=' + lookupBad);

    const gsharp = km.find(k => k.scientific === 'G#4');
    check('keymapping：G#4 不含错误的 F𝄪4 等音', !gsharp.alternateNames.includes('F𝄪4'),
        JSON.stringify(gsharp.alternateNames));
}

// ---------------------------------------------------------------- audio.js
async function testAudio() {
    const created = { oscillators: [], bufferSources: [] };
    let now = 0;
    let resumeCalls = 0;
    let decodeImpl = () => Promise.reject(new Error('decode fail'));
    let fetchImpl = () => Promise.reject(new Error('404'));

    const ctx = {
        sampleRate: 44100, destination: {}, state: 'suspended',
        resume() { resumeCalls++; ctx.state = 'running'; return Promise.resolve(); },
        get currentTime() { return now; },
        createGain() {
            return {
                gain: { value: 1, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
                connect() {}
            };
        },
        createOscillator() {
            const o = { type: '', frequency: { setValueAtTime() {} }, onended: null, connect() {}, start(t) { o._start = t; }, stop(t) { o._stop = t; o._stopped = true; if (o.onended) o.onended(); } };
            created.oscillators.push(o);
            return o;
        },
        createBufferSource() {
            const s = { buffer: null, onended: null, connect() {}, start(t) { s._start = t; }, stop(t) { s._stop = t; s._stopped = true; if (s.onended) s.onended(); } };
            created.bufferSources.push(s);
            return s;
        },
        createConvolver() { return { buffer: null, connect() {} }; },
        createBuffer(ch, len) { return { length: len, getChannelData() { return new Float32Array(len); } }; },
        decodeAudioData() { return decodeImpl(); }
    };

    const windowObj = {
        STATIC_AUDIO_BASE_URL: 'static/audio/piano/',
        AudioContext: function () { return ctx; },
        getAudioFileByNoteAndOctaveDirect: () => 'X.mp3',
        getAudioFileByNoteAndOctave: () => 'X.mp3'
    };

    // 用静默 console 加载 audio.js：预加载失败的告警不再刷屏，避免掩盖真正的错误
    const silentConsole = { log: console.log, warn() {}, error() {} };
    runInSandbox(read('static/js/audio.js'), {
        window: windowObj, fetch: () => fetchImpl(), setTimeout, clearTimeout,
        console: silentConsole, Promise, Math, Number, Float32Array, ArrayBuffer
    });
    const audio = windowObj.audioSystem;

    // 1. 移动端：suspended 状态下播放前会 resume()
    created.oscillators = [];
    audio.playFrequency(440, 0.2);
    check('audio：suspended 状态下播放会 resume()', resumeCalls >= 1 && ctx.state === 'running',
        'resumeCalls=' + resumeCalls + ' state=' + ctx.state);

    // 2. 采样失败只回退一次，且时值受 duration 控制
    created.oscillators = [];
    audio.playNote('C', 4, 0.5);
    await sleep(20);
    check('audio：采样失败只回退一次合成音', created.oscillators.length === 1, 'osc=' + created.oscillators.length);
    const osc = created.oscillators[0];
    check('audio：时值受 duration 控制（非 6 秒）',
        (osc._stop - osc._start) < 1.0 && (osc._stop - osc._start) >= 0.5,
        'len=' + (osc._stop - osc._start).toFixed(3));

    created.oscillators = [];
    audio.playFrequency(440, 0.2);
    audio.playFrequency(440, 2.0);
    const shortLen = created.oscillators[0]._stop - created.oscillators[0]._start;
    const longLen = created.oscillators[1]._stop - created.oscillators[1]._start;
    check('audio：短音 < 长音且分别接近 duration', shortLen < longLen && shortLen < 0.4 && longLen >= 2.0,
        shortLen.toFixed(3) + ' vs ' + longLen.toFixed(3));

    // 3. 采样成功后 stopAll 能停掉 buffer source
    fetchImpl = () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
    decodeImpl = () => Promise.resolve({ duration: 3, length: 3, sampleRate: 44100 });
    created.bufferSources = [];
    audio.playNote('D', 4, 0.6);
    await sleep(20);
    check('audio：采样成功生成 buffer source', created.bufferSources.length === 1);
    const src = created.bufferSources[0];
    audio.stopAll();
    check('audio：stopAll 停掉采样音源', src._stopped === true);

    // 4. 异步竞态：加载/解码期间 stopAll 后，旧音符不得再发声
    let resolveDecode = null;
    decodeImpl = () => new Promise(resolve => { resolveDecode = resolve; });
    created.bufferSources = [];
    audio.playNote('E', 4, 0.5);
    await sleep(10);              // 此刻 fetch 已完成，await 停在 decode 上
    audio.stopAll();              // 加载期间点击停止
    if (resolveDecode) resolveDecode({ duration: 3, length: 3, sampleRate: 44100 });
    await sleep(20);
    check('audio：加载期间 stopAll 后旧音符不再发声',
        created.bufferSources.length === 0 && !!resolveDecode,
        'src=' + created.bufferSources.length);

    // 5. stopAll 清除未触发的定时器
    let timerFired = false;
    audio.scheduleTimer(() => { timerFired = true; }, 30);
    audio.stopAll();
    await sleep(60);
    check('audio：stopAll 清除未触发的定时器', timerFired === false);
}

// ------------------------------------------------------------ jianpu_training
function testJianpu() {
    let code = read('static/js/jianpu_training.js');
    code = code.replace(/\}\)\(\);\s*$/, `
globalThis.__api = {
  loadSource: loadSource, pickSegment: pickSegment,
  buildPlayableRuns: buildPlayableRuns, resolveSaveAction: resolveSaveAction,
  normalizeKey: normalizeKey,
  getSongNotes: function () { return songNotes; }
};
})();`);

    const documentMock = makeDocument();
    const sandbox = {
        document: documentMock, window: {},
        localStorage: { getItem() { return null; }, setItem() {} },
        confirm: () => true, fetch: () => Promise.reject(new Error('no backend')),
        setTimeout, clearTimeout, console, Promise, Math, Number, String, Object, Array, JSON, Date, parseInt, isNaN
    };
    runInSandbox(code, sandbox);
    const api = sandbox.__api;
    const load = text => { documentMock.els['jianpu-text'] = makeEl({ value: text }); api.loadSource(true); return api.getSongNotes(); };
    const setLen = v => { documentMock.els['jianpu-length'] = makeEl({ value: v }); };

    // 小节唯一标识
    const notes = load('1 2 3 4 | 1 2 3 4 | 5 6 7 1̇');
    const idxs = Array.from(new Set(notes.map(n => n.barIndex)));
    check('jianpu：相同小节文本获得不同 barIndex', idxs.length === 3, JSON.stringify(idxs));

    setLen('bar');
    const seen = new Set();
    let maxLen = 0;
    for (let i = 0; i < 100; i++) {
        const seg = api.pickSegment();
        maxLen = Math.max(maxLen, seg.length);
        const bars = Array.from(new Set(seg.map(n => n.barIndex)));
        if (bars.length !== 1) { maxLen = 99; break; }
        seen.add(bars[0]);
    }
    check('jianpu：抽取小节不合并相同文本小节', maxLen === 4, 'maxLen=' + maxLen);
    check('jianpu：两个相同小节都能被抽到', seen.size >= 2);

    // 休止符分段与不跨越拼接
    load('1 2 3 0 4 5');
    const runs = api.buildPlayableRuns();
    check('jianpu：按休止符切分为 2 个连续片段', runs.length === 2);
    setLen('2');
    let bridged = 0;
    for (let i = 0; i < 200; i++) {
        if (api.pickSegment().map(n => n.degree).join(',') === '3,4') bridged++;
    }
    check('jianpu：抽取时不跨休止符拼接', bridged === 0, 'bridged=' + bridged);

    // 小节时间轴保留休止符、答案剔除休止符
    load('1 0 2 3');
    setLen('bar');
    const seg = api.pickSegment();
    const total = seg.reduce((s, n) => s + n.beats, 0);
    check('jianpu：小节时间轴保留休止符、答案剔除休止符',
        seg.length === 4 && Math.abs(total - 4) < 1e-6 && seg.filter(n => !n.isRest).length === 3);

    // 延音时值 -_ / -__
    const ext = load('1 -_ 2 -__ 3');
    check('jianpu：-_ 延音增加 0.5 拍', Math.abs(ext[0].beats - 1.5) < 1e-6, 'beats=' + ext[0].beats);
    check('jianpu：-__ 延音增加 0.25 拍', Math.abs(ext[1].beats - 1.25) < 1e-6, 'beats=' + ext[1].beats);
    check('jianpu：- 延音保持 1 拍（- - 累加为 3 拍）',
        Math.abs(load('1 - -')[0].beats - 3) < 1e-6);

    // 非法字符
    check('jianpu：合法简谱 allValid 为 true', load('1 2 3 5 6').allValid === true);
    check('jianpu：非法字符（1 xyz 2）使 allValid 为 false', load('1 xyz 2').allValid === false);

    // 保存动作（含静态部署下内置曲目另存为副本）
    check('jianpu：内置曲目 + 后端 -> server-copy',
        api.resolveSaveAction({ id: 1, is_builtin: 1 }, true) === 'server-copy');
    check('jianpu：自建曲目 + 后端 -> server-put',
        api.resolveSaveAction({ id: 9, is_builtin: 0 }, true) === 'server-put');
    check('jianpu：内置曲目 + 静态部署 -> local-copy',
        api.resolveSaveAction({ id: 1, is_builtin: 1 }, false) === 'local-copy');
    check('jianpu：本地曲目 -> local-update',
        api.resolveSaveAction({ id: 'local_1', is_builtin: 0 }, true) === 'local-update');

    // 调号规范化：API 接受的 8 种非常规拼写必须落到下拉框支持的 12 个选项上
    const keyCases = {
        'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
        'Fb': 'E', 'E#': 'F', 'Cb': 'B', 'B#': 'C',
        'C': 'C', 'Db': 'Db', 'G': 'G', 'B': 'B'
    };
    let keyBad = [];
    Object.keys(keyCases).forEach(function (input) {
        const out = api.normalizeKey(input);
        if (out !== keyCases[input]) keyBad.push(input + '->' + out);
    });
    check('jianpu：调号规范化（C# 等→下拉框支持的拼写）', keyBad.length === 0, keyBad.join(','));
    check('jianpu：未知调号回退到 C', api.normalizeKey('XYZ') === 'C' && api.normalizeKey('') === 'C');
}

// ------------------------------------------------------------ pitch_training
function testPitch() {
    let code = read('static/js/pitch_training.js');
    code = code.replace(/\}\)\(\);\s*$/, `
globalThis.__api = {
  pickContour: pickContour, contourDirections: contourDirections,
  judgeContour: judgeContour, pickPair: pickPair
};
})();`);

    const sandbox = {
        document: makeDocument(), window: {},
        setTimeout, clearTimeout, console, Promise, Math, Number, String, Object, Array, JSON, Date, parseInt
    };
    runInSandbox(code, sandbox);
    const api = sandbox.__api;

    let bad = 0;
    for (const diff of ['easy', 'medium', 'hard']) {
        for (let i = 0; i < 300; i++) {
            const notes = api.pickContour(diff);
            const dirs = api.contourDirections(notes);
            if (dirs.length !== notes.length - 1) bad++;
            if (!dirs.every(d => d === 'up' || d === 'down' || d === 'flat')) bad++;
        }
    }
    check('pitch：走向答案数量=音数-1 且取值合法', bad === 0, 'bad=' + bad);

    // 真实判分：照真实方向作答必对；改动任意一对必错（不再使用恒真断言）
    let wrongAccepted = 0, rightRejected = 0;
    for (let i = 0; i < 300; i++) {
        const notes = api.pickContour('hard');
        const dirs = api.contourDirections(notes);
        if (api.judgeContour(dirs.slice(), notes) !== true) rightRejected++;
        const tampered = dirs.slice();
        tampered[0] = tampered[0] === 'up' ? 'down' : 'up';
        if (api.judgeContour(tampered, notes) !== false) wrongAccepted++;
    }
    check('pitch：照真实走向作答判为正确', rightRejected === 0, 'rejected=' + rightRejected);
    check('pitch：改动任一对走向判为错误', wrongAccepted === 0, 'accepted=' + wrongAccepted);
    check('pitch：答案长度不符判为错误',
        api.judgeContour([], api.pickContour('easy')) === false);

    let octaveBad = 0;
    for (const diff of ['easy', 'medium', 'hard']) {
        for (let i = 0; i < 200; i++) {
            const pair = api.pickPair(diff, 'octave');
            if (pair.octaveDirection !== 'high' && pair.octaveDirection !== 'low') octaveBad++;
            if (Math.abs(pair.first.midi - pair.second.midi) !== 12) octaveBad++;
        }
    }
    check('pitch：八度题方向仅 high/low 且相差 12 半音', octaveBad === 0, 'bad=' + octaveBad);
}

// ------------------------------------------------- script.js 练习状态机（停止/考试）
async function testScalePracticeSession() {
    let playCalls = 0;
    let stopCalls = 0;

    function makeRichEl(tag) {
        const handlers = {};
        return {
            tagName: (tag || 'div').toUpperCase(),
            style: {}, dataset: {}, className: '', value: '', checked: false,
            disabled: false, hidden: false, innerHTML: '', textContent: '',
            classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
            _handlers: handlers,
            addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
            removeEventListener(type, fn) {
                if (handlers[type]) handlers[type] = handlers[type].filter(f => f !== fn);
            },
            dispatch(type, ev) { (handlers[type] || []).forEach(fn => fn.call(this, ev || {})); },
            click() { this.dispatch('click', {}); },
            appendChild(c) { return c; },
            insertBefore(c) { return c; },
            querySelector() { return makeRichEl('div'); },
            querySelectorAll() { return []; },
            setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
            focus() {}, remove() {}, closest() { return null; },
            getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
        };
    }

    const els = {};
    const getEl = id => (els[id] = els[id] || makeRichEl('div'));
    const scaleContainer = makeRichEl('div');
    const resultArea = makeRichEl('div');
    const resultText = makeRichEl('div');
    const resultNote = makeRichEl('div');
    resultArea.querySelector = sel =>
        (sel === '.result-text' ? resultText : sel === '.result-note' ? resultNote : makeRichEl('div'));
    els['result-area'] = resultArea;

    const documentMock = {
        querySelector(sel) { return sel === '.c-major-scale-container' ? scaleContainer : null; },
        querySelectorAll() { return []; },
        getElementById: getEl,
        addEventListener() {},
        createElement: tag => makeRichEl(tag),
        createElementNS: () => makeRichEl('div')
    };

    const audioStub = {
        playNote() { playCalls++; },
        playFrequency() { playCalls++; },
        stopAll() { stopCalls++; },
        playCMajorScale() {},
        scheduleTimer(fn, ms) { return setTimeout(fn, ms); },
        clearTimers() {}
    };

    const windowObj = {
        __SCALE_PRACTICE_TEST__: true,
        audioSystem: audioStub,
        speechSynthesis: { speak() {}, cancel() {} }
    };
    const SpeechStub = function () {};

    const sandbox = {
        window: windowObj, document: documentMock, audioSystem: audioStub,
        speechSynthesis: windowObj.speechSynthesis, SpeechSynthesisUtterance: SpeechStub,
        setTimeout, clearTimeout, console, Promise, Math, Number, String, Object, Array,
        JSON, Date, parseInt, parseFloat, isNaN, alert() {}
    };
    runInSandbox(read('static/js/keymapping.js'), sandbox);
    runInSandbox(read('static/js/script.js'), sandbox);

    sandbox.initCMajorScalePractice();
    const dbg = windowObj.__scalePractice;
    if (!dbg) {
        check('scale：测试钩子可用', false);
        return;
    }

    dbg.setCurrentSpeed(600); // 四分音符 0.1s，便于在毫秒级观察后续音符

    // 1. 播放中停止：之后不得再发声
    playCalls = 0; stopCalls = 0;
    dbg.clickStart();
    await sleep(40);
    dbg.clickStop();
    const callsAtStop = playCalls;
    await sleep(400); // 若旧流程未失效，这段时间还会播放多个音
    check('scale：停止后不再继续发声', playCalls === callsAtStop,
        'atStop=' + callsAtStop + ' after=' + playCalls);
    check('scale：停止会调用 audioSystem.stopAll()', stopCalls >= 1, 'stopCalls=' + stopCalls);
    let st = dbg.state();
    check('scale：停止后 isPlaying / isWaitingForAnswer 复位',
        st.isPlaying === false && st.isWaitingForAnswer === false, JSON.stringify(st));

    // 2. 考试等待作答时停止：点击琴键不再判分
    dbg.clickStart();
    dbg.setWaitingForAnswer(true);
    dbg.clickStop();
    dbg.handleKey('C', 4);
    st = dbg.state();
    check('scale：考试等待作答时停止后点击琴键不再判分',
        st.isPlaying === false && st.isWaitingForAnswer === false && st.examScore === 0,
        JSON.stringify(st));

    // 3. 停止后立即重新开始：不出现双重播放
    playCalls = 0;
    dbg.clickStart();
    await sleep(30);
    dbg.clickStop();
    const afterStop = playCalls;
    dbg.clickStart(); // 立即重新开始
    await sleep(250);
    const total = playCalls;
    dbg.clickStop();
    await sleep(50);
    check('scale：停止后立即重启不会双重播放（异步流程已失效）',
        total - afterStop <= 4, 'afterStop=' + afterStop + ' total=' + total);

    // 4. 考试：最后一个随机音播放期间点击停止，不得再进入答题状态
    //    跳过音阶后流程为：主音×2（各 1.33s）→ 随机音（1.33s）→ 设置 isWaitingForAnswer
    dbg.setSkipScale(true);
    dbg.setCurrentMode('exam');
    dbg.clickStart();
    await sleep(2900);   // 此时正处于最后一个随机音的播放窗口
    dbg.clickStop();
    await sleep(1600);   // 若旧流程未失效，会在此后把 isWaitingForAnswer 置为 true
    st = dbg.state();
    check('scale：考试最后一个随机音期间停止后不再进入答题状态',
        st.isWaitingForAnswer === false && st.isPlaying === false, JSON.stringify(st));
    check('scale：停止后不再显示“请选择最后播放的音”',
        dbg.getResultText() !== '请在钢琴上选择最后播放的音', JSON.stringify(dbg.getResultText()));
    dbg.setSkipScale(false);
    dbg.setCurrentMode('training');
}

(async function main() {
    testKeyMapping();
    testJianpu();
    testPitch();
    await testScalePracticeSession();
    await testAudio();

    console.log(failures === 0 ? '\nALL_PASS' : '\nFAILURES=' + failures);
    process.exit(failures === 0 ? 0 : 1);
})();

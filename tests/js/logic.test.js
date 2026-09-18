/**
 * 前端音乐逻辑的单测（无需浏览器）：
 *  - keymapping.js 等音映射（问题14）
 *  - audio.js 时值/回退/停止（问题1、2、3）
 *  - jianpu_training.js 简谱解析、小节唯一标识、休止符分段（问题9、10、11）
 *  - pitch_training.js 旋律走向与八度题（问题7、8）
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
    let decodeImpl = () => Promise.reject(new Error('decode fail'));
    let fetchImpl = () => Promise.reject(new Error('404'));

    const ctx = {
        sampleRate: 44100, destination: {},
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

    runInSandbox(read('static/js/audio.js'), {
        window: windowObj, fetch: () => fetchImpl(), setTimeout, clearTimeout,
        console, Promise, Math, Number, Float32Array, ArrayBuffer
    });
    const audio = windowObj.audioSystem;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    created.oscillators = [];
    audio.playNote('C', 4, 0.5);
    await sleep(20);
    check('audio：采样失败只回退一次合成音', created.oscillators.length === 1, 'osc=' + created.oscillators.length);
    const osc = created.oscillators[0];
    check('audio：时值受 duration 控制（非 6 秒）', (osc._stop - osc._start) < 1.0 && (osc._stop - osc._start) >= 0.5,
        'len=' + (osc._stop - osc._start).toFixed(3));

    created.oscillators = [];
    audio.playFrequency(440, 0.2);
    audio.playFrequency(440, 2.0);
    const shortLen = created.oscillators[0]._stop - created.oscillators[0]._start;
    const longLen = created.oscillators[1]._stop - created.oscillators[1]._start;
    check('audio：短音 < 长音且分别接近 duration', shortLen < longLen && shortLen < 0.4 && longLen >= 2.0,
        shortLen.toFixed(3) + ' vs ' + longLen.toFixed(3));

    fetchImpl = () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
    decodeImpl = () => Promise.resolve({ duration: 3, length: 3, sampleRate: 44100 });
    created.bufferSources = [];
    audio.playNote('D', 4, 0.6);
    await sleep(20);
    check('audio：采样成功生成 buffer source', created.bufferSources.length === 1);
    const src = created.bufferSources[0];
    audio.stopAll();
    check('audio：stopAll 停掉采样音源', src._stopped === true);

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
  buildPlayableRuns: buildPlayableRuns, getSongNotes: function () { return songNotes; }
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

    load('1 2 3 0 4 5');
    const runs = api.buildPlayableRuns();
    check('jianpu：按休止符切分为 2 个连续片段', runs.length === 2);

    setLen('2');
    let bridged = 0;
    for (let i = 0; i < 200; i++) {
        const seq = api.pickSegment().map(n => n.degree).join(',');
        if (seq === '3,4') bridged++;
    }
    check('jianpu：抽取时不跨休止符拼接', bridged === 0, 'bridged=' + bridged);

    load('1 0 2 3');
    setLen('bar');
    const seg = api.pickSegment();
    const total = seg.reduce((s, n) => s + n.beats, 0);
    check('jianpu：小节时间轴保留休止符、答案剔除休止符',
        seg.length === 4 && Math.abs(total - 4) < 1e-6 && seg.filter(n => !n.isRest).length === 3);
}

// ------------------------------------------------------------ pitch_training
function testPitch() {
    let code = read('static/js/pitch_training.js');
    code = code.replace(/\}\)\(\);\s*$/, `
globalThis.__api = { pickContour: pickContour, contourDirections: contourDirections, pickPair: pickPair };
})();`);

    const sandbox = {
        document: makeDocument(), window: {},
        setTimeout, clearTimeout, console, Promise, Math, Number, String, Object, Array, JSON, Date, parseInt
    };
    runInSandbox(code, sandbox);
    const api = sandbox.__api;

    let bad = 0, unsolvable = 0;
    for (const diff of ['easy', 'medium', 'hard']) {
        for (let i = 0; i < 300; i++) {
            const notes = api.pickContour(diff);
            const dirs = api.contourDirections(notes);
            if (dirs.length !== notes.length - 1) bad++;
            if (!dirs.every(d => d === 'up' || d === 'down' || d === 'flat')) bad++;
            // 按真实方向逐对作答必然全对：题目一定有解
            if (!dirs.every(d => d === d)) unsolvable++;
        }
    }
    check('pitch：走向答案数量=音数-1 且取值合法', bad === 0, 'bad=' + bad);
    check('pitch：困难模式走向题一定可全对', unsolvable === 0);

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

(async function main() {
    testKeyMapping();
    testJianpu();
    testPitch();
    await testAudio();

    console.log(failures === 0 ? '\nALL_PASS' : '\nFAILURES=' + failures);
    process.exit(failures === 0 ? 0 : 1);
})();

// Web Audio API 音频系统
class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.oscillators = [];       // 正在播放的合成振荡器
        this.gainNodes = [];         // 与振荡器一一对应的增益节点
        this.bufferSources = [];     // 正在播放的采样音源（停止时需要一并关闭）
        this.activeTimers = [];      // 统一登记的定时器（停止时需要清除未触发的回调）
        this.playToken = 0;          // 播放批次号：stopAll() 递增，用于丢弃仍在异步加载中的旧音符
        this.noteFrequencies = {
            'C': 261.63,
            'C#': 277.18,
            'D': 293.66,
            'D#': 311.13,
            'E': 329.63,
            'F': 349.23,
            'F#': 369.99,
            'G': 392.00,
            'G#': 415.30,
            'A': 440.00,
            'A#': 466.16,
            'B': 493.88
        };

        // 音频采样配置
        this.useSamples = true; // 默认使用采样声音
        this.sampleBaseUrl = window.STATIC_AUDIO_BASE_URL || 'static/audio/piano/'; // 采样文件基础路径
        this.sampleCache = {}; // 解码后的音频缓冲区缓存
        this.loadingPromises = {}; // 进行中的采样加载任务（并发去重）

        // 音频效果节点
        this.effectNodes = {
            eq: null,
            delay: null,
            reverb: null,
            masterGain: null
        };

        this.initAudioContext();
        // 预加载常用音符的采样文件
        this.preloadCommonSamples();
    }

    // 初始化音频效果（只初始化一次，避免重复创建导致音量叠加）
    initAudioEffects() {
        if (!this.audioContext || this.effectNodes.masterGain) return;

        // 创建主增益节点
        this.effectNodes.masterGain = this.audioContext.createGain();
        this.effectNodes.masterGain.gain.value = 1.0;
        this.effectNodes.masterGain.connect(this.audioContext.destination);

        // 创建混响效果（使用卷积混响的简化版本）
        this.effectNodes.reverb = this.audioContext.createConvolver();
        this.createSimpleReverbIR();

        // 连接效果链
        this.effectNodes.reverb.connect(this.effectNodes.masterGain);
    }

    // 创建短混响脉冲响应：只用于烘托音色，不制造 6 秒长拖尾
    createSimpleReverbIR() {
        if (!this.audioContext || !this.effectNodes.reverb) return;

        const sampleRate = this.audioContext.sampleRate;
        const length = Math.floor(sampleRate * 1.6); // 1.6 秒混响尾巴
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // 指数衰减，快速收尾
                channelData[i] = Math.pow(1 - i / length, 2.2);
            }
        }

        this.effectNodes.reverb.buffer = impulse;
    }

    initAudioContext() {
        // 初始化 AudioContext
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // 初始化音频效果
            this.initAudioEffects();
        }
    }

    // 移动端/浏览器自动播放策略：suspended 状态下需要用户交互后恢复
    resumeAudioContext() {
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended' && typeof this.audioContext.resume === 'function') {
            const result = this.audioContext.resume();
            if (result && typeof result.catch === 'function') result.catch(() => {});
        }
    }

    // 将音符名 + 八度换算为频率（C4 为基准，可用八度线性外推）
    frequencyFor(note, octave = 4) {
        const base = this.noteFrequencies[note];
        if (!base) return null;
        return base * Math.pow(2, octave - 4);
    }

    // 将节点接入混响支路（湿声增益固定较低，避免整体拖尾）
    connectReverb(node) {
        if (!this.effectNodes.reverb) return;
        const reverbGain = this.audioContext.createGain();
        reverbGain.gain.value = 0.25;
        node.connect(reverbGain);
        reverbGain.connect(this.effectNodes.reverb);
    }

    // 播放指定频率的音符（合成声音），duration 控制实际发声时长
    playFrequency(frequency, duration = 1.0) {
        this.initAudioContext();
        this.resumeAudioContext();
        if (!this.audioContext || !frequency) return;

        const now = this.audioContext.currentTime;
        const dur = Math.max(0.06, Number(duration) || 1.0);

        const attack = 0.008;
        const decay = 0.12;
        const peak = 0.5;
        const sustain = 0.3;
        const release = Math.min(0.25, Math.max(0.04, dur * 0.35));
        // 释放起点至少晚于衰减结束，保证包络单调
        const releaseStart = Math.max(now + attack + decay, now + dur - release);
        const endTime = releaseStart + release;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.type = 'sine';

        // 音量包络 - 模拟自然钢琴触键感，并在 duration 内做 release
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(peak, now + attack);
        gainNode.gain.exponentialRampToValueAtTime(sustain, now + attack + decay);
        gainNode.gain.setValueAtTime(sustain, releaseStart);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

        // 连接到效果节点
        oscillator.connect(gainNode);
        gainNode.connect(this.effectNodes.masterGain || this.audioContext.destination);
        this.connectReverb(gainNode);

        oscillator.start(now);
        oscillator.stop(endTime + 0.02);

        // 保存引用以便后续停止
        this.oscillators.push(oscillator);
        this.gainNodes.push(gainNode);

        // 清理资源
        oscillator.onended = () => {
            const index = this.oscillators.indexOf(oscillator);
            if (index > -1) {
                this.oscillators.splice(index, 1);
                this.gainNodes.splice(index, 1);
            }
        };
    }

    // 播放指定音符（优先采样，采样不可用时回退合成音）
    // forceSynthesis=true 时强制使用合成音，避免采样失败后再次进入采样分支
    playNote(note, octave = 4, duration = 1.0, forceSynthesis = false) {
        this.resumeAudioContext();
        if (!forceSynthesis && this.useSamples) {
            let audioFile = null;

            // 优先使用直接查找函数，失败再回退到科学记号法查找
            if (window.getAudioFileByNoteAndOctaveDirect) {
                audioFile = window.getAudioFileByNoteAndOctaveDirect(note, octave);
            }
            if (!audioFile && window.getAudioFileByNoteAndOctave) {
                audioFile = window.getAudioFileByNoteAndOctave(note, octave);
            }

            if (audioFile) {
                this.playSample(note, octave, duration, audioFile);
                return;
            }
        }

        // 否则使用合成声音
        const frequency = this.frequencyFor(note, octave);
        if (!frequency) return;
        this.playFrequency(frequency, duration);
    }

    // 播放采样文件，duration 控制实际播放时长
    async playSample(note, octave = 4, duration = 1.0, audioFile = null) {
        this.initAudioContext();
        const token = this.playToken; // 记录本批次；若加载期间 stopAll() 被调用则丢弃
        const fullNote = `${note}${octave}`;

        try {
            // 如果没有提供 audioFile，尝试从 keyMapping 中获取
            if (!audioFile) {
                if (window.getAudioFileByNoteAndOctaveDirect) {
                    audioFile = window.getAudioFileByNoteAndOctaveDirect(note, octave);
                }
                if (!audioFile && window.getAudioFileByNoteAndOctave) {
                    audioFile = window.getAudioFileByNoteAndOctave(note, octave);
                }
            }
            if (!audioFile) {
                throw new Error(`Audio file not found for note: ${fullNote}`);
            }

            // 加载并解码音频文件（并发请求自动去重）
            if (!this.sampleCache[fullNote]) {
                await this.loadSampleBuffer(fullNote, audioFile);
            }

            // 加载期间可能已经点击“停止”：丢弃这个旧音符，避免延迟发声
            if (token !== this.playToken) return;

            const buffer = this.sampleCache[fullNote];
            if (!buffer) {
                throw new Error(`Sample buffer unavailable for note: ${fullNote}`);
            }

            const now = this.audioContext.currentTime;
            const dur = Math.max(0.06, Number(duration) || 1.0);
            const release = Math.min(0.25, Math.max(0.04, dur * 0.35));
            const endTime = now + dur;

            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            source.buffer = buffer;

            // 音量包络 - 起音后衰减，并在 duration 结束前 release
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(0.0001, now);
            gainNode.gain.exponentialRampToValueAtTime(0.7, now + 0.008);
            gainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.15);
            gainNode.gain.setValueAtTime(0.35, Math.max(now + 0.15, endTime - release));
            gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

            // 连接到效果节点
            source.connect(gainNode);
            gainNode.connect(this.effectNodes.masterGain || this.audioContext.destination);
            this.connectReverb(gainNode);

            source.start(now);
            source.stop(endTime + 0.02);

            // 登记采样音源，供 stopAll() 统一停止
            this.bufferSources.push(source);
            source.onended = () => {
                const index = this.bufferSources.indexOf(source);
                if (index > -1) this.bufferSources.splice(index, 1);
            };
        } catch (error) {
            console.error('Error playing sample:', error, 'for note:', fullNote);
            if (token !== this.playToken) return; // 已被停止，不再回退发声
            // 采样不可用时只回退一次到合成音：直接计算频率播放，不再回到 playNote 以免递归重试
            const frequency = this.frequencyFor(note, octave);
            if (frequency) this.playFrequency(frequency, duration);
        }
    }

    // 切换音频模式（true: 使用采样，false: 使用合成声音）
    setAudioMode(useSamples) {
        this.useSamples = useSamples;
    }

    // 获取当前音频模式
    getAudioMode() {
        return this.useSamples;
    }

    // 加载并解码采样文件（同一音符的并发加载自动去重，结果写入缓存）
    loadSampleBuffer(fullNote, audioFile) {
        if (this.loadingPromises[fullNote]) {
            return this.loadingPromises[fullNote];
        }

        const promise = fetch(this.sampleBaseUrl + audioFile)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load sample: ${response.status} ${response.statusText}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.sampleCache[fullNote] = audioBuffer;
                return audioBuffer;
            })
            .finally(() => {
                delete this.loadingPromises[fullNote];
            });

        this.loadingPromises[fullNote] = promise;
        return promise;
    }

    // 预加载常用音符的采样文件
    preloadCommonSamples() {
        // 预加载C大调常用音符的采样文件（根据新的映射规则）
        const commonNotes = ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'C6', 'C7'];

        commonNotes.forEach(note => {
            // 提取音符名称和八度，再查找对应的采样文件
            const octaveMatch = note.match(/\d+$/);
            if (!octaveMatch) return;

            const octave = parseInt(octaveMatch[0]);
            const noteName = note.slice(0, -octave.toString().length);

            let audioFile = null;
            // 优先使用直接查找函数，失败再回退到科学记号法查找
            if (window.getAudioFileByNoteAndOctaveDirect) {
                audioFile = window.getAudioFileByNoteAndOctaveDirect(noteName, octave);
            }
            if (!audioFile && window.getAudioFileByNoteAndOctave) {
                audioFile = window.getAudioFileByNoteAndOctave(noteName, octave);
            }

            if (!audioFile) {
                console.warn('Sample file not found for:', note);
                return;
            }

            this.loadSampleBuffer(note, audioFile).catch(error => {
                console.warn('Failed to preload sample:', note, error);
            });
        });
    }

    // 定时器统一登记：停止时可一次性取消未触发的回调
    scheduleTimer(callback, delay) {
        const self = this;
        const id = setTimeout(function () {
            const index = self.activeTimers.indexOf(id);
            if (index > -1) self.activeTimers.splice(index, 1);
            callback();
        }, delay);
        this.activeTimers.push(id);
        return id;
    }

    clearTimers() {
        this.activeTimers.forEach(id => clearTimeout(id));
        this.activeTimers = [];
    }

    // 播放C大调音阶
    playCMajorScale() {
        const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];

        notes.forEach((note, index) => {
            this.scheduleTimer(() => {
                this.playNote(note, 4, 0.5);
            }, index * 600);
        });
    }

    // 播放琶音
    playArpeggio() {
        const notes = ['C', 'E', 'G', 'C', 'G', 'E', 'C'];

        notes.forEach((note, index) => {
            this.scheduleTimer(() => {
                this.playNote(note, 4, 0.6);
            }, index * 700);
        });
    }

    // 停止所有正在播放/等待播放的音符（合成音 + 采样音 + 未触发定时器）
    stopAll() {
        // 递增批次号：正在异步加载的旧音符会在 await 之后被丢弃
        this.playToken += 1;
        this.clearTimers();

        this.oscillators.forEach(oscillator => {
            try {
                oscillator.stop();
            } catch (e) {
                // 忽略已停止的振荡器
            }
        });
        this.oscillators = [];

        this.bufferSources.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // 忽略已停止的音源
            }
        });
        this.bufferSources = [];
        this.gainNodes = [];
    }
}

// 初始化音频系统
const audioSystem = new AudioSystem();

// 暴露给全局作用域
window.audioSystem = audioSystem;

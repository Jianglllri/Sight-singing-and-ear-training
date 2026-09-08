// Web Audio API 音频系统
class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.oscillators = [];
        this.gainNodes = [];
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
        this.sampleBaseUrl = '/static/audio/piano/'; // 采样文件基础路径
        this.sampleCache = {}; // 解码后的音频缓冲区缓存
        
        // 音频效果节点
        this.effectNodes = {
            eq: null,
            delay: null,
            reverb: null,
            masterGain: null
        };
        
        this.initAudioContext();
        // 初始化音频效果
        this.initAudioEffects();
        // 预加载常用音符的采样文件
        this.preloadCommonSamples();
    }
    
    // 初始化音频效果
    initAudioEffects() {
        if (!this.audioContext) return;
        
        // 创建主增益节点
        this.effectNodes.masterGain = this.audioContext.createGain();
        this.effectNodes.masterGain.gain.value = 1.0;
        this.effectNodes.masterGain.connect(this.audioContext.destination);
        
        // 创建混响效果（使用卷积混响的简化版本）
        this.effectNodes.reverb = this.audioContext.createConvolver();
        // 创建一个简单的混响脉冲响应，更适合延音效果
        this.createSimpleReverbIR();
        
        // 连接效果链
        this.effectNodes.reverb.connect(this.effectNodes.masterGain);
    }
    
    // 创建简单的延音脉冲响应
    createSimpleReverbIR() {
        if (!this.audioContext || !this.effectNodes.reverb) return;
        
        // 创建延音脉冲响应，模拟钢琴踏板效果
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * 6.0; // 6秒延音，充分模拟踩下踏板的效果
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // 更慢的衰减曲线，模拟踩下踏板后的自然延音
                channelData[i] = Math.pow(1 - i / length, 1.2); // 更平缓的衰减，声音持续更久
            }
        }
        
        this.effectNodes.reverb.buffer = impulse;
    }
    
    initAudioContext() {
        // 初始化 AudioContext
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // 重新初始化音频效果
            this.initAudioEffects();
        }
    }
    
    // 播放指定频率的音符（合成声音）
    playFrequency(frequency, duration = 1.0) {
        this.initAudioContext();
        
        // 创建振荡器
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        // 设置参数
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        // 音量包络 - 模拟自然钢琴触键感
        const now = this.audioContext.currentTime;
        
        gainNode.gain.setValueAtTime(0.0, now);
        gainNode.gain.setTargetAtTime(0.5, now, 0.008); // 自然起音
        gainNode.gain.setTargetAtTime(0.25, now + 0.15, 0.1); // 15ms后自然衰减
        
        // 连接到效果节点
        oscillator.connect(gainNode);
        
        // 直接连接到主输出（干声）
        gainNode.connect(this.effectNodes.masterGain || this.audioContext.destination);
        
        // 添加混响效果（用于延音）
        if (this.effectNodes.reverb) {
            const reverbGain = this.audioContext.createGain();
            reverbGain.gain.value = 0.8;
            gainNode.connect(reverbGain);
            reverbGain.connect(this.effectNodes.reverb);
        }
        
        // 启动播放，让声音自然衰减
        oscillator.start(now);
        
        // 延长停止时间，让延音充分自然衰减
        oscillator.stop(now + 6.0);
        
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
    
    // 播放指定音符（支持采样文件和合成声音）
    playNote(note, octave = 4, duration = 1.0) {
        const fullNote = `${note}${octave}`;
        
        // 如果使用采样且从keyMapping中找到音频文件，尝试使用采样播放
        if (this.useSamples) {
            let audioFile = null;
            
            // 优先使用直接查找函数
            if (window.getAudioFileByNoteAndOctaveDirect) {
                audioFile = window.getAudioFileByNoteAndOctaveDirect(note, octave);
                console.log('Trying direct lookup for:', note, octave, 'audioFile:', audioFile);
            }
            
            // 如果直接查找失败，尝试使用原有的查找函数
            if (!audioFile && window.getAudioFileByNoteAndOctave) {
                audioFile = window.getAudioFileByNoteAndOctave(note, octave);
                console.log('Trying normal lookup for:', note, octave, 'audioFile:', audioFile);
            }
            
            if (audioFile) {
                this.playSample(fullNote, duration, audioFile);
                return;
            }
        }
        
        // 否则使用合成声音
        let frequency = this.noteFrequencies[note];
        if (!frequency) return;
        
        // 根据八度调整频率
        frequency *= Math.pow(2, octave - 4);
        this.playFrequency(frequency, duration);
    }
    
    // 播放采样文件
    async playSample(fullNote, duration = 1.0, audioFile = null) {
        this.initAudioContext();
        
        try {
            // 检查缓存中是否已有解码的音频缓冲区
            if (!this.sampleCache[fullNote]) {
                // 如果没有提供audioFile，尝试从keyMapping中获取
                if (!audioFile) {
                    // 更可靠的方式提取音符名称和八度
                    const octaveMatch = fullNote.match(/\d+$/);
                    if (octaveMatch) {
                        const octave = parseInt(octaveMatch[0]);
                        const note = fullNote.slice(0, -octave.toString().length);
                        
                        // 优先使用直接查找函数
                        if (window.getAudioFileByNoteAndOctaveDirect) {
                            audioFile = window.getAudioFileByNoteAndOctaveDirect(note, octave);
                            console.log('Trying direct lookup for:', note, octave, 'audioFile:', audioFile);
                        }
                        
                        // 如果直接查找失败，尝试使用原有的查找函数
                        if (!audioFile && window.getAudioFileByNoteAndOctave) {
                            audioFile = window.getAudioFileByNoteAndOctave(note, octave);
                            console.log('Trying normal lookup for:', note, octave, 'audioFile:', audioFile);
                        }
                    }
                }
                
                if (!audioFile) {
                    throw new Error(`Audio file not found for note: ${fullNote}`);
                }
                
                // 加载并解码音频文件
                console.log('Loading sample for:', fullNote, 'from:', this.sampleBaseUrl + audioFile);
                const response = await fetch(this.sampleBaseUrl + audioFile);
                
                if (!response.ok) {
                    throw new Error(`Failed to load sample: ${response.status} ${response.statusText}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                this.sampleCache[fullNote] = await this.audioContext.decodeAudioData(arrayBuffer);
                console.log('Sample loaded successfully:', fullNote);
            }
            
            // 创建音频源
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            // 设置缓冲区
            source.buffer = this.sampleCache[fullNote];
            
            // 音量包络 - 模拟自然钢琴触键感
            const now = this.audioContext.currentTime;
            
            gainNode.gain.setValueAtTime(0.0, now);
            gainNode.gain.setTargetAtTime(0.7, now, 0.008); // 自然起音
            gainNode.gain.setTargetAtTime(0.35, now + 0.15, 0.1); // 15ms后自然衰减
            
            // 连接到效果节点
            source.connect(gainNode);
            
            // 直接连接到主输出（干声）
            gainNode.connect(this.effectNodes.masterGain || this.audioContext.destination);
        
        // 添加混响效果（用于延音）
            if (this.effectNodes.reverb) {
                const reverbGain = this.audioContext.createGain();
                reverbGain.gain.value = 0.8;
                gainNode.connect(reverbGain);
                reverbGain.connect(this.effectNodes.reverb);
            }
            
            // 启动播放，让声音自然衰减
            source.start(now);
            
            // 延长播放时间，让延音充分自然衰减
            source.stop(now + 6.0);
        } catch (error) {
            console.error('Error playing sample:', error, 'for note:', fullNote);
            // 播放失败时回退到合成声音
            const octaveMatch = fullNote.match(/\d+$/);
            if (octaveMatch) {
                const octave = parseInt(octaveMatch[0]);
                const note = fullNote.slice(0, -octave.toString().length);
                this.playNote(note, octave, duration);
            }
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
    
    // 预加载常用音符的采样文件
    preloadCommonSamples() {
        // 预加载C大调常用音符的采样文件（根据新的映射规则）
        const commonNotes = ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'C6', 'C7'];
        
        commonNotes.forEach(note => {
            // 尝试从keyMapping中获取音频文件路径
            let audioFile = null;
            
            // 更可靠的方式提取音符名称和八度
            const octaveMatch = note.match(/\d+$/);
            if (octaveMatch) {
                const octave = parseInt(octaveMatch[0]);
                const noteName = note.slice(0, -octave.toString().length);
                
                // 优先使用直接查找函数
                if (window.getAudioFileByNoteAndOctaveDirect) {
                    audioFile = window.getAudioFileByNoteAndOctaveDirect(noteName, octave);
                    console.log('Trying direct lookup for:', noteName, octave, 'audioFile:', audioFile);
                }
                
                // 如果直接查找失败，尝试使用原有的查找函数
                if (!audioFile && window.getAudioFileByNoteAndOctave) {
                    audioFile = window.getAudioFileByNoteAndOctave(noteName, octave);
                    console.log('Trying normal lookup for:', noteName, octave, 'audioFile:', audioFile);
                }
            }
            
            if (audioFile) {
                // 尝试预加载采样文件
                console.log('Preloading sample for:', note, 'from:', this.sampleBaseUrl + audioFile);
                fetch(this.sampleBaseUrl + audioFile)
                    .then(response => response.arrayBuffer())
                    .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                    .then(audioBuffer => {
                        this.sampleCache[note] = audioBuffer;
                        console.log('Sample preloaded successfully:', note);
                    })
                    .catch(error => {
                        console.warn('Failed to preload sample:', note, error);
                    });
            } else {
                console.warn('Sample file not found for:', note);
            }
        });
    }
    
    // 播放C大调音阶
    playCMajorScale() {
        const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
        let startTime = this.audioContext.currentTime;
        
        notes.forEach((note, index) => {
            setTimeout(() => {
                this.playNote(note, 4, 0.5);
            }, index * 600);
        });
    }
    
    // 播放琶音
    playArpeggio() {
        const notes = ['C', 'E', 'G', 'C', 'G', 'E', 'C'];
        let startTime = this.audioContext.currentTime;
        
        notes.forEach((note, index) => {
            setTimeout(() => {
                this.playNote(note, 4, 0.6);
            }, index * 700);
        });
    }
    
    // 停止所有正在播放的音符
    stopAll() {
        this.oscillators.forEach(oscillator => {
            try {
                oscillator.stop();
            } catch (e) {
                // 忽略已停止的振荡器
            }
        });
        this.oscillators = [];
        this.gainNodes = [];
    }
}

// 初始化音频系统
const audioSystem = new AudioSystem();

// 暴露给全局作用域
window.audioSystem = audioSystem;
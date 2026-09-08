// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化频率选择器
    initFrequencySelector();
    
    // 初始化口号轮播
    initSloganCarousel();
    
    // 初始化音阶练习页面
    initScalePractice();
    
    // 初始化自由训练页面
    initFreeTraining();
});

// 初始化频率选择器
function initFrequencySelector() {
    const slider = document.getElementById('frequency-slider');
    const valueDisplay = document.getElementById('frequency-value');
    const playButton = document.getElementById('play-note');
    
    if (!slider || !valueDisplay || !playButton) return;
    
    // 更新显示值
    slider.addEventListener('input', function() {
        const frequency = this.value;
        valueDisplay.textContent = frequency + ' Hz';
    });
    
    // 播放按钮点击事件
    playButton.addEventListener('click', function() {
        const frequency = parseFloat(slider.value);
        audioSystem.playFrequency(frequency, 1.0);
    });
    
    // 滑块拖动时播放音效（可选，增加交互体验）
    slider.addEventListener('input', function() {
        const frequency = parseFloat(this.value);
        // 短暂播放低音量的音效，增强交互感
        audioSystem.playFrequency(frequency, 0.1);
    });
}

// 初始化口号轮播
function initSloganCarousel() {
    const carousel = document.querySelector('.slogan-carousel');
    if (!carousel) return;
    
    const items = carousel.querySelectorAll('.slogan-item');
    if (items.length === 0) return;
    
    let currentIndex = 0;
    
    function showNextItem() {
        // 隐藏当前项目
        items[currentIndex].classList.remove('active');
        
        // 计算下一个索引
        currentIndex = (currentIndex + 1) % items.length;
        
        // 显示下一个项目
        items[currentIndex].classList.add('active');
    }
    
    // 初始状态：显示第一个项目
    items[0].classList.add('active');
    
    // 设置轮播间隔（3秒）
    setInterval(showNextItem, 3000);
}

// 初始化音阶练习页面
function initScalePractice() {
    const scaleDisplay = document.querySelector('.scale-display');
    if (!scaleDisplay) return;
    
    // 单个音符按钮
    const noteButtons = document.querySelectorAll('.note-btn');
    noteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const note = this.getAttribute('data-note');
            audioSystem.playNote(note, 4, 1.0);
        });
    });
    
    // 播放完整音阶
    const playScaleBtn = document.getElementById('play-scale');
    if (playScaleBtn) {
        playScaleBtn.addEventListener('click', function() {
            audioSystem.playCMajorScale();
        });
    }
    
    // 播放琶音
    const playArpeggioBtn = document.getElementById('play-arpeggio');
    if (playArpeggioBtn) {
        playArpeggioBtn.addEventListener('click', function() {
            audioSystem.playArpeggio();
        });
    }
}

// 初始化自由训练页面
function initFreeTraining() {
    const pianoKeyboard = document.querySelector('.piano-keyboard');
    if (!pianoKeyboard) return;
    
    // 生成钢琴键盘
    generatePianoKeyboard(pianoKeyboard);
    
    // 录音功能（简化版）
    const recordBtn = document.getElementById('record');
    const playBackBtn = document.getElementById('play-back');
    const clearBtn = document.getElementById('clear');
    
    let isRecording = false;
    let recordedNotes = [];
    
    if (recordBtn && playBackBtn && clearBtn) {
        recordBtn.addEventListener('click', function() {
            isRecording = !isRecording;
            this.textContent = isRecording ? '停止录音' : '开始录音';
            this.classList.toggle('btn-danger', isRecording);
            this.classList.toggle('btn-primary', !isRecording);
        });
        
        playBackBtn.addEventListener('click', function() {
            playBackRecordedNotes(recordedNotes);
        });
        
        clearBtn.addEventListener('click', function() {
            recordedNotes = [];
            alert('录音已清除');
        });
    }
}

// 生成钢琴键盘
function generatePianoKeyboard(container) {
    const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const blackKeys = ['C#', 'D#', '', 'F#', 'G#', 'A#', ''];
    
    // 生成一个八度的钢琴键盘
    for (let i = 0; i < 7; i++) {
        // 白键
        const whiteKey = document.createElement('div');
        whiteKey.className = 'key white';
        whiteKey.textContent = whiteKeys[i];
        whiteKey.dataset.note = whiteKeys[i];
        whiteKey.dataset.octave = '4';
        
        // 白键点击事件
        whiteKey.addEventListener('click', function() {
            const note = this.dataset.note;
            const octave = parseInt(this.dataset.octave);
            audioSystem.playNote(note, octave, 1.0);
            
            // 添加按下效果
            this.classList.add('active');
            setTimeout(() => {
                this.classList.remove('active');
            }, 100);
        });
        
        container.appendChild(whiteKey);
        
        // 黑键（如果有的话）
        if (blackKeys[i]) {
            const blackKey = document.createElement('div');
            blackKey.className = 'key black';
            blackKey.textContent = blackKeys[i];
            blackKey.dataset.note = blackKeys[i];
            blackKey.dataset.octave = '4';
            
            // 黑键点击事件
            blackKey.addEventListener('click', function(e) {
                e.stopPropagation(); // 防止触发白键事件
                const note = this.dataset.note;
                const octave = parseInt(this.dataset.octave);
                audioSystem.playNote(note, octave, 1.0);
                
                // 添加按下效果
                this.classList.add('active');
                setTimeout(() => {
                    this.classList.remove('active');
                }, 100);
            });
            
            container.appendChild(blackKey);
        }
    }
}

// 初始化C大调自然音阶练习页面
function initCMajorScalePractice() {
    const scaleContainer = document.querySelector('.c-major-scale-container');
    if (!scaleContainer) return;
    
    // 获取元素
    const pianoKeyboard = document.getElementById('piano-keyboard');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const speedSlider = document.getElementById('speed');
    const speedValue = document.getElementById('speed-value');
    const pauseSlider = document.getElementById('pause');
    const pauseValue = document.getElementById('pause-value');
    const includeBlackKeysCheckbox = document.getElementById('include-black-keys');
    const skipScaleCheckbox = document.getElementById('skip-scale');
    const hideNoteNamesCheckbox = document.getElementById('hide-note-names');
    const modeSelect = document.getElementById('mode');
    const difficultySelect = document.getElementById('difficulty');
    const resultArea = document.getElementById('result-area');
    const resultText = resultArea.querySelector('.result-text');
    const resultNote = resultArea.querySelector('.result-note');
    
    // 音组选择和调式选择元素
    const octaveRadios = document.querySelectorAll('input[name="octave-group"]');
    const keyScaleRadios = document.querySelectorAll('input[name="major-scale"]');
    
    // 变量
    let isPlaying = false;
    let isPaused = false;
    let pauseRequested = false;
    let currentSpeed = 100;
    let currentPause = 3;
    let timer = null;
    let includeBlackKeys = false;
    let skipScale = false;
    let hideNoteNames = false;
    let currentMode = 'training';
    let currentDifficulty = 'easy';
    let currentOctave = 4; // 默认C4音组
    let currentKeyScale = 'C'; // 默认C大调
    
    // 考试模式相关变量
    let examScore = 0; // 考试分数
    let examCurrentGroup = 0; // 当前考试组号
    const examTotalGroups = 20; // 考试总组数
    let examRandomNote = null; // 考试模式下的随机音
    let examRandomOctave = null; // 考试模式下的随机音八度
    let isWaitingForAnswer = false; // 是否等待用户回答
    
    // 生成C大调钢琴键盘（从C4到C5）
    generateCMajorKeyboard(pianoKeyboard);
    
    // 速度滑块事件
    speedSlider.addEventListener('input', function() {
        currentSpeed = parseInt(this.value);
        speedValue.textContent = currentSpeed;
    });
    
    // 停顿间隔滑块事件
    pauseSlider.addEventListener('input', function() {
        currentPause = parseFloat(this.value);
        pauseValue.textContent = currentPause;
    });
    
    // 包含黑键复选框事件
    if (includeBlackKeysCheckbox) {
        includeBlackKeysCheckbox.addEventListener('change', function() {
            includeBlackKeys = this.checked;
        });
    }
    
    // 不播放音阶复选框事件
    if (skipScaleCheckbox) {
        skipScaleCheckbox.addEventListener('change', function() {
            skipScale = this.checked;
        });
    }
    
    // 不显示音名复选框事件
    if (hideNoteNamesCheckbox) {
        hideNoteNamesCheckbox.addEventListener('change', function() {
            hideNoteNames = this.checked;
            // 重新生成钢琴键盘，应用新的设置
            updatePianoForKeyScale();
        });
    }
    
    // 模式选择事件
    if (modeSelect) {
        modeSelect.addEventListener('change', function() {
            currentMode = this.value;
            
            // 当选择考试模式时，初始提示每组考试20题
            if (currentMode === 'exam') {
                resultText.textContent = `考试模式：共${examTotalGroups}题，每题5分，总分100分`;
                resultNote.textContent = '';
                
                // 重置考试变量
                examScore = 0;
                examCurrentGroup = 0;
                examRandomNote = null;
                examRandomOctave = null;
                isWaitingForAnswer = false;
            } else {
                // 训练模式时，显示默认提示
                resultText.textContent = 'C大调自然音阶练习';
                resultNote.textContent = '';
            }
        });
    }
    
    // 难度选择事件
    if (difficultySelect) {
        difficultySelect.addEventListener('change', function() {
            currentDifficulty = this.value;
            
            // 当难度选择为困难时，默认勾选包含黑键，不可取消
            if (currentDifficulty === 'hard') {
                if (includeBlackKeysCheckbox) {
                    includeBlackKeysCheckbox.checked = true;
                    includeBlackKeysCheckbox.disabled = true;
                    includeBlackKeys = true;
                }
                
                // 困难模式时，自然大调选项也不可选
                keyScaleRadios.forEach(radio => {
                    radio.disabled = true;
                });
            } else {
                // 其他难度时，启用包含黑键复选框
                if (includeBlackKeysCheckbox) {
                    includeBlackKeysCheckbox.disabled = false;
                }
                
                // 其他难度时，启用自然大调选项
                keyScaleRadios.forEach(radio => {
                    radio.disabled = false;
                });
            }
            
            // 进阶和困难模式时，音组选择不可选
            if (currentDifficulty === 'intermediate' || currentDifficulty === 'hard') {
                octaveRadios.forEach(radio => {
                    radio.disabled = true;
                });
            } else {
                // 简单模式时，启用音组选择
                octaveRadios.forEach(radio => {
                    radio.disabled = false;
                });
            }
        });
    }
    
    // 音组选择事件
    octaveRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                currentOctave = parseInt(this.value);
                // 重新生成钢琴键盘以适应新的音组
                generateCMajorKeyboard(pianoKeyboard);
            }
        });
    });
    
    // 调式选择事件
    keyScaleRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                currentKeyScale = this.value;
                // 重新生成对应调式的钢琴键盘
                updatePianoForKeyScale();
                
                // 当自然大调不是C大调时，禁用C7音组
                const c7Radio = document.getElementById('octave-c7');
                if (c7Radio) {
                    if (currentKeyScale !== 'C') {
                        c7Radio.disabled = true;
                        // 如果当前选中的是C7，切换到其他音组
                        if (c7Radio.checked) {
                            const c6Radio = document.getElementById('octave-c6');
                            if (c6Radio) {
                                c6Radio.checked = true;
                                currentOctave = 6;
                            }
                        }
                    } else {
                        c7Radio.disabled = false;
                    }
                }
            }
        });
    });
    
    // 更新调式选择的可用性
    function updateKeyScaleAvailability() {
        // 根据当前难度更新调式选择的可用性
        keyScaleRadios.forEach(radio => {
            if (currentDifficulty === 'hard') {
                radio.disabled = true;
            } else {
                radio.disabled = false;
            }
        });
        
        // 重新生成钢琴键盘以适应新的调式
        updatePianoForKeyScale();
    }
    
    // 根据当前调式更新钢琴键盘
    function updatePianoForKeyScale() {
        // 重新生成钢琴键盘
        generateCMajorKeyboard(pianoKeyboard);
        
        // 这里可以添加调式对应的样式变化逻辑
        // 例如更改钢琴的颜色主题或添加调式标记
        updatePianoStyleForKeyScale();
    }
    
    // 根据当前调式更新钢琴样式
    function updatePianoStyleForKeyScale() {
        // 可以根据不同调式设置不同的样式
        // 例如更改钢琴键盘的颜色主题
        const pianoContainer = document.querySelector('.piano-container');
        if (pianoContainer) {
            // 移除所有调式相关的样式类
            pianoContainer.className = pianoContainer.className.replace(/\bkey-scale-\w+\b/g, '');
            // 添加当前调式的样式类
            pianoContainer.classList.add(`key-scale-${currentKeyScale.toLowerCase()}`);
        }
    }
    
    // 初始化调式选择的可用性
    updateKeyScaleAvailability();
    
    // 初始化音组选择的可用性
    if (currentDifficulty === 'intermediate' || currentDifficulty === 'hard') {
        octaveRadios.forEach(radio => {
            radio.disabled = true;
        });
    }
    
    // 初始化C7音组的可用性
    const c7Radio = document.getElementById('octave-c7');
    if (c7Radio) {
        if (currentKeyScale !== 'C') {
            c7Radio.disabled = true;
            // 如果当前选中的是C7，切换到其他音组
            if (c7Radio.checked) {
                const c6Radio = document.getElementById('octave-c6');
                if (c6Radio) {
                    c6Radio.checked = true;
                    currentOctave = 6;
                }
            }
        } else {
            c7Radio.disabled = false;
        }
    }
    
    // 初始化模式提示
    if (currentMode === 'exam') {
        resultText.textContent = `考试模式：共${examTotalGroups}题，每题5分，总分100分`;
        resultNote.textContent = '';
    }
    
    // 开始按钮事件
    startBtn.addEventListener('click', function() {
        if (isPlaying && !isPaused) return;
        
        if (isPaused) {
            // 从暂停状态恢复
            isPaused = false;
            isPlaying = true;
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            stopBtn.disabled = false;
            
            // 恢复暂停按钮为原来的暂停图标
            pauseBtn.innerHTML = '';
            pauseBtn.style.fontSize = '';
            
            resultText.textContent = '继续练习...';
            resultNote.textContent = '';
            // 继续播放
            playCMajorScale();
        } else {
            // 开始新的练习
            isPlaying = true;
            isPaused = false;
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            stopBtn.disabled = false;
            
            // 确保暂停按钮显示为暂停图标
            pauseBtn.innerHTML = '';
            pauseBtn.style.fontSize = '';
            
            // 开始播放
            playCMajorScale();
        }
    });
    
    // 暂停按钮事件
    pauseBtn.addEventListener('click', function() {
        if (!isPlaying || isPaused) return;
        
        // 请求暂停，在本组播放结束后执行
        pauseRequested = true;
        resultText.textContent = '将在本组播放结束后暂停...';
        resultNote.textContent = '';
    });
    
    // 停止按钮事件
    stopBtn.addEventListener('click', function() {
        if (!isPlaying) return;
        
        isPlaying = false;
        isPaused = false;
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        
        // 恢复暂停按钮为原来的暂停图标
        pauseBtn.innerHTML = '';
        pauseBtn.style.fontSize = '';
        
        // 清除定时器
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        
        // 重置结果显示
        resultText.textContent = '练习已停止';
        resultNote.textContent = '';
        
        // 移除所有高亮
        removeAllHighlights();
    });
    
    // 生成对应调式的钢琴键盘（根据当前音组，包含所有黑白键）
    function generateCMajorKeyboard(container) {
        container.innerHTML = '';
        
        // 根据当前调式获取对应的音阶
        const scaleNotes = getScaleNotesForKey(currentKeyScale);
        
        // 获取当前调式的第一个音符作为起始音
        const firstNote = scaleNotes[0];
        
        // 计算八度范围：起始音在currentOctave，结束音在currentOctave + 1
        const startOctave = currentOctave;
        const endOctave = currentOctave + 1;
        
        // 生成完整的钢琴键配置（包含黑白键）
        // 从起始音开始，生成一个八度的音符
        const keyPattern = generateKeyPatternForScale(currentKeyScale, startOctave, endOctave);
        
        // 生成钢琴键
        for (let i = 0; i < keyPattern.length; i++) {
            const { note, octave, isWhite } = keyPattern[i];
            
            // 根据音名和八度从keyMapping中获取对应的键信息
            const keyInfo = getKeyInfoByNoteAndOctave(note, octave);
            
            // 创建键元素
            const key = document.createElement('div');
            key.className = `key ${isWhite ? 'white' : 'black'}`;
            
            // 判断当前键是否是黑键
            const isBlackKey = !isWhite;
            
            // 使用 getSolfegeLabel 对所有琴键计算唱名标签（音阶内音符显示纯数字，非音阶音符显示 #N）
            let solfegeHtml = '';
            const solfegeLabel = getSolfegeLabel(note, currentKeyScale);
            if (solfegeLabel) {
                const isSharpSolfege = solfegeLabel.startsWith('#');
                solfegeHtml = `
                    <div style="
                        font-size: 1.5rem;
                        font-weight: normal;
                        color: ${isBlackKey ? '#68d391' : '#38a169'};
                        margin-bottom: 5px;
                        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
                        z-index: 100;
                    ">
                        ${solfegeLabel}
                    </div>
                `;
            }
            
            // 直接在键元素中添加HTML内容
            if (hideNoteNames) {
                // 如果勾选了不显示音名，则不显示任何内容
                key.innerHTML = '';
            } else {
                // 否则显示唱名和音名
                key.innerHTML = `
                    <div style="
                        position: absolute;
                        bottom: 20px;
                        left: 0;
                        right: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        z-index: 100;
                    ">
                        ${solfegeHtml}
                        <div style="
                            font-size: 0.9rem;
                            font-weight: bold;
                            color: ${isBlackKey ? 'white' : '#2d3748'};
                        ">
                            ${note}${octave}
                        </div>
                    </div>
                `;
            }
            
            // 设置数据集属性
            key.dataset.note = note;
            key.dataset.octave = octave;
            key.dataset.fullNote = note + octave;
            
            // 如果找到了键信息，添加额外的数据集属性
            if (keyInfo) {
                key.dataset.midiNumber = keyInfo.midiNumber;
                key.dataset.frequency = keyInfo.frequency;
                key.dataset.audioFile = keyInfo.audioFile;
            }
            
            // 添加琴键点击事件
            key.addEventListener('click', function() {
                // 在考试模式等待回答时，允许点击
                if (isWaitingForAnswer) {
                    // 考试模式下的点击由handleKeyClickForExam处理
                    return;
                }
                
                // 只有在未开始练习、在结果显示期间或者暂停状态下才能点击发声
                if (!isPlaying || isPaused) {
                    const note = this.dataset.note;
                    const octave = parseInt(this.dataset.octave);
                    
                    // 播放音符
                    audioSystem.playNote(note, octave, 1.0);
                    
                    // 添加按下效果
                    this.classList.add('active');
                    setTimeout(() => {
                        this.classList.remove('active');
                    }, 100);
                }
            });
            
            container.appendChild(key);
        }
    }
    
    // 根据调式生成键盘音符模式
    function generateKeyPatternForScale(keyScale, startOctave, endOctave) {
        // 完整的12平均律音符序列（同时包含升号和降号形式）
        const chromaticScale = [
            { note: 'C', alt: ['B#'] },
            { note: 'C#', alt: ['Db'] },
            { note: 'D', alt: [] },
            { note: 'D#', alt: ['Eb'] },
            { note: 'E', alt: ['Fb'] },
            { note: 'F', alt: ['E#'] },
            { note: 'F#', alt: ['Gb'] },
            { note: 'G', alt: [] },
            { note: 'G#', alt: ['Ab'] },
            { note: 'A', alt: [] },
            { note: 'A#', alt: ['Bb'] },
            { note: 'B', alt: ['Cb'] }
        ];
        
        // 根据当前调式获取对应的音阶
        const scaleNotes = getScaleNotesForKey(keyScale);
        
        // 获取起始音在12平均律中的索引
        const firstNote = scaleNotes[0];
        let startIndex = -1;
        
        // 查找起始音在chromaticScale中的索引
        for (let i = 0; i < chromaticScale.length; i++) {
            if (chromaticScale[i].note === firstNote || chromaticScale[i].alt.includes(firstNote)) {
                startIndex = i;
                break;
            }
        }
        
        // 如果没有找到，使用默认值（C大调）
        if (startIndex === -1) {
            startIndex = 0;
        }
        
        // 获取当前调式的example音名，用于确定正确的音名显示
        const scaleExample = window.majorScales && window.majorScales[keyScale] ? window.majorScales[keyScale].example : [];
        
        // 生成一个八度的音符模式
        const keyPattern = [];
        let currentOctave = startOctave;
        
        for (let i = 0; i <= 12; i++) { // 13个音符（包含起始音和一个八度后的结束音）
            const noteIndex = (startIndex + i) % 12;
            const noteInfo = chromaticScale[noteIndex];
            
            // 计算八度：当音符是C且不是第一个音符时，八度加1
            if (i > 0 && noteInfo.note === 'C') {
                currentOctave = endOctave;
            }
            
            // 选择合适的音符表示形式
            let note = noteInfo.note;
            
            // 尝试从当前调式的example中找到对应的音名
            if (scaleExample.length > 0) {
                // 遍历example，查找与当前音符和八度相匹配的音名
                for (const exampleNote of scaleExample) {
                    // 提取example中的八度
                    const exampleOctave = parseInt(exampleNote.replace(/[^0-9]/g, ''));
                    // 提取example中的音符名称
                    const exampleNoteName = exampleNote.replace(/[0-9]/g, '');
                    
                    // 检查example中的音符是否与当前音符是等音
                    if (isEnharmonic(exampleNoteName, noteInfo.note) || noteInfo.alt.some(alt => isEnharmonic(exampleNoteName, alt))) {
                        // 使用example中的音符表示形式
                        note = exampleNoteName;
                        break;
                    }
                }
            }
            
            // 特殊处理E#音符，确保显示为F键
            if (note === 'E#') {
                note = 'F';
            }
            
            // 判断是否是白键
            const isWhite = !note.includes('#') && !note.includes('b');
            
            keyPattern.push({ note, octave: currentOctave, isWhite });
        }
        
        return keyPattern;
    }
    
    // 检查两个音符是否是等音
    function isEnharmonic(note1, note2) {
        // 首先检查两个音符是否完全相同
        if (note1 === note2) {
            return true;
        }
        
        // 完善的等音映射，包含所有可能的等音关系
        const enharmonicMap = {
            'C': ['B#'],
            'C#': ['Db'],
            'Db': ['C#'],
            'D': [],
            'D#': ['Eb'],
            'Eb': ['D#'],
            'E': ['Fb'],
            'F': ['E#'],
            'E#': ['F'],
            'Fb': ['E'],
            'F#': ['Gb'],
            'Gb': ['F#'],
            'G': [],
            'G#': ['Ab'],
            'Ab': ['G#'],
            'A': [],
            'A#': ['Bb'],
            'Bb': ['A#'],
            'B': ['Cb'],
            'Cb': ['B']
        };
        
        // 检查note1是否在note2的等音列表中，或note2是否在note1的等音列表中
        return (enharmonicMap[note1] && enharmonicMap[note1].includes(note2)) || 
               (enharmonicMap[note2] && enharmonicMap[note2].includes(note1));
    }
    
    // 获取音符的科学记号法表示
    function getScientificNotation(note, octave) {
        // 尝试直接从scientificToKeyMap中查找
        const directScientific = `${note}${octave}`;
        if (window.scientificToKeyMap && window.scientificToKeyMap[directScientific]) {
            return directScientific;
        }
        
        // 如果找不到，尝试查找等音
        if (window.keyMapping) {
            for (const key of window.keyMapping) {
                if (key.octave === octave && isEnharmonic(key.noteName, note)) {
                    return key.scientific;
                }
            }
        }
        
        // 如果还是找不到，返回原始表示
        return directScientific;
    }
    
    // 获取音符的实际播放名称（考虑等音关系）
    function getPlayableNoteName(note, octave) {
        // 特殊处理E#和Fb等音符
        if (note === 'E#') {
            return 'F';
        }
        if (note === 'Fb') {
            return 'E';
        }
        if (note === 'B#') {
            return 'C';
        }
        if (note === 'Cb') {
            return 'B';
        }
        
        // 尝试直接从scientificToKeyMap中查找
        const directScientific = `${note}${octave}`;
        if (window.scientificToKeyMap && window.scientificToKeyMap[directScientific]) {
            return note;
        }
        
        // 如果找不到，尝试查找等音
        if (window.keyMapping) {
            for (const key of window.keyMapping) {
                if (key.octave === octave && isEnharmonic(key.noteName, note)) {
                    return key.noteName;
                }
            }
        }
        
        // 如果还是找不到，返回原始音符名称
        return note;
    }
    
    // 计算音阶中每个音符的正确八度
    function calculateOctaves(scaleNotes, startOctave) {
        const octaves = [];
        let currentOctave = startOctave;
        let previousNote = null;
        
        // 音符音高顺序（C开始）
        const noteOrder = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
        
        for (const note of scaleNotes) {
            // 处理特殊音符
            const normalizedNote = getPlayableNoteName(note, currentOctave);
            
            // 检查是否需要增加八度
            if (previousNote) {
                const previousIndex = noteOrder.indexOf(previousNote);
                const currentIndex = noteOrder.indexOf(normalizedNote);
                
                // 如果当前音符在音高顺序中位于前一个音符之前，说明跨八度了
                if (currentIndex < previousIndex) {
                    currentOctave++;
                }
            }
            
            octaves.push(currentOctave);
            previousNote = normalizedNote;
        }
        
        return octaves;
    }
    
    // 根据音符名称和八度获取键信息
    function getKeyInfoByNoteAndOctave(noteName, octave) {
        // 尝试使用keymapping.js中提供的工具函数
        if (window.getKeyByNoteAndOctave) {
            return window.getKeyByNoteAndOctave(noteName, octave);
        }
        
        // 尝试使用科学记号法查找
        if (window.getKeyByScientific) {
            const scientific = `${noteName}${octave}`;
            return window.getKeyByScientific(scientific);
        }
        
        // 备用方法：直接从keyMapping数组中查找
        if (window.keyMapping) {
            // 首先尝试直接匹配
            let keyInfo = window.keyMapping.find(key => {
                return key.scientific === `${noteName}${octave}`;
            });
            
            // 如果没有找到，尝试匹配等音
            if (!keyInfo) {
                // 构建科学记号法
                const scientific = `${noteName}${octave}`;
                
                // 从scientificToKeyMap中查找
                if (window.scientificToKeyMap && window.scientificToKeyMap[scientific]) {
                    return window.scientificToKeyMap[scientific];
                }
                
                // 最后尝试从keyMapping的alternateNames中查找
                keyInfo = window.keyMapping.find(key => {
                    return key.alternateNames.includes(scientific);
                });
            }
            
            return keyInfo;
        }
        
        return null;
    }
    
    // 播放对应调式的音阶
    async function playCMajorScale() {
        if (!isPlaying || isPaused) return;
        
        // 重置结果显示
        if (currentMode === 'exam') {
            resultText.textContent = `考试模式：第${examCurrentGroup + 1}题，共${examTotalGroups}题`;
        } else {
            resultText.textContent = '正在播放音阶...';
        }
        resultNote.textContent = '';
        removeAllHighlights();
        
        // 根据当前调式获取对应的音阶音符
        const scaleNotes = getScaleNotesForKey(currentKeyScale);
        // 根据当前音组和音符实际音高关系计算正确的八度数组
        const octaves = calculateOctaves(scaleNotes, currentOctave);
        
        // 计算四分音符时值（根据当前BPM）
        const quarterNoteDuration = 60 / currentSpeed;
        
        // 如果不跳过音阶，播放对应调式的音阶
        if (!skipScale) {
            for (let i = 0; i < scaleNotes.length; i++) {
                if (!isPlaying) return;
                
                const note = scaleNotes[i];
                const octave = octaves[i];
                
                // 高亮当前琴键
                highlightKey(note, octave);
                
                // 获取实际可播放的音符名称（考虑等音关系）
                const playableNote = getPlayableNoteName(note, octave);
                
                // 播放音符 - 使用四分音符时值
                audioSystem.playNote(playableNote, octave, quarterNoteDuration);
                
                // 等待音符播放完毕
                await new Promise(resolve => setTimeout(resolve, quarterNoteDuration * 1000));
                
                // 移除高亮
                removeHighlight(note, octave);
            }
        }
        
        // 播放当前调式的主音三次，然后随机播放一个音
        if (!isPlaying) return;
        
        // 固定BPM=90，二分音符时值
        const fixedBPM = 90;
        const halfNoteDuration = 60 / fixedBPM * 2; // 二分音符 = 2个四分音符
        
        // 播放当前调式的主音两次（二分音符时值）
        for (let i = 0; i < 2; i++) {
            if (!isPlaying) return;
            const playableRootNote = getPlayableNoteName(scaleNotes[0], currentOctave);
            audioSystem.playNote(playableRootNote, currentOctave, halfNoteDuration);
            await new Promise(resolve => setTimeout(resolve, halfNoteDuration * 1000));
        }
        
        // 随机选择一个音播放一次（二分音符时值）
        if (!isPlaying) return;
        
        let randomNote, randomOctave;
        
        if (includeBlackKeys) {
            // 包含所有键时，从当前调式八度范围内的完整12平均律音阶中选择随机音
            
            // 获取当前调式的起始音和八度范围
            const firstNote = scaleNotes[0];
            const startOctave = currentOctave;
            const endOctave = currentOctave + 1;
            
            // 生成当前调式八度范围内的所有12平均律音符
            const chromaticScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const chromaticScaleWithFlats = {
                'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 
                'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 
                'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
            };
            
            // 计算起始音在12平均律中的索引（支持升降号）
            const firstNoteIndex = chromaticScaleWithFlats[firstNote] || 0;
            
            // 生成当前八度范围内的所有音符（包含黑键）
            // 例如：F#大调C4组应该从F#4开始，到F#5结束
            const allNotesInOctave = [];
            const allOctavesInRange = [];
            
            for (let i = 0; i < 12; i++) {
                const noteIndex = (firstNoteIndex + i) % 12;
                const note = chromaticScale[noteIndex];
                // 计算八度：基于起始音的位置
                // 对于F#大调，起始音是F#，索引为6
                // 当i从0到11时，noteIndex从6到5
                // 当noteIndex >= firstNoteIndex时，在当前八度；否则在下一个八度
                const octave = noteIndex >= firstNoteIndex ? startOctave : endOctave;
                allNotesInOctave.push(note);
                allOctavesInRange.push(octave);
            }
            
            // 从当前八度范围内的所有音符中选择随机音
            const randomIndex = Math.floor(Math.random() * allNotesInOctave.length);
            randomNote = allNotesInOctave[randomIndex];
            randomOctave = allOctavesInRange[randomIndex];
        } else {
            // 不包含所有键时，从当前调式的音阶中选择随机音
            const randomIndex = Math.floor(Math.random() * scaleNotes.length);
            randomNote = scaleNotes[randomIndex];
            randomOctave = octaves[randomIndex];
        }
        
        // 获取实际可播放的随机音符名称（考虑等音关系）
        const playableRandomNote = getPlayableNoteName(randomNote, randomOctave);
        
        // 播放随机音（二分音符时值）
        audioSystem.playNote(playableRandomNote, randomOctave, halfNoteDuration);
        await new Promise(resolve => setTimeout(resolve, halfNoteDuration * 1000));
        
        // 检查是否是考试模式
        if (currentMode === 'exam') {
            // 考试模式：直接进入等待用户回答状态
        } else {
            // 训练模式：停顿2秒，再次播放相同的随机音
            // 停顿2秒
            if (!isPlaying) return;
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 再次播放相同的随机音
            if (!isPlaying) return;
            audioSystem.playNote(playableRandomNote, randomOctave, halfNoteDuration);
            await new Promise(resolve => setTimeout(resolve, halfNoteDuration * 1000));
        }
        
        // 检查是否是考试模式
        if (currentMode === 'exam') {
            // 考试模式：等待用户回答
            examRandomNote = randomNote;
            examRandomOctave = randomOctave;
            isWaitingForAnswer = true;
            
            resultText.textContent = '请在钢琴上选择最后播放的音：';
            resultNote.textContent = '';
            
            // 添加钢琴键点击事件监听器（考试模式专用）
            const pianoKeys = document.querySelectorAll('.key');
            pianoKeys.forEach(key => {
                // 移除可能存在的旧事件监听器
                key.removeEventListener('click', handleKeyClickForExam);
                // 添加新的事件监听器
                key.addEventListener('click', handleKeyClickForExam);
            });
        } else {
            // 训练模式：直接显示结果
            resultText.textContent = '最后随机播放的音是：';
            resultNote.textContent = randomNote + randomOctave;
            
            // 高亮对应的琴键（绿色）
            highlightResultKey(randomNote, randomOctave);
            
            // 语音播放唱名
            speakNoteName(randomNote);
            
            // 停顿指定时间后继续
            timer = setTimeout(() => {
                if (isPlaying) {
                    // 检查是否有暂停请求
                    if (pauseRequested) {
                        // 执行暂停
                        isPaused = true;
                        pauseRequested = false;
                        isPlaying = true; // 保持isPlaying为true，因为只是暂停
                        
                        // 更新按钮状态
                        startBtn.disabled = false;
                        pauseBtn.disabled = true;
                        stopBtn.disabled = false;
                        
                        // 保持暂停按钮的原始状态，只是禁用它
                        pauseBtn.innerHTML = '';
                        
                        // 更新结果显示
                        resultText.textContent = '练习已暂停，点击开始按钮继续';
                        resultNote.textContent = '';
                        
                        return;
                    }
                    
                    // 当难度为进阶或困难时
                    if (currentDifficulty === 'intermediate' || currentDifficulty === 'hard') {
                        if (currentDifficulty === 'hard') {
                            // 困难模式时，随机选择切换自然大调或音组
                            const shouldChangeKey = Math.random() > 0.5;
                            
                            if (shouldChangeKey) {
                                // 随机切换自然大调
                                const availableKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
                                // 过滤掉当前调式，得到可选择的调式
                                const availableOtherKeys = availableKeys.filter(key => key !== currentKeyScale);
                                // 随机选择一个调式
                                if (availableOtherKeys.length > 0) {
                                    const randomIndex = Math.floor(Math.random() * availableOtherKeys.length);
                                    currentKeyScale = availableOtherKeys[randomIndex];
                                    // 更新对应的调式选择框
                                    // 映射调式名称到正确的ID
                                    const keyIdMap = {
                                        'C': 'scale-c',
                                        'G': 'scale-g',
                                        'D': 'scale-d',
                                        'A': 'scale-a',
                                        'E': 'scale-e',
                                        'B': 'scale-b',
                                        'F#': 'scale-fs',
                                        'F': 'scale-f',
                                        'Bb': 'scale-bb',
                                        'Eb': 'scale-eb',
                                        'Ab': 'scale-ab',
                                        'Db': 'scale-db'
                                    };
                                    const keyRadio = document.getElementById(keyIdMap[currentKeyScale]);
                                    if (keyRadio) {
                                        keyRadio.checked = true;
                                    }
                                    // 重新生成对应调式的钢琴键盘
                                    updatePianoForKeyScale();
                                }
                            } else {
                                // 随机选择其他音组
                                // 定义可选的音组范围，排除C7组
                                const availableOctaves = [2, 3, 4, 5, 6];
                                // 过滤掉当前音组，得到可选择的音组
                                const availableOtherOctaves = availableOctaves.filter(octave => octave !== currentOctave);
                                // 随机选择一个音组
                                if (availableOtherOctaves.length > 0) {
                                    const randomIndex = Math.floor(Math.random() * availableOtherOctaves.length);
                                    currentOctave = availableOtherOctaves[randomIndex];
                                    // 更新对应的音组选择框
                                    const octaveRadio = document.getElementById(`octave-c${currentOctave}`);
                                    if (octaveRadio) {
                                        octaveRadio.checked = true;
                                    }
                                    // 重新生成钢琴键盘以适应新的音组
                                    generateCMajorKeyboard(pianoKeyboard);
                                }
                            }
                        } else {
                            // 进阶模式时，只随机选择其他音组
                            // 定义可选的音组范围，排除C7组
                            const availableOctaves = [2, 3, 4, 5, 6];
                            // 过滤掉当前音组，得到可选择的音组
                            const availableOtherOctaves = availableOctaves.filter(octave => octave !== currentOctave);
                            // 随机选择一个音组
                            if (availableOtherOctaves.length > 0) {
                                const randomIndex = Math.floor(Math.random() * availableOtherOctaves.length);
                                currentOctave = availableOtherOctaves[randomIndex];
                                // 更新对应的音组选择框
                                const octaveRadio = document.getElementById(`octave-c${currentOctave}`);
                                if (octaveRadio) {
                                    octaveRadio.checked = true;
                                }
                                // 重新生成钢琴键盘以适应新的音组
                                generateCMajorKeyboard(pianoKeyboard);
                            }
                        }
                    }
                    playCMajorScale();
                }
            }, currentPause * 1000);
        }
    }
    
    // 根据调式获取对应的音阶音符
    function getScaleNotesForKey(key) {
        // 从keymapping.js中的majorScales获取音阶信息
        if (window.majorScales && window.majorScales[key]) {
            return window.majorScales[key].scale;
        }
        
        // 硬编码的备用音阶信息（以防majorScales未加载）
        const keyScales = {
            'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'],
            'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#', 'G'],
            'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#', 'D'],
            'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#', 'A'],
            'E': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#', 'E'],
            'B': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#', 'B'],
            'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#', 'F#'],
            'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E', 'F'],
            'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'],
            'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D', 'Eb'],
            'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G', 'Ab'],
            'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C', 'Db']
        };
        
        return keyScales[key] || keyScales['C']; // 默认返回C大调音阶
    }
    
    // 高亮琴键
    function highlightKey(note, octave) {
        // 尝试直接查找
        let key = document.querySelector(`[data-note="${note}"][data-octave="${octave}"]`);
        
        // 如果找不到，尝试查找等音
        if (!key) {
            const allKeys = document.querySelectorAll(`[data-octave="${octave}"]`);
            for (const k of allKeys) {
                if (isEnharmonic(k.dataset.note, note)) {
                    key = k;
                    break;
                }
            }
        }
        
        if (key) {
            key.classList.add('highlight');
        }
    }
    
    // 唱名人声文件映射：solfegeLabel → voice 文件名
    const solfegeVoiceMap = {
        '1':  'C-1-do.wav',
        '#1': '#C-#1-di.wav',
        '2':  'D-2-re.wav',
        '#2': '#D-#2-ri.wav',
        '3':  'E-3-mi.wav',
        '4':  'F-4-fa.wav',
        '#4': '#F-#4-fi.wav',
        '5':  'G-5-sol.wav',
        '#5': '#G-#5-si.wav',
        '6':  'A-6-la.wav',
        '#6': '#A-#6-li.wav',
        '7':  'B-7-ti.wav'
    };

    // 根据当前调式，计算任意音符的唱名标签（如 "1", "#1", "2", "#4" 等）
    function getSolfegeLabel(note, keyScale) {
        const scale = getScaleNotesForKey(keyScale);
        
        // 检查是否是音阶内音符
        for (let i = 0; i < scale.length; i++) {
            if (isEnharmonic(note, scale[i])) {
                return i === 7 ? '1' : (i + 1).toString();
            }
        }
        
        // 非音阶内音符：找到下方最近的音阶音，返回 #N
        const chromaticBase = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const chromaticIdx = {
            'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,
            'E':4,'Fb':4,'E#':5,'F':5,'F#':6,'Gb':6,
            'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,
            'B':11,'Cb':11,'B#':0
        };
        
        const tonicIdx = chromaticIdx[scale[0]];
        const noteIdx = chromaticIdx[note];
        
        // 从主音开始的半音序列
        const chromaticFromTonic = [];
        for (let i = 0; i < 13; i++) {
            chromaticFromTonic.push(chromaticBase[(tonicIdx + i) % 12]);
        }
        
        // 找到当前音符在半音序列中的位置
        let notePos = -1;
        for (let i = 0; i < chromaticFromTonic.length; i++) {
            if (isEnharmonic(chromaticFromTonic[i], note)) {
                notePos = i;
                break;
            }
        }
        
        // 向前寻找最近的音阶内音符
        for (let step = notePos - 1; step >= 0; step--) {
            const chromaticNote = chromaticFromTonic[step];
            for (let i = 0; i < scale.length; i++) {
                if (isEnharmonic(chromaticNote, scale[i])) {
                    return '#' + (i === 7 ? '1' : (i + 1).toString());
                }
            }
        }
        
        return '';
    }

    // 播放唱名人声文件
    function playSolfegeVoice(solfegeLabel) {
        const voiceFile = solfegeVoiceMap[solfegeLabel];
        if (!voiceFile) return;
        
        const voiceUrl = '/static/audio/voice/' + voiceFile;
        const audio = new Audio(voiceUrl);
        audio.play().catch(err => {
            console.warn('播放唱名人声失败:', solfegeLabel, err);
        });
    }

    // 语音播放音名（保留兼容，内部改用唱名人声 + TTS 兜底）
    function speakNoteName(note) {
        // 优先使用唱名人声文件
        const solfegeLabel = getSolfegeLabel(note, currentKeyScale);
        if (solfegeLabel && solfegeVoiceMap[solfegeLabel]) {
            playSolfegeVoice(solfegeLabel);
            return;
        }
        
        // 兜底：TTS 朗读
        let spokenNote = note;
        spokenNote = spokenNote.replace('#', '升');
        spokenNote = spokenNote.replace('b', '降');
        
        if (spokenNote && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(spokenNote);
            utterance.lang = 'zh-CN';
            utterance.rate = 0.8;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            speechSynthesis.speak(utterance);
        }
    }
    
    // 高亮结果琴键（绿色）
    function highlightResultKey(note, octave) {
        // 尝试直接查找
        let key = document.querySelector(`[data-note="${note}"][data-octave="${octave}"]`);
        
        // 如果找不到，尝试查找等音
        if (!key) {
            const allKeys = document.querySelectorAll(`[data-octave="${octave}"]`);
            for (const k of allKeys) {
                if (isEnharmonic(k.dataset.note, note)) {
                    key = k;
                    break;
                }
            }
        }
        
        if (key) {
            key.classList.add('result-highlight');
        }
    }
    
    // 移除单个琴键高亮
    function removeHighlight(note, octave) {
        // 尝试直接查找
        let key = document.querySelector(`[data-note="${note}"][data-octave="${octave}"]`);
        
        // 如果找不到，尝试查找等音
        if (!key) {
            const allKeys = document.querySelectorAll(`[data-octave="${octave}"]`);
            for (const k of allKeys) {
                if (isEnharmonic(k.dataset.note, note)) {
                    key = k;
                    break;
                }
            }
        }
        
        if (key) {
            key.classList.remove('highlight', 'result-highlight');
        }
    }
    
    // 移除所有琴键高亮
    function removeAllHighlights() {
        const keys = document.querySelectorAll('.key');
        keys.forEach(key => {
            key.classList.remove('highlight', 'result-highlight');
        });
    }
    
    // 考试模式下处理钢琴键点击
    function handleKeyClickForExam() {
        if (!isWaitingForAnswer) return;
        
        const clickedNote = this.dataset.note;
        const clickedOctave = parseInt(this.dataset.octave);
        
        // 检查用户回答是否正确
        const isCorrect = clickedNote === examRandomNote && clickedOctave === examRandomOctave;
        
        // 计分
        if (isCorrect) {
            examScore += 5; // 每组5分
        }
        
        // 显示结果
        resultText.textContent = isCorrect ? '回答正确！' : '回答错误！';
        resultNote.textContent = examRandomNote + examRandomOctave;
        
        // 高亮对应的琴键
        highlightResultKey(examRandomNote, examRandomOctave);
        
        // 再次播放正确的随机音
        const fixedBPM = 90;
        const halfNoteDuration = 60 / fixedBPM * 2;
        const playableExamNote = getPlayableNoteName(examRandomNote, examRandomOctave);
        audioSystem.playNote(playableExamNote, examRandomOctave, halfNoteDuration);
        
        // 语音播放唱名
        speakNoteName(examRandomNote);
        
        // 标记为不再等待回答
        isWaitingForAnswer = false;
        
        // 增加考试组号
        examCurrentGroup++;
        
        // 检查考试是否结束
        if (examCurrentGroup >= examTotalGroups) {
            // 考试结束
                setTimeout(() => {
                    resultText.textContent = `考试结束！本次考试分数：${examScore}分`;
                    resultNote.textContent = '';
                    
                    // 语音提示考试分数
                    if (window.speechSynthesis) {
                        const utterance = new SpeechSynthesisUtterance(`本次考试分数：${examScore}分`);
                        utterance.lang = 'zh-CN';
                        utterance.rate = 0.8;
                        utterance.pitch = 1.0;
                        utterance.volume = 1.0;
                        speechSynthesis.speak(utterance);
                    }
                    
                    // 停止播放
                    isPlaying = false;
                    startBtn.disabled = false;
                    stopBtn.disabled = true;
                    
                    // 重置考试变量
                    examScore = 0;
                    examCurrentGroup = 0;
                    examRandomNote = null;
                    examRandomOctave = null;
                }, 2000);
        } else {
            // 继续下一组
            setTimeout(() => {
                if (isPlaying) {
                    // 检查是否有暂停请求
                    if (pauseRequested) {
                        // 执行暂停
                        isPaused = true;
                        pauseRequested = false;
                        isPlaying = true; // 保持isPlaying为true，因为只是暂停
                        
                        // 更新按钮状态
                        startBtn.disabled = false;
                        pauseBtn.disabled = true;
                        stopBtn.disabled = false;
                        
                        // 保持暂停按钮的原始状态，只是禁用它
                        pauseBtn.innerHTML = '';
                        
                        // 更新结果显示
                        resultText.textContent = '练习已暂停，点击开始按钮继续';
                        resultNote.textContent = '';
                        
                        return;
                    }
                    
                    // 当难度为进阶或困难时
                    if (currentDifficulty === 'intermediate' || currentDifficulty === 'hard') {
                        if (currentDifficulty === 'hard') {
                            // 困难模式时，随机选择切换自然大调或音组
                            const shouldChangeKey = Math.random() > 0.5;
                            
                            if (shouldChangeKey) {
                                // 随机切换自然大调
                                const availableKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
                                // 过滤掉当前调式，得到可选择的调式
                                const availableOtherKeys = availableKeys.filter(key => key !== currentKeyScale);
                                // 随机选择一个调式
                                if (availableOtherKeys.length > 0) {
                                    const randomIndex = Math.floor(Math.random() * availableOtherKeys.length);
                                    currentKeyScale = availableOtherKeys[randomIndex];
                                    // 更新对应的调式选择框
                                    // 映射调式名称到正确的ID
                                    const keyIdMap = {
                                        'C': 'scale-c',
                                        'G': 'scale-g',
                                        'D': 'scale-d',
                                        'A': 'scale-a',
                                        'E': 'scale-e',
                                        'B': 'scale-b',
                                        'F#': 'scale-fs',
                                        'F': 'scale-f',
                                        'Bb': 'scale-bb',
                                        'Eb': 'scale-eb',
                                        'Ab': 'scale-ab',
                                        'Db': 'scale-db'
                                    };
                                    const keyRadio = document.getElementById(keyIdMap[currentKeyScale]);
                                    if (keyRadio) {
                                        keyRadio.checked = true;
                                    }
                                    // 重新生成对应调式的钢琴键盘
                                    updatePianoForKeyScale();
                                }
                            } else {
                                // 随机选择其他音组
                                // 定义可选的音组范围，排除C7组
                                const availableOctaves = [2, 3, 4, 5, 6];
                                // 过滤掉当前音组，得到可选择的音组
                                const availableOtherOctaves = availableOctaves.filter(octave => octave !== currentOctave);
                                // 随机选择一个音组
                                if (availableOtherOctaves.length > 0) {
                                    const randomIndex = Math.floor(Math.random() * availableOtherOctaves.length);
                                    currentOctave = availableOtherOctaves[randomIndex];
                                    // 更新对应的音组选择框
                                    const octaveRadio = document.getElementById(`octave-c${currentOctave}`);
                                    if (octaveRadio) {
                                        octaveRadio.checked = true;
                                    }
                                    // 重新生成钢琴键盘以适应新的音组
                                    generateCMajorKeyboard(pianoKeyboard);
                                }
                            }
                        } else {
                            // 进阶模式时，只随机选择其他音组
                            // 定义可选的音组范围，排除C7组
                            const availableOctaves = [2, 3, 4, 5, 6];
                            // 过滤掉当前音组，得到可选择的音组
                            const availableOtherOctaves = availableOctaves.filter(octave => octave !== currentOctave);
                            // 随机选择一个音组
                            if (availableOtherOctaves.length > 0) {
                                const randomIndex = Math.floor(Math.random() * availableOtherOctaves.length);
                                currentOctave = availableOtherOctaves[randomIndex];
                                // 更新对应的音组选择框
                                const octaveRadio = document.getElementById(`octave-c${currentOctave}`);
                                if (octaveRadio) {
                                    octaveRadio.checked = true;
                                }
                                // 重新生成钢琴键盘以适应新的音组
                                generateCMajorKeyboard(pianoKeyboard);
                            }
                        }
                    }
                    playCMajorScale();
                }
            }, currentPause * 1000);
        }
    }
}

// 播放录音（简化版）
function playBackRecordedNotes(notes) {
    if (notes.length === 0) {
        alert('没有录音内容');
        return;
    }
    
    notes.forEach((note, index) => {
        setTimeout(() => {
            audioSystem.playNote(note.note, note.octave, note.duration);
        }, index * 500);
    });
}

// 添加一些键盘快捷键支持
document.addEventListener('keydown', function(e) {
    // 简单的键盘映射，对应C大调音阶
    const keyMap = {
        'a': 'C',
        's': 'D',
        'd': 'E',
        'f': 'F',
        'g': 'G',
        'h': 'A',
        'j': 'B',
        'k': 'C'
    };
    
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const note = keyMap[e.key.toLowerCase()];
    if (note) {
        e.preventDefault();
        audioSystem.playNote(note, 4, 1.0);
    }
});
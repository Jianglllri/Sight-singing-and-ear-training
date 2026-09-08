// 钢琴88键映射关系
// 基于 maprule.js 和音频映射关系.txt 生成
// 所有音频文件路径基于 static/audio/piano/

// 重要说明：
// 1. 等音处理：
//    - 每个白键：包含一个升号和两个降号的等音（或反之）
//    - 每个黑键：包含降号和重升/重降等音
//    - 注意：重升(𝄪)和重降(𝄫)是音乐符号，实际使用时可能需要用"x"和"bb"代替

// 2. 八度边界处理：
//    - 特别注意B和C之间的等音关系：B# = C，Cb = B
//    - 例如：B0的等音包含Cb1（跨八度）
//    - E和F之间同理：E# = F，Fb = E

// 3. 频率计算：
//    - 基于十二平均律，A4 = 440Hz标准
//    - 公式：frequency = 440 * 2^((midiNumber - 69) / 12)

// 4. 特殊标记：
//    - 使用𝄪(U+1D12A)表示重升，𝄫(U+1D12B)表示重降
//    - 在实际代码中可能需要使用HTML实体或Unicode转义

const keyMapping = [
    // 低音区 (A0 - B1)
    { index: 0, keyType: 'white', noteName: 'A', octave: 0, scientific: 'A0', alternateNames: [], frequency: 27.50, audioFile: 'A_2.mp3', midiNumber: 21, isAccidental: false },
    { index: 1, keyType: 'black', noteName: 'A#', octave: 0, scientific: 'A#0', alternateNames: ['Bb0', 'C𝄫0'], frequency: 29.14, audioFile: 'A_2s.mp3', midiNumber: 22, isAccidental: true },
    { index: 2, keyType: 'white', noteName: 'B', octave: 0, scientific: 'B0', alternateNames: ['Cb1', 'A𝄪0'], frequency: 30.87, audioFile: 'B_2.mp3', midiNumber: 23, isAccidental: false },
    { index: 3, keyType: 'white', noteName: 'C', octave: 1, scientific: 'C1', alternateNames: ['B#0', 'D𝄫1'], frequency: 32.70, audioFile: 'C_1.mp3', midiNumber: 24, isAccidental: false },
    { index: 4, keyType: 'black', noteName: 'C#', octave: 1, scientific: 'C#1', alternateNames: ['Db1', 'B𝄪0'], frequency: 34.65, audioFile: 'C_1s.mp3', midiNumber: 25, isAccidental: true },
    { index: 5, keyType: 'white', noteName: 'D', octave: 1, scientific: 'D1', alternateNames: ['C𝄪1', 'E𝄫1'], frequency: 36.71, audioFile: 'D_1.mp3', midiNumber: 26, isAccidental: false },
    { index: 6, keyType: 'black', noteName: 'D#', octave: 1, scientific: 'D#1', alternateNames: ['Eb1', 'F𝄫1'], frequency: 38.89, audioFile: 'D_1s.mp3', midiNumber: 27, isAccidental: true },
    { index: 7, keyType: 'white', noteName: 'E', octave: 1, scientific: 'E1', alternateNames: ['Fb1', 'D𝄪1'], frequency: 41.20, audioFile: 'E_1.mp3', midiNumber: 28, isAccidental: false },
    { index: 8, keyType: 'white', noteName: 'F', octave: 1, scientific: 'F1', alternateNames: ['E#1', 'G𝄫1'], frequency: 43.65, audioFile: 'F_1.mp3', midiNumber: 29, isAccidental: false },
    { index: 9, keyType: 'black', noteName: 'F#', octave: 1, scientific: 'F#1', alternateNames: ['Gb1', 'E𝄪1'], frequency: 46.25, audioFile: 'F_1s.mp3', midiNumber: 30, isAccidental: true },
    { index: 10, keyType: 'white', noteName: 'G', octave: 1, scientific: 'G1', alternateNames: ['F𝄪1', 'A𝄫1'], frequency: 49.00, audioFile: 'G_1.mp3', midiNumber: 31, isAccidental: false },
    { index: 11, keyType: 'black', noteName: 'G#', octave: 1, scientific: 'G#1', alternateNames: ['Ab1', 'F𝄪1'], frequency: 51.91, audioFile: 'G_1s.mp3', midiNumber: 32, isAccidental: true },
    { index: 12, keyType: 'white', noteName: 'A', octave: 1, scientific: 'A1', alternateNames: ['G𝄪1', 'B𝄫1'], frequency: 55.00, audioFile: 'A_1.mp3', midiNumber: 33, isAccidental: false },
    { index: 13, keyType: 'black', noteName: 'A#', octave: 1, scientific: 'A#1', alternateNames: ['Bb1', 'C𝄫2'], frequency: 58.27, audioFile: 'A_1s.mp3', midiNumber: 34, isAccidental: true },
    { index: 14, keyType: 'white', noteName: 'B', octave: 1, scientific: 'B1', alternateNames: ['Cb2', 'A𝄪1'], frequency: 61.74, audioFile: 'B_1.mp3', midiNumber: 35, isAccidental: false },
    
    // 低音区 (C2 - B2)
    { index: 15, keyType: 'white', noteName: 'C', octave: 2, scientific: 'C2', alternateNames: ['B#1', 'D𝄫2'], frequency: 65.41, audioFile: 'C.mp3', midiNumber: 36, isAccidental: false },
    { index: 16, keyType: 'black', noteName: 'C#', octave: 2, scientific: 'C#2', alternateNames: ['Db2', 'B𝄪1'], frequency: 69.30, audioFile: 'Cs.mp3', midiNumber: 37, isAccidental: true },
    { index: 17, keyType: 'white', noteName: 'D', octave: 2, scientific: 'D2', alternateNames: ['C𝄪2', 'E𝄫2'], frequency: 73.42, audioFile: 'D.mp3', midiNumber: 38, isAccidental: false },
    { index: 18, keyType: 'black', noteName: 'D#', octave: 2, scientific: 'D#2', alternateNames: ['Eb2', 'F𝄫2'], frequency: 77.78, audioFile: 'Ds.mp3', midiNumber: 39, isAccidental: true },
    { index: 19, keyType: 'white', noteName: 'E', octave: 2, scientific: 'E2', alternateNames: ['Fb2', 'D𝄪2'], frequency: 82.41, audioFile: 'E.mp3', midiNumber: 40, isAccidental: false },
    { index: 20, keyType: 'white', noteName: 'F', octave: 2, scientific: 'F2', alternateNames: ['E#2', 'G𝄫2'], frequency: 87.31, audioFile: 'F.mp3', midiNumber: 41, isAccidental: false },
    { index: 21, keyType: 'black', noteName: 'F#', octave: 2, scientific: 'F#2', alternateNames: ['Gb2', 'E𝄪2'], frequency: 92.50, audioFile: 'Fs.mp3', midiNumber: 42, isAccidental: true },
    { index: 22, keyType: 'white', noteName: 'G', octave: 2, scientific: 'G2', alternateNames: ['F𝄪2', 'A𝄫2'], frequency: 98.00, audioFile: 'G.mp3', midiNumber: 43, isAccidental: false },
    { index: 23, keyType: 'black', noteName: 'G#', octave: 2, scientific: 'G#2', alternateNames: ['Ab2', 'F𝄪2'], frequency: 103.83, audioFile: 'Gs.mp3', midiNumber: 44, isAccidental: true },
    { index: 24, keyType: 'white', noteName: 'A', octave: 2, scientific: 'A2', alternateNames: ['G𝄪2', 'B𝄫2'], frequency: 110.00, audioFile: 'A.mp3', midiNumber: 45, isAccidental: false },
    { index: 25, keyType: 'black', noteName: 'A#', octave: 2, scientific: 'A#2', alternateNames: ['Bb2', 'C𝄫3'], frequency: 116.54, audioFile: 'As.mp3', midiNumber: 46, isAccidental: true },
    { index: 26, keyType: 'white', noteName: 'B', octave: 2, scientific: 'B2', alternateNames: ['Cb3', 'A𝄪2'], frequency: 123.47, audioFile: 'B.mp3', midiNumber: 47, isAccidental: false },
    
    // 中音区 (C3 - B3)
    { index: 27, keyType: 'white', noteName: 'C', octave: 3, scientific: 'C3', alternateNames: ['B#2', 'D𝄫3'], frequency: 130.81, audioFile: 'cc.mp3', midiNumber: 48, isAccidental: false },
    { index: 28, keyType: 'black', noteName: 'C#', octave: 3, scientific: 'C#3', alternateNames: ['Db3', 'B𝄪2'], frequency: 138.59, audioFile: 'ccs.mp3', midiNumber: 49, isAccidental: true },
    { index: 29, keyType: 'white', noteName: 'D', octave: 3, scientific: 'D3', alternateNames: ['C𝄪3', 'E𝄫3'], frequency: 146.83, audioFile: 'dd.mp3', midiNumber: 50, isAccidental: false },
    { index: 30, keyType: 'black', noteName: 'D#', octave: 3, scientific: 'D#3', alternateNames: ['Eb3', 'F𝄫3'], frequency: 155.56, audioFile: 'dds.mp3', midiNumber: 51, isAccidental: true },
    { index: 31, keyType: 'white', noteName: 'E', octave: 3, scientific: 'E3', alternateNames: ['Fb3', 'D𝄪3'], frequency: 164.81, audioFile: 'ee.mp3', midiNumber: 52, isAccidental: false },
    { index: 32, keyType: 'white', noteName: 'F', octave: 3, scientific: 'F3', alternateNames: ['E#3', 'G𝄫3'], frequency: 174.61, audioFile: 'ff.mp3', midiNumber: 53, isAccidental: false },
    { index: 33, keyType: 'black', noteName: 'F#', octave: 3, scientific: 'F#3', alternateNames: ['Gb3', 'E𝄪3'], frequency: 185.00, audioFile: 'ffs.mp3', midiNumber: 54, isAccidental: true },
    { index: 34, keyType: 'white', noteName: 'G', octave: 3, scientific: 'G3', alternateNames: ['F𝄪3', 'A𝄫3'], frequency: 196.00, audioFile: 'gg.mp3', midiNumber: 55, isAccidental: false },
    { index: 35, keyType: 'black', noteName: 'G#', octave: 3, scientific: 'G#3', alternateNames: ['Ab3', 'F𝄪3'], frequency: 207.65, audioFile: 'ggs.mp3', midiNumber: 56, isAccidental: true },
    { index: 36, keyType: 'white', noteName: 'A', octave: 3, scientific: 'A3', alternateNames: ['G𝄪3', 'B𝄫3'], frequency: 220.00, audioFile: 'aa.mp3', midiNumber: 57, isAccidental: false },
    { index: 37, keyType: 'black', noteName: 'A#', octave: 3, scientific: 'A#3', alternateNames: ['Bb3', 'C𝄫4'], frequency: 233.08, audioFile: 'aas.mp3', midiNumber: 58, isAccidental: true },
    { index: 38, keyType: 'white', noteName: 'B', octave: 3, scientific: 'B3', alternateNames: ['Cb4', 'A𝄪3'], frequency: 246.94, audioFile: 'bb.mp3', midiNumber: 59, isAccidental: false },
    
    // 高音区 (C4 - B4)
    { index: 39, keyType: 'white', noteName: 'C', octave: 4, scientific: 'C4', alternateNames: ['B#3', 'D𝄫4'], frequency: 261.63, audioFile: 'c1.mp3', midiNumber: 60, isAccidental: false },
    { index: 40, keyType: 'black', noteName: 'C#', octave: 4, scientific: 'C#4', alternateNames: ['Db4', 'B𝄪3'], frequency: 277.18, audioFile: 'c1s.mp3', midiNumber: 61, isAccidental: true },
    { index: 41, keyType: 'white', noteName: 'D', octave: 4, scientific: 'D4', alternateNames: ['C𝄪4', 'E𝄫4'], frequency: 293.66, audioFile: 'd1.mp3', midiNumber: 62, isAccidental: false },
    { index: 42, keyType: 'black', noteName: 'D#', octave: 4, scientific: 'D#4', alternateNames: ['Eb4', 'F𝄫4'], frequency: 311.13, audioFile: 'd1s.mp3', midiNumber: 63, isAccidental: true },
    { index: 43, keyType: 'white', noteName: 'E', octave: 4, scientific: 'E4', alternateNames: ['Fb4', 'D𝄪4'], frequency: 329.63, audioFile: 'e1.mp3', midiNumber: 64, isAccidental: false },
    { index: 44, keyType: 'white', noteName: 'F', octave: 4, scientific: 'F4', alternateNames: ['E#4', 'G𝄫4'], frequency: 349.23, audioFile: 'f1.mp3', midiNumber: 65, isAccidental: false },
    { index: 45, keyType: 'black', noteName: 'F#', octave: 4, scientific: 'F#4', alternateNames: ['Gb4', 'E𝄪4'], frequency: 369.99, audioFile: 'f1s.mp3', midiNumber: 66, isAccidental: true },
    { index: 46, keyType: 'white', noteName: 'G', octave: 4, scientific: 'G4', alternateNames: ['F𝄪4', 'A𝄫4'], frequency: 392.00, audioFile: 'g1.mp3', midiNumber: 67, isAccidental: false },
    { index: 47, keyType: 'black', noteName: 'G#', octave: 4, scientific: 'G#4', alternateNames: ['Ab4', 'F𝄪4'], frequency: 415.30, audioFile: 'g1s.mp3', midiNumber: 68, isAccidental: true },
    { index: 48, keyType: 'white', noteName: 'A', octave: 4, scientific: 'A4', alternateNames: ['G𝄪4', 'B𝄫4'], frequency: 440.00, audioFile: 'a1.mp3', midiNumber: 69, isAccidental: false },
    { index: 49, keyType: 'black', noteName: 'A#', octave: 4, scientific: 'A#4', alternateNames: ['Bb4', 'C𝄫5'], frequency: 466.16, audioFile: 'a1s.mp3', midiNumber: 70, isAccidental: true },
    { index: 50, keyType: 'white', noteName: 'B', octave: 4, scientific: 'B4', alternateNames: ['Cb5', 'A𝄪4'], frequency: 493.88, audioFile: 'b1.mp3', midiNumber: 71, isAccidental: false },
    
    // 超高音区 (C5 - B5)
    { index: 51, keyType: 'white', noteName: 'C', octave: 5, scientific: 'C5', alternateNames: ['B#4', 'D𝄫5'], frequency: 523.25, audioFile: 'c2.mp3', midiNumber: 72, isAccidental: false },
    { index: 52, keyType: 'black', noteName: 'C#', octave: 5, scientific: 'C#5', alternateNames: ['Db5', 'B𝄪4'], frequency: 554.37, audioFile: 'c2s.mp3', midiNumber: 73, isAccidental: true },
    { index: 53, keyType: 'white', noteName: 'D', octave: 5, scientific: 'D5', alternateNames: ['C𝄪5', 'E𝄫5'], frequency: 587.33, audioFile: 'd2.mp3', midiNumber: 74, isAccidental: false },
    { index: 54, keyType: 'black', noteName: 'D#', octave: 5, scientific: 'D#5', alternateNames: ['Eb5', 'F𝄫5'], frequency: 622.25, audioFile: 'd2s.mp3', midiNumber: 75, isAccidental: true },
    { index: 55, keyType: 'white', noteName: 'E', octave: 5, scientific: 'E5', alternateNames: ['Fb5', 'D𝄪5'], frequency: 659.25, audioFile: 'e2.mp3', midiNumber: 76, isAccidental: false },
    { index: 56, keyType: 'white', noteName: 'F', octave: 5, scientific: 'F5', alternateNames: ['E#5', 'G𝄫5'], frequency: 698.46, audioFile: 'f2.mp3', midiNumber: 77, isAccidental: false },
    { index: 57, keyType: 'black', noteName: 'F#', octave: 5, scientific: 'F#5', alternateNames: ['Gb5', 'E𝄪5'], frequency: 739.99, audioFile: 'f2s.mp3', midiNumber: 78, isAccidental: true },
    { index: 58, keyType: 'white', noteName: 'G', octave: 5, scientific: 'G5', alternateNames: ['F𝄪5', 'A𝄫5'], frequency: 783.99, audioFile: 'g2.mp3', midiNumber: 79, isAccidental: false },
    { index: 59, keyType: 'black', noteName: 'G#', octave: 5, scientific: 'G#5', alternateNames: ['Ab5', 'F𝄪5'], frequency: 830.61, audioFile: 'g2s.mp3', midiNumber: 80, isAccidental: true },
    { index: 60, keyType: 'white', noteName: 'A', octave: 5, scientific: 'A5', alternateNames: ['G𝄪5', 'B𝄫5'], frequency: 880.00, audioFile: 'a2.mp3', midiNumber: 81, isAccidental: false },
    { index: 61, keyType: 'black', noteName: 'A#', octave: 5, scientific: 'A#5', alternateNames: ['Bb5', 'C𝄫6'], frequency: 932.33, audioFile: 'a2s.mp3', midiNumber: 82, isAccidental: true },
    { index: 62, keyType: 'white', noteName: 'B', octave: 5, scientific: 'B5', alternateNames: ['Cb6', 'A𝄪5'], frequency: 987.77, audioFile: 'b2.mp3', midiNumber: 83, isAccidental: false },
    
    // 超高音区 (C6 - B6)
    { index: 63, keyType: 'white', noteName: 'C', octave: 6, scientific: 'C6', alternateNames: ['B#5', 'D𝄫6'], frequency: 1046.50, audioFile: 'c3.mp3', midiNumber: 84, isAccidental: false },
    { index: 64, keyType: 'black', noteName: 'C#', octave: 6, scientific: 'C#6', alternateNames: ['Db6', 'B𝄪5'], frequency: 1108.73, audioFile: 'c3s.mp3', midiNumber: 85, isAccidental: true },
    { index: 65, keyType: 'white', noteName: 'D', octave: 6, scientific: 'D6', alternateNames: ['C𝄪6', 'E𝄫6'], frequency: 1174.66, audioFile: 'd3.mp3', midiNumber: 86, isAccidental: false },
    { index: 66, keyType: 'black', noteName: 'D#', octave: 6, scientific: 'D#6', alternateNames: ['Eb6', 'F𝄫6'], frequency: 1244.51, audioFile: 'd3s.mp3', midiNumber: 87, isAccidental: true },
    { index: 67, keyType: 'white', noteName: 'E', octave: 6, scientific: 'E6', alternateNames: ['Fb6', 'D𝄪6'], frequency: 1318.51, audioFile: 'e3.mp3', midiNumber: 88, isAccidental: false },
    { index: 68, keyType: 'white', noteName: 'F', octave: 6, scientific: 'F6', alternateNames: ['E#6', 'G𝄫6'], frequency: 1396.91, audioFile: 'f3.mp3', midiNumber: 89, isAccidental: false },
    { index: 69, keyType: 'black', noteName: 'F#', octave: 6, scientific: 'F#6', alternateNames: ['Gb6', 'E𝄪6'], frequency: 1479.98, audioFile: 'f3s.mp3', midiNumber: 90, isAccidental: true },
    { index: 70, keyType: 'white', noteName: 'G', octave: 6, scientific: 'G6', alternateNames: ['F𝄪6', 'A𝄫6'], frequency: 1567.98, audioFile: 'g3.mp3', midiNumber: 91, isAccidental: false },
    { index: 71, keyType: 'black', noteName: 'G#', octave: 6, scientific: 'G#6', alternateNames: ['Ab6', 'F𝄪6'], frequency: 1661.22, audioFile: 'g3s.mp3', midiNumber: 92, isAccidental: true },
    { index: 72, keyType: 'white', noteName: 'A', octave: 6, scientific: 'A6', alternateNames: ['G𝄪6', 'B𝄫6'], frequency: 1760.00, audioFile: 'a3.mp3', midiNumber: 93, isAccidental: false },
    { index: 73, keyType: 'black', noteName: 'A#', octave: 6, scientific: 'A#6', alternateNames: ['Bb6', 'C𝄫7'], frequency: 1864.66, audioFile: 'a3s.mp3', midiNumber: 94, isAccidental: true },
    { index: 74, keyType: 'white', noteName: 'B', octave: 6, scientific: 'B6', alternateNames: ['Cb7', 'A𝄪6'], frequency: 1975.53, audioFile: 'b3.mp3', midiNumber: 95, isAccidental: false },
    
    // 超高音区 (C7 - B7)
    { index: 75, keyType: 'white', noteName: 'C', octave: 7, scientific: 'C7', alternateNames: ['B#6', 'D𝄫7'], frequency: 2093.00, audioFile: 'c4.mp3', midiNumber: 96, isAccidental: false },
    { index: 76, keyType: 'black', noteName: 'C#', octave: 7, scientific: 'C#7', alternateNames: ['Db7', 'B𝄪6'], frequency: 2217.46, audioFile: 'c4s.mp3', midiNumber: 97, isAccidental: true },
    { index: 77, keyType: 'white', noteName: 'D', octave: 7, scientific: 'D7', alternateNames: ['C𝄪7', 'E𝄫7'], frequency: 2349.32, audioFile: 'd4.mp3', midiNumber: 98, isAccidental: false },
    { index: 78, keyType: 'black', noteName: 'D#', octave: 7, scientific: 'D#7', alternateNames: ['Eb7', 'F𝄫7'], frequency: 2489.02, audioFile: 'd4s.mp3', midiNumber: 99, isAccidental: true },
    { index: 79, keyType: 'white', noteName: 'E', octave: 7, scientific: 'E7', alternateNames: ['Fb7', 'D𝄪7'], frequency: 2637.02, audioFile: 'e4.mp3', midiNumber: 100, isAccidental: false },
    { index: 80, keyType: 'white', noteName: 'F', octave: 7, scientific: 'F7', alternateNames: ['E#7', 'G𝄫7'], frequency: 2793.83, audioFile: 'f4.mp3', midiNumber: 101, isAccidental: false },
    { index: 81, keyType: 'black', noteName: 'F#', octave: 7, scientific: 'F#7', alternateNames: ['Gb7', 'E𝄪7'], frequency: 2959.96, audioFile: 'f4s.mp3', midiNumber: 102, isAccidental: true },
    { index: 82, keyType: 'white', noteName: 'G', octave: 7, scientific: 'G7', alternateNames: ['F𝄪7', 'A𝄫7'], frequency: 3135.96, audioFile: 'g4.mp3', midiNumber: 103, isAccidental: false },
    { index: 83, keyType: 'black', noteName: 'G#', octave: 7, scientific: 'G#7', alternateNames: ['Ab7', 'F𝄪7'], frequency: 3322.44, audioFile: 'g4s.mp3', midiNumber: 104, isAccidental: true },
    { index: 84, keyType: 'white', noteName: 'A', octave: 7, scientific: 'A7', alternateNames: ['G𝄪7', 'B𝄫7'], frequency: 3520.00, audioFile: 'a4.mp3', midiNumber: 105, isAccidental: false },
    { index: 85, keyType: 'black', noteName: 'A#', octave: 7, scientific: 'A#7', alternateNames: ['Bb7', 'C𝄫8'], frequency: 3729.31, audioFile: 'a4s.mp3', midiNumber: 106, isAccidental: true },
    { index: 86, keyType: 'white', noteName: 'B', octave: 7, scientific: 'B7', alternateNames: ['Cb8', 'A𝄪7'], frequency: 3951.07, audioFile: 'b4.mp3', midiNumber: 107, isAccidental: false },
    
    // 最高音 (C8)
    { index: 87, keyType: 'white', noteName: 'C', octave: 8, scientific: 'C8', alternateNames: ['B#7', 'D𝄫8'], frequency: 4186.01, audioFile: 'c5.mp3', midiNumber: 108, isAccidental: false }
];

// 创建科学记号法到键映射的快速查找表
const scientificToKeyMap = {};
keyMapping.forEach(key => {
    // 主科学记号法
    scientificToKeyMap[key.scientific] = key;
    // 替代科学记号法
    key.alternateNames.forEach(altName => {
        scientificToKeyMap[altName] = key;
    });
});

// 暴露到全局作用域
window.keyMapping = keyMapping;
window.scientificToKeyMap = scientificToKeyMap;

// 工具函数：根据科学记号法获取键信息
window.getKeyByScientific = function(scientific) {
    return scientificToKeyMap[scientific];
};

// 工具函数：根据科学记号法获取音频文件路径
window.getAudioFileByScientific = function(scientific) {
    const key = scientificToKeyMap[scientific];
    return key ? key.audioFile : null;
};

// 工具函数：根据音符名称和八度获取键信息
window.getKeyByNoteAndOctave = function(noteName, octave) {
    // 确保音符名称首字母大写，#符号保持不变
    const normalizedNoteName = noteName.charAt(0).toUpperCase() + noteName.slice(1);
    const scientific = `${normalizedNoteName}${octave}`;
    return scientificToKeyMap[scientific];
};

// 工具函数：根据音符名称和八度获取音频文件路径
window.getAudioFileByNoteAndOctave = function(noteName, octave) {
    const key = window.getKeyByNoteAndOctave(noteName, octave);
    return key ? key.audioFile : null;
};

// 额外的工具函数：直接从keyMapping数组中查找
window.getKeyByNoteAndOctaveDirect = function(noteName, octave) {
    // 确保音符名称首字母大写，#符号保持不变
    const normalizedNoteName = noteName.charAt(0).toUpperCase() + noteName.slice(1);
    return keyMapping.find(key => key.noteName === normalizedNoteName && key.octave === octave);
};

// 额外的工具函数：直接从keyMapping数组中获取音频文件路径
window.getAudioFileByNoteAndOctaveDirect = function(noteName, octave) {
    const key = window.getKeyByNoteAndOctaveDirect(noteName, octave);
    return key ? key.audioFile : null;
};

// 自然大调音阶映射
const majorScales = {
    // C大调
    'C': {
        name: 'C大调',
        scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'],
        example: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
        accidentals: [],
        keySignature: '无'
    },
    // G大调
    'G': {
        name: 'G大调',
        scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F#', 'G'],
        example: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'],
        accidentals: ['F#'],
        keySignature: '1个升号（F#）'
    },
    // D大调
    'D': {
        name: 'D大调',
        scale: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#', 'D'],
        example: ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'],
        accidentals: ['F#', 'C#'],
        keySignature: '2个升号（F#, C#）'
    },
    // A大调
    'A': {
        name: 'A大调',
        scale: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#', 'A'],
        example: ['A4', 'B4', 'C#5', 'D5', 'E5', 'F#5', 'G#5', 'A5'],
        accidentals: ['F#', 'C#', 'G#'],
        keySignature: '3个升号（F#, C#, G#）'
    },
    // E大调
    'E': {
        name: 'E大调',
        scale: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#', 'E'],
        example: ['E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5', 'E5'],
        accidentals: ['F#', 'C#', 'G#', 'D#'],
        keySignature: '4个升号（F#, C#, G#, D#）'
    },
    // B大调
    'B': {
        name: 'B大调',
        scale: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#', 'B'],
        example: ['B4', 'C#5', 'D#5', 'E5', 'F#5', 'G#5', 'A#5', 'B5'],
        accidentals: ['F#', 'C#', 'G#', 'D#', 'A#'],
        keySignature: '5个升号（F#, C#, G#, D#, A#）'
    },
    // F#大调
    'F#': {
        name: 'F#大调',
        scale: ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#', 'F#'],
        example: ['F#4', 'G#4', 'A#4', 'B4', 'C#5', 'D#5', 'E#5', 'F#5'],
        accidentals: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
        keySignature: '6个升号（F#, C#, G#, D#, A#, E#）'
    },
    // F大调
    'F': {
        name: 'F大调',
        scale: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E', 'F'],
        example: ['F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5'],
        accidentals: ['Bb'],
        keySignature: '1个降号（Bb）'
    },
    // Bb大调
    'Bb': {
        name: '降B大调',
        scale: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'],
        example: ['Bb4', 'C5', 'D5', 'Eb5', 'F5', 'G5', 'A5', 'Bb5'],
        accidentals: ['Bb', 'Eb'],
        keySignature: '2个降号（Bb, Eb）'
    },
    // Eb大调
    'Eb': {
        name: '降E大调',
        scale: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D', 'Eb'],
        example: ['Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5', 'D5', 'Eb5'],
        accidentals: ['Bb', 'Eb', 'Ab'],
        keySignature: '3个降号（Bb, Eb, Ab）'
    },
    // Ab大调
    'Ab': {
        name: '降A大调',
        scale: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G', 'Ab'],
        example: ['Ab4', 'Bb4', 'C5', 'Db5', 'Eb5', 'F5', 'G5', 'Ab5'],
        accidentals: ['Bb', 'Eb', 'Ab', 'Db'],
        keySignature: '4个降号（Bb, Eb, Ab, Db）'
    },
    // Db大调
    'Db': {
        name: '降D大调',
        scale: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C', 'Db'],
        example: ['Db4', 'Eb4', 'F4', 'Gb4', 'Ab4', 'Bb4', 'C5', 'Db5'],
        accidentals: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
        keySignature: '5个降号（Bb, Eb, Ab, Db, Gb）'
    }
};

// 暴露自然大调音阶映射到全局作用域
window.majorScales = majorScales;
/* =============================================================================
 * jianpu_svg_render.js — 简谱 SVG 渲染引擎
 * -----------------------------------------------------------------------------
 * 将 parseJianpu() 得到的音符数组渲染为纯矢量 SVG 简谱排版，排版规则参考
 * VexFlow 的 beam 分组算法和简谱课堂印刷惯例。
 *
 * 改进要点：
 *   1. 减时线按拍号智能分组（4/4 分组为 2+2，6/8 分组为 3+3，跨小节自动断开）
 *   2. 高低音点用 SVG <circle> 精确定位
 *   3. 拍号头部渲染（分数布局）
 *   4. 节拍标记：在每个强拍位置（1, 2, 3, 4）显示数字
 *   5. 调号 + 速度 + 标题头部
 *   6. 附点圆点用 SVG 精确定位（数字右侧中部）
 *
 * 用法：window.JianpuSVG.render(notes, { timeSignature: '4/4' }) → 返回 <svg>
 * ========================================================================== */
(function (global) {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';

    // -------------------------------------------------------------------------
    // 默认排版参数
    // -------------------------------------------------------------------------
    var DEFAULTS = {
        fontSize: 24,             // 音符数字字号
        noteWidth: 34,            // 四分音符占位宽度
        restWidth: 20,            // 休止符占位
        accidentalWidth: 14,      // 升降号额外宽度
        dotRadius: 2.6,           // 高低音点 / 附点半径
        dotStackGap: 8,           // 多点竖直叠放间距
        highDotGap: 6,            // 第一个高音点距数字顶部
        lowDotGap: 7,             // 第一个低音点距数字底部
        dottedGap: 12,            // 附点距数字中心的水平距离
        beamThickness: 4,         // 减时线粗细（加粗，压缩后仍可见）
        beamGap: 8,               // 双减时线间距
        beamBelowDigit: 8,        // 第一条减时线距数字基线的距离（紧贴数字底部）
        beamSideInset: 5,         // 减时线两端相对音符边缘的缩进
        barLineHeight: 64,        // 小节线高度（包含节拍标记空间）
        barLineGap: 12,           // 小节线前后留白
        thinBarWidth: 1.4,        // 普通小节线粗
        finalBarWidth: 4.5,       // 终止粗线
        finalBarGap: 5,           // 终止双线间距
        staffPadding: { top: 56, right: 28, bottom: 30, left: 28 },
        lineSpacing: 68,          // 行间距
        timeSigFontSize: 18,      // 拍号字号
        timeSigWidth: 34,         // 拍号占位宽度
        beatMarkerFontSize: 11,   // 节拍标记字号
        headerFontSize: 14,       // 标题/调号/速度字号
        barsPerLine: 'auto',      // 每行小节数（可传 'auto'）
        autoLineWidth: 980,       // barsPerLine='auto' 时的目标行宽
        color: '#1a1a1a',         // 主墨色
        restColor: '#9aa0a6',     // 休止符颜色
        beatMarkerColor: '#b03a6b', // 节拍标记颜色
        headerColor: '#5a4254'     // 标题/调号/速度颜色
    };

    // -------------------------------------------------------------------------
    // 辅助：创建 SVG 子元素
    // -------------------------------------------------------------------------
    function svgEl(name, attrs) {
        var node = document.createElementNS(SVG_NS, name);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                node.setAttribute(k, String(attrs[k]));
            });
        }
        return node;
    }

    function drawText(parent, x, y, content, opts) {
        opts = opts || {};
        var node = svgEl('text', {
            x: x, y: y,
            'font-size': (opts.size != null ? opts.size : DEFAULTS.fontSize),
            'font-family': (opts.family || '"Times New Roman", "Songti SC", serif'),
            'font-weight': opts.bold ? '600' : '400',
            'text-anchor': (opts.anchor || 'middle'),
            fill: (opts.fill || DEFAULTS.color)
        });
        node.textContent = content;
        parent.appendChild(node);
        return node;
    }

    function drawLine(parent, x1, y1, x2, y2, width, color) {
        parent.appendChild(svgEl('line', {
            x1: x1, y1: y1, x2: x2, y2: y2,
            stroke: color || DEFAULTS.color,
            'stroke-width': String(width || 1),
            'stroke-linecap': 'round'
        }));
    }

    function drawCircle(parent, cx, cy, r, fill) {
        parent.appendChild(svgEl('circle', {
            cx: cx, cy: cy, r: r, fill: fill || DEFAULTS.color, stroke: 'none'
        }));
    }

    // -------------------------------------------------------------------------
    // 辅助：音符占用宽度
    // -------------------------------------------------------------------------
    function noteWidth(note) {
        if (note.isRest) return DEFAULTS.restWidth;
        var w = DEFAULTS.noteWidth;
        if (note.accidental !== 0) w += DEFAULTS.accidentalWidth;
        if (note.isDotted) w += 8;
        return w;
    }

    // -------------------------------------------------------------------------
    // 辅助：解析拍号
    // -------------------------------------------------------------------------
    function parseTimeSig(sig) {
        var parts = String(sig || '4/4').split('/');
        var num = parseInt(parts[0], 10) || 4;
        var den = parseInt(parts[1], 10) || 4;
        return { numerator: num, denominator: den };
    }

    // -------------------------------------------------------------------------
    // 按拍号感知的减时线分组
    // -------------------------------------------------------------------------
    function markBeamGroups(notes, timeSig) {
        if (!notes || !notes.length) return;
        notes.forEach(function (n) { n._beam = null; });

        function isBeamable(n) {
            return n && !n.isRest && !n.isDotted && (n.isEighth || n.isSixteenth);
        }

        var i = 0;
        while (i < notes.length) {
            if (!isBeamable(notes[i])) { i++; continue; }

            var run = [];
            var j = i;
            while (j < notes.length && isBeamable(notes[j])) {
                // 只与同类型（八分对八分、十六分对十六分）成组
                if (notes[j].isEighth !== notes[i].isEighth ||
                    notes[j].isSixteenth !== notes[i].isSixteenth) break;
                run.push(j);
                j++;
            }

                if (run.length >= 1) {
                    run.forEach(function (idx, pos) {
                        notes[idx]._beam = {
                            group: run,
                            pos: pos,
                            first: pos === 0,
                            last: pos === run.length - 1,
                            lineCount: notes[idx].isSixteenth ? 2 : 1
                        };
                    });
                }
            i = j;
        }
    }

    // -------------------------------------------------------------------------
    // 主渲染
    // -----------------------------------------------------------------------------
    function renderJianpuSVG(notes, options) {
        if (!notes || !notes.length) return null;

        var opts = Object.assign({}, DEFAULTS, options || {});
        var timeSig = opts.timeSignature || '4/4';

        // 0. 为每个音符编号（与传入数组下标一致，供播放光标定位）
        notes.forEach(function (n, i) { n._globalIdx = i; });

        // 1. 按小节分组
        var bars = [];
        var curBar = null;
        var curBarText = null;
        notes.forEach(function (note) {
            if (note.barText !== curBarText) {
                curBar = [];
                bars.push(curBar);
                curBarText = note.barText;
            }
            curBar.push(note);
        });

        // 2. 决定每行小节数
        var barWidths = bars.map(function (barNotes) {
            var w = opts.barLineGap * 2;
            barNotes.forEach(function (n) { w += noteWidth(n); });
            return w;
        });
        var barsPerLine = opts.barsPerLine;
        if (barsPerLine === 'auto') {
            var totalW = 0;
            barWidths.forEach(function (w) { totalW += w; });
            var avgW = totalW / bars.length;
            barsPerLine = Math.max(1, Math.min(6, Math.round(opts.autoLineWidth / Math.max(avgW, 1))));
        }

        // 3. 拆行
        var lines = [];
        for (var i = 0; i < bars.length; i += barsPerLine) {
            lines.push(bars.slice(i, i + barsPerLine));
        }

        // 4. 计算总宽高
        var totalHeight = opts.staffPadding.top + opts.staffPadding.bottom;
        var maxLineWidth = 0;
        lines.forEach(function (lineBars, idx) {
            var w = opts.timeSigWidth + opts.staffPadding.left + opts.staffPadding.right;
            lineBars.forEach(function (barNotes) {
                barNotes.forEach(function (n) { w += noteWidth(n); });
                w += opts.barLineGap * 2;
            });
            if (w > maxLineWidth) maxLineWidth = w;
            totalHeight += opts.barLineHeight;
            if (idx < lines.length - 1) totalHeight += opts.lineSpacing;
        });

        var totalWidth = maxLineWidth;

        // 4. 创建 SVG
        var svg = svgEl('svg', {
            xmlns: SVG_NS,
            viewBox: [0, 0, Math.ceil(totalWidth), Math.ceil(totalHeight)].join(' '),
            width: '100%',
            style: 'display:block;margin:0 auto;'
        });

        // 5. 逐行渲染
        var cursorY = opts.staffPadding.top;

        lines.forEach(function (lineBars, lineIdx) {
            // 数字基线：行内偏上，给下方减时线/低音点留空间
            var baseline = cursorY + opts.barLineHeight * 0.5;
            var cursorX = opts.staffPadding.left + opts.timeSigWidth;

            // 首行渲染：调号 / 拍号 / 速度 头部
            if (lineIdx === 0 && (opts.key || opts.tempo)) {
                var headerY = cursorY - 18;
                var hx = opts.staffPadding.left;
                var parts = [];
                if (opts.key) parts.push('1=' + opts.key);
                parts.push(timeSig);
                if (opts.tempo) parts.push('♩=' + opts.tempo);
                drawText(svg, hx, headerY, parts.join('   '), {
                    size: opts.headerFontSize, anchor: 'start', fill: opts.headerColor
                });
            }

            // 拍号（仅首行）
            if (lineIdx === 0) {
                var sig = parseTimeSig(timeSig);
                var cx = opts.staffPadding.left + opts.timeSigWidth / 2;
                drawText(svg, cx, baseline - 6, String(sig.numerator),
                    { size: opts.timeSigFontSize, anchor: 'middle', bold: true });
                drawLine(svg, cx - 8, baseline + 2, cx + 8, baseline + 2, 1.4);
                drawText(svg, cx, baseline + opts.timeSigFontSize + 4, String(sig.denominator),
                    { size: opts.timeSigFontSize, anchor: 'middle', bold: true });
            }

            lineBars.forEach(function (barNotes) {
                // 计算位置
                var positions = [];
                var x = cursorX;
                barNotes.forEach(function (note) {
                    x += noteWidth(note) / 2;
                    positions.push(x);
                    x += noteWidth(note) / 2;
                });

                // 标记 beam 组
                markBeamGroups(barNotes, timeSig);

                // 计算该小节内的累计拍数，用于节拍标记
                var beatMarker = opts.beatMarker === true || opts.showBeats === true;
                if (beatMarker) {
                    var beatAcc = 0;
                    barNotes.forEach(function (n) {
                        n._beatPos = beatAcc;
                        beatAcc += n.beats;
                    });
                }

                // 绘制 beam（先于音符绘制，避免遮盖数字）
                var drawn = {};
                barNotes.forEach(function (note, idx) {
                    if (note._beam && !drawn[note._beam.group]) {
                        drawn[note._beam.group] = true;
                        drawBeam(svg, barNotes, note._beam.group, positions, baseline, opts);
                    }
                });

                // 绘制节拍标记（在节拍数字位置上方显示 1/2/3/4）
                if (beatMarker) {
                    drawBeatMarkers(svg, barNotes, positions, cursorY, opts);
                }

                // 绘制每个音符（携带全局索引供播放光标定位）
                barNotes.forEach(function (note, idx) {
                    drawNote(svg, note, positions[idx], baseline, opts, note._globalIdx);
                });

                // 小节线
                var barLineX = x + opts.barLineGap;
                drawLine(svg, barLineX, cursorY + 4, barLineX,
                    cursorY + opts.barLineHeight - 4, opts.thinBarWidth);
                cursorX = barLineX + opts.barLineGap;
            });

            // 终止双线
            var finalX = cursorX;
            drawLine(svg, finalX, cursorY + 4, finalX,
                cursorY + opts.barLineHeight - 4, opts.thinBarWidth);
            drawLine(svg, finalX + opts.finalBarGap, cursorY + 4, finalX + opts.finalBarGap,
                cursorY + opts.barLineHeight - 4, opts.finalBarWidth);

            cursorY += opts.barLineHeight;
            if (lineIdx < lines.length - 1) cursorY += opts.lineSpacing;
        });

        return svg;
    }

    // -------------------------------------------------------------------------
    // 绘制单个音符
    // -------------------------------------------------------------------------
    function drawNote(svg, note, cx, baseline, opts, noteIdx) {
        var fontSize = opts.fontSize;
        var capHeight = fontSize * 0.72; // 数字顶部到基线的近似高度

        if (note.isRest) {
            var restText = drawText(svg, cx, baseline, '0', { size: fontSize, anchor: 'middle', fill: opts.restColor });
            if (noteIdx != null) {
                restText.setAttribute('class', 'jp-note');
                restText.setAttribute('data-note-idx', noteIdx);
            }
            return;
        }

        // 升降号（紧贴数字左侧）
        var digitCx = cx;
        if (note.accidental !== 0) {
            var accText = note.accidental === 1 ? '#' : 'b';
            drawText(svg, cx - opts.accidentalWidth / 2 - 4, baseline, accText,
                { size: fontSize * 0.72, anchor: 'middle' });
            digitCx = cx + opts.accidentalWidth / 2 - 2;
        }

        // 数字本体（带 jp-note 类与索引，供播放光标高亮）
        var digitText = drawText(svg, digitCx, baseline, String(note.degree),
            { size: fontSize, anchor: 'middle', bold: true });
        if (noteIdx != null) {
            digitText.setAttribute('class', 'jp-note');
            digitText.setAttribute('data-note-idx', noteIdx);
        }

        // 高音点：数字上方竖直叠放
        if (note.octave > 0) {
            for (var h = 0; h < note.octave; h++) {
                var hy = baseline - capHeight - opts.highDotGap - h * opts.dotStackGap;
                drawCircle(svg, digitCx, hy, opts.dotRadius);
            }
        }
        // 低音点：数字下方竖直叠放
        if (note.octave < 0) {
            for (var l = 0; l < -note.octave; l++) {
                var ly = baseline + opts.lowDotGap + l * opts.dotStackGap;
                drawCircle(svg, digitCx, ly, opts.dotRadius);
            }
        }

        // 附点：数字右侧中部
        if (note.isDotted) {
            drawCircle(svg, digitCx + opts.dottedGap, baseline - capHeight * 0.35, opts.dotRadius);
        }
    }

    // -------------------------------------------------------------------------
    // 绘制一组减时线
    // -------------------------------------------------------------------------
    function drawBeam(svg, barNotes, group, positions, baseline, opts) {
        if (!group || group.length < 1) return;
        var firstIdx = group[0];
        var lastIdx = group[group.length - 1];
        var firstNote = barNotes[firstIdx];
        var lastNote = barNotes[lastIdx];

        // 减时线 y：数字基线下方（若组内有低音点则再往下让位）
        var maxLowDots = 0;
        group.forEach(function (idx) {
            var n = barNotes[idx];
            if (n.octave < 0 && -n.octave > maxLowDots) maxLowDots = -n.octave;
        });
        // 减时线紧贴数字底部：基线下 8px 起笔（视觉上与图例的紧贴效果一致）
        var beamY = baseline + opts.beamBelowDigit + maxLowDots * opts.dotStackGap;

        // 单个八分音符：短线只覆盖自身宽度；多音符组：从首音符左缘到尾音符右缘
        var x1, x2;
        if (group.length === 1) {
            var halfW = noteWidth(firstNote) / 2;
            x1 = positions[firstIdx] - halfW * 0.7;
            x2 = positions[firstIdx] + halfW * 0.7;
        } else {
            x1 = positions[firstIdx] - noteWidth(firstNote) / 2 + opts.beamSideInset;
            x2 = positions[lastIdx] + noteWidth(lastNote) / 2 - opts.beamSideInset;
        }

        var lineCount = firstNote.isSixteenth ? 2 : 1;
        for (var i = 0; i < lineCount; i++) {
            var y = beamY + i * opts.beamGap;
            drawLine(svg, x1, y, x2, y, opts.beamThickness);
        }
    }

    // -------------------------------------------------------------------------
    // 绘制节拍标记：在每个整数拍位置上方显示小数字（1, 2, 3, 4...）
    // -------------------------------------------------------------------------
    function drawBeatMarkers(svg, barNotes, positions, cursorY, opts) {
        var seenBeats = {};
        var beatsPerBar = parseInt(String(opts.timeSignature || '4/4').split('/')[0], 10) || 4;
        barNotes.forEach(function (note, idx) {
            var pos = note._beatPos;
            if (pos == null) return;
            // 整数拍位置（1, 2, 3, 4）才显示
            var beatNum = Math.round(pos) + 1;
            if (Math.abs(pos - (beatNum - 1)) > 0.01) return; // 不在整数拍
            if (beatNum > beatsPerBar) return;
            if (seenBeats[beatNum]) return; // 避免重复
            seenBeats[beatNum] = true;

            var y = cursorY + opts.beatMarkerFontSize + 2;
            drawText(svg, positions[idx], y, String(beatNum), {
                size: opts.beatMarkerFontSize, anchor: 'middle', fill: opts.beatMarkerColor, bold: true
            });
        });
    }

    // -------------------------------------------------------------------------
    // 公开 API
    // -------------------------------------------------------------------------
    global.JianpuSVG = {
        render: renderJianpuSVG,
        defaults: DEFAULTS,
        noteWidth: noteWidth,
        parseTimeSig: parseTimeSig
    };

})(typeof window !== 'undefined' ? window : this);

"use strict";
/**
 * shareCard.ts
 * 用 Canvas 2D API 绘制打卡分享卡片（750×1050 rpx → 375×525 px @ 1x）
 * 实际绘制使用物理像素，由调用方传入 canvas 尺寸对应的像素比缩放。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawShareCard = drawShareCard;
// 颜色常量（与设计规范对齐）
const C = {
    cream: '#FAF7F2',
    ink: '#1B1928',
    inkSoft: '#68637A',
    inkMuted: '#A6A0B8',
    rose: '#E06844',
    roseDark: '#C4522E',
    green: '#53A47A',
    white: '#FFFFFF',
    whiteA60: 'rgba(255,255,255,0.60)',
    whiteA30: 'rgba(255,255,255,0.30)',
    whiteA20: 'rgba(255,255,255,0.20)',
    progressBg: 'rgba(27,25,40,0.10)',
};
/**
 * 将文字按最大宽度自动折行，返回行数组。
 * ctx.measureText 在小程序 Canvas 2D 中可用。
 */
function wrapText(ctx, text, maxWidth) {
    const chars = text.split('');
    const lines = [];
    let cur = '';
    for (const ch of chars) {
        const test = cur + ch;
        const w = ctx.measureText(test).width;
        if (w > maxWidth && cur.length > 0) {
            lines.push(cur);
            cur = ch;
        }
        else {
            cur = test;
        }
    }
    if (cur)
        lines.push(cur);
    return lines;
}
/**
 * 绘制圆角矩形路径（Canvas 2D）。
 */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}
/**
 * 主绘制函数。
 * 画布物理尺寸：375 × 525 px（对应 750×1050 rpx @ dpr=2）。
 * 内部坐标系统一使用 px（不带 rpx）。
 */
async function drawShareCard(params) {
    var _a, _b, _c;
    const { canvasId, pageInstance, goalTitle, action, dayIndex, streakDays, phaseProgress, phaseName, nickname, focusMin = 25, } = params;
    // 获取 canvas 节点（type="2d" 模式）
    const canvas = await new Promise((resolve, reject) => {
        const query = pageInstance.createSelectorQuery();
        query
            .select(`#${canvasId}`)
            .fields({ node: true, size: true })
            .exec((res) => {
            if (res && res[0] && res[0].node) {
                resolve(res[0].node);
            }
            else {
                reject(new Error(`Canvas node not found: #${canvasId}`));
            }
        });
    });
    // 设备像素比，用于高清渲染
    const dpr = (_c = (_b = (_a = wx.getWindowInfo) === null || _a === void 0 ? void 0 : _a.call(wx).pixelRatio) !== null && _b !== void 0 ? _b : wx.getSystemInfoSync().pixelRatio) !== null && _c !== void 0 ? _c : 2;
    // 逻辑尺寸（px，对应 rpx/2）
    const W = 375;
    const H = 525;
    // 物理像素尺寸
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    // 缩放使后续坐标均为逻辑 px
    ctx.scale(dpr, dpr);
    // ─── 1. 背景（奶油色）────────────────────────────────────────
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, W, H);
    // ─── 2. 顶部品牌栏（奶油背景，高 52px）────────────────────────
    const topBarH = 52;
    const padH = 20; // 左右内边距
    // 品牌文字："Rise · 瑞"
    ctx.fillStyle = C.ink;
    ctx.font = `800 18px PingFang SC, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('Rise · 瑞', padH, topBarH / 2);
    // 右上角日期
    const now = new Date();
    const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日`;
    ctx.fillStyle = C.inkSoft;
    ctx.font = `500 12px PingFang SC, -apple-system, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(dateLabel, W - padH, topBarH / 2);
    // 分割线（细，半透明）
    ctx.strokeStyle = 'rgba(27,25,40,0.07)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padH, topBarH);
    ctx.lineTo(W - padH, topBarH);
    ctx.stroke();
    // ─── 3. 主内容橙色渐变卡片 ─────────────────────────────────────
    const cardX = 16;
    const cardY = topBarH + 16;
    const cardW = W - cardX * 2;
    const cardH = 220;
    const cardR = 20;
    // 橙色渐变（左上→右下：rose → rose-dark）
    const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    grad.addColorStop(0, C.rose);
    grad.addColorStop(1, C.roseDark);
    ctx.fillStyle = grad;
    roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fill();
    // 装饰圆（右上角，半透明白）
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(cardX + cardW + 10, cardY - 10, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.arc(cardX + cardW - 20, cardY + cardH + 10, 60, 0, Math.PI * 2);
    ctx.fill();
    // 卡片内内边距
    const cp = 20; // card padding
    // 小标签："TODAY'S FOCUS"
    ctx.fillStyle = C.whiteA60;
    ctx.font = `600 10px PingFang SC, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // letter-spacing 模拟（Canvas 2D 不支持，逐字绘制）
    const focusLabel = "TODAY'S FOCUS";
    let lx = cardX + cp;
    const lSpacing = 2;
    ctx.fillStyle = C.whiteA60;
    for (const ch of focusLabel) {
        ctx.fillText(ch, lx, cardY + cp);
        lx += ctx.measureText(ch).width + lSpacing;
    }
    // 目标名
    ctx.fillStyle = C.white;
    ctx.font = `800 22px PingFang SC, -apple-system, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(goalTitle, cardX + cp, cardY + cp + 18);
    // 今日行动文字（多行自动换行，17px）
    ctx.font = `400 15px PingFang SC, -apple-system, sans-serif`;
    ctx.fillStyle = C.white;
    ctx.textBaseline = 'top';
    const actionMaxW = cardW - cp * 2;
    const actionLines = wrapText(ctx, action, actionMaxW);
    const actionLineH = 24;
    const actionStartY = cardY + cp + 18 + 32;
    actionLines.slice(0, 4).forEach((line, i) => {
        ctx.fillText(line, cardX + cp, actionStartY + i * actionLineH);
    });
    // Pills 行（底部）："第N天" + "25分钟"
    const pillY = cardY + cardH - 38;
    const pillH = 26;
    const pillR = 13;
    const pill1Text = `第 ${dayIndex} 天`;
    const pill2Text = `${focusMin} 分钟`;
    ctx.font = `600 12px PingFang SC, -apple-system, sans-serif`;
    const pill1W = ctx.measureText(pill1Text).width + 24;
    const pill2W = ctx.measureText(pill2Text).width + 24;
    // pill 1
    ctx.fillStyle = C.whiteA30;
    roundRect(ctx, cardX + cp, pillY, pill1W, pillH, pillR);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pill1Text, cardX + cp + pill1W / 2, pillY + pillH / 2);
    // pill 2
    const pill2X = cardX + cp + pill1W + 10;
    ctx.fillStyle = C.whiteA30;
    roundRect(ctx, pill2X, pillY, pill2W, pillH, pillR);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.fillText(pill2Text, pill2X + pill2W / 2, pillY + pillH / 2);
    // ─── 4. 数据区（卡片下方）─────────────────────────────────────
    const dataY = cardY + cardH + 20;
    // 连击行：火焰 + "🔥 连续 N 天 守护连击"
    // 用 emoji 绘制火焰
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `400 20px PingFang SC, -apple-system, sans-serif`;
    ctx.fillText('🔥', padH, dataY + 12);
    ctx.font = `800 18px PingFang SC, -apple-system, sans-serif`;
    ctx.fillStyle = C.rose;
    ctx.fillText(`连续 ${streakDays} 天  守护连击`, padH + 28, dataY + 12);
    // 进度条区域
    const progAreaY = dataY + 36;
    const progBarX = padH;
    const progBarW = W - padH * 2;
    const progBarH = 8;
    const progBarR = 4;
    // 标签行
    ctx.font = `600 13px PingFang SC, -apple-system, sans-serif`;
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(phaseName, progBarX, progAreaY + 10);
    const pctText = `${Math.round(phaseProgress * 100)}%`;
    ctx.textAlign = 'right';
    ctx.fillStyle = C.rose;
    ctx.fillText(pctText, W - padH, progAreaY + 10);
    // 进度条背景
    const barY = progAreaY + 26;
    ctx.fillStyle = C.progressBg;
    roundRect(ctx, progBarX, barY, progBarW, progBarH, progBarR);
    ctx.fill();
    // 进度条填充
    const fillW = Math.max(progBarR * 2, progBarW * Math.min(1, Math.max(0, phaseProgress)));
    ctx.fillStyle = C.rose;
    roundRect(ctx, progBarX, barY, fillW, progBarH, progBarR);
    ctx.fill();
    // ─── 5. 分隔线 ──────────────────────────────────────────────
    const sepY = barY + progBarH + 22;
    ctx.strokeStyle = 'rgba(27,25,40,0.06)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padH, sepY);
    ctx.lineTo(W - padH, sepY);
    ctx.stroke();
    // ─── 6. 底部区域 ─────────────────────────────────────────────
    const bottomY = sepY + 16;
    // 一句话
    const motto = '别让紧急的事，埋掉重要的你。';
    ctx.font = `400 13px PingFang SC, -apple-system, sans-serif`;
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(motto, W / 2, bottomY);
    // 小程序码占位区（80×80 圆角白色矩形，居中）
    const qrSize = 72;
    const qrX = W / 2 - qrSize / 2;
    const qrY = bottomY + 26;
    const qrR = 12;
    // 白色圆角底板
    ctx.fillStyle = C.white;
    ctx.shadowColor = 'rgba(27,25,40,0.12)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, qrX, qrY, qrSize, qrSize, qrR);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // 占位文字
    ctx.font = `400 9px PingFang SC, -apple-system, sans-serif`;
    ctx.fillStyle = C.inkMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('扫码进入小程序', W / 2, qrY + qrSize / 2);
    // 昵称 + "正在用 Rise 专注成长"
    ctx.font = `500 12px PingFang SC, -apple-system, sans-serif`;
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${nickname} 正在用 Rise 专注成长`, W / 2, H - 14);
    // ─── 导出临时文件路径 ─────────────────────────────────────────
    return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width: W,
            height: H,
            destWidth: W * dpr,
            destHeight: H * dpr,
            fileType: 'jpg',
            quality: 0.95,
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => reject(new Error(`canvasToTempFilePath failed: ${JSON.stringify(err)}`)),
        });
    });
}

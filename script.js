document.addEventListener('DOMContentLoaded', function () {

    // ==================== DOM ====================
    const preloader      = document.getElementById('preloader');
    const ringFill       = document.getElementById('ring-fill');
    const ringContainer  = document.getElementById('ring-container');
    const ringButton     = document.getElementById('ring-button');
    const circleMask     = document.getElementById('circle-mask');
    const lyricOverlay   = document.getElementById('lyric-overlay');
    const lyricText      = document.querySelector('.lyric-text');
    const cardPage       = document.getElementById('card-page');

    const starCanvas     = document.getElementById('star-canvas');
    const starCtx        = starCanvas ? starCanvas.getContext('2d') : null;
    const tooltip        = document.getElementById('star-tooltip');
    const tooltipName    = tooltip ? tooltip.querySelector('.tooltip-name') : null;
    const tooltipMsg     = tooltip ? tooltip.querySelector('.tooltip-msg') : null;
    const tooltipComments= document.getElementById('tooltip-comments');
    const starCounter    = document.getElementById('star-counter');
    const nameInput      = document.getElementById('name-input');
    const msgInput       = document.getElementById('msg-input');
    const placeBtn       = document.getElementById('place-btn');
    const starToast      = document.getElementById('star-toast');

    // 评论栏
    const commentBar     = document.getElementById('comment-bar');
    const commentTarget  = document.getElementById('comment-target');
    const commentInput   = document.getElementById('comment-input');
    const commentSend    = document.getElementById('comment-send');
    const commentClose   = document.getElementById('comment-close');

    // 管理后台（长按 Sky 星触发，从上方滑下）
    const adminPanel     = document.getElementById('admin-panel');
    const adminClose     = document.getElementById('admin-close');
    const adminLogin     = document.getElementById('admin-login');
    const adminPw        = document.getElementById('admin-pw');
    const adminLoginBtn  = document.getElementById('admin-login-btn');
    const adminContent   = document.getElementById('admin-content');
    const adminList      = document.getElementById('admin-list');
    const adminRefresh   = document.getElementById('admin-refresh');
    const adminLogout    = document.getElementById('admin-logout');

    // ==================== 歌词逐字 ====================
    if (lyricText) {
        const raw = lyricText.textContent;
        lyricText.innerHTML = '';
        for (let i = 0; i < raw.length; i++) {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = raw[i] === ' ' ? '\u00A0' : raw[i];
            lyricText.appendChild(span);
        }
    }
    const chars = document.querySelectorAll('.lyric-text .char');

    // ==================== 预加载 ====================
    let ready = false;
    let dataReady = false;
    let preloadedStars = [];
    gsap.set(ringFill, { strokeDasharray: 283, strokeDashoffset: 283 });
    const breatheEase = "M0,0 C0.15,0 0.35,0.55 0.6,0.9 C0.8,1.15 0.9,1 1,1";

    function checkReady() {
        if (!ready && dataReady) {
            ready = true;
        }
    }

    const stageOne = gsap.timeline({ onComplete: () => { dataReady = true; checkReady(); } });
    stageOne.to(ringFill, { strokeDashoffset: 0, duration: 2.2, ease: breatheEase })
        .to(ringContainer, { scale: 1.05, duration: 1.1, ease: "sine.inOut" }, "-=1.3")
        .to(ringContainer, { scale: 1.0,  duration: 1.1, ease: "sine.inOut" }, "-=0.55")
        .to(ringButton,   { opacity: 1, duration: 0.65, ease: "power3.out" }, "-=0.3");
    gsap.to(ringContainer, { scale: 1.04, duration: 2.0, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 2.3 });

    // 立即发起数据预加载，与 ring 动画并行
    (async function preloadData() {
        try {
            const resp = await fetch(JSONBIN_URL + '/latest', {
                headers: { 'X-Master-Key': JSONBIN_KEY }
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const json = await resp.json();
            preloadedStars = (json.record && json.record.stars) ? json.record.stars : [];
        } catch (e) {
            console.warn('预加载失败，将重试:', e.message);
            preloadedStars = [];
        }
        checkReady();
    })();

    ringButton.addEventListener('click', function () {
        if (!ready) return;
        ready = false;

        const exitTl = gsap.timeline();
        exitTl.to(ringContainer, { scale: 0.45, opacity: 0, duration: 0.42, ease: "power2.in" });
        exitTl.to(preloader, { opacity: 0, duration: 0.38, ease: "power2.out" }, "-=0.18");
        exitTl.to(lyricOverlay, { opacity: 1, duration: 0.5, ease: "power3.out" }, "-=0.25");
        exitTl.fromTo(chars, { opacity: 0, filter: "blur(10px)", y: 6 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.55, stagger: { each: 0.065, from: "start" }, ease: "power2.out" }, "-=0.15");
        exitTl.to({}, { duration: 2.0 });
        exitTl.to(circleMask, {
            clipPath: "circle(150% at 50% 50%)",
            webkitClipPath: "circle(150% at 50% 50%)",
            duration: 1.3,
            ease: "power3.inOut"
        }, "-=0.3");
        exitTl.to(chars, { opacity: 0, filter: "blur(14px)", y: -4, duration: 0.4, stagger: { each: 0.035, from: "end" }, ease: "power2.in" }, "-=0.8");
        exitTl.to(lyricOverlay, { opacity: 0, duration: 0.25, ease: "power2.in" }, "-=0.2");
        exitTl.to(cardPage, { opacity: 1, duration: 0.7, ease: "power2.out" }, "-=0.55");
        exitTl.set(preloader, { display: "none" });
        exitTl.set(lyricOverlay, { display: "none" });
        exitTl.set(circleMask, { display: "none" });
        exitTl.call(() => { initStars(); });
    });

    // ================================================================
    //  星座引擎
    // ================================================================
    const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/683f3c72e41b914e61da7b5a';
    const JSONBIN_KEY = '$2a$10$9rUyzHWd75AJ1uZXkAjcluIaU5YgwsYhvYO.Im37XwVLunftKAJTS';

    let stars = [];           // [{id, name, msg, x, y, time, comments, links}]
    // comments: [{author, text, time}]
    // links: [starId] — 哪些星和我（myStarId）建立了连线
    let bgStars = [];
    let myStarId = null;
    let myStarName = '';
    let placed = false;
    let canvasW = 0, canvasH = 0;
    let hoveredId = null;
    let selectedStarId = null;
    let mouseX = -100, mouseY = -100;
    let animFrame = 0;
    let raf = null;
    let mouseMoveRAF = null;             // mousemove 节流
    let resizeTimer = null;              // resize 防抖
    let isPushing = false;               // 写入保护，防止 sync 覆盖
    let adminPanelOpen = false;          // 管理面板打开时暂停定时同步
    const SKY_ID = 'seed_sky_2026';      // Sky 种子星 ID
    const SKY_TIMESTAMP = 1700000000000; // Sky 固定时间戳
    let skyStar = null;                   // 缓存 Sky 星引用
    let longPressTimer = null;            // 长按计时器
    let isLongPressing = false;           // 是否正在长按

    // 管理权限
    let adminAuthed = false;

    // ---- 工具 ----
    function getMyStar() {
        return stars.find(s => s.id === myStarId) || null;
    }

    // ---- 生成背景静态星 ----
    function generateBgStars() {
        bgStars = [];
        const count = Math.floor((canvasW * canvasH) / 1800);
        for (let i = 0; i < count; i++) {
            bgStars.push({
                x: Math.random() * canvasW,
                y: Math.random() * canvasH,
                r: 0.3 + Math.random() * 1.0,
                alpha: 0.15 + Math.random() * 0.35,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvasW = window.innerWidth;
        canvasH = window.innerHeight;
        starCanvas.width = canvasW * dpr;
        starCanvas.height = canvasH * dpr;
        starCanvas.style.width = canvasW + 'px';
        starCanvas.style.height = canvasH + 'px';
        starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        generateBgStars();
    }

    // ---- 绘制 ----
    function drawBgStar(s) {
        const flicker = 0.7 + 0.3 * Math.sin(animFrame * 0.02 + s.phase);
        const alpha = s.alpha * flicker;
        starCtx.beginPath();
        starCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        starCtx.fillStyle = `rgba(255,255,255,${alpha})`;
        starCtx.fill();
    }

    function drawConnection(from, to, type, starA, starB) {
        // type: 'linked' | 'hover' | 'selected'
        // 距离限制已在 render 层处理，这里只负责绘制
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        // 根据类型使用不同参考距离计算 closeness
        let refDist;
        if (type === 'linked') {
            refDist = Math.sqrt(canvasW * canvasW + canvasH * canvasH) * 0.55; // 与 render 层 linkedMaxDist 一致
        } else {
            refDist = Math.min(canvasW, canvasH) * 0.45;
        }
        const closeness = Math.max(0, 1 - dist / refDist);

        let alpha, lineWidth, dash, dashOffset, color, isLinked = false;
        switch (type) {
            case 'linked':
                isLinked = true;
                alpha = closeness * 0.7;
                lineWidth = 1.2;
                dash = [];
                dashOffset = 0;
                color = `rgba(184,134,11,${alpha})`; // 金色实链接加粗
                break;
            case 'selected':
                alpha = closeness * 0.7;
                lineWidth = 0.8;
                dash = [4, 6];
                dashOffset = -animFrame * 0.5;
                color = `rgba(220,220,255,${alpha})`;
                break;
            case 'hover':
                alpha = closeness * 0.6;
                lineWidth = 0.6;
                dash = [3, 6];
                dashOffset = -animFrame * 0.35;
                color = `rgba(255,255,255,${alpha})`;
                break;
            default: // ambient
                alpha = closeness * 0.12;
                lineWidth = 0.25;
                dash = [2, 10];
                dashOffset = -animFrame * 0.08;
                color = `rgba(255,255,255,${alpha})`;
        }
        if (alpha < 0.005 && !isLinked) return;
        if (alpha < 0.015 && isLinked) return;

        starCtx.save();
        starCtx.beginPath();
        starCtx.moveTo(from.x, from.y);
        starCtx.lineTo(to.x, to.y);
        starCtx.strokeStyle = color;
        starCtx.lineWidth = lineWidth;
        if (dash.length) {
            starCtx.setLineDash(dash);
            starCtx.lineDashOffset = dashOffset;
        }
        starCtx.stroke();
        starCtx.setLineDash([]);

        // 星网：linked 线上双向流动光点
        if (isLinked && dist > 5 && starA && starB) {
            const dotCount = Math.floor(dist / 55) + 1;
            // 正向：from → to（减慢流动速度 0.6 → 0.18）
            for (let d = 0; d < dotCount; d++) {
                const raw = (animFrame * 0.18 + d * 97) % 300;
                const phase = raw / 300;
                const t = (phase + d / dotCount) % 1;
                const px = from.x + dx * t;
                const py = from.y + dy * t;
                const dotAlpha = 0.35 + 0.45 * Math.sin(phase * Math.PI);
                const dotR = 1.0 + 1.5 * Math.sin(phase * Math.PI);
                const dotGrad = starCtx.createRadialGradient(px, py, 0, px, py, dotR);
                dotGrad.addColorStop(0, `rgba(255,220,100,${dotAlpha})`);
                dotGrad.addColorStop(0.4, `rgba(255,200,50,${dotAlpha * 0.6})`);
                dotGrad.addColorStop(1, 'rgba(255,180,0,0)');
                starCtx.beginPath();
                starCtx.arc(px, py, dotR, 0, Math.PI * 2);
                starCtx.fillStyle = dotGrad;
                starCtx.fill();
            }
            // 反向：to → from（相位偏移 0.5 避免重叠，减慢流动速度 0.6 → 0.18）
            for (let d = 0; d < dotCount; d++) {
                const raw = (animFrame * 0.18 + d * 97 + 150) % 300;
                const phase = raw / 300;
                const t = 1 - ((phase + d / dotCount) % 1); // 反向
                const px = from.x + dx * t;
                const py = from.y + dy * t;
                const dotAlpha = 0.35 + 0.45 * Math.sin(phase * Math.PI);
                const dotR = 1.0 + 1.5 * Math.sin(phase * Math.PI);
                const dotGrad = starCtx.createRadialGradient(px, py, 0, px, py, dotR);
                dotGrad.addColorStop(0, `rgba(255,220,100,${dotAlpha})`);
                dotGrad.addColorStop(0.4, `rgba(255,200,50,${dotAlpha * 0.6})`);
                dotGrad.addColorStop(1, 'rgba(255,180,0,0)');
                starCtx.beginPath();
                starCtx.arc(px, py, dotR, 0, Math.PI * 2);
                starCtx.fillStyle = dotGrad;
                starCtx.fill();
            }
        }
        starCtx.restore();
    }

    function drawStarGlow(s, isHovered, isMine, isSelected) {
        const cx = s.x, cy = s.y;
        const baseR = isMine ? 3.5 : (isHovered || isSelected ? 4.5 : 2.5);

        // 外层光晕
        const glowGrad = starCtx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 5);
        const glowAlpha = (isHovered || isSelected) ? 0.9 : 0.6;
        glowGrad.addColorStop(0, `rgba(255,255,255,${glowAlpha})`);
        glowGrad.addColorStop(0.2, `rgba(255,255,255,${glowAlpha * 0.5})`);
        glowGrad.addColorStop(0.5, `rgba(255,255,255,0.05)`);
        glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
        starCtx.beginPath();
        starCtx.arc(cx, cy, baseR * 5, 0, Math.PI * 2);
        starCtx.fillStyle = glowGrad;
        starCtx.fill();

        // 中核
        const coreGrad = starCtx.createRadialGradient(cx, cy, 0, cx, cy, baseR);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.6, 'rgba(255,255,255,0.8)');
        coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
        starCtx.beginPath();
        starCtx.arc(cx, cy, baseR, 0, Math.PI * 2);
        starCtx.fillStyle = coreGrad;
        starCtx.fill();

        // 自己放的星：金色环
        if (isMine) {
            starCtx.beginPath();
            starCtx.arc(cx, cy, baseR + 3, 0, Math.PI * 2);
            starCtx.strokeStyle = 'rgba(184,134,11,0.6)';
            starCtx.lineWidth = 0.8;
            starCtx.setLineDash([2, 3]);
            starCtx.lineDashOffset = -animFrame * 0.5;
            starCtx.stroke();
            starCtx.setLineDash([]);
        }

        // 选中高亮环
        if (isSelected && !isMine) {
            starCtx.beginPath();
            starCtx.arc(cx, cy, baseR + 3.5, 0, Math.PI * 2);
            starCtx.strokeStyle = 'rgba(255,255,255,0.45)';
            starCtx.lineWidth = 0.7;
            starCtx.setLineDash([2, 4]);
            starCtx.lineDashOffset = -animFrame * 0.4;
            starCtx.stroke();
            starCtx.setLineDash([]);
        }

        // 悬停十字线
        if (isHovered) {
            const crossLen = baseR + 6;
            starCtx.strokeStyle = 'rgba(255,255,255,0.5)';
            starCtx.lineWidth = 0.4;
            starCtx.beginPath();
            starCtx.moveTo(cx - crossLen, cy);
            starCtx.lineTo(cx + crossLen, cy);
            starCtx.moveTo(cx, cy - crossLen);
            starCtx.lineTo(cx, cy + crossLen);
            starCtx.stroke();
        }
    }

    function render() {
        if (!starCtx) return;
        starCtx.clearRect(0, 0, canvasW, canvasH);
        bgStars.forEach(drawBgStar);

        const myStar = getMyStar();
        const mySx = myStar ? myStar.x * canvasW : null;
        const mySy = myStar ? myStar.y * canvasH : null;

        // 收集需求连线的对：一个 map 记录 (id1 <-> id2) 的连线类型优先级
        // 优先级：linked > hover/selected > ambient
        const connMap = new Map();

        function connKey(a, b) {
            return a < b ? a + '::' + b : b + '::' + a;
        }

        function setConn(a, b, type) {
            const key = connKey(a, b);
            const existing = connMap.get(key);
            const order = { linked: 3, hover: 2, selected: 2, ambient: 1 };
            if (!existing || order[type] > order[existing]) {
                connMap.set(key, type);
            }
        }

        // 用户星星之间的连线
        const diagonal = Math.sqrt(canvasW * canvasW + canvasH * canvasH);
        const linkedMaxDist = diagonal * 0.55;   // 金色实线：对角线55%，基本覆盖全屏
        const highlightMaxDist = diagonal * 0.35; // 选中/悬停虚线

        for (let i = 0; i < stars.length; i++) {
            const si = stars[i];
            const six = si.x * canvasW;
            const siy = si.y * canvasH;

            for (let j = i + 1; j < stars.length; j++) {
                const sj = stars[j];
                const sjx = sj.x * canvasW;
                const sjy = sj.y * canvasH;
                const dist = Math.sqrt((six - sjx) ** 2 + (siy - sjy) ** 2);

                // 全局星网：任两颗互链的星都显示金色实线（基本不限距离）
                const mutualLinked =
                    (si.links && si.links.includes(sj.id)) ||
                    (sj.links && sj.links.includes(si.id));
                if (mutualLinked) {
                    if (dist < linkedMaxDist) {
                        setConn(si.id, sj.id, 'linked');
                    }
                    continue;
                }

                // 悬停/选中高亮
                if (dist > highlightMaxDist) continue;
                if (si.id === hoveredId || sj.id === hoveredId) {
                    setConn(si.id, sj.id, 'hover');
                } else if (si.id === selectedStarId || sj.id === selectedStarId) {
                    setConn(si.id, sj.id, 'selected');
                }
            }
        }

        // 渲染连线
        connMap.forEach((type, key) => {
            const [idA, idB] = key.split('::');
            const starA = stars.find(s => s.id === idA);
            const starB = stars.find(s => s.id === idB);
            if (starA && starB) {
                drawConnection(
                    { x: starA.x * canvasW, y: starA.y * canvasH },
                    { x: starB.x * canvasW, y: starB.y * canvasH },
                    type, starA, starB
                );
            }
        });

        // 星星
        stars.forEach(s => {
            const sx = s.x * canvasW;
            const sy = s.y * canvasH;
            const isHovered = s.id === hoveredId;
            const isMine = s.id === myStarId;
            const isSelected = s.id === selectedStarId;
            drawStarGlow({ x: sx, y: sy }, isHovered, isMine, isSelected);
        });
    }

    // ---- 检测悬停 ----
    function hitTest(mx, my) {
        const hitRadius = 18;
        let closest = null;
        let closestDist = Infinity;
        for (const s of stars) {
            const sx = s.x * canvasW;
            const sy = s.y * canvasH;
            const dx = mx - sx;
            const dy = my - sy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < hitRadius && dist < closestDist) {
                closest = s;
                closestDist = dist;
            }
        }
        return closest;
    }

    function updateTooltip(s, mx, my) {
        if (!s) {
            hoveredId = null;
            tooltip.classList.remove('show');
            tooltipComments.innerHTML = '';
            tooltipComments.classList.remove('has-comments');
            starCanvas.style.cursor = 'crosshair';
            return;
        }
        hoveredId = s.id;
        tooltipName.textContent = s.name || '无名';
        tooltipMsg.textContent = s.msg || '';
        tooltipMsg.style.display = s.msg ? 'block' : 'none';

        // 显示评论（带删除按钮）
        if (s.comments && s.comments.length > 0) {
            tooltipComments.classList.add('has-comments');
            tooltipComments.innerHTML = s.comments.slice(-3).map((c, idx) => {
                const actualIdx = s.comments.length - Math.min(3, s.comments.length) + idx;
                const canDelete = (c.author === myStarName) || adminAuthed;
                const delBtn = canDelete
                    ? '<span class="comment-delete" data-idx="' + actualIdx + '" data-starid="' + s.id + '">⨯</span>'
                    : '';
                return '<div class="tooltip-comment-line"><span class="comment-author">' +
                    escapeHtml(c.author) + '：</span>' + escapeHtml(c.text) + delBtn + '</div>';
            }).join('');

            // 绑定删除事件
            setTimeout(() => {
                tooltipComments.querySelectorAll('.comment-delete').forEach(btn => {
                    btn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const idx = parseInt(this.dataset.idx);
                        const starId = this.dataset.starid;
                        deleteComment(starId, idx);
                    });
                });
            }, 0);
        } else {
            tooltipComments.classList.remove('has-comments');
            tooltipComments.innerHTML = '';
        }

        tooltip.style.left = mx + 'px';
        tooltip.style.top = my + 'px';
        tooltip.classList.add('show');
        starCanvas.style.cursor = 'pointer';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- 删除评论 ----
    function deleteComment(starId, commentIdx) {
        const targetStar = stars.find(s => s.id === starId);
        if (!targetStar || !targetStar.comments) return;
        targetStar.comments.splice(commentIdx, 1);

        // 如果该星不再有来自 myStarName 的评论，从 links 中移除
        if (myStarId && targetStar.id !== myStarId) {
            const hasMyComment = targetStar.comments.some(c => c.author === myStarName);
            if (!hasMyComment && targetStar.links) {
                targetStar.links = targetStar.links.filter(lid => lid !== myStarId);
            }
            // 同时从我的星 links 中移除
            const myStar = getMyStar();
            if (myStar && myStar.links && !hasMyComment) {
                myStar.links = myStar.links.filter(lid => lid !== targetStar.id);
            }
        }

        pushStarsToBin(stars).catch(() => {});
        showToast('🗑 评论已删除');
        // 刷新 tooltip
        const hit = hitTest(mouseX, mouseY);
        if (hit) updateTooltip(hit, mouseX, mouseY);
    }

    // ---- 放星 ----
    function placeStar(rawX, rawY) {
        if (placed) return;

        const name = nameInput.value.trim();
        if (!name) { showToast('请先填写你的名字'); return; }
        const msg = msgInput.value.trim();
        const displayName = name.slice(0, 8);
        const displayMsg = msg.slice(0, 20);

        const id = 'star_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const x = rawX / canvasW;
        const y = rawY / canvasH;

        const newStar = {
            id, name: displayName, msg: displayMsg, comments: [], links: [],
            x: Math.max(0.02, Math.min(0.98, parseFloat(x.toFixed(4)))),
            y: Math.max(0.05, Math.min(0.90, parseFloat(y.toFixed(4)))),
            time: Date.now()
        };

        stars.push(newStar);
        myStarId = id;
        myStarName = displayName;
        placed = true;
        savePlacedFlag();
        updatePlaceBtn();
        updateCounter();
        showToast('✨ 你的星已点亮');
        gsap.fromTo(starCanvas, { filter: 'brightness(2)' }, { filter: 'brightness(1)', duration: 0.6, ease: 'power2.out' });
        pushStarsToBin(stars).catch(() => {});
    }

    function savePlacedFlag() {
        try { localStorage.setItem('ajiu_star_placed', myStarId); } catch (e) { }
    }

    function loadPlacedFlag() {
        try {
            const id = localStorage.getItem('ajiu_star_placed');
            if (id) { myStarId = id; placed = true; updatePlaceBtn(); }
        } catch (e) { }
    }

    function updatePlaceBtn() {
        if (placed) {
            placeBtn.textContent = '✦ 已点亮';
            placeBtn.classList.add('placed');
            placeBtn.disabled = true;
        } else {
            placeBtn.textContent = '✦ 点亮一颗星';
            placeBtn.classList.remove('placed');
            placeBtn.disabled = false;
        }
    }

    function updateCounter() {
        if (!starCounter) return;
        starCounter.innerHTML = '已有 <span class="count-num">' + stars.length + '</span> 颗星';
    }

    function showToast(msg) {
        if (!starToast) return;
        gsap.killTweensOf(starToast);
        starToast.textContent = msg;
        gsap.set(starToast, { opacity: 1, y: 0 });
        gsap.to(starToast, {
            opacity: 0, y: -20, duration: 2.2, delay: 1.5, ease: 'power2.in',
            onComplete: () => { starToast.style.opacity = '0'; }
        });
    }

    // ---- 评论系统 ----
    function openCommentBar(star) {
        if (!star) return;
        if (!placed || !myStarId) {
            showToast('请先点亮你自已的星，才能评论他人');
            return;
        }
        selectedStarId = star.id;
        commentTarget.textContent = '💬 回复 ' + star.name;
        commentInput.value = '';
        commentBar.classList.add('open');
        setTimeout(() => commentInput.focus(), 350);
    }

    function closeCommentBar() {
        selectedStarId = null;
        commentBar.classList.remove('open');
        commentInput.value = '';
    }

    function submitComment() {
        if (!selectedStarId) return;
        if (!myStarId || !myStarName) {
            showToast('请先点亮你自已的星');
            closeCommentBar();
            return;
        }
        const text = commentInput.value.trim();
        if (!text) return;

        const comment = {
            author: myStarName,
            text: text.slice(0, 20),
            time: Date.now()
        };

        const targetStar = stars.find(s => s.id === selectedStarId);
        if (targetStar) {
            if (!targetStar.comments) targetStar.comments = [];
            targetStar.comments.push(comment);

            // 建立链接关系
            if (!targetStar.links) targetStar.links = [];
            if (!targetStar.links.includes(myStarId)) {
                targetStar.links.push(myStarId);
            }
            const myStar = getMyStar();
            if (myStar) {
                if (!myStar.links) myStar.links = [];
                if (!myStar.links.includes(targetStar.id)) {
                    myStar.links.push(targetStar.id);
                }
            }

            pushStarsToBin(stars).catch(() => {});
            showToast('💬 评论已发送 · 链接已建立');
            const hit = hitTest(mouseX, mouseY);
            if (hit && hit.id === selectedStarId) {
                updateTooltip(hit, mouseX, mouseY);
            }
        }
        closeCommentBar();
    }

    // ==================== JSONBin 操作 ====================
    function fetchStarsFromBin() {
        return fetch(JSONBIN_URL + '/latest', { headers: { 'X-Master-Key': JSONBIN_KEY } })
            .then(r => { if (!r.ok) throw new Error('fetch'); return r.json(); })
            .then(d => {
                const record = d && d.record && d.record.stars ? d.record.stars : [];
                return Array.isArray(record) ? record : [];
            })
            .catch(() => getLocalStars());
    }

    async function pushStarsToBin(allStars) {
        isPushing = true;
        // 始终保留种子星（不受 200 条截断影响）
        const sliced = allStars.slice(-200);
        const seedStars = allStars.filter(s => s.id === SKY_ID);
        for (const seed of seedStars) {
            if (!sliced.includes(seed)) sliced.push(seed);
        }
        const payload = { stars: sliced };
        try {
            const r = await fetch(JSONBIN_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY },
                body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error('PUT failed: ' + r.status);
            await r.json();
            saveLocalStars(allStars);
        } catch (err) {
            console.warn('JSONBin push failed, saving locally:', err);
            saveLocalStars(allStars);
        } finally {
            isPushing = false;
        }
    }

    function getLocalStars() {
        try { const v = localStorage.getItem('ajiu_stars'); return v ? JSON.parse(v) : []; }
        catch (e) { return []; }
    }

    function saveLocalStars(allStars) {
        // 保留种子星，与 pushStarsToBin 一致
        const sliced = allStars.slice(-200);
        const seedStars = allStars.filter(s => s.id === SKY_ID);
        for (const seed of seedStars) {
            if (!sliced.includes(seed)) sliced.push(seed);
        }
        try { localStorage.setItem('ajiu_stars', JSON.stringify(sliced)); }
        catch (e) { }
    }

    function mergeStars(remote, local) {
        const map = new Map();
        remote.forEach(s => map.set(s.id, s));
        local.forEach(s => { if (!map.has(s.id)) map.set(s.id, s); });
        return Array.from(map.values()).sort((a, b) => a.time - b.time);
    }

    let syncInterval = null;

    function syncStars() {
        if (isPushing) return; // 写入进行中，跳过本周期
        if (adminPanelOpen) return; // 管理面板优先：暂停同步防止覆盖管理员修改
        fetchStarsFromBin().then(remote => {
            if (isPushing) return; // 二次检查
            const local = getLocalStars();
            const merged = mergeStars(remote, local);
            const oldCount = stars.length;
            stars = merged;
            updateCounter();
            if (myStarId) {
                const my = stars.find(s => s.id === myStarId);
                if (my) myStarName = my.name;
            }
            if (stars.length !== oldCount) {
                gsap.fromTo(starCanvas, { filter: 'brightness(1.15)' }, { filter: 'brightness(1)', duration: 0.8, ease: 'power2.out' });
            }
        }).catch(() => {
            if (isPushing) return;
            stars = getLocalStars();
            updateCounter();
        });
    }

    // ==================== 事件 ====================
    // mousemove 节流：用 rAF 确保每帧最多一次 hitTest
    function onMouseMove(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (mouseMoveRAF) return;
        mouseMoveRAF = requestAnimationFrame(() => {
            mouseMoveRAF = null;
            const hit = hitTest(mouseX, mouseY);
            updateTooltip(hit, mouseX, mouseY);
        });
    }

    function onClick(e) {
        const controlsH = 200;
        if (e.clientY > canvasH - controlsH) return;

        const hit = hitTest(e.clientX, e.clientY);
        if (hit) {
            if (hit.id === myStarId) {
                showToast('✨ 这是你的星');
                return;
            }
            // Sky 星：长按已打开管理面板，跳过评论栏
            if (hit.id === SKY_ID) {
                if (isLongPressing) {
                    isLongPressing = false;
                    return;
                }
                openCommentBar(hit);
                return;
            }
            openCommentBar(hit);
            return;
        }

        // 点击空白：关闭评论栏
        if (selectedStarId) {
            closeCommentBar();
        }

        if (!placed) {
            placeStar(e.clientX, e.clientY);
        }
    }

    // ---- 长按 Sky 星打开管理面板 ----
    function onPointerDown(e) {
        const hit = hitTest(e.clientX, e.clientY);
        if (!hit || hit.id !== SKY_ID) {
            cancelLongPress();
            return;
        }
        isLongPressing = false;
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            isLongPressing = true;
            openAdmin();
        }, 800);
    }

    function onPointerUp(e) {
        setTimeout(() => {
            cancelLongPress();
        }, 100); // 延迟清除，让 click 事件能检测到 isLongPressing
    }

    function cancelLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        // 注意：不在此处重置 isLongPressing，留给 onClick 判断
    }

    // resize 防抖：150ms 内连续 resize 只触发一次
    function onResize() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resizeCanvas();
            resizeTimer = null;
        }, 150);
    }

    function startLoop() {
        if (raf) cancelAnimationFrame(raf);
        function loop() {
            animFrame++;
            if (animFrame > 100000) animFrame = 0;
            render();
            raf = requestAnimationFrame(loop);
        }
        loop();
    }

    // ==================== 管理后台 ====================
    function openAdmin() {
        adminPanelOpen = true;
        // 管理面板打开时暂停定时同步，防止覆盖管理员修改
        if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
        adminPanel.classList.add('open');
        if (!adminAuthed) {
            adminLogin.style.display = 'flex';
            adminContent.style.display = 'none';
            adminPw.value = '';
            setTimeout(() => adminPw.focus(), 400);
        } else {
            adminLogin.style.display = 'none';
            adminContent.style.display = 'flex';
            renderAdminList();
        }
    }

    function closeAdmin() {
        adminPanelOpen = false;
        adminPanel.classList.remove('open');
        // 恢复定时同步
        if (!syncInterval) syncInterval = setInterval(syncStars, 6000);
    }

    function adminAuth() {
        if (adminPw.value.trim() === 'ajiu') {
            adminAuthed = true;
            adminLogin.style.display = 'none';
            adminContent.style.display = 'flex';
            renderAdminList();
        } else {
            showToast('密码错误');
        }
    }

    function adminDoLogout() {
        adminAuthed = false;
        adminLogin.style.display = 'flex';
        adminContent.style.display = 'none';
        adminPw.value = '';
    }

    function renderAdminList() {
        adminList.innerHTML = '';
        const sorted = [...stars].sort((a, b) => b.time - a.time);
        sorted.forEach(star => {
            const card = document.createElement('div');
            card.className = 'admin-star-card';
            card.innerHTML = `
                <div class="admin-star-row"><label>名字</label><input type="text" class="adm-name" value="${escapeHtml(star.name || '')}" maxlength="8"></div>
                <div class="admin-star-row"><label>留言</label><input type="text" class="adm-msg" value="${escapeHtml(star.msg || '')}" maxlength="20"></div>
                <div class="admin-star-row"><label>坐标</label><label>x</label><input type="number" class="adm-x" value="${star.x.toFixed(4)}" step="0.001" min="0" max="1"> <label>y</label><input type="number" class="adm-y" value="${star.y.toFixed(4)}" step="0.001" min="0" max="1"></div>
                <div class="admin-comments-section">
                    ${(star.comments || []).map((c, i) => `
                        <div class="admin-comment-item">
                            <span style="color:#888;font-size:0.6rem">${escapeHtml(c.author)}：</span>
                            <input type="text" class="adm-comment" value="${escapeHtml(c.text)}" data-idx="${i}" maxlength="20">
                            <button class="del-comment-btn" data-idx="${i}">⨯</button>
                        </div>
                    `).join('')}
                </div>
                <div class="admin-save-row">
                    <button class="danger-del admin-del-star">删除整颗星</button>
                    <button class="admin-save-star">保存修改</button>
                </div>
            `;

            // 保存修改
            card.querySelector('.admin-save-star').addEventListener('click', () => {
                star.name = card.querySelector('.adm-name').value.trim() || '无名';
                star.msg = card.querySelector('.adm-msg').value.trim().slice(0, 20);
                const nx = parseFloat(card.querySelector('.adm-x').value);
                const ny = parseFloat(card.querySelector('.adm-y').value);
                if (!isNaN(nx) && nx >= 0 && nx <= 1) star.x = nx;
                if (!isNaN(ny) && ny >= 0 && ny <= 1) star.y = ny;

                // 更新评论
                const commentInputs = card.querySelectorAll('.adm-comment');
                commentInputs.forEach(inp => {
                    const idx = parseInt(inp.dataset.idx);
                    if (star.comments && star.comments[idx]) {
                        star.comments[idx].text = inp.value.trim().slice(0, 20);
                    }
                });

                pushStarsToBin(stars).catch(() => {});
                showToast('✅ 已保存');
                if (myStarId === star.id) myStarName = star.name;
            });

            // 删除整颗星
            card.querySelector('.admin-del-star').addEventListener('click', () => {
                if (confirm('确定删除这颗星 "' + (star.name || '无名') + '" 吗？')) {
                    stars = stars.filter(s => s.id !== star.id);
                    // 清理其他星中对该星的 links
                    stars.forEach(s => {
                        if (s.links) s.links = s.links.filter(lid => lid !== star.id);
                    });
                    pushStarsToBin(stars).catch(() => {});
                    updateCounter();
                    showToast('🗑 星已删除');
                    renderAdminList();
                }
            });

            adminList.appendChild(card);
        });

        // 重新绑定所有 del-comment-btn
        adminList.querySelectorAll('.del-comment-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const card = this.closest('.admin-star-card');
                const idx = parseInt(this.dataset.idx);
                const cardIdx = Array.from(adminList.children).indexOf(card);
                const sorted = [...stars].sort((a, b) => b.time - a.time);
                if (sorted[cardIdx] && sorted[cardIdx].comments) {
                    sorted[cardIdx].comments.splice(idx, 1);
                    pushStarsToBin(stars).catch(() => {});
                    showToast('评论已删除');
                    renderAdminList();
                }
            });
        });
    }

    // 管理后台事件绑定
    adminClose.addEventListener('click', closeAdmin);
    adminLoginBtn.addEventListener('click', adminAuth);
    adminPw.addEventListener('keydown', (e) => { if (e.key === 'Enter') adminAuth(); });
    adminRefresh.addEventListener('click', () => { syncStars(); setTimeout(renderAdminList, 500); showToast('🔄 已刷新'); });
    adminLogout.addEventListener('click', adminDoLogout);

    // 点击面板外部关闭 -- 顶部滑下面板：点下方区域关闭
    starCanvas.addEventListener('click', function (e) {
        if (adminPanel.classList.contains('open')) {
            const rect = adminPanel.getBoundingClientRect();
            if (e.clientY > rect.bottom) {
                closeAdmin();
            }
        }
    });

    // ==================== 页面卸载清理 ====================
    function cleanup() {
        if (raf) {
            cancelAnimationFrame(raf);
            raf = null;
        }
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (resizeTimer) {
            clearTimeout(resizeTimer);
            resizeTimer = null;
        }
    }
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    // ---- 初始化 ----
    function initStars() {
        resizeCanvas();
        loadPlacedFlag();

        // 使用预加载数据（与 ring 动画并行完成的），失败则回退 fetch
        function initWithData(remote) {
            const local = getLocalStars();
            stars = mergeStars(remote, local);

            // 种子星 Sky 
            let seedInserted = false;
            const OLD_SEED_ID = 'seed_cline_2026';
            const hadOldSeed = stars.some(s => s.id === OLD_SEED_ID);
            if (hadOldSeed) {
                stars = stars.filter(s => s.id !== OLD_SEED_ID);
            }
            if (!stars.find(s => s.id === SKY_ID)) {
                stars.push({
                    id: SKY_ID, name: 'Sky', msg: '长按我打开管理面板',
                    comments: [{ author: 'Sky', text: '第一束星光✨', time: SKY_TIMESTAMP }],
                    links: [],
                    x: 0.5, y: 0.38, time: SKY_TIMESTAMP
                });
                seedInserted = true;
            }
            skyStar = stars.find(s => s.id === SKY_ID) || null;

            updateCounter();
            let needPush = seedInserted || hadOldSeed;
            if (myStarId && !stars.find(s => s.id === myStarId)) {
                const localAll = getLocalStars();
                const myStar = localAll.find(s => s.id === myStarId);
                if (myStar) {
                    stars.push(myStar);
                    needPush = true;
                }
            }
            if (needPush) pushStarsToBin(stars).catch(() => {});
            if (myStarId) {
                const my = stars.find(s => s.id === myStarId);
                if (my) { myStarName = my.name; placed = true; updatePlaceBtn(); }
            }
        }

        if (preloadedStars.length > 0) {
            initWithData(preloadedStars);
        } else {
            // 预加载失败，回退到异步 fetch
            fetchStarsFromBin().then(initWithData).catch(() => {
                initWithData(getLocalStars());
                saveLocalStars(stars);
            });
        }

        startLoop();

        window.addEventListener('mousemove', onMouseMove, { passive: true });
        starCanvas.addEventListener('click', onClick);
        // 长按 Sky 星触发管理面板
        starCanvas.addEventListener('pointerdown', onPointerDown);
        starCanvas.addEventListener('pointerup', onPointerUp);
        starCanvas.addEventListener('pointerleave', onPointerUp);
        starCanvas.addEventListener('pointercancel', onPointerUp);
        // 阻止移动端长按菜单
        starCanvas.addEventListener('contextmenu', e => e.preventDefault());
        starCanvas.style.touchAction = 'none';
        placeBtn.addEventListener('click', () => {
            if (placed) return;
            const name = nameInput.value.trim();
            if (!name) { showToast('请先填写你的名字'); return; }
            const cx = canvasW / 2 + (Math.random() - 0.5) * canvasW * 0.4;
            const cy = canvasH * 0.3 + Math.random() * canvasH * 0.35;
            placeStar(cx, cy);
        });
        window.addEventListener('resize', onResize);

        // 评论栏事件
        commentSend.addEventListener('click', submitComment);
        commentClose.addEventListener('click', closeCommentBar);
        commentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitComment();
            if (e.key === 'Escape') closeCommentBar();
        });

        syncInterval = setInterval(syncStars, 6000);
    }
});
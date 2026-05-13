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
    const ringBreath = gsap.to(ringContainer, { scale: 1.04, duration: 2.0, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 2.3 });

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
        if (ringBreath) ringBreath.kill();

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
    //  星云引擎
    // ================================================================
    const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/6a03621cadc21f119a8d9d2c';
    const JSONBIN_KEY = '$2a$10$9rUyzHWd75AJ1uZXkAjcluIaU5YgwsYhvYO.Im37XwVLunftKAJTS';

    let stars = [];           // [{id, name, msg, x, y, time, comments, links}]
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
    let mouseMoveRAF = null;
    let resizeTimer = null;
    let isPushing = false;
    let adminPanelOpen = false;
    const SKY_ID = 'seed_sky_2026';
    const SKY_TIMESTAMP = 1700000000000;
    let skyStar = null;
    let longPressTimer = null;
    let isLongPressing = false;
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // ---- 镜头系统 ----
    let camera = { x: 0, y: 0, zoom: 1 };
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let cameraAtDragStart = { x: 0, y: 0 };
    const MIN_ZOOM = 0.4;
    const MAX_ZOOM = 2.5;

    // 管理权限
    let adminAuthed = false;

    // ---- 坐标转换 ----
    function worldToScreen(wx, wy) {
        return {
            x: wx * canvasW * camera.zoom + camera.x,
            y: wy * canvasH * camera.zoom + camera.y
        };
    }

    function screenToWorld(sx, sy) {
        return {
            x: (sx - camera.x) / (canvasW * camera.zoom),
            y: (sy - camera.y) / (canvasH * camera.zoom)
        };
    }

    // ---- 工具 ----
    function getMyStar() {
        return stars.find(s => s.id === myStarId) || null;
    }

    function generateBgStars() {
        bgStars = [];
        // 背景星覆盖范围要比可视区域大一圈，支持镜头平移
        const pad = 400;
        const count = Math.floor(((canvasW + pad * 2) * (canvasH + pad * 2)) / 1800);
        for (let i = 0; i < count; i++) {
            bgStars.push({
                x: -pad + Math.random() * (canvasW + pad * 2),
                y: -pad + Math.random() * (canvasH + pad * 2),
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
        const sx = s.x * camera.zoom + camera.x;
        const sy = s.y * camera.zoom + camera.y;
        // 只绘制可视区域内的背景星
        if (sx < -20 || sx > canvasW + 20 || sy < -20 || sy > canvasH + 20) return;
        const flicker = 0.7 + 0.3 * Math.sin(animFrame * 0.02 + s.phase);
        const alpha = s.alpha * flicker;
        starCtx.beginPath();
        starCtx.arc(sx, sy, s.r * camera.zoom, 0, Math.PI * 2);
        starCtx.fillStyle = `rgba(255,255,255,${alpha})`;
        starCtx.fill();
    }

    function drawConnection(from, to, type, starA, starB) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        let refDist;
        if (type === 'linked') {
            refDist = Math.sqrt(canvasW * canvasW + canvasH * canvasH) * 0.55 * camera.zoom;
        } else if (type === 'selected') {
            refDist = Math.sqrt(canvasW * canvasW + canvasH * canvasH) * 0.35 * camera.zoom;
        } else {
            refDist = Math.min(canvasW, canvasH) * 0.45 * camera.zoom;
        }
        const closeness = Math.max(0, 1 - dist / refDist);

        let alpha, lineWidth, dash, dashOffset, color, isLinked = false;
        switch (type) {
            case 'linked':
                isLinked = true;
                alpha = closeness * 0.7;
                lineWidth = 1.2 * camera.zoom;
                dash = [];
                dashOffset = 0;
                color = `rgba(184,134,11,${alpha})`;
                break;
            case 'selected':
                alpha = closeness * 0.7;
                lineWidth = 0.8 * camera.zoom;
                dash = [4, 6];
                dashOffset = -animFrame * 0.5;
                color = `rgba(220,220,255,${alpha})`;
                break;
            case 'hover':
                alpha = closeness * 0.6;
                lineWidth = 0.6 * camera.zoom;
                dash = [3, 6];
                dashOffset = -animFrame * 0.35;
                color = `rgba(255,255,255,${alpha})`;
                break;
            default:
                alpha = closeness * 0.12;
                lineWidth = 0.25 * camera.zoom;
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

        if (isLinked && dist > 5 && starA && starB) {
            const dotCount = Math.floor(dist / 55) + 1;
            for (let d = 0; d < dotCount; d++) {
                const raw = (animFrame * 0.18 + d * 97) % 300;
                const phase = raw / 300;
                const t = (phase + d / dotCount) % 1;
                const px = from.x + dx * t;
                const py = from.y + dy * t;
                const dotAlpha = 0.35 + 0.45 * Math.sin(phase * Math.PI);
                const dotR = (1.0 + 1.5 * Math.sin(phase * Math.PI)) * camera.zoom;
                const dotGrad = starCtx.createRadialGradient(px, py, 0, px, py, dotR);
                dotGrad.addColorStop(0, `rgba(255,220,100,${dotAlpha})`);
                dotGrad.addColorStop(0.4, `rgba(255,200,50,${dotAlpha * 0.6})`);
                dotGrad.addColorStop(1, 'rgba(255,180,0,0)');
                starCtx.beginPath();
                starCtx.arc(px, py, dotR, 0, Math.PI * 2);
                starCtx.fillStyle = dotGrad;
                starCtx.fill();
            }
            for (let d = 0; d < dotCount; d++) {
                const raw = (animFrame * 0.18 + d * 97 + 150) % 300;
                const phase = raw / 300;
                const t = 1 - ((phase + d / dotCount) % 1);
                const px = from.x + dx * t;
                const py = from.y + dy * t;
                const dotAlpha = 0.35 + 0.45 * Math.sin(phase * Math.PI);
                const dotR = (1.0 + 1.5 * Math.sin(phase * Math.PI)) * camera.zoom;
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
        const scaledR = baseR * camera.zoom;

        const glowGrad = starCtx.createRadialGradient(cx, cy, 0, cx, cy, scaledR * 5);
        const glowAlpha = (isHovered || isSelected) ? 0.9 : 0.6;
        glowGrad.addColorStop(0, `rgba(255,255,255,${glowAlpha})`);
        glowGrad.addColorStop(0.2, `rgba(255,255,255,${glowAlpha * 0.5})`);
        glowGrad.addColorStop(0.5, `rgba(255,255,255,0.05)`);
        glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
        starCtx.beginPath();
        starCtx.arc(cx, cy, scaledR * 5, 0, Math.PI * 2);
        starCtx.fillStyle = glowGrad;
        starCtx.fill();

        const coreGrad = starCtx.createRadialGradient(cx, cy, 0, cx, cy, scaledR);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.6, 'rgba(255,255,255,0.8)');
        coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
        starCtx.beginPath();
        starCtx.arc(cx, cy, scaledR, 0, Math.PI * 2);
        starCtx.fillStyle = coreGrad;
        starCtx.fill();

        if (isMine) {
            starCtx.beginPath();
            starCtx.arc(cx, cy, scaledR + 3 * camera.zoom, 0, Math.PI * 2);
            starCtx.strokeStyle = 'rgba(184,134,11,0.6)';
            starCtx.lineWidth = 0.8 * camera.zoom;
            starCtx.setLineDash([2, 3]);
            starCtx.lineDashOffset = -animFrame * 0.5;
            starCtx.stroke();
            starCtx.setLineDash([]);
        }

        if (isSelected && !isMine) {
            starCtx.beginPath();
            starCtx.arc(cx, cy, scaledR + 3.5 * camera.zoom, 0, Math.PI * 2);
            starCtx.strokeStyle = 'rgba(255,255,255,0.45)';
            starCtx.lineWidth = 0.7 * camera.zoom;
            starCtx.setLineDash([2, 4]);
            starCtx.lineDashOffset = -animFrame * 0.4;
            starCtx.stroke();
            starCtx.setLineDash([]);
        }

        if (isHovered) {
            const crossLen = scaledR + 6 * camera.zoom;
            starCtx.strokeStyle = 'rgba(255,255,255,0.5)';
            starCtx.lineWidth = 0.4 * camera.zoom;
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

        const connMap = new Map();

        function connKey(a, b) {
            return a < b ? a + '::' + b : b + '::' + a;
        }

        function setConn(a, b, type) {
            const key = connKey(a, b);
            const existing = connMap.get(key);
            const order = { linked: 3, selected: 2, hover: 1, ambient: 0 };
            if (!existing || order[type] > order[existing]) {
                connMap.set(key, type);
            }
        }

        const diagonal = Math.sqrt(canvasW * canvasW + canvasH * canvasH);
        const linkedMaxDist = diagonal * 0.55 * camera.zoom;
        const highlightMaxDist = diagonal * 0.35 * camera.zoom;

        // ---- 连线逻辑 ----
        for (let i = 0; i < stars.length; i++) {
            const si = stars[i];
            const six = si.x * canvasW;
            const siy = si.y * canvasH;
            const { x: sx, y: sy } = worldToScreen(si.x, si.y);

            for (let j = i + 1; j < stars.length; j++) {
                const sj = stars[j];
                const sjx = sj.x * canvasW;
                const sjy = sj.y * canvasH;
                const dist = Math.sqrt((six - sjx) ** 2 + (siy - sjy) ** 2);
                const screenDist = dist * camera.zoom;

                const mutualLinked =
                    (si.links && si.links.includes(sj.id)) ||
                    (sj.links && sj.links.includes(si.id));
                if (mutualLinked) {
                    if (screenDist < linkedMaxDist) {
                        setConn(si.id, sj.id, 'linked');
                    }
                    continue;
                }

                if (screenDist > highlightMaxDist) continue;
                if (si.id === hoveredId || sj.id === hoveredId) {
                    setConn(si.id, sj.id, 'hover');
                }
                // selected 不再辐射所有近星，改为只在后面专门处理 single-selected
            }
        }

        // selectedStarId 专用：仅显示 我 ↔ 选中星 一条虚线
        if (selectedStarId && myStarId && selectedStarId !== myStarId) {
            const selStar = stars.find(s => s.id === selectedStarId);
            const myStar = stars.find(s => s.id === myStarId);
            if (selStar && myStar) {
                const dx = (selStar.x - myStar.x) * canvasW;
                const dy = (selStar.y - myStar.y) * canvasH;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const screenDist = dist * camera.zoom;
                if (screenDist < highlightMaxDist) {
                    setConn(myStar.id, selStar.id, 'selected');
                }
            }
        }

        connMap.forEach((type, key) => {
            const [idA, idB] = key.split('::');
            const starA = stars.find(s => s.id === idA);
            const starB = stars.find(s => s.id === idB);
            if (starA && starB) {
                const a = worldToScreen(starA.x, starA.y);
                const b = worldToScreen(starB.x, starB.y);
                drawConnection(a, b, type, starA, starB);
            }
        });

        stars.forEach(s => {
            const { x: sx, y: sy } = worldToScreen(s.x, s.y);
            const isHovered = s.id === hoveredId;
            const isMine = s.id === myStarId;
            const isSelected = s.id === selectedStarId;
            drawStarGlow({ x: sx, y: sy }, isHovered, isMine, isSelected);
        });
    }

    // ---- 检测悬停（考虑镜头） ----
    function hitTest(mx, my) {
        const hitRadius = 18 * camera.zoom;
        let closest = null;
        let closestDist = Infinity;
        for (const s of stars) {
            const { x: sx, y: sy } = worldToScreen(s.x, s.y);
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
            starCanvas.style.cursor = isDragging ? 'grabbing' : 'crosshair';
            return;
        }
        hoveredId = s.id;
        tooltipName.textContent = s.name || '无名';
        tooltipMsg.textContent = s.msg || '';
        tooltipMsg.style.display = s.msg ? 'block' : 'none';

        if (s.comments && s.comments.length > 0) {
            tooltipComments.classList.add('has-comments');
            const showAll = (s.id === myStarId || s.id === SKY_ID);
            const displayedComments = showAll ? s.comments : s.comments.slice(-3);
            tooltipComments.innerHTML = displayedComments.map((c, idx) => {
                const actualIdx = showAll ? idx : (s.comments.length - Math.min(3, s.comments.length) + idx);
                const canDelete = (c.author === myStarName) || adminAuthed;
                const delBtn = canDelete
                    ? '<span class="comment-delete" data-idx="' + actualIdx + '" data-starid="' + s.id + '">⨯</span>'
                    : '';
                return '<div class="tooltip-comment-line"><span class="comment-author">' +
                    escapeHtml(c.author) + '：</span>' + escapeHtml(c.text) + delBtn + '</div>';
            }).join('');

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

        tooltip.style.left = '0px';
        tooltip.style.top = '0px';
        tooltip.style.transform = 'translate(' + mx + 'px, ' + my + 'px) translate(-50%, -130%)';
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

        if (myStarId && targetStar.id !== myStarId) {
            const hasMyComment = targetStar.comments.some(c => c.author === myStarName);
            if (!hasMyComment && targetStar.links) {
                targetStar.links = targetStar.links.filter(lid => lid !== myStarId);
            }
            const myStar = getMyStar();
            if (myStar && myStar.links && !hasMyComment) {
                myStar.links = myStar.links.filter(lid => lid !== targetStar.id);
            }
        }

        pushStarsToBin(stars).catch(() => {});
        showToast('评论已删除');
        const hit = hitTest(mouseX, mouseY);
        if (hit) updateTooltip(hit, mouseX, mouseY);
    }

    // ---- 放星（含斥力算法） ----
    function placeStar(rawX, rawY) {
        if (placed) return;

        const name = nameInput.value.trim();
        if (!name) { showToast('请先填写你的名字'); return; }
        const msg = msgInput.value.trim();
        const displayName = name.slice(0, 8);
        const displayMsg = msg.slice(0, 20);

        // 斥力检测：距现有星最小间距
        const { x: worldX, y: worldY } = screenToWorld(rawX, rawY);
        const MIN_SPACING = 0.04; // 归一化坐标下最小间距
        for (const s of stars) {
            const dx = worldX - s.x;
            const dy = worldY - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MIN_SPACING) {
                showToast('此处离其他星太近，请换个位置');
                return;
            }
        }

        const id = 'star_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

        const newStar = {
            id, name: displayName, msg: displayMsg, comments: [], links: [],
            x: Math.max(0.02, Math.min(0.98, parseFloat(worldX.toFixed(4)))),
            y: Math.max(0.05, Math.min(0.90, parseFloat(worldY.toFixed(4)))),
            time: Date.now()
        };

        stars.push(newStar);
        myStarId = id;
        myStarName = displayName;
        placed = true;
        savePlacedFlag();
        updatePlaceBtn();
        updateCounter();
        showToast('你的星已点亮');
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
            opacity: 0, y: -20, duration: 1.6, delay: 1.0, ease: 'power2.in',
            onComplete: () => { starToast.style.opacity = '0'; }
        });
    }

    // ---- 评论系统 ----
    function openCommentBar(star) {
        if (!star) return;
        if (!placed || !myStarId) {
            showToast('请先点亮你自已的星');
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
            showToast('评论已发送');
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
            .catch(err => { console.warn('JSONBin fetch failed:', err); throw err; });
    }

    async function pushStarsToBin(allStars) {
        isPushing = true;
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
        const sliced = allStars.slice(-200);
        const seedStars = allStars.filter(s => s.id === SKY_ID);
        for (const seed of seedStars) {
            if (!sliced.includes(seed)) sliced.push(seed);
        }
        try { localStorage.setItem('ajiu_stars', JSON.stringify(sliced)); }
        catch (e) { }
    }

    let syncInterval = null;

    function syncStars() {
        if (isPushing) return;
        if (adminPanelOpen) return;
        fetchStarsFromBin().then(remote => {
            if (isPushing) return;
            saveLocalStars(remote);
            const oldCount = stars.length;
            stars = remote.slice();
            updateCounter();
            if (myStarId) {
                const my = stars.find(s => s.id === myStarId);
                if (my) {
                    myStarName = my.name;
                } else {
                    myStarId = null;
                    placed = false;
                    try { localStorage.removeItem('ajiu_star_placed'); } catch (e) {}
                    updatePlaceBtn();
                }
            }
            if (stars.length !== oldCount) {
                gsap.fromTo(starCanvas, { filter: 'brightness(1.15)' }, { filter: 'brightness(1)', duration: 0.8, ease: 'power2.out' });
            }
        }).catch(err => {
            if (isPushing) return;
            console.warn('同步失败，保持现有数据:', err);
            if (stars.length === 0) {
                stars = getLocalStars();
                updateCounter();
            }
        });
    }

    // ==================== 镜头事件 ====================
    function onMouseDown(e) {
        // 检查是否点击在星上，如果是则不启动拖动
        const hit = hitTest(e.clientX, e.clientY);
        if (hit) return; // 点击星时不拖动

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        cameraAtDragStart.x = camera.x;
        cameraAtDragStart.y = camera.y;
        starCanvas.style.cursor = 'grabbing';
        starCanvas.setPointerCapture(e.pointerId);
    }

    function onMouseMoveGlobal(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (isDragging) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            camera.x = cameraAtDragStart.x + dx;
            camera.y = cameraAtDragStart.y + dy;
            starCanvas.style.cursor = 'grabbing';
            // 拖动时隐藏 tooltip
            if (hoveredId !== null) {
                hoveredId = null;
                tooltip.classList.remove('show');
                tooltipComments.innerHTML = '';
                tooltipComments.classList.remove('has-comments');
            }
        } else {
            if (mouseMoveRAF) return;
            mouseMoveRAF = requestAnimationFrame(() => {
                mouseMoveRAF = null;
                const hit = hitTest(mouseX, mouseY);
                updateTooltip(hit, mouseX, mouseY);
            });
        }
    }

    function onMouseUp(e) {
        if (isDragging) {
            isDragging = false;
            starCanvas.style.cursor = 'crosshair';
        }
    }

    function onWheel(e) {
        e.preventDefault();
        const zoomBefore = camera.zoom;
        const delta = -e.deltaY * 0.001;
        camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * (1 + delta)));

        // 以鼠标位置为中心缩放
        const zoomRatio = camera.zoom / zoomBefore;
        camera.x = e.clientX - (e.clientX - camera.x) * zoomRatio;
        camera.y = e.clientY - (e.clientY - camera.y) * zoomRatio;

        // 缩放后更新 hover
        const hit = hitTest(mouseX, mouseY);
        updateTooltip(hit, mouseX, mouseY);
    }

    // ==================== 点击 / 互动事件 ====================
    function onClickCanvas(e) {
        // 如果刚拖动过（移动距离 > 3px），忽略点击
        if (isDragging) return;

        const controlsH = 200;
        if (e.clientY > canvasH - controlsH) return;

        const hit = hitTest(e.clientX, e.clientY);
        if (hit) {
            if (hit.id === myStarId) {
                showToast('这是你的星');
                return;
            }
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

        if (selectedStarId) {
            closeCommentBar();
        }

        if (!placed) {
            placeStar(e.clientX, e.clientY);
        }
    }

    function onPointerDown(e) {
        const hit = hitTest(e.clientX, e.clientY);
        if (!hit || hit.id !== SKY_ID) {
            cancelLongPress();
            // 没有命中 Sky 星 → 可能是拖动
            if (!hit) onMouseDown(e);
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
        cancelLongPress();
        onMouseUp(e);
        setTimeout(() => {
            cancelLongPress();
        }, 100);
    }

    function cancelLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

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

            card.querySelector('.admin-save-star').addEventListener('click', () => {
                star.name = card.querySelector('.adm-name').value.trim() || '无名';
                star.msg = card.querySelector('.adm-msg').value.trim().slice(0, 20);
                const nx = parseFloat(card.querySelector('.adm-x').value);
                const ny = parseFloat(card.querySelector('.adm-y').value);
                if (!isNaN(nx) && nx >= 0 && nx <= 1) star.x = nx;
                if (!isNaN(ny) && ny >= 0 && ny <= 1) star.y = ny;

                const commentInputs = card.querySelectorAll('.adm-comment');
                commentInputs.forEach(inp => {
                    const idx = parseInt(inp.dataset.idx);
                    if (star.comments && star.comments[idx]) {
                        star.comments[idx].text = inp.value.trim().slice(0, 20);
                    }
                });

                pushStarsToBin(stars).catch(() => {});
                showToast('已保存');
                if (myStarId === star.id) myStarName = star.name;
            });

            card.querySelector('.admin-del-star').addEventListener('click', () => {
                if (confirm('确定删除这颗星 "' + (star.name || '无名') + '" 吗？')) {
                    const deletedName = star.name;
                    // 1. 删除该星
                    stars = stars.filter(s => s.id !== star.id);
                    // 2. 清理其他星的 links
                    stars.forEach(s => {
                        if (s.links) s.links = s.links.filter(lid => lid !== star.id);
                    });
                    // 3. 清理该作者在其他星下的评论
                    if (deletedName) {
                        stars.forEach(s => {
                            if (s.comments && s.comments.length > 0) {
                                s.comments = s.comments.filter(c => c.author !== deletedName);
                            }
                        });
                    }
                    pushStarsToBin(stars).catch(() => {});
                    updateCounter();
                    showToast('星已删除');
                    renderAdminList();
                }
            });

            adminList.appendChild(card);
        });

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

    adminClose.addEventListener('click', closeAdmin);
    adminLoginBtn.addEventListener('click', adminAuth);
    adminPw.addEventListener('keydown', (e) => { if (e.key === 'Enter') adminAuth(); });
    adminRefresh.addEventListener('click', () => { syncStars(); setTimeout(renderAdminList, 500); showToast('已刷新'); });
    adminLogout.addEventListener('click', adminDoLogout);

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

        function initWithData(remote) {
            stars = remote.slice();

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
            if (needPush) pushStarsToBin(stars).catch(() => {});
            if (myStarId) {
                const my = stars.find(s => s.id === myStarId);
                if (my) {
                    myStarName = my.name;
                    placed = true;
                    updatePlaceBtn();
                } else {
                    myStarId = null;
                    placed = false;
                    try { localStorage.removeItem('ajiu_star_placed'); } catch (e) {}
                    updatePlaceBtn();
                }
            }
        }

        if (preloadedStars.length > 0) {
            initWithData(preloadedStars);
        } else {
            fetchStarsFromBin().then(initWithData).catch(() => {
                initWithData(getLocalStars());
                saveLocalStars(stars);
            });
        }

        startLoop();

        // 镜头事件
        window.addEventListener('mousemove', onMouseMoveGlobal, { passive: true });
        starCanvas.addEventListener('pointerdown', onPointerDown);
        starCanvas.addEventListener('pointerup', onPointerUp);
        starCanvas.addEventListener('pointerleave', onPointerUp);
        starCanvas.addEventListener('pointercancel', onPointerUp);
        starCanvas.addEventListener('contextmenu', e => e.preventDefault());
        starCanvas.style.touchAction = 'none';
        starCanvas.addEventListener('wheel', onWheel, { passive: false });

        // 点击事件（分离出来避免与拖动冲突）
        starCanvas.addEventListener('click', onClickCanvas);

        placeBtn.addEventListener('click', () => {
            if (placed) return;
            const name = nameInput.value.trim();
            if (!name) { showToast('请先填写你的名字'); return; }
            // 屏幕中心附近随机位置
            const cx = canvasW / 2 + (Math.random() - 0.5) * canvasW * 0.3;
            const cy = canvasH * 0.35 + Math.random() * canvasH * 0.25;
            placeStar(cx, cy);
        });
        window.addEventListener('resize', onResize);

        commentSend.addEventListener('click', submitComment);
        commentClose.addEventListener('click', closeCommentBar);
        commentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitComment();
            if (e.key === 'Escape') closeCommentBar();
        });

        syncInterval = setInterval(syncStars, 6000);
    }
});
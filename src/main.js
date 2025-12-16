// --- 설정 변수 ---
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 1500;
const NUM_USER_CUTS = 10;
const MIN_DISTANCE = 20;
const COLLISION_MARGIN = 10;
const CUT_SIZE = { width: 350, height: 200 };
const TEMP_DESCRIPTIONS = [
    "멍하니 침대에 누워 있어요.", "눈물이 흐른다.", "쏴아아,\n바다 소리가 귀를 관통한다.",
    "점점 물에 잠긴다. \n 톡, 무언가 나를 건드린다", "물 속에서 눈을 뜬다.", "몸을 일으킨다. \n우와, 바다다.",
    "바다가 손을 내민다. \n 나도 손을 내민다.", "나를 안아줘. \n 바다에 안긴다.", "침대 위에 누워 있어요. \n 축축해.",
    "몸을 웅크린다. \n 바다 소리가 나를 둘러싼다."
];

const canvas = document.getElementById('infinite-canvas');
const lineCanvas = document.getElementById('line-canvas');
const lineCtx = lineCanvas.getContext('2d');
const storyPanel = document.getElementById('story-panel');
const storyOutputDiv = document.getElementById('story-output');
const restartButton = document.getElementById('restart-button');
const instructionDiv = document.getElementById('instruction');
const generateButton = document.getElementById('generate-button');

const userImages = Array.from({ length: NUM_USER_CUTS }, (_, i) => `img/cut_${i + 1}.png`);

const centerX = CANVAS_WIDTH / 2;
const centerY = CANVAS_HEIGHT / 2;

let allCuts = [];
let currentCameraPos = { x: centerX, y: centerY };
let isDragging = false; // 마우스 드래그 상태
let startPos = { x: 0, y: 0 };
let selectedSequence = [];
let isStoryGenerated = false;
let isAnimatingLines = false;
let animationFrameId = null;

// <mark>*** 수정: 터치 로직에 필요한 변수 재정의 ***</mark>
let isTouchStart = false; // 터치 다운 상태
let touchMovedDistance = 0; // 터치 이동 거리 (클릭/드래그 판단용)
const CLICK_TOLERANCE = 10; // 10px 이하 이동은 클릭으로 간주
// <mark>*** 수정 끝 ***</mark>


// --- 헬퍼 함수: 겹침 감지 ---
function isOverlapping(newCut, existingCuts) {
    for (const existingCut of existingCuts) {
        if (
            newCut.x < existingCut.x + existingCut.width + COLLISION_MARGIN &&
            newCut.x + newCut.width > existingCut.x - COLLISION_MARGIN &&
            newCut.y < existingCut.y + existingCut.height + COLLISION_MARGIN &&
            newCut.y + newCut.height > existingCut.y - COLLISION_MARGIN
        ) {
            return true;
        }
    }
    return false;
}

// --- 초기화 함수 ---
function initializeCanvas() {
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    currentCameraPos = {
        x: centerX,
        y: centerY
    };
    canvas.style.transform = `translate(${-centerX + window.innerWidth / 2}px, ${-centerY + window.innerHeight / 2}px)`;


    resizeLineCanvas();
    window.addEventListener('resize', () => {
        resizeLineCanvas();
        drawLines();
    });

    // 비겹침 무작위 배치
    const userCutData = [];
    let attempts = 0;

    // <mark>*** 수정: 컷 배치 여백 설정 (경계 잘림 방지) ***</mark>
    const CANVAS_MARGIN = 200;
    const restrictedWidth = CANVAS_WIDTH - 2 * CANVAS_MARGIN;
    const restrictedHeight = CANVAS_HEIGHT - 2 * CANVAS_MARGIN;
    // <mark>*** 수정 끝 ***</mark>

    while (userCutData.length < NUM_USER_CUTS && attempts < 1000) {
        attempts++;
        const index = userCutData.length;
        const newCut = {
            id: `user-${index + 1}`,
            type: 'user',
            url: userImages[index],
            description: TEMP_DESCRIPTIONS[index],
            // <mark>*** 수정: 배치 위치 조정 ***</mark>
            x: CANVAS_MARGIN + Math.random() * (restrictedWidth - CUT_SIZE.width),
            y: CANVAS_MARGIN + Math.random() * (restrictedHeight - CUT_SIZE.height),
            // <mark>*** 수정 끝 ***</mark>
            width: CUT_SIZE.width, // 충돌 계산용
            height: CUT_SIZE.height // 충돌 계산용
        };

        if (!isOverlapping(newCut, userCutData)) {
            userCutData.push(newCut);
        }
    }
    allCuts = userCutData;

    renderCuts();
}

function renderCuts() {
    canvas.innerHTML = '';
    allCuts.forEach(cut => {
        const el = document.createElement('div');
        el.className = `cut-item`;
        el.id = cut.id;
        el.style.left = `${cut.x}px`;
        el.style.top = `${cut.y}px`;
        el.style.backgroundImage = `url(${cut.url})`;

        const descriptionEl = document.createElement('div');
        descriptionEl.classList.add('cut-description');
        descriptionEl.textContent = cut.description;
        el.appendChild(descriptionEl);


        // 클릭 이벤트 리스너 추가
        el.addEventListener('click', (e) => {
            if (isDragging) return;
            handleCutClick(cut, el);
            e.stopPropagation();
        });
        cut.element = el;

        canvas.appendChild(el);
    });
}

function resizeLineCanvas() {
    lineCanvas.width = window.innerWidth;
    lineCanvas.height = window.innerHeight;
}

// --- 선택 및 스토리 생성 로직 ---

function handleCutClick(cutData, el) {
    if (isStoryGenerated) return;

    const isAlreadySelected = selectedSequence.some(item => item.id === cutData.id);
    if (isAlreadySelected) {
        selectedSequence = selectedSequence.filter(item => item.id !== cutData.id);
        el.classList.remove('selected');
        if (selectedSequence.length < NUM_USER_CUTS) {
            // ... (스토리 버튼 비활성화 로직) ...
        }
    } else if (selectedSequence.length < NUM_USER_CUTS) {
        selectedSequence.push({
            id: cutData.id,
            imageNumber: parseInt(cutData.id.split('-')[1]),
            description: cutData.description,
            x: cutData.x + el.offsetWidth / 2,
            y: cutData.y + el.offsetHeight / 2,
        });
        el.classList.add('selected');
        if (selectedSequence.length === NUM_USER_CUTS) {
            // 선택이 완료되면 스토리 생성 실행
            generateStory();
        }
    }
    updateSelectionDisplay();
    drawLines();
}

// 연결선 그리기 (기존 로직 유지)
function drawLines() {
    lineCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (selectedSequence.length < 2) return;
    lineCtx.strokeStyle = 'rgba(135, 206, 250, 0.8)';
    lineCtx.lineWidth = 4;
    lineCtx.lineCap = 'butt';
    lineCtx.setLineDash([4, 12]);
    lineCtx.beginPath();
    let previousPoint = null;
    const translateX = -currentCameraPos.x + window.innerWidth / 2;
    const translateY = -currentCameraPos.y + window.innerHeight / 2;
    for (const cut of selectedSequence) {
        const finalX = cut.x + translateX;
        const finalY = cut.y + translateY;
        if (previousPoint) {
            lineCtx.moveTo(previousPoint.x, previousPoint.y);
            lineCtx.lineTo(finalX, finalY);
        }
        previousPoint = { x: finalX, y: finalY };
    }
    lineCtx.stroke();
    lineCtx.shadowBlur = 0;
    lineCtx.setLineDash([]);
    lineCtx.closePath();
}

// --- 스토리 생성 함수 ---
function generateStory() {
    isStoryGenerated = true;

    // 순서대로 정렬된 뒷설명 추출
    const descriptions = selectedSequence.map(item => item.description);
    const imageNumbers = selectedSequence.map(item => item.imageNumber);

    // AI API에 전달할 프롬프트
    const storyPrompt = `
    다음 설명들을 순서대로 연결하여 하나의 이어진 이야기를 창작해 주세요. 설명 순서: ${descriptions.join(' -> ')} 
    [작성 규칙]
1. 제목을 절대 붙이지 말고, 바로 본문부터 시작하세요.
2. **, #, - 같은 마크다운이나 특수문자를 사용하지 마세요.
3. 오직 '순수한 텍스트(Plain Text)'로만 작성하세요.
4. 문장은 부드럽게 이어지도록 하고, 문장과 문장 사이의 공백을 상상력으로 채워주세요.
5. 설명의 개수가 많아져도 그 사이 내용을 풍부하게 채워주세요. 단지 설명만 출력되게 하지 마세요.`;
    storyOutputDiv.innerHTML = `이야기를 생성 중입니다... 잠시만 기다려 주세요.`;
    storyPanel.classList.remove('hidden');

    callGeminiAPI(storyPrompt);
}

// Generate 버튼 클릭 처리: 선택 개수와 무관하게 스토리 생성
if (generateButton) {
    generateButton.addEventListener('click', () => {
        // 선택된 설명을 사용하거나, 선택이 없으면 모든 설명을 기본으로 사용
        if (selectedSequence.length === 0) {
            // 기본: 모든 컷 설명을 순서대로 사용
            selectedSequence = allCuts.map(cut => ({ id: cut.id, description: cut.description, imageNumber: parseInt(cut.id.split('-')[1]), x: cut.x, y: cut.y }));
        }
        generateStory();
    });
    // 터치 디바이스에서 터치로도 동작하도록 touchend 연결
    generateButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        generateButton.click();
    }, { passive: false });
}

function updateSelectionDisplay() {
    allCuts.forEach(cut => {
        const index = selectedSequence.findIndex(item => item.id === cut.id);
        if (index > -1) {
            cut.sequenceElement.textContent = index + 1;
        } else {
            cut.sequenceElement.textContent = '';
        }
    });
}

function toggleLineAnimation(shouldAnimate) {

    if (shouldAnimate && !isAnimatingLines) {
        isAnimatingLines = true;
        animateLines();

    } else if (!shouldAnimate && isAnimatingLines) {
        isAnimatingLines = false;
        cancelAnimationFrame(animationFrameId);
    }
}

// <mark>신규 함수: requestAnimationFrame을 사용하는 메인 애니메이션 루프</mark>
function animateLines() {
    if (!isDragging) {
        // 드래그가 멈추면 애니메이션 루프 중지
        toggleLineAnimation(false);
        return;
    }
    drawLines(); // 선을 그리는 함수 호출
    // 다음 프레임 요청
    animationFrameId = requestAnimationFrame(animateLines);

}



// --- 캔버스 드래그 핸들러 (수정) ---

document.addEventListener('mousedown', (e) => {
    isDragging = true;
    startPos.x = e.clientX;
    startPos.y = e.clientY;
    document.body.style.cursor = 'grabbing';
    toggleLineAnimation(true);
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;

    let newCameraX = currentCameraPos.x - dx;
    let newCameraY = currentCameraPos.y - dy;

    // <mark>*** 수정: 중복 및 충돌 로직 삭제, 단일 경계 로직 유지 ***</mark>
    const PADDING = 70;

    // 캔버스 중앙(centerX, centerY)이 뷰포트 중앙에 왔을 때를 기준으로 제한합니다.
    const maxCameraX = CANVAS_WIDTH - window.innerWidth / 2 + PADDING;
    const maxCameraY = CANVAS_HEIGHT - window.innerHeight / 2 + PADDING;
    const minCameraX = window.innerWidth / 2 - PADDING;
    const minCameraY = window.innerHeight / 2 - PADDING;

    // 캔버스 제한
    newCameraX = Math.max(minCameraX, Math.min(newCameraX, maxCameraX));
    newCameraY = Math.max(minCameraY, Math.min(newCameraY, maxCameraY));
    // <mark>*** 수정 끝 ***</mark>


    canvas.style.transform = `translate3d(${-newCameraX + window.innerWidth / 2}px, ${-newCameraY + window.innerHeight / 2}px, 0)`;
    currentCameraPos.x = newCameraX;
    currentCameraPos.y = newCameraY;
    startPos.x = e.clientX;
    startPos.y = e.clientY;

});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'grab';
        toggleLineAnimation(false);
        drawLines();
    }
});

document.addEventListener('mouseleave', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'grab';
    }
});


// --- 모바일 터치 이벤트 핸들러 (수정) ---

document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;

    const target = e.target;
    // allow touches on UI controls (buttons, panels) to pass through
    if (target && target.closest && (target.closest('#controls') || target.closest('button') || target.closest('#story-panel'))) {
        return;
    }

    // otherwise treat as canvas drag start and prevent default scrolling
    e.preventDefault();
    isTouchStart = true;
    touchMovedDistance = 0; // 이동 거리 초기화
    startPos.x = e.touches[0].clientX;
    startPos.y = e.touches[0].clientY;
    document.body.style.cursor = 'grabbing';
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (!isTouchStart || e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - startPos.x;
    const dy = e.touches[0].clientY - startPos.y;

    // <mark>*** 수정: 이동 거리 업데이트 (클릭/드래그 판단용) ***</mark>
    touchMovedDistance += Math.sqrt(dx * dx + dy * dy);
    // <mark>*** 수정 끝 ***</mark>

    let newCameraX = currentCameraPos.x - dx;
    let newCameraY = currentCameraPos.y - dy;

    // <mark>*** 수정: 경계 로직 단순화 (mousemove와 동일) ***</mark>
    const PADDING = 70;
    const maxCameraX = CANVAS_WIDTH - window.innerWidth / 2 + PADDING;
    const maxCameraY = CANVAS_HEIGHT - window.innerHeight / 2 + PADDING;
    const minCameraX = window.innerWidth / 2 - PADDING;
    const minCameraY = window.innerHeight / 2 - PADDING;

    newCameraX = Math.max(minCameraX, Math.min(newCameraX, maxCameraX));
    newCameraY = Math.max(minCameraY, Math.min(newCameraY, maxCameraY));
    // <mark>*** 수정 끝 ***</mark>


    canvas.style.transform = `translate3d(${-newCameraX + window.innerWidth / 2}px, ${-newCameraY + window.innerHeight / 2}px, 0)`;
    currentCameraPos.x = newCameraX;
    currentCameraPos.y = newCameraY;
    startPos.x = e.touches[0].clientX;
    startPos.y = e.touches[0].clientY;

}, { passive: false });

document.addEventListener('touchend', (e) => {
    // <mark>*** 수정: 터치 이동 거리로 클릭/드래그 구분 ***</mark>
    if (isTouchStart && touchMovedDistance < CLICK_TOLERANCE) {
        // 이동 거리가 매우 짧다면, 클릭(선택)으로 간주합니다.

        // 1. touchend가 발생한 위치를 확인
        // e.changedTouches[0]는 터치가 끝난 위치를 정확하게 제공합니다.
        const touchEndClientX = e.changedTouches[0].clientX;
        const touchEndClientY = e.changedTouches[0].clientY;

        // 2. 해당 지점의 요소를 찾아 클릭 핸들러를 호출합니다.
        const clickedEl = document.elementFromPoint(touchEndClientX, touchEndClientY);
        const cutItem = clickedEl ? clickedEl.closest('.cut-item') : null;

        if (cutItem) {
            // allCuts 배열에서 해당 ID를 가진 컷 데이터를 찾습니다.
            const cutData = allCuts.find(cut => cut.element === cutItem);
            if (cutData) {
                // handleCutClick을 직접 호출하여 컷 선택을 실행합니다.
                handleCutClick(cutData, cutItem);
            }
        }
    }

    if (isTouchStart) {
        isTouchStart = false;
        touchMovedDistance = 0;
        document.body.style.cursor = 'grab';
        drawLines();
    }
});

// 캔버스 초기화 실행
// --- AI 호출: Gemini (서버리스 함수 경유) ---
async function callGeminiAPI(prompt) {
    const API_ENDPOINT = '/api/generate';

    // 로컬 개발 모드에서는 모의 응답을 사용합니다.
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    function makeMockStory(promptText) {
        // 간단한 요약형 모의 스토리 생성
        const trimmed = promptText.replace(/.*설명 순서:\s*/i, '');
        const parts = trimmed.split('->').map(s => s.trim()).filter(Boolean);
        const head = parts.slice(0, 3).join(' → ');
        return `모의 스토리 (로컬): ${head}...\n\n(더 긴 스토리는 실제 API 배포 후 생성됩니다.)`;
    }

    if (isLocalhost) {
        // 모의 딜레이로 네트워크 감을 유지
        storyOutputDiv.textContent = '로컬 모드: 이야기를 생성 중입니다...';
        setTimeout(() => {
            storyOutputDiv.textContent = makeMockStory(prompt);
        }, 800);
        return;
    }

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            let errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                errorText = errorJson.details || errorJson.message || errorText;
            } catch (e) {
                // use raw text
            }
            console.warn('서버리스 함수 응답 오류:', errorText);

            // 키가 없거나 다른 서버측 문제일 경우 우회 모드로 모의 스토리를 보여줍니다.
            storyOutputDiv.textContent = makeMockStory(prompt);
            return;
        }

        const data = await response.json();
        const aiStory = data.story || data.result || data.text || (typeof data === 'string' ? data : JSON.stringify(data));
        storyOutputDiv.textContent = aiStory;
    } catch (error) {
        console.error('Gemini API 호출 중 오류 발생:', error);
        // 네트워크 오류가 발생하면 모의 스토리로 대체
        storyOutputDiv.textContent = makeMockStory(prompt);
    }
}

// 다시 읽기 버튼 이벤트
if (restartButton) {
    restartButton.addEventListener('click', () => {
        window.location.reload();
    });
}

// Intro animation: sine-wave dots falling to center
const introOverlay = document.getElementById('intro-overlay');
const introCanvas = document.getElementById('intro-canvas');
const introContent = document.getElementById('intro-content');

function runIntroAnimation() {
    if (!introCanvas) {
        initializeCanvas();
        return;
    }
    const ctx = introCanvas.getContext('2d');
    function resize() {
        introCanvas.width = window.innerWidth;
        introCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // prepare dots: denser grid but capped for performance
    const dots = [];
    const spacing = 14; // slightly larger spacing for a softer density
    const cols = Math.min(Math.ceil(window.innerWidth / spacing), 320);
    for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) * (window.innerWidth / cols);
        // slower drop than before for a calmer feel, and a gentle slower return
        dots.push({ x, y: -Math.random() * 240 - 10, dropSpeed: 10 + Math.random() * 6, returnSpeed: 2.5 + Math.random() * 1.8, state: 'dropping', passed: false, returned: false });
    }

    // ensure intro content hidden initially
    introContent.style.opacity = '0';
    introOverlay.style.opacity = '1';
    introOverlay.style.transition = 'opacity 450ms ease';

    let animationActive = true;
    let returnStarted = false;
    let titleShown = false;

    function draw() {
        if (!animationActive) return;
        ctx.clearRect(0, 0, introCanvas.width, introCanvas.height);
        const centerY = introCanvas.height / 2;

        let passedCount = 0;
        let returnedCount = 0;

        for (const d of dots) {
            if (d.state === 'dropping') {
                d.y += d.dropSpeed;
                if (d.y > centerY) d.passed = true;
                // clamp so dots don't linger far below
                if (d.y > introCanvas.height + 40) d.passed = true;
            } else if (d.state === 'returning') {
                d.y -= d.returnSpeed; // slower return
                if (d.y < -40) d.returned = true;
            }

            if (d.passed) passedCount++;
            if (d.returned) returnedCount++;

            // draw dot (no horizontal wobble)
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.arc(d.x, d.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // when majority passed center, start return of dots and reveal title immediately
        if (!returnStarted && passedCount > dots.length * 0.6) {
            returnStarted = true;
            titleShown = true;
            introContent.style.opacity = '1';
            // small stagger helps visual flow
            setTimeout(() => {
                for (const d of dots) d.state = 'returning';
            }, 80);
        }

        // when all dots have returned, finish intro (overlay fades after a short pause)
        if (returnStarted && returnedCount === dots.length) {
            // fade overlay after a short pause so title is visible
            setTimeout(() => {
                introOverlay.style.opacity = '0';
                setTimeout(() => {
                    animationActive = false;
                    introOverlay.classList.add('hidden');
                    window.removeEventListener('resize', resize);
                    initializeCanvas();
                }, 420);
            }, 220);
            return;
        }

        requestAnimationFrame(draw);
    }

    draw();

    function endIntro() {
        // immediate skip: stop animation and initialize app now
        if (!animationActive) return;
        animationActive = false;
        // reveal title immediately
        titleShown = true;
        introContent.style.opacity = '1';
        // hide overlay and start main canvas
        introOverlay.style.opacity = '0';
        setTimeout(() => {
            introOverlay.classList.add('hidden');
            window.removeEventListener('resize', resize);
            initializeCanvas();
        }, 120);
    }

    introOverlay.addEventListener('click', endIntro, { once: true });
    introOverlay.addEventListener('touchend', (e) => { e.preventDefault(); endIntro(); }, { once: true, passive: false });
}

// start intro on load
window.addEventListener('load', () => {
    runIntroAnimation();
});
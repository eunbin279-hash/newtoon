// --- 설정 변수 ---
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 3000;
const NUM_USER_CUTS = 10;
const MIN_DISTANCE = 150; // 겹침 방지를 위한 최소 거리 (px)
const COLLISION_MARGIN = 100; // 충돌 감지 마진
const CUT_SIZE = { width: 400, height: 250 };
const AI_API_KEY = "AIzaSyAp77-vFQwY91zhOlJ3xuv4Slwr20i_bwM";
const TEMP_DESCRIPTIONS = [
    "침대에 멍하니 누워 있다", "눈물이 흐른다", "쏴아아, 바다 소리가 들린다",
    "점점 물에 잠기고, 무언가가 톡 하고 건드린다", "눈을 뜨자 물 속이다", "몸을 일으키자 바다가 눈 앞에 있다",
    "바다가 손을 내밀고 나도 손을 내민다", "바다가 나를 안아준다", "침대 위에 누워 있다. 몸이 축축하다",
    "웅크린 채 바다 소리가 나를 둘러싼다"
];

const canvas = document.getElementById('infinite-canvas');
const lineCanvas = document.getElementById('line-canvas');
const lineCtx = lineCanvas.getContext('2d');
const storyPanel = document.getElementById('story-panel');
const storyOutputDiv = document.getElementById('story-output');
const restartButton = document.getElementById('restart-button');
const instructionDiv = document.getElementById('instruction');

// 이미지 경로 변경: 'img/cut_1.png' ~ 'img/cut_10.png'
const userImages = Array.from({ length: NUM_USER_CUTS }, (_, i) => `img/cut_${i + 1}.png`);

const centerX = CANVAS_WIDTH / 2;
const centerY = CANVAS_HEIGHT / 2;

let allCuts = [];
let currentCameraPos = { x: centerX, y: centerY };
let isDragging = false;
let startPos = { x: 0, y: 0 };
// { id: 'user-X', description: '뒷설명', x: 중심x, y: 중심y } 저장
let selectedSequence = [];
let isStoryGenerated = false;
let isAnimatingLines = false;
let animationFrameId = null;


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
    canvas.style.transform = `translate(${-centerX + window.innerWidth / 2}px, ${-centerY + window.innerHeight / 2}px)`;

    resizeLineCanvas();
    window.addEventListener('resize', () => {
        resizeLineCanvas();
        drawLines();
    });

    // 비겹침 무작위 배치
    const userCutData = [];
    let attempts = 0;
    while (userCutData.length < NUM_USER_CUTS && attempts < 1000) {
        attempts++;
        const index = userCutData.length;
        const newCut = {
            id: `user-${index + 1}`,
            type: 'user',
            url: userImages[index],
            description: TEMP_DESCRIPTIONS[index],
            x: Math.random() * (CANVAS_WIDTH - CUT_SIZE.width),
            y: Math.random() * (CANVAS_HEIGHT - CUT_SIZE.height),
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

        // 클릭 이벤트 리스너 추가
        el.addEventListener('click', (e) => {
            // 드래그 중에는 클릭 이벤트 무시
            if (isDragging) return;
            handleCutClick(cut, el);
            e.stopPropagation();
        });

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

    // 이미 선택된 컷은 다시 선택 불가
    const isAlreadySelected = selectedSequence.some(item => item.id === cutData.id);
    if (isAlreadySelected) return;

    // 어레이에 뒷설명이랑 이미지 번호 저장
    selectedSequence.push({
        id: cutData.id,
        // 이미지 번호는 ID에서 추출 (예: 'user-1' -> 1)
        imageNumber: parseInt(cutData.id.split('-')[1]),
        description: cutData.description,
        // 선 연결을 위해 컷 중심 좌표를 캔버스 절대좌표로 저장
        x: cutData.x + el.offsetWidth / 2,
        y: cutData.y + el.offsetHeight / 2,
    });

    // 선택 시 시각적 피드백
    el.classList.add('selected');

    // 선 연결선 그리기
    drawLines();

    // 10개 모두 선택 시 스토리 생성
    if (selectedSequence.length === NUM_USER_CUTS) {
        instructionDiv.classList.add('hidden'); // 안내 메시지 숨기기
        generateStory();
    }
}

// 연결선 그리기
function drawLines() {
    lineCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (selectedSequence.length < 2) return;

    lineCtx.strokeStyle = '#00ffff';
    lineCtx.lineWidth = 4;
    lineCtx.lineCap = 'round';
    lineCtx.shadowColor = '#00ffff';
    lineCtx.shadowBlur = 10;

    lineCtx.beginPath();

    let previousPoint = null;

    // 캔버스 이동(translate) 값을 계산
    const translateX = -currentCameraPos.x + window.innerWidth / 2;
    const translateY = -currentCameraPos.y + window.innerHeight / 2;

    for (const cut of selectedSequence) {
        // 캔버스 절대 좌표 + 캔버스 이동 값 = 뷰포트 상대 좌표
        const finalX = cut.x + translateX;
        const finalY = cut.y + translateY;

        if (previousPoint) {
            lineCtx.moveTo(previousPoint.x, previousPoint.y);
            lineCtx.lineTo(finalX, finalY);
        }

        previousPoint = { x: finalX, y: finalY };

        // 순서 표시
        lineCtx.fillStyle = 'white';
        lineCtx.font = 'bold 20px Arial';
        lineCtx.fillText(selectedSequence.indexOf(cut) + 1, finalX + 10, finalY - 10);
    }

    lineCtx.stroke();
    lineCtx.shadowBlur = 0;
    lineCtx.closePath();
}

// <mark>신규 함수: 애니메이션 루프를 시작/중지하는 컨트롤 함수</mark>
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




// AI 이야기 생성 및 출력
function generateStory() {
    isStoryGenerated = true;

    // 순서대로 정렬된 뒷설명 추출
    const descriptions = selectedSequence.map(item => item.description);
    const imageNumbers = selectedSequence.map(item => item.imageNumber);

    // AI API에 전달할 프롬프트
    const storyPrompt = `다음 설명들을 순서대로 연결하여 하나의 이어진 이야기를 창작해 주세요. 설명 순서: ${descriptions.join(' -> ')}`;
    storyOutputDiv.innerHTML = `이야기를 생성 중입니다... 잠시만 기다려 주세요.`;
    storyPanel.classList.remove('hidden');

    callGeminiAPI(storyPrompt);
}


async function callGeminiAPI(prompt) {
    const GEMINI_MODEL = 'gemini-2.5-flash'; // 빠르고 효율적인 모델 선택
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    temperature: 0.7 // 창의성 정도 (0.0: 보수적 ~ 1.0: 창의적)
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // AI 응답에서 텍스트 결과 추출
        const aiStory = data.candidates[0].content.parts[0].text;

        // 결과 화면에 출력
        storyOutputDiv.textContent = aiStory;

    } catch (error) {
        console.error("Gemini API 호출 중 오류 발생:", error);
        storyOutputDiv.textContent = `오류 발생: ${error.message}\nAPI 키, 네트워크 연결, 또는 요청 형식에 문제가 없는지 확인해 주세요.`;
    }
}




// 다시 읽기 버튼 이벤트
restartButton.addEventListener('click', () => {
    window.location.reload();
});


// --- 캔버스 드래그 핸들러 (기존 로직 유지) ---

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

    // 무한 순환 로직
    newCameraX = (newCameraX % CANVAS_WIDTH + CANVAS_WIDTH) % CANVAS_WIDTH;
    newCameraY = (newCameraY % CANVAS_HEIGHT + CANVAS_HEIGHT) % CANVAS_HEIGHT;

    canvas.style.transform = `translate3d(${-newCameraX + window.innerWidth / 2}px, ${-newCameraY + window.innerHeight / 2}px, 0)`;
    currentCameraPos.x = newCameraX;
    currentCameraPos.y = newCameraY;
    startPos.x = e.clientX;
    startPos.y = e.clientY;

    // 드래그 이동 시 연결선 위치도 업데이트
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

// 모바일 터치 이벤트 핸들러
document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        e.preventDefault();
        isDragging = true;
        startPos.x = e.touches[0].clientX;
        startPos.y = e.touches[0].clientY;
        document.body.style.cursor = 'grabbing';
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - startPos.x;
    const dy = e.touches[0].clientY - startPos.y;

    let newCameraX = currentCameraPos.x - dx;
    let newCameraY = currentCameraPos.y - dy;

    newCameraX = (newCameraX % CANVAS_WIDTH + CANVAS_WIDTH) % CANVAS_WIDTH;
    newCameraY = (newCameraY % CANVAS_HEIGHT + CANVAS_HEIGHT) % CANVAS_HEIGHT;

    canvas.style.transform = `translate3d(${-newCameraX + window.innerWidth / 2}px, ${-newCameraY + window.innerHeight / 2}px, 0)`;
    currentCameraPos.x = newCameraX;
    currentCameraPos.y = newCameraY;
    startPos.x = e.touches[0].clientX;
    startPos.y = e.touches[0].clientY;

});

document.addEventListener('touchend', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'grab';
        drawLines();
    }
});

// 캔버스 초기화 실행
window.onload = initializeCanvas;
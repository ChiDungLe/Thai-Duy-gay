// Lấy các phần tử Canvas và DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('high-score');
const gameOverDisplay = document.getElementById('game-over');
const recordHolderDisplay = document.getElementById('recordHolder');

// --- Cấu hình Game ---
let CAT_WIDTH = 0;
let CAT_HEIGHT = 0;
let CAT_CROUCH_HEIGHT = 0;

let GROUND_Y = 0;
const JUMP_VELOCITY = -28; // Lực nhảy cao
const GRAVITY = 0.8;
let OBSTACLE_SPEED = 7;
const RUN_ANIMATION_SPEED = 5;

// Cấu hình điểm và tốc độ
const FRAMES_PER_POINT = 12;

// Cấu hình khoảng thời gian tạo chướng ngại vật
const OBSTACLE_SPAWN_INTERVAL_SECONDS = 2;
const OBSTACLE_SPAWN_INTERVAL_FRAMES = OBSTACLE_SPAWN_INTERVAL_SECONDS * 60;

const SCORE_FOR_SPEED_INCREASE = 75;
const SPEED_INCREASE_AMOUNT = 1.5;
const MAX_OBSTACLE_SPEED = 25;

const GROUND_THICKNESS_PERCENT = 0.15;
let GROUND_THICKNESS = 0;

// Cấu hình độ khó chướng ngại vật
const DIFFICULTY_THRESHOLD_SCORE = 50;

// CÁC GIÁ TRỊ ĐÃ CHỈNH SỬA ĐỂ OBSTACLE3 TO HƠN MỘT TẸO VÀ CÓ ĐỘ CAO NGẪU NHIÊN HỢP LÝ
const FLYING_OBSTACLE_HEIGHT_FACTOR = 1.5; // TĂNG LÊN MỘT TẸO (từ 1.25 lên 1.5)
const FLYING_OBSTACLE_BASE_Y_PERCENT = 0.4; // Vị trí Y cơ bản: Hơi thấp hơn để có nhiều khoảng trống phía trên
const FLYING_OBSTACLE_Y_VARIATION_PERCENT = 0.2; // Giữ nguyên biến thể độ cao (20% chiều cao canvas)

// --- Biến Trạng thái Game ---
let cat = {
    x: 50,
    y: 0,
    width: CAT_WIDTH,
    height: CAT_HEIGHT, // Chiều cao khi đứng
    currentHeight: CAT_HEIGHT, // Chiều cao hiện tại (thay đổi khi cúi)
    velocityY: 0,
    isJumping: false,
    frameX: 0,
    isCrouching: false,
};

let obstacles = [];
let score = 0;
let highScore = 0;
let currentRecord = { name: "Chưa có", score: 0 };

let gameOver = false;
let gameFrame = 0;
let animationFrameId;
let firstInteractionDone = false;
let lastSpeedIncreaseScore = 0;

// --- Tải Tài nguyên (Hình ảnh & Âm thanh) ---
const assets = {};
const assetSources = {
    cat_run1: 'images/cat_run1.png',
    cat_run2: 'images/cat_run2.png',
    cat_jump: 'images/cat_jump.png',
    cat_crouch: 'images/cat_crouch_new.png',
    obstacle1: 'images/obstacle1.png',
    obstacle2: 'images/obstacle2.png',
    obstacle3: 'images/obstacle3.png',
    ground: 'images/ground.png',
    cloud: 'images/cloud.png',
    background_far: 'images/background_far.png',
    jump_sfx: 'audio/jump.mp3',
    hit_sfx: 'audio/hit.mp3',
    bg_music: 'audio/background_music.mp3'
};

let assetsLoadedCount = 0;
const totalAssets = Object.keys(assetSources).length;

function loadAssets() {
    for (const key in assetSources) {
        const src = assetSources[key];
        if (src.endsWith('.png') || src.endsWith('.jpg')) {
            assets[key] = new Image();
            assets[key].src = src;
            assets[key].onload = assetLoaded;
            assets[key].onerror = () => {
                console.error(`Lỗi tải hình ảnh: ${src}. Vui lòng kiểm tra lại đường dẫn và tên file.`);
                assetLoaded();
            };
        } else if (src.endsWith('.mp3') || src.endsWith('.wav')) {
            assets[key] = new Audio(src);
            assets[key].oncanplaythrough = assetLoaded;
            assets[key].onerror = () => {
                console.error(`Lỗi tải âm thanh: ${src}. Vui lòng kiểm tra lại đường dẫn và tên file.`);
                assetLoaded();
            };
            assets[key].load();
        }
    }
}

function assetLoaded() {
    assetsLoadedCount++;
    if (assetsLoadedCount === totalAssets) {
        console.log("Tất cả tài nguyên đã tải xong!");
        loadRecord();
        resizeCanvas();
        gameOverDisplay.textContent = "Nhấn Space/Chạm để Bắt đầu!";
        gameOverDisplay.style.display = 'block';
        cat.y = GROUND_Y - cat.currentHeight;
    }
}

function loadRecord() {
    const savedRecord = localStorage.getItem('dinoCatGameRecord');
    if (savedRecord) {
        currentRecord = JSON.parse(savedRecord);
        highScoreDisplay.textContent = `Điểm Cao: ${currentRecord.score}`;
        recordHolderDisplay.textContent = `Kỷ Lục: ${currentRecord.name} - ${currentRecord.score}`;
        recordHolderDisplay.style.display = 'block';
        highScore = currentRecord.score;
    } else {
        highScoreDisplay.textContent = `Điểm Cao: 0`;
        recordHolderDisplay.textContent = `Kỷ Lục: Chưa có`;
        recordHolderDisplay.style.display = 'block';
    }
}

function saveRecord(name, score) {
    currentRecord = { name: name, score: score };
    localStorage.setItem('dinoCatGameRecord', JSON.stringify(currentRecord));
    highScoreDisplay.textContent = `Điểm Cao: ${currentRecord.score}`;
    recordHolderDisplay.textContent = `Kỷ Lục: ${currentRecord.name} - ${currentRecord.score}`;
    recordHolderDisplay.style.display = 'block';
}

// --- Parallax Background ---
let groundX = 0;
let cloudX = canvas.width;
let backgroundFarX = 0;

// --- Hàm Vẽ ---
function drawCat() {
    let currentCatImage;
    if (cat.isCrouching && assets.cat_crouch && assets.cat_crouch.complete && assets.cat_crouch.naturalWidth !== 0) {
        currentCatImage = assets.cat_crouch;
    } else if (cat.isJumping) {
        currentCatImage = assets.cat_jump;
    } else {
        if (cat.frameX < RUN_ANIMATION_SPEED) {
            currentCatImage = assets.cat_run1;
        } else {
            currentCatImage = assets.cat_run2;
        }
        cat.frameX = (cat.frameX + 1) % (RUN_ANIMATION_SPEED * 2);
    }

    if (currentCatImage && currentCatImage.complete && currentCatImage.naturalWidth !== 0) {
        ctx.drawImage(currentCatImage, cat.x, cat.y, cat.width, cat.currentHeight);
    } else {
        ctx.fillStyle = cat.isCrouching ? 'darkgray' : 'gray';
        ctx.fillRect(cat.x, cat.y, cat.width, cat.currentHeight);
    }
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        if (obstacle.image && obstacle.image.complete && obstacle.image.naturalWidth !== 0) {
            ctx.drawImage(obstacle.image, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        } else {
            ctx.fillStyle = 'brown';
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
    });
}

function drawGround() {
    if (assets.ground && assets.ground.complete && assets.ground.naturalWidth !== 0) {
        ctx.drawImage(assets.ground, groundX, GROUND_Y, canvas.width, GROUND_THICKNESS);
        ctx.drawImage(assets.ground, groundX + canvas.width, GROUND_Y, canvas.width, GROUND_THICKNESS);
    } else {
        ctx.fillStyle = 'lightgray';
        ctx.fillRect(0, GROUND_Y, canvas.width, GROUND_THICKNESS);
    }
}

function drawClouds() {
    if (assets.cloud && assets.cloud.complete && assets.cloud.naturalWidth !== 0) {
        const cloudHeight = canvas.height / 7; // Mây bé đi một chút
        const cloudWidth = cloudHeight * (assets.cloud.naturalWidth / assets.cloud.naturalHeight);

        ctx.drawImage(assets.cloud, cloudX, canvas.height * 0.18, cloudWidth, cloudHeight);
        ctx.drawImage(assets.cloud, cloudX + canvas.width * 0.4, canvas.height * 0.23, cloudWidth * 0.9, cloudHeight * 0.9);
        ctx.drawImage(assets.cloud, cloudX + canvas.width * 0.8, canvas.height * 0.15, cloudWidth * 1.1, cloudHeight * 1.1);
    }
}

function drawBackgroundFar() {
    if (assets.background_far && assets.background_far.complete && assets.background_far.naturalWidth !== 0) {
        ctx.drawImage(assets.background_far, backgroundFarX, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.background_far, backgroundFarX + canvas.width, 0, canvas.width, canvas.height);
    }
    else {
        // Fallback if background_far is not loaded
        ctx.fillStyle = 'lightblue'; // Sky color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- Logic Game ---
function updateGame() {
    if (gameOver) return;

    backgroundFarX -= OBSTACLE_SPEED * 0.05;
    if (backgroundFarX <= -canvas.width) backgroundFarX = 0;
    cloudX -= OBSTACLE_SPEED * 0.2;
    if (cloudX <= -canvas.width) cloudX = canvas.width;
    groundX -= OBSTACLE_SPEED;
    if (groundX <= -canvas.width) groundX = 0;

    if (cat.isCrouching && !cat.isJumping) {
        if (cat.currentHeight !== CAT_CROUCH_HEIGHT) {
            cat.currentHeight = CAT_CROUCH_HEIGHT;
            cat.y = GROUND_Y - cat.currentHeight;
        }
    } else if (cat.currentHeight !== CAT_HEIGHT && !cat.isJumping) {
        cat.currentHeight = CAT_HEIGHT;
        cat.y = GROUND_Y - cat.currentHeight;
    }

    if (cat.isJumping) {
        cat.velocityY += GRAVITY;
        cat.y += cat.velocityY;
        if (cat.y >= GROUND_Y - cat.currentHeight) {
            cat.y = GROUND_Y - cat.currentHeight;
            cat.isJumping = false;
            cat.velocityY = 0;
        }
    }

    if (gameFrame % OBSTACLE_SPAWN_INTERVAL_FRAMES === 0 && gameFrame !== 0) {
        let type;
        let obstacleImage;
        let obstacleWidth, obstacleHeight;
        let obstacleY;

        let availableObstacles = ['obstacle1', 'obstacle2'];
        if (score >= DIFFICULTY_THRESHOLD_SCORE) {
            availableObstacles.push('obstacle3');
        }

        type = availableObstacles[Math.floor(Math.random() * availableObstacles.length)];
        obstacleImage = assets[type];

        if (type === 'obstacle3') {
            const enlargedFactor = 1.1; // TĂNG LÊN MỘT TẸO (từ 0.9 lên 1.1)
            if (obstacleImage && obstacleImage.complete && obstacleImage.naturalWidth !== 0) {
                const aspectRatio = obstacleImage.naturalWidth / obstacleImage.naturalHeight;
                obstacleHeight = CAT_CROUCH_HEIGHT * FLYING_OBSTACLE_HEIGHT_FACTOR * enlargedFactor;
                obstacleWidth = obstacleHeight * aspectRatio;

                // Tính toán phạm vi Y hợp lý cho chướng ngại vật bay
                const MIN_FLYING_OBSTACLE_Y = canvas.height * 0.2; // Không bay quá cao
                const MAX_FLYING_OBSTACLE_Y_CUM = GROUND_Y - obstacleHeight - (CAT_CROUCH_HEIGHT * 0.1); // Đảm bảo có khoảng trống để cúi qua
                
                // Tạo độ cao ngẫu nhiên trong phạm vi hợp lý
                obstacleY = Math.random() * (MAX_FLYING_OBSTACLE_Y_CUM - MIN_FLYING_OBSTACLE_Y) + MIN_FLYING_OBSTACLE_Y;
                
            } else {
                const aspectRatio = 1;
                obstacleHeight = CAT_CROUCH_HEIGHT * FLYING_OBSTACLE_HEIGHT_FACTOR * enlargedFactor;
                obstacleWidth = obstacleHeight * aspectRatio;

                const MIN_FLYING_OBSTACLE_Y = canvas.height * 0.2;
                const MAX_FLYING_OBSTACLE_Y_CUM = GROUND_Y - obstacleHeight - (CAT_CROUCH_HEIGHT * 0.1);
                
                obstacleY = Math.random() * (MAX_FLYING_OBSTACLE_Y_CUM - MIN_FLYING_OBSTACLE_Y) + MIN_FLYING_OBSTACLE_Y;
                
                console.warn(`Fallback: Sử dụng hình chữ nhật cho chướng ngại vật ${type} do ảnh lỗi.`);
            }
        } else {
            const minObstacleHeight = canvas.height / 12; // Chướng ngại vật mặt đất bé hơn
            const maxObstacleHeight = canvas.height / 8; // Chướng ngại vật mặt đất bé hơn

            obstacleHeight = Math.random() * (maxObstacleHeight - minObstacleHeight) + minObstacleHeight;
            if (obstacleImage && obstacleImage.complete && obstacleImage.naturalWidth !== 0) {
                const aspectRatio = obstacleImage.naturalWidth / obstacleImage.naturalHeight;
                obstacleWidth = obstacleHeight * aspectRatio;
            } else {
                obstacleWidth = obstacleHeight * (type === 'obstacle1' ? (30/50) : (40/60));
                console.warn(`Fallback: Sử dụng hình chữ nhật cho chướng ngại vật ${type} do ảnh lỗi.`);
            }
            obstacleY = GROUND_Y - obstacleHeight;
        }

        obstacles.push({
            x: canvas.width,
            y: obstacleY,
            width: obstacleWidth,
            height: obstacleHeight,
            image: obstacleImage
        });
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        if (!obstacles[i]) {
            console.warn(`Phần tử obstacle[${i}] bị undefined, bỏ qua.`);
            obstacles.splice(i, 1);
            continue;
        }

        obstacles[i].x -= OBSTACLE_SPEED;

        // Kiểm tra va chạm (bounding box collision)
        if (
            cat.x < obstacles[i].x + obstacles[i].width &&
            cat.x + cat.width > obstacles[i].x &&
            cat.y < obstacles[i].y + obstacles[i].height &&
            cat.y + cat.currentHeight > obstacles[i].y
        ) {
            endGame();
            return;
        }

        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
        }
    }

    if (gameFrame % FRAMES_PER_POINT === 0 && gameFrame !== 0) {
        score++;
        scoreDisplay.textContent = `Điểm: ${score}`;

        if (score > highScore) {
            highScore = score;
            highScoreDisplay.textContent = `Điểm Cao: ${highScore}`;
        }
    }

    if (score >= (lastSpeedIncreaseScore + SCORE_FOR_SPEED_INCREASE) && OBSTACLE_SPEED < MAX_OBSTACLE_SPEED) {
        OBSTACLE_SPEED += SPEED_INCREASE_AMOUNT;
        lastSpeedIncreaseScore = Math.floor(score / SCORE_FOR_SPEED_INCREASE) * SCORE_FOR_SPEED_INCREASE;
        console.log("Tốc độ game tăng lên: " + OBSTACLE_SPEED.toFixed(1) + ", Điểm: " + score);
    }
    if (OBSTACLE_SPEED > MAX_OBSTACLE_SPEED) {
        OBSTACLE_SPEED = MAX_OBSTACLE_SPEED;
    }

    gameFrame++;
}

// --- Vòng lặp Game ---
function gameLoop() {
    clearCanvas();

    drawBackgroundFar();
    drawClouds();
    drawGround();

    drawObstacles();
    drawCat();
    updateGame();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Điều khiển Mèo ---
function jump() {
    if (!cat.isJumping && !gameOver && !cat.isCrouching) {
        cat.isJumping = true;
        cat.velocityY = JUMP_VELOCITY;
        if (assets.jump_sfx && firstInteractionDone) {
            // ĐIỀU CHỈNH ÂM LƯỢNG TIẾNG NHẢY TẠI ĐÂY
            // Dòng này đã được thêm vào và bạn sẽ thấy nó ở dòng 351 trong file script.js này.
            assets.jump_sfx.volume = 0.08; // Đặt âm lượng là 50%. Bạn có thể thay đổi giá trị này (từ 0.0 đến 1.0).
            assets.jump_sfx.currentTime = 0;
            assets.jump_sfx.play().catch(e => console.log("Lỗi phát âm thanh nhảy:", e));
        }
    }
}

function crouch() {
    if (!cat.isCrouching && !gameOver && !cat.isJumping) {
        cat.isCrouching = true;
        cat.y = GROUND_Y - CAT_CROUCH_HEIGHT;
    }
}

function standUp() {
    if (cat.isCrouching) {
        cat.isCrouching = false;
        cat.y = GROUND_Y - CAT_HEIGHT;
    }
}

// --- Quản lý kích thước Canvas (Responsive) ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // ĐIỀU CHỈNH KÍCH THƯỚC NHÂN VẬT BÉ ĐI
    CAT_HEIGHT = canvas.height / 7; // Mèo nhỏ hơn
    CAT_WIDTH = CAT_HEIGHT * (60/60); // Giữ tỷ lệ khung hình

    CAT_CROUCH_HEIGHT = CAT_HEIGHT / 2.5; // Khi cúi cũng bé hơn

    cat.width = CAT_WIDTH;
    cat.height = CAT_HEIGHT;
    cat.currentHeight = cat.isCrouching ? CAT_CROUCH_HEIGHT : CAT_HEIGHT;

    GROUND_THICKNESS = canvas.height * GROUND_THICKNESS_PERCENT;
    GROUND_Y = canvas.height - GROUND_THICKNESS;

    if (gameOver || !firstInteractionDone) {
        cat.y = GROUND_Y - cat.currentHeight;
    }
}

window.addEventListener('resize', resizeCanvas);

// --- Khởi động và Kết thúc Game ---
function startGame() {
    if (!firstInteractionDone) {
        firstInteractionDone = true;
    }

    cat.isCrouching = false;
    cat.height = CAT_HEIGHT;
    cat.currentHeight = CAT_HEIGHT;
    cat.y = GROUND_Y - cat.currentHeight;
    cat.isJumping = false;
    cat.velocityY = 0;
    cat.frameX = 0;
    obstacles = [];
    score = 0;
    gameOver = false;
    gameFrame = 0;
    OBSTACLE_SPEED = 7;
    lastSpeedIncreaseScore = 0;
    scoreDisplay.textContent = `Điểm: 0`;
    gameOverDisplay.style.display = 'none';

    if (assets.bg_music && firstInteractionDone) {
        assets.bg_music.loop = true;
        assets.bg_music.volume = 0.3;
        assets.bg_music.play().catch(e => console.log("Lỗi phát nhạc nền:", e));
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    gameLoop();
}

function endGame() {
    gameOver = true;
    gameOverDisplay.style.display = 'block';
    cancelAnimationFrame(animationFrameId);

    if (assets.hit_sfx && firstInteractionDone) {
        assets.hit_sfx.currentTime = 0;
        assets.hit_sfx.play().catch(e => console.log("Lỗi phát âm thanh va chạm:", e));
    }
    if (assets.bg_music) {
        assets.bg_music.pause();
    }

    if (score > currentRecord.score) {
        let playerName = prompt(`Bạn đã lập kỷ lục mới với ${score} điểm! Nhập tên của bạn để lưu kỷ lục:`);
        if (playerName === null || playerName.trim() === "") {
            playerName = "Người chơi ẩn danh";
        }
        saveRecord(playerName, score);
        gameOverDisplay.textContent = `KỶ LỤC MỚI! ${playerName} - ${score} điểm!\nNhấn PHÍM CÁCH hoặc CHẠM để chơi lại.`;
    } else {
        gameOverDisplay.textContent = "GAME OVER!\nNhấn PHÍM CÁCH hoặc CHẠM để chơi lại.";
    }
}

// --- Xử lý sự kiện ---
document.addEventListener('keydown', (e) => {
    if (gameOver && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault();
        startGame();
        return;
    }

    if (assetsLoadedCount === totalAssets && !firstInteractionDone && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault();
        startGame();
        return;
    }

    if (!gameOver) {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            jump();
        } else if (e.code === 'ArrowDown') {
            e.preventDefault();
            crouch();
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (!gameOver) {
        if (e.code === 'ArrowDown') {
            e.preventDefault();
            standUp();
        }
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameOver || (assetsLoadedCount === totalAssets && !firstInteractionDone)) {
        startGame();
    } else {
        const touchY = e.touches[0].clientY;
        if (touchY < canvas.height / 2) {
            jump();
        } else {
            crouch();
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    if (!gameOver && cat.isCrouching) {
        standUp();
    }
});

gameOverDisplay.addEventListener('click', () => {
    if (gameOver) {
        startGame();
    } else if (assetsLoadedCount === totalAssets && !firstInteractionDone) {
        startGame();
    }
});

loadAssets();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

let width, height;
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// Assets
const IMAGES = {
    bg: new Image(),
    head: new Image(),
    body: new Image(),
    mine: new Image(),
    star: new Image()
};
IMAGES.bg.src = 'assets/space3.png';
IMAGES.head.src = 'assets/orb-red.png';
IMAGES.body.src = 'assets/orb-blue.png';
IMAGES.mine.src = 'assets/mine.png';
IMAGES.star.src = 'assets/star.png';

const AUDIO = {
    lazer: new Audio('assets/lazer.wav'),
    ping: new Audio('assets/p-ping.mp3')
};
AUDIO.lazer.volume = 0.3;
AUDIO.ping.volume = 0.5;

// Game State
let gameState = 'START'; // START, PLAYING, SHOP, GAMEOVER
let score = 0;
let mouse = { x: width / 2, y: height / 2 };
let lastTime = 0;

// Upgrades system
let upgrades = {
    value: { level: 0, cost: 50, costMult: 1.5 },
    speed: { level: 0, cost: 100, costMult: 1.8 },
    health: { level: 0, cost: 250, costMult: 2.5 },
    armor: { level: 0, cost: 250, costMult: 2.2 }
};

let starValue = 10;
let maxHealth = 1;
let health = 1;
let invulnTime = 0; // if > time, snake is flashing/invulnerable
let armorPercent = 0; // % of tail that is armored

// Entities
let snake = [];
let stars = [];
let enemies = [];
let lasers = [];

let SNAKE_SPEED = 0.15;
const HEAD_RADIUS = 15;
const BODY_RADIUS = 12;
const ENEMY_RADIUS = 20;
const STAR_RADIUS = 15;
const LASER_RADIUS = 5;

const shopOverlay = document.getElementById('shop');
const healthEl = document.getElementById('health');

function toggleShop() {
    if (gameState === 'GAMEOVER') {
        gameState = 'SHOP';
        document.getElementById('overlay').classList.add('hidden');
        shopOverlay.classList.remove('hidden');
        updateShopUI();
    } else if (gameState === 'SHOP') {
        shopOverlay.classList.add('hidden');
        initGame();
    }
}

function buyUpgrade(type) {
    let upg = upgrades[type];
    if (score >= upg.cost) {
        score -= upg.cost;
        upg.level++;
        upg.cost = Math.floor(upg.cost * upg.costMult);
        
        // Apply effects
        if (type === 'value') starValue += 5;
        if (type === 'speed') SNAKE_SPEED += 0.05;
        if (type === 'health') { maxHealth++; health = maxHealth; healthEl.innerText = health; }
        if (type === 'armor') armorPercent = Math.min(1.0, armorPercent + 0.1); // +10% each level
        
        scoreEl.innerText = score;
        updateShopUI();
    }
}

function updateShopUI() {
    for (let type in upgrades) {
        let upg = upgrades[type];
        document.getElementById('lvl-' + type).innerText = upg.level;
        document.getElementById('cost-' + type).innerText = upg.cost;
        document.getElementById('btn-' + type).disabled = score < upg.cost;
    }
}

window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
        if (gameState === 'GAMEOVER' || gameState === 'SHOP') {
            toggleShop();
        }
    }
});

window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

startBtn.onclick = () => {
    initGame();
    document.getElementById('overlay').classList.add('hidden');
};

function initGame() {
    snake = [];
    let startLen = Math.max(3, 3 + Math.floor(score / 10));
    for(let i=0; i<startLen; i++) {
        snake.push({ x: width/2, y: height/2 });
    }
    stars = [];
    enemies = [];
    lasers = [];
    scoreEl.innerText = score;
    health = maxHealth;
    healthEl.innerText = health;
    gameState = 'PLAYING';
    spawnStar();
    spawnEnemy(); // Instant action
    spawnEnemy();
    lastTime = performance.now();
}

function spawnStar() {
    stars.push({
        x: Math.random() * (width - 100) + 50,
        y: Math.random() * (height - 100) + 50
    });
}

function spawnEnemy() {
    let edge = Math.floor(Math.random() * 4);
    let ex, ey, vx, vy;
    
    // Determine type based on score
    let type = 'mine';
    let rand = Math.random();
    if (score > 600) {
        if (rand < 0.2) type = 'sniper';
        else if (rand < 0.35) type = 'juggernaut';
        else if (rand < 0.55) type = 'burst';
        else if (rand < 0.8) type = 'hunter';
    } else if (score > 400) {
        if (rand < 0.15) type = 'juggernaut';
        else if (rand < 0.4) type = 'burst';
        else if (rand < 0.7) type = 'hunter';
    } else if (score > 200) {
        if (rand < 0.3) type = 'burst';
        else if (rand < 0.6) type = 'hunter';
    } else if (score > 50) {
        if (rand < 0.4) type = 'hunter';
    }
    
    let speed = 1;
    if (type === 'hunter') speed = Math.random() * 2 + 2;
    if (type === 'burst') speed = 0.5;
    if (type === 'juggernaut') speed = 0.2;
    if (type === 'sniper') speed = 0.3;
    if (type === 'mine') speed = Math.random() * 2 + 1;
    
    let r = ENEMY_RADIUS;
    if (type === 'juggernaut') r = 60;
    if (type === 'sniper') r = 15;
    
    if (edge === 0) { // Top
        ex = Math.random() * width; ey = -100;
        vx = (Math.random() - 0.5) * 2; vy = speed;
    } else if (edge === 1) { // Right
        ex = width + 100; ey = Math.random() * height;
        vx = -speed; vy = (Math.random() - 0.5) * 2;
    } else if (edge === 2) { // Bottom
        ex = Math.random() * width; ey = height + 100;
        vx = (Math.random() - 0.5) * 2; vy = -speed;
    } else { // Left
        ex = -100; ey = Math.random() * height;
        vx = speed; vy = (Math.random() - 0.5) * 2;
    }
    
    enemies.push({ 
        x: ex, y: ey, 
        vx: vx, vy: vy, 
        type: type,
        r: r,
        nextShoot: performance.now() + Math.random()*2000 + 1000 
    });
}

function circleIntersect(x1, y1, r1, x2, y2, r2) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let dist = Math.sqrt(dx*dx + dy*dy);
    return dist < (r1 + r2);
}

function update(dt) {
    // Snake movement
    let head = snake[0];
    head.x += (mouse.x - head.x) * SNAKE_SPEED;
    head.y += (mouse.y - head.y) * SNAKE_SPEED;
    
    for (let i = 1; i < snake.length; i++) {
        let prev = snake[i-1];
        let curr = snake[i];
        
        // Always lerp to the exact position of the segment in front of you
        curr.x += (prev.x - curr.x) * 0.4;
        curr.y += (prev.y - curr.y) * 0.4;
    }

    // Adjust length based on score
    let targetLength = Math.max(3, 3 + Math.floor(score / 10));
    while (snake.length < targetLength) {
        snake.push({x: snake[snake.length-1].x, y: snake[snake.length-1].y});
    }
    while (snake.length > targetLength) {
        snake.pop();
    }

    // Stars
    for (let i = stars.length - 1; i >= 0; i--) {
        let s = stars[i];
        if (circleIntersect(head.x, head.y, HEAD_RADIUS, s.x, s.y, STAR_RADIUS)) {
            stars.splice(i, 1);
            score += starValue;
            scoreEl.innerText = score;
            AUDIO.ping.currentTime = 0;
            AUDIO.ping.play().catch(()=>{});
            spawnStar();
        }
    }

    // Enemy Spawning (Scales up slowly)
    let spawnRate = Math.min(0.01 + (score * 0.00005), 0.04);
    if (Math.random() < spawnRate) {
        spawnEnemy();
    }
    
    let time = performance.now();
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        if (e.type === 'hunter') {
            // Track player
            let dx = head.x - e.x;
            let dy = head.y - e.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
                e.vx += (dx/dist) * 0.05;
                e.vy += (dy/dist) * 0.05;
                
                // Limit speed
                let speed = Math.sqrt(e.vx*e.vx + e.vy*e.vy);
                if (speed > 3) {
                    e.vx = (e.vx/speed) * 3;
                    e.vy = (e.vy/speed) * 3;
                }
            }
        }
        
        e.x += e.vx;
        e.y += e.vy;
        
        // Shoot
        if (time > e.nextShoot && e.type !== 'hunter' && e.x > -e.r && e.x < width + e.r && e.y > -e.r && e.y < height + e.r) {
            let dx = head.x - e.x;
            let dy = head.y - e.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            
            if (e.type === 'burst') {
                for (let k = -1; k <= 1; k++) {
                    let angle = Math.atan2(dy, dx) + (k * 0.2);
                    lasers.push({
                        x: e.x, y: e.y,
                        vx: Math.cos(angle) * 5,
                        vy: Math.sin(angle) * 5
                    });
                }
                e.nextShoot = time + Math.random() * 3000 + 2000;
            } else if (e.type === 'sniper') {
                lasers.push({
                    x: e.x, y: e.y,
                    vx: (dx/dist) * 15, // Extremely fast
                    vy: (dy/dist) * 15
                });
                e.nextShoot = time + Math.random() * 2000 + 3000;
            } else if (e.type === 'juggernaut') {
                for (let k = 0; k < 8; k++) {
                    let angle = (k / 8) * Math.PI * 2;
                    lasers.push({
                        x: e.x, y: e.y,
                        vx: Math.cos(angle) * 4,
                        vy: Math.sin(angle) * 4
                    });
                }
                e.nextShoot = time + 2000;
            } else { // Mine
                lasers.push({
                    x: e.x, y: e.y,
                    vx: (dx/dist) * 5,
                    vy: (dy/dist) * 5
                });
                e.nextShoot = time + Math.random() * 3000 + 1500;
            }
            
            AUDIO.lazer.currentTime = 0;
            AUDIO.lazer.play().catch(()=>{});
        }
        
        // Out of bounds cleanup
        if (e.x < -150 || e.x > width + 150 || e.y < -150 || e.y > height + 150) {
            enemies.splice(i, 1);
            continue;
        }
        
        // Collision with snake
        if (time > invulnTime) {
            for (let j = 0; j < snake.length; j++) {
                let r = j === 0 ? HEAD_RADIUS : BODY_RADIUS;
                let isArmored = j >= snake.length - Math.floor(snake.length * armorPercent) && j !== 0; // head is never armored
                if (circleIntersect(e.x, e.y, e.r, snake[j].x, snake[j].y, r)) {
                    if (isArmored) {
                        enemies.splice(i, 1);
                        score += 5; // bonus points for destroying enemy
                        scoreEl.innerText = score;
                        break;
                    } else {
                        takeDamage(time);
                        break;
                    }
                }
            }
        }
    }

    // Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        let l = lasers[i];
        l.x += l.vx;
        l.y += l.vy;
        
        if (l.x < -50 || l.x > width + 50 || l.y < -50 || l.y > height + 50) {
            lasers.splice(i, 1);
            continue;
        }
        
        // Collision with snake
        if (time > invulnTime) {
            for (let j = 0; j < snake.length; j++) {
                let r = j === 0 ? HEAD_RADIUS : BODY_RADIUS;
                let isArmored = j >= snake.length - Math.floor(snake.length * armorPercent) && j !== 0;
                if (circleIntersect(l.x, l.y, LASER_RADIUS, snake[j].x, snake[j].y, r)) {
                    if (isArmored) {
                        lasers.splice(i, 1);
                        break;
                    } else {
                        takeDamage(time);
                        lasers.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }
}

function takeDamage(time) {
    if (health > 1) {
        health--;
        healthEl.innerText = health;
        invulnTime = time + 2000; // 2 seconds of invulnerability
        
        // Lose score (which loses length automatically next frame)
        score = Math.max(0, score - 50); 
        scoreEl.innerText = score;
    } else {
        health = 0;
        healthEl.innerText = health;
        gameOver();
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    document.getElementById('overlay').querySelector('h1').innerText = "GAME OVER";
    document.getElementById('overlay').querySelector('p').innerText = `Accumulated Stars: ${score}`;
    startBtn.innerText = "OPEN SHOP";
    startBtn.onclick = toggleShop;
    document.getElementById('overlay').classList.remove('hidden');
}

function draw() {
    // Draw Background tiled
    if (IMAGES.bg.complete && IMAGES.bg.naturalWidth > 0) {
        let ptrn = ctx.createPattern(IMAGES.bg, 'repeat');
        ctx.fillStyle = ptrn;
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
    }

    // Draw Lasers
    ctx.fillStyle = '#ff0044';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0044';
    for (let l of lasers) {
        ctx.beginPath();
        ctx.arc(l.x, l.y, LASER_RADIUS, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw Stars
    if (IMAGES.star.complete) {
        for (let s of stars) {
            ctx.drawImage(IMAGES.star, s.x - STAR_RADIUS, s.y - STAR_RADIUS, STAR_RADIUS*2, STAR_RADIUS*2);
        }
    }

    // Draw Enemies
    for (let e of enemies) {
        if (e.type === 'mine') {
            if (IMAGES.mine.complete) {
                ctx.drawImage(IMAGES.mine, e.x - e.r, e.y - e.r, e.r*2, e.r*2);
            } else {
                ctx.fillStyle = '#888';
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
                ctx.fill();
            }
        } else if (e.type === 'hunter') {
            ctx.fillStyle = '#ff3300';
            ctx.beginPath();
            ctx.moveTo(e.x, e.y - e.r);
            ctx.lineTo(e.x - e.r, e.y + e.r);
            ctx.lineTo(e.x + e.r, e.y + e.r);
            ctx.fill();
        } else if (e.type === 'burst') {
            ctx.fillStyle = '#9900ff';
            ctx.beginPath();
            for(let k = 0; k < 6; k++) {
                let angle = (k / 6) * Math.PI * 2;
                let hx = e.x + Math.cos(angle) * e.r;
                let hy = e.y + Math.sin(angle) * e.r;
                if (k === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.fill();
        } else if (e.type === 'juggernaut') {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#000'; // Inner hole
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.r * 0.4, 0, Math.PI*2);
            ctx.fill();
        } else if (e.type === 'sniper') {
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.moveTo(e.x, e.y - e.r);
            ctx.lineTo(e.x + e.r, e.y);
            ctx.lineTo(e.x, e.y + e.r);
            ctx.lineTo(e.x - e.r, e.y);
            ctx.fill();
        }
    }

    // Draw Snake (Body then Head)
    let now = performance.now();
    if (now > invulnTime || Math.floor(now / 150) % 2 === 0) {
        if (IMAGES.body.complete) {
            for (let i = snake.length - 1; i > 0; i--) {
                let s = snake[i];
                ctx.drawImage(IMAGES.body, s.x - BODY_RADIUS, s.y - BODY_RADIUS, BODY_RADIUS*2, BODY_RADIUS*2);
                
                let isArmored = i >= snake.length - Math.floor(snake.length * armorPercent);
                if (isArmored) {
                    ctx.strokeStyle = '#ffff00';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, BODY_RADIUS + 2, 0, Math.PI*2);
                    ctx.stroke();
                }
            }
        }
        
        if (IMAGES.head.complete && snake.length > 0) {
            let h = snake[0];
            ctx.drawImage(IMAGES.head, h.x - HEAD_RADIUS, h.y - HEAD_RADIUS, HEAD_RADIUS*2, HEAD_RADIUS*2);
        }
    }
}

function gameLoop(time) {
    let dt = time - lastTime;
    lastTime = time;

    if (gameState === 'PLAYING') {
        update(dt);
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

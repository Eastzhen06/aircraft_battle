import GestureEngine from './engine/gesture.js';
import Player, { PLANE_TYPES } from './entities/player.js';
import Bullet from './entities/bullet.js';
import Enemy from './entities/enemy.js';
import ImageLoader, { ASSET_SOURCES } from './utils/imageLoader.js';
import SkillSystem from './systems/skillSystem.js';
import LevelSystem from './systems/level.js';
import ObjectPool from './utils/objectPool.js';
import Wingman from './entities/wingman.js';

// ==========================================
// 【v4.5 修改部分】：代码音频合成器基建 (AudioController)
// ==========================================
class AudioController {
    constructor() {
        this.sfxEnabled = true;
        this.bgmEnabled = true;
        
        // 背景音乐加载
        this.bgm = new Audio('./audio/bgm_space.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.5;
        this.audioCtx = null;
    }

    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        if (this.bgmEnabled) this.bgm.play().catch(e => console.log('BGM Autoplay blocked.', e));
    }

    setBGM(enabled) {
        this.bgmEnabled = enabled;
        if (enabled && this.audioCtx) this.bgm.play().catch(e=>e);
        else this.bgm.pause();
    }

    setSFX(enabled) {
        this.sfxEnabled = enabled;
    }

    // 纯代码模拟科幻连发等离子音效，短促、复古且完全无损高频并发
    playShootSound() {
        if (!this.sfxEnabled || !this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // 使用三角波（Triangle）产生比方波更柔和、清脆的质感
        osc.type = 'triangle'; 
        // 频率指数滑降，形成经典 "啾" 声
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.1);

        // 音量急剧衰减，防止爆音
        gain.gain.setValueAtTime(0.15, t); 
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
    }
}

// ==========================================
// 【v4.5 修改部分】：多端解耦与鼠标逻辑强化
// ==========================================
class UnifiedInputSystem {
    constructor() {
        this.mode = 'gesture'; 
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight * 0.8;
        this.keys = {};
        
        this.clickCount = 0;
        this.clickTimer = null;
        this.activeTempGesture = null;
        this.mouseMovedRecently = false;
        this.mouseMoveTimer = null;

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        const canvas = document.getElementById('gameCanvas');
        
        // 统一处理触控与鼠标的光标移动
        const handleMove = (e) => {
            if (this.mode === 'touch') {
                this.x = e.clientX || (e.touches && e.touches[0].clientX); 
                this.y = e.clientY || (e.touches && e.touches[0].clientY);
                this.mouseMovedRecently = true;
                if (this.mouseMoveTimer) clearTimeout(this.mouseMoveTimer);
                this.mouseMoveTimer = setTimeout(() => this.mouseMovedRecently = false, 150);
            }
        };
        canvas.addEventListener('mousemove', handleMove);
        canvas.addEventListener('touchmove', handleMove);

        // 统一处理多击事件 (Double & Triple clicks)
        const handleDown = (e) => {
            if (this.mode === 'touch') {
                this.clickCount++;
                if (this.clickTimer) clearTimeout(this.clickTimer);
                this.clickTimer = setTimeout(() => {
                    if (this.clickCount === 2) this.triggerTempGesture('FIST');
                    else if (this.clickCount >= 3) this.triggerTempGesture('RECOIL');
                    this.clickCount = 0;
                }, 300);
            }
        };
        canvas.addEventListener('mousedown', handleDown);
        canvas.addEventListener('touchstart', handleDown, { passive: false });
    }

    triggerTempGesture(g) {
        this.activeTempGesture = g;
        setTimeout(() => this.activeTempGesture = null, 250); 
    }

    getInput(gestureEngine) {
        if (this.mode === 'gesture') {
            return gestureEngine.getInputState(); 
        } 
        else if (this.mode === 'keyboard') {
            let gesture = 'IDLE';
            if (this.keys['ArrowLeft']) this.x -= 12;
            if (this.keys['ArrowRight']) this.x += 12;
            if (this.keys['ArrowUp']) this.y -= 12;
            if (this.keys['ArrowDown']) this.y += 12;

            // 【v4.5 修改部分】：解绑 Alt，重绑 Space + X
            if (this.keys['Space'] && this.keys['KeyX']) gesture = 'RECOIL';
            else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) gesture = 'FIST';
            else if (this.keys['Space']) gesture = 'GUN';
            return { isDetected: true, x: this.x, y: this.y, gesture: gesture };
        } 
        else if (this.mode === 'touch') {
            let gesture = 'IDLE';
            if (this.activeTempGesture) {
                gesture = this.activeTempGesture;
            } else if (this.mouseMovedRecently) {
                gesture = 'GUN'; // 移动即持续射击
            }
            return { isDetected: true, x: this.x, y: this.y, gesture: gesture };
        }
    }
}

const CAMPAIGN_LEVELS = [
    { level: 1, name: '新手训练', desc: '纯小怪热身' },
    { level: 2, name: '侦察者', desc: 'Boss: 侦察者' },
    { level: 3, name: '突击者', desc: 'Boss: 突击者' },
    { level: 4, name: '堡垒', desc: 'Boss: 堡垒' },
    { level: 5, name: '暗影', desc: 'Boss: 暗影' },
    { level: 6, name: '风暴', desc: 'Boss: 风暴' },
    { level: 7, name: '漩涡', desc: 'Boss: 漩涡' },
    { level: 8, name: '审判者', desc: 'Boss: 审判者' },
    { level: 9, name: '末日', desc: 'Boss: 末日' },
    { level: 10, name: '帝王', desc: '最终战: 帝王' }
];

class Powerup {
    constructor() {
        this.active = false; this.x = 0; this.y = 0;
        this.width = 40; this.height = 40;
        this.type = 'HEALTH'; this.speed = 100;
        this.angle = 0; this.pulsePhase = 0;
    }
    spawn(x, y) {
        this.active = true; this.x = x; this.y = y; this.isMagnetized = false; 
        const r = Math.random();
        if (r < 0.33) this.type = 'HEALTH'; else if (r < 0.66) this.type = 'POWER'; else this.type = 'SHIELD';
    }
    update(deltaTime, canvasHeight, player) {
        if (!this.active) return;
        if (this.isMagnetized && player) {
            const dx = player.x - this.x; const dy = player.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) { this.x += (dx / dist) * 500 * deltaTime; this.y += (dy / dist) * 500 * deltaTime; }
        } else {
            this.y += this.speed * deltaTime;
        }
        this.angle += deltaTime * 2; this.pulsePhase += deltaTime * 5;
        if (this.y > canvasHeight + this.height) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y);
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.1;
        ctx.scale(pulse, pulse); ctx.rotate(this.angle);

        let color, symbol;
        if (this.type === 'HEALTH') { color = '#00FF44'; symbol = '✚'; } 
        else if (this.type === 'POWER') { color = '#FF4400'; symbol = '⚡'; } 
        else if (this.type === 'SHIELD') { color = '#00CCFF'; symbol = '⛨'; }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
            const px = Math.cos(angle) * (this.width / 2); const py = Math.sin(angle) * (this.height / 2);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); 
        ctx.save(); ctx.globalAlpha = 0.3; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
        ctx.stroke(); 

        ctx.rotate(-this.angle);
        ctx.fillStyle = color; ctx.font = `bold ${this.width * 0.5}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(symbol, 0, 0);
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.startScreen = document.getElementById('start-screen');
        this.campaignScreen = document.getElementById('campaign-screen');
        this.gameContainer = document.getElementById('game-container');
        this.pauseBtn = document.getElementById('pause-btn');
        this.pauseScreen = document.getElementById('pause-screen');
        this.debugWrapper = document.getElementById('debug-wrapper');
        this.debugToggleBtn = document.getElementById('debug-toggle-btn');
        this.shieldCountUI = document.getElementById('shield-count');
        this.scoreUI = document.getElementById('score');
        this.levelUI = document.getElementById('level-display');
        this.livesUI = document.getElementById('lives-count');
        this.planeNameUI = document.getElementById('selected-plane-name');

        this.state = 'MENU';
        this.score = 0; 
        this.checkpointScore = 0; // 【v4.5 修改部分】：记录关卡初始积分
        this.selectedLevel = 1; 
        this.lastTime = performance.now();
        this.deltaTime = 0;
        this.fps = 60;
        this.frameTime = 0; 
        this.shakeTimer = 0; // 【v4.5 修改部分】：屏幕受击震荡器

        this.imageLoader = new ImageLoader(); 
        this.gestureEngine = new GestureEngine();
        this.unifiedInput = new UnifiedInputSystem(); 
        this.audioController = new AudioController(); // 挂载音频中枢
        this.skillSystem = new SkillSystem();
        this.levelSystem = new LevelSystem();

        this.playerBulletPool = new ObjectPool(() => new Bullet(0, 0, 0, 0, 'straight'), 200);
        this.enemyBulletPool = new ObjectPool(() => new Bullet(0, 0, 0, 0, 'enemy'), 200);
        this.enemyPool = new ObjectPool(() => new Enemy(), 60);
        this.powerupPool = new ObjectPool(() => new Powerup(), 20);

        this.player = null;
        this.wingman = null; 
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.powerups = [];
        this.boss = null;
        
        this.currentPlaneType = 'Ranger';
        this.currentWingmanType = 'none'; 
        
        this.playArea = { minX: 0, maxX: window.innerWidth };
        this.interactiveWidth = window.innerWidth;
    }

    init() {
        window.imageLoader = this.imageLoader;
        window.gameInstance = this;

        this.setupEventListeners();
        window.addEventListener('resize', () => this.resize());
        this.resize(); 
        this.populateLevelGrid();
        
        if (this.imageLoader.load) {
            this.imageLoader.load(ASSET_SOURCES, () => {
                console.log("Assets loaded. OS2 Ready.");
            });
        }
    }

    populateLevelGrid() {
        const grid = document.getElementById('level-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        CAMPAIGN_LEVELS.forEach(lvl => {
            const box = document.createElement('div');
            box.className = 'level-box';
            if (lvl.level === this.selectedLevel) box.classList.add('selected');
            box.innerText = lvl.level;
            
            box.addEventListener('click', () => {
                document.querySelectorAll('.level-box').forEach(b => b.classList.remove('selected'));
                box.classList.add('selected');
                this.selectedLevel = lvl.level;
            });
            grid.appendChild(box);
        });
    }

    updateBoundaries() {
        const minX = 260; 
        const maxX = this.canvas.width - 320;
        this.playArea = { minX, maxX };
        this.interactiveWidth = maxX - minX;
    }

    setupEventListeners() {
        if (this.debugToggleBtn && this.debugWrapper) {
            this.debugToggleBtn.addEventListener('click', () => this.debugWrapper.classList.toggle('collapsed'));
        }

        document.getElementById('start-btn').addEventListener('click', () => {
            this.startScreen.style.display = 'none';
            document.getElementById('mode-select-screen').classList.remove('hidden');
        });

        document.getElementById('back-from-mode-btn').addEventListener('click', () => {
            document.getElementById('mode-select-screen').classList.add('hidden');
            this.startScreen.style.display = 'flex';
        });

        const modeCards = document.querySelectorAll('#mode-select-screen .mode-card');
        modeCards.forEach(card => {
            card.addEventListener('click', (e) => {
                this.unifiedInput.mode = card.dataset.mode;
                document.getElementById('mode-select-screen').classList.add('hidden');
                
                // 显示弹窗的同时，开启穿透遮罩层
                document.getElementById('modal-overlay').classList.remove('hidden');
                if (this.unifiedInput.mode === 'gesture') document.getElementById('modal-gesture').classList.remove('hidden');
                else if (this.unifiedInput.mode === 'keyboard') document.getElementById('modal-keyboard').classList.remove('hidden');
                else document.getElementById('modal-touch').classList.remove('hidden');
            });
        });

        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
                document.getElementById('modal-overlay').classList.add('hidden'); // 关闭遮罩
                this.showCampaignScreen(); 
            });
        });

        document.getElementById('view-tutorial-btn').addEventListener('click', () => {
            document.getElementById('modal-overlay').classList.remove('hidden');
            if (this.unifiedInput.mode === 'gesture') document.getElementById('modal-gesture').classList.remove('hidden');
            else if (this.unifiedInput.mode === 'keyboard') document.getElementById('modal-keyboard').classList.remove('hidden');
            else document.getElementById('modal-touch').classList.remove('hidden');
        });

        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            this.campaignScreen.classList.add('hidden');
            this.startScreen.style.display = 'flex';
        });

        document.getElementById('launch-level-btn').addEventListener('click', () => {
            this.campaignScreen.classList.add('hidden');
            this.startGame(this.selectedLevel);
        });

        // 音频 UI 监听
        document.getElementById('toggle-sfx').addEventListener('change', (e) => {
            this.audioController.setSFX(e.target.checked);
        });
        document.getElementById('toggle-bgm').addEventListener('change', (e) => {
            this.audioController.setBGM(e.target.checked);
        });

        this.pauseBtn.addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        
        // 【v4.5 修改部分】：拦截旧的 reload，流转至重启此局逻辑
        document.getElementById('restart-btn-pause').addEventListener('click', () => {
            this.restartCurrentLevel();
        });
        document.getElementById('menu-btn-pause').addEventListener('click', () => location.reload());

        const planeBtns = document.querySelectorAll('.plane-btn');
        planeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                planeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPlaneType = e.target.dataset.type;
                this.planeNameUI.textContent = { 'Ranger': '普通战机', 'Interceptor': '拦截者', 'Fortress': '重装堡垒', 'VoidBomber': '虚空轰炸机' }[this.currentPlaneType] || this.currentPlaneType;
            });
        });

        const wingmanBtns = document.querySelectorAll('.wingman-btn');
        wingmanBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                wingmanBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentWingmanType = e.target.dataset.type;
                const names = { 'none': '无僚机', 'defensive': '防御型僚机', 'offensive': '攻击型僚机', 'magnetic': '磁吸型僚机' };
                document.getElementById('selected-wingman-name').textContent = names[this.currentWingmanType];
            });
        });
    }

    showCampaignScreen() {
        this.campaignScreen.classList.remove('hidden');
        const display = document.getElementById('current-mode-display');
        if (this.unifiedInput.mode === 'gesture') {
            display.innerHTML = `<div class="mode-text-heavy">手势控制</div>`;
        } else if (this.unifiedInput.mode === 'keyboard') {
            display.innerHTML = `<div class="mode-text-flat">全键盘操作</div>`;
        } else {
            display.innerHTML = `<div class="mode-text-flat">鼠标/触屏滑动</div>`;
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.gestureEngine) this.gestureEngine.gameCanvas = this.canvas;
        this.updateBoundaries();
    }

    startGame(startLevel = 1) {
        this.audioController.initCtx(); // 唤醒 Web Audio 引擎

        this.gameContainer.style.display = 'block';
        document.getElementById('hud').classList.remove('hidden');
        this.resize();
        this.state = 'PLAYING';
        this.score = 0; 
        this.checkpointScore = 0; // 记录起点积分
        
        this.player = new Player(this.canvas.width / 2, this.canvas.height * 0.85, this.imageLoader, this.currentPlaneType, this.interactiveWidth);
        this.wingman = new Wingman(this.currentWingmanType, this.imageLoader, this.interactiveWidth);
        
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.powerups = [];
        this.boss = null;
        
        this.levelSystem = new LevelSystem();
        this.levelSystem.level = startLevel; 
        this.skillSystem.init(); 

        if (this.unifiedInput.mode === 'gesture') {
            const video = document.createElement('video');
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.style.display = 'none';
            document.body.appendChild(video);
            this.gestureEngine.init(video, document.getElementById('debugCanvas'), this.canvas);
        } else {
            document.getElementById('gesture-display').textContent = `动作: ${this.unifiedInput.mode} 接入`;
            this.unifiedInput.x = this.canvas.width / 2;
            this.unifiedInput.y = this.canvas.height * 0.8;
        }
        
        this.lastTime = performance.now();
        this.gameLoop(performance.now());
    }

    // 【v4.5 修改部分】：干净地重置当前关卡，不刷新页面
    restartCurrentLevel() {
        this.player.hp = this.player.maxHp;
        this.player.powerLevel = 0;
        this.player.shieldCount = 3; 
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.powerups = [];
        if (this.wingman) {
            this.wingman.defensiveUses = 3;
            this.wingman.isForcefieldActive = false;
        }
        this.boss = null;
        this.score = this.checkpointScore; // 强行回滚本关所得积分
        
        this.levelSystem.timer = 0;
        this.levelSystem.spawnTimer = 0;
        this.levelSystem.state = 'SPAWNING';
        
        this.pauseScreen.classList.add('hidden');
        this.state = 'PLAYING';
        this.lastTime = performance.now();
        this.gameLoop(performance.now());
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.pauseScreen.classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.pauseScreen.classList.add('hidden');
            this.lastTime = performance.now();
            this.gameLoop(performance.now());
        }
    }

    gameLoop(currentTime) {
        if (this.state !== 'PLAYING') return;
        const loopStart = performance.now();
        
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        if (this.deltaTime > 0) this.fps = this.fps * 0.9 + (1 / this.deltaTime) * 0.1;

        this.update();
        this.render();
        
        this.frameTime = performance.now() - loopStart; 
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    spawnBullet(x, y, speed, damage, type, offset = 0) {
        const b = this.playerBulletPool.get();
        b.x = x; b.y = y; b.speed = speed; b.damage = damage; 
        b.type = type; b.angleOffset = offset; b.state = 'FLYING'; b.timer = 0;
        if (type === 'pierce') { b.width=10; b.height=30; b.color='#ff0055'; b.isPiercing=true; }
        else if (type === 'spread') { b.width=4; b.height=10; b.color='#ffff00'; b.isPiercing=false; }
        else if (type === 'bomb') { b.width=20; b.height=20; b.color='#9900ff'; b.isPiercing=false; }
        else { b.width=4; b.height=12; b.color='#00d4ff'; b.isPiercing=false; }
        if (!this.bullets.includes(b)) this.bullets.push(b);
    }

    spawnEnemyBullet(x, y, speed, damage, angle = 0, isLaser = false) {
        const b = this.enemyBulletPool.get();
        b.x = x; b.y = y; b.speed = -speed; 
        b.damage = damage; b.type = 'enemy'; b.angleOffset = angle; b.state = 'FLYING'; b.timer = 0;
        b.width = isLaser ? 8 : 6; b.height = isLaser ? 25 : 6;
        b.color = isLaser ? '#ff00ff' : '#ff5500';
        b.isPiercing = isLaser;
        if (!this.enemyBullets.includes(b)) this.enemyBullets.push(b);
    }

    handlePlayerDamage(damageAmount) {
        if (this.player.isInvincible) return; 
        
        // 【v4.5 修改部分】：非无敌、非护盾状态下，触发震荡反馈拦截点
        if (!this.player.isShieldActive) {
            this.shakeTimer = 0.25; 
        }

        this.player.hp -= damageAmount;
        if (this.player.hp <= 0) {
            this.player.lives--;
            if (this.player.lives > 0) {
                this.player.hp = this.player.maxHp;
                this.player.triggerBlink(); 
                this.enemyBullets.forEach(b => b.active = false);
            } else {
                this.state = 'GAME_OVER';
                alert("机体严重受损！任务失败。");
            }
        }
    }

    update() {
        if (!this.player) return;
        this.skillSystem.update(this.deltaTime);
        this.levelSystem.update(this.deltaTime, this);
        
        // 维持震荡时间衰减
        if (this.shakeTimer > 0) this.shakeTimer -= this.deltaTime;

        const rawInput = this.unifiedInput.getInput(this.gestureEngine);
        const clampedInput = { ...rawInput };
        
        if (clampedInput.isDetected) {
            const safeRadius = this.player.width/2 * 1.5; 
            clampedInput.x = Math.max(this.playArea.minX + safeRadius, Math.min(clampedInput.x, this.playArea.maxX - safeRadius));
        }

        if (this.wingman && this.wingman.type === 'defensive' && this.wingman.isForcefieldActive) {
            if (clampedInput.gesture === 'FIST') clampedInput.gesture = 'IDLE'; 
        }

        const shouldShoot = this.player.update(clampedInput, this.deltaTime, this.canvas, this.skillSystem);
        
        if (shouldShoot) { 
            // 【v4.5 修改部分】：挂载音频合成触发钩子
            this.audioController.playShootSound();

            if (this.wingman) this.wingman.shoot(this); 
            const px = this.player.x; const py = this.player.y - this.player.height / 2;
            const bType = this.player.bulletType;
            const pl = this.player.powerLevel || 0;
            
            if (bType === 'straight') { 
                this.spawnBullet(px-10, py, 800, 10, 'straight'); this.spawnBullet(px+10, py, 800, 10, 'straight'); 
                if (pl >= 1) { this.spawnBullet(px-25, py+10, 800, 10, 'straight'); this.spawnBullet(px+25, py+10, 800, 10, 'straight'); }
                if (pl >= 2) { this.spawnBullet(px, py-10, 800, 15, 'straight'); }
            } 
            else if (bType === 'spread') { 
                this.spawnBullet(px, py, 800, 6, 'spread', -0.2); this.spawnBullet(px, py, 800, 6, 'spread', 0); this.spawnBullet(px, py, 800, 6, 'spread', 0.2); 
                if (pl >= 1) { this.spawnBullet(px, py+10, 800, 6, 'spread', -0.4); this.spawnBullet(px, py+10, 800, 6, 'spread', 0.4); }
                if (pl >= 2) { this.spawnBullet(px-15, py, 800, 6, 'spread', -0.1); this.spawnBullet(px+15, py, 800, 6, 'spread', 0.1); }
            } 
            else if (bType === 'pierce') { 
                this.spawnBullet(px, py, 600, 25, 'pierce'); 
                if (pl >= 1) { this.spawnBullet(px-20, py+10, 600, 25, 'pierce'); this.spawnBullet(px+20, py+10, 600, 25, 'pierce'); }
                if (pl >= 2) { this.spawnBullet(px-40, py+20, 600, 25, 'pierce'); this.spawnBullet(px+40, py+20, 600, 25, 'pierce'); }
            } 
            else if (bType === 'bomb') { 
                this.spawnBullet(px, py, 200, 40, 'bomb'); 
                if (pl >= 1) { this.spawnBullet(px-30, py+15, 200, 40, 'bomb'); this.spawnBullet(px+30, py+15, 200, 40, 'bomb'); }
                if (pl >= 2) { this.spawnBullet(px, py-20, 200, 60, 'bomb'); }
            }
        }

        if (this.wingman) this.wingman.update(this.player, this.deltaTime, this);

        const isOutOfBounds = (x, y) => (x < this.playArea.minX || x > this.playArea.maxX || y < 10 || y > this.canvas.height + 10);

        this.powerups.forEach(p => {
            p.update(this.deltaTime, this.canvas.height, this.player);
            if (p.active && Math.abs(p.x - this.player.x) < (p.width/2 + this.player.width/2) && Math.abs(p.y - this.player.y) < (p.height/2 + this.player.height/2)) {
                p.active = false;
                if (p.type === 'HEALTH') this.player.heal(this.player.maxHp * 0.15);
                else if (p.type === 'POWER') this.player.increasePower();
                else if (p.type === 'SHIELD') this.player.shieldCount++;
            }
        });

        this.bullets.forEach(b => {
            b.update(this.deltaTime);
            if (b.active && b.state === 'FLYING' && isOutOfBounds(b.x, b.y)) {
                if (b.type === 'bomb') { b.state = 'EXPLODING'; b.timer = 0; } 
                else b.active = false;
            }
        });

        const hitZoneX = this.player.width * 0.4;
        const hitZoneY = this.player.height * 0.4;
        
        this.enemyBullets.forEach(b => {
            b.update(this.deltaTime);
            if (b.active && isOutOfBounds(b.x, b.y)) {
                b.active = false;
            } else if (b.active) {
                if (this.wingman && this.wingman.type === 'defensive' && this.wingman.isForcefieldActive) {
                    const fw = (this.wingman.right.x - this.wingman.left.x) + this.wingman.width * 2;
                    const fx = this.wingman.left.x - this.wingman.width;
                    const fh = (this.wingman.left.y - this.player.y) + this.player.height + 40;
                    const fy = this.player.y - this.player.height;
                    if (b.x > fx && b.x < fx + fw && b.y > fy && b.y < fy + fh) { b.active = false; return; }
                }
                if (Math.abs(b.x - this.player.x) < hitZoneX && Math.abs(b.y - this.player.y) < hitZoneY) {
                    this.handlePlayerDamage(b.damage); b.active = false;
                }
            }
        });

        this.enemies.forEach(e => {
            e.update(this.deltaTime, this.canvas.height, this.playArea, this);
            if (e.active) {
                this.bullets.forEach(b => {
                    if (b.active && b.state === 'FLYING') {
                        let collision = false;
                        if (b.type === 'bomb') {
                            const collX = (e.width/2 * 0.7) + (b.width/2 * 0.5); const collY = (e.height/2 * 0.7) + (b.height/2 * 0.5);
                            collision = Math.abs(b.x - e.x) < collX && Math.abs(b.y - e.y) < collY;
                        } else {
                            collision = Math.abs(b.x - e.x) < (e.width/2 + b.width/2) && Math.abs(b.y - e.y) < (e.height/2 + b.height/2);
                        }
                        if (collision) {
                            const killed = e.takeDamage(b.damage);
                            if (b.type === 'bomb') { b.state = 'EXPLODING'; b.timer = 0; } else if (!b.isPiercing) { b.active = false; }
                            if (killed) { 
                                this.skillSystem.addEnergy(10); this.score += e.scoreValue; 
                                if (e.type === 3 || (e.type === 2 && Math.random() < 0.4)) {
                                    const p = this.powerupPool.get(); p.spawn(e.x, e.y);
                                    if (!this.powerups.includes(p)) this.powerups.push(p);
                                }
                            }
                        }
                    }
                });

                if (Math.abs(e.x - this.player.x) < (e.width/2 + this.player.width/2 * 0.8) && Math.abs(e.y - this.player.y) < (e.height/2 + this.player.height/2 * 0.8)) {
                    e.active = false; 
                    if (!this.player.isInvincible) {
                        let crashDamage = 10; if (e.type === 2) crashDamage = 30; if (e.type === 3) crashDamage = 60;  
                        this.handlePlayerDamage(crashDamage);
                    }
                }
            }
        });

        if (this.boss) {
            this.boss.update(this.deltaTime, this.canvas.width, this.canvas.height, this.player, this.playArea);
            
            // 当 Boss 被击败时，记录 Checkpoint，为“重新开始本局”提供积分回滚点
            if (!this.boss.active && this.boss.health <= 0) {
                this.checkpointScore = this.score;
            }

            if (this.boss.shouldShoot()) this.boss.shoot(this);
            this.bullets.forEach(b => {
                if (b.active && b.state === 'FLYING') {
                    let collision = false;
                    if (b.type === 'bomb') {
                        const collX = (this.boss.width/2 * 0.7) + (b.width/2 * 0.5); const collY = (this.boss.height/2 * 0.7) + (b.height/2 * 0.5);
                        collision = Math.abs(b.x - this.boss.x) < collX && Math.abs(b.y - this.boss.y) < collY;
                    } else {
                        collision = Math.abs(b.x - this.boss.x) < (this.boss.width/2 + b.width/2) && Math.abs(b.y - this.boss.y) < (this.boss.height/2 + b.height/2);
                    }
                    if (collision) {
                        const bossKilled = this.boss.takeDamage(b.damage);
                        if (b.type === 'bomb') { b.state = 'EXPLODING'; b.timer = 0; } else if (!b.isPiercing) { b.active = false; }
                        if (bossKilled) this.score += this.boss.scoreValue;
                    }
                }
            });
        }
        
        if (this.skillSystem.state === 'ACTIVE' && this.skillSystem.activeTimer === this.skillSystem.ultDuration) {
            this.enemies.forEach(e => { e.active = false; this.score += e.scoreValue; });
            this.enemyBullets.forEach(b => b.active = false);
            if (this.boss) {
                const bossKilled = this.boss.takeDamage(this.boss.maxHealth * 0.15); 
                if (bossKilled) this.score += this.boss.scoreValue;
            }
        }

        if(this.shieldCountUI) this.shieldCountUI.textContent = `🛡️ x ${this.player.shieldCount}`;
        if(this.scoreUI) this.scoreUI.textContent = this.score;
        if(this.levelUI) this.levelUI.textContent = this.levelSystem.level;
        if(this.livesUI) this.livesUI.textContent = `❤️ x ${this.player.lives}`; 
        
        const hpFill = document.getElementById('health-fill');
        if (hpFill) {
            const hpPct = Math.max(0, this.player.hp / this.player.maxHp) * 100;
            hpFill.style.width = `${hpPct}%`;
            hpFill.style.background = hpPct > 30 ? 'linear-gradient(90deg, #ff0055, #00d4ff)' : '#ff0055';
        }

        const ultTextEl = document.getElementById('ult-text');
        if (ultTextEl) {
            if (this.skillSystem.isReady()) {
                ultTextEl.textContent = '可以触发大招';
            } else {
                ultTextEl.textContent = `${Math.floor((this.skillSystem.energy / this.skillSystem.maxEnergy) * 100)}%`;
            }
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 【v4.5 修改部分】：渲染基质沙盒，引入动态屏幕震荡
        this.ctx.save();
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * 15;
            const dy = (Math.random() - 0.5) * 15;
            this.ctx.translate(dx, dy);
        }

        this.ctx.save(); this.ctx.setLineDash([5, 15]); this.ctx.lineWidth = 2; this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
        this.ctx.beginPath(); this.ctx.moveTo(this.playArea.minX, 0); this.ctx.lineTo(this.playArea.minX, this.canvas.height);
        this.ctx.moveTo(this.playArea.maxX, 0); this.ctx.lineTo(this.playArea.maxX, this.canvas.height);
        this.ctx.stroke(); this.ctx.restore();
        
        if (this.skillSystem.state === 'ACTIVE') {
            this.ctx.fillStyle = `rgba(255, 0, 85, ${0.1 + Math.random() * 0.1})`;
            this.ctx.fillRect(this.playArea.minX, 0, this.playArea.maxX - this.playArea.minX, this.canvas.height);
        }

        this.enemies.forEach(e => e.draw(this.ctx));
        if (this.boss) this.boss.draw(this.ctx);
        this.powerups.forEach(p => p.draw(this.ctx));
        if (this.player) this.player.draw(this.ctx);
        if (this.wingman) this.wingman.draw(this.ctx, this.player); 
        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemyBullets.forEach(b => b.draw(this.ctx));
        
        // 归位震荡系
        this.ctx.restore();

        // 【v4.5 修改部分】：渲染定向受击血边反馈 (Vignette)
        if (this.shakeTimer > 0) {
            const alpha = Math.min(1, this.shakeTimer / 0.2) * 0.6; // 衰减透明度，最大 60%
            this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, 20); // 顶
            this.ctx.fillRect(0, this.canvas.height - 20, this.canvas.width, 20); // 底
            this.ctx.fillRect(0, 0, 20, this.canvas.height); // 左
            this.ctx.fillRect(this.canvas.width - 20, 0, 20, this.canvas.height); // 右
        }

        this.drawPerformanceMonitor();
    }

    drawPerformanceMonitor() {
        const x = this.canvas.width - 150; const y = this.canvas.height - 60;
        this.ctx.font = '12px Orbitron, Courier New'; this.ctx.textAlign = 'left';
        this.ctx.fillStyle = this.fps < 45 ? '#ff4444' : '#00d4ff'; this.ctx.fillText(`FPS: ${Math.round(this.fps)}`, x, y);
        this.ctx.fillStyle = this.frameTime > 16.6 ? '#ffaa00' : '#00d4ff'; this.ctx.fillText(`FT:  ${this.frameTime.toFixed(1)}ms`, x, y + 15);
    }
}

window.addEventListener('DOMContentLoaded', () => { new Game().init(); });
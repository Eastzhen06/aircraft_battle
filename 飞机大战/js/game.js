import GestureEngine from './engine/gesture.js';
import Player, { PLANE_TYPES } from './entities/player.js';
import Bullet from './entities/bullet.js';
import Enemy from './entities/enemy.js';
import ImageLoader, { ASSET_SOURCES } from './utils/imageLoader.js';
import SkillSystem from './systems/skillSystem.js';
import LevelSystem from './systems/level.js';
import ObjectPool from './utils/objectPool.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.startScreen = document.getElementById('start-screen');
        this.gameContainer = document.getElementById('game-container');
        this.pauseBtn = document.getElementById('pause-btn');
        this.pauseScreen = document.getElementById('pause-screen');
        
        this.debugCanvas = document.getElementById('debugCanvas');
        this.debugWrapper = document.getElementById('debug-wrapper');
        this.debugToggleBtn = document.getElementById('debug-toggle-btn');
        
        this.shieldCountUI = document.getElementById('shield-count');
        this.accountIcon = document.getElementById('account-icon');
        this.devModal = document.getElementById('dev-modal');
        this.adminPanel = document.getElementById('admin-debug-panel');
        this.planeNameUI = document.getElementById('selected-plane-name');

        this.state = 'MENU';
        this.lastTime = 0;
        this.deltaTime = 0;

        this.imageLoader = new ImageLoader();
        this.gestureEngine = new GestureEngine();
        this.skillSystem = new SkillSystem();
        this.levelSystem = new LevelSystem();

        // v3.2: 引入对象池彻底解决 GC 卡顿
        this.bulletPool = new ObjectPool(() => new Bullet(0, 0, 0, 0, 'straight'), 200);
        this.enemyPool = new ObjectPool(() => new Enemy(), 50);

        this.player = null;
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.boss = null;
        this.currentPlaneType = 'Ranger';
        
        // 核心动态边界
        this.playArea = { minX: 0, maxX: window.innerWidth };
    }

    init() {
        console.log("Initializing game v3.2 (Full ES6 Entity Fusion)...");
        this.setupEventListeners();
        window.addEventListener('resize', () => this.resize());
        this.resize(); 
        this.imageLoader.load(ASSET_SOURCES, () => {
            console.log("Assets loaded. Ready.");
        });
    }

    // 严格的 DOM 到 Canvas 的物理边界映射
    updateBoundaries() {
        let minX = 0;
        let maxX = this.canvas.width;
        
        if (this.debugWrapper && !this.debugWrapper.classList.contains('collapsed')) {
            const rect = this.debugWrapper.getBoundingClientRect();
            minX = rect.right + 20; 
        }
        
        const hud = document.getElementById('hud');
        if (hud) {
            const rect = hud.getBoundingClientRect();
            maxX = rect.left - 20;
        }
        
        this.playArea = { minX, maxX };
        console.log(`[Area] Playable X: ${minX} to ${maxX}`);
    }

    setupEventListeners() {
        if (this.debugToggleBtn && this.debugWrapper) {
            this.debugToggleBtn.addEventListener('click', () => {
                this.debugWrapper.classList.toggle('collapsed');
                setTimeout(() => this.updateBoundaries(), 350); 
            });
        }

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn-pause').addEventListener('click', () => {
            this.togglePause();
            this.startGame();
        });
        document.getElementById('menu-btn-pause').addEventListener('click', () => location.reload());

        if (this.accountIcon) this.accountIcon.addEventListener('click', () => this.devModal.classList.toggle('hidden'));
        document.getElementById('dev-modal-close-btn').addEventListener('click', () => this.devModal.classList.add('hidden'));

        const planeBtns = document.querySelectorAll('.plane-btn');
        planeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                planeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPlaneType = e.target.dataset.type;
                const nameMap = { 'Ranger': '游骑兵', 'Interceptor': '拦截者', 'Fortress': '重装堡垒', 'VoidBomber': '虚空轰炸' };
                this.planeNameUI.textContent = nameMap[this.currentPlaneType] || this.currentPlaneType;
            });
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'e' || e.key === 'E') {
                if (this.state === 'PLAYING') this.skillSystem.addEnergy(20);
            }
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.gestureEngine) this.gestureEngine.gameCanvas = this.canvas;
        this.updateBoundaries();
    }

    startGame() {
        this.startScreen.style.display = 'none';
        this.gameContainer.style.display = 'block';
        document.getElementById('hud').classList.remove('hidden');
        this.resize();
        this.state = 'PLAYING';
        this.lastTime = performance.now();
        
        this.player = new Player(this.canvas.width / 2, this.canvas.height * 0.85, this.imageLoader, this.currentPlaneType);
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.boss = null;
        this.levelSystem = new LevelSystem();
        this.skillSystem.init(); 

        if (!this.gestureEngine.webcamRunning) {
            const video = document.createElement('video');
            video.style.display = 'none';
            document.body.appendChild(video);
            this.gestureEngine.init(video, this.debugCanvas, this.canvas);
        }
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
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        this.update();
        this.render();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    // 玩家子弹
    spawnBullet(x, y, speed, damage, type, offset = 0) {
        const b = this.bulletPool.get();
        b.x = x; b.y = y; b.speed = speed; b.damage = damage; 
        b.type = type; b.angleOffset = offset; b.state = 'FLYING'; b.timer = 0;
        
        if (type === 'pierce') { b.width=10; b.height=30; b.color='#ff0055'; b.isPiercing=true; }
        else if (type === 'spread') { b.width=4; b.height=10; b.color='#ffff00'; b.isPiercing=false; }
        else if (type === 'bomb') { b.width=20; b.height=20; b.color='#9900ff'; b.isPiercing=false; }
        else { b.width=4; b.height=12; b.color='#00d4ff'; b.isPiercing=false; }
        
        if (!this.bullets.includes(b)) this.bullets.push(b);
    }

    // 敌机/Boss子弹
    spawnEnemyBullet(x, y, speed, damage, angle = 0, isLaser = false) {
        const b = this.bulletPool.get();
        b.x = x; b.y = y; b.speed = -speed; // 向下飞
        b.damage = damage; b.type = 'enemy'; b.angleOffset = angle; b.state = 'FLYING'; b.timer = 0;
        b.width = isLaser ? 8 : 6;
        b.height = isLaser ? 25 : 6;
        b.color = isLaser ? '#ff00ff' : '#ff5500';
        b.isPiercing = isLaser;
        if (!this.enemyBullets.includes(b)) this.enemyBullets.push(b);
    }

    update() {
        if (!this.player) return;
        this.skillSystem.update(this.deltaTime);
        this.levelSystem.update(this.deltaTime, this);

        const input = this.gestureEngine.getInputState();
        
        const clampedInput = { ...input };
        if (clampedInput.isDetected) {
            clampedInput.x = Math.max(this.playArea.minX + this.player.width/2, Math.min(clampedInput.x, this.playArea.maxX - this.player.width/2));
        }

        const shouldShoot = this.player.update(clampedInput, this.deltaTime, this.canvas, this.skillSystem);

        if (shouldShoot) {
            const bType = this.player.bulletType;
            const px = this.player.x;
            const py = this.player.y - this.player.height / 2;
            
            if (bType === 'straight') {
                this.spawnBullet(px - 10, py, 800, 10, 'straight');
                this.spawnBullet(px + 10, py, 800, 10, 'straight');
            } else if (bType === 'spread') {
                this.spawnBullet(px, py, 800, 6, 'spread', -0.2);
                this.spawnBullet(px, py, 800, 6, 'spread', 0);
                this.spawnBullet(px, py, 800, 6, 'spread', 0.2);
            } else if (bType === 'pierce') {
                this.spawnBullet(px, py, 600, 25, 'pierce');
            } else if (bType === 'bomb') {
                this.spawnBullet(px, py, 200, 40, 'bomb');
            }
        }

        this.bullets.forEach(b => b.update(this.deltaTime));
        this.enemyBullets.forEach(b => {
            b.update(this.deltaTime);
            // 简单的敌机子弹打玩家
            if (b.active && !this.player.isInvincible && Math.abs(b.x - this.player.x) < 15 && Math.abs(b.y - this.player.y) < 15) {
                this.player.hp -= b.damage;
                b.active = false;
                if (this.player.hp <= 0) {
                    console.log("GAME OVER"); // 待接入失败结算
                }
            }
        });

        this.enemies.forEach(e => {
            e.update(this.deltaTime, this.canvas.height, this.playArea);
            if (e.active) {
                this.bullets.forEach(b => {
                    if (b.active && b.state === 'FLYING' && Math.abs(b.x - e.x) < e.width/2 && Math.abs(b.y - e.y) < e.height/2) {
                        const killed = e.takeDamage(b.damage);
                        if (!b.isPiercing) b.active = false;
                        if (killed) this.skillSystem.addEnergy(10); 
                    }
                });
            }
        });

        if (this.boss) {
            this.boss.update(this.deltaTime, this.canvas.width, this.canvas.height, this.player, this.playArea);
            this.bullets.forEach(b => {
                if (b.active && b.state === 'FLYING' && Math.abs(b.x - this.boss.x) < this.boss.width/2 && Math.abs(b.y - this.boss.y) < this.boss.height/2) {
                    this.boss.takeDamage(b.damage);
                    if (!b.isPiercing) b.active = false;
                }
            });
        }
        
        // 必杀技触发全屏秒杀逻辑
        if (this.skillSystem.state === 'ACTIVE' && this.skillSystem.activeTimer === this.skillSystem.ultDuration) {
            this.enemies.forEach(e => e.active = false);
            this.enemyBullets.forEach(b => b.active = false);
            if (this.boss) this.boss.takeDamage(this.boss.maxHealth * 0.15); 
        }

        if(this.shieldCountUI) this.shieldCountUI.textContent = `🛡️ x ${this.player.shieldCount}`;
        
        // 更新血条UI
        const hpFill = document.getElementById('health-fill');
        if (hpFill) {
            const hpPct = Math.max(0, this.player.hp / this.player.config.hp) * 100;
            hpFill.style.width = `${hpPct}%`;
            hpFill.style.background = hpPct > 30 ? '#0f0' : '#f00';
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.skillSystem.state === 'ACTIVE') {
            this.ctx.fillStyle = `rgba(255, 0, 85, ${0.1 + Math.random() * 0.1})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.enemies.forEach(e => e.draw(this.ctx));
        if (this.boss) this.boss.draw(this.ctx);
        if (this.player) this.player.draw(this.ctx);
        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemyBullets.forEach(b => b.draw(this.ctx));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
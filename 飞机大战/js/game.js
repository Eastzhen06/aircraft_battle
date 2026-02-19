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
        
        this.debugWrapper = document.getElementById('debug-wrapper');
        this.debugToggleBtn = document.getElementById('debug-toggle-btn');
        
        this.shieldCountUI = document.getElementById('shield-count');
        this.state = 'MENU';
        
        // 性能监控变量
        this.lastTime = performance.now();
        this.deltaTime = 0;
        this.fps = 60;
        this.frameTime = 0; // 记录 update+render 耗时

        this.imageLoader = window.imageLoader || new ImageLoader(); 
        this.gestureEngine = new GestureEngine();
        this.skillSystem = new SkillSystem();
        this.levelSystem = new LevelSystem();

        this.bulletPool = new ObjectPool(() => new Bullet(0, 0, 0, 0, 'straight'), 300);
        this.enemyPool = new ObjectPool(() => new Enemy(), 60);

        this.player = null;
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.boss = null;
        this.currentPlaneType = 'Ranger';
        
        this.playArea = { minX: 0, maxX: window.innerWidth };
    }

    init() {
        console.log("Initializing game v3.3 (Visual Boundaries & Perf Monitor)...");
        this.setupEventListeners();
        window.addEventListener('resize', () => this.resize());
        this.resize(); 
        
        if (this.imageLoader.load) {
            this.imageLoader.load(ASSET_SOURCES, () => {
                console.log("Assets loaded. Ready.");
            });
        }
    }

    updateBoundaries() {
        let minX = 0;
        let maxX = this.canvas.width;
        
        if (this.debugWrapper && !this.debugWrapper.classList.contains('collapsed')) {
            const rect = this.debugWrapper.getBoundingClientRect();
            minX = rect.right + 15; 
        }
        
        const hud = document.getElementById('hud');
        if (hud) {
            const rect = hud.getBoundingClientRect();
            maxX = rect.left - 15;
        }
        
        this.playArea = { minX, maxX };
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
        
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'e' || e.key === 'E') && this.state === 'PLAYING') {
                this.skillSystem.addEnergy(20);
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

        const video = document.createElement('video');
        video.style.display = 'none';
        document.body.appendChild(video);
        this.gestureEngine.init(video, document.getElementById('debugCanvas'), this.canvas);
        
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
        
        // 平滑 FPS
        if (this.deltaTime > 0) {
            this.fps = this.fps * 0.9 + (1 / this.deltaTime) * 0.1;
        }

        this.update();
        this.render();
        
        this.frameTime = performance.now() - loopStart; // 记录本帧总耗时
        requestAnimationFrame((time) => this.gameLoop(time));
    }

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

    spawnEnemyBullet(x, y, speed, damage, angle = 0, isLaser = false) {
        const b = this.bulletPool.get();
        b.x = x; b.y = y; b.speed = -speed; 
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
            // 将玩家限制在互动区内，考虑护盾厚度
            const safeRadius = this.player.width/2 * 1.5; 
            clampedInput.x = Math.max(this.playArea.minX + safeRadius, Math.min(clampedInput.x, this.playArea.maxX - safeRadius));
        }

        const shouldShoot = this.player.update(clampedInput, this.deltaTime, this.canvas, this.skillSystem);

        if (shouldShoot) {
            const px = this.player.x;
            const py = this.player.y - this.player.height / 2;
            const bType = this.player.bulletType;
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

        // 边界剔除逻辑封装
        const isOutOfBounds = (x) => (x < this.playArea.minX || x > this.playArea.maxX);

        this.bullets.forEach(b => {
            b.update(this.deltaTime);
            if (b.active && isOutOfBounds(b.x)) b.active = false;
        });

        this.enemyBullets.forEach(b => {
            b.update(this.deltaTime);
            if (b.active && isOutOfBounds(b.x)) {
                b.active = false;
            } else if (b.active && !this.player.isInvincible && Math.abs(b.x - this.player.x) < 15 && Math.abs(b.y - this.player.y) < 15) {
                this.player.hp -= b.damage;
                b.active = false;
                if (this.player.hp <= 0) console.log("GAME OVER");
            }
        });

        this.enemies.forEach(e => {
            e.update(this.deltaTime, this.canvas.height, this.playArea, this);
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
            if (this.boss.shouldShoot()) this.boss.shoot(this);
            this.bullets.forEach(b => {
                if (b.active && b.state === 'FLYING' && Math.abs(b.x - this.boss.x) < this.boss.width/2 && Math.abs(b.y - this.boss.y) < this.boss.height/2) {
                    this.boss.takeDamage(b.damage);
                    if (!b.isPiercing) b.active = false;
                }
            });
        }
        
        if (this.skillSystem.state === 'ACTIVE' && this.skillSystem.activeTimer === this.skillSystem.ultDuration) {
            this.enemies.forEach(e => e.active = false);
            this.enemyBullets.forEach(b => b.active = false);
            if (this.boss) this.boss.takeDamage(this.boss.maxHealth * 0.15); 
        }

        if(this.shieldCountUI) this.shieldCountUI.textContent = `🛡️ x ${this.player.shieldCount}`;
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
        
        // 1. 绘制边界分隔线 (V3.3 核心要求)
        this.ctx.save();
        this.ctx.setLineDash([5, 15]);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(this.playArea.minX, 0); this.ctx.lineTo(this.playArea.minX, this.canvas.height);
        this.ctx.moveTo(this.playArea.maxX, 0); this.ctx.lineTo(this.playArea.maxX, this.canvas.height);
        this.ctx.stroke();
        this.ctx.restore();
        
        // 必杀技背景光
        if (this.skillSystem.state === 'ACTIVE') {
            this.ctx.fillStyle = `rgba(255, 0, 85, ${0.1 + Math.random() * 0.1})`;
            this.ctx.fillRect(this.playArea.minX, 0, this.playArea.maxX - this.playArea.minX, this.canvas.height);
        }

        this.enemies.forEach(e => e.draw(this.ctx));
        if (this.boss) this.boss.draw(this.ctx);
        if (this.player) this.player.draw(this.ctx);
        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemyBullets.forEach(b => b.draw(this.ctx));
        
        // 2. 绘制右下角性能监控器 (非交互区)
        this.drawPerformanceMonitor();
    }

    drawPerformanceMonitor() {
        const x = this.canvas.width - 150;
        const y = this.canvas.height - 60;
        this.ctx.font = '12px Courier New';
        this.ctx.textAlign = 'left';
        
        // FPS 变红警告
        this.ctx.fillStyle = this.fps < 45 ? '#ff4444' : '#00ff00';
        this.ctx.fillText(`FPS: ${Math.round(this.fps)}`, x, y);
        
        // Frame Time
        this.ctx.fillStyle = this.frameTime > 16.6 ? '#ffaa00' : '#00ff00';
        this.ctx.fillText(`FT:  ${this.frameTime.toFixed(1)}ms`, x, y + 15);
        
        // 对象池使用率
        const bActive = this.bulletPool.pool.filter(o => o.active).length;
        const eActive = this.enemyPool.pool.filter(o => o.active).length;
        this.ctx.fillStyle = '#00d4ff';
        this.ctx.fillText(`Bul: ${bActive}/${this.bulletPool.pool.length}`, x, y + 30);
        this.ctx.fillText(`Eny: ${eActive}/${this.enemyPool.pool.length}`, x, y + 45);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
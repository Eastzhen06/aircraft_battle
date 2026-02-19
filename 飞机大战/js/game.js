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
        this.scoreUI = document.getElementById('score');
        this.levelUI = document.getElementById('level-display');
        
        this.accountIcon = document.getElementById('account-icon');
        this.devModal = document.getElementById('dev-modal');
        this.adminPanel = document.getElementById('admin-debug-panel');
        this.planeNameUI = document.getElementById('selected-plane-name');

        this.state = 'MENU';
        this.score = 0; // 积分系统激活
        
        this.lastTime = performance.now();
        this.deltaTime = 0;
        this.fps = 60;
        this.frameTime = 0; 

        this.imageLoader = new ImageLoader(); 
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
        console.log("Initializing game v3.4 (Strict Boundaries & Collision Fix)...");
        
        // V3.4 修复 2: 解决模块作用域导致敌机图片丢失的问题
        window.imageLoader = this.imageLoader;

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
        // V3.4 修复 1: 边界线静态化，无论摄像头是否收起，交互区边界彻底锁死不变
        // 左边界: 容纳调试窗口 (240px + 20px 间距)
        const minX = 260; 
        // 右边界: 容纳 HUD 区域 (300px + 20px 间距)
        const maxX = this.canvas.width - 320;
        
        this.playArea = { minX, maxX };
    }

    setupEventListeners() {
        if (this.debugToggleBtn && this.debugWrapper) {
            this.debugToggleBtn.addEventListener('click', () => {
                this.debugWrapper.classList.toggle('collapsed');
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

        // V3.4 修复 4: 修复并闭环登录交互逻辑
        if (this.accountIcon) this.accountIcon.addEventListener('click', () => this.devModal.classList.toggle('hidden'));
        document.getElementById('dev-modal-close-btn').addEventListener('click', () => this.devModal.classList.add('hidden'));

        document.getElementById('login-submit-btn').addEventListener('click', () => {
            const acc = document.getElementById('login-account').value;
            const pwd = document.getElementById('login-password').value;
            if (acc === '0001' && pwd === '1011') {
                this.isAdmin = true;
                this.devModal.classList.add('hidden');
                this.adminPanel.classList.remove('hidden');
                alert("管理员身份已验证，调试面板已开启！");
            } else {
                alert("账号或密码错误！");
            }
        });

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
        this.score = 0; // 重置积分
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
        
        if (this.deltaTime > 0) {
            this.fps = this.fps * 0.9 + (1 / this.deltaTime) * 0.1;
        }

        this.update();
        this.render();
        
        this.frameTime = performance.now() - loopStart; 
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

        const isOutOfBounds = (x) => (x < this.playArea.minX || x > this.playArea.maxX);

        this.bullets.forEach(b => {
            b.update(this.deltaTime);
            if (b.active && isOutOfBounds(b.x)) b.active = false;
        });

        // V3.4 修复 6: 优化受击判定，放宽包围盒
        const hitZoneX = this.player.width * 0.4;
        const hitZoneY = this.player.height * 0.4;

        this.enemyBullets.forEach(b => {
            b.update(this.deltaTime);
            if (b.active && isOutOfBounds(b.x)) {
                b.active = false;
            } else if (b.active && !this.player.isInvincible && Math.abs(b.x - this.player.x) < hitZoneX && Math.abs(b.y - this.player.y) < hitZoneY) {
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
                        if (killed) {
                            this.skillSystem.addEnergy(10);
                            this.score += e.scoreValue; // V3.4 积分累加
                        }
                    }
                });
            }
        });

        if (this.boss) {
            this.boss.update(this.deltaTime, this.canvas.width, this.canvas.height, this.player, this.playArea);
            if (this.boss.shouldShoot()) this.boss.shoot(this);
            this.bullets.forEach(b => {
                if (b.active && b.state === 'FLYING' && Math.abs(b.x - this.boss.x) < this.boss.width/2 && Math.abs(b.y - this.boss.y) < this.boss.height/2) {
                    const bossKilled = this.boss.takeDamage(b.damage);
                    if (!b.isPiercing) b.active = false;
                    if (bossKilled) this.score += this.boss.scoreValue; // V3.4 击败Boss加分
                }
            });
        }
        
        if (this.skillSystem.state === 'ACTIVE' && this.skillSystem.activeTimer === this.skillSystem.ultDuration) {
            this.enemies.forEach(e => {
                e.active = false;
                this.score += e.scoreValue; // 清图也算分
            });
            this.enemyBullets.forEach(b => b.active = false);
            if (this.boss) {
                const bossKilled = this.boss.takeDamage(this.boss.maxHealth * 0.15); 
                if (bossKilled) this.score += this.boss.scoreValue;
            }
        }

        // V3.4 更新 UI 文本
        if(this.shieldCountUI) this.shieldCountUI.textContent = `🛡️ x ${this.player.shieldCount}`;
        if(this.scoreUI) this.scoreUI.textContent = this.score;
        if(this.levelUI) this.levelUI.textContent = this.levelSystem.level;
        
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
        
        // 边界分隔线
        this.ctx.save();
        this.ctx.setLineDash([5, 15]);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(this.playArea.minX, 0); this.ctx.lineTo(this.playArea.minX, this.canvas.height);
        this.ctx.moveTo(this.playArea.maxX, 0); this.ctx.lineTo(this.playArea.maxX, this.canvas.height);
        this.ctx.stroke();
        this.ctx.restore();
        
        if (this.skillSystem.state === 'ACTIVE') {
            this.ctx.fillStyle = `rgba(255, 0, 85, ${0.1 + Math.random() * 0.1})`;
            this.ctx.fillRect(this.playArea.minX, 0, this.playArea.maxX - this.playArea.minX, this.canvas.height);
        }

        this.enemies.forEach(e => e.draw(this.ctx));
        if (this.boss) this.boss.draw(this.ctx);
        if (this.player) this.player.draw(this.ctx);
        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemyBullets.forEach(b => b.draw(this.ctx));
        
        this.drawPerformanceMonitor();
    }

    drawPerformanceMonitor() {
        const x = this.canvas.width - 150;
        const y = this.canvas.height - 60;
        this.ctx.font = '12px Courier New';
        this.ctx.textAlign = 'left';
        
        this.ctx.fillStyle = this.fps < 45 ? '#ff4444' : '#00ff00';
        this.ctx.fillText(`FPS: ${Math.round(this.fps)}`, x, y);
        
        this.ctx.fillStyle = this.frameTime > 16.6 ? '#ffaa00' : '#00ff00';
        this.ctx.fillText(`FT:  ${this.frameTime.toFixed(1)}ms`, x, y + 15);
        
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
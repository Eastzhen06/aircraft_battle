import GestureEngine from './engine/gesture.js';
import Player, { PLANE_TYPES } from './entities/player.js';
import Bullet from './entities/bullet.js';
import ImageLoader, { ASSET_SOURCES } from './utils/imageLoader.js';
import SkillSystem from './systems/skillSystem.js';

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
        
        // v3.1: 初始化必杀系统
        this.skillSystem = new SkillSystem();

        this.player = null;
        this.bullets = [];
        this.currentPlaneType = 'Ranger';
        this.isAdmin = false;
    }

    init() {
        console.log("Initializing game v3.1 (Phase 3: Ult System & Mirror Fix)...");
        this.setupEventListeners();
        window.addEventListener('resize', () => this.resize());
        this.resize(); 
        this.imageLoader.load(ASSET_SOURCES, () => {
            console.log("Assets loaded. Ready.");
        });
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

        if (this.accountIcon) {
            this.accountIcon.addEventListener('click', () => this.devModal.classList.toggle('hidden'));
        }
        document.getElementById('dev-modal-close-btn').addEventListener('click', () => this.devModal.classList.add('hidden'));

        document.getElementById('login-submit-btn').addEventListener('click', () => {
            const acc = document.getElementById('login-account').value;
            const pwd = document.getElementById('login-password').value;
            if (acc === '0001' && pwd === '1011') {
                this.isAdmin = true;
                this.devModal.classList.add('hidden');
                this.adminPanel.classList.remove('hidden');
                alert("管理员身份已验证！");
            } else {
                alert("账号或密码错误！");
            }
        });

        const planeBtns = document.querySelectorAll('.plane-btn');
        planeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                planeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const type = e.target.dataset.type;
                this.currentPlaneType = type;
                const nameMap = { 'Ranger': '游骑兵', 'Interceptor': '拦截者', 'Fortress': '重装堡垒', 'VoidBomber': '虚空轰炸' };
                this.planeNameUI.textContent = nameMap[type] || type;
            });
        });

        // === v3.1 开发者充能测试入口 ===
        window.addEventListener('keydown', (e) => {
            if (e.key === 'e' || e.key === 'E') {
                if (this.state === 'PLAYING') {
                    console.log("🛠️ Debug: 手动增加必杀能量...");
                    this.skillSystem.addEnergy(20);
                }
            }
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.gestureEngine) this.gestureEngine.gameCanvas = this.canvas;
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
        this.skillSystem.init(); // 激活 UI

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

    update() {
        if (!this.player) return;
        
        // 更新必杀系统状态
        this.skillSystem.update(this.deltaTime);

        const input = this.gestureEngine.getInputState();
        // 将 skillSystem 传给 Player 以拦截 RECOIL 和处理无敌
        const shouldShoot = this.player.update(input, this.deltaTime, this.canvas, this.skillSystem);

        if (shouldShoot) {
            const bType = this.player.bulletType;
            const px = this.player.x;
            const py = this.player.y - this.player.height / 2;
            
            if (bType === 'straight') {
                this.bullets.push(new Bullet(px - 10, py, 800, 10, 'straight'));
                this.bullets.push(new Bullet(px + 10, py, 800, 10, 'straight'));
            } 
            else if (bType === 'spread') {
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', -0.2));
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', 0));
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', 0.2));
            }
            else if (bType === 'pierce') {
                 this.bullets.push(new Bullet(px, py, 600, 25, 'pierce'));
            }
            else if (bType === 'bomb') {
                 this.bullets.push(new Bullet(px, py, 200, 40, 'bomb'));
            }
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].update(this.deltaTime);
            if (!this.bullets[i].active) {
                this.bullets.splice(i, 1);
            }
        }
        
        if(this.shieldCountUI) this.shieldCountUI.textContent = `🛡️ x ${this.player.shieldCount}`;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 若处于释放必杀期间，可加滤镜或特效背景
        if (this.skillSystem.state === 'ACTIVE') {
            this.ctx.fillStyle = `rgba(255, 0, 85, ${0.1 + Math.random() * 0.1})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.player) this.player.draw(this.ctx);
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
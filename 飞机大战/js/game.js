import GestureEngine from './engine/gesture.js';
import Player, { PLANE_TYPES } from './entities/player.js';
import Bullet from './entities/bullet.js';
import ImageLoader, { ASSET_SOURCES } from './utils/imageLoader.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.startScreen = document.getElementById('start-screen');
        this.gameContainer = document.getElementById('game-container');
        this.pauseBtn = document.getElementById('pause-btn');
        this.pauseScreen = document.getElementById('pause-screen');
        this.debugCanvas = document.getElementById('debugCanvas');
        this.shieldCountUI = document.getElementById('shield-count');
        this.accountIcon = document.getElementById('account-icon');
        this.devModal = document.getElementById('dev-modal');
        
        // 新增 UI 引用
        this.adminPanel = document.getElementById('admin-debug-panel');
        this.planeNameUI = document.getElementById('selected-plane-name');

        this.state = 'MENU';
        this.lastTime = 0;
        this.deltaTime = 0;

        this.imageLoader = new ImageLoader();
        this.gestureEngine = new GestureEngine();

        this.player = null;
        this.bullets = [];
        this.currentPlaneType = 'Ranger'; // 默认机型
        this.isAdmin = false; // 管理员状态
    }

    init() {
        console.log("Initializing game...");
        this.setupEventListeners();
        
        window.addEventListener('resize', () => this.resize());
        this.resize(); 

        console.log("Starting image loading...");
        this.imageLoader.load(ASSET_SOURCES, () => {
            console.log("All images loaded successfully!");
        });
    }

    setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn-pause').addEventListener('click', () => {
            this.togglePause();
            this.startGame();
        });
        document.getElementById('menu-btn-pause').addEventListener('click', () => {
             location.reload(); 
        });

        if (this.accountIcon) {
            this.accountIcon.addEventListener('click', () => {
                this.devModal.classList.toggle('hidden');
            });
        }
        document.getElementById('dev-modal-close-btn').addEventListener('click', () => {
            this.devModal.classList.add('hidden');
        });

        // === 任务 1：管理员鉴权逻辑 ===
        document.getElementById('login-submit-btn').addEventListener('click', () => {
            const acc = document.getElementById('login-account').value;
            const pwd = document.getElementById('login-password').value;

            if (acc === '0001' && pwd === '1011') {
                this.isAdmin = true;
                this.devModal.classList.add('hidden');
                this.adminPanel.classList.remove('hidden'); // 解锁调试面板
                alert("管理员身份已验证！调试模式开启。");
            } else {
                alert("账号或密码错误！");
            }
        });

        // === 任务 3：机型切换逻辑 ===
        const planeBtns = document.querySelectorAll('.plane-btn');
        planeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 移除其他按钮激活状态
                planeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // 设置机型
                const type = e.target.dataset.type;
                this.currentPlaneType = type;
                
                // 更新 UI 显示
                const planeConfig = PLANE_TYPES[type];
                // 这里简单做一个映射，或者直接显示 Type ID
                const nameMap = {
                    'Ranger': '游骑兵', 'Interceptor': '拦截者',
                    'Fortress': '重装堡垒', 'VoidBomber': '虚空轰炸'
                };
                this.planeNameUI.textContent = nameMap[type] || type;
            });
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.gestureEngine) {
            this.gestureEngine.gameCanvas = this.canvas;
        }
    }

    startGame() {
        this.startScreen.style.display = 'none';
        this.gameContainer.style.display = 'block';
        document.getElementById('hud').classList.remove('hidden');
        this.resize();

        this.state = 'PLAYING';
        this.lastTime = performance.now();

        // 使用当前选择的 currentPlaneType 创建玩家
        this.player = new Player(this.canvas.width / 2, this.canvas.height * 0.85, this.imageLoader, this.currentPlaneType);
        this.bullets = [];

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
        
        const input = this.gestureEngine.getInputState();
        const shouldShoot = this.player.update(input, this.deltaTime, this.canvas);

        if (shouldShoot) {
            const bType = this.player.bulletType;
            const px = this.player.x;
            const py = this.player.y - this.player.height / 2;
            
            if (bType === 'straight') {
                this.bullets.push(new Bullet(px, py, 800, 10, 'straight'));
            } 
            else if (bType === 'spread') {
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', -0.2));
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', 0));
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', 0.2));
            }
            else if (bType === 'pierce') {
                 this.bullets.push(new Bullet(px, py, 600, 20, 'pierce'));
            }
            else {
                 this.bullets.push(new Bullet(px, py, 800, 10, 'straight'));
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

        if (this.player) this.player.draw(this.ctx);
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
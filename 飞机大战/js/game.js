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
        this.pauseScreen = document.getElementById('pause-screen'); // 修复暂停引用
        this.debugCanvas = document.getElementById('debugCanvas');
        this.shieldCountUI = document.getElementById('shield-count');
        this.accountIcon = document.getElementById('account-icon');
        this.devModal = document.getElementById('dev-modal');

        this.state = 'MENU';
        this.lastTime = 0;
        this.deltaTime = 0;

        this.imageLoader = new ImageLoader();
        this.gestureEngine = new GestureEngine();

        this.player = null;
        this.bullets = [];
        this.currentPlaneType = 'Ranger'; // 默认机型
    }

    init() {
        console.log("Initializing game...");
        this.setupEventListeners();
        
        window.addEventListener('resize', () => this.resize());
        this.resize(); 

        console.log("Starting image loading...");
        this.imageLoader.load(ASSET_SOURCES, () => {
            console.log("All images loaded successfully!");
            // 这里可以预加载一些东西，或者只是等待
        });
    }

    setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        
        // 修复暂停按钮逻辑
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-btn-pause').addEventListener('click', () => {
            this.togglePause();
            this.startGame();
        });
        document.getElementById('menu-btn-pause').addEventListener('click', () => {
             location.reload(); // 简单粗暴回主菜单
        });

        // 修复账户图标点击
        if (this.accountIcon) {
            this.accountIcon.addEventListener('click', () => {
                this.devModal.classList.toggle('hidden');
            });
        }
        document.getElementById('dev-modal-close-btn').addEventListener('click', () => {
            this.devModal.classList.add('hidden');
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

        // 实例化 Player, 传入 ImageLoader 而不是 Image 对象，以便 Player 内部获取配置
        // 初始位置: 屏幕底中
        this.player = new Player(this.canvas.width / 2, this.canvas.height * 0.85, this.imageLoader, this.currentPlaneType);
        this.bullets = [];

        // 初始化手势引擎 (单例模式防重复)
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
            this.lastTime = performance.now(); // 防止 deltaTime 激增
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

        // === 核心修复: 弹道工厂 ===
        if (shouldShoot) {
            const bType = this.player.bulletType;
            const px = this.player.x;
            const py = this.player.y - this.player.height / 2;
            
            if (bType === 'straight') {
                this.bullets.push(new Bullet(px, py, 800, 10, 'straight'));
            } 
            else if (bType === 'spread') {
                // 扇形散射: 3 发
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', -0.2)); // 左偏
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', 0));    // 中
                this.bullets.push(new Bullet(px, py, 800, 6, 'spread', 0.2));  // 右偏
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
        
        // 简单星空背景 (可选，暂时用纯色)
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.player) this.player.draw(this.ctx);
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
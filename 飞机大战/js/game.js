import GestureEngine from './engine/gesture.js';

// 全局变量，用于存储游戏实例和手势引擎实例
let game;
let gestureEngine;

class Game {
    constructor() {
        // DOM 元素引用
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.startScreen = document.getElementById('start-screen');
        this.gameContainer = document.getElementById('game-container');
        this.pauseBtn = document.getElementById('pause-btn');
        this.debugCanvas = document.getElementById('debugCanvas');

        // 游戏状态
        this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
        this.lastTime = 0;
        this.deltaTime = 0;

        // 游戏实体
        this.player = null; // 稍后在 startGame 中初始化
        this.enemies = [];
        this.boss = null;
        
        // 系统模块
        // this.bulletPool = new BulletPool(); // 示例，需要实际的类
        
        this.resizeCanvas();
    }

    init() {
        this.setupEventListeners();
        this.resizeCanvas(); // Initial size
        window.addEventListener('resize', () => this.resizeCanvas()); // Add resize listener
        this.gameLoop(0);
    }

    setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        this.pauseBtn.addEventListener('click', () => this.togglePause());

        const accountIcon = document.getElementById('account-icon');
        const devModal = document.getElementById('dev-modal');
        const closeModalBtn = document.getElementById('dev-modal-close-btn');

        if (accountIcon && devModal && closeModalBtn) {
            accountIcon.addEventListener('click', () => devModal.classList.remove('hidden'));
            closeModalBtn.addEventListener('click', () => devModal.classList.add('hidden'));
        }
    }

    resizeCanvas() {
        // Set canvas resolution to match window size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log(`Canvas resized to: ${this.canvas.width}x${this.canvas.height}`);
    }

    startGame() {
        console.log("Starting game...");
        // 切换界面
        this.startScreen.style.display = 'none';
        this.gameContainer.style.display = 'block';
        this.resizeCanvas(); // 确保画布尺寸正确

        this.state = 'PLAYING';
        this.lastTime = performance.now();
        
        // 初始化玩家等游戏实体
        // this.player = new Player(this.canvas.width / 2, this.canvas.height - 100); 

        // 初始化并启动手势引擎
        if (gestureEngine) {
            // 创建一个隐藏的 video 元素用于摄像头输入
            const video = document.createElement('video');
            video.style.display = 'none';
            document.body.appendChild(video);
            gestureEngine.init(video, this.debugCanvas, this.canvas);
        }
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.pauseBtn.textContent = '▶️';
            console.log('Game Paused');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.pauseBtn.textContent = '⏸️';
            console.log('Game Resumed');
        }
    }

    gameLoop(currentTime) {
        this.deltaTime = (currentTime - this.lastTime) / 1000; // Delta time in seconds
        this.lastTime = currentTime;

        if (this.state === 'PLAYING') {
            this.update();
        }
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update() {
        if (!gestureEngine) return;
        
        const input = gestureEngine.getInputState();
        
        // 用 input.x, input.y, input.gesture 来控制玩家
        console.log(`Gesture: ${input.gesture}, Position: (${input.x.toFixed(2)}, ${input.y.toFixed(2)})`);

        // 更新玩家位置
        // if(this.player) {
        //     this.player.x = input.x;
        //     this.player.y = input.y;
        // }
        
        // 更新其他游戏逻辑...
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 渲染背景
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state !== 'MENU') {
            // 渲染玩家
            if(this.player) {
                this.player.draw(this.ctx);
            }
        }
    }
}

// ==== 主程序入口 ====
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    
    // 实例化核心类
    game = new Game();
    gestureEngine = new GestureEngine();
    
    // 初始化游戏（绑定UI事件等）
    game.init();
});

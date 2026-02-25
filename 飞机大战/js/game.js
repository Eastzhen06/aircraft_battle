import GestureEngine from './engine/gesture.js';
import Player, { PLANE_TYPES } from './entities/player.js';
import Bullet from './entities/bullet.js';
import Enemy from './entities/enemy.js';
import ImageLoader, { ASSET_SOURCES } from './utils/imageLoader.js';
import SkillSystem from './systems/skillSystem.js';
import LevelSystem from './systems/level.js';
import ObjectPool from './utils/objectPool.js';
import Wingman from './entities/wingman.js';

class AudioController {
    constructor() {
        this.sfxEnabled = true;
        this.bgmEnabled = true;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgmBuffer = null;
        this.bgmSource = null;
        
        this.bgmGainNode = this.audioCtx.createGain();
        this.bgmGainNode.gain.value = 0.5;
        this.bgmGainNode.connect(this.audioCtx.destination);
        
        this.loadBGM('./audio/bgm_space.mp3');
    }

    async loadBGM(url) {
        try {
            console.log("正在将背景音乐装载入内存 (AudioBuffer)...");
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            this.bgmBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            console.log("背景音乐硬解码完成！随时待命。");
            
            if (this.audioCtx.state === 'running' && this.bgmEnabled && !this.bgmSource) {
                this.playBGM();
            }
        } catch (e) {
            console.error("❌ BGM 解码毁灭性失败！请确认该文件是标准 MP3/WAV 格式，或用格式工厂重新转换一次！", e);
        }
    }

    initCtx() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        if (this.bgmEnabled) {
            this.playBGM();
        }
    }

    playBGM() {
        if (!this.bgmBuffer || this.bgmSource || !this.bgmEnabled) return;
        this.bgmSource = this.audioCtx.createBufferSource();
        this.bgmSource.buffer = this.bgmBuffer;
        this.bgmSource.loop = true; 
        this.bgmSource.connect(this.bgmGainNode);
        this.bgmSource.start(0);
    }

    setBGM(enabled) {
        this.bgmEnabled = enabled;
        if (enabled) {
            this.playBGM();
        } else {
            if (this.bgmSource) {
                this.bgmSource.stop();
                this.bgmSource.disconnect();
                this.bgmSource = null;
            }
        }
    }

    setSFX(enabled) {
        this.sfxEnabled = enabled;
    }

    playShootSound() {
        if (!this.sfxEnabled || !this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'square'; 
        osc.frequency.setValueAtTime(1200, t); 
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.08); 

        gain.gain.setValueAtTime(0.1, t); 
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
    }
}

// ==========================================
// 【v4.8 核心修改】：物理隔离锁死，严禁模式逃逸与串联
// ==========================================
class UnifiedInputSystem {
    constructor() {
        this.mode = null; // 初始不赋予任何模式，等待锁定
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight * 0.8;
        this.keys = {};
        
        this.clickCount = 0;
        this.clickTimer = null;
        this.activeTempGesture = null;

        this.handleKeyDown = (e) => {
            // 【事件刺客 2.0】：拦截 F/G/空格/方向键，彻底物理销毁信号
            if (['KeyF', 'KeyG', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.stopImmediatePropagation(); 
                e.preventDefault(); 
            }
            this.keys[e.code] = true;
        };
        
        this.handleKeyUp = (e) => {
            this.keys[e.code] = false;
        };
        
        this.handleMove = (e) => {
            if (this.mode === 'touch') {
                this.x = e.clientX || (e.touches && e.touches[0].clientX); 
                this.y = e.clientY || (e.touches && e.touches[0].clientY);
            }
        };

        this.handleDown = (e) => {
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
    }

    // 【新增绝对隔离接口】：在 UI 选定模式时调用，斩断其他干扰
    lockMode(selectedMode) {
        this.mode = selectedMode;
        const canvas = document.getElementById('gameCanvas');

        // 【v4.8.1 核心补丁】：如果不是手势模式，强制剥夺手势引擎的所有权限
        if (selectedMode !== 'gesture' && this.gestureEngine) {
            // 1. 尝试调用手势引擎的清理接口（如果存在）
            if (typeof this.gestureEngine.stop === 'function') this.gestureEngine.stop();
            console.log("🚫 手势引擎已被物理剥离，禁止一切非法监听。");
        }

        // 1. 先进行极其暴力的“物理清除”，拆除所有已有监听器
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        canvas.removeEventListener('mousemove', this.handleMove);
        canvas.removeEventListener('touchmove', this.handleMove);
        canvas.removeEventListener('mousedown', this.handleDown);
        canvas.removeEventListener('touchstart', this.handleDown);
        
        // 2. 只有选定该模式，才接通它的物理通道
        if (this.mode === 'keyboard') {
            // 【捕获防线】：传入 true 开启捕获阶段
            window.addEventListener('keydown', this.handleKeyDown, true);
            window.addEventListener('keyup', this.handleKeyUp, true);
            
            // 【正确修改】：在这里强制手势引擎 UI 停止刷新幽灵数字，并显示正确的 F/G
            const debugDisplay = document.getElementById('gesture-display');
            if (debugDisplay) debugDisplay.textContent = "动作: 物理锁定 (F/G 已拦截)";
            
            console.log("🔒 已物理锁定：[键盘模式]。最高级捕获防线已开启。");
        }
        else if (this.mode === 'touch') {
            canvas.addEventListener('mousemove', this.handleMove);
            canvas.addEventListener('touchmove', this.handleMove);
            canvas.addEventListener('mousedown', this.handleDown);
            canvas.addEventListener('touchstart', this.handleDown, { passive: false });
            console.log("🔒 已物理锁定：[触控模式]。键盘与视觉系统已被强行切断。");
        }
        else if (this.mode === 'gesture') {
            console.log("🔒 已物理锁定：[手势模式]。系统等待分配摄像头资源。");
        }
    }
    



    triggerTempGesture(g) {
        this.activeTempGesture = g;
        setTimeout(() => this.activeTempGesture = null, 250); 
    }

    getInput(gestureEngine) {
        if (this.mode === 'gesture') {
            // 手势模式下，唯一的数据来源是摄像头引擎
            return gestureEngine.getInputState(); 
        } 
        else if (this.mode === 'keyboard') {
            let gesture = 'IDLE';
            if (this.keys['ArrowLeft']) this.x -= 12;
            if (this.keys['ArrowRight']) this.x += 12;
            if (this.keys['ArrowUp']) this.y -= 12;
            if (this.keys['ArrowDown']) this.y += 12;

            if (this.keys['KeyF']) gesture = 'RECOIL';
            else if (this.keys['KeyG']) gesture = 'FIST';
            else if (this.keys['Space']) gesture = 'GUN';
            
            return { isDetected: true, x: this.x, y: this.y, gesture: gesture };
        } 
        else if (this.mode === 'touch') {
            let gesture = 'GUN'; 
            if (this.activeTempGesture) gesture = this.activeTempGesture;
            return { isDetected: true, x: this.x, y: this.y, gesture: gesture };
        }
        
        // 默认防崩溃保护
        return { isDetected: false, x: this.x, y: this.y, gesture: 'IDLE' };
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
        this.active = false; 
        this.x = 0; 
        this.y = 0;
        this.width = 40; 
        this.height = 40;
        this.type = 'HEALTH'; 
        this.speed = 100;
        this.angle = 0; 
        this.pulsePhase = 0;
    }
    
    spawn(x, y) {
        this.active = true; 
        this.x = x; 
        this.y = y; 
        this.isMagnetized = false; 
        const r = Math.random();
        if (r < 0.33) this.type = 'HEALTH'; 
        else if (r < 0.66) this.type = 'POWER'; 
        else this.type = 'SHIELD';
    }
    
    update(deltaTime, canvasHeight, player) {
        if (!this.active) return;
        if (this.isMagnetized && player) {
            const dx = player.x - this.x; 
            const dy = player.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) { 
                this.x += (dx / dist) * 500 * deltaTime; 
                this.y += (dy / dist) * 500 * deltaTime; 
            }
        } else {
            this.y += this.speed * deltaTime;
        }
        this.angle += deltaTime * 2; 
        this.pulsePhase += deltaTime * 5;
        if (this.y > canvasHeight + this.height) this.active = false;
    }
    
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); 
        ctx.translate(this.x, this.y);
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.1;
        ctx.scale(pulse, pulse); 
        ctx.rotate(this.angle);

        let color, symbol;
        if (this.type === 'HEALTH') { color = '#00FF44'; symbol = '✚'; } 
        else if (this.type === 'POWER') { color = '#FF4400'; symbol = '⚡'; } 
        else if (this.type === 'SHIELD') { color = '#00CCFF'; symbol = '⛨'; }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; 
        ctx.strokeStyle = color; 
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
            const px = Math.cos(angle) * (this.width / 2); 
            const py = Math.sin(angle) * (this.height / 2);
            if (i === 0) ctx.moveTo(px, py); 
            else ctx.lineTo(px, py);
        }
        ctx.closePath(); 
        ctx.fill(); 
        
        ctx.save(); 
        ctx.globalAlpha = 0.3; 
        ctx.lineWidth = 6; 
        ctx.stroke(); 
        ctx.restore();
        ctx.stroke(); 

        ctx.rotate(-this.angle);
        ctx.fillStyle = color; 
        ctx.font = `bold ${this.width * 0.5}px Arial`;
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle'; 
        ctx.fillText(symbol, 0, 0);
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
        this.checkpointScore = 0; 
        this.selectedLevel = 1; 
        
        this.lastTime = performance.now();
        this.deltaTime = 0;
        this.fps = 60;
        this.frameTime = 0; 
        this.shakeTimer = 0;

        this.isBossShooting = false; 
        this.ultDamageApplied = false; // 【新增】：大招真伤单次触发锁

        this.imageLoader = new ImageLoader(); 
        this.gestureEngine = new GestureEngine();
        this.unifiedInput = new UnifiedInputSystem(); 
        
        if (!window.globalAudio) window.globalAudio = new AudioController();
        this.audioController = window.globalAudio;

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
        
        // 【Phase 9 新增：持久化数据读取】
        try {
            this.unlockedPlanes = JSON.parse(localStorage.getItem('os2_unlocked_planes')) || ['Ranger'];
            this.unlockedWingmen = JSON.parse(localStorage.getItem('os2_unlocked_wingmen')) || ['none'];
            this.maxClearedLevel = parseInt(localStorage.getItem('os2_max_cleared_level')) || 0;
        } catch (e) {
            this.unlockedPlanes = ['Ranger'];
            this.unlockedWingmen = ['none'];
            this.maxClearedLevel = 0;
        }

        // 默认选中已解锁数组的第一个
        this.selectedPlane = this.unlockedPlanes[0];
        this.selectedWingman = this.unlockedWingmen[0];
        
        this.playArea = { minX: 0, maxX: window.innerWidth };
        this.interactiveWidth = window.innerWidth;
    }

    // 【Phase 9 新增：全局配置字典，键名已与 imageLoader 严格对齐】
    AIRCRAFT_CONFIG = {
        planes: {
            'Ranger': { name: '普通战机', imageKey: 'Ranger', unlockLevel: 0 },
            'Interceptor': { name: '拦截者', imageKey: 'Interceptor', unlockLevel: 5 },
            'Fortress': { name: '重装堡垒', imageKey: 'Fortress', unlockLevel: 6 },
            'VoidBomber': { name: '虚空轰炸机', imageKey: 'VoidBomber', unlockLevel: 8 }
        },
        wingmen: {
            'none': { name: '无僚机', imageKey: null, unlockLevel: 0 },
            'offensive': { name: '攻击型僚机', imageKey: 'w_offensive', unlockLevel: 1 },
            'defensive': { name: '防御型僚机', imageKey: 'w_defensive', unlockLevel: 3 },
            'magnetic': { name: '磁吸型僚机', imageKey: 'w_magnetic', unlockLevel: 9 }
        }
    };

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

    // 【Phase 9 新增：机库动态渲染】
    renderHangar() {
        const planesContainer = document.getElementById('hangar-planes-container');
        const wingmenContainer = document.getElementById('hangar-wingmen-container');
        if (!planesContainer || !wingmenContainer) return;

        planesContainer.innerHTML = ''; wingmenContainer.innerHTML = '';

        const createCard = (type, key, config, container, isSelected) => {
            const isUnlocked = type === 'plane' ? this.unlockedPlanes.includes(key) : this.unlockedWingmen.includes(key);
            const card = document.createElement('div');
            card.className = `hangar-item ${isUnlocked ? 'owned' : 'locked'} ${isSelected ? 'selected' : ''}`;
            
            // 渲染图片
            const imgBox = document.createElement('div');
            imgBox.className = 'item-img-box';
            if (config.imageKey) {
                const img = this.imageLoader.get(config.imageKey);
                imgBox.appendChild(img ? img.cloneNode() : document.createTextNode('无影像'));
            } else { imgBox.innerText = '无影像'; }
            card.appendChild(imgBox);

            // 渲染文字与状态
            const name = document.createElement('div'); name.className = 'item-name'; name.innerText = config.name;
            const status = document.createElement('div'); status.className = 'item-status';
            status.innerText = isUnlocked ? (isSelected ? '已部署' : '点击选择') : `通关第${config.unlockLevel}关解锁`;
            card.appendChild(name); card.appendChild(status);

            // 互斥单选事件
            if (isUnlocked) {
                card.addEventListener('click', () => {
                    if (type === 'plane') this.selectedPlane = key; else this.selectedWingman = key;
                    this.renderHangar(); // 刷新高亮状态
                });
            }
            container.appendChild(card);
        };

        for (const [key, config] of Object.entries(this.AIRCRAFT_CONFIG.planes)) createCard('plane', key, config, planesContainer, key === this.selectedPlane);
        for (const [key, config] of Object.entries(this.AIRCRAFT_CONFIG.wingmen)) createCard('wingman', key, config, wingmenContainer, key === this.selectedWingman);
    }

    populateLevelGrid() {
        const grid = document.getElementById('level-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        CAMPAIGN_LEVELS.forEach(lvl => {
            const box = document.createElement('div');
            box.className = 'level-box';
            
            // 【Phase 9 修改：关卡锁定逻辑】必须通关前置关卡才能点击
            if (lvl.level > this.maxClearedLevel + 1) {
                box.classList.add('locked');
            } else {
                if (lvl.level === this.selectedLevel) box.classList.add('selected');
                box.addEventListener('click', () => {
                    document.querySelectorAll('.level-box').forEach(b => b.classList.remove('selected'));
                    box.classList.add('selected');
                    this.selectedLevel = lvl.level;
                });
            }
            box.innerText = lvl.level;
            grid.appendChild(box);
        });
    }

    updateBoundaries() {
        let minX, maxX;
        if (this.canvas.width < 800) {
            // 【Phase 9.4 修改】：移动端/平板安全区，两边留白 5%
            minX = this.canvas.width * 0.05;
            maxX = this.canvas.width * 0.95;
        } else {
            // 保持 PC 端原有宽边距
            minX = 260; 
            maxX = this.canvas.width - 320;
        }
        this.playArea = { minX, maxX };
        this.interactiveWidth = maxX - minX;
    }

    setupEventListeners() {
        if (this.debugToggleBtn && this.debugWrapper) {
            this.debugToggleBtn.addEventListener('click', () => this.debugWrapper.classList.toggle('collapsed'));
        }

        // 【手术一修改：将起步流程导向新机库】
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startScreen.style.display = 'none';
            document.getElementById('hangar-screen').classList.remove('hidden');
            this.renderHangar(); // 渲染机库图片和状态

            // 【Phase 9.3 核心修改：拦截判定，呼出首次欢迎大屏】
            if (!localStorage.getItem('os2_has_seen_welcome_v5')) {
                document.getElementById('welcome-modal').classList.remove('hidden');
                document.getElementById('modal-overlay').classList.remove('hidden');
            }
        });

        // 【Phase 9.3 新增：收到简报，销毁大屏并写入硬盘】
        document.getElementById('btn-close-welcome')?.addEventListener('click', () => {
            document.getElementById('welcome-modal').classList.add('hidden');
            document.getElementById('modal-overlay').classList.add('hidden');
            // 写入已读标识，之后无论是刷新还是重进，该大屏都不会再骚扰玩家
            localStorage.setItem('os2_has_seen_welcome_v5', 'true');
        });

        // 新增：从机库进入模式选择
        document.getElementById('hangar-launch-btn')?.addEventListener('click', () => {
            document.getElementById('hangar-screen').classList.add('hidden');
            document.getElementById('mode-select-screen').classList.remove('hidden');
        });

        // 修改：从模式选择退回机库
        document.getElementById('back-from-mode-btn').addEventListener('click', () => {
            document.getElementById('mode-select-screen').classList.add('hidden');
            document.getElementById('hangar-screen').classList.remove('hidden');
        });

        const modeCards = document.querySelectorAll('#mode-select-screen .mode-card');
        modeCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const selectedMode = card.dataset.mode;
                // 【v4.8 核心修改】：玩家点击卡片时，立刻执行物理模式隔离锁！
                this.unifiedInput.lockMode(selectedMode);
                
                document.getElementById('mode-select-screen').classList.add('hidden');
                
                document.getElementById('modal-overlay').classList.remove('hidden');
                if (selectedMode === 'gesture') document.getElementById('modal-gesture').classList.remove('hidden');
                else if (selectedMode === 'keyboard') document.getElementById('modal-keyboard').classList.remove('hidden');
                else document.getElementById('modal-touch').classList.remove('hidden');
            });
        });

        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
                document.getElementById('modal-overlay').classList.add('hidden'); 
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

        document.getElementById('toggle-sfx').addEventListener('change', (e) => {
            this.audioController.setSFX(e.target.checked);
            e.target.blur(); 
        });
        document.getElementById('toggle-bgm').addEventListener('change', (e) => {
            this.audioController.setBGM(e.target.checked);
            e.target.blur(); 
        });

        this.pauseBtn.addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        
        document.getElementById('restart-btn-pause').addEventListener('click', () => {
            this.restartCurrentLevel();
        });
        document.getElementById('menu-btn-pause').addEventListener('click', () => location.reload());

        // 【Phase 9.1 修改：绑定胜利面板的 5 大路由按钮】
        const hideVictoryScreen = () => {
            document.getElementById('victory-screen').classList.add('hidden');
            this.gameContainer.style.display = 'none';
            this.state = 'MENU';
        };

        document.getElementById('btn-victory-restart')?.addEventListener('click', () => {
            document.getElementById('victory-screen').classList.add('hidden');
            this.restartCurrentLevel(); // 重开本局不需要退回MENU，直接执行重开
        });

        document.getElementById('btn-victory-hangar')?.addEventListener('click', () => {
            hideVictoryScreen();
            document.getElementById('hangar-screen').classList.remove('hidden');
            this.renderHangar();
        });

        document.getElementById('btn-victory-campaign')?.addEventListener('click', () => {
            hideVictoryScreen();
            // 【Phase 9.2 修改：强行刷新关卡网格状态，解决灰色未解锁的 Bug】
            this.populateLevelGrid(); 
            this.showCampaignScreen(); 
        });

        // 【Phase 9.2 新增：进入下一关】
        document.getElementById('btn-victory-next')?.addEventListener('click', () => {
            hideVictoryScreen();
            this.selectedLevel++;
            this.startGame(this.selectedLevel);
        });

        // ==========================================
        // 【Phase 9.2 新增：最高权限开发者模式鉴权系统】
        // ==========================================
        const devTrigger = document.getElementById('dev-mode-trigger');
        if (devTrigger) {
            // hover效果
            devTrigger.addEventListener('mouseenter', () => devTrigger.style.opacity = '1');
            devTrigger.addEventListener('mouseleave', () => devTrigger.style.opacity = '0.3');
            
            devTrigger.addEventListener('click', () => {
                document.getElementById('dev-modal').classList.remove('hidden');
                document.getElementById('modal-overlay').classList.remove('hidden');
            });
        }

        document.getElementById('dev-cancel')?.addEventListener('click', () => {
            document.getElementById('dev-modal').classList.add('hidden');
            document.getElementById('modal-overlay').classList.add('hidden');
            document.getElementById('dev-account').value = '';
            document.getElementById('dev-password').value = '';
        });

        document.getElementById('dev-submit')?.addEventListener('click', () => {
            const acc = document.getElementById('dev-account').value;
            const pwd = document.getElementById('dev-password').value;
            // 严格的常量比对防线
            if (acc === '0002' && pwd === '1110') {
                this.unlockedPlanes = Object.keys(this.AIRCRAFT_CONFIG.planes);
                this.unlockedWingmen = Object.keys(this.AIRCRAFT_CONFIG.wingmen);
                this.maxClearedLevel = 10;
                localStorage.setItem('os2_unlocked_planes', JSON.stringify(this.unlockedPlanes));
                localStorage.setItem('os2_unlocked_wingmen', JSON.stringify(this.unlockedWingmen));
                localStorage.setItem('os2_max_cleared_level', '10');
                alert("[OS2_SYS] 鉴权通过。全级图鉴与全关卡物理挂载完毕。");
                location.reload();
            } else {
                alert("[OS2_SYS] 警告：授权凭证无效。");
            }
        });

        document.getElementById('btn-victory-mode')?.addEventListener('click', () => {
            hideVictoryScreen();
            document.getElementById('mode-select-screen').classList.remove('hidden');
        });

        document.getElementById('btn-victory-disconnect')?.addEventListener('click', () => {
            location.reload(); // 刷新浏览器，彻底切断所有内存连接
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
        
        // 【Phase 9.4 核心修改】：强制同步热更新实例的边界尺寸，防止强行拉伸变形后按键/识别坐标脱节
        if (this.player) this.player.interactiveWidth = this.interactiveWidth;
        if (this.wingman) this.wingman.interactiveWidth = this.interactiveWidth;
    }

    startGame(startLevel = 1) {
        this.audioController.initCtx(); 

        this.gameContainer.style.display = 'block';
        document.getElementById('hud').classList.remove('hidden');
        this.resize();
        this.state = 'PLAYING';
        this.score = 0; 
        // this.checkpointScore 废弃不用
        
        // 【手术二修改：使用持久化变量创建战机】
        this.player = new Player(this.canvas.width / 2, this.canvas.height * 0.85, this.imageLoader, this.selectedPlane, this.interactiveWidth);
        this.wingman = new Wingman(this.selectedWingman, this.imageLoader, this.interactiveWidth);
        
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
            
            // 【Phase 9.5 核心补丁】：移动端 WebKit 强制要求静音与自动播放声明，否则物理挂起导致黑屏
            video.autoplay = true;
            video.muted = true;
            
            video.style.display = 'none';
            document.body.appendChild(video);
            this.gestureEngine.init(video, document.getElementById('debugCanvas'), this.canvas);
        } else {

            // 【v4.8 修改】：如果在非手势模式下，强制切断手势引擎的一切可能调用，确保摄像头处于死亡状态
            document.getElementById('gesture-display').textContent = `动作: 键盘/物理 锁定`;
            this.unifiedInput.x = this.canvas.width / 2;
            this.unifiedInput.y = this.canvas.height * 0.8;
        }
        
        this.lastTime = performance.now();
        this.gameLoop(performance.now());
    }

    restartCurrentLevel() {
        this.player.hp = this.player.maxHp;
        this.player.powerLevel = 0;
        this.player.shieldCount = 3; 
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.powerups = [];
        if (this.wingman) {
            this.wingman.isForcefieldActive = false;
        }
        this.boss = null;
        this.score = 0; // 【手术二修改：死亡重开必须绝对清零，杜绝刷分】
        
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
    // 【手术四新增：关卡胜利结算与奖励分发系统】
    handleLevelVictory() {
        this.state = 'VICTORY'; // 将游戏状态冻结，暂停一切渲染和物理运算
        
        // 1. 更新玩家历史最高通关记录
        if (this.levelSystem.level > this.maxClearedLevel) {
            this.maxClearedLevel = this.levelSystem.level;
        }

        // 2. 遍历武器库，核对解锁条件
        let unlocksThisRound = [];
        const checkUnlock = (type, key, config) => {
            const list = type === 'plane' ? this.unlockedPlanes : this.unlockedWingmen;
            
            // 核心修改 1：如果是当前关卡的专属奖励，必定触发UI播报展示（无视是否用作弊码拿过）
            if (this.levelSystem.level === config.unlockLevel) {
                unlocksThisRound.push(config.name);
            } 
            // 补发播报：如果跳级打，且之前居然没拿过，补发播报
            else if (this.levelSystem.level > config.unlockLevel && !list.includes(key)) {
                unlocksThisRound.push(config.name);
            }

            // 核心修改 2：物理存入防线。如果没有这架飞机，才存入本地存档，防止数组无限膨胀
            if (this.levelSystem.level >= config.unlockLevel && !list.includes(key)) {
                list.push(key);
            }
        };

        // 基于我们在区块一定义的配置表进行全局扫描
        for (const [key, config] of Object.entries(this.AIRCRAFT_CONFIG.planes)) checkUnlock('plane', key, config);
        for (const [key, config] of Object.entries(this.AIRCRAFT_CONFIG.wingmen)) checkUnlock('wingman', key, config);

        // 3. 将新资产写入硬盘持久化保存
        try {
            localStorage.setItem('os2_unlocked_planes', JSON.stringify(this.unlockedPlanes));
            localStorage.setItem('os2_unlocked_wingmen', JSON.stringify(this.unlockedWingmen));
            localStorage.setItem('os2_max_cleared_level', this.maxClearedLevel.toString());
        } catch (e) {
            console.warn("系统提示：存档写入失败，可能是处于无痕模式。", e);
        }

        // 4. 更新结算 UI 并弹出
        document.getElementById('victory-score-val').innerText = this.score;
        const unlockContainer = document.getElementById('unlock-notifications');
        const unlockList = document.getElementById('unlock-list');
        unlockList.innerHTML = '';

        if (unlocksThisRound.length > 0) {
            unlocksThisRound.forEach(name => {
                const li = document.createElement('li'); 
                li.innerText = `- [获得授权] ${name}`; 
                unlockList.appendChild(li);
            });
            unlockContainer.classList.remove('hidden');
            document.getElementById('victory-peace-msg').classList.add('hidden');
            document.getElementById('btn-victory-next').classList.add('hidden');
        } else {
            unlockContainer.classList.add('hidden'); 
            // 【Phase 9.2 修改：无奖励时显示赞扬文本与下一关按钮】
            document.getElementById('victory-peace-msg').classList.remove('hidden');
            if (this.selectedLevel < 10) {
                document.getElementById('btn-victory-next').classList.remove('hidden');
            } else {
                document.getElementById('btn-victory-next').classList.add('hidden'); // 如果是最后一关则不显示
            }
        }

        document.getElementById('victory-screen').classList.remove('hidden');
        
        // 5. 核心需求：展示完毕后，立刻清空游戏积分
        this.score = 0; 
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
        b.x = x; 
        b.y = y; 
        b.speed = speed; 
        b.damage = damage; 
        b.type = type; 
        b.angleOffset = offset; 
        b.state = 'FLYING'; 
        b.timer = 0;
        
        if (type === 'pierce') { b.width=10; b.height=30; b.color='#ff0055'; b.isPiercing=true; }
        else if (type === 'spread') { b.width=4; b.height=10; b.color='#ffff00'; b.isPiercing=false; }
        else if (type === 'bomb') { b.width=20; b.height=20; b.color='#9900ff'; b.isPiercing=false; }
        else { b.width=4; b.height=12; b.color='#00d4ff'; b.isPiercing=false; }
        
        if (!this.bullets.includes(b)) this.bullets.push(b);
    }

    spawnEnemyBullet(x, y, speed, damage, angle = 0, isLaser = false) {
        let finalSpeed = speed;
        if (this.isBossShooting) finalSpeed *= 2.5;
        else finalSpeed *= 2.0;

        const b = this.enemyBulletPool.get();
        b.x = x; 
        b.y = y; 
        b.speed = -finalSpeed; 
        b.damage = damage; 
        b.type = 'enemy'; 
        b.angleOffset = angle; 
        b.state = 'FLYING'; 
        b.timer = 0;
        b.width = isLaser ? 8 : 6; 
        b.height = isLaser ? 25 : 6;
        b.color = isLaser ? '#ff00ff' : '#ff5500';
        b.isPiercing = isLaser;
        
        if (!this.enemyBullets.includes(b)) this.enemyBullets.push(b);
    }

    handlePlayerDamage(damageAmount) {
        if (this.player.isInvincible) return; 
        
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
            this.audioController.playShootSound();

            if (this.wingman) this.wingman.shoot(this); 
            const px = this.player.x; 
            const py = this.player.y - this.player.height / 2;
            const bType = this.player.bulletType;
            const pl = this.player.powerLevel || 0;
            
            if (bType === 'straight') { 
                this.spawnBullet(px-10, py, 800, 10, 'straight'); 
                this.spawnBullet(px+10, py, 800, 10, 'straight'); 
                if (pl >= 1) { this.spawnBullet(px-25, py+10, 800, 10, 'straight'); this.spawnBullet(px+25, py+10, 800, 10, 'straight'); }
                if (pl >= 2) { this.spawnBullet(px, py-10, 800, 15, 'straight'); }
            } 
            else if (bType === 'spread') { 
                this.spawnBullet(px, py, 800, 6, 'spread', -0.2); 
                this.spawnBullet(px, py, 800, 6, 'spread', 0); 
                this.spawnBullet(px, py, 800, 6, 'spread', 0.2); 
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
                    if (b.x > fx && b.x < fx + fw && b.y > fy && b.y < fy + fh) { 
                        b.active = false; 
                        return; 
                    }
                }
                
                if (Math.abs(b.x - this.player.x) < hitZoneX && Math.abs(b.y - this.player.y) < hitZoneY) {
                    this.handlePlayerDamage(b.damage); 
                    b.active = false;
                }
            }
        });

        this.enemies.forEach(e => {
            if (e.active && e.type === 3 && e.isRedLaserActive) {
                const rect = e.getRedLaserRect(this.canvas.height);
                if (rect && 
                    this.player.x + this.player.width/2 > rect.x && 
                    this.player.x - this.player.width/2 < rect.x + rect.w &&
                    this.player.y + this.player.height/2 > rect.y && 
                    this.player.y - this.player.height/2 < rect.y + rect.h) {
                    
                    if (!this.player.isShieldActive && !this.player.isInvincible) {
                        let damageReduction = 1.0;
                        if (this.wingman && this.wingman.requestDefense('E3_LASER')) {
                            damageReduction = 0.5;
                        }
                        this.handlePlayerDamage((this.player.maxHp * 0.3) * damageReduction * this.deltaTime);
                    }
                }
            }
        });

        if (this.boss && this.boss.isLaserSweeping) {
            const laserRects = this.boss.getLaserRects(this.canvas.height);
            for (let rect of laserRects) {
                if (this.player.x + this.player.width/2 > rect.x && 
                    this.player.x - this.player.width/2 < rect.x + rect.w &&
                    this.player.y + this.player.height/2 > rect.y && 
                    this.player.y - this.player.height/2 < rect.y + rect.h) {
                    
                    if (this.player.isShieldActive) {
                        this.player.reduceShield(999); 
                    } else if (!this.player.isInvincible) {
                        let damageReduction = 1.0;
                        if (this.wingman && this.wingman.requestDefense('BOSS_LASER')) {
                            damageReduction = 0.5;
                        }
                        this.handlePlayerDamage((this.player.maxHp * 0.5) * damageReduction * this.deltaTime); 
                    }
                    break;
                }
            }
        }

        this.enemies.forEach(e => {
            e.update(this.deltaTime, this.canvas.height, this.playArea, this);
            if (e.active) {
                this.bullets.forEach(b => {
                    if (b.active && b.state === 'FLYING') {
                        let collision = false;
                        if (b.type === 'bomb') {
                            const collX = (e.width/2 * 0.7) + (b.width/2 * 0.5); 
                            const collY = (e.height/2 * 0.7) + (b.height/2 * 0.5);
                            collision = Math.abs(b.x - e.x) < collX && Math.abs(b.y - e.y) < collY;
                        } else {
                            collision = Math.abs(b.x - e.x) < (e.width/2 + b.width/2) && Math.abs(b.y - e.y) < (e.height/2 + b.height/2);
                        }
                        
                        if (collision) {
                            const killed = e.takeDamage(b.damage);
                            if (b.type === 'bomb') { b.state = 'EXPLODING'; b.timer = 0; } 
                            else if (!b.isPiercing) { b.active = false; }
                            
                            if (killed) { 
                                this.skillSystem.addEnergy(10); 
                                this.score += e.scoreValue; 
                                if (e.type === 3 || (e.type === 2 && Math.random() < 0.4)) {
                                    const p = this.powerupPool.get(); 
                                    p.spawn(e.x, e.y);
                                    if (!this.powerups.includes(p)) this.powerups.push(p);
                                }
                            }
                        }
                    }
                });

                if (Math.abs(e.x - this.player.x) < (e.width/2 + this.player.width/2 * 0.8) && 
                    Math.abs(e.y - this.player.y) < (e.height/2 + this.player.height/2 * 0.8)) {
                    e.active = false; 
                    if (!this.player.isInvincible) {
                        let crashDamage = 10; 
                        if (e.type === 2) crashDamage = 30; 
                        if (e.type === 3) crashDamage = 60;  
                        this.handlePlayerDamage(crashDamage);
                    }
                }
            }
        });

        if (this.boss) {
            this.boss.update(this.deltaTime, this.canvas.width, this.canvas.height, this.player, this.playArea);
            
            if (!this.boss.active && this.boss.health <= 0) {
                // 【手术三修改：拦截死亡瞬间，触发结算，切断当前帧】
                this.handleLevelVictory(); 
                return; 
            }

            this.bullets.forEach(b => {
                if (b.active && b.state === 'FLYING') {
                    let collision = false;
                    if (b.type === 'bomb') {
                        const collX = (this.boss.width/2 * 0.7) + (b.width/2 * 0.5); 
                        const collY = (this.boss.height/2 * 0.7) + (b.height/2 * 0.5);
                        collision = Math.abs(b.x - this.boss.x) < collX && Math.abs(b.y - this.boss.y) < collY;
                    } else {
                        collision = Math.abs(b.x - this.boss.x) < (this.boss.width/2 + b.width/2) && Math.abs(b.y - this.boss.y) < (this.boss.height/2 + b.height/2);
                    }
                    if (collision) {
                        const bossKilled = this.boss.takeDamage(b.damage);
                        if (b.type === 'bomb') { b.state = 'EXPLODING'; b.timer = 0; } 
                        else if (!b.isPiercing) { b.active = false; }
                        if (bossKilled) this.score += this.boss.scoreValue;
                    }
                }
            });
        }
        
        // 【浮点数陷阱修复】：使用状态锁替代 === 判断，确保 100% 触发单次核算
        if (this.skillSystem.state === 'ACTIVE') {
            if (!this.ultDamageApplied) {
                this.enemies.forEach(e => { e.active = false; this.score += e.scoreValue; });
                this.enemyBullets.forEach(b => b.active = false);
                if (this.boss) {
                    const bossKilled = this.boss.takeDamage(this.boss.maxHealth * 0.30); 
                    if (bossKilled) this.score += this.boss.scoreValue;
                }
                this.ultDamageApplied = true; // 锁死，防止每帧扣血
            }
        } else {
            this.ultDamageApplied = false; // 大招结束后解锁
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
        
        this.ctx.save();
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * 15;
            const dy = (Math.random() - 0.5) * 15;
            this.ctx.translate(dx, dy);
        }

        this.ctx.save(); 
        this.ctx.setLineDash([5, 15]); 
        this.ctx.lineWidth = 2; 
        this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
        this.ctx.beginPath(); 
        this.ctx.moveTo(this.playArea.minX, 0); 
        this.ctx.lineTo(this.playArea.minX, this.canvas.height);
        this.ctx.moveTo(this.playArea.maxX, 0); 
        this.ctx.lineTo(this.playArea.maxX, this.canvas.height);
        this.ctx.stroke(); 
        this.ctx.restore();
        
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
        
        this.ctx.restore();

        if (this.shakeTimer > 0) {
            const alpha = Math.min(1, this.shakeTimer / 0.2) * 0.6; 
            this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, 20); 
            this.ctx.fillRect(0, this.canvas.height - 20, this.canvas.width, 20); 
            this.ctx.fillRect(0, 0, 20, this.canvas.height); 
            this.ctx.fillRect(this.canvas.width - 20, 0, 20, this.canvas.height); 
        }

        this.drawPerformanceMonitor();
    }

    drawPerformanceMonitor() {
        const x = this.canvas.width - 150; 
        const y = this.canvas.height - 60;
        this.ctx.font = '12px Orbitron, Courier New'; 
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = this.fps < 45 ? '#ff4444' : '#00d4ff'; 
        this.ctx.fillText(`FPS: ${Math.round(this.fps)}`, x, y);
        this.ctx.fillStyle = this.frameTime > 16.6 ? '#ffaa00' : '#00d4ff'; 
        this.ctx.fillText(`FT:  ${this.frameTime.toFixed(1)}ms`, x, y + 15);
    }
}

window.addEventListener('DOMContentLoaded', () => { new Game().init(); });
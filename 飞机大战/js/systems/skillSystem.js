export default class SkillSystem {
    constructor() {
        this.energy = 0;
        this.maxEnergy = 100;
        this.state = 'CHARGING'; // 'CHARGING' | 'READY' | 'ACTIVE'
        this.activeTimer = 0;
        this.ultDuration = 2.0; // 必杀技持续 2 秒
        
        this.container = document.getElementById('ult-container');
        this.fill = document.getElementById('ult-fill');
        this.text = document.getElementById('ult-text');
    }

    init() {
        if (this.container) {
            this.container.classList.remove('hidden');
            this.updateUI();
        }
    }

    // 获取能量 (未来由 Enemy.die 调用)
    addEnergy(amount) {
        if (this.state !== 'CHARGING') return;
        
        this.energy = Math.min(this.energy + amount, this.maxEnergy);
        
        if (this.energy >= this.maxEnergy) {
            this.state = 'READY';
            this.container.classList.add('ult-ready');
            console.log("🔥 [SYSTEM] ULT READY! 等待手势触发...");
        }
        this.updateUI();
    }

    isReady() {
        return this.state === 'READY';
    }

    // 触发必杀技
    trigger() {
        if (!this.isReady()) return false;
        
        this.state = 'ACTIVE';
        this.activeTimer = this.ultDuration;
        this.container.classList.remove('ult-ready');
        
        console.log("🚀 [SYSTEM] ULT TRIGGERED! 全屏清除激活!");
        // TODO: Task 4 中将在此处调用 enemyManager.clearAll() 或 Boss.takeDamage()
        
        return true;
    }

    update(deltaTime) {
        if (this.state === 'ACTIVE') {
            this.activeTimer -= deltaTime;
            
            // 视觉效果：能量条迅速回退
            this.energy = (Math.max(0, this.activeTimer) / this.ultDuration) * this.maxEnergy;
            this.updateUI();
            
            if (this.activeTimer <= 0) {
                this.state = 'CHARGING';
                this.energy = 0;
                this.updateUI();
                console.log("✨ [SYSTEM] ULT 结束，重新开始充能。");
            }
        }
    }

    updateUI() {
        if (!this.fill || !this.text) return;
        
        this.fill.style.width = `${(this.energy / this.maxEnergy) * 100}%`;
        
        if (this.state === 'READY') {
            this.text.textContent = 'ULT READY! (⬆️ 抬手/RECOIL)';
        } else if (this.state === 'ACTIVE') {
            this.text.textContent = 'FIRING...';
        } else {
            this.text.textContent = `${Math.floor(this.energy)}%`;
        }
    }
}
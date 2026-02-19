export default class SkillSystem {
    constructor() {
        this.energy = 0;
        this.maxEnergy = 100;
        this.state = 'CHARGING'; // 'CHARGING' | 'READY' | 'ACTIVE'
        this.activeTimer = 0;
        this.ultDuration = 2.0; 
        
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

    addEnergy(amount) {
        if (this.state !== 'CHARGING') return;
        
        this.energy = Math.min(this.energy + amount, this.maxEnergy);
        
        if (this.energy >= this.maxEnergy) {
            this.state = 'READY';
            this.container.classList.add('ult-ready');
            // 文案替换
            console.log("🔥大招准备就绪! 等待手势触发...");
        }
        this.updateUI();
    }

    isReady() {
        return this.state === 'READY';
    }

    trigger() {
        if (!this.isReady()) return false;
        
        this.state = 'ACTIVE';
        this.activeTimer = this.ultDuration;
        this.container.classList.remove('ult-ready');
        
        console.log("🚀 [SYSTEM] ULT TRIGGERED! 全屏清除激活!");
        
        return true;
    }

    update(deltaTime) {
        if (this.state === 'ACTIVE') {
            this.activeTimer -= deltaTime;
            
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
            // 文案替换
            this.text.textContent = '🔥大招准备就绪! (⬆️ 抬起食指)';
        } else if (this.state === 'ACTIVE') {
            // 文案替换
            this.text.textContent = '击杀...';
        } else {
            this.text.textContent = `${Math.floor(this.energy)}%`;
        }
    }
}
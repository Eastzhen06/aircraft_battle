export default class SkillSystem {
    constructor() {
        this.energy = 0;
        this.maxEnergy = 100;
        
        // 【v4.5.2 核心】：大招多次存储机制
        this.charges = 0;
        this.maxCharges = 3;
        
        this.state = 'CHARGING'; // 'CHARGING' | 'ACTIVE'
        this.activeTimer = 0;
        this.ultDuration = 2.0; 
        
        this.wrapper = document.getElementById('ult-wrapper');
        this.fill = document.getElementById('ult-fill');
        this.text = document.getElementById('ult-text');
        this.chargeText = document.getElementById('ult-charges'); // 新增充能球 UI
    }

    init() {
        if (this.wrapper) {
            this.wrapper.classList.remove('hidden');
            this.updateUI();
        }
    }

    addEnergy(amount) {
        if (this.charges >= this.maxCharges) return; // 满仓锁定
        
        this.energy += amount;
        
        // 能量满 100 自动转换为 1 个 Charge，并保留溢出能量
        while (this.energy >= this.maxEnergy && this.charges < this.maxCharges) {
            this.charges++;
            this.energy -= this.maxEnergy;
            console.log(`🔥 获得 1 层大招充能! 当前可用大招数: ${this.charges}`);
        }
        
        if (this.charges >= this.maxCharges) {
            this.energy = 0; // 达到最高存储上限后，不显示冗余碎能量
        }
        
        this.updateUI();
    }

    isReady() {
        // 只要有一层或以上充能，即可释放
        return this.charges > 0 && this.state !== 'ACTIVE';
    }

    trigger() {
        if (!this.isReady()) return false;
        
        this.charges--; // 仅消耗 1 次使用权
        this.state = 'ACTIVE';
        this.activeTimer = this.ultDuration;
        
        console.log(`🚀 [SYSTEM] 大招释放! 剩余可用次数: ${this.charges}`);
        this.updateUI();
        return true;
    }

    update(deltaTime) {
        if (this.state === 'ACTIVE') {
            this.activeTimer -= deltaTime;
            this.updateUI();
            
            if (this.activeTimer <= 0) {
                this.state = 'CHARGING';
                this.updateUI();
            }
        }
    }

    updateUI() {
        if (!this.fill || !this.text || !this.chargeText) return;
        
        // 满级时进度条显示为满
        let displayEnergy = this.charges >= this.maxCharges ? this.maxEnergy : this.energy;
        this.fill.style.width = `${(displayEnergy / this.maxEnergy) * 100}%`;
        
        this.chargeText.textContent = this.charges; // 更新红圈数字
        
        if (this.state === 'ACTIVE') {
            this.text.textContent = '全屏清剿中...';
            this.fill.parentNode.classList.remove('ult-ready');
        } else if (this.isReady()) {
            this.text.textContent = '可以触发大招';
            this.fill.parentNode.classList.add('ult-ready');
        } else {
            this.text.textContent = `${Math.floor(displayEnergy)}%`;
            this.fill.parentNode.classList.remove('ult-ready');
        }
    }
}
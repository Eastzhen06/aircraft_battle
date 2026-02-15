class AdvancedBoss extends Boss {
    constructor(x, y, bossType, difficulty) {
        super(x, y, difficulty);
        
        const bossData = BOSS_TYPES[bossType] || BOSS_TYPES.scout;
        
        this.bossType = bossType;
        this.name = bossData.name;
        
        // Map boss type to image
        const bossImageMap = {
            'scout': 'b1',
            'assault': 'b2',
            'fortress': 'b3',
            'stealth': 'b4',
            'storm': 'b5',
            'vortex': 'b6',
            'judgment': 'b7',
            'doom': 'b8',
            'emperor': 'b9'
        };
        this.imageKey = bossImageMap[bossType] || 'b9';
        
        this.health = bossData.health * GAME_CONFIG.DIFFICULTY[difficulty].enemyHealthMult;
        this.maxHealth = this.health;
        this.patterns = bossData.patterns;
        this.specialAbility = bossData.special;
        this.color = bossData.color;
        
        this.specialTimer = 0;
        this.specialInterval = 8000;
        this.isExecutingSpecial = false;
        
        this.isCloaked = false;
        this.shieldActive = false;
        this.shieldHealth = 0;
    }
    
    update(deltaTime, canvasWidth, canvasHeight, player) {
        super.update(deltaTime, canvasWidth, canvasHeight, player);
        
        this.specialTimer += deltaTime;
        
        if (this.specialTimer >= this.specialInterval && !this.isExecutingSpecial) {
            this.executeSpecialAbility();
            this.specialTimer = 0;
        }
    }
    
    executeSpecialAbility() {
        this.isExecutingSpecial = true;
        
        switch (this.specialAbility) {
            case 'quickDash':
                this.quickDash();
                break;
            case 'barrage':
                this.barrageAttack();
                break;
            case 'shieldRegen':
                this.regenShield();
                break;
            case 'cloak':
                this.activateCloak();
                break;
            case 'lightning':
                this.lightningStrike();
                break;
            case 'gravity':
                this.gravityWell();
                break;
            case 'judgment':
                this.judgmentBeam();
                break;
            case 'doom':
                this.doomsday();
                break;
            case 'emperor':
                this.emperorAttack();
                break;
        }
        
        setTimeout(() => {
            this.isExecutingSpecial = false;
        }, 2000);
    }
    
    quickDash() {
        const targetX = randomRange(this.width / 2, this.canvasWidth - this.width / 2);
        this.x = targetX;
        particleSystem.createExplosion(this.x, this.y, 0.5);
    }
    
    barrageAttack() {
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                if (!this.active) return;
                const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
                this.bulletPool.spawn(
                    this.x + randomRange(-30, 30),
                    this.y + this.height / 2,
                    Math.cos(angle) * 6,
                    Math.sin(angle) * 6,
                    15, true, 6, 6
                );
            }, i * 100);
        }
    }
    
    regenShield() {
        this.shieldActive = true;
        this.shieldHealth = 500;
    }
    
    activateCloak() {
        this.isCloaked = true;
        setTimeout(() => {
            this.isCloaked = false;
        }, 3000);
    }
    
    lightningStrike() {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!this.active || !this.player) return;
                const x = this.player.x + randomRange(-50, 50);
                for (let j = 0; j < 10; j++) {
                    this.bulletPool.spawn(
                        x,
                        j * 50,
                        0,
                        15,
                        30, true, 4, 20
                    );
                }
            }, i * 400);
        }
    }
    
    gravityWell() {
        const centerX = this.x;
        const centerY = this.y + 100;
        
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                if (!this.active) return;
                const angle = (Math.PI * 2 / 30) * i;
                const radius = 100;
                this.bulletPool.spawn(
                    centerX + Math.cos(angle) * radius,
                    centerY + Math.sin(angle) * radius,
                    -Math.cos(angle) * 2,
                    -Math.sin(angle) * 2,
                    20, true, 8, 8
                );
            }, i * 50);
        }
    }
    
    judgmentBeam() {
        this.isExecutingSpecial = true;
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                if (!this.active) return;
                this.bulletPool.spawn(
                    this.x,
                    this.y + this.height / 2,
                    0,
                    10,
                    25, true, 20, 15
                );
            }, i * 40);
        }
    }
    
    doomsday() {
        for (let wave = 0; wave < 3; wave++) {
            setTimeout(() => {
                if (!this.active) return;
                for (let i = 0; i < 24; i++) {
                    const angle = (Math.PI * 2 / 24) * i + wave * 0.13;
                    this.bulletPool.spawn(
                        this.x,
                        this.y,
                        Math.cos(angle) * 4,
                        Math.sin(angle) * 4,
                        20, true, 6, 6
                    );
                }
            }, wave * 500);
        }
    }
    
    emperorAttack() {
        this.shootSpread(this.bulletPool);
        setTimeout(() => this.shootCircle(this.bulletPool), 300);
        setTimeout(() => this.shootSpiral(this.bulletPool), 600);
        setTimeout(() => this.shootLaser(this.bulletPool, this.player?.x || 400, this.player?.y || 700), 900);
    }
    
    takeDamage(damage) {
        if (this.isCloaked) {
            return false;
        }
        
        if (this.shieldActive && this.shieldHealth > 0) {
            this.shieldHealth -= damage;
            if (this.shieldHealth <= 0) {
                this.shieldActive = false;
            }
            particleSystem.createShieldHit(this.x, this.y);
            return false;
        }
        
        return super.takeDamage(damage);
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.isCloaked) {
            ctx.globalAlpha = 0.2;
        }
        
        if (this.shieldActive) {
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(100, 100, 255, 0.3)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(100, 100, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.02;
        ctx.scale(pulse, pulse);
        
        const gradient = ctx.createLinearGradient(-this.width/2, -this.height/2, this.width/2, this.height/2);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(0.5, this.lightenColor(this.color, 30));
        gradient.addColorStop(1, this.color);
        
        ctx.fillStyle = gradient;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 25;
        
        this.drawShape(ctx);
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        this.drawHealthBar(ctx);
        
        ctx.restore();
    }
    
    drawShape(ctx) {
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(this.width / 2, -this.height / 4);
        ctx.lineTo(this.width / 2, this.height / 4);
        ctx.lineTo(this.width / 4, this.height / 2);
        ctx.lineTo(-this.width / 4, this.height / 2);
        ctx.lineTo(-this.width / 2, this.height / 4);
        ctx.lineTo(-this.width / 2, -this.height / 4);
        ctx.closePath();
        ctx.fill();
    }
    
    drawHealthBar(ctx) {
        const healthPercent = this.health / this.maxHealth;
        const barWidth = this.width;
        const barHeight = 10;
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(-barWidth / 2, -this.height / 2 - 25, barWidth, barHeight);
        
        const healthColor = healthPercent > 0.5 ? '#44ff44' : healthPercent > 0.25 ? '#ffff44' : '#ff4444';
        ctx.fillStyle = healthColor;
        ctx.shadowColor = healthColor;
        ctx.shadowBlur = 5;
        ctx.fillRect(-barWidth / 2, -this.height / 2 - 25, barWidth * healthPercent, barHeight);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText(this.name, 0, -this.height / 2 - 32);
    }
    
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
}

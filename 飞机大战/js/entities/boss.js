export default class Boss {
    constructor(level, playArea) {
        this.active = true;
        this.type = 'boss';
        
        this.width = 150;
        this.height = 100;
        
        // CEO 指示公式: Base_Player_DPS = 10(dmg) * 7(rate) = 70. 70 * 40s = 2800.
        // 注意公式中的 Level - 2，因为 Boss 从第二关开始才需要递增
        const powerLevel = Math.max(0, level - 2); 
        this.maxHealth = 2800 * Math.pow(1.2, powerLevel);
        this.health = this.maxHealth;
        this.speed = 100 + level * 10;
        
        // 从顶端居中入场
        this.x = (playArea.maxX - playArea.minX) / 2 + playArea.minX;
        this.y = -this.height; 
        
        this.phase = 1;
        this.attackPattern = 0;
        this.attackTimer = 0;
        this.attackInterval = 2.0; // 秒
        this.moveTimer = 0;
        this.targetX = this.x;
        
        this.entering = true;
        this.entered = false;
        this.angle = 0;
        this.pulsePhase = 0;
        
        // 继承原版华丽弹幕模式
        this.patterns = ['spread', 'spiral', 'laser', 'circle'];
        this.currentPatternIndex = 0;
    }
    
    update(deltaTime, canvasWidth, canvasHeight, player, playArea) {
        if (!this.active) return;
        
        this.pulsePhase += deltaTime * 5.0;
        this.angle += deltaTime * 2.0;
        
        if (this.entering) {
            this.y += 100 * deltaTime;
            if (this.y >= 150) {
                this.y = 150;
                this.entering = false;
                this.entered = true;
            }
            return;
        }
        
        this.moveTimer += deltaTime;
        this.attackTimer += deltaTime;
        
        // 动态边界巡逻
        if (this.moveTimer > 2.0) {
            this.moveTimer = 0;
            const safeMinX = playArea.minX + this.width / 2 + 50;
            const safeMaxX = playArea.maxX - this.width / 2 - 50;
            this.targetX = Math.random() * (safeMaxX - safeMinX) + safeMinX;
        }
        
        const dx = this.targetX - this.x;
        if (Math.abs(dx) > 5) {
            this.x += Math.sign(dx) * this.speed * deltaTime;
        }
        
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent < 0.3 && this.phase < 3) {
            this.phase = 3;
            this.attackInterval = 1.0;
        } else if (healthPercent < 0.6 && this.phase < 2) {
            this.phase = 2;
            this.attackInterval = 1.5;
        }
    }
    
    shouldShoot() {
        if (!this.entered) return false;
        if (this.attackTimer >= this.attackInterval) {
            this.attackTimer = 0;
            return true;
        }
        return false;
    }
    
    // 弹幕生成将通过 game.js 注入 bulletPool 处理
    shoot(game) {
        const pattern = this.patterns[this.currentPatternIndex];
        this.currentPatternIndex = (this.currentPatternIndex + 1) % this.patterns.length;
        
        switch (pattern) {
            case 'spread': this.shootSpread(game); break;
            case 'spiral': this.shootSpiral(game); break;
            case 'laser':  this.shootLaser(game); break;
            case 'circle': this.shootCircle(game); break;
        }
    }
    
    shootSpread(game) {
        const bulletCount = 5 + this.phase * 2;
        const spreadAngle = Math.PI / 3;
        const startAngle = Math.PI / 2 - spreadAngle / 2;
        for (let i = 0; i < bulletCount; i++) {
            const angle = startAngle + (spreadAngle / (bulletCount - 1)) * i;
            // 负角度传给 bullet.angleOffset (原引擎设定)
            game.spawnEnemyBullet(this.x, this.y + this.height / 2, 300, 10, angle - Math.PI/2);
        }
    }
    
    shootSpiral(game) {
        const bulletCount = 8 + this.phase * 4;
        for (let i = 0; i < bulletCount; i++) {
            const angle = this.angle + (Math.PI * 2 / bulletCount) * i;
            setTimeout(() => {
                if (!this.active) return;
                game.spawnEnemyBullet(this.x, this.y + this.height / 2, 250, 10, angle - Math.PI/2);
            }, i * 50);
        }
    }
    
    shootLaser(game) {
        if (!game.player) return;
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const baseAngle = Math.atan2(dy, dx);
        
        for (let i = -1; i <= 1; i++) {
            const angle = baseAngle + i * 0.15;
            game.spawnEnemyBullet(this.x, this.y + this.height / 2, 450, 20, angle - Math.PI/2, true); // true for pierce/laser style
        }
    }
    
    shootCircle(game) {
        const bulletCount = 12 + this.phase * 4;
        for (let i = 0; i < bulletCount; i++) {
            const angle = (Math.PI * 2 / bulletCount) * i;
            game.spawnEnemyBullet(this.x, this.y + this.height / 2, 200, 10, angle - Math.PI/2);
        }
    }
    
    takeDamage(damage) {
        if (this.entering) return false;
        this.health -= damage;
        if (this.health <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }
    
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.02;
        ctx.scale(pulse, pulse);
        
        // 继承原版 Boss 复杂几何绘制
        const gradient = ctx.createLinearGradient(-this.width/2, -this.height/2, this.width/2, this.height/2);
        gradient.addColorStop(0, '#ff4444');
        gradient.addColorStop(0.5, '#ff8844');
        gradient.addColorStop(1, '#ff4444');
        
        ctx.fillStyle = gradient;
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 20;
        
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
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#880000';
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 3);
        ctx.lineTo(this.width / 3, 0);
        ctx.lineTo(0, this.height / 3);
        ctx.lineTo(-this.width / 3, 0);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 血条绘制
        const healthPercent = this.health / this.maxHealth;
        const barWidth = this.width;
        const barHeight = 8;
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(-barWidth / 2, -this.height / 2 - 20, barWidth, barHeight);
        
        const healthColor = healthPercent > 0.5 ? '#44ff44' : healthPercent > 0.25 ? '#ffff44' : '#ff4444';
        ctx.fillStyle = healthColor;
        ctx.shadowColor = healthColor;
        ctx.shadowBlur = 5;
        ctx.fillRect(-barWidth / 2, -this.height / 2 - 20, barWidth * healthPercent, barHeight);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Orbitron, Arial';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText(`BOSS - Lv.${this.phase}`, 0, -this.height / 2 - 25);
        
        ctx.restore();
    }
}
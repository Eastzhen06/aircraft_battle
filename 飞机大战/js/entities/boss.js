export default class Boss {
    constructor(level, playArea) {
        this.active = true;
        this.type = 'boss';
        
        this.bossIndex = Math.min(9, Math.max(1, level - 1));
        this.imageKey = 'b' + this.bossIndex;
        
        // 【修复 5】基于交互区宽度，Boss 设定为 85% 且按原图比例换算不拉伸
        const interactiveWidth = playArea.maxX - playArea.minX;
        this.width = interactiveWidth * 0.85;
        this.height = this.width * (140 / 180); 
        
        this.scoreValue = 5000 * level; 
        
        const powerLevel = Math.max(0, level - 2); 
        let baseMultiplier = 1.0;
        if (this.bossIndex === 3) baseMultiplier = 1.5; 
        if (this.bossIndex === 1) baseMultiplier = 0.8; 
        if (this.bossIndex === 9) baseMultiplier = 2.5; 
        
        this.maxHealth = 2800 * Math.pow(1.2, powerLevel) * baseMultiplier;
        this.health = this.maxHealth;
        this.speed = 100 + level * 5;
        
        this.x = (playArea.maxX - playArea.minX) / 2 + playArea.minX;
        this.y = -this.height; 
        
        this.phase = 1;
        this.attackTimer = 0;
        this.attackInterval = this.bossIndex === 1 ? 1.0 : 2.0; 
        this.moveTimer = 0;
        this.targetX = this.x;
        
        this.entering = true;
        this.entered = false;
        this.angle = 0;
    }
    
    update(deltaTime, canvasWidth, canvasHeight, player, playArea) {
        if (!this.active) return;
        this.angle += deltaTime * 2.0;
        
        if (this.entering) {
            this.y += 100 * deltaTime;
            this.attackTimer += deltaTime; 
            if (this.y >= 150) {
                this.y = 150;
                this.entering = false;
                this.entered = true;
            }
        } else {
            this.moveTimer += deltaTime;
            this.attackTimer += deltaTime;
            
            if (this.bossIndex === 4 && this.moveTimer > 3.0) {
                this.x = Math.random() * (playArea.maxX - playArea.minX - this.width) + playArea.minX + this.width/2;
                this.moveTimer = 0;
            } else if (this.bossIndex === 2 && this.moveTimer > 4.0) {
                this.y += 200 * deltaTime;
                if(this.y > 300) this.moveTimer = 0;
            } else {
                if (this.y > 150) this.y -= 50 * deltaTime; 
                if (this.moveTimer > 2.0) {
                    this.moveTimer = 0;
                    const safeMinX = playArea.minX + this.width / 2 + 20;
                    const safeMaxX = playArea.maxX - this.width / 2 - 20;
                    this.targetX = Math.random() * (safeMaxX - safeMinX) + safeMinX;
                }
                const dx = this.targetX - this.x;
                if (Math.abs(dx) > 5) {
                    let spd = (this.bossIndex === 1 || this.bossIndex === 5) ? this.speed * 1.5 : this.speed;
                    this.x += Math.sign(dx) * spd * deltaTime;
                }
            }
        }
        
        this.x = Math.max(playArea.minX + this.width/2, Math.min(this.x, playArea.maxX - this.width/2));
        
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent < 0.3 && this.phase < 3) {
            this.phase = 3; this.attackInterval *= 0.6;
        } else if (healthPercent < 0.6 && this.phase < 2) {
            this.phase = 2; this.attackInterval *= 0.8;
        }
    }
    
    shouldShoot() {
        if (this.attackTimer >= this.attackInterval) {
            this.attackTimer = 0;
            return true;
        }
        return false;
    }
    
    shoot(game) {
        switch(this.bossIndex) {
            case 1: this.shootSpread(game, 5); break; 
            case 2: this.shootLaser(game, false); break; 
            case 3: this.shootCircle(game, 12); break; 
            case 4: this.shootSpiral(game, 4); break; 
            case 5: this.shootSpread(game, 9); break; 
            case 6: this.shootSpiral(game, 8); break; 
            case 7: this.shootLaser(game, true); break; 
            case 8: this.shootCircle(game, 20); this.shootSpiral(game, 4); break; 
            case 9: 
                let r = Math.random();
                if(r < 0.3) this.shootCircle(game, 24);
                else if (r < 0.6) this.shootLaser(game, true);
                else this.shootSpiral(game, 10);
                break;
        }
    }
    
    shootSpread(game, count) {
        const spreadAngle = Math.PI / 2;
        const startAngle = Math.PI / 2 - spreadAngle / 2;
        for (let i = 0; i < count + this.phase; i++) {
            const angle = startAngle + (spreadAngle / (count - 1)) * i;
            game.spawnEnemyBullet(this.x, this.y + this.height/2, 300, 10, angle - Math.PI/2);
        }
    }
    
    shootSpiral(game, count) {
        for (let i = 0; i < count + this.phase; i++) {
            const angle = this.angle + (Math.PI * 2 / count) * i;
            game.spawnEnemyBullet(this.x, this.y + this.height/2, 250, 10, angle);
        }
    }
    
    shootLaser(game, isRealLaser) {
        if (!game.player) return;
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const baseAngle = Math.atan2(dy, dx);
        for (let i = -1; i <= 1; i++) {
            const angle = baseAngle + i * 0.1;
            game.spawnEnemyBullet(this.x, this.y + this.height/2, 450, 20, angle - Math.PI/2, isRealLaser);
        }
    }
    
    shootCircle(game, count) {
        for (let i = 0; i < count + this.phase*2; i++) {
            const angle = (Math.PI * 2 / count) * i;
            game.spawnEnemyBullet(this.x, this.y + this.height/2, 200, 15, angle);
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
        
        const img = window.imageLoader ? window.imageLoader.get(this.imageKey) : null;
        if (img) {
            ctx.drawImage(img, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        } else {
            ctx.fillStyle = 'purple';
            ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        }
        
        const healthPercent = this.health / this.maxHealth;
        const barWidth = 600;
        const barHeight = 15;
        const canvasWidth = ctx.canvas.width;
        const screenX = canvasWidth / 2 - barWidth / 2;
        const screenY = 20;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(screenX, screenY, barWidth, barHeight);
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, barWidth, barHeight);
        
        const healthColor = healthPercent > 0.5 ? '#44ff44' : healthPercent > 0.25 ? '#ffff44' : '#ff0055';
        ctx.fillStyle = healthColor;
        ctx.fillRect(screenX, screenY, barWidth * healthPercent, barHeight);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Orbitron, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`BOSS Lv.${this.bossIndex} - Phase ${this.phase}`, canvasWidth / 2, screenY + 12);
    }
}
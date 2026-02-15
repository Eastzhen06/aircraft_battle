class Boss {
    constructor(x, y, difficulty) {
        this.x = x;
        this.y = y;
        this.difficulty = difficulty;
        this.type = 'boss';
        
        // Random boss sprite
        this.imageKey = 'b' + (Math.floor(Math.random() * 9) + 1);
        
        const diffConfig = GAME_CONFIG.DIFFICULTY[difficulty];
        
        this.width = 150;
        this.height = 100;
        this.health = 2000 * diffConfig.enemyHealthMult;
        this.maxHealth = this.health;
        this.speed = 1.5 * diffConfig.enemySpeedMult;
        this.score = 5000;
        
        this.active = true;
        this.phase = 1;
        this.attackPattern = 0;
        this.attackTimer = 0;
        this.attackInterval = 2000;
        this.moveTimer = 0;
        this.targetX = x;
        this.entering = true;
        this.entered = false;
        this.angle = 0;
        this.pulsePhase = 0;
        
        this.patterns = ['spread', 'spiral', 'laser', 'circle'];
        this.currentPatternIndex = 0;
    }
    
    update(deltaTime, canvasWidth, canvasHeight, player) {
        this.pulsePhase += deltaTime * 0.005;
        this.angle += deltaTime * 0.002;
        
        if (this.entering) {
            this.y += 1;
            if (this.y >= 80) {
                this.entering = false;
                this.entered = true;
            }
            return;
        }
        
        this.moveTimer += deltaTime;
        this.attackTimer += deltaTime;
        
        if (this.moveTimer > 2000) {
            this.moveTimer = 0;
            this.targetX = randomRange(this.width / 2 + 50, canvasWidth - this.width / 2 - 50);
        }
        
        const dx = this.targetX - this.x;
        if (Math.abs(dx) > 2) {
            this.x += Math.sign(dx) * this.speed;
        }
        
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent < 0.3 && this.phase < 3) {
            this.phase = 3;
            this.attackInterval = 1000;
        } else if (healthPercent < 0.6 && this.phase < 2) {
            this.phase = 2;
            this.attackInterval = 1500;
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
    
    shoot(bulletPool, playerX, playerY) {
        const pattern = this.patterns[this.currentPatternIndex];
        this.currentPatternIndex = (this.currentPatternIndex + 1) % this.patterns.length;
        
        switch (pattern) {
            case 'spread':
                this.shootSpread(bulletPool);
                break;
            case 'spiral':
                this.shootSpiral(bulletPool);
                break;
            case 'laser':
                this.shootLaser(bulletPool, playerX, playerY);
                break;
            case 'circle':
                this.shootCircle(bulletPool);
                break;
        }
    }
    
    shootSpread(bulletPool) {
        const bulletCount = 5 + this.phase * 2;
        const spreadAngle = Math.PI / 3;
        const startAngle = Math.PI / 2 - spreadAngle / 2;
        
        for (let i = 0; i < bulletCount; i++) {
            const angle = startAngle + (spreadAngle / (bulletCount - 1)) * i;
            const speed = 4 + this.phase;
            
            bulletPool.spawn(
                this.x,
                this.y + this.height / 2,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                20,
                true,
                8,
                8
            );
        }
    }
    
    shootSpiral(bulletPool) {
        const bulletCount = 8 + this.phase * 4;
        
        for (let i = 0; i < bulletCount; i++) {
            const angle = this.angle + (Math.PI * 2 / bulletCount) * i;
            const speed = 3 + this.phase * 0.5;
            
            setTimeout(() => {
                if (!this.active) return;
                bulletPool.spawn(
                    this.x,
                    this.y + this.height / 2,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    15,
                    true,
                    6,
                    6
                );
            }, i * 50);
        }
    }
    
    shootLaser(bulletPool, playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 6 + this.phase;
        
        for (let i = -1; i <= 1; i++) {
            const angle = Math.atan2(dy, dx) + i * 0.15;
            bulletPool.spawn(
                this.x,
                this.y + this.height / 2,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                25,
                true,
                10,
                10
            );
        }
    }
    
    shootCircle(bulletPool) {
        const bulletCount = 12 + this.phase * 4;
        
        for (let i = 0; i < bulletCount; i++) {
            const angle = (Math.PI * 2 / bulletCount) * i;
            const speed = 3;
            
            bulletPool.spawn(
                this.x,
                this.y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                15,
                true,
                6,
                6
            );
        }
    }
    
    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.02;
        ctx.scale(pulse, pulse);
        
        // Use image if available
        const img = window.imageLoader.get(this.imageKey);
        
        if (img) {
            ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
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
        }
        
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
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText('BOSS', 0, -this.height / 2 - 25);
        
        ctx.restore();
    }
}

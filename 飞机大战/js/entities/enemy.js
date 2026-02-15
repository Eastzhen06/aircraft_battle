class Enemy {
    constructor(x, y, type, difficulty) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.difficulty = difficulty;
        
        const config = GAME_CONFIG.ENEMY[type.toUpperCase()];
        const diffConfig = GAME_CONFIG.DIFFICULTY[difficulty];
        
        this.width = config.WIDTH;
        this.height = config.HEIGHT;
        this.health = config.HEALTH * diffConfig.enemyHealthMult;
        this.maxHealth = this.health;
        this.speed = config.SPEED * diffConfig.enemySpeedMult;
        this.score = config.SCORE;
        this.shootChance = config.SHOOT_CHANCE * diffConfig.enemyShootMult;
        
        this.active = true;
        this.shootTimer = 0;
        this.movePattern = this.selectMovePattern();
        this.moveTimer = 0;
        this.originalX = x;
        this.angle = 0;

        // Assign image based on type
        if (type === ENEMY_TYPES.SMALL) {
            this.imageKey = 'e' + randomInt(1, 3);
        } else if (type === ENEMY_TYPES.MEDIUM) {
            this.imageKey = 'e' + randomInt(4, 6);
        } else if (type === ENEMY_TYPES.LARGE) {
            this.imageKey = 'e' + randomInt(7, 9);
        }
    }
    
    selectMovePattern() {
        const patterns = ['straight', 'zigzag', 'sine', 'diagonal'];
        return patterns[randomInt(0, patterns.length - 1)];
    }
    
    update(deltaTime, canvasWidth, canvasHeight) {
        this.moveTimer += deltaTime;
        this.angle += deltaTime * 0.003;
        
        switch (this.movePattern) {
            case 'straight':
                this.y += this.speed;
                break;
            case 'zigzag':
                this.y += this.speed;
                this.x += Math.sin(this.moveTimer * 0.005) * 2;
                break;
            case 'sine':
                this.y += this.speed;
                this.x = this.originalX + Math.sin(this.angle * 2) * 50;
                break;
            case 'diagonal':
                this.y += this.speed * 0.8;
                this.x += Math.sin(this.angle) * 1.5;
                break;
        }
        
        this.x = clamp(this.x, this.width / 2, canvasWidth - this.width / 2);
        
        if (this.y > canvasHeight + this.height) {
            this.active = false;
        }
    }
    
    shouldShoot() {
        return Math.random() < this.shootChance;
    }
    
    shoot(bulletPool) {
        const bulletConfig = GAME_CONFIG.BULLET.ENEMY;
        const diffConfig = GAME_CONFIG.DIFFICULTY[this.difficulty];
        const speed = bulletConfig.SPEED * diffConfig.enemySpeedMult;
        
        if (this.type === ENEMY_TYPES.SMALL) {
            // Small: Single straight shot
            bulletPool.spawn(this.x, this.y + this.height / 2, 0, speed, bulletConfig.DAMAGE, true, bulletConfig.WIDTH, bulletConfig.HEIGHT);
        } else if (this.type === ENEMY_TYPES.MEDIUM) {
            // Medium: 3-way spread
            bulletPool.spawn(this.x, this.y + this.height / 2, 0, speed, bulletConfig.DAMAGE, true, bulletConfig.WIDTH, bulletConfig.HEIGHT);
            bulletPool.spawn(this.x, this.y + this.height / 2, -0.5, speed * 0.9, bulletConfig.DAMAGE, true, bulletConfig.WIDTH, bulletConfig.HEIGHT);
            bulletPool.spawn(this.x, this.y + this.height / 2, 0.5, speed * 0.9, bulletConfig.DAMAGE, true, bulletConfig.WIDTH, bulletConfig.HEIGHT);
        } else if (this.type === ENEMY_TYPES.LARGE) {
            // Large: 5-way spread + heavier damage
            for (let i = -2; i <= 2; i++) {
                bulletPool.spawn(
                    this.x, 
                    this.y + this.height / 2, 
                    i * 0.4, 
                    speed * (1 - Math.abs(i) * 0.1), 
                    bulletConfig.DAMAGE * 1.5, 
                    true, 
                    bulletConfig.WIDTH * 1.5, 
                    bulletConfig.HEIGHT * 1.5
                );
            }
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
        // Removed rotation as images are already oriented correctly (facing down)
        // ctx.rotate(this.angle); 
        
        // Use image if available
        const img = window.imageLoader.get(this.imageKey);
        
        if (img) {
            ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            let color;
            switch (this.type) {
                case ENEMY_TYPES.SMALL:
                    color = GAME_CONFIG.COLORS.ENEMY_SMALL;
                    break;
                case ENEMY_TYPES.MEDIUM:
                    color = GAME_CONFIG.COLORS.ENEMY_MEDIUM;
                    break;
                case ENEMY_TYPES.LARGE:
                    color = GAME_CONFIG.COLORS.ENEMY_LARGE;
                    break;
            }
            
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            
            if (this.type === ENEMY_TYPES.SMALL) {
                ctx.beginPath();
                ctx.moveTo(0, -this.height / 2);
                ctx.lineTo(this.width / 2, this.height / 2);
                ctx.lineTo(-this.width / 2, this.height / 2);
                ctx.closePath();
                ctx.fill();
            } else if (this.type === ENEMY_TYPES.MEDIUM) {
                ctx.beginPath();
                ctx.moveTo(0, -this.height / 2);
                ctx.lineTo(this.width / 2, 0);
                ctx.lineTo(this.width / 3, this.height / 2);
                ctx.lineTo(-this.width / 3, this.height / 2);
                ctx.lineTo(-this.width / 2, 0);
                ctx.closePath();
                ctx.fill();
            } else {
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
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 6, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Health bar for medium/large enemies
        if (this.type !== ENEMY_TYPES.SMALL && this.health < this.maxHealth) {
            const healthPercent = this.health / this.maxHealth;
            const barWidth = this.width;
            const barHeight = 4;
            
            ctx.rotate(-this.angle); // Keep health bar horizontal
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(-barWidth / 2, -this.height / 2 - 10, barWidth, barHeight);
            
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-barWidth / 2, -this.height / 2 - 10, barWidth * healthPercent, barHeight);
        }
        
        ctx.restore();
    }
}

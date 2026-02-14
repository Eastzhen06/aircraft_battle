class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = GAME_CONFIG.PLAYER.WIDTH;
        this.height = GAME_CONFIG.PLAYER.HEIGHT;
        this.speed = GAME_CONFIG.PLAYER.SPEED;
        this.health = GAME_CONFIG.PLAYER.MAX_HEALTH;
        this.maxHealth = GAME_CONFIG.PLAYER.MAX_HEALTH;
        this.lives = GAME_CONFIG.PLAYER.INITIAL_LIVES;
        this.powerLevel = 1;
        this.maxPowerLevel = 5;
        this.isInvincible = false;
        this.invincibleTimer = 0;
        this.hasShield = false;
        this.shieldTimer = 0;
        this.shootCooldown = 0;
        this.shootCooldownMax = GAME_CONFIG.PLAYER.SHOOT_COOLDOWN;
        this.visible = true;
        this.blinkTimer = 0;
        this.moveX = 0;
        this.moveY = 0;
        this.tilt = 0;
    }
    
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.health = this.maxHealth;
        this.lives = GAME_CONFIG.PLAYER.INITIAL_LIVES;
        this.powerLevel = 1;
        this.isInvincible = false;
        this.hasShield = false;
        this.shootCooldown = 0;
        this.visible = true;
        this.tilt = 0;
    }
    
    move(dx, dy, canvasWidth, canvasHeight) {
        this.x = clamp(this.x + dx * this.speed, this.width / 2, canvasWidth - this.width / 2);
        this.y = clamp(this.y + dy * this.speed, this.height / 2, canvasHeight - this.height / 2);
        
        this.tilt = dx * 0.3;
    }
    
    shoot(bulletPool) {
        if (this.shootCooldown > 0) return [];
        
        const bullets = [];
        const bulletConfig = GAME_CONFIG.BULLET.PLAYER;
        const damage = bulletConfig.DAMAGE * (1 + (this.powerLevel - 1) * 0.3);
        
        if (this.powerLevel === 1) {
            bullets.push(bulletPool.spawn(
                this.x, 
                this.y - this.height / 2,
                0, 
                -bulletConfig.SPEED,
                damage,
                false,
                bulletConfig.WIDTH,
                bulletConfig.HEIGHT
            ));
        } else if (this.powerLevel === 2) {
            bullets.push(bulletPool.spawn(this.x - 10, this.y - this.height / 2, 0, -bulletConfig.SPEED, damage, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
            bullets.push(bulletPool.spawn(this.x + 10, this.y - this.height / 2, 0, -bulletConfig.SPEED, damage, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
        } else if (this.powerLevel === 3) {
            bullets.push(bulletPool.spawn(this.x, this.y - this.height / 2, 0, -bulletConfig.SPEED, damage, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
            bullets.push(bulletPool.spawn(this.x - 15, this.y - this.height / 2 + 10, -1, -bulletConfig.SPEED, damage, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
            bullets.push(bulletPool.spawn(this.x + 15, this.y - this.height / 2 + 10, 1, -bulletConfig.SPEED, damage, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
        } else if (this.powerLevel >= 4) {
            bullets.push(bulletPool.spawn(this.x - 8, this.y - this.height / 2, 0, -bulletConfig.SPEED, damage, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
            bullets.push(bulletPool.spawn(this.x + 8, this.y - this.height / 2, 0, -bulletConfig.SPEED, damage, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
            bullets.push(bulletPool.spawn(this.x - 20, this.y - this.height / 2 + 10, -2, -bulletConfig.SPEED, damage * 0.8, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
            bullets.push(bulletPool.spawn(this.x + 20, this.y - this.height / 2 + 10, 2, -bulletConfig.SPEED, damage * 0.8, false, bulletConfig.WIDTH, bulletConfig.HEIGHT));
            
            if (this.powerLevel >= 5) {
                bullets.push(bulletPool.spawn(this.x, this.y - this.height / 2 - 5, 0, -bulletConfig.SPEED * 1.2, damage * 1.5, false, bulletConfig.WIDTH + 2, bulletConfig.HEIGHT + 5));
            }
        }
        
        this.shootCooldown = this.shootCooldownMax / (1 + (this.powerLevel - 1) * 0.1);
        soundManager.playShoot();
        
        return bullets;
    }
    
    takeDamage(damage) {
        if (this.isInvincible || this.hasShield) {
            if (this.hasShield) {
                particleSystem.createShieldHit(this.x, this.y);
            }
            return false;
        }
        
        this.health -= damage;
        soundManager.playHit();
        
        if (this.health <= 0) {
            this.lives--;
            if (this.lives > 0) {
                this.health = this.maxHealth;
                this.activateInvincibility();
                return false;
            }
            return true;
        }
        
        return false;
    }
    
    activateInvincibility() {
        this.isInvincible = true;
        this.invincibleTimer = GAME_CONFIG.PLAYER.INVINCIBLE_TIME;
    }
    
    activateShield(duration) {
        this.hasShield = true;
        this.shieldTimer = duration;
    }
    
    heal(amount) {
        this.health = Math.min(this.health + amount, this.maxHealth);
    }
    
    increasePower() {
        if (this.powerLevel < this.maxPowerLevel) {
            this.powerLevel++;
        }
    }
    
    update(deltaTime) {
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }
        
        if (this.isInvincible) {
            this.invincibleTimer -= deltaTime;
            this.blinkTimer += deltaTime;
            
            if (this.blinkTimer > 100) {
                this.visible = !this.visible;
                this.blinkTimer = 0;
            }
            
            if (this.invincibleTimer <= 0) {
                this.isInvincible = false;
                this.visible = true;
            }
        }
        
        if (this.hasShield) {
            this.shieldTimer -= deltaTime;
            if (this.shieldTimer <= 0) {
                this.hasShield = false;
            }
        }
        
        this.tilt *= 0.9;
    }
    
    draw(ctx) {
        if (!this.visible) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt);
        
        if (this.hasShield) {
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = GAME_CONFIG.COLORS.SHIELD;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.fillStyle = GAME_CONFIG.COLORS.PLAYER;
        ctx.shadowColor = GAME_CONFIG.COLORS.PLAYER;
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(-this.width / 2, this.height / 2);
        ctx.lineTo(-this.width / 4, this.height / 3);
        ctx.lineTo(0, this.height / 2);
        ctx.lineTo(this.width / 4, this.height / 3);
        ctx.lineTo(this.width / 2, this.height / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = GAME_CONFIG.COLORS.PLAYER_ACCENT;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 3);
        ctx.lineTo(-this.width / 6, this.height / 4);
        ctx.lineTo(this.width / 6, this.height / 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -this.height / 6, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

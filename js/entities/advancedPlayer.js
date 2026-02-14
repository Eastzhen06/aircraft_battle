class AdvancedPlayer extends Player {
    constructor(x, y, aircraftType = 'fighter', playerIndex = 0) {
        super(x, y);
        
        this.aircraftType = aircraftType;
        this.playerIndex = playerIndex;
        
        const aircraftData = aircraftManager.getAircraftStats(aircraftType) || AIRCRAFT_TYPES.FIGHTER;
        
        this.applyAircraftStats(aircraftData);
        this.color = aircraftData.color;
        this.specialSkill = aircraftData.specialSkill;
        this.skillCooldown = 0;
        this.skillMaxCooldown = 5000;
        this.energy = 100;
        this.maxEnergy = 100;
        
        this.wingmen = [];
        this.equipmentStats = equipmentManager.getTotalStats();
        
        this.dodgeChance = 0;
        this.critChance = 0.05;
        this.pickupRange = 50;
        
        this.applyEquipmentStats();
    }
    
    applyAircraftStats(aircraftData) {
        const stats = aircraftData.stats;
        this.speed = GAME_CONFIG.PLAYER.SPEED * stats.speed;
        this.firepowerMultiplier = stats.firepower;
        this.defenseMultiplier = stats.defense;
        this.maxHealth = Math.floor(GAME_CONFIG.PLAYER.MAX_HEALTH * stats.defense);
        this.health = this.maxHealth;
    }
    
    applyEquipmentStats() {
        const stats = this.equipmentStats;
        
        if (stats.maxHealth) this.maxHealth += stats.maxHealth;
        if (stats.defense) this.defenseMultiplier += stats.defense / 100;
        if (stats.speed) this.speed += stats.speed;
        if (stats.dodge) this.dodgeChance = stats.dodge / 100;
        if (stats.critChance) this.critChance += stats.critChance / 100;
        if (stats.pickupRange) this.pickupRange += stats.pickupRange;
        if (stats.damage) this.firepowerMultiplier += stats.damage / 100;
        if (stats.maxShield) {
            this.hasShield = true;
            this.shieldHealth = stats.maxShield;
        }
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        
        if (this.skillCooldown > 0) {
            this.skillCooldown -= deltaTime;
        }
        
        this.updateWingmen(deltaTime);
        
        if (this.equipmentStats.regen) {
            this.health = Math.min(this.maxHealth, this.health + this.equipmentStats.regen * deltaTime / 1000);
        }
    }
    
    updateWingmen(deltaTime) {
        this.wingmen.forEach((wingman, index) => {
            const offsetX = (index === 0 ? -60 : 60);
            const offsetY = 30;
            
            wingman.targetX = this.x + offsetX;
            wingman.targetY = this.y + offsetY;
            
            wingman.x += (wingman.targetX - wingman.x) * 0.1;
            wingman.y += (wingman.targetY - wingman.y) * 0.1;
            
            wingman.shootTimer += deltaTime;
        });
    }
    
    shoot(bulletPool) {
        if (this.shootCooldown > 0) return [];
        
        const bullets = super.shoot(bulletPool);
        
        bullets.forEach(bullet => {
            bullet.damage *= this.firepowerMultiplier;
            
            if (Math.random() < this.critChance) {
                bullet.damage *= 2;
                bullet.isCrit = true;
            }
        });
        
        this.wingmen.forEach(wingman => {
            if (wingman.shootTimer >= 300) {
                wingman.shootTimer = 0;
                bulletPool.spawn(
                    wingman.x,
                    wingman.y - 15,
                    0,
                    -GAME_CONFIG.BULLET.PLAYER.SPEED,
                    GAME_CONFIG.BULLET.PLAYER.DAMAGE * 0.5,
                    false,
                    4,
                    10
                );
            }
        });
        
        return bullets;
    }
    
    useSpecialSkill(bulletPool) {
        if (this.skillCooldown > 0 || this.energy < 30) return false;
        
        this.skillCooldown = this.skillMaxCooldown;
        this.energy -= 30;
        
        switch (this.specialSkill) {
            case 'dash':
                this.isInvincible = true;
                setTimeout(() => { this.isInvincible = false; }, 500);
                break;
            case 'bomb':
                for (let i = 0; i < 36; i++) {
                    const angle = (Math.PI * 2 / 36) * i;
                    bulletPool.spawn(
                        this.x, this.y,
                        Math.cos(angle) * 8,
                        Math.sin(angle) * 8,
                        50, false, 8, 8
                    );
                }
                break;
            case 'shieldBurst':
                this.activateShield(3000);
                particleSystem.createShieldHit(this.x, this.y);
                break;
            case 'cloak':
                this.isCloaked = true;
                setTimeout(() => { this.isCloaked = false; }, 2000);
                break;
        }
        
        return true;
    }
    
    takeDamage(damage) {
        if (this.isCloaked) return false;
        
        if (Math.random() < this.dodgeChance) {
            particleSystem.emit(this.x, this.y, 5, { color: '#ffffff', size: 3 });
            return false;
        }
        
        const actualDamage = damage / this.defenseMultiplier;
        return super.takeDamage(actualDamage);
    }
    
    addWingman(type) {
        if (this.wingmen.length >= 2) return false;
        
        const wingmanData = WINGMAN_TYPES[type.toUpperCase()];
        if (!wingmanData) return false;
        
        this.wingmen.push({
            x: this.x,
            y: this.y,
            targetX: this.x,
            targetY: this.y,
            type: type,
            color: wingmanData.color,
            stats: wingmanData.stats,
            shootTimer: 0
        });
        
        return true;
    }
    
    draw(ctx) {
        if (!this.visible) return;
        
        this.wingmen.forEach(wingman => {
            ctx.save();
            ctx.translate(wingman.x, wingman.y);
            ctx.fillStyle = wingman.color;
            ctx.shadowColor = wingman.color;
            ctx.shadowBlur = 10;
            
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(-10, 10);
            ctx.lineTo(10, 10);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });
        
        if (this.isCloaked) {
            ctx.globalAlpha = 0.3;
        }
        
        super.draw(ctx);
        
        ctx.globalAlpha = 1;
    }
}

class Player2 extends AdvancedPlayer {
    constructor(x, y, aircraftType = 'fighter') {
        super(x, y, aircraftType, 1);
    }
    
    handleInput(keys) {
        let dx = 0;
        let dy = 0;
        
        if (keys['KeyI'] || keys['Numpad8']) dy -= 1;
        if (keys['KeyK'] || keys['Numpad5']) dy += 1;
        if (keys['KeyJ'] || keys['Numpad4']) dx -= 1;
        if (keys['KeyL'] || keys['Numpad6']) dx += 1;
        
        return { dx, dy };
    }
}

class AdvancedPlayer extends Player {
    constructor(x, y, aircraftType = 'fighter', playerIndex = 0) {
        super(x, y);
        
        this.aircraftType = aircraftType;
        this.playerIndex = playerIndex;
        
        const aircraftImageMap = {
            'fighter': 'p1',
            'interceptor': 'p2',
            'bomber': 'p3',
            'guardian': 'p4',
            'stealth': 'p5'
        };
        this.imageKey = aircraftImageMap[aircraftType] || 'p1';
        // If player 2, maybe use a different color/variant?
        if (playerIndex === 1) {
            // Use p6-p10 for player 2 if desired, or same images.
            // Let's use p6 for fighter p2, etc. if available.
            // User provided p1-p12.
            // Map P2 variants:
            const p2Map = {
                'fighter': 'p6',
                'interceptor': 'p7',
                'bomber': 'p8',
                'guardian': 'p9',
                'stealth': 'p10'
            };
            this.imageKey = p2Map[aircraftType] || 'p6';
        }
        
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
            
            // Wingman Special Abilities
            if (!wingman.abilityTimer) wingman.abilityTimer = 0;
            wingman.abilityTimer += deltaTime;
            
            if (wingman.type === 'defense' || wingman.type === 'DEFENSE') {
                // Shield every 15s if no shield
                if (wingman.abilityTimer >= 15000) {
                    if (!this.hasShield) {
                        this.activateShield(3000);
                        wingman.abilityTimer = 0;
                        particleSystem.createShieldHit(this.x, this.y); // Visual feedback
                    }
                }
            } else if (wingman.type === 'support' || wingman.type === 'SUPPORT') {
                // Heal 5% every 5s
                if (wingman.abilityTimer >= 5000) {
                    if (this.health < this.maxHealth) {
                        this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.05);
                        wingman.abilityTimer = 0;
                        // Visual feedback (green particles?)
                        particleSystem.emit(this.x, this.y, 5, { color: '#44ff44', size: 3 });
                    }
                }
            }
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
            // Attack Wingman: Shoots
            if (wingman.type === 'attack' || wingman.type === 'ATTACK') {
                if (wingman.shootTimer >= 200) { // Faster shooting
                    wingman.shootTimer = 0;
                    bulletPool.spawn(wingman.x, wingman.y - 15, 0, -15, 15, false, 4, 10);
                }
            }
            // Defense Wingman: Occasional shield (handled in update)
            // Support Wingman: Handled in update
        });
        
        return bullets;
    }
    
    useSpecialSkill(bulletPool) {
        if (!this.specialSkill) return false;
        if (this.skillCooldown > 0 || this.energy < 30) return false;
        
        this.skillCooldown = this.skillMaxCooldown;
        this.energy -= 30;
        
        switch (this.specialSkill) {
            case 'firepowerBoost':
            case 'barrage': // Legacy support
                const oldMult = this.firepowerMultiplier;
                const oldCd = this.shootCooldownMax;
                this.firepowerMultiplier *= 1.5;
                this.shootCooldownMax = 100; // Fast fire
                setTimeout(() => {
                    this.firepowerMultiplier = oldMult;
                    this.shootCooldownMax = oldCd;
                }, 5000);
                break;
                
            case 'lockOn':
            case 'dash': // Legacy mapping
                for(let i=0; i<8; i++) {
                    setTimeout(() => {
                        bulletPool.spawn(this.x, this.y, (i-3.5), -20, 40, false, 8, 20);
                    }, i * 50);
                }
                break;
                
            case 'carpetBomb':
            case 'bomb': // Legacy mapping
                for(let i=0; i<15; i++) {
                    setTimeout(() => {
                        bulletPool.spawn(this.x + (Math.random()-0.5)*100, this.y, (Math.random()-0.5)*2, -8, 80, false, 20, 20);
                    }, i * 100);
                }
                break;
                
            case 'shieldShare':
            case 'shieldBurst': // Legacy mapping
                this.activateShield(5000);
                // If game has player2, shield them too (would need game reference, skipping for now)
                particleSystem.createShieldHit(this.x, this.y);
                break;
                
            case 'stealthRaid':
            case 'cloak': // Legacy mapping
                this.isCloaked = true;
                const oldCrit = this.critChance;
                this.critChance = 1.0;
                setTimeout(() => { 
                    this.isCloaked = false; 
                    this.critChance = oldCrit;
                }, 3000);
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
            
            // Map wingman type to image key
            const wingmanMap = {
                'attack': 'w1',
                'defense': 'w2',
                'support': 'w3',
                // fallback or future types
                'default': 'w1'
            };
            
            const typeKey = wingman.type.toLowerCase();
            const imageKey = wingmanMap[typeKey] || wingmanMap['default'];
            const img = window.imageLoader.get(imageKey);
            
            if (img) {
                const size = 40;
                ctx.drawImage(img, -size/2, -size/2, size, size);
            } else {
                ctx.fillStyle = wingman.color;
                ctx.shadowColor = wingman.color;
                ctx.shadowBlur = 10;
                
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(-10, 10);
                ctx.lineTo(10, 10);
                ctx.closePath();
                ctx.fill();
            }
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
        
        // P2 uses Arrow Keys
        if (keys['ArrowUp']) dy -= 1;
        if (keys['ArrowDown']) dy += 1;
        if (keys['ArrowLeft']) dx -= 1;
        if (keys['ArrowRight']) dx += 1;
        
        return { dx, dy };
    }
}

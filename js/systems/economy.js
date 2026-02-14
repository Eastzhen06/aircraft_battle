class EconomySystem {
    constructor() {
        this.gold = 0;
        this.diamond = 0;
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const saved = Storage.load('planeWar_economy', { gold: 1000, diamond: 10 });
        this.gold = saved.gold || 0;
        this.diamond = saved.diamond || 0;
    }
    
    saveToStorage() {
        Storage.save('planeWar_economy', {
            gold: this.gold,
            diamond: this.diamond
        });
    }
    
    addGold(amount) {
        this.gold += amount;
        this.saveToStorage();
        return true;
    }
    
    addDiamond(amount) {
        this.diamond += amount;
        this.saveToStorage();
        return true;
    }
    
    spendGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            this.saveToStorage();
            return true;
        }
        return false;
    }
    
    spendDiamond(amount) {
        if (this.diamond >= amount) {
            this.diamond -= amount;
            this.saveToStorage();
            return true;
        }
        return false;
    }
    
    canAfford(cost) {
        return this.gold >= (cost.gold || 0) && this.diamond >= (cost.diamond || 0);
    }
    
    spend(cost) {
        if (!this.canAfford(cost)) return false;
        this.gold -= cost.gold || 0;
        this.diamond -= cost.diamond || 0;
        this.saveToStorage();
        return true;
    }
    
    getBalance() {
        return { gold: this.gold, diamond: this.diamond };
    }
    
    getReviveCost(reviveCount) {
        const cost = REVIVE_COSTS.base * Math.pow(REVIVE_COSTS.multiplier, reviveCount);
        return Math.min(cost, REVIVE_COSTS.maxCost);
    }
    
    canRevive(reviveCount) {
        return this.gold >= this.getReviveCost(reviveCount);
    }
    
    payForRevive(reviveCount) {
        const cost = this.getReviveCost(reviveCount);
        return this.spendGold(cost);
    }
}

class AircraftManager {
    constructor() {
        this.unlockedAircraft = ['fighter'];
        this.selectedAircraft = 'fighter';
        this.aircraftLevels = { fighter: 1 };
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const saved = Storage.load('planeWar_aircraft', null);
        if (saved) {
            this.unlockedAircraft = saved.unlocked || ['fighter'];
            this.selectedAircraft = saved.selected || 'fighter';
            this.aircraftLevels = saved.levels || { fighter: 1 };
        }
    }
    
    saveToStorage() {
        Storage.save('planeWar_aircraft', {
            unlocked: this.unlockedAircraft,
            selected: this.selectedAircraft,
            levels: this.aircraftLevels
        });
    }
    
    isUnlocked(aircraftId) {
        return this.unlockedAircraft.includes(aircraftId);
    }
    
    unlock(aircraftId, economy) {
        if (this.isUnlocked(aircraftId)) return false;
        
        const aircraft = Object.values(AIRCRAFT_TYPES).find(a => a.id === aircraftId);
        if (!aircraft) return false;
        
        if (!economy.spend(aircraft.unlockCost)) return false;
        
        this.unlockedAircraft.push(aircraftId);
        this.aircraftLevels[aircraftId] = 1;
        this.saveToStorage();
        return true;
    }
    
    select(aircraftId) {
        if (!this.isUnlocked(aircraftId)) return false;
        this.selectedAircraft = aircraftId;
        this.saveToStorage();
        return true;
    }
    
    getLevel(aircraftId) {
        return this.aircraftLevels[aircraftId] || 1;
    }
    
    upgrade(aircraftId, economy) {
        if (!this.isUnlocked(aircraftId)) return false;
        
        const currentLevel = this.getLevel(aircraftId);
        if (currentLevel >= 5) return false;
        
        const cost = UPGRADE_COSTS[currentLevel];
        if (!economy.spend(cost)) return false;
        
        this.aircraftLevels[aircraftId] = currentLevel + 1;
        this.saveToStorage();
        return true;
    }
    
    getAircraftStats(aircraftId) {
        const base = AIRCRAFT_TYPES[aircraftId.toUpperCase()];
        if (!base) return null;
        
        const level = this.getLevel(aircraftId);
        const levelBonus = 1 + (level - 1) * 0.15;
        
        return {
            ...base,
            stats: {
                speed: base.stats.speed * levelBonus,
                firepower: base.stats.firepower * levelBonus,
                defense: base.stats.defense * levelBonus
            },
            level: level
        };
    }
    
    getSelectedAircraft() {
        return this.getAircraftStats(this.selectedAircraft);
    }
}

class WingmanManager {
    constructor() {
        this.owned = [];
        this.equipped = [];
        this.maxSlots = 2;
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const saved = Storage.load('planeWar_wingman', null);
        if (saved) {
            this.owned = saved.owned || [];
            this.equipped = saved.equipped || [];
        }
    }
    
    saveToStorage() {
        Storage.save('planeWar_wingman', {
            owned: this.owned,
            equipped: this.equipped
        });
    }
    
    purchase(typeId, economy) {
        if (this.owned.includes(typeId)) return false;
        
        const wingman = Object.values(WINGMAN_TYPES).find(w => w.id === typeId);
        if (!wingman) return false;
        
        if (!economy.spend(wingman.cost)) return false;
        
        this.owned.push(typeId);
        this.saveToStorage();
        return true;
    }
    
    equip(typeId) {
        if (!this.owned.includes(typeId)) return false;
        if (this.equipped.includes(typeId)) return false;
        if (this.equipped.length >= this.maxSlots) return false;
        
        this.equipped.push(typeId);
        this.saveToStorage();
        return true;
    }
    
    unequip(typeId) {
        const index = this.equipped.indexOf(typeId);
        if (index === -1) return false;
        
        this.equipped.splice(index, 1);
        this.saveToStorage();
        return true;
    }
    
    getEquipped() {
        return this.equipped.map(id => WINGMAN_TYPES[id.toUpperCase()]);
    }
}

class EquipmentManager {
    constructor() {
        this.inventory = [];
        this.equipped = {};
        this.maxInventory = 50;
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const saved = Storage.load('planeWar_equipment', null);
        if (saved) {
            this.inventory = saved.inventory || [];
            this.equipped = saved.equipped || {};
        }
    }
    
    saveToStorage() {
        Storage.save('planeWar_equipment', {
            inventory: this.inventory,
            equipped: this.equipped
        });
    }
    
    generateEquipment(typeId, qualityId) {
        const type = EQUIPMENT_TYPES[typeId.toUpperCase()];
        const quality = EQUIPMENT_QUALITY[qualityId.toUpperCase()];
        
        if (!type || !quality) return null;
        
        const equipment = {
            id: Date.now() + Math.random(),
            typeId: typeId,
            qualityId: qualityId,
            stats: {}
        };
        
        type.stats.forEach(stat => {
            const baseValue = this.getBaseStatValue(stat);
            equipment.stats[stat] = Math.floor(baseValue * quality.multiplier * (0.9 + Math.random() * 0.2));
        });
        
        return equipment;
    }
    
    getBaseStatValue(stat) {
        const values = {
            damage: 10,
            fireRate: 5,
            critChance: 5,
            maxShield: 30,
            shieldRegen: 2,
            damageReduction: 5,
            speed: 1,
            dodge: 3,
            acceleration: 2,
            maxHealth: 20,
            defense: 5,
            regen: 1,
            pickupRange: 20,
            enemyDetect: 10,
            energyMax: 50,
            energyRegen: 3,
            skillCooldown: 5,
            missileDamage: 15,
            missileCount: 1,
            missileSpeed: 2,
            specialDamage: 20,
            specialDuration: 1,
            specialCooldown: 3
        };
        return values[stat] || 10;
    }
    
    addToInventory(equipment) {
        if (this.inventory.length >= this.maxInventory) return false;
        this.inventory.push(equipment);
        this.saveToStorage();
        return true;
    }
    
    equip(equipmentId) {
        const equipment = this.inventory.find(e => e.id === equipmentId);
        if (!equipment) return false;
        
        const type = EQUIPMENT_TYPES[equipment.typeId.toUpperCase()];
        if (!type) return false;
        
        if (this.equipped[type.slot]) {
            this.inventory.push(this.equipped[type.slot]);
        }
        
        this.equipped[type.slot] = equipment;
        this.inventory = this.inventory.filter(e => e.id !== equipmentId);
        this.saveToStorage();
        return true;
    }
    
    unequip(slot) {
        if (!this.equipped[slot]) return false;
        
        if (this.inventory.length >= this.maxInventory) return false;
        
        this.inventory.push(this.equipped[slot]);
        delete this.equipped[slot];
        this.saveToStorage();
        return true;
    }
    
    getTotalStats() {
        const total = {};
        Object.values(this.equipped).forEach(equipment => {
            Object.entries(equipment.stats).forEach(([stat, value]) => {
                total[stat] = (total[stat] || 0) + value;
            });
        });
        return total;
    }
    
    sell(equipmentId) {
        const index = this.inventory.findIndex(e => e.id === equipmentId);
        if (index === -1) return 0;
        
        const equipment = this.inventory[index];
        const quality = EQUIPMENT_QUALITY[equipment.qualityId.toUpperCase()];
        const goldValue = 100 * quality.multiplier;
        
        this.inventory.splice(index, 1);
        this.saveToStorage();
        return goldValue;
    }
}

class AchievementSystem {
    constructor() {
        this.unlocked = [];
        this.progress = {};
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const saved = Storage.load('planeWar_achievements', null);
        if (saved) {
            this.unlocked = saved.unlocked || [];
            this.progress = saved.progress || {};
        }
    }
    
    saveToStorage() {
        Storage.save('planeWar_achievements', {
            unlocked: this.unlocked,
            progress: this.progress
        });
    }
    
    updateProgress(statName, value) {
        this.progress[statName] = value;
        this.checkAchievements();
        this.saveToStorage();
    }
    
    addProgress(statName, amount) {
        this.progress[statName] = (this.progress[statName] || 0) + amount;
        this.checkAchievements();
        this.saveToStorage();
    }
    
    checkAchievements() {
        const newUnlocks = [];
        
        ACHIEVEMENTS.forEach(achievement => {
            if (this.unlocked.includes(achievement.id)) return;
            
            const condition = achievement.condition;
            let unlocked = true;
            
            Object.entries(condition).forEach(([key, value]) => {
                if (typeof value === 'number') {
                    if ((this.progress[key] || 0) < value) {
                        unlocked = false;
                    }
                } else if (typeof value === 'boolean') {
                    if (!this.progress[key]) {
                        unlocked = false;
                    }
                }
            });
            
            if (unlocked) {
                this.unlocked.push(achievement.id);
                newUnlocks.push(achievement);
            }
        });
        
        this.saveToStorage();
        return newUnlocks;
    }
    
    getUnlockedAchievements() {
        return this.unlocked.map(id => ACHIEVEMENTS.find(a => a.id === id));
    }
    
    getAchievementLevel() {
        return Math.floor(this.unlocked.length / 5) + 1;
    }
    
    getNextAchievements() {
        return ACHIEVEMENTS.filter(a => !this.unlocked.includes(a.id)).slice(0, 3);
    }
}

const economySystem = new EconomySystem();
const aircraftManager = new AircraftManager();
const wingmanManager = new WingmanManager();
const equipmentManager = new EquipmentManager();
const achievementSystem = new AchievementSystem();

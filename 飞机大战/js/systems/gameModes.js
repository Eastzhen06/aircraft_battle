class CampaignManager {
    constructor() {
        this.currentLevel = 1;
        this.unlockedLevels = [1];
        this.levelProgress = {};
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const saved = Storage.load('planeWar_campaign', null);
        if (saved) {
            this.currentLevel = saved.currentLevel || 1;
            this.unlockedLevels = saved.unlockedLevels || [1];
            this.levelProgress = saved.levelProgress || {};
        }
    }
    
    saveToStorage() {
        Storage.save('planeWar_campaign', {
            currentLevel: this.currentLevel,
            unlockedLevels: this.unlockedLevels,
            levelProgress: this.levelProgress
        });
    }
    
    getLevelData(level) {
        return CAMPAIGN_LEVELS[level - 1] || null;
    }
    
    getCurrentLevelData() {
        return this.getLevelData(this.currentLevel);
    }
    
    completeLevel(score, time, noDamage) {
        const levelData = this.getLevelData(this.currentLevel);
        if (!levelData) return null;
        
        const stars = this.calculateStars(score, time, noDamage);
        
        this.levelProgress[this.currentLevel] = {
            completed: true,
            stars: stars,
            bestScore: Math.max(this.levelProgress[this.currentLevel]?.bestScore || 0, score),
            bestTime: Math.min(this.levelProgress[this.currentLevel]?.bestTime || Infinity, time)
        };
        
        if (this.currentLevel < 10 && !this.unlockedLevels.includes(this.currentLevel + 1)) {
            this.unlockedLevels.push(this.currentLevel + 1);
        }
        
        this.saveToStorage();
        
        return {
            stars: stars,
            reward: levelData.reward,
            nextLevel: this.currentLevel < 10 ? this.currentLevel + 1 : null
        };
    }
    
    calculateStars(score, time, noDamage) {
        let stars = 1;
        
        const levelData = this.getLevelData(this.currentLevel);
        const targetScore = 2000 * levelData.enemyMult;
        if (score >= targetScore) stars++;
        if (score >= targetScore * 1.5) stars++;
        if (noDamage) stars++;
        if (time < 60) stars++;
        
        return Math.min(stars, 5);
    }
    
    selectLevel(level) {
        if (!this.unlockedLevels.includes(level)) return false;
        this.currentLevel = level;
        this.saveToStorage();
        return true;
    }
    
    getTotalStars() {
        let total = 0;
        Object.values(this.levelProgress).forEach(progress => {
            total += progress.stars || 0;
        });
        return total;
    }
    
    isLevelUnlocked(level) {
        return this.unlockedLevels.includes(level);
    }
}

class EndlessMode {
    constructor() {
        this.survivalTime = 0;
        this.difficultyMultiplier = 1;
        this.spawnRateMultiplier = 1;
        this.enemyHealthMultiplier = 1;
        this.enemySpeedMultiplier = 1;
        this.bestTime = 0;
        this.bestScore = 0;
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const saved = Storage.load('planeWar_endless', null);
        if (saved) {
            this.bestTime = saved.bestTime || 0;
            this.bestScore = saved.bestScore || 0;
        }
    }
    
    saveToStorage() {
        Storage.save('planeWar_endless', {
            bestTime: this.bestTime,
            bestScore: this.bestScore
        });
    }
    
    reset() {
        this.survivalTime = 0;
        this.difficultyMultiplier = 1;
        this.spawnRateMultiplier = 1;
        this.enemyHealthMultiplier = 1;
        this.enemySpeedMultiplier = 1;
    }
    
    update(deltaTime) {
        this.survivalTime += deltaTime / 1000;
        
        this.difficultyMultiplier = 1 + this.survivalTime / 60;
        this.spawnRateMultiplier = 1 + this.survivalTime / 120;
        this.enemyHealthMultiplier = 1 + this.survivalTime / 180;
        this.enemySpeedMultiplier = 1 + this.survivalTime / 240;
    }
    
    getDifficulty() {
        return {
            difficultyMultiplier: this.difficultyMultiplier,
            spawnRateMultiplier: this.spawnRateMultiplier,
            enemyHealthMultiplier: this.enemyHealthMultiplier,
            enemySpeedMultiplier: this.enemySpeedMultiplier
        };
    }
    
    end(score) {
        let newRecord = false;
        
        if (this.survivalTime > this.bestTime) {
            this.bestTime = this.survivalTime;
            newRecord = true;
        }
        
        if (score > this.bestScore) {
            this.bestScore = score;
            newRecord = true;
        }
        
        this.saveToStorage();
        
        return {
            survivalTime: this.survivalTime,
            score: score,
            newRecord: newRecord,
            bestTime: this.bestTime,
            bestScore: this.bestScore
        };
    }
    
    getSpawnInterval() {
        const baseInterval = GAME_CONFIG.LEVEL.ENEMY_SPAWN_INTERVAL;
        return Math.max(200, baseInterval / this.spawnRateMultiplier);
    }
}

class LegionMode {
    constructor() {
        this.activeAircraft = [];
        this.formation = 'wedge';
        this.sharedHealth = true;
        this.totalHealth = 0;
        this.maxTotalHealth = 0;
    }
    
    setup(aircraftIds) {
        this.activeAircraft = aircraftIds.map((id, index) => ({
            id: id,
            stats: aircraftManager.getAircraftStats(id),
            offsetX: this.getFormationOffset(index, aircraftIds.length, this.formation).x,
            offsetY: this.getFormationOffset(index, aircraftIds.length, this.formation).y,
            health: 100,
            maxHealth: 100,
            specialCooldown: 0
        }));
        
        this.maxTotalHealth = this.activeAircraft.length * 100;
        this.totalHealth = this.maxTotalHealth;
    }
    
    getFormationOffset(index, total, formation) {
        switch (formation) {
            case 'wedge':
                if (index === 0) return { x: 0, y: 0 };
                const side = index % 2 === 1 ? -1 : 1;
                const row = Math.floor((index + 1) / 2);
                return { x: side * 50 * row, y: 60 * row };
            case 'line':
                return { x: (index - (total - 1) / 2) * 60, y: 0 };
            case 'column':
                return { x: 0, y: index * 50 };
            default:
                return { x: 0, y: 0 };
        }
    }
    
    setFormation(formation) {
        this.formation = formation;
        this.activeAircraft.forEach((aircraft, index) => {
            const offset = this.getFormationOffset(index, this.activeAircraft.length, formation);
            aircraft.offsetX = offset.x;
            aircraft.offsetY = offset.y;
        });
    }
    
    takeDamage(damage, targetIndex = null) {
        if (this.sharedHealth) {
            this.totalHealth -= damage;
            return this.totalHealth <= 0;
        } else {
            if (targetIndex !== null && this.activeAircraft[targetIndex]) {
                this.activeAircraft[targetIndex].health -= damage;
                return this.activeAircraft[targetIndex].health <= 0;
            }
            return false;
        }
    }
    
    getActiveCount() {
        if (this.sharedHealth) {
            return this.totalHealth > 0 ? this.activeAircraft.length : 0;
        }
        return this.activeAircraft.filter(a => a.health > 0).length;
    }
    
    isAlive() {
        return this.getActiveCount() > 0;
    }
}

class CoopMode {
    constructor() {
        this.players = [];
        this.sharedLives = true;
        this.totalLives = 5;
        this.reviveCost = 0;
    }
    
    setup(player1Aircraft, player2Aircraft) {
        this.players = [
            { aircraft: player1Aircraft, alive: true, score: 0 },
            { aircraft: player2Aircraft, alive: true, score: 0 }
        ];
        this.totalLives = 5;
    }
    
    playerDied(playerIndex) {
        if (this.sharedLives) {
            this.totalLives--;
            if (this.totalLives > 0) {
                this.players[playerIndex].alive = true;
                return true;
            }
        } else {
            this.players[playerIndex].alive = false;
        }
        return false;
    }
    
    canRevive(playerIndex) {
        if (this.players[playerIndex].alive) return false;
        return economySystem.canRevive(this.reviveCost);
    }
    
    revive(playerIndex) {
        if (!this.canRevive(playerIndex)) return false;
        
        economySystem.payForRevive(this.reviveCost);
        this.reviveCost++;
        this.players[playerIndex].alive = true;
        return true;
    }
    
    isGameOver() {
        return this.players.every(p => !p.alive);
    }
    
    getTotalScore() {
        return this.players.reduce((sum, p) => sum + p.score, 0);
    }
}

const campaignManager = new CampaignManager();
const endlessMode = new EndlessMode();
const legionMode = new LegionMode();
const coopMode = new CoopMode();

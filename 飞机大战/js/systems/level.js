class LevelSystem {
    constructor() {
        this.level = 1;
        this.score = 0;
        this.kills = 0;
        this.scoreToNextLevel = GAME_CONFIG.LEVEL.SCORE_PER_LEVEL;
        this.levelUpCallback = null;
    }
    
    addScore(points) {
        this.score += points;
        this.checkLevelUp();
        return this.score;
    }
    
    addKill() {
        this.kills++;
    }
    
    checkLevelUp() {
        if (this.score >= this.scoreToNextLevel) {
            this.levelUp();
        }
    }
    
    levelUp() {
        this.level++;
        this.scoreToNextLevel = this.level * GAME_CONFIG.LEVEL.SCORE_PER_LEVEL;
        
        if (this.levelUpCallback) {
            this.levelUpCallback(this.level);
        }
        
        soundManager.playLevelUp();
    }
    
    setLevelUpCallback(callback) {
        this.levelUpCallback = callback;
    }
    
    getLevel() {
        return this.level;
    }
    
    getScore() {
        return this.score;
    }
    
    getKills() {
        return this.kills;
    }
    
    getProgress() {
        const prevThreshold = (this.level - 1) * GAME_CONFIG.LEVEL.SCORE_PER_LEVEL;
        const currentProgress = this.score - prevThreshold;
        const levelRange = GAME_CONFIG.LEVEL.SCORE_PER_LEVEL;
        return currentProgress / levelRange;
    }
    
    reset() {
        this.level = 1;
        this.score = 0;
        this.kills = 0;
        this.scoreToNextLevel = GAME_CONFIG.LEVEL.SCORE_PER_LEVEL;
    }
}

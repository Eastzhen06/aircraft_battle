(function() {
    class DifficultySystem {
        constructor() {
        this.baseDifficulty = 1.0;
        this.dynamicDifficulty = 1.0;
        this.tension = 0; // 0 to 100
        
        this.killHistory = []; // Timestamp of kills
        this.comboTimeout = 2000; // 2 seconds window for combo
        
        // Configuration for dynamic scaling
        this.config = {
            maxDifficulty: 3.0,
            minDifficulty: 0.8,
            tensionDecay: 5, // Per second
            tensionGainPerKill: 2,
            tensionGainPerHit: -10, // Player hit reduces tension (mercy)
            difficultySmoothing: 0.1
        };
    }
    
    update(deltaTime, playerHealthPercent) {
        // Clean up old kills
        const now = Date.now();
        this.killHistory = this.killHistory.filter(t => now - t < this.comboTimeout);
        
        // Calculate tension based on recent kills (combo)
        const comboCount = this.killHistory.length;
        
        // Decay tension
        this.tension = Math.max(0, this.tension - (this.config.tensionDecay * deltaTime / 1000));
        
        // High combo increases tension
        if (comboCount > 5) {
            this.tension = Math.min(100, this.tension + (deltaTime / 1000) * 2);
        }
        
        // Low health increases tension (desperation mode) but might reduce difficulty?
        // Usually:
        // High Score/Combo -> Increase Difficulty
        // Low Health -> Maybe slightly decrease to give a chance?
        
        let targetDifficulty = this.baseDifficulty;
        
        // Factor 1: Score/Progress (handled by baseDifficulty increasing over levels)
        
        // Factor 2: Recent Performance (Combo)
        if (comboCount > 10) targetDifficulty *= 1.2;
        else if (comboCount > 20) targetDifficulty *= 1.5;
        
        // Factor 3: Player Health (Mercy rule)
        if (playerHealthPercent < 0.3) {
            targetDifficulty *= 0.8; // Reduce difficulty if player is dying
        }
        
        // Smooth transition
        this.dynamicDifficulty += (targetDifficulty - this.dynamicDifficulty) * this.config.difficultySmoothing;
        
        // Clamp
        this.dynamicDifficulty = Math.max(this.config.minDifficulty, Math.min(this.config.maxDifficulty, this.dynamicDifficulty));
    }
    
    onKill() {
        this.killHistory.push(Date.now());
        this.tension = Math.min(100, this.tension + this.config.tensionGainPerKill);
    }
    
    onPlayerHit() {
        this.tension = Math.max(0, this.tension + this.config.tensionGainPerHit);
        // Reduce difficulty immediately on hit
        this.dynamicDifficulty *= 0.9;
    }
    
    getSpawnRateMultiplier() {
        // Higher difficulty -> Faster spawns (lower interval)
        // Interval = Base / Multiplier
        return this.dynamicDifficulty;
    }
    
    getEnemyHealthMultiplier() {
        // Higher difficulty -> More health
        return 1 + (this.dynamicDifficulty - 1) * 0.5; // Scale slower than spawn rate
    }
    
    getEnemySpeedMultiplier() {
        return 1 + (this.dynamicDifficulty - 1) * 0.2; // Slight speed increase
    }
    
    reset() {
        this.baseDifficulty = 1.0;
        this.dynamicDifficulty = 1.0;
        this.tension = 0;
        this.killHistory = [];
    }
}

    window.difficultySystem = new DifficultySystem();
})();

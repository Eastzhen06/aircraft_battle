class SpawnSystem {
    constructor(difficulty) {
        this.difficulty = difficulty;
        this.spawnTimer = 0;
        this.spawnInterval = GAME_CONFIG.LEVEL.ENEMY_SPAWN_INTERVAL;
        this.level = 1;
    }
    
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }
    
    setLevel(level) {
        this.level = level;
        this.updateSpawnInterval();
    }
    
    updateSpawnInterval() {
        const diffConfig = GAME_CONFIG.DIFFICULTY[this.difficulty];
        const interval = GAME_CONFIG.LEVEL.ENEMY_SPAWN_INTERVAL - (this.level - 1) * 100;
        this.spawnInterval = Math.max(
            GAME_CONFIG.LEVEL.MIN_SPAWN_INTERVAL,
            interval * diffConfig.spawnRateMult
        );
    }
    
    update(deltaTime, enemies, canvasWidth) {
        this.spawnTimer += deltaTime;
        
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnEnemy(enemies, canvasWidth);
        }
    }
    
    spawnEnemy(enemies, canvasWidth) {
        const type = this.selectEnemyType();
        const x = randomRange(50, canvasWidth - 50);
        const enemy = new Enemy(x, -50, type, this.difficulty);
        enemies.push(enemy);
    }
    
    selectEnemyType() {
        const roll = Math.random();
        const levelBonus = (this.level - 1) * 0.05;
        
        if (this.level >= 5 && roll < 0.1 + levelBonus * 0.5) {
            return ENEMY_TYPES.LARGE;
        } else if (this.level >= 3 && roll < 0.3 + levelBonus) {
            return ENEMY_TYPES.MEDIUM;
        } else {
            return ENEMY_TYPES.SMALL;
        }
    }
    
    spawnPowerup(x, y, powerups) {
        const diffConfig = GAME_CONFIG.DIFFICULTY[this.difficulty];
        
        if (Math.random() < GAME_CONFIG.POWERUP.DROP_CHANCE * diffConfig.powerupDropMult) {
            const types = Object.values(POWERUP_TYPES);
            const type = types[randomInt(0, types.length - 1)];
            powerups.push(new Powerup(x, y, type));
        }
    }
    
    reset() {
        this.spawnTimer = 0;
        this.level = 1;
        this.updateSpawnInterval();
    }
}

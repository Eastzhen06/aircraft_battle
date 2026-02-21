import Boss from '../entities/boss.js';

export default class LevelSystem {
    constructor() {
        this.level = 1;
        this.timer = 0;
        this.state = 'SPAWNING'; 
        this.spawnTimer = 0;
    }

    update(deltaTime, game) {
        this.timer += deltaTime;

        if (this.state === 'SPAWNING') {
            this.spawnTimer += deltaTime;
            
            if (this.timer >= 60) {
                this.state = 'TRANSITION';
                console.log(`⚠️ LEVEL ${this.level} - BOSS APPROACHING!`);
                game.enemies.forEach(e => e.active = false);
            } 
            else if (this.spawnTimer > Math.max(0.5, 1.5 - this.level * 0.1)) {
                this.spawnTimer = 0;
                this.spawnNormalEnemy(game);
            }
        } 
        else if (this.state === 'TRANSITION') {
            if (this.timer >= 63) {
                this.state = 'BOSS';
                game.boss = new Boss(this.level, game.playArea);
            }
        }
        else if (this.state === 'BOSS') {
            if (game.boss && !game.boss.active) {
                console.log(`✅ BOSS DEFEATED! LEVEL ${this.level} CLEARED.`);
                game.boss = null;
                this.level++;
                this.timer = 0;
                this.state = 'SPAWNING';
            } else if (game.boss) {
                if (game.boss.shouldShoot()) {
                    game.boss.shoot(game);
                }
            }
        }
    }

    spawnNormalEnemy(game) {
        if (!game.playArea) return;
        const enemy = game.enemyPool.get();
        
        const margin = Math.max(100, enemy.width);
        const minX = game.playArea.minX + margin;
        const maxX = game.playArea.maxX - margin;
        const spawnX = Math.random() * (maxX - minX) + minX;
        
        // 【v3.7】传入 game.canvas.width，赋予小怪读取百分比的权利
        enemy.spawn(spawnX, -50, this.level, game.canvas.width);
        if (!game.enemies.includes(enemy)) {
            game.enemies.push(enemy);
        }
    }
}
import Boss from '../entities/boss.js';

export default class LevelSystem {
    constructor() {
        this.level = 1;
        this.timer = 0;
        this.state = 'SPAWNING'; // SPAWNING (0-60s) | TRANSITION (60-63s) | BOSS
        this.spawnTimer = 0;
    }

    update(deltaTime, game) {
        this.timer += deltaTime;

        if (this.state === 'SPAWNING') {
            this.spawnTimer += deltaTime;
            
            // 60秒节点：清理屏幕，召唤 Boss
            if (this.timer >= 60) {
                this.state = 'TRANSITION';
                console.log(`⚠️ LEVEL ${this.level} - BOSS APPROACHING!`);
                // 清理所有小怪
                game.enemies.forEach(e => e.active = false);
            } 
            // 随关卡层数缩短生成间隔
            else if (this.spawnTimer > Math.max(0.5, 1.5 - this.level * 0.1)) {
                this.spawnTimer = 0;
                this.spawnNormalEnemy(game);
            }
        } 
        else if (this.state === 'TRANSITION') {
            // 过渡 3 秒
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
                // Boss 开火判定接入
                if (game.boss.shouldShoot()) {
                    game.boss.shoot(game);
                }
            }
        }
    }

    spawnNormalEnemy(game) {
        if (!game.playArea) return;
        const enemy = game.enemyPool.get();
        // 严格边界
        const minX = game.playArea.minX + 40;
        const maxX = game.playArea.maxX - 40;
        const spawnX = Math.random() * (maxX - minX) + minX;
        
        enemy.spawn(spawnX, -50, this.level);
        if (!game.enemies.includes(enemy)) {
            game.enemies.push(enemy);
        }
    }
}
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
                // 【Phase 9.1 修改】：第 1 关无 Boss，到达指定时间后直接触发游戏结算防线
                if (this.level === 1) {
                    console.log(`✅ LEVEL 1 CLEARED (No Boss).`);
                    game.handleLevelVictory(); // 跨文件呼叫主调文件的胜利结算接口
                    return; // 立即中断 levelSystem 的后续时间轴逻辑
                } else {
                    this.state = 'TRANSITION';
                    console.log(`⚠️ LEVEL ${this.level} - BOSS APPROACHING!`);
                    game.enemies.forEach(e => e.active = false);
                }
            } 
            // 释放大招期间，系统绝对不生成并放入新的敌机
            else if (this.spawnTimer > Math.max(0.5, 1.5 - this.level * 0.1) && game.skillSystem.state !== 'ACTIVE') {
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
                // 【Phase 9.2 修改：剥夺越权，将结算权交还主引擎】
                game.handleLevelVictory(); 
                return; // 立即中断帧渲染防线，防止后台持续判定
            } else if (game.boss) {
                if (game.boss.shouldShoot()) {
                    // 标记 Boss 正在射击，以便 game.js 赋予 2.5 倍子弹加速
                    game.isBossShooting = true; 
                    game.boss.shoot(game);
                    game.isBossShooting = false;
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
        
        enemy.spawn(spawnX, -50, this.level, game.interactiveWidth, game.currentPlaneType);
        if (!game.enemies.includes(enemy)) {
            game.enemies.push(enemy);
        }
    }
}
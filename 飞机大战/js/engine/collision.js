class CollisionSystem {
    constructor() {
        this.collisions = [];
    }
    
    checkPlayerEnemyCollision(player, enemies) {
        const collisions = [];
        const playerRect = {
            x: player.x - player.width / 2,
            y: player.y - player.height / 2,
            width: player.width,
            height: player.height
        };
        
        for (const enemy of enemies) {
            const enemyRect = {
                x: enemy.x - enemy.width / 2,
                y: enemy.y - enemy.height / 2,
                width: enemy.width,
                height: enemy.height
            };
            
            if (rectIntersect(playerRect, enemyRect)) {
                collisions.push({
                    type: 'player-enemy',
                    player: player,
                    enemy: enemy
                });
            }
        }
        
        return collisions;
    }
    
    checkBulletEnemyCollision(bullets, enemies) {
        const collisions = [];
        
        for (const bullet of bullets) {
            if (bullet.isEnemy || !bullet.active) continue;
            
            const bulletRect = {
                x: bullet.x - bullet.width / 2,
                y: bullet.y - bullet.height / 2,
                width: bullet.width,
                height: bullet.height
            };
            
            for (const enemy of enemies) {
                if (!enemy.active) continue;
                
                const enemyRect = {
                    x: enemy.x - enemy.width / 2,
                    y: enemy.y - enemy.height / 2,
                    width: enemy.width,
                    height: enemy.height
                };
                
                if (rectIntersect(bulletRect, enemyRect)) {
                    collisions.push({
                        type: 'bullet-enemy',
                        bullet: bullet,
                        enemy: enemy
                    });
                    break;
                }
            }
        }
        
        return collisions;
    }
    
    checkBulletBossCollision(bullets, boss) {
        const collisions = [];
        
        if (!boss || !boss.active) return collisions;
        
        for (const bullet of bullets) {
            if (bullet.isEnemy || !bullet.active) continue;
            
            const bulletRect = {
                x: bullet.x - bullet.width / 2,
                y: bullet.y - bullet.height / 2,
                width: bullet.width,
                height: bullet.height
            };
            
            const bossRect = {
                x: boss.x - boss.width / 2,
                y: boss.y - boss.height / 2,
                width: boss.width,
                height: boss.height
            };
            
            if (rectIntersect(bulletRect, bossRect)) {
                collisions.push({
                    type: 'bullet-boss',
                    bullet: bullet,
                    boss: boss
                });
            }
        }
        
        return collisions;
    }
    
    checkPlayerBossCollision(player, boss) {
        const collisions = [];
        
        if (!boss || !boss.active || player.isInvincible || player.hasShield) return collisions;
        
        const playerRect = {
            x: player.x - player.width / 2,
            y: player.y - player.height / 2,
            width: player.width,
            height: player.height
        };
        
        const bossRect = {
            x: boss.x - boss.width / 2,
            y: boss.y - boss.height / 2,
            width: boss.width,
            height: boss.height
        };
        
        if (rectIntersect(playerRect, bossRect)) {
            collisions.push({
                type: 'player-boss',
                player: player,
                boss: boss
            });
        }
        
        return collisions;
    }
    
    checkEnemyBulletPlayerCollision(enemyBullets, player) {
        const collisions = [];
        
        if (player.isInvincible || player.hasShield) return collisions;
        
        const playerRect = {
            x: player.x - player.width / 2,
            y: player.y - player.height / 2,
            width: player.width,
            height: player.height
        };
        
        for (const bullet of enemyBullets) {
            if (!bullet.isEnemy || !bullet.active) continue;
            
            const bulletRect = {
                x: bullet.x - bullet.width / 2,
                y: bullet.y - bullet.height / 2,
                width: bullet.width,
                height: bullet.height
            };
            
            if (rectIntersect(bulletRect, playerRect)) {
                collisions.push({
                    type: 'enemyBullet-player',
                    bullet: bullet,
                    player: player
                });
            }
        }
        
        return collisions;
    }
    
    checkPowerupPlayerCollision(powerups, player) {
        const collisions = [];
        
        const playerRect = {
            x: player.x - player.width / 2,
            y: player.y - player.height / 2,
            width: player.width,
            height: player.height
        };
        
        for (const powerup of powerups) {
            if (!powerup.active) continue;
            
            const powerupRect = {
                x: powerup.x - powerup.width / 2,
                y: powerup.y - powerup.height / 2,
                width: powerup.width,
                height: powerup.height
            };
            
            if (rectIntersect(playerRect, powerupRect)) {
                collisions.push({
                    type: 'powerup-player',
                    powerup: powerup,
                    player: player
                });
            }
        }
        
        return collisions;
    }
    
    processAllCollisions(game) {
        const allCollisions = [];
        const bullets = game.bulletPool.getActive();
        
        // Player 1 collisions
        if (game.player && game.player.active) {
            allCollisions.push(...this.checkEnemyBulletPlayerCollision(bullets, game.player));
            allCollisions.push(...this.checkPlayerEnemyCollision(game.player, game.enemies));
            allCollisions.push(...this.checkPlayerBossCollision(game.player, game.boss));
            allCollisions.push(...this.checkPowerupPlayerCollision(game.powerups, game.player));
        }

        // Player 2 collisions
        if (game.player2 && game.player2.active) {
            allCollisions.push(...this.checkEnemyBulletPlayerCollision(bullets, game.player2));
            allCollisions.push(...this.checkPlayerEnemyCollision(game.player2, game.enemies));
            allCollisions.push(...this.checkPlayerBossCollision(game.player2, game.boss));
            allCollisions.push(...this.checkPowerupPlayerCollision(game.powerups, game.player2));
        }
        
        // Bullet collisions (independent of player)
        allCollisions.push(...this.checkBulletEnemyCollision(bullets, game.enemies));
        allCollisions.push(...this.checkBulletBossCollision(bullets, game.boss));
        
        return allCollisions;
    }
}

const collisionSystem = new CollisionSystem();

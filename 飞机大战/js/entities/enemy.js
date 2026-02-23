export default class Enemy {
    constructor() {
        this.active = false;
        this.width = 40; 
        this.height = 40;
        this.x = 0; 
        this.y = 0;
        this.speed = 100;
        this.health = 10; 
        this.maxHealth = 10;
        this.scoreValue = 100; 
        
        this.movePattern = 'straight';
        this.moveTimer = 0;
        this.originalX = 0;
        this.angle = 0;
        this.type = 1; 
        this.imageKey = 'e1';
        this.shootTimer = 0;

        // 【v4.6 新增】：E3 敌机独立红色激光状态机
        this.isRedLaserActive = false;
        this.redLaserTimer = 0;
        this.redLaserDuration = 0;
        this.redLaserUses = 0;
    }

    spawn(x, y, level, interactiveWidth = window.innerWidth, currentPlaneType = 'Ranger') {
        this.active = true;
        this.x = x; 
        this.y = y;
        this.originalX = x;
        this.moveTimer = 0;
        this.angle = 0;
        this.shootTimer = Math.random() * 1.5; 
        
        this.isRedLaserActive = false;
        this.redLaserTimer = 0;
        this.redLaserUses = 0;

        const rand = Math.random();
        if (rand < 0.6) {
            this.type = 1; 
            this.imageKey = 'e1';
            this.width = interactiveWidth * 0.08; 
            this.height = this.width;
            this.maxHealth = 10 * level;
            this.speed = 150; 
            this.scoreValue = 100;
        } else if (rand < 0.9) {
            this.type = 2; 
            this.imageKey = 'e2';
            this.width = interactiveWidth * 0.09; 
            this.height = this.width;
            this.maxHealth = 25 * level;
            this.speed = 120; 
            this.scoreValue = 200;
            this.movePattern = 'sine';
        } else {
            this.type = 3; 
            this.imageKey = 'e3';
            this.width = interactiveWidth * 0.12; 
            this.height = this.width * 0.8;
            this.maxHealth = 50 * level;
            this.speed = 80; 
            this.scoreValue = 500;
            this.movePattern = 'zigzag';
            // E3机型初始延迟触发激光
            this.redLaserTimer = Math.random() * 2; 
        }

        this.health = this.maxHealth;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.active = false;
            return true; 
        }
        return false;
    }

    // 【v4.6 新增】：暴露 E3 红色激光的物理碰撞盒
    getRedLaserRect(canvasHeight) {
        if (!this.isRedLaserActive) return null;
        const laserWidth = 20;
        return {
            x: this.x - laserWidth / 2,
            y: this.y,
            w: laserWidth,
            h: canvasHeight
        };
    }

    update(deltaTime, canvasHeight, playArea, game) {
        if (!this.active) return;

        this.moveTimer += deltaTime;

        // 【v4.6 新增】：Type 3 的红色激光逻辑 (单局限 3 次，每次 3-5 秒)
        if (this.type === 3) {
            if (this.isRedLaserActive) {
                this.redLaserDuration -= deltaTime;
                if (this.redLaserDuration <= 0) {
                    this.isRedLaserActive = false;
                    this.redLaserTimer = 0; // 重置冷却
                }
            } else if (this.redLaserUses < 3) {
                this.redLaserTimer += deltaTime;
                if (this.redLaserTimer > 5.0) { // 每 5 秒尝试发动一次光波
                    this.isRedLaserActive = true;
                    this.redLaserDuration = 3 + Math.random() * 2; // 持续 3 到 5 秒
                    this.redLaserUses++;
                    console.log(`[Enemy E3] 部署红色裁决光波！剩余次数: ${3 - this.redLaserUses}`);
                }
            }
        }

        // 运动轨迹
        if (this.movePattern === 'straight') {
            this.y += this.speed * deltaTime;
        } else if (this.movePattern === 'sine') {
            this.y += this.speed * deltaTime;
            this.x = this.originalX + Math.sin(this.moveTimer * 3) * 50;
        } else if (this.movePattern === 'zigzag') {
            this.y += this.speed * 0.8 * deltaTime;
            this.x = this.originalX + Math.sin(this.moveTimer * 2) * 100;
        }

        this.x = Math.max(playArea.minX + this.width/2, Math.min(this.x, playArea.maxX - this.width/2));

        if (this.y > canvasHeight + this.height) {
            this.active = false;
            return;
        }

        // 开火逻辑 (激光扫射期间 E3 停止普通射击)
        if (this.isRedLaserActive) {
            // Laser is active, don't shoot normal bullets
        } else {
            this.shootTimer -= deltaTime;
            if (this.shootTimer <= 0) {
                if (this.type === 1) {
                    game.spawnEnemyBullet(this.x, this.y + this.height/2, 350, 5, 0);
                    this.shootTimer = 2.0;
                } else if (this.type === 2) {
                    game.spawnEnemyBullet(this.x, this.y + this.height/2, 300, 10, -0.2);
                    game.spawnEnemyBullet(this.x, this.y + this.height/2, 300, 10, 0.2);
                    this.shootTimer = 2.5;
                } else {
                    for(let i=0; i<5; i++) {
                        game.spawnEnemyBullet(this.x, this.y + this.height/2, 200, 15, -0.4 + i*0.2);
                    }
                    this.shootTimer = 3.5;
                }
            }
        }
    }

    draw(ctx) {
        if (!this.active) return;
        
        // 【v4.6 新增】：渲染 E3 红色激光
        if (this.isRedLaserActive) {
            const canvasHeight = ctx.canvas.height;
            ctx.save();
            const alpha = 0.6 + Math.sin(Date.now() / 50) * 0.4;
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 15;
            ctx.fillRect(this.x - 10, this.y, 20, canvasHeight);
            // 激光白热核心
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(this.x - 2, this.y, 4, canvasHeight);
            ctx.restore();
        }

        const img = window.imageLoader ? window.imageLoader.get(this.imageKey) : null;
        if (img) {
            ctx.drawImage(img, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        }

        if (this.type !== 1 && this.health < this.maxHealth) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 15, this.y - this.height/2 - 10, 30, 4);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x - 15, this.y - this.height/2 - 10, 30 * (this.health / this.maxHealth), 4);
        }
    }
}
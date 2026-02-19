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
        
        this.movePattern = 'straight';
        this.moveTimer = 0;
        this.originalX = 0;
        this.angle = 0;
        this.type = 1; 
        this.imageKey = 'e1';
        this.shootTimer = 0;
    }

    spawn(x, y, level) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.originalX = x;
        this.moveTimer = 0;
        this.angle = 0;
        this.shootTimer = Math.random() * 1.5; // 出生后 0~1.5秒内必开火

        const rand = Math.random();
        if (rand < 0.6) {
            this.type = 1; this.imageKey = 'e1';
            this.width = 40; this.height = 40;
            this.maxHealth = 10 * level;
            this.speed = 150 + level * 10;
        } else if (rand < 0.9) {
            this.type = 2; this.imageKey = 'e2';
            this.width = 60; this.height = 60;
            this.maxHealth = 30 * level;
            this.speed = 100 + level * 5;
        } else {
            this.type = 3; this.imageKey = 'e3';
            this.width = 90; this.height = 90;
            this.maxHealth = 80 * level;
            this.speed = 70 + level * 2;
        }
        this.health = this.maxHealth;

        const patterns = ['straight', 'zigzag', 'sine', 'diagonal'];
        this.movePattern = patterns[Math.floor(Math.random() * patterns.length)];
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.active = false;
            return true; 
        }
        return false;
    }

    update(deltaTime, canvasHeight, playArea, game) {
        if (!this.active) return;
        
        this.moveTimer += deltaTime;
        this.angle += deltaTime * 0.003;
        
        switch (this.movePattern) {
            case 'straight': this.y += this.speed * deltaTime; break;
            case 'zigzag': this.y += this.speed * deltaTime; this.x += Math.sin(this.moveTimer * 5) * 2; break;
            case 'sine': this.y += this.speed * deltaTime; this.x = this.originalX + Math.sin(this.moveTimer * 2) * 50; break;
            case 'diagonal': this.y += this.speed * 0.8 * deltaTime; this.x += Math.sin(this.angle) * 1.5; break;
        }
        
        // 强制边界
        if (playArea) {
            this.x = Math.max(playArea.minX + this.width / 2, Math.min(this.x, playArea.maxX - this.width / 2));
        }

        if (this.y > canvasHeight + this.height) {
            this.active = false;
        }

        // 敌机开火逻辑
        this.shootTimer -= deltaTime;
        if (this.shootTimer <= 0 && this.y > 0) {
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

    draw(ctx) {
        if (!this.active) return;

        // 获取全局图片
        const img = window.imageLoader ? window.imageLoader.get(this.imageKey) : null;
        
        if (img) {
            ctx.drawImage(img, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        } else {
            // 极简 Fallback 防止崩溃
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        }

        // 血条
        if (this.type !== 1 && this.health < this.maxHealth) {
            const healthPercent = this.health / this.maxHealth;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width, 4);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width * healthPercent, 4);
        }
    }
}
export default class Enemy {
    constructor() {
        this.active = false;
        this.width = 40; this.height = 40;
        this.x = 0; this.y = 0;
        this.speed = 100;
        this.health = 10; this.maxHealth = 10;
        this.scoreValue = 100; 
        
        this.movePattern = 'straight';
        this.moveTimer = 0;
        this.originalX = 0;
        this.angle = 0;
        this.type = 1; 
        this.imageKey = 'e1';
        this.shootTimer = 0;
    }

    spawn(x, y, level, interactiveWidth = window.innerWidth, currentPlaneType = 'Ranger') {
        this.active = true;
        this.x = x; this.y = y;
        this.originalX = x;
        this.moveTimer = 0;
        this.angle = 0;
        this.shootTimer = Math.random() * 1.5; 

        const rand = Math.random();
        if (rand < 0.6) {
            this.type = 1; this.imageKey = 'e1';
            this.width = interactiveWidth * 0.08; 
            this.height = this.width;
            this.maxHealth = 10 * level;
            this.speed = 150; 
            this.scoreValue = 100;
        } else if (rand < 0.9) {
            this.type = 2; this.imageKey = 'e2';
            this.width = interactiveWidth * 0.12; 
            this.height = this.width;
            this.maxHealth = 30 * level;
            this.speed = 110; 
            this.scoreValue = 300;
        } else {
            this.type = 3; this.imageKey = 'e3';
            this.width = interactiveWidth * 0.17; 
            this.height = this.width;
            this.maxHealth = 80 * level;
            this.speed = 80;  
            this.scoreValue = 800;
        }

        // ==========================================
        // 【v4.0 僚机战力抵消】：任意僚机均可将护甲壁垒向后推迟 1 关，帮助主机越级挑战
        // ==========================================
        const game = window.gameInstance;
        const hasWingman = game && game.currentWingmanType !== 'none';
        const levelOffset = hasWingman ? 1 : 0; 
        
        if (currentPlaneType === 'Ranger' && level >= 4 + levelOffset) {
            if (this.type === 1) this.maxHealth *= 1.5; 
            else this.maxHealth *= 15; 
            this.shootTimer = 0.5;
        } else if (currentPlaneType === 'Interceptor' && level >= 7 + levelOffset) {
            if (this.type === 1) this.maxHealth *= 1.5;
            else this.maxHealth *= 15;
            this.shootTimer = 0.5;
        } else if (currentPlaneType === 'Fortress' && level >= 8 + levelOffset) {
            if (this.type === 1) this.maxHealth *= 1.5;
            else this.maxHealth *= 15;
            this.shootTimer = 0.5;
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
        
        if (playArea) {
            this.x = Math.max(playArea.minX + this.width / 2, Math.min(this.x, playArea.maxX - this.width / 2));
        }

        if (this.y > canvasHeight + this.height) {
            this.active = false;
        }

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
        const img = window.imageLoader ? window.imageLoader.get(this.imageKey) : null;
        
        if (img) {
            ctx.drawImage(img, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        }

        if (this.type !== 1 && this.health < this.maxHealth) {
            const healthPercent = this.health / this.maxHealth;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width, 4);
            ctx.fillStyle = '#00d4ff';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width * healthPercent, 4);
        }
    }
}
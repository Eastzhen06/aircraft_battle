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
        this.type = 1; // 1: small, 2: medium, 3: large
    }

    // 适配对象池的初始化方法
    spawn(x, y, level) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.originalX = x;
        this.moveTimer = 0;
        this.angle = 0;

        // 根据关卡随机生成类型
        const rand = Math.random();
        if (rand < 0.6) {
            this.type = 1;
            this.width = 30; this.height = 30;
            this.maxHealth = 10 * level;
            this.speed = 150 + level * 10;
        } else if (rand < 0.9) {
            this.type = 2;
            this.width = 50; this.height = 50;
            this.maxHealth = 30 * level;
            this.speed = 100 + level * 5;
        } else {
            this.type = 3;
            this.width = 80; this.height = 80;
            this.maxHealth = 80 * level;
            this.speed = 70 + level * 2;
        }
        this.health = this.maxHealth;

        // 保留原文件中的运动模式
        const patterns = ['straight', 'zigzag', 'sine', 'diagonal'];
        this.movePattern = patterns[Math.floor(Math.random() * patterns.length)];
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.active = false;
            return true; // 表示已击杀
        }
        return false;
    }

    // 接收动态边界 playArea
    update(deltaTime, canvasHeight, playArea) {
        if (!this.active) return;
        
        this.moveTimer += deltaTime;
        this.angle += deltaTime * 0.003;
        
        // 继承原版运动算法
        switch (this.movePattern) {
            case 'straight':
                this.y += this.speed * deltaTime;
                break;
            case 'zigzag':
                this.y += this.speed * deltaTime;
                this.x += Math.sin(this.moveTimer * 5) * 2;
                break;
            case 'sine':
                this.y += this.speed * deltaTime;
                this.x = this.originalX + Math.sin(this.moveTimer * 2) * 50;
                break;
            case 'diagonal':
                this.y += this.speed * 0.8 * deltaTime;
                this.x += Math.sin(this.angle) * 1.5;
                break;
        }
        
        // 严格边界限制
        if (playArea) {
            this.x = Math.max(playArea.minX + this.width / 2, Math.min(this.x, playArea.maxX - this.width / 2));
        }

        if (this.y > canvasHeight + this.height) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // 继承原版几何图形绘制逻辑
        let color = this.type === 1 ? '#ff4444' : (this.type === 2 ? '#ff8800' : '#aa00ff');
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        
        if (this.type === 1) {
            ctx.beginPath();
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(this.width / 2, this.height / 2);
            ctx.lineTo(-this.width / 2, this.height / 2);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 2) {
            ctx.beginPath();
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(this.width / 2, 0);
            ctx.lineTo(this.width / 3, this.height / 2);
            ctx.lineTo(-this.width / 3, this.height / 2);
            ctx.lineTo(-this.width / 2, 0);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(this.width / 2, -this.height / 4);
            ctx.lineTo(this.width / 2, this.height / 4);
            ctx.lineTo(this.width / 4, this.height / 2);
            ctx.lineTo(-this.width / 4, this.height / 2);
            ctx.lineTo(-this.width / 2, this.height / 4);
            ctx.lineTo(-this.width / 2, -this.height / 4);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 6, 0, Math.PI * 2);
        ctx.fill();

        // 血条绘制
        if (this.type !== 1 && this.health < this.maxHealth) {
            const healthPercent = this.health / this.maxHealth;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(-this.width / 2, -this.height / 2 - 10, this.width, 4);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-this.width / 2, -this.height / 2 - 10, this.width * healthPercent, 4);
        }
        
        ctx.restore();
    }
}
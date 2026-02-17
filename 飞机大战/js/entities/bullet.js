export default class Bullet {
    constructor(x, y, speed, damage, type = 'straight', angleOffset = 0) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.damage = damage;
        this.type = type;
        this.angleOffset = angleOffset; // 用于扇形子弹的角度偏移
        this.active = true;
        
        // 根据类型设定样式
        if (type === 'pierce') {
            this.width = 10;
            this.height = 30;
            this.color = '#ff0055';
            this.isPiercing = true; // 穿透标记
        } else if (type === 'spread') {
            this.width = 4;
            this.height = 10;
            this.color = '#ffff00';
            this.isPiercing = false;
        } else {
            this.width = 4;
            this.height = 12;
            this.color = '#00d4ff';
            this.isPiercing = false;
        }
    }

    update(deltaTime) {
        // 处理角度移动 (扇形弹道)
        if (this.angleOffset !== 0) {
            this.x += Math.sin(this.angleOffset) * this.speed * deltaTime;
            this.y -= Math.cos(this.angleOffset) * this.speed * deltaTime;
        } else {
            this.y -= this.speed * deltaTime;
        }
        
        if (this.y < -50 || this.x < -50 || this.x > window.innerWidth + 50) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        
        // 简单的旋转绘制 (如果有角度)
        if (this.angleOffset !== 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angleOffset);
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        }
        
        ctx.shadowBlur = 0;
    }
}
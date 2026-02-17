export default class Bullet {
    constructor(x, y, speed, damage, type = 'straight', angleOffset = 0) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.damage = damage;
        this.type = type;
        this.angleOffset = angleOffset;
        this.active = true;
        
        // 样式配置
        if (type === 'pierce') {
            this.width = 10;
            this.height = 30;
            this.color = '#ff0055';
            this.isPiercing = true;
        } else if (type === 'spread') {
            this.width = 4;
            this.height = 10;
            this.color = '#ffff00';
            this.isPiercing = false;
        } else if (type === 'bomb') {
            // v2.1 Update: 虚空导弹
            this.width = 20; 
            this.height = 20;
            this.color = '#9900ff';
            this.isPiercing = false; // 撞到即炸（未来逻辑）
        } else {
            this.width = 4;
            this.height = 12;
            this.color = '#00d4ff';
            this.isPiercing = false;
        }
    }

    update(deltaTime) {
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
        
        if (this.type === 'bomb') {
            // 虚空导弹特效：紫色脉冲球
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = this.color;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            // 核心亮点
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width/4, 0, Math.PI * 2);
            ctx.fill();
        } 
        else {
            // 普通子弹绘制
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            
            if (this.angleOffset !== 0) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angleOffset);
                ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
                ctx.restore();
            } else {
                ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
            }
        }
        ctx.shadowBlur = 0;
    }
}
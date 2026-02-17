export default class Bullet {
    constructor(x, y, speed, damage, type = 'straight', angleOffset = 0) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.damage = damage;
        this.type = type;
        this.angleOffset = angleOffset;
        this.active = true;
        
        // v2.2 Update: 状态机变量
        this.state = 'FLYING'; // FLYING | EXPLODING
        this.timer = 0;        // 存活/爆炸计时器
        this.maxExplosionRadius = 150; // 爆炸冲击波半径

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
            this.width = 20; 
            this.height = 20;
            this.color = '#9900ff';
            this.isPiercing = false; 
        } else {
            this.width = 4;
            this.height = 12;
            this.color = '#00d4ff';
            this.isPiercing = false;
        }
    }

    update(deltaTime) {
        // v2.2 Update: 虚空导弹特殊逻辑
        if (this.type === 'bomb') {
            if (this.state === 'FLYING') {
                this.y -= this.speed * deltaTime;
                this.timer += deltaTime;

                // 飞行 1.5秒后自动引爆
                if (this.timer > 1.5) {
                    this.state = 'EXPLODING';
                    this.timer = 0; // 重置计时器用于爆炸动画
                }
            } 
            else if (this.state === 'EXPLODING') {
                // 爆炸持续 0.5秒
                this.timer += deltaTime;
                if (this.timer > 0.5) {
                    this.active = false;
                }
            }
        } 
        else {
            // 普通子弹逻辑
            if (this.angleOffset !== 0) {
                this.x += Math.sin(this.angleOffset) * this.speed * deltaTime;
                this.y -= Math.cos(this.angleOffset) * this.speed * deltaTime;
            } else {
                this.y -= this.speed * deltaTime;
            }
        }
        
        // 边界销毁 (仅对飞行状态有效)
        if (this.state === 'FLYING' && (this.y < -50 || this.x < -50 || this.x > window.innerWidth + 50)) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        
        if (this.type === 'bomb') {
            if (this.state === 'FLYING') {
                // 飞行态：实心能量球
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 15;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2);
                ctx.fill();
                
                // 核心高光
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.width/4, 0, Math.PI * 2);
                ctx.fill();
            } 
            else if (this.state === 'EXPLODING') {
                // 爆炸态：扩散的冲击波
                const progress = this.timer / 0.5; // 0.0 -> 1.0
                const currentRadius = this.width + (this.maxExplosionRadius * progress);
                const alpha = 1.0 - progress; // 渐隐

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = '#d000ff';
                ctx.lineWidth = 5 * (1 - progress);
                ctx.beginPath();
                ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
                ctx.stroke();
                
                // 内部填充
                ctx.fillStyle = `rgba(153, 0, 255, ${0.3 * alpha})`;
                ctx.fill();
                ctx.restore();
            }
        } 
        else {
            // 普通子弹绘制 (保持不变)
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
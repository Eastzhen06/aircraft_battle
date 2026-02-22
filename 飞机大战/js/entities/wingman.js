const LERP_FACTOR = 0.15; // 伴飞平滑追踪系数

export default class Wingman {
    constructor(type, imageLoader, interactiveWidth) {
        this.type = type; // 'none', 'defensive', 'offensive', 'magnetic'
        this.active = type !== 'none';
        
        // 僚机体积大约为玩家80%
        this.width = interactiveWidth * 0.08
        this.height = this.width;

        this.image = null;
        if (type === 'defensive') this.image = imageLoader.get('w_defensive');
        else if (type === 'offensive') this.image = imageLoader.get('w_offensive');
        else if (type === 'magnetic') this.image = imageLoader.get('w_magnetic');

        if (this.image && this.image.width > 0) {
            this.height = this.width * (this.image.height / this.image.width);
        }

        // 双机编队坐标系
        this.left = { x: 0, y: 0 };
        this.right = { x: 0, y: 0 };

        this.magnetTimer = 0;
    }

    update(player, deltaTime, game) {
        if (!this.active) return;

        // 【多态锚定】：锁定在玩家侧翼后方
        const targetLeftX = player.x - player.width * 0.8;
        const targetRightX = player.x + player.width * 0.8;
        const targetY = player.y + 15;

        // 柔性跟随插值运算
        this.left.x += (targetLeftX - this.left.x) * LERP_FACTOR;
        this.left.y += (targetY - this.left.y) * LERP_FACTOR;
        this.right.x += (targetRightX - this.right.x) * LERP_FACTOR;
        this.right.y += (targetY - this.right.y) * LERP_FACTOR;

        // 【引力磁枢系统】：2 秒周期探测并覆写向量
        if (this.type === 'magnetic') {
            this.magnetTimer += deltaTime;
            if (this.magnetTimer >= 2.0) {
                this.magnetTimer = 0;
                game.powerups.forEach(p => {
                    if (p.active) {
                        p.isMagnetized = true; // 发送磁化指令给 game.js
                    }
                });
            }
        }
    }

    shoot(game) {
        if (!this.active || this.type !== 'offensive') return;
        // 【侧翼火力系统】：跟随主机主炮循环触发
        game.spawnBullet(this.left.x, this.left.y - this.height/2, 600, 5, 'straight');
        game.spawnBullet(this.right.x, this.right.y - this.height/2, 600, 5, 'straight');
    }

    draw(ctx) {
        if (!this.active) return;
        
        if (this.image) {
            ctx.drawImage(this.image, this.left.x - this.width/2, this.left.y - this.height/2, this.width, this.height);
            ctx.drawImage(this.image, this.right.x - this.width/2, this.right.y - this.height/2, this.width, this.height);
        }

        // 【防御盾卫系统】：绘制物理拦截力场视觉效果
        if (this.type === 'defensive') {
            ctx.strokeStyle = 'rgba(0, 255, 100, 0.6)';
            ctx.lineWidth = 2;
            const auraRadius = this.width * 0.8;
            ctx.beginPath(); ctx.arc(this.left.x, this.left.y, auraRadius, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(this.right.x, this.right.y, auraRadius, 0, Math.PI * 2); ctx.stroke();
        }
    }
}
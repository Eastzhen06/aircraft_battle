const LERP_FACTOR = 0.15; 

export default class Wingman {
    constructor(type, imageLoader, interactiveWidth) {
        this.type = type; 
        this.active = type !== 'none';
        
        // 【v4.4 修改部分】：增大了 7% 的尺寸比例 (0.05 * 1.07 ≈ 0.0535)
        this.width = interactiveWidth * 0.0535; 
        this.height = this.width;

        this.image = null;
        if (type === 'defensive') this.image = imageLoader.get('w_defensive');
        else if (type === 'offensive') this.image = imageLoader.get('w_offensive');
        else if (type === 'magnetic') this.image = imageLoader.get('w_magnetic');

        if (this.image && this.image.width > 0) {
            this.height = this.width * (this.image.height / this.image.width);
        }

        this.left = { x: 0, y: 0 };
        this.right = { x: 0, y: 0 };
        this.magnetTimer = 0;

        // 【v4.4 修改部分】：防御型独立能量管理与状态
        this.defensiveUses = 3; 
        this.isForcefieldActive = false;
        this.forcefieldTimer = 0;
    }

    update(player, deltaTime, game) {
        if (!this.active) return;

        const targetLeftX = player.x - player.width * 0.8;
        const targetRightX = player.x + player.width * 0.8;
        const targetY = player.y + 15;

        this.left.x += (targetLeftX - this.left.x) * LERP_FACTOR;
        this.left.y += (targetY - this.left.y) * LERP_FACTOR;
        this.right.x += (targetRightX - this.right.x) * LERP_FACTOR;
        this.right.y += (targetY - this.right.y) * LERP_FACTOR;

        if (this.type === 'magnetic') {
            this.magnetTimer += deltaTime;
            if (this.magnetTimer >= 2.0) {
                this.magnetTimer = 0;
                game.powerups.forEach(p => { if (p.active) p.isMagnetized = true; });
            }
        }

        // 【v4.4 修改部分】：防御阵列自治触发 AI
        if (this.type === 'defensive') {
            if (this.isForcefieldActive) {
                this.forcefieldTimer -= deltaTime;
                if (this.forcefieldTimer <= 0) this.isForcefieldActive = false;
            } else if (this.defensiveUses > 0 && !player.isShieldActive) {
                // 自治 AI：若 Boss 存在且本局还没用过护盾，强制兜底激活
                let shouldTrigger = false;
                if (game.boss && game.boss.active && this.defensiveUses === 3) {
                    shouldTrigger = true;
                }
                
                // 战况检测：子弹过于密集逼近
                if (!shouldTrigger) {
                    const dangerZone = 120;
                    for (let b of game.enemyBullets) {
                        if (b.active && Math.hypot(b.x - player.x, b.y - player.y) < dangerZone) {
                            shouldTrigger = true; break;
                        }
                    }
                }

                if (shouldTrigger) {
                    this.isForcefieldActive = true;
                    this.forcefieldTimer = 4.0; // 开启 4 秒联合力场
                    this.defensiveUses--;
                    console.log(`[Wingman AI] 侦测到高危打击，矩阵力场展开！剩余能量：${this.defensiveUses}`);
                }
            }
        }
    }

    shoot(game) {
        if (!this.active || this.type !== 'offensive') return;
        game.spawnBullet(this.left.x, this.left.y - this.height/2, 600, 5, 'straight');
        game.spawnBullet(this.right.x, this.right.y - this.height/2, 600, 5, 'straight');
    }

    draw(ctx, player) {
        if (!this.active) return;
        if (this.image) {
            ctx.drawImage(this.image, this.left.x - this.width/2, this.left.y - this.height/2, this.width, this.height);
            ctx.drawImage(this.image, this.right.x - this.width/2, this.right.y - this.height/2, this.width, this.height);
        }

        // 【v4.4 修改部分】：智能联合阵列视觉呈现
        if (this.type === 'defensive' && this.isForcefieldActive && player) {
            ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
            ctx.fillStyle = 'rgba(0, 255, 100, 0.15)';
            ctx.lineWidth = 4;
            
            // 包裹两架僚机与主机的超大矩形/椭圆框
            const fw = (this.right.x - this.left.x) + this.width * 2;
            const fx = this.left.x - this.width;
            const fh = (this.left.y - player.y) + player.height + 40;
            const fy = player.y - player.height;

            ctx.beginPath();
            ctx.roundRect(fx, fy, fw, fh, 25); 
            ctx.fill();
            ctx.stroke();
            
            // 发光扫描线特效
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(0, 255, 100, ${0.5 + Math.sin(Date.now()/50)*0.5})`;
            ctx.beginPath();
            ctx.moveTo(fx, fy + fh/2); ctx.lineTo(fx + fw, fy + fh/2);
            ctx.stroke();
            ctx.restore();
        }
    }
}
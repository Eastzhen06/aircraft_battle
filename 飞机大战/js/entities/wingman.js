// 【v4.8 修改】：严格修正资源键名为原版 w_xxx 系列，并清除和平僚机的射击参数
const WINGMAN_TYPES = {
    'none': { shootInterval: 0, bulletSpeed: 0, bulletDamage: 0, asset: null },
    'defensive': { 
        shootInterval: 0, bulletSpeed: 0, bulletDamage: 0, asset: 'w_defensive', // 修复图片键名与射速
        isDefensive: true, maxUses: 3,
        shields: { normal: 1, e3: 2, boss: 1 }
    },
    'offensive': { shootInterval: 0.2, bulletSpeed: 800, bulletDamage: 15, asset: 'w_offensive' }, // 修复图片键名
    'magnetic': { shootInterval: 0, bulletSpeed: 0, bulletDamage: 0, asset: 'w_magnetic', isMagnetic: true } // 修复图片键名与射速
};

export default class Wingman {
    constructor(type = 'none', imageLoader, interactiveWidth = window.innerWidth) {
        this.type = type;
        this.config = WINGMAN_TYPES[type];
        this.image = imageLoader.get(this.config.asset);
        
        this.width = interactiveWidth * 0.05; 
        if (this.image && this.image.width > 0) this.height = this.width * (this.image.height / this.image.width);
        else this.height = this.width;

        this.left = { x: 0, y: 0 };
        this.right = { x: 0, y: 0 };
        this.shootCooldown = 0;
        
        this.isForcefieldActive = false;
        this.forcefieldTimer = 0;
        this.forcefieldDuration = 5;
    }

    update(player, deltaTime, game) {
        if (this.type === 'none') return;

        const offsetX = player.width * 0.8;
        const offsetY = 20;
        this.left.x = player.x - offsetX; this.left.y = player.y + offsetY;
        this.right.x = player.x + offsetX; this.right.y = player.y + offsetY;

        if (this.shootCooldown > 0) this.shootCooldown -= deltaTime;
        
        if (this.config.isDefensive && this.isForcefieldActive) {
            this.forcefieldTimer -= deltaTime;
            if (this.forcefieldTimer <= 0) {
                this.isForcefieldActive = false;
                console.log("僚机智能护盾离线。");
            }
        }
        
        if (this.config.isMagnetic && game.powerups) {
            game.powerups.forEach(p => {
                if (p.active && Math.abs(p.y - player.y) < 300) p.isMagnetized = true;
            });
        }
    }

    shoot(game) {
        // 【v4.8 修改】：加装绝对拦截墙，彻底禁止非攻击型僚机开火
        if (this.type !== 'offensive' || this.shootCooldown > 0) return;
        
        this.shootCooldown = this.config.shootInterval;
        game.spawnBullet(this.left.x, this.left.y, this.config.bulletSpeed, this.config.bulletDamage, 'straight');
        game.spawnBullet(this.right.x, this.right.y, this.config.bulletSpeed, this.config.bulletDamage, 'straight');
    }

    requestDefense(threatType) {
        if (!this.config.isDefensive || this.isForcefieldActive) return false;

        let threatKey = 'normal';
        if (threatType === 'E3_LASER') threatKey = 'e3';
        if (threatType === 'BOSS_LASER') threatKey = 'boss';

        if (this.config.shields[threatKey] > 0) {
            this.config.shields[threatKey]--;
            this.isForcefieldActive = true;
            this.forcefieldTimer = this.forcefieldDuration;
            console.log(`⚠️ 僚机响应威胁 [${threatKey}]! 激活智能立场。剩余配额: ${this.config.shields[threatKey]}`);
            return true; 
        }
        return false;
    }

    draw(ctx, player) {
        if (this.type === 'none') return;
        
        if (this.image) {
            ctx.drawImage(this.image, this.left.x - this.width/2, this.left.y - this.height/2, this.width, this.height);
            ctx.drawImage(this.image, this.right.x - this.width/2, this.right.y - this.height/2, this.width, this.height);
        }

        if (this.config.isDefensive && this.isForcefieldActive) {
            const fieldWidth = (this.right.x - this.left.x) + this.width * 2;
            const fieldHeight = player.height + 40;
            const x = this.left.x - this.width;
            const y = player.y - player.height;
            
            const alpha = 0.3 + Math.sin(Date.now() / 150) * 0.2;
            ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`; 
            ctx.strokeStyle = `rgba(255, 100, 100, 0.8)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(x, y, fieldWidth, fieldHeight, 15);
            ctx.fill();
            ctx.stroke();
        }
    }
}
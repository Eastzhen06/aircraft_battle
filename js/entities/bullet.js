class Bullet {
    constructor(x, y, vx, vy, damage, isEnemy, width, height) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.isEnemy = isEnemy;
        this.width = width;
        this.height = height;
        this.active = true;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }
    
    draw(ctx) {
        ctx.save();
        
        if (this.isEnemy) {
            ctx.fillStyle = GAME_CONFIG.COLORS.BULLET_ENEMY;
            ctx.shadowColor = GAME_CONFIG.COLORS.BULLET_ENEMY;
        } else {
            ctx.fillStyle = GAME_CONFIG.COLORS.BULLET_PLAYER;
            ctx.shadowColor = GAME_CONFIG.COLORS.BULLET_PLAYER;
        }
        ctx.shadowBlur = 10;
        
        ctx.fillRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        
        ctx.restore();
    }
}

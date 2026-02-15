class ObjectPool {
    constructor(createFn, initialSize = 50) {
        this.createFn = createFn;
        this.pool = [];
        this.active = [];
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        this.active.push(obj);
        return obj;
    }
    
    release(obj) {
        const index = this.active.indexOf(obj);
        if (index !== -1) {
            this.active.splice(index, 1);
            this.pool.push(obj);
        }
    }
    
    releaseAll() {
        while (this.active.length > 0) {
            this.pool.push(this.active.pop());
        }
    }
    
    getActive() {
        return this.active;
    }
    
    forEach(callback) {
        for (const obj of this.active) {
            callback(obj);
        }
    }
}

class BulletPool extends ObjectPool {
    constructor() {
        super(() => ({ 
            x: 0, 
            y: 0, 
            width: 0, 
            height: 0, 
            vx: 0, 
            vy: 0, 
            damage: 0, 
            isEnemy: false, 
            active: false 
        }), 100);
    }
    
    spawn(x, y, vx, vy, damage, isEnemy, width, height) {
        const bullet = this.get();
        bullet.x = x;
        bullet.y = y;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.damage = damage;
        bullet.isEnemy = isEnemy;
        bullet.width = width;
        bullet.height = height;
        bullet.active = true;
        return bullet;
    }
    
    update(canvasHeight) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const bullet = this.active[i];
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            
            if (bullet.y < -20 || bullet.y > canvasHeight + 20 ||
                bullet.x < -20 || bullet.x > 900) {
                bullet.active = false;
                this.release(bullet);
            }
        }
    }
    
    draw(ctx) {
        for (const bullet of this.active) {
            if (!bullet.active) continue;
            
            ctx.save();
            if (bullet.isEnemy) {
                ctx.fillStyle = GAME_CONFIG.COLORS.BULLET_ENEMY;
                ctx.shadowColor = GAME_CONFIG.COLORS.BULLET_ENEMY;
            } else {
                ctx.fillStyle = GAME_CONFIG.COLORS.BULLET_PLAYER;
                ctx.shadowColor = GAME_CONFIG.COLORS.BULLET_PLAYER;
            }
            ctx.shadowBlur = 10;
            
            ctx.fillRect(
                bullet.x - bullet.width / 2,
                bullet.y - bullet.height / 2,
                bullet.width,
                bullet.height
            );
            ctx.restore();
        }
    }
}

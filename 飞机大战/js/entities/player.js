const LERP_FACTOR = 0.25; 
function lerp(a, b, t) { return a + (b - a) * t; }

export const PLANE_TYPES = {
    'Ranger': { speed: 1.0, hp: 100, lives: 2, shield: 3, bulletType: 'straight', asset: 'Ranger' },
    'Interceptor': { speed: 1.5, hp: 80, lives: 2, shield: 2, bulletType: 'spread', asset: 'Interceptor' },
    'Fortress': { speed: 0.8, hp: 150, lives: 3, shield: 5, bulletType: 'pierce', asset: 'Fortress' },
    'VoidBomber': { speed: 0.9, hp: 100, lives: 4, shield: 3, bulletType: 'bomb', asset: 'VoidBomber' }
};

export default class Player {
    constructor(x, y, imageLoader, type = 'Ranger') {
        const config = PLANE_TYPES[type];
        this.image = imageLoader.get(config.asset);
        
        this.width = window.innerWidth * 0.15 * 0.85; 
        if (this.image && this.image.width > 0) {
            this.height = this.width * (this.image.height / this.image.width);
        } else {
            this.height = this.width;
        }

        this.x = x;
        this.y = y;
        
        this.config = config;
        this.maxHp = config.hp;
        this.hp = this.maxHp;
        this.lives = config.lives;
        
        this.shieldCount = config.shield;
        this.isShieldActive = false;
        this.shieldTimer = 0;
        this.shieldDuration = 8;
        
        this.isInvincible = false; 
        this.isBlinking = false;   
        this.blinkTimer = 0;

        this.shootCooldown = 0;
        this.shootInterval = 1 / 7;
        this.bulletType = config.bulletType;
    }

    update(input, deltaTime, canvas, skillSystem) {
        if (input.isDetected) {
            this.x = lerp(this.x, input.x, LERP_FACTOR);
            this.y = lerp(this.y, input.y, LERP_FACTOR);
        }

        this.x = Math.max(this.width / 2, Math.min(this.x, canvas.width - this.width / 2));
        this.y = Math.max(this.height / 2, Math.min(this.y, canvas.height - this.height / 2));

        let shouldShoot = false;
        
        if (this.isBlinking) {
            this.blinkTimer -= deltaTime;
            if (this.blinkTimer <= 0) this.isBlinking = false;
        }

        const isUltActive = skillSystem && skillSystem.state === 'ACTIVE';
        this.isInvincible = this.isShieldActive || isUltActive || this.isBlinking;

        if (!isUltActive) {
            switch (input.gesture) {
                case 'GUN': shouldShoot = this.shoot(); break;
                case 'FIST': this.activateShield(); shouldShoot = this.shoot(); break;
                case 'RECOIL':
                    if (skillSystem && skillSystem.isReady()) skillSystem.trigger();
                    else shouldShoot = this.shoot();
                    break;
            }
        }
        
        if (this.shootCooldown > 0) this.shootCooldown -= deltaTime;
        if (this.isShieldActive && this.shieldTimer > 0) {
            this.shieldTimer -= deltaTime;
            if (this.shieldTimer <= 0) this.isShieldActive = false;
        }

        return shouldShoot;
    }
    
    shoot() {
        if (this.shootCooldown <= 0) {
            this.shootCooldown = this.shootInterval;
            return true;
        }
        return false;
    }

    activateShield() {
        if (this.shieldCount > 0 && !this.isShieldActive) {
            this.shieldCount--;
            this.isShieldActive = true;
            this.shieldTimer = this.shieldDuration;
        }
    }
    
    triggerBlink() {
        this.isBlinking = true;
        this.blinkTimer = 3.0; 
    }

    draw(ctx) {
        if (this.isBlinking && Math.floor(Date.now() / 100) % 2 === 0) return;

        if (this.isShieldActive) {
            const shieldRadius = Math.max(this.width, this.height) * 0.55;
            const alpha = 0.3 + Math.sin(Date.now() / 200) * 0.2;
            ctx.fillStyle = `rgba(0, 180, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, shieldRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(0, 255, 255, 0.8)`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (this.image) {
            ctx.drawImage(this.image, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        }
    }
}
class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || randomRange(-3, 3);
        this.vy = options.vy || randomRange(-3, 3);
        this.size = options.size || randomRange(2, 6);
        this.color = options.color || GAME_CONFIG.COLORS.EXPLOSION[randomInt(0, 4)];
        this.life = options.life || 1;
        this.decay = options.decay || randomRange(0.02, 0.05);
        this.gravity = options.gravity || 0;
        this.active = true;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
        this.size *= 0.98;
        
        if (this.life <= 0 || this.size < 0.5) {
            this.active = false;
        }
    }
    
    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = 500;
    }
    
    emit(x, y, count, options = {}) {
        for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
            this.particles.push(new Particle(x, y, options));
        }
    }
    
    createExplosion(x, y, size = 1) {
        const count = Math.floor(20 * size);
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + randomRange(-0.2, 0.2);
            const speed = randomRange(2, 6) * size;
            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: randomRange(3, 8) * size,
                color: GAME_CONFIG.COLORS.EXPLOSION[randomInt(0, 4)],
                life: 1,
                decay: randomRange(0.015, 0.03)
            }));
        }
    }
    
    createTrail(x, y, color) {
        if (this.particles.length >= this.maxParticles) return;
        
        this.particles.push(new Particle(x, y, {
            vx: randomRange(-0.5, 0.5),
            vy: randomRange(1, 2),
            size: randomRange(2, 4),
            color: color,
            life: 0.6,
            decay: 0.03
        }));
    }
    
    createPowerupEffect(x, y) {
        for (let i = 0; i < 15; i++) {
            const angle = (Math.PI * 2 / 15) * i;
            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                size: randomRange(3, 5),
                color: '#ffff44',
                life: 1,
                decay: 0.025
            }));
        }
    }
    
    createShieldHit(x, y) {
        for (let i = 0; i < 10; i++) {
            const angle = randomRange(0, Math.PI * 2);
            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * randomRange(2, 4),
                vy: Math.sin(angle) * randomRange(2, 4),
                size: randomRange(2, 4),
                color: '#00ffff',
                life: 0.8,
                decay: 0.04
            }));
        }
    }
    
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (!this.particles[i].active) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    draw(ctx) {
        for (const particle of this.particles) {
            particle.draw(ctx);
        }
    }
    
    clear() {
        this.particles = [];
    }
}

const particleSystem = new ParticleSystem();

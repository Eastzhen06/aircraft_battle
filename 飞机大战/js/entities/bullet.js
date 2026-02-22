export default class Bullet {
    constructor(x, y, speed, damage, type = 'straight', angleOffset = 0) {
        this.x = x; this.y = y;
        this.speed = speed; this.damage = damage;
        this.type = type; this.angleOffset = angleOffset;
        this.active = true;
        
        this.state = 'FLYING'; 
        this.timer = 0;        
        this.maxExplosionRadius = 150; 

        if (type === 'pierce') { this.width = 10; this.height = 30; this.color = '#ff0055'; this.isPiercing = true; }
        else if (type === 'spread') { this.width = 4; this.height = 10; this.color = '#ffff00'; this.isPiercing = false; }
        else if (type === 'bomb') { this.width = 20; this.height = 20; this.color = '#9900ff'; this.isPiercing = false; }
        else if (type === 'enemy') { this.width = 6; this.height = 12; this.color = '#ff5500'; this.isPiercing = false; }
        else { this.width = 4; this.height = 12; this.color = '#00d4ff'; this.isPiercing = false; }
    }

    update(deltaTime) {
        if (this.type === 'bomb') {
            if (this.state === 'FLYING') this.y -= this.speed * deltaTime;
            else if (this.state === 'EXPLODING') {
                this.timer += deltaTime;
                if (this.timer > 0.5) this.active = false;
            }
        } 
        else {
            if (this.angleOffset !== 0) {
                this.x += Math.sin(this.angleOffset) * this.speed * deltaTime;
                this.y -= Math.cos(this.angleOffset) * this.speed * deltaTime;
            } else this.y -= this.speed * deltaTime;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        
        if (this.type === 'bomb') {
            if (this.state === 'FLYING') {
                ctx.fillStyle = this.color;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(this.x, this.y, this.width/4, 0, Math.PI * 2); ctx.fill();
            } 
            else if (this.state === 'EXPLODING') {
                const progress = this.timer / 0.5; 
                const currentRadius = this.width + (this.maxExplosionRadius * progress);
                const alpha = 1.0 - progress; 

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = '#d000ff';
                ctx.lineWidth = 5 * (1 - progress);
                ctx.beginPath(); ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = `rgba(153, 0, 255, 0.3)`; ctx.fill();
                ctx.restore();
            }
        } 
        else {
            ctx.fillStyle = this.color;
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
    }
}
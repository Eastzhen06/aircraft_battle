class Powerup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = GAME_CONFIG.POWERUP.WIDTH;
        this.height = GAME_CONFIG.POWERUP.HEIGHT;
        this.speed = GAME_CONFIG.POWERUP.SPEED;
        this.active = true;
        this.angle = 0;
        this.pulsePhase = 0;
    }
    
    update(deltaTime, canvasHeight) {
        this.y += this.speed;
        this.angle += deltaTime * 0.003;
        this.pulsePhase += deltaTime * 0.01;
        
        if (this.y > canvasHeight + this.height) {
            this.active = false;
        }
    }
    
    applyTo(player) {
        switch (this.type) {
            case POWERUP_TYPES.HEALTH:
                player.heal(GAME_CONFIG.POWERUP.TYPES.HEALTH.heal);
                break;
            case POWERUP_TYPES.POWER:
                player.increasePower();
                break;
            case POWERUP_TYPES.SHIELD:
                player.activateShield(GAME_CONFIG.POWERUP.TYPES.SHIELD.duration);
                break;
        }
        
        soundManager.playPowerup();
        particleSystem.createPowerupEffect(this.x, this.y);
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.1;
        ctx.scale(pulse, pulse);
        ctx.rotate(this.angle);
        
        let color;
        let symbol;
        switch (this.type) {
            case POWERUP_TYPES.HEALTH:
                color = GAME_CONFIG.POWERUP.TYPES.HEALTH.color;
                symbol = '+';
                break;
            case POWERUP_TYPES.POWER:
                color = GAME_CONFIG.POWERUP.TYPES.POWER.color;
                symbol = 'P';
                break;
            case POWERUP_TYPES.SHIELD:
                color = GAME_CONFIG.POWERUP.TYPES.SHIELD.color;
                symbol = 'S';
                break;
        }
        
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
            const x = Math.cos(angle) * this.width / 2;
            const y = Math.sin(angle) * this.height / 2;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, 0, 0);
        
        ctx.restore();
    }
}

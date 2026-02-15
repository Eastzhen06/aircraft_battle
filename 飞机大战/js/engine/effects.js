(function() {
    class EffectsSystem {
        constructor() {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        
        this.flashColor = null;
        this.flashDuration = 0;
        this.flashAlpha = 0;
        
        this.slowMotionFactor = 1.0;
        this.slowMotionDuration = 0;
    }
    
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }
    
    flash(color, duration) {
        this.flashColor = color;
        this.flashDuration = duration;
        this.flashAlpha = 0.5; // Start at 50% opacity
    }
    
    slowMotion(factor, duration) {
        this.slowMotionFactor = factor;
        this.slowMotionDuration = duration;
    }
    
    update(deltaTime) {
        // Update Shake
        if (this.shakeDuration > 0) {
            this.shakeDuration -= deltaTime;
            if (this.shakeDuration <= 0) {
                this.shakeIntensity = 0;
                this.shakeOffsetX = 0;
                this.shakeOffsetY = 0;
            } else {
                this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
                this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
                // Decay intensity
                this.shakeIntensity *= 0.9;
            }
        }
        
        // Update Flash
        if (this.flashDuration > 0) {
            this.flashDuration -= deltaTime;
            this.flashAlpha = Math.max(0, this.flashAlpha - (deltaTime / 1000)); // Fade out
            if (this.flashDuration <= 0) {
                this.flashColor = null;
            }
        }
        
        // Update Slow Motion
        if (this.slowMotionDuration > 0) {
            this.slowMotionDuration -= deltaTime;
            if (this.slowMotionDuration <= 0) {
                this.slowMotionFactor = 1.0;
            }
        }
    }
    
    preRender(ctx) {
        if (this.shakeIntensity > 0) {
            ctx.save();
            ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
        }
    }
    
    postRender(ctx) {
        if (this.shakeIntensity > 0) {
            ctx.restore();
        }
        
        if (this.flashColor && this.flashAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = this.flashAlpha;
            ctx.fillStyle = this.flashColor;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    }
    
    getDeltaTime(realDeltaTime) {
        return realDeltaTime * this.slowMotionFactor;
    }
}

    window.effectsSystem = new EffectsSystem();
})();

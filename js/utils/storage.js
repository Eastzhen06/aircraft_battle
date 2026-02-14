const Storage = {
    KEYS: {
        HIGH_SCORE: 'planeWar_highScore',
        SETTINGS: 'planeWar_settings'
    },
    
    save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('Storage save failed:', e);
            return false;
        }
    },
    
    load(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.warn('Storage load failed:', e);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('Storage remove failed:', e);
            return false;
        }
    },
    
    getHighScore() {
        return this.load(this.KEYS.HIGH_SCORE, 0);
    },
    
    setHighScore(score) {
        const current = this.getHighScore();
        if (score > current) {
            this.save(this.KEYS.HIGH_SCORE, score);
            return true;
        }
        return false;
    },
    
    getSettings() {
        return this.load(this.KEYS.SETTINGS, {
            soundEnabled: true,
            musicEnabled: true,
            difficulty: 'normal'
        });
    },
    
    setSettings(settings) {
        this.save(this.KEYS.SETTINGS, settings);
    }
};

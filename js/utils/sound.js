class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.musicEnabled = true;
        this.soundEnabled = true;
        this.musicVolume = 0.3;
        this.soundVolume = 0.5;
        this.currentMusic = null;
        this.initialized = false;
    }
    
    async init() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    createOscillatorSound(frequency, type, duration, volume = 1) {
        if (!this.audioContext || !this.soundEnabled) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(volume * this.soundVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playShoot() {
        this.createOscillatorSound(800, 'square', 0.1, 0.3);
    }
    
    playExplosion() {
        if (!this.audioContext || !this.soundEnabled) return;
        
        const bufferSize = this.audioContext.sampleRate * 0.3;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        gainNode.gain.setValueAtTime(0.4 * this.soundVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        source.start();
    }
    
    playPowerup() {
        const frequencies = [523, 659, 784, 1047];
        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                this.createOscillatorSound(freq, 'sine', 0.15, 0.4);
            }, i * 50);
        });
    }
    
    playHit() {
        this.createOscillatorSound(200, 'sawtooth', 0.1, 0.4);
    }
    
    playLevelUp() {
        const frequencies = [523, 659, 784, 1047, 1319];
        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                this.createOscillatorSound(freq, 'sine', 0.2, 0.5);
            }, i * 80);
        });
    }
    
    playGameOver() {
        const frequencies = [392, 349, 330, 262];
        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                this.createOscillatorSound(freq, 'sine', 0.3, 0.5);
            }, i * 150);
        });
    }
    
    startMusic() {
        if (!this.audioContext || !this.musicEnabled || this.currentMusic) return;
        
        this.playMusicLoop();
    }
    
    playMusicLoop() {
        if (!this.audioContext || !this.musicEnabled) return;
        
        const notes = [262, 294, 330, 349, 392, 440, 494, 523];
        let noteIndex = 0;
        
        const playNote = () => {
            if (!this.musicEnabled) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = notes[noteIndex];
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1 * this.musicVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.4);
            
            noteIndex = (noteIndex + 1) % notes.length;
            
            this.currentMusic = setTimeout(playNote, 500);
        };
        
        playNote();
    }
    
    stopMusic() {
        if (this.currentMusic) {
            clearTimeout(this.currentMusic);
            this.currentMusic = null;
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        return this.soundEnabled;
    }
    
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) {
            this.stopMusic();
        }
        return this.musicEnabled;
    }
    
    setSoundVolume(volume) {
        this.soundVolume = clamp(volume, 0, 1);
    }
    
    setMusicVolume(volume) {
        this.musicVolume = clamp(volume, 0, 1);
    }
}

const soundManager = new SoundManager();

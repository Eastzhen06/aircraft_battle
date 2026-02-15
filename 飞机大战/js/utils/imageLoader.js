class ImageLoader {
    constructor() {
        this.images = {};
        this.loadedCount = 0;
        this.totalImages = 0;
        this.onProgress = null;
        this.onComplete = null;
    }

    load(sources) {
        this.totalImages = Object.keys(sources).length;
        this.loadedCount = 0;

        for (const [key, src] of Object.entries(sources)) {
            const img = new Image();
            img.onload = () => {
                this.loadedCount++;
                if (this.onProgress) {
                    this.onProgress(this.loadedCount, this.totalImages);
                }
                if (this.loadedCount === this.totalImages && this.onComplete) {
                    this.onComplete();
                }
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
                // Still count as loaded to avoid hanging
                this.loadedCount++;
                if (this.loadedCount === this.totalImages && this.onComplete) {
                    this.onComplete();
                }
            };
            img.src = src;
            this.images[key] = img;
        }
    }

    get(key) {
        const img = this.images[key];
        if (img && img.complete && img.naturalWidth !== 0) {
            return img;
        }
        return null;
    }
}

// Export to global scope
window.imageLoader = new ImageLoader();
window.ASSET_SOURCES = {
    // Player Planes (mapped from oura/a1-a4)
    'p1': 'picture/oura/a1.png',
    'p2': 'picture/oura/a2.png',
    'p3': 'picture/oura/a3.png',
    'p4': 'picture/oura/a4.png',
    'p5': 'picture/oura/a1.png', // Reuse
    'p6': 'picture/oura/a2.png', // Reuse
    'p7': 'picture/oura/a3.png', // Reuse
    'p8': 'picture/oura/a4.png', // Reuse
    'p9': 'picture/oura/a1.png', // Reuse
    'p10': 'picture/oura/a2.png', // Reuse
    'p11': 'picture/oura/a3.png', // Reuse
    'p12': 'picture/oura/a4.png', // Reuse

    // Wingmen (mapped from ourb)
    'w1': 'picture/ourb/attack.png',
    'w2': 'picture/ourb/defense.png',
    'w3': 'picture/ourb/assist.png',
    'w4': 'picture/ourb/attack.png', // Reuse

    // Enemy Planes (mapped from enemy/e1-e3)
    'e1': 'picture/enemy/e1.png',
    'e2': 'picture/enemy/e2.png',
    'e3': 'picture/enemy/e3.png',
    'e4': 'picture/enemy/e1.png', // Reuse
    'e5': 'picture/enemy/e2.png', // Reuse
    'e6': 'picture/enemy/e3.png', // Reuse
    'e7': 'picture/enemy/e1.png', // Reuse
    'e8': 'picture/enemy/e2.png', // Reuse
    'e9': 'picture/enemy/e3.png', // Reuse

    // Boss Planes (mapped from boss/*)
    'b1': 'picture/boss/scouter.png',
    'b2': 'picture/boss/Raider.png',
    'b3': 'picture/boss/fortress.png',
    'b4': 'picture/boss/umbra.png',
    'b5': 'picture/boss/storm.png',
    'b6': 'picture/boss/eddy.png',
    'b7': 'picture/boss/adjudicator.png',
    'b8': 'picture/boss/doomsday.png',
    'b9': 'picture/boss/emperor.png'
};

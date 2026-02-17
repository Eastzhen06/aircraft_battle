export const ASSET_SOURCES = {
    // === 玩家战机 (oura) ===
    'Ranger': './picture/oura/a1.png',
    'Interceptor': './picture/oura/a2.png',
    'Fortress': './picture/oura/a3.png',
    'VoidBomber': './picture/oura/a4.png',
    
    // === 僚机 (ourb) ===
    'Aegis': './picture/ourb/b1.png',   // 防御型
    'Striker': './picture/ourb/b2.png', // 攻击型
    'Magnet': './picture/ourb/b3.png',  // 资源型 (磁铁)
}; 

export default class ImageLoader {
    constructor() {
        this.images = {};
        this.imageCount = 0;
        this.loadedCount = 0;
    }

    load(sources, onComplete) {
        this.imageCount = Object.keys(sources).length;
        if (this.imageCount === 0) {
            if (onComplete) onComplete();
            return;
        }

        for (const key in sources) {
            const path = sources[key];
            const img = new Image();
            img.src = path;

            img.onload = () => {
                this.loadedCount++;
                this.images[key] = img;
                if (this.loadedCount === this.imageCount) {
                    if (onComplete) onComplete();
                }
            };
            img.onerror = () => {
                console.error(`❌ [404 ERROR] 无法加载资源: ${key}`);
                console.error(`   -> 目标路径: ${path}`);
                this.loadedCount++;
                if (this.loadedCount === this.imageCount && onComplete) {
                    onComplete();
                }
            };
        }
    }

    get(key) {
        return this.images[key] || null;
    }
}

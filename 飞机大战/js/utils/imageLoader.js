class ImageLoader {
    constructor() {
        this.images = {};
        this.imageCount = 0;
        this.loadedCount = 0;
        this.onComplete = null;
    }

    load(sources) {
        this.imageCount = Object.keys(sources).length;
        if (this.imageCount === 0) {
            if (this.onComplete) this.onComplete();
            return;
        }

        for (const key in sources) {
            const path = sources[key];
            const img = new Image();
            
            // Task 3 Fix: Log the absolute URL the browser will try to load
            img.src = path; 
            console.log(`Attempting to load image [${key}]: ${img.src}`); // This will show the fully resolved URL

            img.onload = () => {
                this.loadedCount++;
                this.images[key] = img;
                if (this.loadedCount === this.imageCount) {
                    if (this.onComplete) this.onComplete();
                }
            };
            img.onerror = () => {
                console.error(`❌ [404 ERROR] 无法加载资源: ${key}`);
                console.error(`   -> 目标路径: ${path}`);
                console.error(`   -> 浏览器解析路径: ${img.src}`);
                // 仍然增加 loadedCount 防止游戏卡死在 Loading 界面
                this.loadedCount++;
                if (this.loadedCount === this.imageCount && this.onComplete) this.onComplete();
            };
        }
    }

    get(key) {
        return this.images[key] || null;
    }
}

window.imageLoader = new ImageLoader();

// Task 3 Fix: Using strict relative paths from index.html
window.ASSET_SOURCES = {
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

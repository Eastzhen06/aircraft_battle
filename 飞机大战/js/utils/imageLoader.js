export const ASSET_SOURCES = {
    // === 玩家战机 (a系列) ===
    'Ranger': './picture/oura/a1.png',
    'Interceptor': './picture/oura/a2.png',
    'Fortress': './picture/oura/a3.png',
    'VoidBomber': './picture/oura/a4.png',
    
    // === 普通敌机 (e系列) ===
    'e1': './picture/enemy/e1.png', 
    'e2': './picture/enemy/e2.png', 
    'e3': './picture/enemy/e3.png', 

    // === Boss 战机 (b系列) ===
    'b1': './picture/boss/scouter.png',     
    'b2': './picture/boss/Raider.png',      
    'b3': './picture/boss/fortress.png',    
    'b4': './picture/boss/umbra.png',       
    'b5': './picture/boss/storm.png',       
    'b6': './picture/boss/eddy.png',        
    'b7': './picture/boss/adjudicator.png', 
    'b8': './picture/boss/doomsday.png',    
    'b9': './picture/boss/emperor.png',     

    // ==========================================
    // 【v4.0 修改部分：新增僚机系统图片注册】
    // ==========================================
    'w_defensive': './picture/ourb/b1.png',
    'w_offensive': './picture/ourb/b2.png',
    'w_magnetic': './picture/ourb/b3.png'
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
                console.error(`❌ [ImageLoader] Failed to load image: ${key} at ${path}`);
            };
        }
    }

    get(key) {
        return this.images[key];
    }
}
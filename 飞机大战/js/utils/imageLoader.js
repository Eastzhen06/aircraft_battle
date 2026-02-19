// [修复 1] 严格映射真实图像路径
export const ASSET_SOURCES = {
    // === 玩家战机 (a系列) ===
    'Ranger': './picture/oura/a1.png',
    'Interceptor': './picture/oura/a2.png',
    'Fortress': './picture/oura/a3.png',
    'VoidBomber': './picture/oura/a4.png',
    
    // === 普通敌机 (e系列) ===
    'e1': './picture/enemy/e1.png', // 小型
    'e2': './picture/enemy/e2.png', // 中型
    'e3': './picture/enemy/e3.png', // 大型

    // === Boss 战机 (b系列，对应你提供的英文名) ===
    'b1': './picture/boss/scouter.png',     // 第2关: 侦察者
    'b2': './picture/boss/Raider.png',      // 第3关: 突击者
    'b3': './picture/boss/fortress.png',    // 第4关: 堡垒
    'b4': './picture/boss/umbra.png',       // 第5关: 暗影
    'b5': './picture/boss/storm.png',       // 第6关: 风暴
    'b6': './picture/boss/eddy.png',        // 第7关: 漩涡
    'b7': './picture/boss/adjudicator.png', // 第8关: 审判者
    'b8': './picture/boss/doomsday.png',    // 第9关: 末日
    'b9': './picture/boss/emperor.png'      // 第10关: 帝王
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
                console.error(`❌ [404 ERROR] 无法加载资源: ${key} -> 路径: ${path}`);
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
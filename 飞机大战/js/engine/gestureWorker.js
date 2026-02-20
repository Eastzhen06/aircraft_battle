// js/engine/gestureWorker.js
// V3.6: 1 Euro Filter + Hierarchical Topology (GUN/FIST) + Raw Unfiltered Recoil

const vec2 = {
    sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    len: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
    dist: (v1, v2) => Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)),
    normalize: (v) => {
        const l = Math.sqrt(v.x * v.x + v.y * v.y);
        return l > 0.00001 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
    }
};

class OneEuroFilter {
    constructor(a=1,b=0){this.c=a;this.d=b;this.e=1;this.g=this.h=this.f=null;}
    filter(a,b){
        null==this.f&&(this.f=a,this.h=0,this.g=b);
        const c=b-this.g||.016,d=this.i(c,this.e),e=(a-this.f)/c,f=d*e+(1-d)*this.h,g=this.c+this.d*Math.abs(f),j=this.i(c,g);
        return a=j*a+(1-j)*this.f,this.f=a,this.h=f,this.g=b,a;
    }
    i(a,b){return a=2*Math.PI*b*a,a/(a+1);}
}

let handLandmarker = null;
let filters = Array(21).fill(null).map(() => ({ x: new OneEuroFilter(1,.007), y: new OneEuroFilter(1,.007), z: new OneEuroFilter(1,.007) }));

let lastBaseGesture = 'IDLE';
let isFiring = false;
let lastFireTime = 0;
// 【V3.6 变更】记录未经滤波的原始食指物理长度 (Tip to MCP)
let prevRawIndexLen = null; 
let prevTimestamp = 0;

async function initModel() {
    try {
        const { HandLandmarker, FilesetResolver } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "CPU" 
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5
        });
        
        postMessage({ type: 'INIT_DONE' });
    } catch (error) {
        console.error("Worker AI 初始化失败:", error);
    }
}

initModel();

function analyzeHand(rawLandmarks, timestamp) {
    const now = timestamp / 1000; 
    const dt = prevTimestamp ? (now - prevTimestamp) : 0.033;
    prevTimestamp = now;
    
    // 【数据轨 A】：平滑数据 (用于姿势锁定与光标移动)
    const sP = rawLandmarks.map((p, i) => ({ 
        x: filters[i].x.filter(p.x, now), 
        y: filters[i].y.filter(p.y, now),
        z: filters[i].z.filter(p.z, now)
    }));

    const wrist = sP[0];
    
    const isStraight = (tipIdx, pipIdx) => vec2.dist(sP[tipIdx], wrist) > vec2.dist(sP[pipIdx], wrist);
    const isCurledMCP = (tipIdx, mcpIdx) => vec2.dist(sP[tipIdx], wrist) < vec2.dist(sP[mcpIdx], wrist) * 1.3;

    let isThumbUp = isStraight(4, 3);
    let isIndexUp = isStraight(8, 6); 

    const middleCurled = isCurledMCP(12, 9);
    const ringCurled = isCurledMCP(16, 13);
    const pinkyCurled = isCurledMCP(20, 17);

    let currentBaseGesture = 'IDLE';

    // 【V3.6 核心修复】：分级拓扑路由 (Hierarchical Topology)
    if (middleCurled && ringCurled && pinkyCurled) {
        const distIndex = vec2.dist(sP[8], wrist);
        const distMiddle = vec2.dist(sP[12], wrist);
        
        // 第一优先级：高灵敏度手枪判定 (不再受 1.3 倍的死板约束)
        if (isIndexUp || (distIndex > distMiddle * 1.1)) {
            currentBaseGesture = 'GUN';
            isIndexUp = true; // 强制统一状态，消灭红绿横跳
        } 
        // 第二优先级：带有 1.3 倍宽容度的握拳兜底判定 (完美修复正对镜头的透视盲区)
        else if (isCurledMCP(8, 5)) { 
            currentBaseGesture = 'FIST';
            isIndexUp = false;
        } else {
            currentBaseGesture = 'FIST'; 
            isIndexUp = false;
        }
    }

    // --- V3.6 动态原始脉冲引擎 (Raw Relative Delta Normalization) ---
    let finalGesture = currentBaseGesture;
    
    // 【数据轨 B】：未经任何滤波的原始坐标，保证大招脉冲的绝对时序敏锐度
    const rawIndexTip = rawLandmarks[8];
    const rawIndexMCP = rawLandmarks[5];
    // 计算食指在 2D 投影中的绝对欧氏距离 (纯标量，完全免疫 X/Y 轴摇摆平移)
    const currentRawIndexLen = vec2.dist(rawIndexTip, rawIndexMCP);

    // 双重锁：必须在极度稳定的 GUN 姿势下才能进入开火判定
    if (lastBaseGesture === 'GUN' && currentBaseGesture === 'GUN') {
        if (prevRawIndexLen !== null && !isFiring) {
            // 位移抵消：前一帧长度 - 当前帧长度 (正数代表手指正在急速向掌心缩短)
            const deltaLen = prevRawIndexLen - currentRawIndexLen;
            const contractionSpeed = deltaLen / dt; // 计算瞬间缩短速度
            
            // 阈值判定：1.2 是一个极高的鸿沟。缓慢弯曲、前后平移导致的透视缩短，速度都在 0.5 以下。
            // 只有像真实扣扳机一样的瞬间肌肉抽动，才能爆发出 1.2 以上的相对缩短速度。
            if (contractionSpeed > 1.2) {
                isFiring = true;
                lastFireTime = now;
                finalGesture = 'RECOIL';
            }
        }
    }

    // 状态机冷却锁
    if (isFiring) {
        if (now - lastFireTime < 0.15) {
            finalGesture = 'RECOIL'; 
        } else {
            isFiring = false; 
        }
    }

    lastBaseGesture = currentBaseGesture;
    prevRawIndexLen = currentRawIndexLen; // 更新无污染的历史长度

    return {
        gesture: finalGesture,
        fingerStates: [isThumbUp, isIndexUp, !middleCurled, !ringCurled, !pinkyCurled],
        smoothedLandmarks: sP // 传回主线程依然是过滤好的平滑坐标，保证战机移动顺滑
    };
}

self.onmessage = (e) => {
    if (e.data.type === 'PROCESS_FRAME') {
        const { image, timestamp } = e.data;
        
        if (!handLandmarker) {
            image.close(); 
            return;
        }

        const results = handLandmarker.detectForVideo(image, timestamp);
        
        let gestureData = { gesture: 'IDLE', fingerStates: [false,false,false,false,false], smoothedLandmarks: null };
        let isDetected = false;

        if (results.landmarks && results.landmarks.length > 0) {
            isDetected = true;
            gestureData = analyzeHand(results.landmarks[0], timestamp);
        }

        postMessage({
            type: 'RESULT',
            isDetected: isDetected,
            gesture: gestureData.gesture,
            fingerStates: gestureData.fingerStates,
            landmarks: gestureData.smoothedLandmarks 
        });

        image.close(); 
    }
};
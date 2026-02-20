// js/engine/gestureWorker.js
// V3.5.98: 1 Euro Filter + MCP FIST + Relative GUN + Dynamic Contraction RECOIL

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
// 【V3.5.98 变更】记录食指的归一化长度比例，不再记录 Y 坐标
let prevIndexRatio = null; 
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
    
    // 平滑处理用于空间定位与姿势锁定
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

    // 严苛的相对拓扑手枪与 MCP 握拳判定
    if (middleCurled && ringCurled && pinkyCurled) {
        const distIndex = vec2.dist(sP[8], wrist);
        const distMiddle = vec2.dist(sP[12], wrist);
        
        if (isIndexUp || (distIndex > distMiddle * 1.1)) {
            currentBaseGesture = 'GUN';
            isIndexUp = true; 
        } else if (isCurledMCP(8, 5)) { 
            currentBaseGesture = 'FIST';
            isIndexUp = false;
        } else {
            currentBaseGesture = 'FIST'; 
            isIndexUp = false;
        }
    }

    // --- V3.5.98 动态收缩归一化脉冲 (Dynamic Contraction) ---
    let finalGesture = currentBaseGesture;
    
    // 获取未经过滤的原始坐标，保持脉冲动作的绝对敏锐
    const rawIndexTip = rawLandmarks[8];
    const rawIndexMCP = rawLandmarks[5];
    const rawMiddleMCP = rawLandmarks[9];
    const rawWrist = rawLandmarks[0];

    // 1. 食指当前绝对物理长度 (Tip to MCP)
    const indexLength = vec2.dist(rawIndexTip, rawIndexMCP);
    // 2. 掌心基底绝对物理长度 (Middle MCP to Wrist)
    const palmLength = vec2.dist(rawMiddleMCP, rawWrist);
    // 3. 计算归一化比例 (消除手掌大小和远近透视的影响)
    const currentIndexRatio = indexLength / palmLength;

    if (lastBaseGesture === 'GUN' && currentBaseGesture === 'GUN') {
        if (prevIndexRatio !== null && !isFiring) {
            // 收缩时，长度变短，比例变小。因此 prev - current > 0 代表正在收缩
            const deltaRatio = prevIndexRatio - currentIndexRatio;
            const contractionSpeed = deltaRatio / dt; 
            
            // 阈值判定：如果收缩速度极快 (即瞬间向掌心收紧)
            // 1.5 是一个极其稳定的阈值，只有真实的扣扳机动作才能越过，纯粹平移绝对为 0
            if (contractionSpeed > 1.5) {
                isFiring = true;
                lastFireTime = now;
                finalGesture = 'RECOIL';
            }
        }
    }

    if (isFiring) {
        if (now - lastFireTime < 0.15) {
            finalGesture = 'RECOIL'; 
        } else {
            isFiring = false; 
        }
    }

    lastBaseGesture = currentBaseGesture;
    prevIndexRatio = currentIndexRatio; // 更新历史比例

    return {
        gesture: finalGesture,
        fingerStates: [isThumbUp, isIndexUp, !middleCurled, !ringCurled, !pinkyCurled],
        smoothedLandmarks: sP 
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
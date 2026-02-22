const vec2 = { dist: (v1, v2) => Math.hypot(v1.x - v2.x, v1.y - v2.y) };

class OneEuroFilter {
    constructor(a=1,b=0){this.c=a;this.d=b;this.e=1;this.g=this.h=this.f=null;}
    filter(a,b){
        null==this.f&&(this.f=a,this.h=0,this.g=b);
        const c=b-this.g||.016,d=this.i(c,this.e),e=(a-this.f)/c,f=this.i(c,this.d+this.c*Math.abs(e));
        return this.f=this.f+d*(a-this.f),this.g=b,this.f;
    }
    i(a,b){const c=1/(2*Math.PI*b);return a/(a+c);}
}

let handLandmarker = null;
let lastProcessedTime = -1; 

import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3").then(async (vision) => {
    try {
        const resolver = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        handLandmarker = await vision.HandLandmarker.createFromOptions(resolver, {
            baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
            runningMode: "VIDEO", numHands: 1
        });
        console.log("[Worker] 视觉引擎加载完毕，系统上线。");
        self.postMessage({ type: 'INIT_DONE' }); 
    } catch (error) { console.error("[Worker] 视觉引擎加载失败:", error); }
}).catch(err => console.error("[Worker] 模块请求失败:", err));

function analyzeHand(rawLandmarks, timestamp) {
    if (typeof analyzeHand.lastTipY === 'undefined') analyzeHand.lastTipY = 0;
    if (typeof analyzeHand.isRecoilLocked === 'undefined') analyzeHand.isRecoilLocked = false;
    
    if (typeof self.filtersX === 'undefined') {
        self.filtersX = Array(21).fill(0).map(() => new OneEuroFilter(1.0, 0.001));
        self.filtersY = Array(21).fill(0).map(() => new OneEuroFilter(1.0, 0.001));
    }

    // 保留原始的 z 坐标用于高维判定
    const sP = rawLandmarks.map((p, i) => ({
        x: self.filtersX[i].filter(p.x, timestamp),
        y: self.filtersY[i].filter(p.y, timestamp),
        z: p.z 
    }));

    const wrist = sP[0];
    const palmLength = Math.hypot(sP[0].x - sP[9].x, sP[0].y - sP[9].y) || 0.001;
    const getDist2D = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    
    // 【OS2 防误触优化】2D 距离 + Z轴深度特判 (Override)
    const isStraight = (tip, pip) => {
        // 条件1: 正常的 2D 伸直判定
        if (getDist2D(sP[tip], wrist) > getDist2D(sP[pip], wrist)) return true;
        // 条件2: 空间透视补偿。指尖比PIP关节更靠近屏幕至少 0.04 个相对深度单位
        if (sP[tip].z < sP[pip].z - 0.04) return true;
        return false;
    };
    const isCurled = (tip, pip) => !isStraight(tip, pip);

    const isIndexUp = isStraight(8, 6);
    const isMiddleCurled = isCurled(12, 10);
    const isRingCurled = isCurled(16, 14);
    const isPinkyCurled = isCurled(20, 18);

    const isPistol = isIndexUp && isMiddleCurled && isRingCurled && isPinkyCurled;
    const isFist = isCurled(8, 6) && isMiddleCurled && isRingCurled && isPinkyCurled;

    let finalGesture = 'IDLE';
    let currentTipY = sP[8].y;

    if (isPistol) {
        finalGesture = 'GUN'; 
        let yMovement = analyzeHand.lastTipY - currentTipY; 
        if (!analyzeHand.isRecoilLocked && yMovement > palmLength * 0.15 && yMovement < palmLength * 0.8) {
            finalGesture = 'RECOIL'; 
            analyzeHand.isRecoilLocked = true; 
        }
        if (analyzeHand.isRecoilLocked && yMovement <= 0) analyzeHand.isRecoilLocked = false;
    } else if (isFist) {
        finalGesture = 'FIST';
        analyzeHand.isRecoilLocked = false;
    } else {
        analyzeHand.isRecoilLocked = false; // 重置锁防卡死
    }

    analyzeHand.lastTipY = currentTipY;

    return {
        gesture: finalGesture,
        fingerStates: [isStraight(4,3), isIndexUp, !isMiddleCurled, !isRingCurled, !isPinkyCurled],
        landmarks: sP 
    };
}

self.onmessage = (e) => {
    if (e.data.type === 'PROCESS_FRAME') {
        const { image, timestamp } = e.data;

        const sendUnlockMessage = (isDetected, data) => {
            self.postMessage({
                type: 'RESULT', 
                isDetected: isDetected,
                gesture: data ? data.gesture : 'IDLE',
                fingerStates: data ? data.fingerStates : [false,false,false,false,false],
                landmarks: data ? data.landmarks : null 
            });
            if (image && image.close) image.close(); 
        };

        if (!handLandmarker) return sendUnlockMessage(false, null);

        try {
            let safeTimestamp = timestamp;
            if (safeTimestamp <= lastProcessedTime) safeTimestamp = lastProcessedTime + 1;
            lastProcessedTime = safeTimestamp;

            const results = handLandmarker.detectForVideo(image, safeTimestamp);

            if (results.landmarks && results.landmarks.length > 0) {
                const gestureData = analyzeHand(results.landmarks[0], safeTimestamp);
                sendUnlockMessage(true, gestureData);
            } else {
                sendUnlockMessage(false, null);
            }
        } catch (err) {
            console.error("[Worker] 视觉分析异常:", err);
            sendUnlockMessage(false, null);
        }
    }
};
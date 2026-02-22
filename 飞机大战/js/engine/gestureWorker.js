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
    if (typeof analyzeHand.lastIndexY === 'undefined') analyzeHand.lastIndexY = 0;
    if (typeof analyzeHand.lastWristY === 'undefined') analyzeHand.lastWristY = 0;
    if (typeof analyzeHand.isRecoilLocked === 'undefined') analyzeHand.isRecoilLocked = false;
    
    if (typeof self.filtersX === 'undefined') {
        self.filtersX = Array(21).fill(0).map(() => new OneEuroFilter(1.0, 0.001));
        self.filtersY = Array(21).fill(0).map(() => new OneEuroFilter(1.0, 0.001));
    }

    const sP = rawLandmarks.map((p, i) => ({
        x: self.filtersX[i].filter(p.x, timestamp),
        y: self.filtersY[i].filter(p.y, timestamp)
    }));

    // 【修复 5 & 6】拓扑学比例法 (Scale Invariance Ratio)
    // 算法依据：指尖到手腕距离 / 对应掌指关节(MCP)到手腕距离
    const getRatio = (tipIndex, mcpIndex) => {
        const tipDist = vec2.dist(sP[tipIndex], sP[0]);
        const mcpDist = vec2.dist(sP[mcpIndex], sP[0]);
        return tipDist / (mcpDist || 0.001); 
    };

    // 比例 > 1.15 视为伸直 (兼容手指正对摄像头的透视缩短)
    // 比例 < 0.9 视为完全内扣 (握拳防误判底线)
    const isIndexUp = getRatio(8, 5) > 1.15;
    const isMiddleCurled = getRatio(12, 9) < 0.9;
    const isRingCurled = getRatio(16, 13) < 0.9;
    const isPinkyCurled = getRatio(20, 17) < 0.9;

    const isPistol = isIndexUp && isMiddleCurled && isRingCurled && isPinkyCurled;
    const isFist = getRatio(8, 5) < 0.9 && isMiddleCurled && isRingCurled && isPinkyCurled;

    let finalGesture = 'IDLE';
    let currentIndexY = sP[8].y;
    let currentWristY = sP[0].y;

    if (isPistol) {
        finalGesture = 'GUN'; 
        // 动力学速度：仅计算食指相对手腕的独立位移（剔除手臂整体挥动的干扰）
        let vIndex = analyzeHand.lastIndexY - currentIndexY; 
        let vWrist = analyzeHand.lastWristY - currentWristY;
        let relativeMovement = vIndex - vWrist; 

        // 仅当食指发生独立快速下压时触发大招
        if (!analyzeHand.isRecoilLocked && relativeMovement > 0.04) {
            finalGesture = 'RECOIL'; 
            analyzeHand.isRecoilLocked = true; 
        }
        if (analyzeHand.isRecoilLocked && relativeMovement <= 0) analyzeHand.isRecoilLocked = false;
    } else if (isFist) {
        finalGesture = 'FIST';
        analyzeHand.isRecoilLocked = false;
    } else {
        analyzeHand.isRecoilLocked = false; 
    }

    analyzeHand.lastIndexY = currentIndexY;
    analyzeHand.lastWristY = currentWristY;

    return {
        gesture: finalGesture,
        fingerStates: [getRatio(4, 2) > 1.15, isIndexUp, !isMiddleCurled, !isRingCurled, !isPinkyCurled],
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
            sendUnlockMessage(false, null);
        }
    }
};
// js/engine/gestureWorker.js
// V3.5.95: 1 Euro Filter (一欧元滤波器) + 距离拓扑学 (Distance Topology)

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
    
    // 1. 1 Euro Filter 平滑过滤坐标底噪
    const sP = rawLandmarks.map((p, i) => ({ 
        x: filters[i].x.filter(p.x, now), 
        y: filters[i].y.filter(p.y, now),
        z: filters[i].z.filter(p.z, now),
        visibility: p.visibility 
    }));

    const wrist = sP[0];
    
    // 2. 距离拓扑学：指尖到手腕的距离 > 关节到手腕的距离，则为伸直
    const isStraight = (tipIdx, pipIdx) => vec2.dist(sP[tipIdx], wrist) > vec2.dist(sP[pipIdx], wrist);
    const isCurled = (tipIdx, pipIdx) => vec2.dist(sP[tipIdx], wrist) < vec2.dist(sP[pipIdx], wrist);

    const isThumbUp = isStraight(4, 3);
    const isIndexUp = isStraight(8, 6);
    const isMiddleUp = isStraight(12, 10);
    const isRingUp = isStraight(16, 14);
    const isPinkyUp = isStraight(20, 18);

    const middleCurled = isCurled(12, 10);
    const ringCurled = isCurled(16, 14);
    const pinkyCurled = isCurled(20, 18);

    let gesture = 'IDLE';

    if (isIndexUp && isMiddleUp) {
        gesture = 'IDLE';
    } else if (middleCurled && ringCurled && pinkyCurled) {
        const distIndex = vec2.dist(sP[8], wrist);
        const distMiddle = vec2.dist(sP[12], wrist);
        
        // 【严格保留放大招逻辑】：拇指伸直，食指弯曲
        if (isThumbUp && !isIndexUp) {
            gesture = 'RECOIL';
        } 
        // 【完美手枪】：食指伸直，或食指比弯曲的中指明显长
        else if (isIndexUp || (distIndex > distMiddle * 1.1)) {
            gesture = 'GUN';
        } 
        // 握拳
        else {
            gesture = 'FIST';
        }
    }

    return {
        gesture: gesture,
        fingerStates: [isThumbUp, isIndexUp, isMiddleUp, isRingUp, isPinkyUp],
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
            landmarks: gestureData.smoothedLandmarks // 将平滑后的绝佳坐标传给主线程
        });

        image.close(); 
    }
};
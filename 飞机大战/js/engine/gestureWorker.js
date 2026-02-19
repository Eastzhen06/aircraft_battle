// js/engine/gestureWorker.js
// v3.5.93: 置信度调优与透视检测传输

let handLandmarker = null;

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
            // [解法 C] 降低置信度阈值，允许 AI 在快速移动或姿势畸变时"连蒙带猜"，增强鲁棒性
            minHandDetectionConfidence: 0.3,
            minHandPresenceConfidence: 0.3
        });
        
        postMessage({ type: 'INIT_DONE' });
    } catch (error) {
        console.error("Worker AI 初始化失败:", error);
    }
}

initModel();

function analyzeHand(landmarks) {
    // 严格保留您的原始逻辑，一字未改
    const isThumbUp = landmarks[4].y < landmarks[3].y;
    const isIndexUp = landmarks[8].y < landmarks[6].y;
    const isMiddleUp = landmarks[12].y < landmarks[10].y;
    const isRingUp = landmarks[16].y < landmarks[14].y;
    const isPinkyUp = landmarks[20].y < landmarks[18].y;

    let gesture = 'IDLE';
    if (!isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) gesture = 'FIST';
    else if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) gesture = 'GUN';
    else if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) gesture = 'RECOIL';
    
    // 【检测装置】将底层逻辑判定结果打包传回
    return {
        gesture: gesture,
        fingerStates: [isThumbUp, isIndexUp, isMiddleUp, isRingUp, isPinkyUp]
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
        
        let gestureData = { gesture: 'IDLE', fingerStates: [false,false,false,false,false] };
        let isDetected = false;
        let rawLandmarks = null;

        if (results.landmarks && results.landmarks.length > 0) {
            isDetected = true;
            rawLandmarks = results.landmarks[0];
            gestureData = analyzeHand(rawLandmarks);
        }

        postMessage({
            type: 'RESULT',
            isDetected: isDetected,
            gesture: gestureData.gesture,
            fingerStates: gestureData.fingerStates, // 传输检测数据
            landmarks: rawLandmarks
        });

        image.close(); 
    }
};
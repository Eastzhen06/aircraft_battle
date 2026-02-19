// js/engine/gestureWorker.js
// v3.5.9 终极修正版：采用动态 Import 绕过 MediaPipe 的 importScripts Bug

let handLandmarker = null;

// 使用异步动态加载，完美兼容 Classic Worker
async function initModel() {
    try {
        // 动态引入 ES Module
        const { HandLandmarker, FilesetResolver } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3");
        
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "CPU" // 独立线程专属 CPU，不卡主帧
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        
        postMessage({ type: 'INIT_DONE' });
    } catch (error) {
        console.error("Worker AI 初始化失败:", error);
    }
}

initModel();

function analyzeHand(landmarks) {
    const isThumbUp = landmarks[4].y < landmarks[3].y;
    const isIndexUp = landmarks[8].y < landmarks[6].y;
    const isMiddleUp = landmarks[12].y < landmarks[10].y;
    const isRingUp = landmarks[16].y < landmarks[14].y;
    const isPinkyUp = landmarks[20].y < landmarks[18].y;

    if (!isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) return 'FIST';
    if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) return 'GUN';
    if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) return 'RECOIL';
    return 'IDLE';
}

self.onmessage = (e) => {
    if (e.data.type === 'PROCESS_FRAME') {
        const { image, timestamp } = e.data;
        
        if (!handLandmarker) {
            image.close(); 
            return;
        }

        const results = handLandmarker.detectForVideo(image, timestamp);
        
        let gesture = 'IDLE';
        let isDetected = false;
        let rawLandmarks = null;

        if (results.landmarks && results.landmarks.length > 0) {
            isDetected = true;
            rawLandmarks = results.landmarks[0];
            gesture = analyzeHand(rawLandmarks);
        }

        postMessage({
            type: 'RESULT',
            isDetected: isDetected,
            gesture: gesture,
            landmarks: rawLandmarks
        });

        image.close(); 
    }
};
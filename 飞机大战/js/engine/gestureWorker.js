// js/engine/gestureWorker.js
// v3.5.9: 独立的 Web Worker 线程，专门负责 AI 计算，绝不阻塞主线程
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

let handLandmarker = null;

// 初始化 AI 模型 (在此线程中我们使用 CPU + WASM SIMD 优化，避开 WebGL 陷阱)
async function initModel() {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "CPU" // 退回 CPU，因为我们现在有整整一个独立核心可用
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    // 告诉主线程：模型加载完毕
    postMessage({ type: 'INIT_DONE' });
}

initModel();

// 手势解析逻辑（移入后台，进一步减轻主线程负担）
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

// 监听主线程发来的视频画面帧
self.onmessage = (e) => {
    if (e.data.type === 'PROCESS_FRAME') {
        const { image, timestamp } = e.data;
        
        if (!handLandmarker) {
            image.close(); // 销毁位图防止内存泄漏
            return;
        }

        // 进行昂贵的张量计算 (由于在 Worker 中，主线程游戏此时照常渲染不误)
        const results = handLandmarker.detectForVideo(image, timestamp);
        
        let gesture = 'IDLE';
        let isDetected = false;
        let rawLandmarks = null;

        if (results.landmarks && results.landmarks.length > 0) {
            isDetected = true;
            rawLandmarks = results.landmarks[0];
            gesture = analyzeHand(rawLandmarks);
        }

        // 将极其轻量级的坐标数据传回主线程
        postMessage({
            type: 'RESULT',
            isDetected: isDetected,
            gesture: gesture,
            landmarks: rawLandmarks
        });

        // 【极其重要】手动清理底层内存
        image.close(); 
    }
};
import { HandLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export default class GestureEngine {
    constructor() {
        this.handLandmarker = null;
        this.video = null;
        this.webcamRunning = false;
        
        // v3.5.8 性能调优：强制锁死 30 FPS 采样，避免抢夺主线程游戏渲染算力
        this.lastDetectTime = 0;
        this.detectInterval = 1000 / 30; 

        this.inputState = { x: window.innerWidth / 2, y: window.innerHeight * 0.8, isDetected: false, gesture: 'IDLE' };
        this.debugCanvas = null;
        this.debugCtx = null;
        this.gameCanvas = null;
        this.drawingUtils = null;
    }

    async init(videoElement, debugCanvas, gameCanvas) {
        this.video = videoElement;
        this.debugCanvas = debugCanvas;
        this.debugCtx = this.debugCanvas.getContext('2d');
        this.gameCanvas = gameCanvas;
        this.drawingUtils = new DrawingUtils(this.debugCtx);

        console.log("v3.5.8: Loading AI Model with GPU Delegate...");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                // v3.5.8 解法 A：强制开启 GPU 硬件加速委托 (WebGL/WebGPU)
                delegate: "GPU" 
            },
            runningMode: "VIDEO",
            numHands: 1
        });

        this.startWebcam();
    }

    startWebcam() {
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
            .then((stream) => {
                this.video.srcObject = stream;
                this.video.play();
                this.webcamRunning = true;
                this.video.addEventListener("loadeddata", () => this.detectLoop());
            })
            .catch(err => {
                console.error("Camera access denied or unavailable: ", err);
            });
    }

    detectLoop() {
        if (!this.webcamRunning || !this.handLandmarker) return;

        // v3.5.8 状态休眠锁：如果游戏没有在进行（比如在主菜单），直接跳过极其昂贵的 AI 计算！
        if (window.gameInstance && window.gameInstance.state !== 'PLAYING') {
            // 继续维持循环，但彻底释放 CPU 算力
            window.requestAnimationFrame(() => this.detectLoop());
            return;
        }

        const now = performance.now();
        
        // 频率控制器：拒绝 60Hz 满载采样
        if (now - this.lastDetectTime >= this.detectInterval) {
            this.lastDetectTime = now;
            if (this.video.readyState >= 2) {
                // 因为开启了 delegate: "GPU"，此处的阻塞时间将从 7~10ms 暴降
                const results = this.handLandmarker.detectForVideo(this.video, now);
                this.processResults(results);
            }
        }
        
        window.requestAnimationFrame(() => this.detectLoop());
    }

    processResults(results) {
        const ctx = this.debugCtx;
        const canvas = this.debugCanvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 镜像翻转 Canvas，使其与真实的镜面体验一致
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        if (this.video.readyState >= 2) {
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        }

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // 绘制骨架与节点
            this.drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
            this.drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", radius: 3 });

            // 获取掌心中心点 (节点 9) 映射到游戏画布
            const mappedX = (1 - landmarks[9].x) * this.gameCanvas.width;
            const mappedY = landmarks[9].y * this.gameCanvas.height;
            
            // 手势姿态分析
            const gesture = this.analyzeHand(landmarks);

            this.inputState = {
                x: mappedX,
                y: mappedY,
                isDetected: true,
                gesture: gesture
            };
        } else {
            this.inputState.isDetected = false;
            this.inputState.gesture = 'IDLE';
        }
        
        ctx.restore();
    }

    analyzeHand(landmarks) {
        // Y坐标向下为正。手指尖(指尖坐标值)比底端(根部坐标值)小，说明手指是伸直的。
        const isThumbUp = landmarks[4].y < landmarks[3].y;
        const isIndexUp = landmarks[8].y < landmarks[6].y;
        const isMiddleUp = landmarks[12].y < landmarks[10].y;
        const isRingUp = landmarks[16].y < landmarks[14].y;
        const isPinkyUp = landmarks[20].y < landmarks[18].y;

        // 全弯曲：拳头 (FIST) -> 触发护盾 + 射击
        if (!isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
            return 'FIST';
        }

        // 大拇指 + 食指伸直，其他弯曲：手枪 (GUN) -> 正常射击
        if (isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
            return 'GUN';
        }
        
        // 动态扳机 (RECOIL) -> 释放大招：大拇指伸着，食指刚刚弯下 (扣动扳机)
        if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
            return 'RECOIL';
        }

        return 'IDLE';
    }

    getInputState() {
        return this.inputState;
    }
}
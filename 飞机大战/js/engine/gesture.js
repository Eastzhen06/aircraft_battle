import { DrawingUtils, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export default class GestureEngine {
    constructor() {
        this.video = null;
        this.webcamRunning = false;
        
        // 多线程控制状态
        this.workerReady = false;
        this.isProcessing = false; // 锁机制：防止 Worker 算不过来导致消息积压卡死内存
        
        this.lastDetectTime = 0;
        this.detectInterval = 1000 / 30; 

        this.inputState = { x: window.innerWidth / 2, y: window.innerHeight * 0.8, isDetected: false, gesture: 'IDLE' };
        this.debugCanvas = null;
        this.debugCtx = null;
        this.gameCanvas = null;
        this.drawingUtils = null;

        // v3.5.9 初始化独立线程引擎 (采用 Module 模式加载)
        this.worker = new Worker('./js/engine/gestureWorker.js', { type: 'module' });
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    async init(videoElement, debugCanvas, gameCanvas) {
        this.video = videoElement;
        this.debugCanvas = debugCanvas;
        this.debugCtx = this.debugCanvas.getContext('2d');
        this.gameCanvas = gameCanvas;
        this.drawingUtils = new DrawingUtils(this.debugCtx);

        console.log("v3.5.9: Gesture Engine spawning Web Worker...");
        this.startWebcam();
    }

    // 接收后台线程传回的数据
    handleWorkerMessage(e) {
        if (e.data.type === 'INIT_DONE') {
            console.log("v3.5.9: AI Web Worker is ONLINE and READY!");
            this.workerReady = true;
        } else if (e.data.type === 'RESULT') {
            this.isProcessing = false; // 解开线程锁
            this.updateStateAndDebugCanvas(e.data);
        }
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
        if (!this.webcamRunning || !this.workerReady) return;

        // 状态休眠锁
        if (window.gameInstance && window.gameInstance.state !== 'PLAYING') {
            window.requestAnimationFrame(() => this.detectLoop());
            return;
        }

        const now = performance.now();
        
        // 频率控制 + 线程积压锁 (!this.isProcessing)
        if (now - this.lastDetectTime >= this.detectInterval && !this.isProcessing) {
            this.lastDetectTime = now;
            if (this.video.readyState >= 2) {
                this.isProcessing = true;
                
                // 零拷贝抓取视频帧：直接扔给显存/内存底层处理，极速生成位图
                createImageBitmap(this.video).then(imageBitmap => {
                    // postMessage 的第二个参数 [imageBitmap] 是 "Transferable" 转移所有权，耗时接近 0ms
                    this.worker.postMessage({
                        type: 'PROCESS_FRAME',
                        image: imageBitmap,
                        timestamp: now
                    }, [imageBitmap]); 
                }).catch(err => {
                    console.error("Bitmap extraction failed", err);
                    this.isProcessing = false;
                });
            }
        }
        
        window.requestAnimationFrame(() => this.detectLoop());
    }

    // 仅负责 UI 更新与坐标映射
    updateStateAndDebugCanvas(data) {
        const { isDetected, gesture, landmarks } = data;
        const ctx = this.debugCtx;
        const canvas = this.debugCanvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        if (this.video.readyState >= 2) {
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        }

        if (isDetected && landmarks) {
            this.drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
            this.drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", radius: 3 });

            const mappedX = (1 - landmarks[9].x) * this.gameCanvas.width;
            const mappedY = landmarks[9].y * this.gameCanvas.height;
            
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

    getInputState() {
        return this.inputState;
    }
}
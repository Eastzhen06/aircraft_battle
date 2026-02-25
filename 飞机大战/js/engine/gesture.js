import { DrawingUtils, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export default class GestureEngine {
    constructor() {
        this.video = null;
        this.webcamRunning = false;
        this.workerReady = false;
        this.isProcessing = false; 
        
        this.inputState = { x: window.innerWidth / 2, y: window.innerHeight * 0.8, isDetected: false, gesture: 'IDLE' };
        this.latestLandmarks = null; 
        this.fingerStates = [false, false, false, false, false]; 
        
        this.debugCanvas = null;
        this.debugCtx = null;
        this.gameCanvas = null;
        this.drawingUtils = null;

        const workerUrl = new URL('./gestureWorker.js', import.meta.url);
        this.worker = new Worker(workerUrl);
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    async init(videoElement, debugCanvas, gameCanvas) {
        this.video = videoElement;
        this.debugCanvas = debugCanvas;
        this.debugCtx = this.debugCanvas.getContext('2d');
        this.gameCanvas = gameCanvas;
        this.drawingUtils = new DrawingUtils(this.debugCtx);

        console.log("v3.6.0: SOTA Hierarchical Topology & Raw Recoil Pulse Engine Online.");
        this.startWebcam();
    }

    handleWorkerMessage(e) {
        if (e.data.type === 'INIT_DONE') {
            this.workerReady = true;
        } else if (e.data.type === 'RESULT') {
            this.isProcessing = false; 
            
            this.inputState.isDetected = e.data.isDetected;
            this.inputState.gesture = e.data.gesture;
            this.latestLandmarks = e.data.landmarks; 
            this.fingerStates = e.data.fingerStates || [false,false,false,false,false];

            if (e.data.isDetected && e.data.landmarks) {
                const mappedX = (1 - e.data.landmarks[9].x) * this.gameCanvas.width;
                const mappedY = e.data.landmarks[9].y * this.gameCanvas.height;
                this.inputState.x = mappedX;
                this.inputState.y = mappedY;
            }
        }
    }

        startWebcam() {
        navigator.mediaDevices.getUserMedia({ 
            // 【Phase 9.5 核心补丁】：
            // 1. 改绝对宽高为 ideal 协商，防止手机竖屏产生 OverconstrainedError
            // 2. 强制要求 facingMode: 'user' (前置摄像头)
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 }, 
                frameRate: { ideal: 60 },
                facingMode: 'user'
            }, 
            audio: false 
        })
        .then((stream) => {
            this.video.srcObject = stream;
            
            // 终极防线加固，确保所有属性在 play() 前就绪
            this.video.muted = true;
            this.video.playsInline = true;
            
            // 【Phase 9.5 核心补丁】：接管异步播放的生命周期，防止 DOMException 静默崩溃
            const playPromise = this.video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("🚫 移动端视频流播放被操作系统拦截，请检查浏览器权限:", error);
                });
            }
            
            this.webcamRunning = true;
            
            if ('requestVideoFrameCallback' in this.video) {

                this.video.requestVideoFrameCallback(this.onNewFrame.bind(this));
            } else {
                this.video.addEventListener("loadeddata", () => this.detectLoop());
            }
        })
        .catch(err => { console.error("Camera error:", err); });
    }

    onNewFrame(now, metadata) {
        if (!this.webcamRunning) return;
        this.video.requestVideoFrameCallback(this.onNewFrame.bind(this));
        
        this.drawDebugPreview();

        if (window.gameInstance && window.gameInstance.state !== 'PLAYING') return;

        if (this.workerReady && !this.isProcessing) {
            this.isProcessing = true;
            createImageBitmap(this.video, { resizeWidth: 320, resizeHeight: 240, resizeQuality: 'low' })
                .then(imageBitmap => {
                    this.worker.postMessage({
                        type: 'PROCESS_FRAME',
                        image: imageBitmap,
                        timestamp: metadata.expectedDisplayTime
                    }, [imageBitmap]); 
                }).catch(err => {
                    this.isProcessing = false;
                });
        }
    }

    detectLoop() {
        if (!this.webcamRunning) return;
        window.requestAnimationFrame(() => this.detectLoop());
        this.drawDebugPreview();
        if (window.gameInstance && window.gameInstance.state !== 'PLAYING') return;
        if (this.workerReady && !this.isProcessing && this.video.readyState >= 2) {
            this.isProcessing = true;
            createImageBitmap(this.video, { resizeWidth: 320, resizeHeight: 240, resizeQuality: 'low' })
                .then(imageBitmap => {
                    this.worker.postMessage({ type: 'PROCESS_FRAME', image: imageBitmap, timestamp: performance.now() }, [imageBitmap]); 
                }).catch(err => { this.isProcessing = false; });
        }
    }

    drawDebugPreview() {
        const ctx = this.debugCtx;
        const canvas = this.debugCanvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        if (this.video.readyState >= 2) {
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        }

        if (this.inputState.isDetected && this.latestLandmarks) {
            this.drawingUtils.drawConnectors(this.latestLandmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
            this.drawingUtils.drawLandmarks(this.latestLandmarks, { color: "#FF0000", radius: 3 });
        }
        ctx.restore();

        ctx.font = '14px Orbitron, sans-serif';
        const labels = ['T(拇)', 'I(食)', 'M(中)', 'R(无)', 'P(小)'];
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = this.fingerStates[i] ? '#00FF00' : '#FF0000';
            ctx.fillText(`${labels[i]}:${this.fingerStates[i]?'UP':'DN'}`, 5, 20 + i * 20);
        }
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`Gesture: ${this.inputState.gesture}`, 5, 130);
    }

    getInputState() {
        return this.inputState;
    }
}
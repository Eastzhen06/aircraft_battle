import { DrawingUtils, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

export default class GestureEngine {
    constructor() {
        this.video = null;
        this.webcamRunning = false;
        
        this.workerReady = false;
        this.isProcessing = false; 
        
        this.inputState = { x: window.innerWidth / 2, y: window.innerHeight * 0.8, isDetected: false, gesture: 'IDLE' };
        this.latestLandmarks = null; // 用于平滑渲染
        
        this.debugCanvas = null;
        this.debugCtx = null;
        this.gameCanvas = null;
        this.drawingUtils = null;

        // 【核心修复 1】去除 { type: 'module' }，并使用相对 URL 防止路径报错
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

        console.log("v3.5.9: Booting Web Worker & Hardware Sync (Plan C)...");
        this.startWebcam();
    }

    handleWorkerMessage(e) {
        if (e.data.type === 'INIT_DONE') {
            console.log("✅ v3.5.9: AI Worker 成功启动！");
            this.workerReady = true;
        } else if (e.data.type === 'RESULT') {
            this.isProcessing = false; 
            
            // 仅仅更新状态，不在这里画图
            this.inputState.isDetected = e.data.isDetected;
            this.inputState.gesture = e.data.gesture;
            this.latestLandmarks = e.data.landmarks;

            if (e.data.isDetected && e.data.landmarks) {
                const mappedX = (1 - e.data.landmarks[9].x) * this.gameCanvas.width;
                const mappedY = e.data.landmarks[9].y * this.gameCanvas.height;
                this.inputState.x = mappedX;
                this.inputState.y = mappedY;
            }
        }
    }

    startWebcam() {
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
            .then((stream) => {
                this.video.srcObject = stream;
                this.video.play();
                this.webcamRunning = true;
                
                // 【核心修复 2 - 方案 C】检测是否支持硬件级视频帧同步
                if ('requestVideoFrameCallback' in this.video) {
                    this.video.requestVideoFrameCallback(this.onNewFrame.bind(this));
                } else {
                    console.warn("浏览器不支持 requestVideoFrameCallback，降级回 requestAnimationFrame");
                    this.video.addEventListener("loadeddata", () => this.detectLoop());
                }
            })
            .catch(err => {
                console.error("Camera access denied or unavailable: ", err);
            });
    }

    // 硬件级同步：物理摄像头吐出新画面时才触发
    onNewFrame(now, metadata) {
        if (!this.webcamRunning) return;
        
        // 1. 立即注册下一帧的回调
        this.video.requestVideoFrameCallback(this.onNewFrame.bind(this));
        
        // 2. 永远保持摄像头预览画面的渲染 (就算在菜单界面也能看见自己)
        this.drawDebugPreview();

        // 3. 【状态锁】未开始游戏时，绝对不派发任务给 AI
        if (window.gameInstance && window.gameInstance.state !== 'PLAYING') return;

        // 4. 只有当 Worker 空闲时才派发运算，避免积压卡死内存
        if (this.workerReady && !this.isProcessing) {
            this.isProcessing = true;
            createImageBitmap(this.video).then(imageBitmap => {
                this.worker.postMessage({
                    type: 'PROCESS_FRAME',
                    image: imageBitmap,
                    timestamp: metadata.expectedDisplayTime
                }, [imageBitmap]); 
            }).catch(err => {
                console.error("提取位图失败", err);
                this.isProcessing = false;
            });
        }
    }

    // 降级兼容：老版本浏览器使用
    detectLoop() {
        if (!this.webcamRunning) return;
        window.requestAnimationFrame(() => this.detectLoop());
        
        this.drawDebugPreview();

        if (window.gameInstance && window.gameInstance.state !== 'PLAYING') return;

        if (this.workerReady && !this.isProcessing && this.video.readyState >= 2) {
            this.isProcessing = true;
            createImageBitmap(this.video).then(imageBitmap => {
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

        // 画视频底底图
        if (this.video.readyState >= 2) {
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        }

        // 画最新骨架
        if (this.inputState.isDetected && this.latestLandmarks) {
            this.drawingUtils.drawConnectors(this.latestLandmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
            this.drawingUtils.drawLandmarks(this.latestLandmarks, { color: "#FF0000", radius: 3 });
        }
        
        ctx.restore();
    }

    getInputState() {
        return this.inputState;
    }
}
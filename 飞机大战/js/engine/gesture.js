import { FilesetResolver, HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

/**
 * Task 1: Ported OneEuroFilter class from the prototype.
 * This is the original, unmodified, battle-tested algorithm.
 */
class OneEuroFilter {
    constructor(minCutoff = 1.0, beta = 0.0) {
        this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = 1.0;
        this.xPrev = null; this.dxPrev = null; this.tPrev = null;
    }
    filter(x, t) {
        if (this.tPrev === null) { this.xPrev = x; this.dxPrev = 0; this.tPrev = t; return x; }
        const dt = (t - this.tPrev) || 0.016;
        const aD = this.sf(dt, this.dCutoff);
        const dx = (x - this.xPrev) / dt;
        const dxHat = aD * dx + (1 - aD) * this.dxPrev;
        const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
        const a = this.sf(dt, cutoff);
        const xHat = a * x + (1 - a) * this.xPrev;
        this.xPrev = xHat; this.dxPrev = dxHat; this.tPrev = t;
        return xHat;
    }
    sf(dt, cutoff) { const r = 2 * Math.PI * cutoff * dt; return r / (r + 1); }
}

/**
 * GestureEngine - Core class for hand gesture recognition.
 */
export default class GestureEngine {
    constructor() {
        this.handLandmarker = null;
        this.webcamRunning = false;
        this.video = null;
        this.debugCanvas = null;
        this.gameCanvas = null;
        this.drawingUtils = null;

        this.inputState = { x: 0, y: 0, gesture: 'IDLE' };
        
        // Task 1: Initialize filters and state variables as per prototype
        this.filters = Array(21).fill(null).map(() => ({ 
            x: new OneEuroFilter(1.0, 0.007), 
            y: new OneEuroFilter(1.0, 0.007), 
            z: new OneEuroFilter(1.0, 0.007) 
        }));
        this.lastState = 'IDLE';
        this.prevY = { index: 0, middle: 0 };
        this.isFiring = false;
        this.lastFireTime = 0;

        this.lastVideoTime = -1;
    }

    async init(videoElement, debugCanvasElement, gameCanvasElement) {
        this.video = videoElement;
        this.debugCanvas = debugCanvasElement;
        this.gameCanvas = gameCanvasElement;
        this.debugCtx = this.debugCanvas.getContext('2d');
        this.drawingUtils = new DrawingUtils(this.debugCtx);

        try {
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO", numHands: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5
            });
            this.startWebcam();
        } catch (e) { console.error("GestureEngine init failed:", e); }
    }

    startWebcam() {
        if (this.webcamRunning) return;
        const constraints = { video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" } };
        navigator.mediaDevices.getUserMedia(constraints).then(stream => {
            this.video.srcObject = stream;
            this.video.play().catch(e => console.error("Video play failed:", e));
            this.video.addEventListener("loadeddata", () => {
                this.webcamRunning = true;
                this.detectLoop();
            });
        }).catch(err => alert("无法访问摄像头，请检查浏览器权限！"));
    }

    detectLoop() {
        if (!this.webcamRunning || !this.handLandmarker) {
            window.requestAnimationFrame(() => this.detectLoop());
            return;
        }
        if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            const results = this.handLandmarker.detectForVideo(this.video, performance.now());
            this.processResults(results);
        }
        window.requestAnimationFrame(() => this.detectLoop());
    }

    /**
     * Task 2: Fix Mirroring Sync. Unified transform for video and skeleton.
     */
    processResults(results) {
        const ctx = this.debugCtx;
        const canvas = this.debugCanvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        
        if (this.video.readyState >= 2) {
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        }

        if (results.landmarks && results.landmarks.length > 0) {
            this.drawingUtils.drawConnectors(results.landmarks[0], HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
            this.drawingUtils.drawLandmarks(results.landmarks[0], { color: "#FF0000", radius: 3 });
        }
        
        ctx.restore();
        
        // Analyze hand logic after all drawing is done
        if (results.landmarks && results.landmarks.length > 0) {
            this.analyzeHand(results.landmarks[0]);
        } else {
            this.inputState.gesture = 'IDLE';
        }
    }

    /**
     * Task 1: Full transplant of the prototype's gesture analysis algorithm.
     */
    analyzeHand(rawLandmarks) {
        const now = Date.now() / 1000;
        const landmarks = rawLandmarks.map((p, i) => ({
            x: this.filters[i].x.filter(p.x, now),
            y: this.filters[i].y.filter(p.y, now),
            z: this.filters[i].z.filter(p.z, now),
        }));

        // Task 2: Mirrored coordinate for game logic
        this.inputState.x = (1 - landmarks[0].x) * this.gameCanvas.width;
        this.inputState.y = landmarks[0].y * this.gameCanvas.height;

        const d = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);

        const wrist = landmarks[0];
        const indexBase = landmarks[5];
        const indexTip = landmarks[8];
        const middleBase = landmarks[9];
        const middleTip = landmarks[12];

        const indexRatio = d(indexTip, wrist) / d(indexBase, wrist);
        // Key fix for discriminating 'V' from 'Gun'
        const middleCurled = d(middleTip, wrist) < d(middleBase, wrist);

        // State machine with hysteresis transplanted from prototype
        switch (this.lastState) {
            case 'IDLE':
                if (indexRatio > 1.15 && middleCurled) this.lastState = 'GUN';
                else if (indexRatio < 0.9 && middleCurled) this.lastState = 'FIST';
                break;
            case 'GUN':
                if (indexRatio < 0.85) this.lastState = 'FIST';
                else if (!middleCurled) this.lastState = 'IDLE';
                break;
            case 'FIST':
                if (indexRatio > 1.1) this.lastState = 'GUN';
                else if (!middleCurled) this.lastState = 'IDLE';
                break;
        }
        
        let isRecoil = false;
        const vIndex = this.prevY.index - indexTip.y;
        if (this.lastState === 'GUN' && vIndex > 0.03 && !this.isFiring) {
            isRecoil = true;
            this.isFiring = true;
            this.lastFireTime = now;
        }

        if (now - this.lastFireTime > 0.5) { // Cooldown
            this.isFiring = false;
        }
        
        this.inputState.gesture = isRecoil ? 'RECOIL' : this.lastState;

        this.prevY.index = indexTip.y;
        this.prevY.middle = middleTip.y;
    }

    getInputState() {
        return this.inputState;
    }
}

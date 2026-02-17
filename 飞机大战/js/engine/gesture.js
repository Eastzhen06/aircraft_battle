import { FilesetResolver, HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

const vec = {
    sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z }),
    len: (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y + v1.z * v2.z,
    dist: (v1, v2) => vec.len(vec.sub(v1, v2)),
    normalize: (v) => {
        const l = vec.len(v);
        return l > 0 ? { x: v.x / l, y: v.y / l, z: v.z / l } : { x: 0, y: 0, z: 0 };
    }
};

class OneEuroFilter {
    constructor(a=1,b=0){this.c=a;this.d=b;this.e=1;this.g=this.h=this.f=null}filter(a,b){null==this.f&&(this.f=a,this.h=0,this.g=b);const c=b-this.g||.016,d=this.i(c,this.e),e=(a-this.f)/c,f=d*e+(1-d)*this.h,g=this.c+this.d*Math.abs(f),j=this.i(c,g);return a=j*a+(1-j)*this.f,this.f=a,this.h=f,this.g=b,a}i(a,b){return a=2*Math.PI*b*a,a/(a+1)}}

export default class GestureEngine {
    constructor() {
        this.handLandmarker = null; this.webcamRunning = false; this.video = null;
        this.debugCanvas = null; this.gameCanvas = null; this.drawingUtils = null;
        this.inputState = { x: 0, y: 0, gesture: 'IDLE', isDetected: false };
        this.filters = Array(21).fill(null).map(() => ({ x: new OneEuroFilter(1,.007), y: new OneEuroFilter(1,.007), z: new OneEuroFilter(1,.007) }));
        
        this.lastState = 'IDLE'; 
        this.isFiring = false; 
        this.lastFireTime = 0;
        this.lastVideoTime = -1;
        
        this.prevIndexTipToWristDist = 0;
        this.gunStabilityTimer = 0; 
    }

    async init(a,b,c){this.video=a;this.debugCanvas=b;this.gameCanvas=c;this.debugCtx=this.debugCanvas.getContext("2d");this.drawingUtils=new DrawingUtils(this.debugCtx);try{const d=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");this.handLandmarker=await HandLandmarker.createFromOptions(d,{baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",delegate:"GPU"},runningMode:"VIDEO",numHands:1,minDetectionConfidence:.5,minTrackingConfidence:.5});this.startWebcam()}catch(d){console.error("GestureEngine init failed:",d)}}
    
    startWebcam(){
        if(!this.webcamRunning){
            const a={video:{width:{ideal:320},height:{ideal:240},facingMode:"user"}};
            navigator.mediaDevices.getUserMedia(a).then(b=>{
                this.video.srcObject=b;
                this.video.play().catch(c=>console.error("Video play failed:",c));
                this.video.addEventListener("loadeddata",()=>{
                    this.webcamRunning=!0;
                    this.detectLoop()
                })
            }).catch(b=>{console.error("Webcam access denied:",b);alert("无法访问摄像头，请检查浏览器权限！")})
        }
    }
    
    detectLoop(){
        if(!this.webcamRunning||!this.handLandmarker)return void window.requestAnimationFrame(()=>this.detectLoop());
        if(this.video.readyState>=2&&this.video.currentTime!==this.lastVideoTime){
            this.lastVideoTime=this.video.currentTime;
            const results = this.handLandmarker.detectForVideo(this.video, performance.now());
            this.processResults(results);
        }
        window.requestAnimationFrame(()=>this.detectLoop())
    }
    
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
            this.analyzeHand(results.landmarks[0]);
            this.inputState.isDetected = true;
        } else {
            this.inputState.gesture = 'IDLE';
            this.inputState.isDetected = false;
            this.gunStabilityTimer = 0;
        }
        ctx.restore();
    }

    analyzeHand(rawLandmarks) {
        const now = Date.now() / 1000;
        const landmarks = rawLandmarks.map((p, i) => ({ 
            x: this.filters[i].x.filter(p.x, now), 
            y: this.filters[i].y.filter(p.y, now), 
            z: this.filters[i].z.filter(p.z, now) 
        }));

        if (this.gameCanvas) {
            this.inputState.x = (1 - landmarks[0].x) * this.gameCanvas.width;
            this.inputState.y = landmarks[0].y * this.gameCanvas.height;
        }

        const wrist = landmarks[0];

        // === 核心算法优化 v2.2 ===
        
        // 1. 手指伸直判定 (增加距离比率校验，解决 Z 轴压缩问题)
        const isFingerStraight = (mcpIdx, tipIdx) => {
            const palmToMcp = vec.sub(landmarks[mcpIdx], wrist);
            const mcpToTip = vec.sub(landmarks[tipIdx], landmarks[mcpIdx]);
            
            // 角度判定 (阈值 0.35)
            const dot = vec.dot(vec.normalize(palmToMcp), vec.normalize(mcpToTip));
            const anglePass = dot > 0.35;

            // 距离比率判定 (新逻辑)
            // 如果 指尖到手腕距离 / 指根到手腕距离 > 1.2，说明手指物理上是伸展的
            const distTip = vec.dist(landmarks[tipIdx], wrist);
            const distMcp = vec.dist(landmarks[mcpIdx], wrist);
            const ratioPass = (distTip / distMcp) > 1.2;

            return anglePass || ratioPass; // 只要满足其一即可
        };

        const isFingerCurled = (mcpIdx, tipIdx) => {
            return vec.dist(landmarks[tipIdx], wrist) < vec.dist(landmarks[mcpIdx], wrist);
        };

        // 2. 拇指状态
        const thumbOut = vec.dist(landmarks[4], landmarks[5]) > vec.dist(landmarks[3], landmarks[5]);

        const indexStraight = isFingerStraight(5, 8);
        const middleCurled = isFingerCurled(9, 12);
        const ringCurled = isFingerCurled(13, 16);
        const pinkyCurled = isFingerCurled(17, 20);
        
        let isGun = false;
        let isFist = false;

        // FIST 判定 v2.2: 移除 thumbOut 限制，提高鲁棒性
        // 只要 4 指卷曲，就算握拳 (忽略大拇指)
        if (!indexStraight && middleCurled && ringCurled && pinkyCurled) {
            isFist = true;
        }
        
        // GUN 判定
        const curledCount = (middleCurled ? 1 : 0) + (ringCurled ? 1 : 0) + (pinkyCurled ? 1 : 0);
        if (indexStraight && curledCount >= 2) {
            isGun = true;
        }

        // 优先级锁: 如果同时满足 Gun 和 Fist，优先判 Gun
        if (isGun && isFist) isFist = false;

        switch (this.lastState) {
            case 'IDLE':
                if (isGun) this.lastState = 'GUN';
                else if (isFist) this.lastState = 'FIST';
                break;
            case 'GUN':
                if (isFist) this.lastState = 'FIST';
                else if (!isGun) this.lastState = 'IDLE';
                break;
            case 'FIST':
                if (isGun) this.lastState = 'GUN';
                else if (!isFist) this.lastState = 'IDLE';
                break;
        }
        
        // RECOIL 检测
        let isRecoil = false;
        if (this.lastState === 'GUN') {
            this.gunStabilityTimer++;
        } else {
            this.gunStabilityTimer = 0;
        }
        
        if (this.gunStabilityTimer > 5 && !this.isFiring) {
            const indexTipToWristDist = vec.dist(landmarks[8], wrist);
            const radialVelocity = (indexTipToWristDist - this.prevIndexTipToWristDist) / 0.016;
            
            if (radialVelocity > 0.5) {
                isRecoil = true;
                this.isFiring = true;
                this.lastFireTime = now;
            }
        }
        if (now - this.lastFireTime > 0.2) this.isFiring = false;
        
        this.inputState.gesture = isRecoil ? 'RECOIL' : this.lastState;
        this.prevIndexTipToWristDist = vec.dist(landmarks[8], wrist);
    }

    getInputState() { return this.inputState; }
}
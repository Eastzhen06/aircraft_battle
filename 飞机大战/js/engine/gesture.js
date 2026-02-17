import { FilesetResolver, HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

const vec = {
    sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z }),
    len: (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y + v1.z * v2.z,
    dist: (v1, v2) => vec.len(vec.sub(v1, v2)),
    // 新增：归一化
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

    // === 任务 2 核心优化：鲁棒性手势算法 ===
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

        // 辅助函数：计算手指的弯曲程度 (0~180度，0=直，180=完全折叠)
        // 使用向量夹角，不受手腕旋转影响
        const getFingerBendAngle = (base, pip, tip) => {
            const v1 = vec.sub(pip, base); // 掌骨到指骨
            const v2 = vec.sub(tip, pip);  // 指骨到指尖
            const n1 = vec.normalize(v1);
            const n2 = vec.normalize(v2);
            // 点积公式: a·b = |a||b|cosθ. 归一化后 |a||b|=1.
            const dot = Math.max(-1, Math.min(1, vec.dot(n1, n2))); 
            const angleRad = Math.acos(dot);
            return angleRad * (180 / Math.PI); // 转为角度
        };

        // 食指 (Index) 5, 6, 8 (MCP -> PIP -> TIP)
        // 注意：MediaPipe 手指有 4 个点。简单起见，对比 5->6 和 6->8 的方向，
        // 或者对比 0->5 (掌骨) 和 5->8 (手指整体) 的方向。
        // 这里使用更鲁棒的：掌心到指根(0->MCP) vs 指根到指尖(MCP->TIP)
        const isFingerStraight = (mcpIdx, tipIdx) => {
            const palmToMcp = vec.sub(landmarks[mcpIdx], wrist);
            const mcpToTip = vec.sub(landmarks[tipIdx], landmarks[mcpIdx]);
            // 如果两个向量方向一致，点积接近 1
            const dot = vec.dot(vec.normalize(palmToMcp), vec.normalize(mcpToTip));
            return dot > 0.5; // 宽松判定：夹角小于 60 度都算直
        };

        const isFingerCurled = (mcpIdx, tipIdx) => {
            // 简单距离判定依然有效且计算量小：指尖距离手腕 比 指根距离手腕 近
            return vec.dist(landmarks[tipIdx], wrist) < vec.dist(landmarks[mcpIdx], wrist);
        };

        // 1. 食指状态 (Index 5-8)
        const indexStraight = isFingerStraight(5, 8);
        
        // 2. 其他三指状态 (Middle 9-12, Ring 13-16, Pinky 17-20)
        const middleCurled = isFingerCurled(9, 12);
        const ringCurled = isFingerCurled(13, 16);
        const pinkyCurled = isFingerCurled(17, 20);
        
        let isGun = false;
        let isFist = false;

        // FIST: 4指全部卷曲
        if (!indexStraight && middleCurled && ringCurled && pinkyCurled) {
            isFist = true;
        }
        
        // GUN: 食指直 + (中指、无名指、小指 至少2个卷曲，提高鲁棒性)
        const curledCount = (middleCurled ? 1 : 0) + (ringCurled ? 1 : 0) + (pinkyCurled ? 1 : 0);
        if (indexStraight && curledCount >= 2) {
            isGun = true;
        }

        // 状态机滞后处理
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
        
        // RECOIL (射击动作) 鲁棒性优化
        let isRecoil = false;
        if (this.lastState === 'GUN') {
            this.gunStabilityTimer++;
        } else {
            this.gunStabilityTimer = 0;
        }
        
        // 必须稳定 5 帧以上才检测后坐力，防止状态切换时的抖动
        if (this.gunStabilityTimer > 5 && !this.isFiring) {
            const indexTipToWristDist = vec.dist(landmarks[8], wrist);
            const radialVelocity = (indexTipToWristDist - this.prevIndexTipToWristDist) / 0.016;
            
            // 速度阈值 0.5
            if (radialVelocity > 0.5) {
                isRecoil = true;
                this.isFiring = true;
                this.lastFireTime = now;
            }
        }
        if (now - this.lastFireTime > 0.2) this.isFiring = false; // 射速限制
        
        this.inputState.gesture = isRecoil ? 'RECOIL' : this.lastState;
        this.prevIndexTipToWristDist = vec.dist(landmarks[8], wrist);
    }

    getInputState() { return this.inputState; }
}
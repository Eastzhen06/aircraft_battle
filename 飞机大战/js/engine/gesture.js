import { FilesetResolver, HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

// --- 向量数学工具库 ---
const vec = {
    // 向量减法
    sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z }),
    // 向量长度
    len: (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
    // 向量点积
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y + v1.z * v2.z,
    // 计算两点距离
    dist: (v1, v2) => vec.len(vec.sub(v1, v2))
};

class OneEuroFilter {
    constructor(a=1,b=0){this.c=a;this.d=b;this.e=1;this.g=this.h=this.f=null}filter(a,b){null==this.f&&(this.f=a,this.h=0,this.g=b);const c=b-this.g||.016,d=this.i(c,this.e),e=(a-this.f)/c,f=d*e+(1-d)*this.h,g=this.c+this.d*Math.abs(f),j=this.i(c,g);return a=j*a+(1-j)*this.f,this.f=a,this.h=f,this.g=b,a}i(a,b){return a=2*Math.PI*b*a,a/(a+1)}}

export default class GestureEngine {
    constructor() {
        this.handLandmarker = null; this.webcamRunning = false; this.video = null;
        this.debugCanvas = null; this.gameCanvas = null; this.drawingUtils = null;
        
        // 增加 isDetected 标志位，解决出生点 (0,0) 问题
        this.inputState = { x: 0, y: 0, gesture: 'IDLE', isDetected: false };
        
        // 滤波器
        this.filters = Array(21).fill(null).map(() => ({ x: new OneEuroFilter(1,.007), y: new OneEuroFilter(1,.007), z: new OneEuroFilter(1,.007) }));
        
        this.lastState = 'IDLE'; 
        this.isFiring = false; 
        this.lastFireTime = 0;
        this.lastVideoTime = -1;
        
        // 算法增强变量
        this.prevIndexTipToWristDist = 0;
        this.gunStabilityTimer = 0; // 枪身稳定计时器，防止误触
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
        
        // 1. 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        // 2. 统一镜像翻转：视频和骨架都在这个变换下绘制
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        
        // 3. 绘制视频底图
        if (this.video.readyState >= 2) {
            ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        }
        
        // 4. 绘制骨架 (如果存在)
        if (results.landmarks && results.landmarks.length > 0) {
            this.drawingUtils.drawConnectors(results.landmarks[0], HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
            this.drawingUtils.drawLandmarks(results.landmarks[0], { color: "#FF0000", radius: 3 });
            
            // 5. 分析手势
            this.analyzeHand(results.landmarks[0]);
            this.inputState.isDetected = true;
        } else {
            this.inputState.gesture = 'IDLE';
            this.inputState.isDetected = false;
            this.gunStabilityTimer = 0; // 丢失追踪时重置计时器
        }
        
        ctx.restore();
    }

    analyzeHand(rawLandmarks) {
        const now = Date.now() / 1000;
        // 滤波处理
        const landmarks = rawLandmarks.map((p, i) => ({ 
            x: this.filters[i].x.filter(p.x, now), 
            y: this.filters[i].y.filter(p.y, now), 
            z: this.filters[i].z.filter(p.z, now) 
        }));

        // 坐标映射 (注意这里要处理镜像逻辑: 1 - x)
        if (this.gameCanvas) {
            this.inputState.x = (1 - landmarks[0].x) * this.gameCanvas.width;
            this.inputState.y = landmarks[0].y * this.gameCanvas.height;
        }

        // === 核心算法：独立手指弯曲度检测 ===
        // 获取关键点
        const wrist = landmarks[0];
        
        // 判断手指是否伸直 (Straight) 或 弯曲 (Curled)
        // 算法：比较 指尖到掌心的距离 vs 指关节到掌心的距离
        const isFingerCurled = (tipIdx, pipIdx) => {
            return vec.dist(landmarks[tipIdx], wrist) < vec.dist(landmarks[pipIdx], wrist);
        };
        
        // 食指 (Index) 5-8
        // 中指 (Middle) 9-12
        // 无名指 (Ring) 13-16
        // 小指 (Pinky) 17-20
        
        // 这里我们不仅看距离，还看向量方向，更精准
        // 计算食指是否伸直：食指向量 与 掌心向量 的夹角
        const indexVector = vec.sub(landmarks[8], landmarks[5]);
        const palmVector = vec.sub(landmarks[5], wrist); // 大致方向
        // 简单判定：食指伸直
        const indexStraight = !isFingerCurled(8, 5); 
        
        // 其他三指状态
        const middleCurled = isFingerCurled(12, 9);
        const ringCurled = isFingerCurled(16, 13);
        const pinkyCurled = isFingerCurled(20, 17);
        
        // 状态判定逻辑
        let isGun = false;
        let isFist = false;

        // FIST: 必须 4 根手指全部卷曲 (大拇指不强制)
        if (!indexStraight && middleCurled && ringCurled && pinkyCurled) {
            isFist = true;
        }
        
        // GUN: 食指必须伸直，且至少有两根其他手指是卷曲的 (宽容度处理，防止无名指没压住导致的误判)
        if (indexStraight && middleCurled && pinkyCurled) {
            isGun = true;
        }

        // 状态机滞后处理 (Hysteresis)
        switch (this.lastState) {
            case 'IDLE':
                if (isGun) this.lastState = 'GUN';
                else if (isFist) this.lastState = 'FIST';
                break;
            case 'GUN':
                // 从 GUN 退出需要更严格的条件，防止闪烁
                if (isFist) this.lastState = 'FIST';
                else if (!isGun) this.lastState = 'IDLE';
                break;
            case 'FIST':
                if (isGun) this.lastState = 'GUN'; // 允许直接变枪
                else if (!isFist) this.lastState = 'IDLE';
                break;
        }
        
        // === 必杀技 (RECOIL) 检测 ===
        let isRecoil = false;
        
        // 只有在 GUN 状态稳定了一段时间后，才检测 RECOIL
        if (this.lastState === 'GUN') {
            this.gunStabilityTimer++;
        } else {
            this.gunStabilityTimer = 0;
        }
        
        // 阈值：稳定 10 帧 (约 0.16s) 且 未在开火冷却中
        if (this.gunStabilityTimer > 10 && !this.isFiring) {
            const indexTipToWristDist = vec.dist(landmarks[8], wrist);
            // 计算径向速度
            const radialVelocity = (indexTipToWristDist - this.prevIndexTipToWristDist) / 0.016; // 假设 60fps
            
            // 提高阈值到 0.5，防止挠头误触
            if (radialVelocity > 0.5) {
                isRecoil = true;
                this.isFiring = true;
                this.lastFireTime = now;
                console.log("🚀 RECOIL TRIGGERED! Velocity:", radialVelocity);
            }
        }

        // 冷却重置
        if (now - this.lastFireTime > 0.5) this.isFiring = false;
        
        this.inputState.gesture = isRecoil ? 'RECOIL' : this.lastState;
        this.prevIndexTipToWristDist = vec.dist(landmarks[8], wrist); // 更新上一帧距离
        
        // 调试输出 (可选，不调试时可注释)
        // console.log(`G: ${this.inputState.gesture} | I:${indexStraight} M:${middleCurled}`);
    }

    getInputState() { return this.inputState; }
}
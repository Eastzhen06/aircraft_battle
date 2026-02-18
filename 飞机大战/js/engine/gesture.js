import { FilesetResolver, HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

// === v2.4 2D 向量工具库 (纯几何) ===
const vec2 = {
    sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    len: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
    dist: (v1, v2) => Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)),
    normalize: (v) => {
        const l = Math.sqrt(v.x * v.x + v.y * v.y);
        return l > 0.00001 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
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
        this.gunStabilityTimer = 0; 
        // 记录上一帧食指指尖位置用于计算 2D 速度
        this.prevIndexTip = null;
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
        
        // v2.4: 仅需 2D landmarks 即可工作，鲁棒性更强
        if (results.landmarks && results.landmarks.length > 0) {
            this.drawingUtils.drawConnectors(results.landmarks[0], HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
            this.drawingUtils.drawLandmarks(results.landmarks[0], { color: "#FF0000", radius: 3 });
            
            this.analyzeHand(results.landmarks[0]);
            this.inputState.isDetected = true;
        } else {
            this.inputState.gesture = 'IDLE';
            this.inputState.isDetected = false;
            this.gunStabilityTimer = 0;
            this.prevIndexTip = null;
        }
        ctx.restore();
    }

    analyzeHand(landmarks) {
        const now = Date.now() / 1000;
        
        // 1. 坐标映射与平滑
        const sP = landmarks.map((p, i) => ({ 
            x: this.filters[i].x.filter(p.x, now), 
            y: this.filters[i].y.filter(p.y, now) 
        }));

        if (this.gameCanvas) {
            this.inputState.x = (1 - sP[0].x) * this.gameCanvas.width;
            this.inputState.y = sP[0].y * this.gameCanvas.height;
        }

        const wrist = sP[0];

        // === v2.4 核心算法: 拓扑互斥判定 ===
        
        // 辅助函数: 判断手指是直的还是弯的 (基于 PIP 关节距离)
        // Tip 距离手腕 比 PIP 距离手腕更远 -> 直，反之 -> 弯
        const isStraight = (tipIdx, pipIdx) => vec2.dist(sP[tipIdx], wrist) > vec2.dist(sP[pipIdx], wrist);
        const isCurled = (tipIdx, pipIdx) => vec2.dist(sP[tipIdx], wrist) < vec2.dist(sP[pipIdx], wrist);

        // 获取各指状态
        const indexStraight = isStraight(8, 6);
        const middleStraight = isStraight(12, 10);
        
        // 中指、无名指、小指必须严格卷曲
        const middleCurled = isCurled(12, 10); 
        const ringCurled = isCurled(16, 14);
        const pinkyCurled = isCurled(20, 18);

        let newState = 'IDLE';

        // --- 逻辑层 1: 剪刀手互斥锁 (Victory Mutex) ---
        // 只要食指和中指同时伸直，立即判定为无效/IDLE，切断射击可能
        if (indexStraight && middleStraight) {
            newState = 'IDLE'; 
        }
        // --- 逻辑层 2: 防御模式 (Fist) ---
        // 食指不直 (或也卷曲) + 其他三指卷曲
        else if (!indexStraight && middleCurled && ringCurled && pinkyCurled) {
            newState = 'FIST';
        }
        // --- 逻辑层 3: 射击模式 (Pistol Topology) ---
        // 核心条件: 中指必须卷曲 (Middle Mutex) + 无名/小指卷曲
        else if (middleCurled && ringCurled && pinkyCurled) {
            // [Z轴/右手修复]: 拓扑信任机制
            // 只要满足上述“握把”形态 (中/无/小指卷曲)，我们检查食指。
            // 只要食指“相对”伸展 (比中指长) 或者判定为直，就视为手枪。
            // 哪怕它垂直指向屏幕 (2D投影很短)，只要比卷曲的中指长，就是射击意图。
            const distIndex = vec2.dist(sP[8], wrist);
            const distMiddle = vec2.dist(sP[12], wrist);
            
            // 如果食指物理判定为直，或者 食指长度明显大于卷曲的中指 (1.1倍以上)
            if (indexStraight || (distIndex > distMiddle * 1.1)) {
                newState = 'GUN';
            }
        }

        // --- 状态机流转 (防抖) ---
        // 只有 Victory 状态会强制打断 GUN，其他状态允许快速切换
        this.lastState = newState;

        // --- RECOIL (射击动作) 检测 ---
        // 使用 2D 屏幕空间的指尖位移速度
        let isRecoil = false;
        if (this.lastState === 'GUN') {
            this.gunStabilityTimer++;
        } else {
            this.gunStabilityTimer = 0;
            this.prevIndexTip = null;
        }
        
        // 射击检测: 比较指尖 Y 轴的瞬间跳动 (模拟扣扳机或手腕上挑)
        if (this.gunStabilityTimer > 5 && !this.isFiring && this.prevIndexTip) {
            const currentTipY = sP[8].y;
            // 计算 Y 轴位移 (屏幕坐标系，向上是 y 减小)
            // 简单的距离突变检测
            const delta = vec2.dist(sP[8], this.prevIndexTip);
            
            // 阈值需要根据 2D 归一化坐标调整，0.03 约等于屏幕 3% 的高度突变
            if (delta > 0.03) {
                isRecoil = true;
                this.isFiring = true;
                this.lastFireTime = now;
                console.log("🚀 RECOIL (2D Topology):", delta.toFixed(4));
            }
        }
        
        if (now - this.lastFireTime > 0.2) this.isFiring = false;
        
        this.inputState.gesture = isRecoil ? 'RECOIL' : this.lastState;
        this.prevIndexTip = sP[8]; // 记录本帧位置
    }

    getInputState() { return this.inputState; }
}
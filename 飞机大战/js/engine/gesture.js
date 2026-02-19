import { FilesetResolver, HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

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
        
        this.prevY = { index: 0, middle: 0 };
        this.lastWristPos = null;
        this.lastWristTime = 0;
        this.lastWristSpeed = 0;
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
        const now = performance.now();
        if(this.video.readyState>=2){
            const results = this.handLandmarker.detectForVideo(this.video, now);
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
            
            // 提取左右手信息并传递给 analyzeHand
            const handedness = (results.handednesses && results.handednesses[0]) ? results.handednesses[0][0].categoryName : 'Right';
            this.analyzeHand(results.landmarks[0], handedness);
            
            this.inputState.isDetected = true;
        } else {
            this.inputState.gesture = 'IDLE';
            this.inputState.isDetected = false;
        }
        ctx.restore();
    }

    // 接收 handedness 参数
    analyzeHand(landmarks, handedness) {
        const now = Date.now() / 1000;
        
        const sP = landmarks.map((p, i) => ({ 
            x: this.filters[i].x.filter(p.x, now), 
            y: this.filters[i].y.filter(p.y, now) 
        }));

        if (this.gameCanvas) {
            this.inputState.x = (1 - sP[0].x) * this.gameCanvas.width;
            this.inputState.y = sP[0].y * this.gameCanvas.height;
        }

        const wrist = sP[0];

        let wristSpeed = 0;
        if (this.lastWristPos) {
            const dt = now - this.lastWristTime;
            if (dt > 0) {
                const dist = Math.hypot(wrist.x - this.lastWristPos.x, wrist.y - this.lastWristPos.y);
                wristSpeed = dist / dt;
            }
        }
        this.lastWristPos = wrist;
        this.lastWristTime = now;
        this.lastWristSpeed = wristSpeed;

        const isStraight = (tipIdx, pipIdx) => vec2.dist(sP[tipIdx], wrist) > vec2.dist(sP[pipIdx], wrist);
        const isCurled = (tipIdx, pipIdx) => vec2.dist(sP[tipIdx], wrist) < vec2.dist(sP[pipIdx], wrist);

        const indexStraight = isStraight(8, 6);
        const middleStraight = isStraight(12, 10);
        
        const middleCurled = isCurled(12, 10); 
        const ringCurled = isCurled(16, 14);
        const pinkyCurled = isCurled(20, 18);

        let newState = 'IDLE';

        // v3.1.8 方案 B: 动态阈值判定
        // 判断当前是否是左手 (注意摄像头镜像可能导致左右标定反转，因此匹配 'Left')
        const isLeftHand = (handedness === 'Left');

        if (indexStraight && middleStraight) {
            newState = 'IDLE'; 
        }
        else if (middleCurled && ringCurled && pinkyCurled) {
            const distIndex = vec2.dist(sP[8], wrist);
            const distMiddle = vec2.dist(sP[12], wrist);
            
            if (isLeftHand) {
                // 如果是左手，由于透视压缩严重，放宽判定阈值：只要食指2D投影比中指长一点点就认定为 GUN
                if (indexStraight || (distIndex > distMiddle * 1.02)) {
                    newState = 'GUN';
                } else {
                    newState = 'FIST';
                }
            } else {
                // 右手保持严格判定
                if (indexStraight || (distIndex > distMiddle * 1.1)) {
                    newState = 'GUN';
                } else {
                    newState = 'FIST';
                }
            }
        }

        this.lastState = newState;

        let isRecoil = false;
        let isVeto = false;

        if (this.lastState === 'GUN') {
            if (wristSpeed > 0.5) { 
                isVeto = true;
            } else {
                const vIndex = this.prevY.index - sP[8].y; 
                const vMiddle = this.prevY.middle - sP[12].y;
                
                if (vIndex > 0.03) { 
                    if (vMiddle < vIndex * 0.5) { 
                        if (!this.isFiring) {
                            isRecoil = true;
                            this.isFiring = true; 
                        }
                    } else {
                        isVeto = true; 
                    }
                } else if (vIndex < 0.01) {
                    this.isFiring = false; 
                }
            }
        } else {
            this.isFiring = false;
        }

        this.prevY.index = sP[8].y;
        this.prevY.middle = sP[12].y;
        this.inputState.gesture = isRecoil ? 'RECOIL' : this.lastState;
    }

    getInputState() { return this.inputState; }
}
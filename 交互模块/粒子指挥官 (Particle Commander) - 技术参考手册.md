# 粒子指挥官 (Particle Commander) - 技术参考手册

**版本:** v5.4 (Hotfix Release)  
**日期:** 2026-02-15  
**状态:** 稳定 (Stable)  
**架构:** WebGL (Three.js) + Computer Vision (MediaPipe)

---

## 1. 项目概述
**粒子指挥官** 是一个基于 Web 的高鲁棒性单手手势交互原型。该项目旨在验证“手势控制飞行射击游戏”的可行性，核心目标是解决 WebCam 识别中的抖动、丢帧及误触问题，为后续移植至游戏逻辑提供算法地基。

v5.4 版本为 **基线稳定版**，修复了 v5.3 中的 UI 渲染线程阻塞问题，并完成了渲染循环与 AI 推理循环的彻底解耦。

---

## 2. 更新日志 (Changelog)

### v5.4 (Current - Hotfix)
* **[修复] 启动崩溃问题**：修复了 `Uncaught TypeError` (undefined `innerText`)，删除了导致 JS 线程挂起的无效 DOM 引用（Latency 指标）。
* **[优化] 异步加载逻辑**：重构了 `window.onload` 初始化流程。现在 `Camera` 实例优先启动并渲染画面，不再等待 AI 模型加载完毕，解决了“加载中画面全黑”的用户体验问题。
* **[增强] 错误处理**：增加了 DOM 元素完整性检查，防止因 UI 变动导致的逻辑层崩溃。

### v5.3 (Previous)
* 集成 **1€ 滤波器 (One Euro Filter)** 用于骨架坐标去噪。
* 实现 **迟滞比较器 (Hysteresis Comparator)** 状态机，解决手势临界值闪烁问题。
* 引入 **动态锁定 (Motion Veto)** 机制，防止快速移动时的误触。

---

## 3. 系统架构 (System Architecture)

系统采用 **双循环解耦架构 (Dual-Loop Decoupling)**，确保在高负载下渲染不掉帧。

### 3.1 数据流向
1.  **Input**: Webcam 视频流 (320x240, 30fps)
2.  **Preprocessing**: MediaPipe Hands (GPU 加速) -> 提取 21 个关键点
3.  **Signal Processing**: 
    * `OneEuroFilter`: 对 X/Y/Z 坐标进行动态低通滤波。
    * `Data Normalization`: 计算几何特征（食指长度比、中指卷曲度）。
4.  **Logic Core**: 
    * 有限状态机 (FSM) 判定当前姿态 (Idle/Gun/Fist)。
    * 差分计算 (Delta V) 判定脉冲触发 (Recoil)。
5.  **Output**: 
    * Three.js 更新粒子速度与 Uniforms。
    * DOM 更新 UI 状态板。

### 3.2 核心算法

#### A. 1€ 滤波器 (One Euro Filter)
用于解决手势识别中的“高频抖动”与“低速延迟”的矛盾。
* **原理**: 根据手部移动速度动态调整截止频率。
    * *低速时*: 降低截止频率，大幅平滑，消除抖动。
    * *高速时*: 提高截止频率，减少延迟，保证跟手性。

#### B. 迟滞状态机 (Hysteresis FSM)
用于防止手势在临界点反复跳变（Flickering）。
* **进入条件 (Entry Threshold)**: 严格。例如：食指比率 > 1.15 进入 `Gun` 模式。
* **退出条件 (Exit Threshold)**: 宽松。例如：食指比率 < 0.85 退出 `Gun` 模式。
* *结果*: 在 0.85 ~ 1.15 的区间内，保持上一状态不变，形成状态粘滞。

#### C. 动态互斥锁 (Motion Veto)
防止在快速挥手或调整姿态时误触发“射击”。
* **逻辑**: 若 `Wrist Velocity` (手腕速度) > 阈值 (0.5)，强制锁定 `Fire` 触发器，直到速度归零。

---

## 4. 控制指令集 (Control Scheme)

| 手势 | 视觉特征 | 逻辑判定 | 游戏映射 (预期) |
| :--- | :--- | :--- | :--- |
| **悬停 (Idle)** | 自然张开或放松 | 不符合 Gun/Fist 特征 | 飞机悬停 / 匀速巡航 |
| **突击 (Gun)** | 食指伸直，中指/无名指/小指卷曲 | 食指比率 > 1.15 & 中指卷曲 | 飞机加速推进 (+Speed) |
| **后撤 (Fist)** | 五指握拳 | 食指比率 < 0.9 & 中指卷曲 | 飞机减速/后退 (-Speed) |
| **脉冲 (Recoil)** | Gun 状态下，指尖快速上抬 | ΔY (指尖) > 阈值 & 手腕静止 | 发射主武器 / 激光 |

---

## 5. 性能指标 (Performance)

* **渲染帧率 (Render FPS)**: 60fps (稳定，由 `requestAnimationFrame` 驱动)
* **AI 推理率 (AI FPS)**: ~10-15fps (受限于 `CONFIG.aiInterval = 50ms` 节流控制)
* **兼容性**: 
    * 支持 Desktop Chrome/Edge。
    * 支持 Mobile Safari/Chrome (已做 iOS 视频流兼容)。
    * 自动降级：优先使用 3D World Landmarks，失败则回退至 2D Screen Landmarks。

---

## 6. 部署与运行

该项目为单文件 HTML 结构，无需构建工具。

1.  保存代码为 `index.html`。
2.  使用本地服务器 (Local Server) 运行，或直接拖入支持 WebGL 的浏览器。
    * *注意*: 由于浏览器安全策略，摄像头权限通常要求 `https://` 或 `localhost` 环境。
3.  授权摄像头访问。

---

## 7. 后续规划 (Roadmap)

* **v6.0**: 将核心逻辑类 (`analyzeHand`, `OneEuroFilter`) 封装为独立 ES6 Module，准备移植至游戏项目。
* **v6.1**: 新增“必杀技”手势（如：张开五指并在 Z 轴前推）。
* **v6.2**: 增加手势灵敏度校准页面。

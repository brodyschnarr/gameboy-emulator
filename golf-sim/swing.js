// ─────────────────────────────────────────────
//  Swing Detector  (MediaPipe Pose)
//  Tracks body landmarks → detects swing → extracts metrics
// ─────────────────────────────────────────────

const SwingDetector = {

    pose: null,
    camera: null,
    videoEl: null,
    canvasEl: null,
    canvasCtx: null,
    onSwingCallback: null,
    hand: 'right', // 'right' or 'left'

    // State machine
    state: 'idle',  // idle | detecting | backswing | downswing | done

    // Frame buffer
    frames: [],
    MAX_FRAMES: 120, // 4 seconds at 30fps

    // Swing detection thresholds
    SWING_START_VELOCITY: 0.008,   // minimum wrist movement to start tracking
    IMPACT_VELOCITY_MIN: 0.04,     // minimum peak velocity to count as a real swing
    MIN_BACKSWING_FRAMES: 8,       // minimum frames in backswing phase
    MIN_DOWNSWING_FRAMES: 4,       // minimum frames in downswing phase

    async init(videoEl, canvasEl, onSwing, hand = 'right') {
        this.videoEl = videoEl;
        this.canvasEl = canvasEl;
        this.canvasCtx = canvasEl.getContext('2d');
        this.onSwingCallback = onSwing;
        this.hand = hand;

        this.pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.pose.onResults((results) => this._onResults(results));

        this.camera = new Camera(videoEl, {
            onFrame: async () => { await this.pose.send({ image: videoEl }); },
            width: 640,
            height: 480
        });

        await this.camera.start();
        console.log('[SwingDetector] Camera started');
    },

    stop() {
        if (this.camera) this.camera.stop();
        this.state = 'idle';
        this.frames = [];
    },

    startDetecting() {
        this.state = 'detecting';
        this.frames = [];
    },

    _onResults(results) {
        const { canvasEl, canvasCtx } = this;
        canvasEl.width = this.videoEl.videoWidth;
        canvasEl.height = this.videoEl.videoHeight;

        canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

        if (!results.poseLandmarks) {
            this._updateStatus('🏌️ Stand in frame', 'warning');
            return;
        }

        const lm = results.poseLandmarks;

        // Draw skeleton overlay
        this._drawSkeleton(lm);

        if (this.state === 'idle' || this.state === 'done') return;

        // Get relevant landmarks
        const wrist = this.hand === 'right' ? lm[16] : lm[15];
        const shoulder = this.hand === 'right' ? lm[12] : lm[11];
        const hip = this.hand === 'right' ? lm[24] : lm[23];
        const elbow = this.hand === 'right' ? lm[14] : lm[13];
        const oppShoulder = this.hand === 'right' ? lm[11] : lm[12];

        if (!wrist || wrist.visibility < 0.5) {
            this._updateStatus('⚠️ Can\'t see your wrist', 'warning');
            return;
        }

        // Store frame
        this.frames.push({
            wrist: { x: wrist.x, y: wrist.y },
            shoulder: { x: shoulder.x, y: shoulder.y },
            hip: { x: hip.x, y: hip.y },
            elbow: { x: elbow.x, y: elbow.y },
            oppShoulder: { x: oppShoulder.x, y: oppShoulder.y },
            t: performance.now()
        });

        if (this.frames.length > this.MAX_FRAMES) {
            this.frames.shift();
        }

        // Detect swing phases
        this._analyzeFrames();
    },

    _analyzeFrames() {
        const f = this.frames;
        if (f.length < 6) {
            this._updateStatus('🏌️ Address the ball', 'idle');
            return;
        }

        // Calculate wrist velocities
        const velocities = [];
        for (let i = 1; i < f.length; i++) {
            const dt = (f[i].t - f[i-1].t) / 1000; // seconds
            const dx = f[i].wrist.x - f[i-1].wrist.x;
            const dy = f[i].wrist.y - f[i-1].wrist.y;
            const speed = Math.sqrt(dx*dx + dy*dy) / Math.max(dt, 0.01);
            const vy = (f[i].wrist.y - f[i-1].wrist.y) / Math.max(dt, 0.01); // positive = moving down in screen
            velocities.push({ speed, vy, vx: dx / Math.max(dt, 0.01) });
        }

        // Check if currently moving (not at address)
        const recentVels = velocities.slice(-5);
        const avgRecentSpeed = recentVels.reduce((s, v) => s + v.speed, 0) / recentVels.length;

        if (avgRecentSpeed < this.SWING_START_VELOCITY) {
            this._updateStatus('🏌️ Ready — swing when set', 'ready');
            return;
        }

        // Look for peak downswing velocity (impact detection)
        const windowSize = 30; // look at last ~1 second
        const recent = velocities.slice(-windowSize);

        // Find max downward velocity (wrist moving DOWN = y increasing in screen coords)
        let peakVel = 0, peakIdx = -1;
        for (let i = 0; i < recent.length; i++) {
            if (recent[i].vy > peakVel) {
                peakVel = recent[i].vy;
                peakIdx = i;
            }
        }

        // Check if we hit impact threshold and wrist is now decelerating (post-impact)
        if (peakVel > this.IMPACT_VELOCITY_MIN && peakIdx < recent.length - 3) {
            // We've passed impact! Analyze the swing
            this._updateStatus('✅ Swing detected!', 'impact');
            this.state = 'done';
            setTimeout(() => this._processSwing(velocities, peakIdx, recent), 100);
        } else if (avgRecentSpeed > this.SWING_START_VELOCITY) {
            // In the middle of something
            if (this.frames.slice(-3).every((fr, i, a) => i === 0 || fr.wrist.y < a[i-1].wrist.y)) {
                this._updateStatus('⬆️ Backswing...', 'backswing');
            } else {
                this._updateStatus('⬇️ Downswing!', 'downswing');
            }
        }
    },

    _processSwing(velocities, peakIdx, recentVels) {
        const allFrames = this.frames;

        // Peak velocity at impact
        const peakVelocity = recentVels[peakIdx]?.vy || 0;

        // Find backswing start (where movement began after address)
        let backswingStartFrame = Math.max(0, allFrames.length - recentVels.length - 10);
        const wristPositions = allFrames.map(f => f.wrist);

        // Find highest point of wrist (backswing top)
        let topOfBackswingIdx = backswingStartFrame;
        let minY = wristPositions[backswingStartFrame]?.y || 1;
        for (let i = backswingStartFrame; i < allFrames.length; i++) {
            if (wristPositions[i].y < minY) {
                minY = wristPositions[i].y;
                topOfBackswingIdx = i;
            }
        }

        // Tempo: backswing duration / downswing duration
        const impactFrameIdx = allFrames.length - (recentVels.length - peakIdx);
        const backswingFrames = Math.max(1, topOfBackswingIdx - backswingStartFrame);
        const downswingFrames = Math.max(1, impactFrameIdx - topOfBackswingIdx);
        const tempoRatio = backswingFrames / downswingFrames;

        // Swing path: direction of wrist movement at impact (x component)
        const impactFrame = allFrames[Math.min(impactFrameIdx, allFrames.length - 1)];
        const preImpactFrame = allFrames[Math.max(0, impactFrameIdx - 3)];
        const pathVx = impactFrame.wrist.x - preImpactFrame.wrist.x;
        const pathVy = impactFrame.wrist.y - preImpactFrame.wrist.y;
        // Swing path in degrees relative to target line
        // For face-on view: leftward wrist path = inside-out (+), rightward = outside-in (-)
        const swingPath = -(pathVx / Math.max(Math.abs(pathVy), 0.001)) * 3;

        // Attack angle: estimated from wrist trajectory at impact
        // Steeper downward = more descending = negative attack angle
        const attackAngle = -(pathVy / 0.1) * 5;

        // Face angle: estimated from shoulder rotation at impact
        // Shoulder tilt gives proxy for face angle
        let faceAngle = 0;
        if (impactFrame.shoulder && impactFrame.oppShoulder) {
            const shoulderAngle = Math.atan2(
                impactFrame.oppShoulder.y - impactFrame.shoulder.y,
                impactFrame.oppShoulder.x - impactFrame.shoulder.x
            ) * 180 / Math.PI;
            faceAngle = shoulderAngle * 0.3; // approximate
        }

        // Confidence based on how clear the swing was
        const confidence = Math.min(1, peakVelocity / (this.IMPACT_VELOCITY_MIN * 2));

        const swingData = {
            peakVelocity,
            swingPath: Math.max(-5, Math.min(5, swingPath)),
            tempoRatio: Math.max(1, Math.min(6, tempoRatio)),
            attackAngle: Math.max(-8, Math.min(8, attackAngle)),
            faceAngle: Math.max(-10, Math.min(10, faceAngle)),
            confidence
        };

        console.log('[SwingDetector] Swing data:', swingData);
        if (this.onSwingCallback) this.onSwingCallback(swingData);
    },

    _drawSkeleton(lm) {
        const ctx = this.canvasCtx;
        const W = this.canvasEl.width;
        const H = this.canvasEl.height;

        ctx.strokeStyle = 'rgba(245,197,24,0.8)';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(245,197,24,0.9)';

        // Connections to draw
        const connections = [
            [11,12],[11,13],[13,15],[12,14],[14,16], // arms
            [11,23],[12,24],[23,24],                  // torso
            [23,25],[25,27],[24,26],[26,28]            // legs
        ];

        connections.forEach(([a, b]) => {
            if (!lm[a] || !lm[b]) return;
            if (lm[a].visibility < 0.3 || lm[b].visibility < 0.3) return;
            ctx.beginPath();
            ctx.moveTo(lm[a].x * W, lm[a].y * H);
            ctx.lineTo(lm[b].x * W, lm[b].y * H);
            ctx.stroke();
        });

        // Key joints
        [11,12,13,14,15,16,23,24].forEach(i => {
            if (!lm[i] || lm[i].visibility < 0.3) return;
            ctx.beginPath();
            ctx.arc(lm[i].x * W, lm[i].y * H, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Highlight active wrist
        const wristIdx = this.hand === 'right' ? 16 : 15;
        if (lm[wristIdx] && lm[wristIdx].visibility > 0.3) {
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(lm[wristIdx].x * W, lm[wristIdx].y * H, 9, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    _updateStatus(text, type) {
        if (this._lastStatus === text) return;
        this._lastStatus = text;
        const el = document.getElementById('status-text');
        if (el) el.textContent = text;
    }
};

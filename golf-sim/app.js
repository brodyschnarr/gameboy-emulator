// ─────────────────────────────────────────────
//  Golf Sim — Main App Controller
// ─────────────────────────────────────────────

const App = {
    state: 'setup',   // setup | calibration | session | results
    club: 'driver',
    hand: 'right',
    shots: [],
    rangeReady: false,
    calibrationShots: [],
    lastSwingReplay: null,

    CLUB_NAMES: {
        driver: 'Driver', '3w': '3 Wood', '5i': '5 Iron', '7i': '7 Iron', pw: 'Pitching Wedge'
    },

    init() {
        // Load existing calibration
        ShotCalculator.loadCalibration();
        
        this._initSetupScreen();
        this._startSetupCamera();
    },

    // ── Setup Screen ────────────────────────────

    _initSetupScreen() {
        // Club buttons
        document.querySelectorAll('#club-selector .club-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#club-selector .club-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.club = btn.dataset.club;
            });
        });

        // Hand buttons
        document.querySelectorAll('.hand-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.hand-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.hand = btn.dataset.hand;
            });
        });

        // Start button
        document.getElementById('btn-start').addEventListener('click', () => {
            // Check if calibrated
            const hasCalibration = localStorage.getItem('golf_sim_calibration');
            if (hasCalibration) {
                this._startSession();
            } else {
                this._startCalibration();
            }
        });
    },

    async _startSetupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: 640, height: 480 }
            });
            const vid = document.getElementById('setup-video');
            vid.srcObject = stream;
            this._setupStream = stream;
        } catch (e) {
            console.warn('Camera not available on setup screen:', e);
        }
    },

    _stopSetupCamera() {
        if (this._setupStream) {
            this._setupStream.getTracks().forEach(t => t.stop());
            this._setupStream = null;
        }
    },

    // ── Calibration ─────────────────────────────

    async _startCalibration() {
        this._stopSetupCamera();
        this._showScreen('calibration');
        this.state = 'calibration';
        this.calibrationShots = [];

        // Skip button
        document.getElementById('btn-skip-cal').addEventListener('click', () => {
            this._startSession();
        });

        // Complete button
        document.getElementById('btn-complete-cal').addEventListener('click', () => {
            this._completeCalibration();
        });

        // Init swing detector for calibration
        try {
            const videoEl = document.getElementById('cal-video');
            const canvasEl = document.getElementById('cal-canvas');
            await SwingDetector.init(videoEl, canvasEl, (swingData) => {
                this._onCalibrationSwing(swingData);
            }, this.hand);

            SwingDetector.startDetecting();
            this._updateCalibrationUI();
        } catch (e) {
            console.error('Calibration camera init failed:', e);
            alert('Camera error. Skipping calibration.');
            this._startSession();
        }
    },

    _onCalibrationSwing(swingData) {
        if (this.calibrationShots.length >= 3) return;

        // Calculate shot without calibration (use default multiplier 1.0)
        const shot = ShotCalculator.calculate(swingData, 'driver');
        if (!shot) return;

        this.calibrationShots.push(shot);
        const shotNum = this.calibrationShots.length;

        // Update UI
        document.getElementById(`cal-dist-${shotNum}`).textContent = `${shot.carryYards} yds`;
        const shotCard = document.querySelector(`.cal-shot[data-shot="${shotNum}"]`);
        shotCard.classList.remove('active');
        shotCard.classList.add('complete');
        shotCard.querySelector('.shot-status').textContent = 'Measured';

        if (shotNum < 3) {
            // Next shot
            SwingDetector.state = 'detecting';
            SwingDetector.frames = [];
            SwingDetector.startDetecting();
            this._updateCalibrationUI();
        } else {
            // All 3 shots done
            SwingDetector.stop();
            document.getElementById('cal-instruction').textContent = 'Great! Now enter your typical driver carry distance';
            document.getElementById('cal-input-section').classList.remove('hidden');
            document.getElementById('btn-complete-cal').classList.remove('hidden');
            
            // Pre-fill with measured average
            const avg = Math.round(this.calibrationShots.reduce((s, shot) => s + shot.carryYards, 0) / 3);
            document.getElementById('typical-distance').value = avg;
        }
    },

    _updateCalibrationUI() {
        const nextShot = this.calibrationShots.length + 1;
        if (nextShot <= 3) {
            const shotCard = document.querySelector(`.cal-shot[data-shot="${nextShot}"]`);
            shotCard.classList.add('active');
            shotCard.querySelector('.shot-status').textContent = 'Ready...';
        }
    },

    _completeCalibration() {
        const typicalInput = document.getElementById('typical-distance');
        const typicalCarry = parseInt(typicalInput.value);

        if (!typicalCarry || typicalCarry < 100 || typicalCarry > 350) {
            alert('Please enter a valid distance (100-350 yards)');
            return;
        }

        // Save calibration
        const multiplier = ShotCalculator.saveCalibration(typicalCarry, this.calibrationShots);
        
        console.log(`[Calibration] Multiplier set to ${multiplier.toFixed(2)}x`);
        
        // Move to session
        SwingDetector.stop();
        this._startSession();
    },

    // ── Session ─────────────────────────────────

    async _startSession() {
        this._stopSetupCamera();
        this._showScreen('session');
        this.state = 'session';

        // Init club buttons in session screen
        document.querySelectorAll('.club-btn-sm').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.club-btn-sm').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.club = btn.dataset.club;
                document.getElementById('display-club').textContent = this.CLUB_NAMES[this.club];
            });
        });

        // Set initial club display
        const initBtn = document.querySelector(`.club-btn-sm[data-club="${this.club}"]`);
        if (initBtn) initBtn.classList.add('active');
        document.getElementById('display-club').textContent = this.CLUB_NAMES[this.club];

        // Exit button
        document.getElementById('btn-exit').addEventListener('click', () => {
            this._endSession();
        });

        // Replay button
        document.getElementById('btn-replay').addEventListener('click', () => {
            this._showReplay();
        });

        // Next shot button
        document.getElementById('btn-next-shot').addEventListener('click', () => {
            this._prepareNextShot();
        });

        // Init 3D range immediately — it's always visible
        const rangeCanvas = document.getElementById('range-canvas');
        DrivingRange.init(rangeCanvas);
        this.rangeReady = true;

        // Init swing detector
        try {
            const videoEl = document.getElementById('swing-video');
            const canvasEl = document.getElementById('pose-canvas');
            await SwingDetector.init(videoEl, canvasEl, (swingData) => {
                this._onSwingDetected(swingData);
            }, this.hand);

            SwingDetector.startDetecting();
        } catch (e) {
            console.error('MediaPipe init failed:', e);
            document.getElementById('status-text').textContent = '⚠️ Camera error — check permissions';
        }
    },

    _onSwingDetected(swingData) {
        // Calculate shot
        const shotData = ShotCalculator.calculate(swingData, this.club);
        if (!shotData) return;

        // Save swing replay
        this.lastSwingReplay = SwingDetector.getRecordedSwing();
        document.getElementById('btn-replay').classList.remove('hidden');

        // Store shot
        this.shots.push(shotData);

        // Update stats panel
        this._displayStats(shotData);

        // Add to history
        this._addToHistory(shotData);

        // Show 3D range with ball flight
        this._showRangeAnimation(shotData);
    },

    _displayStats(shot) {
        const update = (id, value, unit) => {
            const card = document.getElementById(id);
            if (!card) return;
            card.querySelector('.stat-value').textContent = value;
            if (unit !== undefined) card.querySelector('.stat-unit').textContent = unit;
            card.classList.add('highlight');
            setTimeout(() => card.classList.remove('highlight'), 1500);
        };

        update('stat-chs', shot.clubHeadSpeed);
        update('stat-bs', shot.ballSpeed);
        update('stat-carry', shot.carryYards);
        update('stat-total', shot.totalYards);
        update('stat-launch', shot.launchAngle + '°', '');
        update('stat-dir', shot.directionLabel, '');
        update('stat-shape', shot.shotShape, '');
        update('stat-tempo', `${shot.tempoRatio} (${shot.tempoRating})`, '');
    },

    _addToHistory(shot) {
        const list = document.getElementById('history-list');
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span class="hi-club">${shot.clubName}</span>
            <span class="hi-carry">${shot.carryYards} yds</span>
            <span class="hi-shape">${shot.shotShape}</span>
        `;
        list.insertBefore(item, list.firstChild);
        // Keep max 10 in history
        while (list.children.length > 10) list.removeChild(list.lastChild);
    },

    _showRangeAnimation(shot) {
        // Range is always visible — just animate the ball and show result card
        SwingDetector.state = 'done'; // pause detection during flight

        const card = document.getElementById('shot-result-card');
        card.innerHTML = `
            <div style="font-size:32px;font-weight:900;color:#f5c518;margin-bottom:4px">${shot.totalYards} yds</div>
            <div style="font-size:16px;color:#ccc">${shot.shotShape} · ${shot.directionLabel}</div>
            <div style="font-size:13px;color:#888;margin-top:6px">CHS ${shot.clubHeadSpeed} mph &nbsp;·&nbsp; Ball ${shot.ballSpeed} mph &nbsp;·&nbsp; Launch ${shot.launchAngle}°</div>
        `;

        DrivingRange.reset();
        DrivingRange.animateBallFlight(shot, () => {
            document.getElementById('next-shot-overlay').classList.remove('hidden');
        });
    },

    _prepareNextShot() {
        document.getElementById('next-shot-overlay').classList.add('hidden');
        DrivingRange.reset();

        // Resume swing detection
        SwingDetector.state = 'detecting';
        SwingDetector.frames = [];
        SwingDetector.startDetecting();
        document.getElementById('status-text').textContent = '🏌️ Address the ball';
    },

    _endSession() {
        SwingDetector.stop();
        DrivingRange.reset();
        DrivingRange.clearAllTracers(); // Clear shot tracers when ending session
        this._showScreen('setup');
        this.state = 'setup';
        this.shots = [];
        document.getElementById('history-list').innerHTML = '';
        document.getElementById('next-shot-overlay').classList.add('hidden');
        this._resetStats();
        this._startSetupCamera();
    },

    _resetStats() {
        ['stat-chs','stat-bs','stat-carry','stat-total','stat-launch','stat-dir','stat-shape','stat-tempo'].forEach(id => {
            const card = document.getElementById(id);
            if (card) card.querySelector('.stat-value').textContent = '--';
        });
    },

    // ── Utilities ────────────────────────────────

    // ── Replay ──────────────────────────────────

    _showReplay() {
        if (!this.lastSwingReplay || !this.lastSwingReplay.frames.length) {
            alert('No swing to replay');
            return;
        }

        const modal = document.getElementById('replay-modal');
        const canvas = document.getElementById('replay-canvas');
        const ctx = canvas.getContext('2d');
        const slider = document.getElementById('replay-slider');
        const playPauseBtn = document.getElementById('btn-play-pause');
        const speedSelect = document.getElementById('replay-speed');

        modal.classList.remove('hidden');

        // Setup canvas
        canvas.width = 640;
        canvas.height = 480;

        let isPlaying = false;
        let currentFrame = 0;
        let animId = null;
        const frames = this.lastSwingReplay.frames;

        const drawFrame = (index) => {
            if (index < 0 || index >= frames.length) return;
            
            const frame = frames[index];
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw skeleton
            const lm = frame.landmarks;
            const W = canvas.width;
            const H = canvas.height;

            ctx.strokeStyle = 'rgba(245,197,24,0.9)';
            ctx.lineWidth = 3;
            ctx.fillStyle = 'rgba(245,197,24,0.9)';

            // Connections
            const connections = [
                [11,12],[11,13],[13,15],[12,14],[14,16],
                [11,23],[12,24],[23,24],
                [23,25],[25,27],[24,26],[26,28]
            ];

            connections.forEach(([a, b]) => {
                if (!lm[a] || !lm[b] || lm[a].visibility < 0.3 || lm[b].visibility < 0.3) return;
                ctx.beginPath();
                ctx.moveTo(lm[a].x * W, lm[a].y * H);
                ctx.lineTo(lm[b].x * W, lm[b].y * H);
                ctx.stroke();
            });

            // Joints
            [11,12,13,14,15,16,23,24].forEach(i => {
                if (!lm[i] || lm[i].visibility < 0.3) return;
                ctx.beginPath();
                ctx.arc(lm[i].x * W, lm[i].y * H, 6, 0, Math.PI * 2);
                ctx.fill();
            });

            // Frame number
            ctx.fillStyle = '#fff';
            ctx.font = '14px monospace';
            ctx.fillText(`Frame ${index + 1} / ${frames.length}`, 10, 20);
        };

        const play = () => {
            if (!isPlaying) return;
            
            currentFrame++;
            if (currentFrame >= frames.length) {
                currentFrame = 0; // loop
            }
            
            drawFrame(currentFrame);
            slider.value = (currentFrame / frames.length) * 100;
            
            const speed = parseFloat(speedSelect.value);
            const delay = 33 / speed; // ~30fps base
            animId = setTimeout(play, delay);
        };

        playPauseBtn.onclick = () => {
            isPlaying = !isPlaying;
            playPauseBtn.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
            if (isPlaying) play();
            else if (animId) clearTimeout(animId);
        };

        slider.oninput = () => {
            currentFrame = Math.floor((slider.value / 100) * frames.length);
            drawFrame(currentFrame);
        };

        document.getElementById('btn-close-replay').onclick = () => {
            isPlaying = false;
            if (animId) clearTimeout(animId);
            modal.classList.add('hidden');
        };

        // Draw first frame
        drawFrame(0);
    },

    // ── Utilities ────────────────────────────────

    _showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; });
        const el = document.getElementById(`screen-${name}`);
        el.style.display = (name === 'setup') ? 'flex' : 'block';
    }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());

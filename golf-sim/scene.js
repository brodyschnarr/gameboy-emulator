// ─────────────────────────────────────────────
//  3D Driving Range Scene  (Three.js)
// ─────────────────────────────────────────────

const DrivingRange = {
    scene: null,
    camera: null,
    renderer: null,
    ball: null,
    ballTrail: [],
    shotTracers: [],      // Array of persistent shot tracer lines
    animFrame: null,
    isAnimating: false,

    init(canvas) {
        this.canvas = canvas;
        const W = canvas.clientWidth || window.innerWidth;
        const H = canvas.clientHeight || window.innerHeight;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        this.renderer.setSize(W, H);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 200, 500);

        // Camera (positioned at tee, looking down range)
        this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
        this.camera.position.set(0, 3, 8);
        this.camera.lookAt(0, 0, -50);

        this._buildScene();
        this._startRenderLoop();

        window.addEventListener('resize', () => this._onResize());
    },

    _buildScene() {
        // ── Lighting ──
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.far = 600;
        sun.shadow.camera.left = -150;
        sun.shadow.camera.right = 150;
        sun.shadow.camera.top = 150;
        sun.shadow.camera.bottom = -150;
        this.scene.add(sun);

        // ── Ground / Fairway ──
        const groundGeo = new THREE.PlaneGeometry(120, 420);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a8c3f });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, 0, -200);
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Rough strips on sides
        const roughMat = new THREE.MeshLambertMaterial({ color: 0x2d6e32 });
        [-65, 65].forEach(x => {
            const rough = new THREE.Mesh(new THREE.PlaneGeometry(20, 420), roughMat);
            rough.rotation.x = -Math.PI / 2;
            rough.position.set(x, 0.01, -200);
            this.scene.add(rough);
        });

        // ── Tee Box ──
        const teeGeo = new THREE.PlaneGeometry(8, 8);
        const teeMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
        const tee = new THREE.Mesh(teeGeo, teeMat);
        tee.rotation.x = -Math.PI / 2;
        tee.position.set(0, 0.01, 3);
        this.scene.add(tee);

        // Tee peg
        const pegGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
        const pegMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const peg = new THREE.Mesh(pegGeo, pegMat);
        peg.position.set(0, 0.08, 0);
        this.scene.add(peg);

        // ── Distance Markers ──
        const distances = [50, 100, 150, 200, 250, 300, 350];
        distances.forEach(yds => {
            const z = -(yds * 0.9144); // yards to meters (roughly scaled)

            // Yardage line across fairway
            const lineGeo = new THREE.PlaneGeometry(55, 0.3);
            const lineMat = new THREE.MeshLambertMaterial({ color: 0xffffff, opacity: 0.4, transparent: true });
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.02, z);
            this.scene.add(line);

            // Yardage sign
            this._makeYardageSign(yds, z);
        });

        // ── Trees on sides ──
        for (let i = 0; i < 20; i++) {
            const z = -20 - (i * 18);
            this._makeTree(-60 + (Math.random() * 8 - 4), z);
            this._makeTree(60 + (Math.random() * 8 - 4), z);
        }

        // ── Sky dome ──
        const skyGeo = new THREE.SphereGeometry(400, 32, 16);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x87ceeb,
            side: THREE.BackSide
        });
        this.scene.add(new THREE.Mesh(skyGeo, skyMat));

        // ── Ball ──
        const ballGeo = new THREE.SphereGeometry(0.21, 16, 12);
        const ballMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        this.ball = new THREE.Mesh(ballGeo, ballMat);
        this.ball.castShadow = true;
        this.ball.position.set(0, 0.21, 0);
        this.scene.add(this.ball);

        // Shadow under ball
        const shadowGeo = new THREE.CircleGeometry(0.25, 12);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.3, transparent: true });
        this.ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
        this.ballShadow.rotation.x = -Math.PI / 2;
        this.ballShadow.position.set(0, 0.01, 0);
        this.scene.add(this.ballShadow);

        // Trail geometry (will be updated)
        this.trailPoints = [];
        this.trailLine = null;
    },

    _makeYardageSign(yds, z) {
        // Simple box sign
        const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 8);
        const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(-58, 1, z);
        this.scene.add(post);

        const boardGeo = new THREE.BoxGeometry(2, 1, 0.1);
        const boardMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.set(-58, 2.2, z);
        this.scene.add(board);
    },

    _makeTree(x, z) {
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d3a1a });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 1, z);
        this.scene.add(trunk);

        const h = 4 + Math.random() * 3;
        const foliageGeo = new THREE.ConeGeometry(2 + Math.random(), h, 8);
        const foliageMat = new THREE.MeshLambertMaterial({ color: 0x1a5c2a });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.set(x, 2 + h / 2, z);
        this.scene.add(foliage);
    },

    _startRenderLoop() {
        const render = () => {
            this.animFrame = requestAnimationFrame(render);
            this.renderer.render(this.scene, this.camera);
        };
        render();
    },

    _onResize() {
        const W = window.innerWidth;
        const H = window.innerHeight;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(W, H);
    },

    // ── Ball Flight Animation ──────────────────
    animateBallFlight(shotData, onComplete) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        // Clear old trail
        if (this.trailLine) {
            this.scene.remove(this.trailLine);
            this.trailLine = null;
        }
        this.trailPoints = [];

        const { carryYards, totalYards, launchAngle, directionYards } = shotData;

        // Convert yards to scene units (1 yard ≈ 0.8 scene units for feel)
        const scale = 0.8;
        const carryZ = -(carryYards * scale);
        const totalZ = -(totalYards * scale);
        const endX = (directionYards || 0) * scale * 0.3;
        const peakHeight = Math.max(5, (launchAngle / 40) * (carryYards / 10));

        const duration = 3000; // ms for ball flight
        const start = performance.now();

        // Camera follow settings
        const startCamPos = { x: 0, y: 3, z: 8 };
        const midCamPos = { x: endX * 0.3, y: peakHeight * 0.5 + 5, z: carryZ * 0.4 };
        const endCamPos = { x: endX * 0.5, y: 4, z: totalZ + 15 };

        // Reset ball
        this.ball.position.set(0, 0.21, 0);
        this.ballShadow.position.set(0, 0.01, 0);

        const animate = (now) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / duration, 1);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out

            // Ball position along parabolic arc
            const ballX = endX * t;
            const ballZ = carryZ * t;

            // Height: parabola peaking at t=0.5, with descent for carry phase
            // After carry, ball rolls on ground
            let ballY;
            if (t < 0.85) {
                const tFlight = t / 0.85;
                ballY = 4 * peakHeight * tFlight * (1 - tFlight) + 0.21;
            } else {
                ballY = 0.21; // rolling
            }

            this.ball.position.set(ballX, ballY, ballZ);
            this.ballShadow.position.set(ballX, 0.01, ballZ);

            // Trail (temporary during flight)
            this.trailPoints.push(new THREE.Vector3(ballX, ballY, ballZ));
            if (this.trailPoints.length > 2) {
                if (this.trailLine) this.scene.remove(this.trailLine);
                const geo = new THREE.BufferGeometry().setFromPoints(this.trailPoints);
                const mat = new THREE.LineBasicMaterial({ color: 0xffee88, opacity: 0.8, transparent: true, linewidth: 2 });
                this.trailLine = new THREE.Line(geo, mat);
                this.scene.add(this.trailLine);
            }

            // Camera movement
            let camX, camY, camZ;
            if (t < 0.5) {
                const ct = t / 0.5;
                camX = startCamPos.x + (midCamPos.x - startCamPos.x) * ct;
                camY = startCamPos.y + (midCamPos.y - startCamPos.y) * ct;
                camZ = startCamPos.z + (midCamPos.z - startCamPos.z) * ct;
            } else {
                const ct = (t - 0.5) / 0.5;
                camX = midCamPos.x + (endCamPos.x - midCamPos.x) * ct;
                camY = midCamPos.y + (endCamPos.y - midCamPos.y) * ct;
                camZ = midCamPos.z + (endCamPos.z - midCamPos.z) * ct;
            }
            this.camera.position.set(camX, camY, camZ);
            this.camera.lookAt(ballX, 0, ballZ);

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                
                // Convert temporary trail to permanent shot tracer
                this._createShotTracer(this.trailPoints.slice());
                
                // Show landing marker
                this._showLandingMarker(endX, totalZ);
                
                // Pan back slowly
                this._panBack(endX, totalZ, onComplete);
            }
        };

        requestAnimationFrame(animate);
    },

    _showLandingMarker(x, z) {
        const geo = new THREE.RingGeometry(0.4, 0.7, 24);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffee00, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.05, z);
        this.scene.add(ring);
        this.landingMarker = ring;
    },

    _createShotTracer(points) {
        if (points.length < 2) return;
        
        // Create a permanent shot tracer line
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0xf5c518,      // Gold color
            opacity: 0.7,
            transparent: true,
            linewidth: 2
        });
        const tracer = new THREE.Line(geo, mat);
        this.scene.add(tracer);
        this.shotTracers.push(tracer);
        
        // Limit to last 10 shots to avoid clutter
        if (this.shotTracers.length > 10) {
            const oldTracer = this.shotTracers.shift();
            this.scene.remove(oldTracer);
        }
    },

    _panBack(landX, landZ, onComplete) {
        const start = performance.now();
        const duration = 2000;
        const fromPos = { ...this.camera.position };
        const toPos = { x: landX * 0.3, y: 8, z: landZ + 20 };

        const pan = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            this.camera.position.set(
                fromPos.x + (toPos.x - fromPos.x) * ease,
                fromPos.y + (toPos.y - fromPos.y) * ease,
                fromPos.z + (toPos.z - fromPos.z) * ease
            );
            this.camera.lookAt(landX, 0, landZ);
            if (t < 1) requestAnimationFrame(pan);
            else if (onComplete) onComplete();
        };
        requestAnimationFrame(pan);
    },

    reset() {
        // Reset ball and camera to tee
        this.ball.position.set(0, 0.21, 0);
        this.ballShadow.position.set(0, 0.01, 0);
        this.camera.position.set(0, 3, 8);
        this.camera.lookAt(0, 0, -50);

        // Clear temporary trail and landing marker
        if (this.trailLine) { this.scene.remove(this.trailLine); this.trailLine = null; }
        if (this.landingMarker) { this.scene.remove(this.landingMarker); this.landingMarker = null; }
        this.trailPoints = [];
        
        // DON'T clear shot tracers — they persist across shots
        
        this.isAnimating = false;
    },

    clearAllTracers() {
        // Method to manually clear all shot tracers (e.g., when ending session)
        this.shotTracers.forEach(tracer => this.scene.remove(tracer));
        this.shotTracers = [];
    }
};

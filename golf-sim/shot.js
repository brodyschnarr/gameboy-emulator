// ─────────────────────────────────────────────
//  Shot Calculator
//  Converts swing metrics → realistic shot data
// ─────────────────────────────────────────────

const ShotCalculator = {

    CLUBS: {
        driver: { name: 'Driver',  smash: 1.48, launchAngle: 12, spin: 2700, rollFactor: 1.10, maxSpeed: 125 },
        '3w':   { name: '3 Wood',  smash: 1.46, launchAngle: 14, spin: 3500, rollFactor: 1.07, maxSpeed: 115 },
        '5i':   { name: '5 Iron',  smash: 1.38, launchAngle: 19, spin: 5000, rollFactor: 1.05, maxSpeed: 100 },
        '7i':   { name: '7 Iron',  smash: 1.33, launchAngle: 22, spin: 6500, rollFactor: 1.03, maxSpeed: 90  },
        'pw':   { name: 'Pitching Wedge', smash: 1.25, launchAngle: 28, spin: 9000, rollFactor: 1.01, maxSpeed: 80 }
    },

    // Average club head speeds for calibration (recreational golfer = ~85 mph driver)
    AVG_SWING_SPEED: 85,

    // Convert raw wrist velocity (px/frame) to estimated club head speed (mph)
    // This is the calibration layer — adjustable per user
    calibrate(rawVelocity, club) {
        // rawVelocity is in normalized coords (0-1) per frame at 30fps
        // Peak downswing velocity for avg golfer is roughly 0.08-0.14 units/frame
        const ref = 0.10; // reference velocity for avg golfer
        const ratio = Math.min(rawVelocity / ref, 1.6); // cap at 160% of avg
        const clubData = this.CLUBS[club];
        const chs = this.AVG_SWING_SPEED * ratio * (clubData.maxSpeed / 85);
        return Math.round(Math.min(chs, clubData.maxSpeed * 1.15));
    },

    calculate(swingData, club) {
        const clubData = this.CLUBS[club];
        if (!clubData) return null;

        const {
            peakVelocity,     // wrist velocity at impact (normalized units/frame)
            swingPath,        // angle of wrist path at impact (-ve = outside-in, +ve = inside-out)
            tempoRatio,       // backswing frames / downswing frames (ideal ≈ 3.0)
            attackAngle,      // estimated degrees (negative = descending)
            faceAngle,        // estimated face angle offset from path (degrees)
            confidence        // 0-1 how confident we are in the swing detection
        } = swingData;

        // 1. Club Head Speed
        const clubHeadSpeed = this.calibrate(peakVelocity, club);

        // 2. Ball Speed
        const ballSpeed = Math.round(clubHeadSpeed * clubData.smash);

        // 3. Launch angle (base + attack angle modifier)
        const launchAngle = Math.max(4, Math.round(
            clubData.launchAngle + (attackAngle * 0.6)
        ));

        // 4. Carry distance using simplified ballistics
        // Based on: D = v² × sin(2θ) / g  (simplified, ignores air resistance)
        // Real golf uses more complex aerodynamics, but this gives realistic feel
        const vMetric = ballSpeed * 0.44704; // mph to m/s
        const angle = launchAngle * Math.PI / 180;
        const rawCarry = (vMetric * vMetric * Math.sin(2 * angle)) / 9.81;
        // Apply golf-specific correction factor (ball carries much farther than projectile due to aerodynamics)
        const carryMeters = rawCarry * 1.85;
        const carryYards = Math.round(carryMeters * 1.09361);
        const totalYards = Math.round(carryYards * clubData.rollFactor);

        // 5. Direction (yards left/right at landing)
        // swingPath contributes to direction, faceAngle modifies curve
        const pathInfluence = swingPath * 15; // degrees to yards at 250yd carry
        const directionYards = Math.round(pathInfluence * (carryYards / 250));

        // 6. Shot shape (based on face angle relative to swing path)
        const faceToPahDiff = faceAngle - swingPath;
        let shotShape;
        if (Math.abs(faceToPahDiff) < 0.5 && Math.abs(swingPath) < 1.5) {
            shotShape = 'Straight';
        } else if (swingPath > 2 && faceToPahDiff > 0) {
            shotShape = clubHeadSpeed > 95 ? 'Hook' : 'Draw';
        } else if (swingPath > 0 && faceToPahDiff > 0) {
            shotShape = 'Draw';
        } else if (swingPath < -2 && faceToPahDiff < 0) {
            shotShape = clubHeadSpeed > 95 ? 'Slice' : 'Fade';
        } else if (swingPath < 0 && faceToPahDiff < 0) {
            shotShape = 'Fade';
        } else if (swingPath > 1.5 && faceToPahDiff < -0.5) {
            shotShape = 'Push';
        } else if (swingPath < -1.5 && faceToPahDiff > 0.5) {
            shotShape = 'Pull';
        } else {
            shotShape = 'Straight';
        }

        // 7. Tempo rating
        let tempoRating;
        if (tempoRatio >= 2.5 && tempoRatio <= 3.5) tempoRating = 'Excellent';
        else if (tempoRatio >= 2.0 && tempoRatio <= 4.0) tempoRating = 'Good';
        else if (tempoRatio < 2.0) tempoRating = 'Too Quick';
        else tempoRating = 'Too Slow';

        return {
            club,
            clubName: clubData.name,
            clubHeadSpeed,
            ballSpeed,
            carryYards,
            totalYards,
            launchAngle,
            directionYards,
            directionLabel: directionYards === 0 ? 'On Target' : `${Math.abs(directionYards)} yds ${directionYards < 0 ? 'Left' : 'Right'}`,
            shotShape,
            tempoRatio: tempoRatio.toFixed(1),
            tempoRating,
            confidence
        };
    }
};

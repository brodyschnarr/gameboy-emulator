// ─────────────────────────────────────────────
//  Simple Test Runner
// ─────────────────────────────────────────────

const TestRunner = {
    suites: [],
    totalTests: 0,
    passedTests: 0,

    suite(name, fn) {
        const suite = { name, tests: [] };
        this.suites.push(suite);
        const ctx = {
            test: (testName, testFn) => {
                suite.tests.push({ name: testName, fn: testFn });
            }
        };
        fn(ctx);
    },

    run() {
        const resultsEl = document.getElementById('results');
        resultsEl.innerHTML = '';

        this.suites.forEach(suite => {
            const suiteEl = document.createElement('div');
            suiteEl.className = 'suite';
            suiteEl.innerHTML = `<h2>${suite.name}</h2>`;

            suite.tests.forEach(test => {
                this.totalTests++;
                const testEl = document.createElement('div');
                testEl.className = 'test';

                try {
                    test.fn();
                    testEl.classList.add('pass');
                    testEl.textContent = `✓ ${test.name}`;
                    this.passedTests++;
                } catch (e) {
                    testEl.classList.add('fail');
                    testEl.textContent = `✗ ${test.name}: ${e.message}`;
                }

                suiteEl.appendChild(testEl);
            });

            resultsEl.appendChild(suiteEl);
        });

        this._showSummary();
    },

    _showSummary() {
        const summaryEl = document.getElementById('summary');
        const allPassed = this.passedTests === this.totalTests;
        summaryEl.className = `summary ${allPassed ? 'pass' : 'fail'}`;
        summaryEl.textContent = `${this.passedTests} / ${this.totalTests} tests passed`;
    }
};

// Assertion helpers
function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertRange(value, min, max, message) {
    if (value < min || value > max) {
        throw new Error(message || `Expected ${value} to be between ${min} and ${max}`);
    }
}

// ═══════════════════════════════════════════════
//  TEST SUITES
// ═══════════════════════════════════════════════

// ── Shot Calculator Tests ──────────────────────
TestRunner.suite('Shot Calculator - Driver', ({ test }) => {
    
    test('Average swing produces realistic driver distance', () => {
        const swingData = {
            peakVelocity: 0.10,      // avg golfer reference
            swingPath: 0,            // straight
            tempoRatio: 3.0,         // ideal tempo
            attackAngle: -2,         // slightly descending
            faceAngle: 0,            // square
            confidence: 0.9
        };
        const shot = ShotCalculator.calculate(swingData, 'driver');
        assertRange(shot.carryYards, 220, 260, 'Driver carry should be 220-260 yards for avg golfer');
        assertRange(shot.totalYards, 240, 285, 'Driver total should include roll');
        assertEquals(shot.shotShape, 'Straight', 'Square face + neutral path = straight');
    });

    test('Fast swing produces longer distance', () => {
        const fastSwing = {
            peakVelocity: 0.14,      // 40% faster than avg
            swingPath: 0,
            tempoRatio: 2.8,
            attackAngle: -1,
            faceAngle: 0,
            confidence: 0.95
        };
        const shot = ShotCalculator.calculate(fastSwing, 'driver');
        assert(shot.carryYards > 260, 'Fast swing should carry >260 yards');
        assert(shot.clubHeadSpeed > 95, 'Fast swing should show high CHS');
    });

    test('Slow swing produces shorter distance', () => {
        const slowSwing = {
            peakVelocity: 0.06,      // slower than avg
            swingPath: 0,
            tempoRatio: 3.5,
            attackAngle: -3,
            faceAngle: 0,
            confidence: 0.7
        };
        const shot = ShotCalculator.calculate(slowSwing, 'driver');
        assertRange(shot.carryYards, 150, 220, 'Slow swing should carry 150-220 yards');
        assert(shot.clubHeadSpeed < 85, 'Slow swing should show lower CHS');
    });

    test('Inside-out path produces draw', () => {
        const drawSwing = {
            peakVelocity: 0.10,
            swingPath: 2.5,          // inside-out
            tempoRatio: 3.0,
            attackAngle: -1,
            faceAngle: 1.5,          // slightly closed to path
            confidence: 0.9
        };
        const shot = ShotCalculator.calculate(drawSwing, 'driver');
        assert(shot.shotShape === 'Draw' || shot.shotShape === 'Hook', 'Inside-out with closed face = draw/hook');
    });

    test('Outside-in path produces fade', () => {
        const fadeSwing = {
            peakVelocity: 0.10,
            swingPath: -2.5,         // outside-in
            tempoRatio: 3.0,
            attackAngle: -2,
            faceAngle: -1.5,         // slightly open to path
            confidence: 0.9
        };
        const shot = ShotCalculator.calculate(fadeSwing, 'driver');
        assert(shot.shotShape === 'Fade' || shot.shotShape === 'Slice', 'Outside-in with open face = fade/slice');
    });

    test('Ball speed is lower than club head speed (smash factor)', () => {
        const swing = { peakVelocity: 0.10, swingPath: 0, tempoRatio: 3.0, attackAngle: -1, faceAngle: 0, confidence: 0.9 };
        const shot = ShotCalculator.calculate(swing, 'driver');
        assert(shot.ballSpeed < shot.clubHeadSpeed * 1.5, 'Ball speed must be less than 1.5x CHS');
        assert(shot.ballSpeed > shot.clubHeadSpeed, 'Ball speed should exceed CHS (smash factor > 1)');
    });
});

TestRunner.suite('Shot Calculator - Irons', ({ test }) => {

    test('7-iron produces appropriate distance', () => {
        const swing = {
            peakVelocity: 0.10,
            swingPath: 0,
            tempoRatio: 3.0,
            attackAngle: -4,         // steeper for iron
            faceAngle: 0,
            confidence: 0.9
        };
        const shot = ShotCalculator.calculate(swing, '7i');
        assertRange(shot.carryYards, 140, 165, '7-iron should carry 140-165 yards for avg golfer');
        assertRange(shot.launchAngle, 20, 26, '7-iron launch angle should be higher than driver');
    });

    test('Wedge produces high launch and short distance', () => {
        const swing = {
            peakVelocity: 0.09,
            swingPath: 0,
            tempoRatio: 2.8,
            attackAngle: -5,
            faceAngle: 0,
            confidence: 0.85
        };
        const shot = ShotCalculator.calculate(swing, 'pw');
        assertRange(shot.carryYards, 90, 125, 'PW should carry 90-125 yards');
        assert(shot.launchAngle > 25, 'PW should have high launch angle');
        assertRange(shot.rollFactor, 1.0, 1.02, 'PW should have minimal roll');
    });

    test('Different clubs produce different distances with same swing', () => {
        const swing = { peakVelocity: 0.10, swingPath: 0, tempoRatio: 3.0, attackAngle: -3, faceAngle: 0, confidence: 0.9 };
        const driver = ShotCalculator.calculate(swing, 'driver');
        const sevenIron = ShotCalculator.calculate(swing, '7i');
        const wedge = ShotCalculator.calculate(swing, 'pw');
        
        assert(driver.carryYards > sevenIron.carryYards, 'Driver should go farther than 7-iron');
        assert(sevenIron.carryYards > wedge.carryYards, '7-iron should go farther than PW');
    });
});

TestRunner.suite('Shot Calculator - Tempo', ({ test }) => {

    test('Ideal tempo (3:1) rated as Excellent', () => {
        const swing = { peakVelocity: 0.10, swingPath: 0, tempoRatio: 3.0, attackAngle: -2, faceAngle: 0, confidence: 0.9 };
        const shot = ShotCalculator.calculate(swing, 'driver');
        assertEquals(shot.tempoRating, 'Excellent', 'Tempo 3.0 should be Excellent');
    });

    test('Slightly off tempo (2.2:1) rated as Good', () => {
        const swing = { peakVelocity: 0.10, swingPath: 0, tempoRatio: 2.2, attackAngle: -2, faceAngle: 0, confidence: 0.9 };
        const shot = ShotCalculator.calculate(swing, 'driver');
        assertEquals(shot.tempoRating, 'Good', 'Tempo 2.2 should be Good');
    });

    test('Quick tempo (<2:1) rated as Too Quick', () => {
        const swing = { peakVelocity: 0.10, swingPath: 0, tempoRatio: 1.5, attackAngle: -2, faceAngle: 0, confidence: 0.9 };
        const shot = ShotCalculator.calculate(swing, 'driver');
        assertEquals(shot.tempoRating, 'Too Quick', 'Tempo 1.5 should be Too Quick');
    });

    test('Slow tempo (>4:1) rated as Too Slow', () => {
        const swing = { peakVelocity: 0.10, swingPath: 0, tempoRatio: 4.5, attackAngle: -2, faceAngle: 0, confidence: 0.9 };
        const shot = ShotCalculator.calculate(swing, 'driver');
        assertEquals(shot.tempoRating, 'Too Slow', 'Tempo 4.5 should be Too Slow');
    });
});

TestRunner.suite('Shot Calculator - Edge Cases', ({ test }) => {

    test('Handles invalid club gracefully', () => {
        const swing = { peakVelocity: 0.10, swingPath: 0, tempoRatio: 3.0, attackAngle: -2, faceAngle: 0, confidence: 0.9 };
        const shot = ShotCalculator.calculate(swing, 'invalid-club');
        assertEquals(shot, null, 'Invalid club should return null');
    });

    test('Caps club head speed at realistic max', () => {
        const extremeSwing = { peakVelocity: 0.30, swingPath: 0, tempoRatio: 2.0, attackAngle: 0, faceAngle: 0, confidence: 1.0 };
        const shot = ShotCalculator.calculate(extremeSwing, 'driver');
        assert(shot.clubHeadSpeed <= 145, 'Driver CHS should cap at realistic max (~145 mph)');
    });

    test('Very low velocity still produces valid shot', () => {
        const tinySwing = { peakVelocity: 0.02, swingPath: 0, tempoRatio: 3.0, attackAngle: -2, faceAngle: 0, confidence: 0.5 };
        const shot = ShotCalculator.calculate(tinySwing, '7i');
        assert(shot.carryYards > 0, 'Even tiny swing should produce positive distance');
        assert(shot.clubHeadSpeed > 0, 'CHS should be positive');
    });
});

// Run all tests
document.addEventListener('DOMContentLoaded', () => {
    TestRunner.run();
});

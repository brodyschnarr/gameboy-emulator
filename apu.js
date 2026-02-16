// Audio Processing Unit - Game Boy sound
class APU {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.enabled = false;
        this.muted = false;

        this.sampleRate = 44100;
        this.sampleTimer = 0;
        this.samplePeriod = 0;

        // Channel state
        this.ch1 = { enabled: false, freq: 0, vol: 0, duty: 0, timer: 0, lengthTimer: 0, lengthEnabled: false, envTimer: 0, envDir: 0, envPeriod: 0, envVol: 0, sweepTimer: 0, sweepShift: 0, sweepDir: 0, sweepPeriod: 0, sweepEnabled: false, shadow: 0, pos: 0, phase: 0 };
        this.ch2 = { enabled: false, freq: 0, vol: 0, duty: 0, timer: 0, lengthTimer: 0, lengthEnabled: false, envTimer: 0, envDir: 0, envPeriod: 0, envVol: 0, pos: 0, phase: 0 };
        this.ch3 = { enabled: false, freq: 0, vol: 0, volShift: 0, timer: 0, lengthTimer: 0, lengthEnabled: false, dacEnabled: false, pos: 0, phase: 0 };
        this.ch4 = { enabled: false, vol: 0, timer: 0, lengthTimer: 0, lengthEnabled: false, envTimer: 0, envDir: 0, envPeriod: 0, envVol: 0, lfsr: 0x7FFF, divisor: 0, width: false, clockShift: 0 };

        this.waveRAM = new Uint8Array(16);
        this.masterVol = { left: 7, right: 7 };
        this.panning = 0xFF;
        this.powerOn = false;

        this.frameSequencer = 0;
        this.frameTimer = 0;
        this.cpuClock = 4194304;

        // Ring buffer for audio
        this.ringBuffer = null;
        this.ringSize = 16384;
        this.ringWritePos = 0;
        this.ringReadPos = 0;
    }

    init() {
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = 0.25;
            this.masterGain.connect(this.audioCtx.destination);

            // Use a ring buffer with ScriptProcessor
            this.ringBuffer = new Float32Array(this.ringSize * 2); // stereo
            this.ringWritePos = 0;
            this.ringReadPos = 0;

            this.processor = this.audioCtx.createScriptProcessor(4096, 0, 2);
            this.processor.onaudioprocess = (e) => this.fillBuffer(e);
            this.processor.connect(this.masterGain);

            this.samplePeriod = this.cpuClock / this.sampleRate;
            this.enabled = true;
        } catch (e) {
            console.warn('Audio init failed:', e);
        }
    }

    resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : 0.25;
        }
        return this.muted;
    }

    step(cycles) {
        if (!this.enabled || !this.powerOn) return;

        // Frame sequencer (512 Hz)
        this.frameTimer += cycles;
        while (this.frameTimer >= 8192) {
            this.frameTimer -= 8192;
            this.tickFrameSequencer();
        }

        // Tick channel timers
        this.tickChannelTimers(cycles);

        // Generate samples
        this.sampleTimer += cycles;
        while (this.sampleTimer >= this.samplePeriod) {
            this.sampleTimer -= this.samplePeriod;
            this.generateSample();
        }
    }

    tickChannelTimers(cycles) {
        // Channel 1 & 2 square wave phase
        if (this.ch1.enabled) {
            this.ch1.timer -= cycles;
            while (this.ch1.timer <= 0) {
                this.ch1.timer += (2048 - this.ch1.freq) * 4;
                this.ch1.phase = (this.ch1.phase + 1) & 7;
            }
        }
        if (this.ch2.enabled) {
            this.ch2.timer -= cycles;
            while (this.ch2.timer <= 0) {
                this.ch2.timer += (2048 - this.ch2.freq) * 4;
                this.ch2.phase = (this.ch2.phase + 1) & 7;
            }
        }
        // Channel 3 wave
        if (this.ch3.enabled) {
            this.ch3.timer -= cycles;
            while (this.ch3.timer <= 0) {
                this.ch3.timer += (2048 - this.ch3.freq) * 2;
                this.ch3.phase = (this.ch3.phase + 1) & 31;
            }
        }
        // Channel 4 noise
        if (this.ch4.enabled) {
            this.ch4.timer -= cycles;
            while (this.ch4.timer <= 0) {
                const divisors = [8, 16, 32, 48, 64, 80, 96, 112];
                this.ch4.timer += divisors[this.ch4.divisor] << this.ch4.clockShift;
                // Clock LFSR
                const xor = (this.ch4.lfsr & 1) ^ ((this.ch4.lfsr >> 1) & 1);
                this.ch4.lfsr = (this.ch4.lfsr >> 1) | (xor << 14);
                if (this.ch4.width) {
                    this.ch4.lfsr &= ~(1 << 6);
                    this.ch4.lfsr |= (xor << 6);
                }
            }
        }
    }

    tickFrameSequencer() {
        this.frameSequencer = (this.frameSequencer + 1) % 8;

        if (this.frameSequencer % 2 === 0) {
            this.tickLength(this.ch1);
            this.tickLength(this.ch2);
            this.tickLength(this.ch3);
            this.tickLength(this.ch4);
        }

        if (this.frameSequencer === 7) {
            this.tickEnvelope(this.ch1);
            this.tickEnvelope(this.ch2);
            this.tickEnvelope(this.ch4);
        }

        if (this.frameSequencer === 2 || this.frameSequencer === 6) {
            this.tickSweep();
        }
    }

    tickLength(ch) {
        if (ch.lengthEnabled && ch.lengthTimer > 0) {
            ch.lengthTimer--;
            if (ch.lengthTimer === 0) ch.enabled = false;
        }
    }

    tickEnvelope(ch) {
        if (!ch.envPeriod) return;
        if (ch.envTimer > 0) ch.envTimer--;
        if (ch.envTimer === 0) {
            ch.envTimer = ch.envPeriod || 8;
            if (ch.envDir && ch.vol < 15) ch.vol++;
            else if (!ch.envDir && ch.vol > 0) ch.vol--;
        }
    }

    tickSweep() {
        if (!this.ch1.sweepPeriod && !this.ch1.sweepShift) return;
        if (this.ch1.sweepTimer > 0) this.ch1.sweepTimer--;
        if (this.ch1.sweepTimer === 0) {
            this.ch1.sweepTimer = this.ch1.sweepPeriod || 8;
            if (this.ch1.sweepEnabled && this.ch1.sweepPeriod > 0) {
                const newFreq = this.calcSweep();
                if (newFreq <= 2047 && this.ch1.sweepShift > 0) {
                    this.ch1.freq = newFreq;
                    this.ch1.shadow = newFreq;
                    this.calcSweep();
                }
            }
        }
    }

    calcSweep() {
        let newFreq = this.ch1.shadow >> this.ch1.sweepShift;
        newFreq = this.ch1.sweepDir ? this.ch1.shadow - newFreq : this.ch1.shadow + newFreq;
        if (newFreq > 2047) this.ch1.enabled = false;
        return newFreq;
    }

    generateSample() {
        // Check if buffer has space
        const available = (this.ringWritePos >= this.ringReadPos)
            ? this.ringSize - (this.ringWritePos - this.ringReadPos)
            : this.ringReadPos - this.ringWritePos;
        if (available <= 2) return; // Buffer full

        let left = 0, right = 0;
        const dutyTable = [
            [0, 0, 0, 0, 0, 0, 0, 1], // 12.5%
            [1, 0, 0, 0, 0, 0, 0, 1], // 25%
            [1, 0, 0, 0, 0, 1, 1, 1], // 50%
            [0, 1, 1, 1, 1, 1, 1, 0], // 75%
        ];

        // Channel 1
        if (this.ch1.enabled && this.ch1.vol > 0) {
            const sample = dutyTable[this.ch1.duty][this.ch1.phase] ? (this.ch1.vol / 15) : -(this.ch1.vol / 15);
            if (this.panning & 0x10) left += sample;
            if (this.panning & 0x01) right += sample;
        }

        // Channel 2
        if (this.ch2.enabled && this.ch2.vol > 0) {
            const sample = dutyTable[this.ch2.duty][this.ch2.phase] ? (this.ch2.vol / 15) : -(this.ch2.vol / 15);
            if (this.panning & 0x20) left += sample;
            if (this.panning & 0x02) right += sample;
        }

        // Channel 3
        if (this.ch3.enabled && this.ch3.dacEnabled) {
            const byte = this.waveRAM[this.ch3.phase >> 1];
            let sample = (this.ch3.phase & 1) ? (byte & 0x0F) : (byte >> 4);
            const shift = [4, 0, 1, 2][this.ch3.volShift || 0];
            sample = sample >> shift;
            const normalized = (sample / 7.5) - 1.0;
            if (this.panning & 0x40) left += normalized * 0.5;
            if (this.panning & 0x04) right += normalized * 0.5;
        }

        // Channel 4
        if (this.ch4.enabled && this.ch4.vol > 0) {
            const sample = (this.ch4.lfsr & 1) ? -(this.ch4.vol / 15) : (this.ch4.vol / 15);
            if (this.panning & 0x80) left += sample;
            if (this.panning & 0x08) right += sample;
        }

        left *= (this.masterVol.left + 1) / 32;
        right *= (this.masterVol.right + 1) / 32;

        // Write to ring buffer
        const wp = this.ringWritePos;
        this.ringBuffer[wp * 2] = left;
        this.ringBuffer[wp * 2 + 1] = right;
        this.ringWritePos = (wp + 1) % this.ringSize;
    }

    fillBuffer(e) {
        const outL = e.outputBuffer.getChannelData(0);
        const outR = e.outputBuffer.getChannelData(1);
        const len = outL.length;

        for (let i = 0; i < len; i++) {
            if (this.ringReadPos !== this.ringWritePos) {
                const rp = this.ringReadPos;
                outL[i] = this.ringBuffer[rp * 2];
                outR[i] = this.ringBuffer[rp * 2 + 1];
                this.ringReadPos = (rp + 1) % this.ringSize;
            } else {
                // Underrun - output silence
                outL[i] = 0;
                outR[i] = 0;
            }
        }
    }

    writeRegister(addr, val) {
        switch (addr) {
            case 0xFF10:
                this.ch1.sweepPeriod = (val >> 4) & 7;
                this.ch1.sweepDir = (val >> 3) & 1;
                this.ch1.sweepShift = val & 7;
                break;
            case 0xFF11:
                this.ch1.duty = (val >> 6) & 3;
                this.ch1.lengthTimer = 64 - (val & 0x3F);
                break;
            case 0xFF12:
                this.ch1.envVol = (val >> 4) & 0xF;
                this.ch1.envDir = (val >> 3) & 1;
                this.ch1.envPeriod = val & 7;
                if (!(val & 0xF8)) this.ch1.enabled = false; // DAC off
                break;
            case 0xFF13:
                this.ch1.freq = (this.ch1.freq & 0x700) | val;
                break;
            case 0xFF14:
                this.ch1.freq = (this.ch1.freq & 0xFF) | ((val & 7) << 8);
                this.ch1.lengthEnabled = (val & 0x40) !== 0;
                if (val & 0x80) this.triggerCh1();
                break;
            case 0xFF16:
                this.ch2.duty = (val >> 6) & 3;
                this.ch2.lengthTimer = 64 - (val & 0x3F);
                break;
            case 0xFF17:
                this.ch2.envVol = (val >> 4) & 0xF;
                this.ch2.envDir = (val >> 3) & 1;
                this.ch2.envPeriod = val & 7;
                if (!(val & 0xF8)) this.ch2.enabled = false;
                break;
            case 0xFF18:
                this.ch2.freq = (this.ch2.freq & 0x700) | val;
                break;
            case 0xFF19:
                this.ch2.freq = (this.ch2.freq & 0xFF) | ((val & 7) << 8);
                this.ch2.lengthEnabled = (val & 0x40) !== 0;
                if (val & 0x80) this.triggerCh2();
                break;
            case 0xFF1A:
                this.ch3.dacEnabled = (val & 0x80) !== 0;
                if (!this.ch3.dacEnabled) this.ch3.enabled = false;
                break;
            case 0xFF1B:
                this.ch3.lengthTimer = 256 - val;
                break;
            case 0xFF1C:
                this.ch3.volShift = (val >> 5) & 3;
                break;
            case 0xFF1D:
                this.ch3.freq = (this.ch3.freq & 0x700) | val;
                break;
            case 0xFF1E:
                this.ch3.freq = (this.ch3.freq & 0xFF) | ((val & 7) << 8);
                this.ch3.lengthEnabled = (val & 0x40) !== 0;
                if (val & 0x80) this.triggerCh3();
                break;
            case 0xFF20:
                this.ch4.lengthTimer = 64 - (val & 0x3F);
                break;
            case 0xFF21:
                this.ch4.envVol = (val >> 4) & 0xF;
                this.ch4.envDir = (val >> 3) & 1;
                this.ch4.envPeriod = val & 7;
                if (!(val & 0xF8)) this.ch4.enabled = false;
                break;
            case 0xFF22:
                this.ch4.divisor = val & 7;
                this.ch4.width = (val & 8) !== 0;
                this.ch4.clockShift = (val >> 4) & 0xF;
                break;
            case 0xFF23:
                this.ch4.lengthEnabled = (val & 0x40) !== 0;
                if (val & 0x80) this.triggerCh4();
                break;
            case 0xFF24:
                this.masterVol.left = (val >> 4) & 7;
                this.masterVol.right = val & 7;
                break;
            case 0xFF25:
                this.panning = val;
                break;
            case 0xFF26:
                this.powerOn = (val & 0x80) !== 0;
                if (!this.powerOn) this.resetChannels();
                break;
        }
    }

    resetChannels() {
        this.ch1.enabled = false; this.ch1.vol = 0;
        this.ch2.enabled = false; this.ch2.vol = 0;
        this.ch3.enabled = false;
        this.ch4.enabled = false; this.ch4.vol = 0;
    }

    // Called on state load to reset audio pipeline
    resetBuffer() {
        if (this.ringBuffer) {
            this.ringBuffer.fill(0);
            this.ringWritePos = 0;
            this.ringReadPos = 0;
        }
        this.sampleTimer = 0;
        this.frameTimer = 0;
        this.frameSequencer = 0;

        // Reset channel phase/timers to avoid pops and glitches
        this.ch1.phase = 0; this.ch1.timer = 0; this.ch1.pos = 0;
        this.ch2.phase = 0; this.ch2.timer = 0; this.ch2.pos = 0;
        this.ch3.phase = 0; this.ch3.timer = 0; this.ch3.pos = 0;
        this.ch4.timer = 0; this.ch4.lfsr = 0x7FFF;

        // Briefly mute then restore to prevent pop
        try {
            if (this.masterGain && this.audioCtx && !this.muted) {
                const gain = this.masterGain.gain;
                if (gain.setValueAtTime) {
                    gain.setValueAtTime(0, this.audioCtx.currentTime);
                    gain.linearRampToValueAtTime(0.25, this.audioCtx.currentTime + 0.05);
                }
            }
        } catch(e) {}
    }

    triggerCh1() {
        this.ch1.enabled = true;
        this.ch1.vol = this.ch1.envVol;
        this.ch1.envTimer = this.ch1.envPeriod || 8;
        this.ch1.timer = (2048 - this.ch1.freq) * 4;
        this.ch1.shadow = this.ch1.freq;
        this.ch1.sweepTimer = this.ch1.sweepPeriod || 8;
        this.ch1.sweepEnabled = this.ch1.sweepPeriod > 0 || this.ch1.sweepShift > 0;
        if (this.ch1.sweepShift > 0) this.calcSweep();
        if (this.ch1.lengthTimer === 0) this.ch1.lengthTimer = 64;
    }

    triggerCh2() {
        this.ch2.enabled = true;
        this.ch2.vol = this.ch2.envVol;
        this.ch2.envTimer = this.ch2.envPeriod || 8;
        this.ch2.timer = (2048 - this.ch2.freq) * 4;
        if (this.ch2.lengthTimer === 0) this.ch2.lengthTimer = 64;
    }

    triggerCh3() {
        this.ch3.enabled = this.ch3.dacEnabled;
        this.ch3.phase = 0;
        this.ch3.timer = (2048 - this.ch3.freq) * 2;
        if (this.ch3.lengthTimer === 0) this.ch3.lengthTimer = 256;
    }

    triggerCh4() {
        this.ch4.enabled = true;
        this.ch4.vol = this.ch4.envVol;
        this.ch4.envTimer = this.ch4.envPeriod || 8;
        this.ch4.lfsr = 0x7FFF;
        const divisors = [8, 16, 32, 48, 64, 80, 96, 112];
        this.ch4.timer = divisors[this.ch4.divisor] << this.ch4.clockShift;
        if (this.ch4.lengthTimer === 0) this.ch4.lengthTimer = 64;
    }
}

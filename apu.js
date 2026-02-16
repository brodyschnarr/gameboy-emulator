// Audio Processing Unit - Game Boy sound
class APU {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.enabled = false;
        this.muted = false;

        // We'll use a simple ScriptProcessor/AudioWorklet approach
        this.sampleRate = 44100;
        this.bufferSize = 2048;
        this.sampleTimer = 0;
        this.samplePeriod = 0;

        // Channel state
        this.ch1 = { enabled: false, freq: 0, vol: 0, duty: 0, timer: 0, lengthTimer: 0, envTimer: 0, envDir: 0, sweepTimer: 0, sweepShift: 0, sweepDir: 0, shadow: 0, pos: 0 };
        this.ch2 = { enabled: false, freq: 0, vol: 0, duty: 0, timer: 0, lengthTimer: 0, envTimer: 0, envDir: 0, pos: 0 };
        this.ch3 = { enabled: false, freq: 0, vol: 0, timer: 0, lengthTimer: 0, pos: 0 };
        this.ch4 = { enabled: false, vol: 0, timer: 0, lengthTimer: 0, envTimer: 0, envDir: 0, lfsr: 0x7FFF, divisor: 0, width: false };

        this.waveRAM = new Uint8Array(16);
        this.masterVol = { left: 7, right: 7 };
        this.panning = 0xFF;
        this.powerOn = false;

        this.frameSequencer = 0;
        this.frameTimer = 0;
        this.cpuClock = 4194304;

        // Audio buffer
        this.audioBuffer = [];
        this.maxBufferSize = 8192;
    }

    init() {
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.audioCtx.destination);

            this.processor = this.audioCtx.createScriptProcessor(this.bufferSize, 0, 2);
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
            this.masterGain.gain.value = this.muted ? 0 : 0.3;
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

        // Generate samples
        this.sampleTimer += cycles;
        while (this.sampleTimer >= this.samplePeriod) {
            this.sampleTimer -= this.samplePeriod;
            this.generateSample();
        }
    }

    tickFrameSequencer() {
        this.frameSequencer = (this.frameSequencer + 1) % 8;

        // Length counter at 0, 2, 4, 6
        if (this.frameSequencer % 2 === 0) {
            this.tickLength(this.ch1);
            this.tickLength(this.ch2);
            this.tickLength(this.ch3);
            this.tickLength(this.ch4);
        }

        // Envelope at 7
        if (this.frameSequencer === 7) {
            this.tickEnvelope(this.ch1);
            this.tickEnvelope(this.ch2);
            this.tickEnvelope(this.ch4);
        }

        // Sweep at 2, 6
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
        if (ch.envPeriod === 0) return;
        if (ch.envTimer > 0) ch.envTimer--;
        if (ch.envTimer === 0) {
            ch.envTimer = ch.envPeriod || 8;
            if (ch.envDir && ch.vol < 15) ch.vol++;
            else if (!ch.envDir && ch.vol > 0) ch.vol--;
        }
    }

    tickSweep() {
        if (this.ch1.sweepPeriod === 0) return;
        if (this.ch1.sweepTimer > 0) this.ch1.sweepTimer--;
        if (this.ch1.sweepTimer === 0) {
            this.ch1.sweepTimer = this.ch1.sweepPeriod || 8;
            if (this.ch1.sweepEnabled && this.ch1.sweepPeriod > 0) {
                const newFreq = this.calcSweep();
                if (newFreq <= 2047 && this.ch1.sweepShift > 0) {
                    this.ch1.freq = newFreq;
                    this.ch1.shadow = newFreq;
                    this.calcSweep(); // Overflow check
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
        if (this.audioBuffer.length >= this.maxBufferSize) return;

        let left = 0, right = 0;

        // Channel 1 - Square with sweep
        if (this.ch1.enabled) {
            const duty = [0.125, 0.25, 0.5, 0.75][this.ch1.duty];
            const period = (2048 - this.ch1.freq) * 4;
            this.ch1.pos = (this.ch1.pos + 1) % period;
            const sample = (this.ch1.pos / period < duty ? 1 : -1) * (this.ch1.vol / 15);
            if (this.panning & 0x10) left += sample;
            if (this.panning & 0x01) right += sample;
        }

        // Channel 2 - Square
        if (this.ch2.enabled) {
            const duty = [0.125, 0.25, 0.5, 0.75][this.ch2.duty];
            const period = (2048 - this.ch2.freq) * 4;
            this.ch2.pos = (this.ch2.pos + 1) % period;
            const sample = (this.ch2.pos / period < duty ? 1 : -1) * (this.ch2.vol / 15);
            if (this.panning & 0x20) left += sample;
            if (this.panning & 0x02) right += sample;
        }

        // Channel 3 - Wave
        if (this.ch3.enabled) {
            const period = (2048 - this.ch3.freq) * 2;
            this.ch3.pos = (this.ch3.pos + 1) % period;
            const waveIdx = Math.floor((this.ch3.pos / period) * 32);
            const byte = this.waveRAM[waveIdx >> 1];
            let sample = (waveIdx & 1) ? (byte & 0x0F) : (byte >> 4);
            const shift = [4, 0, 1, 2][this.ch3.volShift || 0];
            sample = (sample >> shift) / 15;
            if (this.panning & 0x40) left += sample;
            if (this.panning & 0x04) right += sample;
        }

        // Channel 4 - Noise
        if (this.ch4.enabled) {
            const sample = (this.ch4.lfsr & 1) ? -1 : 1;
            const vol = sample * (this.ch4.vol / 15);
            if (this.panning & 0x80) left += vol;
            if (this.panning & 0x08) right += vol;
        }

        left *= (this.masterVol.left + 1) / 32;
        right *= (this.masterVol.right + 1) / 32;

        this.audioBuffer.push(left, right);
    }

    fillBuffer(e) {
        const outL = e.outputBuffer.getChannelData(0);
        const outR = e.outputBuffer.getChannelData(1);

        for (let i = 0; i < outL.length; i++) {
            if (this.audioBuffer.length >= 2) {
                outL[i] = this.audioBuffer.shift();
                outR[i] = this.audioBuffer.shift();
            } else {
                outL[i] = 0;
                outR[i] = 0;
            }
        }
    }

    writeRegister(addr, val) {
        switch (addr) {
            // Channel 1
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
                break;
            case 0xFF13:
                this.ch1.freq = (this.ch1.freq & 0x700) | val;
                break;
            case 0xFF14:
                this.ch1.freq = (this.ch1.freq & 0xFF) | ((val & 7) << 8);
                this.ch1.lengthEnabled = (val & 0x40) !== 0;
                if (val & 0x80) this.triggerCh1();
                break;

            // Channel 2
            case 0xFF16:
                this.ch2.duty = (val >> 6) & 3;
                this.ch2.lengthTimer = 64 - (val & 0x3F);
                break;
            case 0xFF17:
                this.ch2.envVol = (val >> 4) & 0xF;
                this.ch2.envDir = (val >> 3) & 1;
                this.ch2.envPeriod = val & 7;
                break;
            case 0xFF18:
                this.ch2.freq = (this.ch2.freq & 0x700) | val;
                break;
            case 0xFF19:
                this.ch2.freq = (this.ch2.freq & 0xFF) | ((val & 7) << 8);
                this.ch2.lengthEnabled = (val & 0x40) !== 0;
                if (val & 0x80) this.triggerCh2();
                break;

            // Channel 3
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

            // Channel 4
            case 0xFF20:
                this.ch4.lengthTimer = 64 - (val & 0x3F);
                break;
            case 0xFF21:
                this.ch4.envVol = (val >> 4) & 0xF;
                this.ch4.envDir = (val >> 3) & 1;
                this.ch4.envPeriod = val & 7;
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

            // Master
            case 0xFF24:
                this.masterVol.left = (val >> 4) & 7;
                this.masterVol.right = val & 7;
                break;
            case 0xFF25:
                this.panning = val;
                break;
            case 0xFF26:
                this.powerOn = (val & 0x80) !== 0;
                break;
        }
    }

    triggerCh1() {
        this.ch1.enabled = true;
        this.ch1.vol = this.ch1.envVol;
        this.ch1.envTimer = this.ch1.envPeriod || 8;
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
        if (this.ch2.lengthTimer === 0) this.ch2.lengthTimer = 64;
    }

    triggerCh3() {
        this.ch3.enabled = this.ch3.dacEnabled;
        this.ch3.pos = 0;
        if (this.ch3.lengthTimer === 0) this.ch3.lengthTimer = 256;
    }

    triggerCh4() {
        this.ch4.enabled = true;
        this.ch4.vol = this.ch4.envVol;
        this.ch4.envTimer = this.ch4.envPeriod || 8;
        this.ch4.lfsr = 0x7FFF;
        if (this.ch4.lengthTimer === 0) this.ch4.lengthTimer = 64;
    }
}

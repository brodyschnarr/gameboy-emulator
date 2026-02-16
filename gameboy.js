// Main Game Boy system - ties everything together
class GameBoy {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.imageData = this.ctx.createImageData(160, 144);

        this.mmu = new MMU();
        this.cpu = new CPU(this.mmu);
        this.ppu = new PPU(this.mmu);
        this.apu = new APU();
        this.timer = new Timer(this.mmu);
        this.joypad = new Joypad(this.mmu);

        this.running = false;
        this.romLoaded = false;
        this.romTitle = '';
        this.animFrameId = null;
        this.lastTime = 0;
        this.cyclesBudget = 0;

        // Wire up MMU callbacks
        this.mmu.onJoypad = () => this.joypad.read();
        this.mmu.onAPU = (addr, val) => this.apu.writeRegister(addr, val);

        // PPU frame callback
        this.ppu.onFrame = (fb) => this.drawFrame(fb);

        // Handle wave RAM
        this.mmu.onTimer = () => {};
    }

    loadROM(data) {
        const rom = new Uint8Array(data);
        this.mmu.loadROM(rom);

        // Read title
        let title = '';
        for (let i = 0x134; i < 0x143; i++) {
            const c = rom[i];
            if (c === 0) break;
            title += String.fromCharCode(c);
        }
        this.romTitle = title.trim();

        // Load battery save
        this.loadBatterySave();

        this.romLoaded = true;
        this.cpu.reset();
        this.apu.init();

        // Init IO registers to post-boot state
        this.mmu.io[0x40] = 0x91; // LCDC - LCD on, BG on, OBJ on
        this.mmu.io[0x41] = 0x85; // STAT
        this.mmu.io[0x47] = 0xFC; // BGP
        this.mmu.io[0x48] = 0xFF; // OBP0
        this.mmu.io[0x49] = 0xFF; // OBP1
        this.mmu.io[0x0F] = 0xE1; // IF
        this.mmu.ie = 0x00;

        console.log(`Loaded: ${this.romTitle} (GBC: ${this.mmu.isGBC}, MBC type: 0x${romData[0x147].toString(16)})`);
    }

    start() {
        if (!this.romLoaded) return;
        this.running = true;
        this.lastTime = performance.now();
        this.cyclesBudget = 0;
        this.apu.resume();
        this.loop(this.lastTime);
    }

    stop() {
        this.running = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    loop(timestamp) {
        if (!this.running) return;

        const elapsed = Math.min(timestamp - this.lastTime, 33.33); // Cap at ~30fps worth
        this.lastTime = timestamp;

        // GBC runs at ~4.194MHz (or ~8.388MHz in double speed)
        const cpuSpeed = this.mmu.doubleSpeed ? 8388608 : 4194304;
        this.cyclesBudget += (elapsed / 1000) * cpuSpeed;

        const maxCycles = cpuSpeed / 30; // Safety cap
        if (this.cyclesBudget > maxCycles) this.cyclesBudget = maxCycles;

        let cyclesRan = 0;
        while (cyclesRan < this.cyclesBudget) {
            const cycles = this.cpu.step();
            const realCycles = this.mmu.doubleSpeed ? cycles / 2 : cycles;

            this.ppu.step(realCycles);
            this.timer.step(cycles);
            this.apu.step(cycles);

            cyclesRan += cycles;

            // Handle speed switch
            if (this.cpu.stopped && this.mmu.prepareSpeed) {
                this.mmu.doubleSpeed = !this.mmu.doubleSpeed;
                this.mmu.prepareSpeed = false;
                this.cpu.stopped = false;
            }
        }

        this.cyclesBudget -= cyclesRan;

        this.animFrameId = requestAnimationFrame((t) => this.loop(t));
    }

    drawFrame(framebuffer) {
        this.imageData.data.set(framebuffer);
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    // Save state
    saveState() {
        const state = {
            cpu: {
                a: this.cpu.a, b: this.cpu.b, c: this.cpu.c, d: this.cpu.d,
                e: this.cpu.e, h: this.cpu.h, l: this.cpu.l,
                sp: this.cpu.sp, pc: this.cpu.pc,
                fZ: this.cpu.fZ, fN: this.cpu.fN, fH: this.cpu.fH, fC: this.cpu.fC,
                ime: this.cpu.ime, halted: this.cpu.halted
            },
            mmu: {
                vram0: Array.from(this.mmu.vram[0]),
                vram1: Array.from(this.mmu.vram[1]),
                wram: this.mmu.wram.map(b => Array.from(b)),
                oam: Array.from(this.mmu.oam),
                hram: Array.from(this.mmu.hram),
                io: Array.from(this.mmu.io),
                ie: this.mmu.ie,
                vramBank: this.mmu.vramBank,
                wramBank: this.mmu.wramBank,
                bgPalette: Array.from(this.mmu.bgPalette),
                objPalette: Array.from(this.mmu.objPalette),
                doubleSpeed: this.mmu.doubleSpeed,
                ram: Array.from(this.mmu.mbc.getRAM())
            },
            ppu: { cycles: this.ppu.cycles, windowLine: this.ppu.windowLine },
            timer: { divCycles: this.timer.divCycles, timaCycles: this.timer.timaCycles }
        };
        return state;
    }

    loadState(state) {
        Object.assign(this.cpu, state.cpu);
        this.mmu.vram[0].set(state.mmu.vram0);
        this.mmu.vram[1].set(state.mmu.vram1);
        state.mmu.wram.forEach((b, i) => this.mmu.wram[i].set(b));
        this.mmu.oam.set(state.mmu.oam);
        this.mmu.hram.set(state.mmu.hram);
        this.mmu.io.set(state.mmu.io);
        this.mmu.ie = state.mmu.ie;
        this.mmu.vramBank = state.mmu.vramBank;
        this.mmu.wramBank = state.mmu.wramBank;
        this.mmu.bgPalette.set(state.mmu.bgPalette);
        this.mmu.objPalette.set(state.mmu.objPalette);
        this.mmu.doubleSpeed = state.mmu.doubleSpeed;
        this.mmu.mbc.setRAM(new Uint8Array(state.mmu.ram));
        this.ppu.cycles = state.ppu.cycles;
        this.ppu.windowLine = state.ppu.windowLine;
        this.timer.divCycles = state.timer.divCycles;
        this.timer.timaCycles = state.timer.timaCycles;
    }

    // Battery save (persists to localStorage)
    saveBatterySave() {
        if (!this.romTitle) return;
        const ram = this.mmu.mbc.getRAM();
        const key = `gbc_sav_${this.romTitle}`;
        localStorage.setItem(key, JSON.stringify(Array.from(ram)));
        console.log(`Battery save: ${this.romTitle}`);
    }

    loadBatterySave() {
        if (!this.romTitle) return;
        const key = `gbc_sav_${this.romTitle}`;
        const data = localStorage.getItem(key);
        if (data) {
            try {
                const ram = new Uint8Array(JSON.parse(data));
                this.mmu.mbc.setRAM(ram);
                console.log(`Loaded save: ${this.romTitle}`);
            } catch (e) {
                console.warn('Failed to load save:', e);
            }
        }
    }
}

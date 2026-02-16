// Game Boy Timer
class Timer {
    constructor(mmu) {
        this.mmu = mmu;
        this.divCycles = 0;
        this.timaCycles = 0;
        this.clockSpeeds = [1024, 16, 64, 256]; // CPU cycles per TIMA tick
    }

    step(cycles) {
        // DIV increments at 16384 Hz (every 256 cycles)
        this.divCycles += cycles;
        while (this.divCycles >= 256) {
            this.divCycles -= 256;
            this.mmu.io[0x04] = (this.mmu.io[0x04] + 1) & 0xFF;
        }

        // TIMA - only if enabled
        const tac = this.mmu.io[0x07];
        if (!(tac & 0x04)) return;

        const speed = this.clockSpeeds[tac & 3];
        this.timaCycles += cycles;
        while (this.timaCycles >= speed) {
            this.timaCycles -= speed;
            const tima = this.mmu.io[0x05] + 1;
            if (tima > 0xFF) {
                this.mmu.io[0x05] = this.mmu.io[0x06]; // Reset to TMA
                this.mmu.io[0x0F] |= 0x04; // Timer interrupt
            } else {
                this.mmu.io[0x05] = tima;
            }
        }
    }
}

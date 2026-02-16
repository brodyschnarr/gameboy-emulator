// Memory Bank Controllers (MBC) - handles cartridge banking
// MBC3 with RTC is critical for Pokémon Gold

class MBCNone {
    constructor(rom, ram) {
        this.rom = rom;
        this.ram = ram || new Uint8Array(0x2000);
        this.ramEnabled = false;
    }
    readROM(addr) { return this.rom[addr] || 0; }
    writeROM(addr, val) {}
    readRAM(addr) { return this.ramEnabled ? (this.ram[addr - 0xA000] || 0) : 0xFF; }
    writeRAM(addr, val) { if (this.ramEnabled) this.ram[addr - 0xA000] = val; }
    getRAM() { return this.ram; }
    setRAM(data) { this.ram.set(data); }
}

class MBC1 {
    constructor(rom, ram) {
        this.rom = rom;
        this.ram = ram || new Uint8Array(0x8000);
        this.ramEnabled = false;
        this.romBank = 1;
        this.ramBank = 0;
        this.bankingMode = 0;
    }
    readROM(addr) {
        if (addr < 0x4000) {
            const bank = this.bankingMode ? (this.ramBank << 5) : 0;
            return this.rom[(bank * 0x4000 + addr) % this.rom.length] || 0;
        }
        let bank = (this.ramBank << 5) | this.romBank;
        return this.rom[(bank * 0x4000 + (addr - 0x4000)) % this.rom.length] || 0;
    }
    writeROM(addr, val) {
        if (addr < 0x2000) {
            this.ramEnabled = (val & 0x0F) === 0x0A;
        } else if (addr < 0x4000) {
            this.romBank = val & 0x1F;
            if (this.romBank === 0) this.romBank = 1;
        } else if (addr < 0x6000) {
            this.ramBank = val & 0x03;
        } else {
            this.bankingMode = val & 1;
        }
    }
    readRAM(addr) {
        if (!this.ramEnabled) return 0xFF;
        const bank = this.bankingMode ? this.ramBank : 0;
        return this.ram[(bank * 0x2000 + (addr - 0xA000)) % this.ram.length] || 0;
    }
    writeRAM(addr, val) {
        if (!this.ramEnabled) return;
        const bank = this.bankingMode ? this.ramBank : 0;
        this.ram[(bank * 0x2000 + (addr - 0xA000)) % this.ram.length] = val;
    }
    getRAM() { return this.ram; }
    setRAM(data) { this.ram.set(data); }
}

class MBC3 {
    constructor(rom, ram) {
        this.rom = rom;
        this.ram = ram || new Uint8Array(0x8000);
        this.ramEnabled = false;
        this.romBank = 1;
        this.ramBank = 0;
        this.rtcMapped = false;

        // RTC registers
        this.rtcS = 0; this.rtcM = 0; this.rtcH = 0;
        this.rtcDL = 0; this.rtcDH = 0;
        // Latched values
        this.rtcLatchedS = 0; this.rtcLatchedM = 0; this.rtcLatchedH = 0;
        this.rtcLatchedDL = 0; this.rtcLatchedDH = 0;
        this.latchPrev = 0xFF;
        this.rtcLastTime = Date.now();
    }

    updateRTC() {
        const now = Date.now();
        let elapsed = Math.floor((now - this.rtcLastTime) / 1000);
        this.rtcLastTime = now;
        if (this.rtcDH & 0x40) return; // Halt flag

        this.rtcS += elapsed;
        while (this.rtcS >= 60) { this.rtcS -= 60; this.rtcM++; }
        while (this.rtcM >= 60) { this.rtcM -= 60; this.rtcH++; }
        while (this.rtcH >= 24) {
            this.rtcH -= 24;
            let days = this.rtcDL | ((this.rtcDH & 1) << 8);
            days++;
            if (days > 511) { this.rtcDH |= 0x80; days = 0; } // Overflow
            this.rtcDL = days & 0xFF;
            this.rtcDH = (this.rtcDH & 0xFE) | ((days >> 8) & 1);
        }
    }

    readROM(addr) {
        if (addr < 0x4000) return this.rom[addr] || 0;
        const bank = this.romBank || 1;
        return this.rom[(bank * 0x4000 + (addr - 0x4000)) % this.rom.length] || 0;
    }

    writeROM(addr, val) {
        if (addr < 0x2000) {
            this.ramEnabled = (val & 0x0F) === 0x0A;
        } else if (addr < 0x4000) {
            this.romBank = val & 0x7F;
            if (this.romBank === 0) this.romBank = 1;
        } else if (addr < 0x6000) {
            if (val <= 0x03) {
                this.ramBank = val;
                this.rtcMapped = false;
            } else if (val >= 0x08 && val <= 0x0C) {
                this.ramBank = val;
                this.rtcMapped = true;
            }
        } else {
            // Latch clock data
            if (this.latchPrev === 0x00 && val === 0x01) {
                this.updateRTC();
                this.rtcLatchedS = this.rtcS;
                this.rtcLatchedM = this.rtcM;
                this.rtcLatchedH = this.rtcH;
                this.rtcLatchedDL = this.rtcDL;
                this.rtcLatchedDH = this.rtcDH;
            }
            this.latchPrev = val;
        }
    }

    readRAM(addr) {
        if (!this.ramEnabled) return 0xFF;
        if (this.rtcMapped) {
            switch (this.ramBank) {
                case 0x08: return this.rtcLatchedS;
                case 0x09: return this.rtcLatchedM;
                case 0x0A: return this.rtcLatchedH;
                case 0x0B: return this.rtcLatchedDL;
                case 0x0C: return this.rtcLatchedDH;
            }
            return 0xFF;
        }
        return this.ram[(this.ramBank * 0x2000 + (addr - 0xA000)) % this.ram.length] || 0;
    }

    writeRAM(addr, val) {
        if (!this.ramEnabled) return;
        if (this.rtcMapped) {
            switch (this.ramBank) {
                case 0x08: this.rtcS = val; break;
                case 0x09: this.rtcM = val; break;
                case 0x0A: this.rtcH = val; break;
                case 0x0B: this.rtcDL = val; break;
                case 0x0C: this.rtcDH = val; break;
            }
            return;
        }
        this.ram[(this.ramBank * 0x2000 + (addr - 0xA000)) % this.ram.length] = val;
    }

    getRAM() { return this.ram; }
    setRAM(data) { this.ram.set(data); }
}

class MBC5 {
    constructor(rom, ram) {
        this.rom = rom;
        this.ram = ram || new Uint8Array(0x20000);
        this.ramEnabled = false;
        this.romBank = 1;
        this.romBankHi = 0;
        this.ramBank = 0;
    }
    readROM(addr) {
        if (addr < 0x4000) return this.rom[addr] || 0;
        const bank = this.romBank | (this.romBankHi << 8);
        return this.rom[(bank * 0x4000 + (addr - 0x4000)) % this.rom.length] || 0;
    }
    writeROM(addr, val) {
        if (addr < 0x2000) {
            this.ramEnabled = (val & 0x0F) === 0x0A;
        } else if (addr < 0x3000) {
            this.romBank = val;
        } else if (addr < 0x4000) {
            this.romBankHi = val & 1;
        } else if (addr < 0x6000) {
            this.ramBank = val & 0x0F;
        }
    }
    readRAM(addr) {
        if (!this.ramEnabled) return 0xFF;
        return this.ram[(this.ramBank * 0x2000 + (addr - 0xA000)) % this.ram.length] || 0;
    }
    writeRAM(addr, val) {
        if (!this.ramEnabled) return;
        this.ram[(this.ramBank * 0x2000 + (addr - 0xA000)) % this.ram.length] = val;
    }
    getRAM() { return this.ram; }
    setRAM(data) { this.ram.set(data); }
}

function createMBC(rom) {
    const type = rom[0x147];
    const ramSizeCode = rom[0x149];
    let ramSize = 0;
    switch (ramSizeCode) {
        case 1: ramSize = 0x800; break;
        case 2: ramSize = 0x2000; break;
        case 3: ramSize = 0x8000; break;
        case 4: ramSize = 0x20000; break;
        case 5: ramSize = 0x10000; break;
    }
    const ram = ramSize > 0 ? new Uint8Array(ramSize) : new Uint8Array(0x2000);

    switch (type) {
        case 0x00: return new MBCNone(rom, ram);
        case 0x01: case 0x02: case 0x03: return new MBC1(rom, ram);
        case 0x0F: case 0x10: case 0x11: case 0x12: case 0x13: return new MBC3(rom, ram);
        case 0x19: case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E: return new MBC5(rom, ram);
        default:
            console.warn(`Unknown MBC type: 0x${type.toString(16)}, using MBC3`);
            return new MBC3(rom, ram);
    }
}

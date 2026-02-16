// Memory Management Unit - maps the full 64KB address space
class MMU {
    constructor() {
        this.mbc = null;
        this.vram = [new Uint8Array(0x2000), new Uint8Array(0x2000)]; // 2 banks for GBC
        this.wram = new Array(8).fill(null).map(() => new Uint8Array(0x1000));
        this.oam = new Uint8Array(0xA0);
        this.hram = new Uint8Array(0x7F);
        this.io = new Uint8Array(0x80);

        // GBC registers
        this.vramBank = 0;
        this.wramBank = 1;
        this.isGBC = false;

        // DMA
        this.dmaActive = false;
        this.dmaSource = 0;

        // HDMA (GBC)
        this.hdmaSrc = 0;
        this.hdmaDst = 0;
        this.hdmaLength = 0;
        this.hdmaActive = false;
        this.hdmaHblank = false;

        // Palette (GBC)
        this.bgPalette = new Uint8Array(64);
        this.objPalette = new Uint8Array(64);
        this.bgPaletteIdx = 0;
        this.bgPaletteInc = false;
        this.objPaletteIdx = 0;
        this.objPaletteInc = false;

        // Speed switch (GBC)
        this.doubleSpeed = false;
        this.prepareSpeed = false;

        // Callbacks
        this.onTimer = null;
        this.onJoypad = null;
        this.onPPU = null;
        this.onAPU = null;

        this.ie = 0; // Interrupt enable at 0xFFFF
    }

    loadROM(romData) {
        this.mbc = createMBC(romData);
        this.isGBC = (romData[0x143] & 0x80) !== 0;
    }

    rb(addr) {
        addr &= 0xFFFF;

        // ROM
        if (addr < 0x8000) return this.mbc.readROM(addr);

        // VRAM
        if (addr < 0xA000) return this.vram[this.vramBank][addr - 0x8000];

        // External RAM
        if (addr < 0xC000) return this.mbc.readRAM(addr);

        // WRAM bank 0
        if (addr < 0xD000) return this.wram[0][addr - 0xC000];

        // WRAM bank 1-7
        if (addr < 0xE000) return this.wram[this.wramBank][addr - 0xD000];

        // Echo RAM
        if (addr < 0xFE00) return this.rb(addr - 0x2000);

        // OAM
        if (addr < 0xFEA0) return this.oam[addr - 0xFE00];

        // Unusable
        if (addr < 0xFF00) return 0xFF;

        // IO registers
        if (addr < 0xFF80) return this.readIO(addr);

        // HRAM
        if (addr < 0xFFFF) return this.hram[addr - 0xFF80];

        // IE
        return this.ie;
    }

    wb(addr, val) {
        addr &= 0xFFFF;
        val &= 0xFF;

        if (addr < 0x8000) { this.mbc.writeROM(addr, val); return; }
        if (addr < 0xA000) { this.vram[this.vramBank][addr - 0x8000] = val; return; }
        if (addr < 0xC000) { this.mbc.writeRAM(addr, val); return; }
        if (addr < 0xD000) { this.wram[0][addr - 0xC000] = val; return; }
        if (addr < 0xE000) { this.wram[this.wramBank][addr - 0xD000] = val; return; }
        if (addr < 0xFE00) { this.wb(addr - 0x2000, val); return; }
        if (addr < 0xFEA0) { this.oam[addr - 0xFE00] = val; return; }
        if (addr < 0xFF00) return; // Unusable
        if (addr < 0xFF80) { this.writeIO(addr, val); return; }
        if (addr < 0xFFFF) { this.hram[addr - 0xFF80] = val; return; }
        this.ie = val;
    }

    readIO(addr) {
        switch (addr) {
            case 0xFF00: return this.onJoypad ? this.onJoypad() : 0xFF;
            case 0xFF04: return this.io[0x04]; // DIV
            case 0xFF05: return this.io[0x05]; // TIMA
            case 0xFF06: return this.io[0x06]; // TMA
            case 0xFF07: return this.io[0x07]; // TAC
            case 0xFF0F: return this.io[0x0F]; // IF
            case 0xFF40: return this.io[0x40]; // LCDC
            case 0xFF41: return this.io[0x41]; // STAT
            case 0xFF42: return this.io[0x42]; // SCY
            case 0xFF43: return this.io[0x43]; // SCX
            case 0xFF44: return this.io[0x44]; // LY
            case 0xFF45: return this.io[0x45]; // LYC
            case 0xFF46: return this.io[0x46]; // DMA
            case 0xFF47: return this.io[0x47]; // BGP
            case 0xFF48: return this.io[0x48]; // OBP0
            case 0xFF49: return this.io[0x49]; // OBP1
            case 0xFF4A: return this.io[0x4A]; // WY
            case 0xFF4B: return this.io[0x4B]; // WX
            case 0xFF4D: return (this.doubleSpeed ? 0x80 : 0) | (this.prepareSpeed ? 1 : 0); // KEY1
            case 0xFF4F: return this.vramBank; // VBK
            case 0xFF55: return this.hdmaActive ? (this.hdmaLength - 1) : 0xFF; // HDMA5
            case 0xFF68: return this.bgPaletteIdx | (this.bgPaletteInc ? 0x80 : 0); // BCPS
            case 0xFF69: return this.bgPalette[this.bgPaletteIdx & 0x3F]; // BCPD
            case 0xFF6A: return this.objPaletteIdx | (this.objPaletteInc ? 0x80 : 0); // OCPS
            case 0xFF6B: return this.objPalette[this.objPaletteIdx & 0x3F]; // OCPD
            case 0xFF70: return this.wramBank; // SVBK
            default: return this.io[addr - 0xFF00] || 0xFF;
        }
    }

    writeIO(addr, val) {
        switch (addr) {
            case 0xFF00: // Joypad
                this.io[0x00] = val & 0x30;
                break;
            case 0xFF04: // DIV - reset on write
                this.io[0x04] = 0;
                if (this.onTimer) this.onTimer('div');
                break;
            case 0xFF05: this.io[0x05] = val; break; // TIMA
            case 0xFF06: this.io[0x06] = val; break; // TMA
            case 0xFF07: this.io[0x07] = val; break; // TAC
            case 0xFF0F: this.io[0x0F] = val; break; // IF
            case 0xFF10: case 0xFF11: case 0xFF12: case 0xFF13: case 0xFF14:
            case 0xFF16: case 0xFF17: case 0xFF18: case 0xFF19:
            case 0xFF1A: case 0xFF1B: case 0xFF1C: case 0xFF1D: case 0xFF1E:
            case 0xFF20: case 0xFF21: case 0xFF22: case 0xFF23:
            case 0xFF24: case 0xFF25: case 0xFF26:
                this.io[addr - 0xFF00] = val;
                if (this.onAPU) this.onAPU(addr, val);
                break;
            case 0xFF30: case 0xFF31: case 0xFF32: case 0xFF33:
            case 0xFF34: case 0xFF35: case 0xFF36: case 0xFF37:
            case 0xFF38: case 0xFF39: case 0xFF3A: case 0xFF3B:
            case 0xFF3C: case 0xFF3D: case 0xFF3E: case 0xFF3F:
                this.io[addr - 0xFF00] = val;
                break;
            case 0xFF40: // LCDC
                this.io[0x40] = val;
                break;
            case 0xFF41: // STAT - bits 0-2 read only
                this.io[0x41] = (this.io[0x41] & 0x07) | (val & 0xF8);
                break;
            case 0xFF42: this.io[0x42] = val; break; // SCY
            case 0xFF43: this.io[0x43] = val; break; // SCX
            case 0xFF44: break; // LY - read only
            case 0xFF45: this.io[0x45] = val; break; // LYC
            case 0xFF46: // OAM DMA
                this.io[0x46] = val;
                this.dmaTransfer(val);
                break;
            case 0xFF47: this.io[0x47] = val; break; // BGP
            case 0xFF48: this.io[0x48] = val; break; // OBP0
            case 0xFF49: this.io[0x49] = val; break; // OBP1
            case 0xFF4A: this.io[0x4A] = val; break; // WY
            case 0xFF4B: this.io[0x4B] = val; break; // WX
            case 0xFF4D: // KEY1 - speed switch
                this.prepareSpeed = (val & 1) !== 0;
                break;
            case 0xFF4F: // VBK - VRAM bank
                this.vramBank = val & 1;
                break;
            case 0xFF51: this.hdmaSrc = (this.hdmaSrc & 0x00FF) | (val << 8); break;
            case 0xFF52: this.hdmaSrc = (this.hdmaSrc & 0xFF00) | (val & 0xF0); break;
            case 0xFF53: this.hdmaDst = (this.hdmaDst & 0x00FF) | ((val & 0x1F) << 8); break;
            case 0xFF54: this.hdmaDst = (this.hdmaDst & 0xFF00) | (val & 0xF0); break;
            case 0xFF55: // HDMA5 - start HDMA
                if (this.hdmaActive && !(val & 0x80)) {
                    this.hdmaActive = false;
                } else {
                    this.hdmaLength = (val & 0x7F) + 1;
                    this.hdmaHblank = (val & 0x80) !== 0;
                    this.hdmaActive = true;
                    if (!this.hdmaHblank) this.doHDMA();
                }
                break;
            case 0xFF68: // BCPS
                this.bgPaletteIdx = val & 0x3F;
                this.bgPaletteInc = (val & 0x80) !== 0;
                break;
            case 0xFF69: // BCPD
                this.bgPalette[this.bgPaletteIdx & 0x3F] = val;
                if (this.bgPaletteInc) this.bgPaletteIdx = (this.bgPaletteIdx + 1) & 0x3F;
                break;
            case 0xFF6A: // OCPS
                this.objPaletteIdx = val & 0x3F;
                this.objPaletteInc = (val & 0x80) !== 0;
                break;
            case 0xFF6B: // OCPD
                this.objPalette[this.objPaletteIdx & 0x3F] = val;
                if (this.objPaletteInc) this.objPaletteIdx = (this.objPaletteIdx + 1) & 0x3F;
                break;
            case 0xFF70: // SVBK
                this.wramBank = val & 7;
                if (this.wramBank === 0) this.wramBank = 1;
                break;
            default:
                this.io[addr - 0xFF00] = val;
        }
    }

    dmaTransfer(val) {
        const src = val << 8;
        for (let i = 0; i < 0xA0; i++) {
            this.oam[i] = this.rb(src + i);
        }
    }

    doHDMA() {
        const blocks = this.hdmaLength;
        for (let i = 0; i < blocks * 16; i++) {
            this.vram[this.vramBank][(this.hdmaDst + i) & 0x1FFF] = this.rb(this.hdmaSrc + i);
        }
        this.hdmaSrc += blocks * 16;
        this.hdmaDst += blocks * 16;
        this.hdmaLength = 0;
        this.hdmaActive = false;
    }

    doHDMABlock() {
        if (!this.hdmaActive || !this.hdmaHblank) return;
        for (let i = 0; i < 16; i++) {
            this.vram[this.vramBank][(this.hdmaDst + i) & 0x1FFF] = this.rb(this.hdmaSrc + i);
        }
        this.hdmaSrc += 16;
        this.hdmaDst += 16;
        this.hdmaLength--;
        if (this.hdmaLength <= 0) this.hdmaActive = false;
    }
}

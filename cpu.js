// Game Boy Color CPU - Sharp LR35902 (Z80-like)
class CPU {
    constructor(mmu) {
        this.mmu = mmu;
        this.reset();
    }

    reset() {
        // Registers
        this.a = 0x11; // GBC mode
        this.b = 0x00;
        this.c = 0x13;
        this.d = 0x00;
        this.e = 0xD8;
        this.h = 0x01;
        this.l = 0x4D;
        this.sp = 0xFFFE;
        this.pc = 0x0100;

        // Flags
        this.fZ = 1; this.fN = 0; this.fH = 1; this.fC = 1;

        this.ime = false;    // Interrupt master enable
        this.halted = false;
        this.haltBug = false;
        this.eiPending = false;
        this.cycles = 0;
        this.stopped = false;
    }

    get f() {
        return (this.fZ << 7) | (this.fN << 6) | (this.fH << 5) | (this.fC << 4);
    }
    set f(v) {
        this.fZ = (v >> 7) & 1;
        this.fN = (v >> 6) & 1;
        this.fH = (v >> 5) & 1;
        this.fC = (v >> 4) & 1;
    }

    get af() { return (this.a << 8) | this.f; }
    set af(v) { this.a = (v >> 8) & 0xFF; this.f = v & 0xFF; }
    get bc() { return (this.b << 8) | this.c; }
    set bc(v) { this.b = (v >> 8) & 0xFF; this.c = v & 0xFF; }
    get de() { return (this.d << 8) | this.e; }
    set de(v) { this.d = (v >> 8) & 0xFF; this.e = v & 0xFF; }
    get hl() { return (this.h << 8) | this.l; }
    set hl(v) { this.h = (v >> 8) & 0xFF; this.l = v & 0xFF; }

    rb(addr) { return this.mmu.rb(addr); }
    wb(addr, val) { this.mmu.wb(addr, val); }
    rw(addr) { return this.rb(addr) | (this.rb(addr + 1) << 8); }
    ww(addr, val) { this.wb(addr, val & 0xFF); this.wb(addr + 1, (val >> 8) & 0xFF); }

    // Read next byte/word at PC
    nextByte() {
        const v = this.rb(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        return v;
    }
    nextWord() {
        const lo = this.nextByte();
        const hi = this.nextByte();
        return (hi << 8) | lo;
    }

    push(val) {
        this.sp = (this.sp - 2) & 0xFFFF;
        this.ww(this.sp, val);
    }
    pop() {
        const val = this.rw(this.sp);
        this.sp = (this.sp + 2) & 0xFFFF;
        return val;
    }

    // Handle interrupts
    handleInterrupts() {
        if (!this.ime && !this.halted) return 0;
        const ie = this.rb(0xFFFF);
        const iflag = this.rb(0xFF0F);
        const pending = ie & iflag & 0x1F;
        if (pending === 0) return 0;

        this.halted = false;
        if (!this.ime) return 0;
        this.ime = false;

        // Priority: VBlank, LCD STAT, Timer, Serial, Joypad
        for (let i = 0; i < 5; i++) {
            if (pending & (1 << i)) {
                this.wb(0xFF0F, iflag & ~(1 << i));
                this.push(this.pc);
                this.pc = 0x0040 + (i * 8);
                return 20;
            }
        }
        return 0;
    }

    step() {
        let cycles = 0;

        // Handle interrupts
        cycles += this.handleInterrupts();

        if (this.halted) {
            return cycles + 4;
        }

        if (this.eiPending) {
            this.ime = true;
            this.eiPending = false;
        }

        const pc = this.pc;
        let op = this.nextByte();
        if (this.haltBug) {
            this.pc = pc; // Re-read the byte
            this.haltBug = false;
        }

        cycles += this.execute(op);
        return cycles;
    }

    execute(op) {
        switch (op) {
            // NOP
            case 0x00: return 4;
            // LD BC,nn
            case 0x01: this.bc = this.nextWord(); return 12;
            // LD (BC),A
            case 0x02: this.wb(this.bc, this.a); return 8;
            // INC BC
            case 0x03: this.bc = (this.bc + 1) & 0xFFFF; return 8;
            // INC B
            case 0x04: this.b = this.inc8(this.b); return 4;
            // DEC B
            case 0x05: this.b = this.dec8(this.b); return 4;
            // LD B,n
            case 0x06: this.b = this.nextByte(); return 8;
            // RLCA
            case 0x07: {
                this.fC = (this.a >> 7) & 1;
                this.a = ((this.a << 1) | this.fC) & 0xFF;
                this.fZ = 0; this.fN = 0; this.fH = 0;
                return 4;
            }
            // LD (nn),SP
            case 0x08: { const addr = this.nextWord(); this.ww(addr, this.sp); return 20; }
            // ADD HL,BC
            case 0x09: this.addHL(this.bc); return 8;
            // LD A,(BC)
            case 0x0A: this.a = this.rb(this.bc); return 8;
            // DEC BC
            case 0x0B: this.bc = (this.bc - 1) & 0xFFFF; return 8;
            // INC C
            case 0x0C: this.c = this.inc8(this.c); return 4;
            // DEC C
            case 0x0D: this.c = this.dec8(this.c); return 4;
            // LD C,n
            case 0x0E: this.c = this.nextByte(); return 8;
            // RRCA
            case 0x0F: {
                this.fC = this.a & 1;
                this.a = ((this.a >> 1) | (this.fC << 7)) & 0xFF;
                this.fZ = 0; this.fN = 0; this.fH = 0;
                return 4;
            }

            // STOP
            case 0x10: this.nextByte(); this.stopped = true; return 4;
            // LD DE,nn
            case 0x11: this.de = this.nextWord(); return 12;
            // LD (DE),A
            case 0x12: this.wb(this.de, this.a); return 8;
            // INC DE
            case 0x13: this.de = (this.de + 1) & 0xFFFF; return 8;
            // INC D
            case 0x14: this.d = this.inc8(this.d); return 4;
            // DEC D
            case 0x15: this.d = this.dec8(this.d); return 4;
            // LD D,n
            case 0x16: this.d = this.nextByte(); return 8;
            // RLA
            case 0x17: {
                const oldC = this.fC;
                this.fC = (this.a >> 7) & 1;
                this.a = ((this.a << 1) | oldC) & 0xFF;
                this.fZ = 0; this.fN = 0; this.fH = 0;
                return 4;
            }
            // JR n
            case 0x18: { const n = this.signedByte(this.nextByte()); this.pc = (this.pc + n) & 0xFFFF; return 12; }
            // ADD HL,DE
            case 0x19: this.addHL(this.de); return 8;
            // LD A,(DE)
            case 0x1A: this.a = this.rb(this.de); return 8;
            // DEC DE
            case 0x1B: this.de = (this.de - 1) & 0xFFFF; return 8;
            // INC E
            case 0x1C: this.e = this.inc8(this.e); return 4;
            // DEC E
            case 0x1D: this.e = this.dec8(this.e); return 4;
            // LD E,n
            case 0x1E: this.e = this.nextByte(); return 8;
            // RRA
            case 0x1F: {
                const oldC = this.fC;
                this.fC = this.a & 1;
                this.a = ((this.a >> 1) | (oldC << 7)) & 0xFF;
                this.fZ = 0; this.fN = 0; this.fH = 0;
                return 4;
            }

            // JR NZ,n
            case 0x20: { const n = this.signedByte(this.nextByte()); if (!this.fZ) { this.pc = (this.pc + n) & 0xFFFF; return 12; } return 8; }
            // LD HL,nn
            case 0x21: this.hl = this.nextWord(); return 12;
            // LD (HL+),A
            case 0x22: this.wb(this.hl, this.a); this.hl = (this.hl + 1) & 0xFFFF; return 8;
            // INC HL
            case 0x23: this.hl = (this.hl + 1) & 0xFFFF; return 8;
            // INC H
            case 0x24: this.h = this.inc8(this.h); return 4;
            // DEC H
            case 0x25: this.h = this.dec8(this.h); return 4;
            // LD H,n
            case 0x26: this.h = this.nextByte(); return 8;
            // DAA
            case 0x27: {
                let a = this.a;
                if (!this.fN) {
                    if (this.fH || (a & 0x0F) > 9) a += 0x06;
                    if (this.fC || a > 0x9F) { a += 0x60; this.fC = 1; }
                } else {
                    if (this.fH) a = (a - 6) & 0xFF;
                    if (this.fC) a = (a - 0x60) & 0xFF;
                }
                this.a = a & 0xFF;
                this.fZ = this.a === 0 ? 1 : 0;
                this.fH = 0;
                return 4;
            }
            // JR Z,n
            case 0x28: { const n = this.signedByte(this.nextByte()); if (this.fZ) { this.pc = (this.pc + n) & 0xFFFF; return 12; } return 8; }
            // ADD HL,HL
            case 0x29: this.addHL(this.hl); return 8;
            // LD A,(HL+)
            case 0x2A: this.a = this.rb(this.hl); this.hl = (this.hl + 1) & 0xFFFF; return 8;
            // DEC HL
            case 0x2B: this.hl = (this.hl - 1) & 0xFFFF; return 8;
            // INC L
            case 0x2C: this.l = this.inc8(this.l); return 4;
            // DEC L
            case 0x2D: this.l = this.dec8(this.l); return 4;
            // LD L,n
            case 0x2E: this.l = this.nextByte(); return 8;
            // CPL
            case 0x2F: this.a = (~this.a) & 0xFF; this.fN = 1; this.fH = 1; return 4;

            // JR NC,n
            case 0x30: { const n = this.signedByte(this.nextByte()); if (!this.fC) { this.pc = (this.pc + n) & 0xFFFF; return 12; } return 8; }
            // LD SP,nn
            case 0x31: this.sp = this.nextWord(); return 12;
            // LD (HL-),A
            case 0x32: this.wb(this.hl, this.a); this.hl = (this.hl - 1) & 0xFFFF; return 8;
            // INC SP
            case 0x33: this.sp = (this.sp + 1) & 0xFFFF; return 8;
            // INC (HL)
            case 0x34: this.wb(this.hl, this.inc8(this.rb(this.hl))); return 12;
            // DEC (HL)
            case 0x35: this.wb(this.hl, this.dec8(this.rb(this.hl))); return 12;
            // LD (HL),n
            case 0x36: this.wb(this.hl, this.nextByte()); return 12;
            // SCF
            case 0x37: this.fN = 0; this.fH = 0; this.fC = 1; return 4;
            // JR C,n
            case 0x38: { const n = this.signedByte(this.nextByte()); if (this.fC) { this.pc = (this.pc + n) & 0xFFFF; return 12; } return 8; }
            // ADD HL,SP
            case 0x39: this.addHL(this.sp); return 8;
            // LD A,(HL-)
            case 0x3A: this.a = this.rb(this.hl); this.hl = (this.hl - 1) & 0xFFFF; return 8;
            // DEC SP
            case 0x3B: this.sp = (this.sp - 1) & 0xFFFF; return 8;
            // INC A
            case 0x3C: this.a = this.inc8(this.a); return 4;
            // DEC A
            case 0x3D: this.a = this.dec8(this.a); return 4;
            // LD A,n
            case 0x3E: this.a = this.nextByte(); return 8;
            // CCF
            case 0x3F: this.fC = this.fC ? 0 : 1; this.fN = 0; this.fH = 0; return 4;

            // LD B,r
            case 0x40: return 4; // LD B,B
            case 0x41: this.b = this.c; return 4;
            case 0x42: this.b = this.d; return 4;
            case 0x43: this.b = this.e; return 4;
            case 0x44: this.b = this.h; return 4;
            case 0x45: this.b = this.l; return 4;
            case 0x46: this.b = this.rb(this.hl); return 8;
            case 0x47: this.b = this.a; return 4;
            // LD C,r
            case 0x48: this.c = this.b; return 4;
            case 0x49: return 4;
            case 0x4A: this.c = this.d; return 4;
            case 0x4B: this.c = this.e; return 4;
            case 0x4C: this.c = this.h; return 4;
            case 0x4D: this.c = this.l; return 4;
            case 0x4E: this.c = this.rb(this.hl); return 8;
            case 0x4F: this.c = this.a; return 4;
            // LD D,r
            case 0x50: this.d = this.b; return 4;
            case 0x51: this.d = this.c; return 4;
            case 0x52: return 4;
            case 0x53: this.d = this.e; return 4;
            case 0x54: this.d = this.h; return 4;
            case 0x55: this.d = this.l; return 4;
            case 0x56: this.d = this.rb(this.hl); return 8;
            case 0x57: this.d = this.a; return 4;
            // LD E,r
            case 0x58: this.e = this.b; return 4;
            case 0x59: this.e = this.c; return 4;
            case 0x5A: this.e = this.d; return 4;
            case 0x5B: return 4;
            case 0x5C: this.e = this.h; return 4;
            case 0x5D: this.e = this.l; return 4;
            case 0x5E: this.e = this.rb(this.hl); return 8;
            case 0x5F: this.e = this.a; return 4;
            // LD H,r
            case 0x60: this.h = this.b; return 4;
            case 0x61: this.h = this.c; return 4;
            case 0x62: this.h = this.d; return 4;
            case 0x63: this.h = this.e; return 4;
            case 0x64: return 4;
            case 0x65: this.h = this.l; return 4;
            case 0x66: this.h = this.rb(this.hl); return 8;
            case 0x67: this.h = this.a; return 4;
            // LD L,r
            case 0x68: this.l = this.b; return 4;
            case 0x69: this.l = this.c; return 4;
            case 0x6A: this.l = this.d; return 4;
            case 0x6B: this.l = this.e; return 4;
            case 0x6C: this.l = this.h; return 4;
            case 0x6D: return 4;
            case 0x6E: this.l = this.rb(this.hl); return 8;
            case 0x6F: this.l = this.a; return 4;
            // LD (HL),r
            case 0x70: this.wb(this.hl, this.b); return 8;
            case 0x71: this.wb(this.hl, this.c); return 8;
            case 0x72: this.wb(this.hl, this.d); return 8;
            case 0x73: this.wb(this.hl, this.e); return 8;
            case 0x74: this.wb(this.hl, this.h); return 8;
            case 0x75: this.wb(this.hl, this.l); return 8;
            // HALT
            case 0x76: {
                if (this.ime) {
                    this.halted = true;
                } else {
                    const ie = this.rb(0xFFFF);
                    const iflag = this.rb(0xFF0F);
                    if (ie & iflag & 0x1F) {
                        this.haltBug = true;
                    } else {
                        this.halted = true;
                    }
                }
                return 4;
            }
            case 0x77: this.wb(this.hl, this.a); return 8;
            // LD A,r
            case 0x78: this.a = this.b; return 4;
            case 0x79: this.a = this.c; return 4;
            case 0x7A: this.a = this.d; return 4;
            case 0x7B: this.a = this.e; return 4;
            case 0x7C: this.a = this.h; return 4;
            case 0x7D: this.a = this.l; return 4;
            case 0x7E: this.a = this.rb(this.hl); return 8;
            case 0x7F: return 4;

            // ADD A,r
            case 0x80: this.add8(this.b); return 4;
            case 0x81: this.add8(this.c); return 4;
            case 0x82: this.add8(this.d); return 4;
            case 0x83: this.add8(this.e); return 4;
            case 0x84: this.add8(this.h); return 4;
            case 0x85: this.add8(this.l); return 4;
            case 0x86: this.add8(this.rb(this.hl)); return 8;
            case 0x87: this.add8(this.a); return 4;
            // ADC A,r
            case 0x88: this.adc8(this.b); return 4;
            case 0x89: this.adc8(this.c); return 4;
            case 0x8A: this.adc8(this.d); return 4;
            case 0x8B: this.adc8(this.e); return 4;
            case 0x8C: this.adc8(this.h); return 4;
            case 0x8D: this.adc8(this.l); return 4;
            case 0x8E: this.adc8(this.rb(this.hl)); return 8;
            case 0x8F: this.adc8(this.a); return 4;
            // SUB r
            case 0x90: this.sub8(this.b); return 4;
            case 0x91: this.sub8(this.c); return 4;
            case 0x92: this.sub8(this.d); return 4;
            case 0x93: this.sub8(this.e); return 4;
            case 0x94: this.sub8(this.h); return 4;
            case 0x95: this.sub8(this.l); return 4;
            case 0x96: this.sub8(this.rb(this.hl)); return 8;
            case 0x97: this.sub8(this.a); return 4;
            // SBC A,r
            case 0x98: this.sbc8(this.b); return 4;
            case 0x99: this.sbc8(this.c); return 4;
            case 0x9A: this.sbc8(this.d); return 4;
            case 0x9B: this.sbc8(this.e); return 4;
            case 0x9C: this.sbc8(this.h); return 4;
            case 0x9D: this.sbc8(this.l); return 4;
            case 0x9E: this.sbc8(this.rb(this.hl)); return 8;
            case 0x9F: this.sbc8(this.a); return 4;
            // AND r
            case 0xA0: this.and8(this.b); return 4;
            case 0xA1: this.and8(this.c); return 4;
            case 0xA2: this.and8(this.d); return 4;
            case 0xA3: this.and8(this.e); return 4;
            case 0xA4: this.and8(this.h); return 4;
            case 0xA5: this.and8(this.l); return 4;
            case 0xA6: this.and8(this.rb(this.hl)); return 8;
            case 0xA7: this.and8(this.a); return 4;
            // XOR r
            case 0xA8: this.xor8(this.b); return 4;
            case 0xA9: this.xor8(this.c); return 4;
            case 0xAA: this.xor8(this.d); return 4;
            case 0xAB: this.xor8(this.e); return 4;
            case 0xAC: this.xor8(this.h); return 4;
            case 0xAD: this.xor8(this.l); return 4;
            case 0xAE: this.xor8(this.rb(this.hl)); return 8;
            case 0xAF: this.xor8(this.a); return 4;
            // OR r
            case 0xB0: this.or8(this.b); return 4;
            case 0xB1: this.or8(this.c); return 4;
            case 0xB2: this.or8(this.d); return 4;
            case 0xB3: this.or8(this.e); return 4;
            case 0xB4: this.or8(this.h); return 4;
            case 0xB5: this.or8(this.l); return 4;
            case 0xB6: this.or8(this.rb(this.hl)); return 8;
            case 0xB7: this.or8(this.a); return 4;
            // CP r
            case 0xB8: this.cp8(this.b); return 4;
            case 0xB9: this.cp8(this.c); return 4;
            case 0xBA: this.cp8(this.d); return 4;
            case 0xBB: this.cp8(this.e); return 4;
            case 0xBC: this.cp8(this.h); return 4;
            case 0xBD: this.cp8(this.l); return 4;
            case 0xBE: this.cp8(this.rb(this.hl)); return 8;
            case 0xBF: this.cp8(this.a); return 4;

            // RET NZ
            case 0xC0: if (!this.fZ) { this.pc = this.pop(); return 20; } return 8;
            // POP BC
            case 0xC1: this.bc = this.pop(); return 12;
            // JP NZ,nn
            case 0xC2: { const addr = this.nextWord(); if (!this.fZ) { this.pc = addr; return 16; } return 12; }
            // JP nn
            case 0xC3: this.pc = this.nextWord(); return 16;
            // CALL NZ,nn
            case 0xC4: { const addr = this.nextWord(); if (!this.fZ) { this.push(this.pc); this.pc = addr; return 24; } return 12; }
            // PUSH BC
            case 0xC5: this.push(this.bc); return 16;
            // ADD A,n
            case 0xC6: this.add8(this.nextByte()); return 8;
            // RST 00
            case 0xC7: this.push(this.pc); this.pc = 0x0000; return 16;
            // RET Z
            case 0xC8: if (this.fZ) { this.pc = this.pop(); return 20; } return 8;
            // RET
            case 0xC9: this.pc = this.pop(); return 16;
            // JP Z,nn
            case 0xCA: { const addr = this.nextWord(); if (this.fZ) { this.pc = addr; return 16; } return 12; }
            // CB prefix
            case 0xCB: return this.executeCB(this.nextByte());
            // CALL Z,nn
            case 0xCC: { const addr = this.nextWord(); if (this.fZ) { this.push(this.pc); this.pc = addr; return 24; } return 12; }
            // CALL nn
            case 0xCD: { const addr = this.nextWord(); this.push(this.pc); this.pc = addr; return 24; }
            // ADC A,n
            case 0xCE: this.adc8(this.nextByte()); return 8;
            // RST 08
            case 0xCF: this.push(this.pc); this.pc = 0x0008; return 16;

            // RET NC
            case 0xD0: if (!this.fC) { this.pc = this.pop(); return 20; } return 8;
            // POP DE
            case 0xD1: this.de = this.pop(); return 12;
            // JP NC,nn
            case 0xD2: { const addr = this.nextWord(); if (!this.fC) { this.pc = addr; return 16; } return 12; }
            // CALL NC,nn
            case 0xD4: { const addr = this.nextWord(); if (!this.fC) { this.push(this.pc); this.pc = addr; return 24; } return 12; }
            // PUSH DE
            case 0xD5: this.push(this.de); return 16;
            // SUB n
            case 0xD6: this.sub8(this.nextByte()); return 8;
            // RST 10
            case 0xD7: this.push(this.pc); this.pc = 0x0010; return 16;
            // RET C
            case 0xD8: if (this.fC) { this.pc = this.pop(); return 20; } return 8;
            // RETI
            case 0xD9: this.pc = this.pop(); this.ime = true; return 16;
            // JP C,nn
            case 0xDA: { const addr = this.nextWord(); if (this.fC) { this.pc = addr; return 16; } return 12; }
            // CALL C,nn
            case 0xDC: { const addr = this.nextWord(); if (this.fC) { this.push(this.pc); this.pc = addr; return 24; } return 12; }
            // SBC A,n
            case 0xDE: this.sbc8(this.nextByte()); return 8;
            // RST 18
            case 0xDF: this.push(this.pc); this.pc = 0x0018; return 16;

            // LDH (n),A
            case 0xE0: this.wb(0xFF00 + this.nextByte(), this.a); return 12;
            // POP HL
            case 0xE1: this.hl = this.pop(); return 12;
            // LD (C),A
            case 0xE2: this.wb(0xFF00 + this.c, this.a); return 8;
            // PUSH HL
            case 0xE5: this.push(this.hl); return 16;
            // AND n
            case 0xE6: this.and8(this.nextByte()); return 8;
            // RST 20
            case 0xE7: this.push(this.pc); this.pc = 0x0020; return 16;
            // ADD SP,n
            case 0xE8: {
                const n = this.signedByte(this.nextByte());
                const result = (this.sp + n) & 0xFFFF;
                this.fZ = 0; this.fN = 0;
                this.fH = ((this.sp ^ n ^ result) & 0x10) ? 1 : 0;
                this.fC = ((this.sp ^ n ^ result) & 0x100) ? 1 : 0;
                this.sp = result;
                return 16;
            }
            // JP (HL)
            case 0xE9: this.pc = this.hl; return 4;
            // LD (nn),A
            case 0xEA: this.wb(this.nextWord(), this.a); return 16;
            // XOR n
            case 0xEE: this.xor8(this.nextByte()); return 8;
            // RST 28
            case 0xEF: this.push(this.pc); this.pc = 0x0028; return 16;

            // LDH A,(n)
            case 0xF0: this.a = this.rb(0xFF00 + this.nextByte()); return 12;
            // POP AF
            case 0xF1: this.af = this.pop(); return 12;
            // LD A,(C)
            case 0xF2: this.a = this.rb(0xFF00 + this.c); return 8;
            // DI
            case 0xF3: this.ime = false; return 4;
            // PUSH AF
            case 0xF5: this.push(this.af); return 16;
            // OR n
            case 0xF6: this.or8(this.nextByte()); return 8;
            // RST 30
            case 0xF7: this.push(this.pc); this.pc = 0x0030; return 16;
            // LD HL,SP+n
            case 0xF8: {
                const n = this.signedByte(this.nextByte());
                const result = (this.sp + n) & 0xFFFF;
                this.fZ = 0; this.fN = 0;
                this.fH = ((this.sp ^ n ^ result) & 0x10) ? 1 : 0;
                this.fC = ((this.sp ^ n ^ result) & 0x100) ? 1 : 0;
                this.hl = result;
                return 12;
            }
            // LD SP,HL
            case 0xF9: this.sp = this.hl; return 8;
            // LD A,(nn)
            case 0xFA: this.a = this.rb(this.nextWord()); return 16;
            // EI
            case 0xFB: this.eiPending = true; return 4;
            // CP n
            case 0xFE: this.cp8(this.nextByte()); return 8;
            // RST 38
            case 0xFF: this.push(this.pc); this.pc = 0x0038; return 16;

            default:
                console.warn(`Unknown opcode: 0x${op.toString(16)} at 0x${(this.pc-1).toString(16)}`);
                return 4;
        }
    }

    executeCB(op) {
        const r = op & 7;
        const getR = () => {
            switch (r) {
                case 0: return this.b;
                case 1: return this.c;
                case 2: return this.d;
                case 3: return this.e;
                case 4: return this.h;
                case 5: return this.l;
                case 6: return this.rb(this.hl);
                case 7: return this.a;
            }
        };
        const setR = (val) => {
            val &= 0xFF;
            switch (r) {
                case 0: this.b = val; break;
                case 1: this.c = val; break;
                case 2: this.d = val; break;
                case 3: this.e = val; break;
                case 4: this.h = val; break;
                case 5: this.l = val; break;
                case 6: this.wb(this.hl, val); break;
                case 7: this.a = val; break;
            }
        };
        const cycles = r === 6 ? 16 : 8;
        const bitCycles = r === 6 ? 12 : 8;
        const group = op >> 3;

        switch (group) {
            case 0: { // RLC
                let v = getR();
                this.fC = (v >> 7) & 1;
                v = ((v << 1) | this.fC) & 0xFF;
                this.fZ = v === 0 ? 1 : 0; this.fN = 0; this.fH = 0;
                setR(v); return cycles;
            }
            case 1: { // RRC
                let v = getR();
                this.fC = v & 1;
                v = ((v >> 1) | (this.fC << 7)) & 0xFF;
                this.fZ = v === 0 ? 1 : 0; this.fN = 0; this.fH = 0;
                setR(v); return cycles;
            }
            case 2: { // RL
                let v = getR();
                const oldC = this.fC;
                this.fC = (v >> 7) & 1;
                v = ((v << 1) | oldC) & 0xFF;
                this.fZ = v === 0 ? 1 : 0; this.fN = 0; this.fH = 0;
                setR(v); return cycles;
            }
            case 3: { // RR
                let v = getR();
                const oldC = this.fC;
                this.fC = v & 1;
                v = ((v >> 1) | (oldC << 7)) & 0xFF;
                this.fZ = v === 0 ? 1 : 0; this.fN = 0; this.fH = 0;
                setR(v); return cycles;
            }
            case 4: { // SLA
                let v = getR();
                this.fC = (v >> 7) & 1;
                v = (v << 1) & 0xFF;
                this.fZ = v === 0 ? 1 : 0; this.fN = 0; this.fH = 0;
                setR(v); return cycles;
            }
            case 5: { // SRA
                let v = getR();
                this.fC = v & 1;
                v = ((v >> 1) | (v & 0x80)) & 0xFF;
                this.fZ = v === 0 ? 1 : 0; this.fN = 0; this.fH = 0;
                setR(v); return cycles;
            }
            case 6: { // SWAP
                let v = getR();
                v = ((v & 0x0F) << 4) | ((v & 0xF0) >> 4);
                this.fZ = v === 0 ? 1 : 0; this.fN = 0; this.fH = 0; this.fC = 0;
                setR(v); return cycles;
            }
            case 7: { // SRL
                let v = getR();
                this.fC = v & 1;
                v = (v >> 1) & 0xFF;
                this.fZ = v === 0 ? 1 : 0; this.fN = 0; this.fH = 0;
                setR(v); return cycles;
            }
            default: {
                const bit = (op >> 3) & 7;
                const type = op >> 6;
                if (type === 1) {
                    // BIT
                    this.fZ = (getR() & (1 << bit)) ? 0 : 1;
                    this.fN = 0; this.fH = 1;
                    return bitCycles;
                } else if (type === 2) {
                    // RES
                    setR(getR() & ~(1 << bit));
                    return cycles;
                } else {
                    // SET
                    setR(getR() | (1 << bit));
                    return cycles;
                }
            }
        }
    }

    // ALU helpers
    signedByte(b) { return b > 127 ? b - 256 : b; }

    inc8(v) {
        const result = (v + 1) & 0xFF;
        this.fZ = result === 0 ? 1 : 0;
        this.fN = 0;
        this.fH = (v & 0x0F) === 0x0F ? 1 : 0;
        return result;
    }

    dec8(v) {
        const result = (v - 1) & 0xFF;
        this.fZ = result === 0 ? 1 : 0;
        this.fN = 1;
        this.fH = (v & 0x0F) === 0 ? 1 : 0;
        return result;
    }

    add8(v) {
        const result = this.a + v;
        this.fH = ((this.a & 0x0F) + (v & 0x0F)) > 0x0F ? 1 : 0;
        this.fC = result > 0xFF ? 1 : 0;
        this.a = result & 0xFF;
        this.fZ = this.a === 0 ? 1 : 0;
        this.fN = 0;
    }

    adc8(v) {
        const c = this.fC;
        const result = this.a + v + c;
        this.fH = ((this.a & 0x0F) + (v & 0x0F) + c) > 0x0F ? 1 : 0;
        this.fC = result > 0xFF ? 1 : 0;
        this.a = result & 0xFF;
        this.fZ = this.a === 0 ? 1 : 0;
        this.fN = 0;
    }

    sub8(v) {
        const result = this.a - v;
        this.fH = (this.a & 0x0F) < (v & 0x0F) ? 1 : 0;
        this.fC = result < 0 ? 1 : 0;
        this.a = result & 0xFF;
        this.fZ = this.a === 0 ? 1 : 0;
        this.fN = 1;
    }

    sbc8(v) {
        const c = this.fC;
        const result = this.a - v - c;
        this.fH = ((this.a & 0x0F) - (v & 0x0F) - c) < 0 ? 1 : 0;
        this.fC = result < 0 ? 1 : 0;
        this.a = result & 0xFF;
        this.fZ = this.a === 0 ? 1 : 0;
        this.fN = 1;
    }

    and8(v) {
        this.a &= v;
        this.fZ = this.a === 0 ? 1 : 0;
        this.fN = 0; this.fH = 1; this.fC = 0;
    }

    xor8(v) {
        this.a ^= v;
        this.fZ = this.a === 0 ? 1 : 0;
        this.fN = 0; this.fH = 0; this.fC = 0;
    }

    or8(v) {
        this.a |= v;
        this.fZ = this.a === 0 ? 1 : 0;
        this.fN = 0; this.fH = 0; this.fC = 0;
    }

    cp8(v) {
        const result = this.a - v;
        this.fZ = (result & 0xFF) === 0 ? 1 : 0;
        this.fN = 1;
        this.fH = (this.a & 0x0F) < (v & 0x0F) ? 1 : 0;
        this.fC = result < 0 ? 1 : 0;
    }

    addHL(v) {
        const hl = this.hl;
        const result = hl + v;
        this.fN = 0;
        this.fH = ((hl & 0x0FFF) + (v & 0x0FFF)) > 0x0FFF ? 1 : 0;
        this.fC = result > 0xFFFF ? 1 : 0;
        this.hl = result & 0xFFFF;
    }
}

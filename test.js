// Node.js test runner for GBC emulator
const fs = require('fs');

// Browser API shims
globalThis.navigator = { vibrate: () => {} };
globalThis.localStorage = {
    _d: {}, getItem(k) { return this._d[k] || null },
    setItem(k, v) { this._d[k] = v },
    removeItem(k) { delete this._d[k] },
    get length() { return Object.keys(this._d).length },
    key(i) { return Object.keys(this._d)[i] }
};
globalThis.document = {
    getElementById: () => ({
        getContext: () => ({
            createImageData: () => ({ data: new Uint8Array(160 * 144 * 4) }),
            putImageData: () => {}
        }),
        classList: { add() {}, remove() {} },
        addEventListener() {}
    }),
    addEventListener() {},
    querySelectorAll() { return []; },
    createElement() { return { style: {}, id: '' }; },
    get fullscreenElement() { return null; },
    get hidden() { return false; },
    body: { appendChild() {} }
};
globalThis.performance = { now: Date.now };
globalThis.requestAnimationFrame = () => {};
globalThis.cancelAnimationFrame = () => {};
globalThis.window = { AudioContext: class { createGain() { return { gain: { value: 0 }, connect() {} }; } createScriptProcessor() { return { connect() {}, onaudioprocess: null }; } } };

// Load all source files into global scope
const files = ['mbc.js', 'mmu.js', 'cpu.js', 'ppu.js', 'apu.js', 'timer.js', 'joypad.js', 'gameboy.js'];
const vm = require('vm');
const combined = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
vm.runInThisContext(combined);

// Test framework
let passed = 0, failed = 0, errors = [];
function assert(cond, msg) {
    if (cond) passed++;
    else { failed++; errors.push(msg); console.log('  ❌', msg); }
}
function assertEq(a, b, msg) {
    if (a === b) passed++;
    else { failed++; const m = `${msg} — expected ${b}, got ${a}`; errors.push(m); console.log('  ❌', m); }
}

// ==================== TESTS ====================

console.log('\n🧪 CPU Tests');
(() => {
    const mmu = new MMU(), cpu = new CPU(mmu);
    assertEq(cpu.a, 0x11, 'CPU init: A = 0x11');
    assertEq(cpu.pc, 0x0100, 'CPU init: PC = 0x0100');
    assertEq(cpu.sp, 0xFFFE, 'CPU init: SP = 0xFFFE');

    cpu.bc = 0x1234;
    assertEq(cpu.b, 0x12, 'BC write: B = high');
    assertEq(cpu.c, 0x34, 'BC write: C = low');
    assertEq(cpu.bc, 0x1234, 'BC read: combined');

    cpu.hl = 0xABCD;
    assertEq(cpu.h, 0xAB, 'HL high');
    assertEq(cpu.l, 0xCD, 'HL low');

    cpu.af = 0x12F0;
    assertEq(cpu.a, 0x12, 'AF: A');
    assertEq(cpu.fZ, 1, 'AF: Z');
    assertEq(cpu.fN, 1, 'AF: N');
    assertEq(cpu.fH, 1, 'AF: H');
    assertEq(cpu.fC, 1, 'AF: C');
})();

console.log('\n🧪 ALU Tests');
(() => {
    const mmu = new MMU(), cpu = new CPU(mmu);

    cpu.a = 0x0F; cpu.add8(0x01);
    assertEq(cpu.a, 0x10, 'ADD 0x0F+1');
    assertEq(cpu.fH, 1, 'ADD half-carry');

    cpu.a = 0xFF; cpu.add8(0x01);
    assertEq(cpu.a, 0x00, 'ADD overflow');
    assertEq(cpu.fZ, 1, 'ADD zero');
    assertEq(cpu.fC, 1, 'ADD carry');

    cpu.a = 0x10; cpu.sub8(0x10);
    assertEq(cpu.a, 0x00, 'SUB equal');
    assertEq(cpu.fZ, 1, 'SUB zero');
    assertEq(cpu.fN, 1, 'SUB N flag');

    cpu.a = 0xF0; cpu.and8(0x0F);
    assertEq(cpu.a, 0x00, 'AND');

    cpu.a = 0xAA; cpu.xor8(0xAA);
    assertEq(cpu.a, 0x00, 'XOR self');

    cpu.a = 0x05; cpu.or8(0xA0);
    assertEq(cpu.a, 0xA5, 'OR');

    assertEq(cpu.inc8(0xFF), 0x00, 'INC overflow');
    assertEq(cpu.dec8(0x00), 0xFF, 'DEC underflow');

    assertEq(cpu.signedByte(0), 0, 'signed 0');
    assertEq(cpu.signedByte(127), 127, 'signed 127');
    assertEq(cpu.signedByte(128), -128, 'signed 128');
    assertEq(cpu.signedByte(255), -1, 'signed 255');
})();

console.log('\n🧪 MMU Tests');
(() => {
    const mmu = new MMU();
    mmu.wb(0xFF80, 0x42); assertEq(mmu.rb(0xFF80), 0x42, 'HRAM r/w');
    mmu.wb(0xC000, 0xAB); assertEq(mmu.rb(0xC000), 0xAB, 'WRAM r/w');
    mmu.wb(0xFE00, 0x55); assertEq(mmu.rb(0xFE00), 0x55, 'OAM r/w');
    mmu.wb(0xFFFF, 0x1F); assertEq(mmu.rb(0xFFFF), 0x1F, 'IE r/w');
    mmu.wb(0x8000, 0x77); assertEq(mmu.rb(0x8000), 0x77, 'VRAM r/w');

    // GBC banking
    mmu.isGBC = true;
    mmu.vramBank = 0; mmu.wb(0x8000, 0xAA);
    mmu.vramBank = 1; mmu.wb(0x8000, 0xBB);
    assertEq(mmu.rb(0x8000), 0xBB, 'VRAM bank 1');
    mmu.vramBank = 0; assertEq(mmu.rb(0x8000), 0xAA, 'VRAM bank 0 preserved');

    mmu.wramBank = 2; mmu.wb(0xD000, 0xCC);
    mmu.wramBank = 3; mmu.wb(0xD000, 0xDD);
    assertEq(mmu.rb(0xD000), 0xDD, 'WRAM bank 3');
    mmu.wramBank = 2; assertEq(mmu.rb(0xD000), 0xCC, 'WRAM bank 2 preserved');
})();

console.log('\n🧪 MBC Tests');
(() => {
    // MBC3
    const rom3 = new Uint8Array(0x80000);
    rom3[0x147] = 0x10; rom3[0x149] = 0x03;
    const mbc3 = createMBC(rom3);
    assert(mbc3 instanceof MBC3, 'MBC3 created for type 0x10');
    mbc3.writeROM(0x2000, 5); assertEq(mbc3.romBank, 5, 'MBC3 bank 5');
    mbc3.writeROM(0x2000, 0); assertEq(mbc3.romBank, 1, 'MBC3 bank 0→1');
    mbc3.writeROM(0x0000, 0x0A); assert(mbc3.ramEnabled, 'MBC3 RAM enabled');
    mbc3.writeROM(0x0000, 0x00); assert(!mbc3.ramEnabled, 'MBC3 RAM disabled');
    mbc3.writeROM(0x0000, 0x0A);
    mbc3.writeROM(0x4000, 0x00);
    mbc3.writeRAM(0xA000, 0x42);
    assertEq(mbc3.readRAM(0xA000), 0x42, 'MBC3 RAM r/w');
    mbc3.writeROM(0x4000, 0x08);
    assert(mbc3.rtcMapped, 'MBC3 RTC mapped');

    // MBC1
    const rom1 = new Uint8Array(0x80000);
    rom1[0x147] = 0x01;
    assert(createMBC(rom1) instanceof MBC1, 'MBC1 for type 0x01');

    // MBC5
    const rom5 = new Uint8Array(0x80000);
    rom5[0x147] = 0x19;
    assert(createMBC(rom5) instanceof MBC5, 'MBC5 for type 0x19');
})();

console.log('\n🧪 Timer Tests');
(() => {
    const mmu = new MMU(), tmr = new Timer(mmu);
    tmr.step(256); assertEq(mmu.io[0x04], 1, 'DIV increments at 256 cycles');
    tmr.step(256); assertEq(mmu.io[0x04], 2, 'DIV increments again');

    const mmu2 = new MMU(), tmr2 = new Timer(mmu2);
    mmu2.io[0x07] = 0x05; mmu2.io[0x05] = 0xFE; mmu2.io[0x06] = 0x00;
    tmr2.step(16); assertEq(mmu2.io[0x05], 0xFF, 'TIMA increments');
    tmr2.step(16); assertEq(mmu2.io[0x05], 0x00, 'TIMA overflows to TMA');
    assert(mmu2.io[0x0F] & 0x04, 'Timer interrupt on overflow');
})();

console.log('\n🧪 Joypad Tests');
(() => {
    const mmu = new MMU(), jp = new Joypad(mmu);
    mmu.io[0x00] = 0x20;
    jp.press('right');
    assertEq(jp.read() & 0x01, 0, 'Right pressed');
    jp.release('right');
    assertEq(jp.read() & 0x0F, 0x0F, 'All released');
    mmu.io[0x00] = 0x10;
    jp.press('a');
    assertEq(jp.read() & 0x01, 0, 'A pressed');
})();

console.log('\n🧪 APU Tests');
(() => {
    const apu = new APU();
    assertEq(apu.enabled, false, 'APU not enabled before init');
    assertEq(apu.powerOn, false, 'APU power off');
    apu.writeRegister(0xFF26, 0x80); assert(apu.powerOn, 'APU power on');
    apu.writeRegister(0xFF11, 0x80); assertEq(apu.ch1.duty, 2, 'CH1 50% duty');
    apu.writeRegister(0xFF12, 0xF3);
    assertEq(apu.ch1.envVol, 15, 'CH1 env vol');
    assertEq(apu.ch1.envDir, 0, 'CH1 env dir');
    assertEq(apu.ch1.envPeriod, 3, 'CH1 env period');
    apu.writeRegister(0xFF25, 0xFF); assertEq(apu.panning, 0xFF, 'Panning');
    apu.writeRegister(0xFF24, 0x77);
    assertEq(apu.masterVol.left, 7, 'Master vol L');
    assertEq(apu.masterVol.right, 7, 'Master vol R');
    assertEq(apu.toggleMute(), true, 'Mute on');
    assertEq(apu.toggleMute(), false, 'Mute off');
})();

console.log('\n🧪 PPU Tests');
(() => {
    const mmu = new MMU(), ppu = new PPU(mmu);
    assertEq(ppu.framebuffer.length, 160 * 144 * 4, 'Framebuffer size');
    mmu.io[0x40] = 0x91;
    ppu.step(4); assertEq(mmu.io[0x41] & 3, 2, 'Mode 2 at start');
    ppu.step(76); assertEq(mmu.io[0x41] & 3, 3, 'Mode 3 at 80');
    ppu.step(172); assertEq(mmu.io[0x41] & 3, 0, 'Mode 0 at 252');
})();

console.log('\n🧪 Save/Load Tests');
(() => {
    const gb = new GameBoy(document.getElementById('c'));
    const rom = new Uint8Array(0x8000);
    rom[0x134] = 84; rom[0x135] = 69; rom[0x136] = 83; rom[0x137] = 84;
    gb.loadROM(rom.buffer);
    assert(gb.romLoaded, 'ROM loaded');
    assertEq(gb.romTitle, 'TEST', 'ROM title');

    gb.cpu.a = 0x42; gb.cpu.pc = 0x1234; gb.mmu.wb(0xFF80, 0xBB);
    const state = gb.saveState();
    assert(state !== null, 'State created');

    gb.cpu.a = 0; gb.cpu.pc = 0;
    gb.loadState(state);
    assertEq(gb.cpu.a, 0x42, 'Restore CPU A');
    assertEq(gb.cpu.pc, 0x1234, 'Restore CPU PC');
    assertEq(gb.mmu.rb(0xFF80), 0xBB, 'Restore HRAM');

    // localStorage round-trip
    const key = 'gbc_state_' + gb.romTitle;
    const json = JSON.stringify(state);
    localStorage.setItem(key, json);
    const loaded = JSON.parse(localStorage.getItem(key));
    assertEq(loaded.cpu.a, 0x42, 'localStorage state roundtrip');
    localStorage.removeItem(key);

    // Battery save
    gb.mmu.mbc.ramEnabled = true;
    gb.mmu.mbc.writeRAM(0xA000, 0x55);
    gb.saveBatterySave();
    assert(localStorage.getItem('gbc_sav_TEST') !== null, 'Battery save persisted');
    localStorage.removeItem('gbc_sav_TEST');
})();

// ==================== SUMMARY ====================
console.log('\n' + '='.repeat(40));
if (failed === 0) {
    console.log(`🎉 ALL ${passed} TESTS PASSED`);
} else {
    console.log(`⚠️  ${passed} passed, ${failed} failed`);
    errors.forEach(e => console.log('  -', e));
    process.exit(1);
}

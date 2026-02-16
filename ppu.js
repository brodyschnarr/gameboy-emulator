// Pixel Processing Unit - renders the Game Boy screen
class PPU {
    constructor(mmu) {
        this.mmu = mmu;
        this.framebuffer = new Uint8Array(160 * 144 * 4);
        this.onFrame = null;
        this.cycles = 0;
        this.windowLine = 0;

        // DMG palettes (green shades)
        this.dmgColors = [
            [155, 188, 15, 255],  // lightest
            [139, 172, 15, 255],
            [48, 98, 48, 255],
            [15, 56, 15, 255],    // darkest
        ];

        // Line sprite buffer
        this.linePriority = new Uint8Array(160);
    }

    step(cycles) {
        const lcdc = this.mmu.io[0x40];
        if (!(lcdc & 0x80)) {
            // LCD off
            this.mmu.io[0x41] &= ~3;
            this.mmu.io[0x44] = 0;
            this.cycles = 0;
            this.windowLine = 0;
            return;
        }

        this.cycles += cycles;

        const ly = this.mmu.io[0x44];
        const stat = this.mmu.io[0x41];
        const mode = stat & 3;

        if (ly < 144) {
            if (this.cycles < 80) {
                // Mode 2: OAM scan
                if (mode !== 2) {
                    this.setMode(2);
                    this.checkSTAT();
                }
            } else if (this.cycles < 252) {
                // Mode 3: Drawing
                if (mode !== 3) {
                    this.setMode(3);
                }
            } else if (this.cycles < 456) {
                // Mode 0: HBlank
                if (mode !== 0) {
                    this.setMode(0);
                    this.renderScanline(ly);
                    this.checkSTAT();
                    // HDMA during HBlank
                    if (this.mmu.hdmaActive && this.mmu.hdmaHblank) {
                        this.mmu.doHDMABlock();
                    }
                }
            }
        }

        if (this.cycles >= 456) {
            this.cycles -= 456;
            this.mmu.io[0x44] = (ly + 1) % 154;

            if (this.mmu.io[0x44] === this.mmu.io[0x45]) {
                this.mmu.io[0x41] |= 0x04; // LYC coincidence
                this.checkSTAT();
            } else {
                this.mmu.io[0x41] &= ~0x04;
            }

            if (this.mmu.io[0x44] === 144) {
                // VBlank
                this.setMode(1);
                this.mmu.io[0x0F] |= 0x01; // VBlank interrupt
                this.checkSTAT();
                this.windowLine = 0;
                if (this.onFrame) this.onFrame(this.framebuffer);
            }
        }
    }

    setMode(mode) {
        this.mmu.io[0x41] = (this.mmu.io[0x41] & ~3) | mode;
    }

    checkSTAT() {
        const stat = this.mmu.io[0x41];
        const mode = stat & 3;
        let interrupt = false;
        if ((stat & 0x40) && (stat & 0x04)) interrupt = true; // LYC
        if ((stat & 0x20) && mode === 2) interrupt = true;     // OAM
        if ((stat & 0x10) && mode === 1) interrupt = true;     // VBlank
        if ((stat & 0x08) && mode === 0) interrupt = true;     // HBlank
        if (interrupt) this.mmu.io[0x0F] |= 0x02;             // LCD STAT interrupt
    }

    renderScanline(ly) {
        const lcdc = this.mmu.io[0x40];
        this.linePriority.fill(0);

        if (this.mmu.isGBC || (lcdc & 0x01)) this.renderBG(ly, lcdc);
        if (lcdc & 0x20) this.renderWindow(ly, lcdc);
        if (lcdc & 0x02) this.renderSprites(ly, lcdc);
    }

    renderBG(ly, lcdc) {
        const scx = this.mmu.io[0x43];
        const scy = this.mmu.io[0x42];
        const tileData = (lcdc & 0x10) ? 0x8000 : 0x8800;
        const tileMap = (lcdc & 0x08) ? 0x9C00 : 0x9800;
        const y = (scy + ly) & 0xFF;
        const tileRow = (y >> 3) & 31;

        for (let px = 0; px < 160; px++) {
            const x = (scx + px) & 0xFF;
            const tileCol = (x >> 3) & 31;
            const mapAddr = tileMap + tileRow * 32 + tileCol;
            let tileNum = this.mmu.vram[0][mapAddr - 0x8000];

            // GBC attributes
            let vramBank = 0, palNum = 0, flipX = false, flipY = false, bgPriority = false;
            if (this.mmu.isGBC) {
                const attr = this.mmu.vram[1][mapAddr - 0x8000];
                palNum = attr & 7;
                vramBank = (attr >> 3) & 1;
                flipX = (attr & 0x20) !== 0;
                flipY = (attr & 0x40) !== 0;
                bgPriority = (attr & 0x80) !== 0;
            }

            if (tileData === 0x8800) tileNum = ((tileNum ^ 0x80) - 128 + 128) & 0xFF;

            let tileY = y & 7;
            let tileX = x & 7;
            if (flipY) tileY = 7 - tileY;
            if (flipX) tileX = 7 - tileX;

            const tileAddr = (tileData === 0x8800)
                ? 0x8800 + ((tileNum + 128) & 0xFF) * 16
                : tileData + tileNum * 16;

            const lo = this.mmu.vram[vramBank][(tileAddr + tileY * 2) - 0x8000];
            const hi = this.mmu.vram[vramBank][(tileAddr + tileY * 2 + 1) - 0x8000];
            const bit = 7 - tileX;
            const colorId = ((hi >> bit) & 1) << 1 | ((lo >> bit) & 1);

            if (colorId > 0) this.linePriority[px] = bgPriority ? 2 : 1;

            this.setPixel(px, ly, colorId, palNum, false);
        }
    }

    renderWindow(ly, lcdc) {
        const wy = this.mmu.io[0x4A];
        const wx = this.mmu.io[0x4B] - 7;
        if (ly < wy) return;

        const tileData = (lcdc & 0x10) ? 0x8000 : 0x8800;
        const tileMap = (lcdc & 0x40) ? 0x9C00 : 0x9800;
        const y = this.windowLine;
        const tileRow = (y >> 3) & 31;
        let rendered = false;

        for (let px = 0; px < 160; px++) {
            if (px < wx) continue;
            rendered = true;
            const x = px - wx;
            const tileCol = (x >> 3) & 31;
            const mapAddr = tileMap + tileRow * 32 + tileCol;
            let tileNum = this.mmu.vram[0][mapAddr - 0x8000];

            let vramBank = 0, palNum = 0, flipX = false, flipY = false, bgPriority = false;
            if (this.mmu.isGBC) {
                const attr = this.mmu.vram[1][mapAddr - 0x8000];
                palNum = attr & 7;
                vramBank = (attr >> 3) & 1;
                flipX = (attr & 0x20) !== 0;
                flipY = (attr & 0x40) !== 0;
                bgPriority = (attr & 0x80) !== 0;
            }

            if (tileData === 0x8800) tileNum = ((tileNum ^ 0x80) - 128 + 128) & 0xFF;

            let tileY = y & 7;
            let tileX = x & 7;
            if (flipY) tileY = 7 - tileY;
            if (flipX) tileX = 7 - tileX;

            const tileAddr = (tileData === 0x8800)
                ? 0x8800 + ((tileNum + 128) & 0xFF) * 16
                : tileData + tileNum * 16;

            const lo = this.mmu.vram[vramBank][(tileAddr + tileY * 2) - 0x8000];
            const hi = this.mmu.vram[vramBank][(tileAddr + tileY * 2 + 1) - 0x8000];
            const bit = 7 - tileX;
            const colorId = ((hi >> bit) & 1) << 1 | ((lo >> bit) & 1);

            if (colorId > 0) this.linePriority[px] = bgPriority ? 2 : 1;

            this.setPixel(px, ly, colorId, palNum, false);
        }

        if (rendered) this.windowLine++;
    }

    renderSprites(ly, lcdc) {
        const tallSprites = (lcdc & 0x04) !== 0;
        const spriteH = tallSprites ? 16 : 8;
        const sprites = [];

        for (let i = 0; i < 40; i++) {
            const y = this.mmu.oam[i * 4] - 16;
            const x = this.mmu.oam[i * 4 + 1] - 8;
            if (ly >= y && ly < y + spriteH) {
                sprites.push({ y, x, tile: this.mmu.oam[i * 4 + 2], attr: this.mmu.oam[i * 4 + 3], idx: i });
            }
            if (sprites.length >= 10) break;
        }

        // Sort by x position (lower x = higher priority), then by OAM index
        if (!this.mmu.isGBC) {
            sprites.sort((a, b) => a.x - b.x || a.idx - b.idx);
        }

        // Render in reverse order so higher priority sprites overwrite
        for (let i = sprites.length - 1; i >= 0; i--) {
            const s = sprites[i];
            const flipX = (s.attr & 0x20) !== 0;
            const flipY = (s.attr & 0x40) !== 0;
            const behindBG = (s.attr & 0x80) !== 0;

            let vramBank = 0, palNum = 0;
            if (this.mmu.isGBC) {
                palNum = s.attr & 7;
                vramBank = (s.attr >> 3) & 1;
            } else {
                palNum = (s.attr & 0x10) ? 1 : 0;
            }

            let tileNum = s.tile;
            if (tallSprites) tileNum &= 0xFE;

            let tileY = ly - s.y;
            if (flipY) tileY = spriteH - 1 - tileY;

            const tileAddr = 0x8000 + tileNum * 16;
            const lo = this.mmu.vram[vramBank][(tileAddr + tileY * 2) - 0x8000];
            const hi = this.mmu.vram[vramBank][(tileAddr + tileY * 2 + 1) - 0x8000];

            for (let px = 0; px < 8; px++) {
                const screenX = s.x + px;
                if (screenX < 0 || screenX >= 160) continue;

                const bit = flipX ? px : 7 - px;
                const colorId = ((hi >> bit) & 1) << 1 | ((lo >> bit) & 1);
                if (colorId === 0) continue; // Transparent

                // BG priority check
                if (behindBG && this.linePriority[screenX] > 0) continue;
                if (this.mmu.isGBC && (this.mmu.io[0x40] & 1) && this.linePriority[screenX] === 2) continue;

                this.setPixel(screenX, ly, colorId, palNum, true);
            }
        }
    }

    setPixel(x, ly, colorId, palNum, isSprite) {
        const offset = (ly * 160 + x) * 4;

        if (this.mmu.isGBC) {
            const palette = isSprite ? this.mmu.objPalette : this.mmu.bgPalette;
            const idx = palNum * 8 + colorId * 2;
            const lo = palette[idx];
            const hi = palette[idx + 1];
            const rgb555 = lo | (hi << 8);
            // Convert GBC 5-bit color to 8-bit
            const r = (rgb555 & 0x1F);
            const g = ((rgb555 >> 5) & 0x1F);
            const b = ((rgb555 >> 10) & 0x1F);
            // Color correction for more accurate colors
            this.framebuffer[offset] = Math.min(255, (r * 26 + g * 4 + b * 2) >> 2);
            this.framebuffer[offset + 1] = Math.min(255, (g * 24 + b * 8) >> 2);
            this.framebuffer[offset + 2] = Math.min(255, (r * 6 + g * 4 + b * 22) >> 2);
            this.framebuffer[offset + 3] = 255;
        } else {
            const pal = isSprite
                ? (palNum ? this.mmu.io[0x49] : this.mmu.io[0x48])
                : this.mmu.io[0x47];
            const shade = (pal >> (colorId * 2)) & 3;
            const c = this.dmgColors[shade];
            this.framebuffer[offset] = c[0];
            this.framebuffer[offset + 1] = c[1];
            this.framebuffer[offset + 2] = c[2];
            this.framebuffer[offset + 3] = c[3];
        }
    }
}

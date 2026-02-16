// Game Boy Joypad Input
class Joypad {
    constructor(mmu) {
        this.mmu = mmu;
        this.buttons = { a: false, b: false, select: false, start: false, right: false, left: false, up: false, down: false };
    }

    read() {
        const p1 = this.mmu.io[0x00];
        let result = p1 | 0x0F;

        if (!(p1 & 0x20)) {
            // Button keys selected
            if (this.buttons.a) result &= ~0x01;
            if (this.buttons.b) result &= ~0x02;
            if (this.buttons.select) result &= ~0x04;
            if (this.buttons.start) result &= ~0x08;
        }
        if (!(p1 & 0x10)) {
            // Direction keys selected
            if (this.buttons.right) result &= ~0x01;
            if (this.buttons.left) result &= ~0x02;
            if (this.buttons.up) result &= ~0x04;
            if (this.buttons.down) result &= ~0x08;
        }
        return result;
    }

    press(button) {
        const wasReleased = !this.buttons[button];
        this.buttons[button] = true;
        if (wasReleased) {
            this.mmu.io[0x0F] |= 0x10; // Joypad interrupt
        }
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);
    }

    release(button) {
        this.buttons[button] = false;
    }
}

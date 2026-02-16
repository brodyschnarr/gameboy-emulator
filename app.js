// App - wires up the UI to the emulator
(function() {
    const canvas = document.getElementById('screen');
    const gb = new GameBoy(canvas);

    // ROM loading
    const romInput = document.getElementById('rom-input');
    document.getElementById('btn-load').addEventListener('click', () => {
        gb.apu.resume();
        romInput.click();
    });

    romInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showToast('Loading: ' + file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                gb.stop();
                gb.loadROM(ev.target.result);
                gb.start();
                document.getElementById('power-led').classList.add('on');
                showToast('Running: ' + gb.romTitle);
            } catch(err) {
                showToast('Error: ' + err.message);
                console.error(err);
            }
        };
        reader.onerror = () => showToast('Failed to read file');
        reader.readAsArrayBuffer(file);
    });

    // Save/Load state
    document.getElementById('btn-save-state').addEventListener('click', () => {
        if (!gb.romLoaded) { showToast('Load a ROM first'); return; }
        try {
            const state = gb.saveState();
            const stateStr = JSON.stringify(state);
            localStorage.setItem('gbc_state_' + gb.romTitle, stateStr);
            gb.saveBatterySave();
            showToast('Saved! (' + Math.round(stateStr.length/1024) + 'KB) 💾');
        } catch (e) {
            showToast('Save failed: ' + e.message);
            console.error('Save error:', e);
        }
    });

    document.getElementById('btn-load-state').addEventListener('click', () => {
        if (!gb.romLoaded) { showToast('Load a ROM first'); return; }
        try {
            const key = 'gbc_state_' + gb.romTitle;
            const data = localStorage.getItem(key);
            if (data) {
                const state = JSON.parse(data);
                gb.loadState(state);
                showToast('State loaded! 📥');
            } else {
                // Show what keys exist for debugging
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k.startsWith('gbc_')) keys.push(k);
                }
                showToast('No save for "' + gb.romTitle + '"');
                console.log('Looking for key:', key);
                console.log('Available GBC keys:', keys);
            }
        } catch (e) {
            showToast('Load failed: ' + e.message);
            console.error('Load error:', e);
        }
    });

    // Sound toggle
    const muteBtn = document.getElementById('btn-mute');
    muteBtn.addEventListener('click', () => {
        const muted = gb.apu.toggleMute();
        muteBtn.textContent = muted ? '🔇' : '🔊';
    });

    // Theme toggle
    const themeBtn = document.getElementById('btn-theme');
    let currentTheme = localStorage.getItem('gbc_theme') || 'default';
    if (currentTheme === 'photo') document.body.classList.add('theme-photo');

    themeBtn.addEventListener('click', () => {
        if (currentTheme === 'default') {
            currentTheme = 'photo';
            document.body.classList.add('theme-photo');
        } else {
            currentTheme = 'default';
            document.body.classList.remove('theme-photo');
        }
        localStorage.setItem('gbc_theme', currentTheme);
    });

    // Fullscreen
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        const el = document.documentElement;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        }
    });

    // Touch controls
    const buttons = document.querySelectorAll('[data-btn]');
    buttons.forEach(btn => {
        const name = btn.dataset.btn;

        const press = (e) => {
            e.preventDefault();
            btn.classList.add('pressed');
            gb.joypad.press(name);
            gb.apu.resume();
        };
        const release = (e) => {
            e.preventDefault();
            btn.classList.remove('pressed');
            gb.joypad.release(name);
        };

        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    });

    // Keyboard support
    const keyMap = {
        'ArrowRight': 'right', 'ArrowLeft': 'left', 'ArrowUp': 'up', 'ArrowDown': 'down',
        'z': 'a', 'Z': 'a', 'x': 'b', 'X': 'b',
        'Enter': 'start', 'Shift': 'select',
        'a': 'a', 's': 'b'
    };

    document.addEventListener('keydown', (e) => {
        const btn = keyMap[e.key];
        if (btn) {
            e.preventDefault();
            gb.joypad.press(btn);
            const el = document.querySelector(`[data-btn="${btn}"]`);
            if (el) el.classList.add('pressed');
        }
    });

    document.addEventListener('keyup', (e) => {
        const btn = keyMap[e.key];
        if (btn) {
            e.preventDefault();
            gb.joypad.release(btn);
            const el = document.querySelector(`[data-btn="${btn}"]`);
            if (el) el.classList.remove('pressed');
        }
    });

    // Auto-save battery every 15 seconds + save state
    setInterval(() => {
        if (gb.running) {
            gb.saveBatterySave();
            // Also auto-save state
            try {
                const state = gb.saveState();
                localStorage.setItem('gbc_autosave_' + gb.romTitle, JSON.stringify(state));
            } catch(e) {}
        }
    }, 15000);

    // Save on page hide
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gb.running) {
            gb.saveBatterySave();
            try {
                const state = gb.saveState();
                localStorage.setItem('gbc_autosave_' + gb.romTitle, JSON.stringify(state));
            } catch(e) {}
        }
    });

    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('#controls, #menu-buttons')) {
            e.preventDefault();
        }
    }, { passive: false });

    // Toast notification
    function showToast(msg) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 16px;border-radius:8px;font-size:14px;z-index:100;transition:opacity 0.3s;pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    }
})();

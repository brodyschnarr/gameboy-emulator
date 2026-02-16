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

    // Save/Load state with slots
    function getSaveIndex() {
        const key = 'gbc_saves_' + gb.romTitle;
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch(e) { return []; }
    }

    function saveSaveIndex(index) {
        localStorage.setItem('gbc_saves_' + gb.romTitle, JSON.stringify(index));
    }

    document.getElementById('btn-save-state').addEventListener('click', () => {
        if (!gb.romLoaded) { showToast('Load a ROM first'); return; }
        try {
            const state = gb.saveState();
            const stateStr = JSON.stringify(state);
            const now = new Date();
            const id = 'gbc_slot_' + gb.romTitle + '_' + Date.now();
            localStorage.setItem(id, stateStr);
            gb.saveBatterySave();

            const index = getSaveIndex();
            index.push({
                id: id,
                time: now.toISOString(),
                label: now.toLocaleString(),
                size: Math.round(stateStr.length / 1024)
            });

            // Keep max 10 saves, delete oldest
            while (index.length > 10) {
                const old = index.shift();
                localStorage.removeItem(old.id);
            }
            saveSaveIndex(index);

            showToast('Saved! Slot ' + index.length + '/10 💾');
        } catch (e) {
            showToast('Save failed: ' + e.message);
            console.error('Save error:', e);
        }
    });

    document.getElementById('btn-load-state').addEventListener('click', () => {
        if (!gb.romLoaded) { showToast('Load a ROM first'); return; }
        const index = getSaveIndex();
        if (index.length === 0) {
            showToast('No saves found');
            return;
        }
        showSaveMenu(index);
    });

    function showSaveMenu(index) {
        // Remove existing menu
        let menu = document.getElementById('save-menu');
        if (menu) { menu.remove(); return; }

        menu = document.createElement('div');
        menu.id = 'save-menu';
        menu.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';

        const title = document.createElement('div');
        title.textContent = '📥 Load Save State';
        title.style.cssText = 'color:#fff;font-size:18px;font-weight:bold;margin-bottom:16px;';
        menu.appendChild(title);

        const list = document.createElement('div');
        list.style.cssText = 'width:100%;max-width:360px;max-height:60vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;';

        // Show newest first
        const reversed = [...index].reverse();
        reversed.forEach((save, i) => {
            const btn = document.createElement('button');
            const date = new Date(save.time);
            const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const slotNum = index.length - i;
            btn.textContent = '#' + slotNum + '  —  ' + timeStr + '  (' + save.size + 'KB)';
            btn.style.cssText = 'padding:14px 16px;background:#2a2a5e;border:1px solid #4a4a8e;border-radius:10px;color:#e0e0ff;font-size:14px;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;';

            btn.addEventListener('click', () => {
                try {
                    const data = localStorage.getItem(save.id);
                    if (data) {
                        gb.loadState(JSON.parse(data));
                        showToast('Loaded save #' + slotNum + ' 📥');
                    } else {
                        showToast('Save data missing');
                    }
                } catch(e) {
                    showToast('Load failed: ' + e.message);
                }
                menu.remove();
            });
            list.appendChild(btn);
        });
        menu.appendChild(list);

        // Delete all button
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️ Delete All Saves';
        delBtn.style.cssText = 'margin-top:12px;padding:10px 20px;background:#5a1a1a;border:1px solid #8a3a3a;border-radius:8px;color:#ffaaaa;font-size:13px;cursor:pointer;';
        delBtn.addEventListener('click', () => {
            index.forEach(s => localStorage.removeItem(s.id));
            saveSaveIndex([]);
            showToast('All saves deleted');
            menu.remove();
        });
        menu.appendChild(delBtn);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ Cancel';
        closeBtn.style.cssText = 'margin-top:8px;padding:10px 20px;background:transparent;border:1px solid #666;border-radius:8px;color:#aaa;font-size:13px;cursor:pointer;';
        closeBtn.addEventListener('click', () => menu.remove());
        menu.appendChild(closeBtn);

        document.body.appendChild(menu);
    }

    // ===== CHEAT ENGINE =====
    const activeCheats = []; // { addr, value, label, active }

    // Apply cheats via the PPU frame callback (runs once per frame, reliable)
    const origOnFrame = gb.ppu.onFrame;
    gb.ppu.onFrame = function(fb) {
        // Apply active cheats every frame
        for (const cheat of activeCheats) {
            if (cheat.active) {
                gb.mmu.wb(cheat.addr, cheat.value);
            }
        }
        if (origOnFrame) origOnFrame(fb);
    };

    // Preset cheats for popular games
    const presetCheats = {
        'POKEMON_GLD': [
            { label: '99 Rare Candies (Slot 1)', codes: ['010146D5', '016347D5'], desc: 'Puts 99 Rare Candies in Item Pocket slot 1' },
            { label: '99 Master Balls (Slot 2)', codes: ['010148D5', '016349D5'], desc: 'Puts 99 Master Balls in Item Pocket slot 2' },
            { label: 'Infinite Money', codes: ['019F41D5', '019F42D5', '019F43D5'], desc: 'Max money' },
            { label: 'Infinite HP (Battle)', codes: ['01FF45DA', '01FF46DA'], desc: 'Your lead Pokémon has 999 HP in battle' },
            { label: 'Walk Through Walls', codes: ['010138D5'], desc: 'Walk anywhere' },
        ],
        'POKEMON_SLV': [
            { label: '99 Rare Candies (Slot 1)', codes: ['010146D5', '016347D5'], desc: 'Puts 99 Rare Candies in Item Pocket slot 1' },
            { label: '99 Master Balls (Slot 2)', codes: ['010148D5', '016349D5'], desc: 'Puts 99 Master Balls in Item Pocket slot 2' },
            { label: 'Infinite Money', codes: ['019F41D5', '019F42D5', '019F43D5'], desc: 'Max money' },
        ],
    };

    function parseGameShark(code) {
        // Format: ABCDEFGH -> write value CD to address GHEF
        code = code.replace(/\s/g, '').toUpperCase();
        if (code.length !== 8) return null;
        const type = parseInt(code.substr(0, 2), 16);
        const value = parseInt(code.substr(2, 2), 16);
        const addrLo = parseInt(code.substr(4, 2), 16);
        const addrHi = parseInt(code.substr(6, 2), 16);
        const addr = (addrHi << 8) | addrLo;
        if (type !== 0x01) return null; // Only support type 01 (RAM write)
        return { addr, value };
    }

    function getGameKey() {
        if (!gb.romTitle) return null;
        const t = gb.romTitle.toUpperCase().replace(/[^A-Z0-9]/g, '');
        console.log('ROM title for cheat detection:', gb.romTitle, '→', t);
        // Pokemon Gold - ROM header might say "POKEMON_GLD", "POKEMON GOLD", "PM_GOLD" etc
        if (t.includes('GLD') || t.includes('GOLD')) return 'POKEMON_GLD';
        // Pokemon Silver
        if (t.includes('SLV') || t.includes('SILVER') || t.includes('SILV')) return 'POKEMON_SLV';
        // Pokemon Crystal
        if (t.includes('CRYS') || t.includes('CRYSTAL')) return 'POKEMON_GLD'; // Similar memory layout
        return null;
    }

    document.getElementById('btn-cheats').addEventListener('click', () => {
        showToast('Cheats tapped: loaded=' + gb.romLoaded + ' title=' + gb.romTitle);
        if (!gb.romLoaded) { return; }
        try {
            showCheatMenu();
        } catch(e) {
            showToast('Cheat error: ' + e.message);
            console.error('Cheat menu error:', e);
        }
    });

    function showCheatMenu() {
        let menu = document.getElementById('cheat-menu');
        if (menu) { menu.remove(); return; }

        menu = document.createElement('div');
        menu.id = 'cheat-menu';
        menu.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:200;display:flex;flex-direction:column;align-items:center;padding:20px;overflow-y:auto;';

        const title = document.createElement('div');
        title.textContent = '🎮 Cheats — ' + gb.romTitle;
        title.style.cssText = 'color:#fff;font-size:16px;font-weight:bold;margin-bottom:12px;';
        menu.appendChild(title);

        const content = document.createElement('div');
        content.style.cssText = 'width:100%;max-width:360px;display:flex;flex-direction:column;gap:8px;';

        // Presets for recognized games
        const gameKey = getGameKey();
        if (gameKey && presetCheats[gameKey]) {
            const presetLabel = document.createElement('div');
            presetLabel.textContent = '⚡ Quick Cheats';
            presetLabel.style.cssText = 'color:#ffd700;font-size:14px;font-weight:bold;margin-bottom:4px;';
            content.appendChild(presetLabel);

            for (const preset of presetCheats[gameKey]) {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;';

                const isActive = activeCheats.some(c => c.label === preset.label && c.active);

                const btn = document.createElement('button');
                btn.textContent = (isActive ? '✅ ' : '⬜ ') + preset.label;
                btn.style.cssText = 'flex:1;padding:12px;background:' + (isActive ? '#1a4a1a' : '#2a2a5e') + ';border:1px solid ' + (isActive ? '#2a8a2a' : '#4a4a8e') + ';border-radius:8px;color:#e0e0ff;font-size:13px;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;';

                btn.addEventListener('click', () => {
                    if (isActive) {
                        // Deactivate
                        for (let i = activeCheats.length - 1; i >= 0; i--) {
                            if (activeCheats[i].label === preset.label) {
                                activeCheats.splice(i, 1);
                            }
                        }
                        showToast(preset.label + ' OFF');
                    } else {
                        // Activate
                        for (const code of preset.codes) {
                            const parsed = parseGameShark(code);
                            if (parsed) {
                                activeCheats.push({
                                    addr: parsed.addr,
                                    value: parsed.value,
                                    label: preset.label,
                                    code: code,
                                    active: true
                                });
                            }
                        }
                        showToast(preset.label + ' ON ✅');
                    }
                    menu.remove();
                    showCheatMenu(); // Refresh
                });
                row.appendChild(btn);
                content.appendChild(row);
            }
        }

        // Custom GameShark code input
        const customLabel = document.createElement('div');
        customLabel.textContent = '🔧 Custom GameShark Code';
        customLabel.style.cssText = 'color:#a0c4ff;font-size:14px;font-weight:bold;margin-top:16px;margin-bottom:4px;';
        content.appendChild(customLabel);

        const inputRow = document.createElement('div');
        inputRow.style.cssText = 'display:flex;gap:8px;';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'e.g. 010146D5';
        input.maxLength = 8;
        input.style.cssText = 'flex:1;padding:10px;background:#1a1a3e;border:1px solid #4a4a8e;border-radius:8px;color:#fff;font-size:14px;font-family:monospace;text-transform:uppercase;';
        inputRow.appendChild(input);

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add';
        addBtn.style.cssText = 'padding:10px 16px;background:#2a5a2a;border:1px solid #4a8a4a;border-radius:8px;color:#aaffaa;font-size:13px;cursor:pointer;';
        addBtn.addEventListener('click', () => {
            const parsed = parseGameShark(input.value);
            if (parsed) {
                activeCheats.push({
                    addr: parsed.addr,
                    value: parsed.value,
                    label: 'Custom: ' + input.value.toUpperCase(),
                    code: input.value.toUpperCase(),
                    active: true
                });
                showToast('Cheat added: ' + input.value.toUpperCase());
                input.value = '';
                menu.remove();
                showCheatMenu();
            } else {
                showToast('Invalid code (need 8 hex chars, type 01)');
            }
        });
        inputRow.appendChild(addBtn);
        content.appendChild(inputRow);

        // Show active cheats
        if (activeCheats.length > 0) {
            const activeLabel = document.createElement('div');
            activeLabel.textContent = '📋 Active Cheats (' + activeCheats.filter(c=>c.active).length + ')';
            activeLabel.style.cssText = 'color:#ff9944;font-size:14px;font-weight:bold;margin-top:16px;margin-bottom:4px;';
            content.appendChild(activeLabel);

            // Group by label
            const seen = new Set();
            for (const cheat of activeCheats) {
                if (seen.has(cheat.label)) continue;
                seen.add(cheat.label);
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#2a1a1a;border:1px solid #5a3a3a;border-radius:6px;';
                row.innerHTML = '<span style="color:#ffcccc;font-size:12px;">' + cheat.label + '</span>';
                const removeBtn = document.createElement('button');
                removeBtn.textContent = '✕';
                removeBtn.style.cssText = 'background:none;border:none;color:#ff6666;font-size:16px;cursor:pointer;padding:4px 8px;';
                const lbl = cheat.label;
                removeBtn.addEventListener('click', () => {
                    for (let i = activeCheats.length - 1; i >= 0; i--) {
                        if (activeCheats[i].label === lbl) activeCheats.splice(i, 1);
                    }
                    showToast(lbl + ' removed');
                    menu.remove();
                    showCheatMenu();
                });
                row.appendChild(removeBtn);
                content.appendChild(row);
            }

            const clearBtn = document.createElement('button');
            clearBtn.textContent = '🗑️ Clear All Cheats';
            clearBtn.style.cssText = 'margin-top:8px;padding:10px;background:#5a1a1a;border:1px solid #8a3a3a;border-radius:8px;color:#ffaaaa;font-size:13px;cursor:pointer;';
            clearBtn.addEventListener('click', () => {
                activeCheats.length = 0;
                showToast('All cheats cleared');
                menu.remove();
                showCheatMenu();
            });
            content.appendChild(clearBtn);
        }

        menu.appendChild(content);

        // Close
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ Close';
        closeBtn.style.cssText = 'margin-top:16px;padding:10px 24px;background:transparent;border:1px solid #666;border-radius:8px;color:#aaa;font-size:13px;cursor:pointer;';
        closeBtn.addEventListener('click', () => menu.remove());
        menu.appendChild(closeBtn);

        document.body.appendChild(menu);
    }

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

    // Auto-save battery RAM only (in-game saves like Pokémon save files)
    // No auto state saves — manual only, so you control exactly what you restore
    setInterval(() => {
        if (gb.running) gb.saveBatterySave();
    }, 15000);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gb.running) gb.saveBatterySave();
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

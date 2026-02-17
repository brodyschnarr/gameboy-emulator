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
            { label: '⚾ 99 Master Balls', action: 'master_ball', desc: 'Adds 99 Master Balls (ID 0x01)' },
            { label: '🍬 Try Rare Candy (0x20)', action: 'rare_candy_alt', desc: 'Alternate Rare Candy ID' },
            { label: '🍬 Try Rare Candy (0x3E)', action: 'rare_candy_alt2', desc: 'Another common ID' },
            { label: '💰 Max Money', action: 'max_money', desc: 'Sets money to max' },
            { label: '🔧 Add Custom Item', action: 'custom_item', desc: 'Enter item ID + quantity' },
        ],
        'POKEMON_SLV': [
            { label: '⚾ 99 Master Balls', action: 'master_ball', desc: 'Adds 99 Master Balls (ID 0x01)' },
            { label: '🍬 Try Rare Candy (0x20)', action: 'rare_candy_alt', desc: 'Alternate Rare Candy ID' },
            { label: '🍬 Try Rare Candy (0x3E)', action: 'rare_candy_alt2', desc: 'Another common ID' },
            { label: '💰 Max Money', action: 'max_money', desc: 'Sets money to max' },
            { label: '🔧 Add Custom Item', action: 'custom_item', desc: 'Enter item ID + quantity' },
        ],
    };

    // Smart cheat functions - scan WRAM to find correct addresses
    const ITEM_IDS = {
        MASTER_BALL: 0x01, ULTRA_BALL: 0x02, GREAT_BALL: 0x05, POKE_BALL: 0x04,
        RARE_CANDY: 0x32, POTION: 0x11, SUPER_POTION: 0x12, ANTIDOTE: 0x0B,
    };

    // Find bag item pocket by scanning WRAM for the pocket structure
    // Gen 2 bag format: [count] [id1] [qty1] [id2] [qty2] ... [0xFF terminator]
    function findItemPocket() {
        // Known candidate addresses for Items pocket count byte (Gold/Silver US variants)
        const candidates = [0xD892, 0xD5B7, 0xD5E2, 0xD57C, 0xD688, 0xD8F1];
        for (const addr of candidates) {
            const count = gb.mmu.rb(addr);
            if (count >= 0 && count <= 20) {
                // Check if the structure looks valid: items followed by 0xFF terminator
                const termAddr = addr + 1 + (count * 2);
                const term = gb.mmu.rb(termAddr);
                if (term === 0xFF) {
                    // Verify existing items look reasonable (IDs between 1 and 255)
                    let valid = true;
                    for (let i = 0; i < count && i < 3; i++) {
                        const id = gb.mmu.rb(addr + 1 + i * 2);
                        const qty = gb.mmu.rb(addr + 2 + i * 2);
                        if (id === 0 || qty === 0 || qty > 99) { valid = false; break; }
                    }
                    if (valid || count === 0) {
                        console.log('Found Items pocket at 0x' + addr.toString(16) + ' with ' + count + ' items');
                        return addr;
                    }
                }
            }
        }
        // Brute force scan WRAM (C000-DFFF) for pocket-like structures
        for (let addr = 0xC000; addr < 0xDE00; addr++) {
            const count = gb.mmu.rb(addr);
            if (count >= 0 && count <= 20) {
                const termAddr = addr + 1 + (count * 2);
                if (termAddr < 0xE000) {
                    const term = gb.mmu.rb(termAddr);
                    if (term === 0xFF) {
                        let valid = true;
                        for (let i = 0; i < count && i < 3; i++) {
                            const id = gb.mmu.rb(addr + 1 + i * 2);
                            const qty = gb.mmu.rb(addr + 2 + i * 2);
                            if (id === 0 || qty === 0 || qty > 99) { valid = false; break; }
                        }
                        if (valid && count > 0 && count < 15) {
                            // Extra check: next pocket should also look valid nearby
                            console.log('Scan found possible Items pocket at 0x' + addr.toString(16) + ' count=' + count);
                            return addr;
                        }
                    }
                }
            }
        }
        return null;
    }

    function findBallsPocket() {
        // Balls pocket is usually ~50-80 bytes after items pocket
        const itemsAddr = findItemPocket();
        if (!itemsAddr) return null;
        // Scan forward from items pocket end for next pocket-like structure
        const itemCount = gb.mmu.rb(itemsAddr);
        let searchStart = itemsAddr + 1 + (itemCount * 2) + 1; // skip past FF terminator
        // Balls pocket might be key items first, then balls. Scan a range.
        for (let addr = searchStart; addr < searchStart + 200 && addr < 0xDE00; addr++) {
            const count = gb.mmu.rb(addr);
            if (count >= 0 && count <= 12) {
                const termAddr = addr + 1 + (count * 2);
                if (termAddr < 0xE000 && gb.mmu.rb(termAddr) === 0xFF) {
                    // Check if items here look like balls (IDs 1-5 range)
                    let hasBall = count === 0; // empty is ok
                    for (let i = 0; i < count; i++) {
                        const id = gb.mmu.rb(addr + 1 + i * 2);
                        if (id >= 0x01 && id <= 0x0C) hasBall = true; // ball item IDs
                    }
                    if (hasBall) {
                        console.log('Found Balls pocket at 0x' + addr.toString(16) + ' count=' + count);
                        return addr;
                    }
                }
            }
        }
        return null;
    }

    function addItemToPocket(pocketAddr, itemId, qty) {
        if (!pocketAddr) return false;
        const count = gb.mmu.rb(pocketAddr);
        // Check if item already exists in pocket
        for (let i = 0; i < count; i++) {
            const id = gb.mmu.rb(pocketAddr + 1 + i * 2);
            if (id === itemId) {
                // Update quantity
                gb.mmu.wb(pocketAddr + 2 + i * 2, qty);
                return true;
            }
        }
        // Add as new item at end
        const newSlot = count;
        gb.mmu.wb(pocketAddr, count + 1); // increment count
        gb.mmu.wb(pocketAddr + 1 + newSlot * 2, itemId); // item ID
        gb.mmu.wb(pocketAddr + 2 + newSlot * 2, qty); // quantity
        gb.mmu.wb(pocketAddr + 3 + newSlot * 2, 0xFF); // new terminator
        return true;
    }

    function applySmartCheat(action) {
        switch (action) {
            case 'rare_candy':
            case 'rare_candy_alt':
            case 'rare_candy_alt2': {
                const itemId = action === 'rare_candy_alt' ? 0x20 : (action === 'rare_candy_alt2' ? 0x3E : ITEM_IDS.RARE_CANDY);
                const addr = findItemPocket();
                if (addr) {
                    const countBefore = gb.mmu.rb(addr);
                    addItemToPocket(addr, itemId, 99);
                    const countAfter = gb.mmu.rb(addr);
                    showToast('✅ Added item 0x' + itemId.toString(16).toUpperCase() + ' at 0x' + addr.toString(16).toUpperCase() + ' (count: ' + countBefore + '→' + countAfter + ')');
                } else {
                    showToast('❌ Could not find Items pocket - open your BAG in-game first!');
                }
                break;
            }
            case 'custom_item': {
                const itemIdInput = prompt('Enter item ID in hex (e.g. 20 for some Rare Candy versions):', '20');
                if (!itemIdInput) break;
                const itemId = parseInt(itemIdInput, 16);
                if (isNaN(itemId) || itemId < 1 || itemId > 255) {
                    showToast('Invalid item ID');
                    break;
                }
                const qtyInput = prompt('Enter quantity (1-99):', '99');
                const qty = parseInt(qtyInput);
                if (isNaN(qty) || qty < 1 || qty > 99) {
                    showToast('Invalid quantity');
                    break;
                }
                const addr = findItemPocket();
                if (addr) {
                    addItemToPocket(addr, itemId, qty);
                    showToast('✅ Added item 0x' + itemId.toString(16).toUpperCase() + ' x' + qty);
                } else {
                    showToast('❌ Could not find Items pocket - open your BAG in-game first!');
                }
                break;
            }
            case 'master_ball': {
                let addr = findBallsPocket();
                if (addr) {
                    addItemToPocket(addr, ITEM_IDS.MASTER_BALL, 99);
                    showToast('✅ Master Balls added to BALLS pocket at 0x' + addr.toString(16).toUpperCase());
                } else {
                    // Fallback: add to items pocket
                    addr = findItemPocket();
                    if (addr) {
                        addItemToPocket(addr, ITEM_IDS.MASTER_BALL, 99);
                        showToast('✅ Master Balls added to ITEMS pocket (Balls pocket not found)');
                    } else {
                        showToast('❌ Could not find bag - open your BAG in-game first!');
                    }
                }
                break;
            }
            case 'max_money': {
                // Money in Gen 2 is stored as 3-byte BCD. Try known addresses.
                const moneyAddrs = [0xD573, 0xD84E, 0xD57E, 0xD5A4];
                let found = false;
                for (const addr of moneyAddrs) {
                    // Check if this looks like BCD money (each nibble 0-9)
                    const b0 = gb.mmu.rb(addr);
                    const b1 = gb.mmu.rb(addr + 1);
                    const b2 = gb.mmu.rb(addr + 2);
                    const isBCD = (v) => ((v >> 4) <= 9) && ((v & 0xF) <= 9);
                    if (isBCD(b0) && isBCD(b1) && isBCD(b2)) {
                        gb.mmu.wb(addr, 0x99);
                        gb.mmu.wb(addr + 1, 0x99);
                        gb.mmu.wb(addr + 2, 0x99);
                        console.log('Set money at 0x' + addr.toString(16));
                        found = true;
                    }
                }
                if (found) showToast('Money set to ₽999999! 💰');
                else showToast('Could not find money address');
                break;
            }
        }
    }

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
        if (!gb.romLoaded) { showToast('Load a ROM first'); return; }
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

                // Smart cheats (action-based) are one-shot, not persistent toggles
                const isActive = preset.codes && activeCheats.some(c => c.label === preset.label && c.active);
                const isSmartCheat = !!preset.action;

                const btn = document.createElement('button');
                btn.textContent = (isSmartCheat ? '⚡ ' : (isActive ? '✅ ' : '⬜ ')) + preset.label;
                btn.style.cssText = 'flex:1;padding:12px;background:' + (isActive ? '#1a4a1a' : '#2a2a5e') + ';border:1px solid ' + (isActive ? '#2a8a2a' : '#4a4a8e') + ';border-radius:8px;color:#e0e0ff;font-size:13px;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;';

                btn.addEventListener('click', () => {
                    // Smart cheats use actions instead of codes
                    if (preset.action) {
                        applySmartCheat(preset.action);
                        menu.remove();
                    } else if (preset.codes) {
                        // Old GameShark code approach
                        if (isActive) {
                            for (let i = activeCheats.length - 1; i >= 0; i--) {
                                if (activeCheats[i].label === preset.label) {
                                    activeCheats.splice(i, 1);
                                }
                            }
                            showToast(preset.label + ' OFF');
                        } else {
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
                        showCheatMenu();
                    }
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

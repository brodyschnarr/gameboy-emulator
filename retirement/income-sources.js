// ═══════════════════════════════════════════
//  Additional Income Sources Manager
// ═══════════════════════════════════════════

const IncomeSources = {
    
    sources: [],
    nextId: 1,

    types: {
        rental: { name: 'Rental Income', icon: '🏠', defaultContinues: true },
        partTime: { name: 'Part-Time Work', icon: '💼', defaultContinues: false },
        sideGig: { name: 'Side Business', icon: '🏪', defaultContinues: false },
        other: { name: 'Other Income', icon: '💰', defaultContinues: false }
    },

    /**
     * Add a new income source
     */
    add(type, amount, startAge, endAge = null, name = null, indexed = false, continuesInRetirement = null) {
        const typeInfo = this.types[type] || this.types.other;
        const source = {
            id: this.nextId++,
            type,
            name: name || typeInfo.name,
            annualAmount: amount,
            startAge,
            endAge, // null = lifetime
            indexed,
            isPension: false,
            continuesInRetirement: continuesInRetirement !== null ? continuesInRetirement : (typeInfo.defaultContinues || false)
        };

        this.sources.push(source);
        this._render();
        this._renderRetirementSummary();
        return source;
    },

    /**
     * Update a source's continuesInRetirement flag
     */
    updateContinues(id, value) {
        const source = this.sources.find(s => s.id === id);
        if (source) {
            source.continuesInRetirement = value;
            this._render();
            this._renderRetirementSummary();
        }
    },

    /**
     * Remove an income source
     */
    remove(id) {
        this.sources = this.sources.filter(s => s.id !== id);
        this._render();
        this._renderRetirementSummary();
    },

    /**
     * Get all sources
     */
    getAll() {
        return this.sources;
    },

    /**
     * Get sources that continue into retirement
     */
    getRetirementSources() {
        return this.sources.filter(s => s.continuesInRetirement);
    },

    /**
     * Clear all sources
     */
    clear() {
        this.sources = [];
        this.nextId = 1;
        this._render();
        this._renderRetirementSummary();
    },

    /**
     * Calculate total income at a given age, respecting retirement boundary
     */
    getTotalAtAge(age, retirementAge = null) {
        return this.sources
            .filter(s => {
                if (age < s.startAge) return false;
                if (s.endAge !== null && age > s.endAge) return false;
                // If retirement age given and source doesn't continue, stop at retirement
                if (retirementAge && age >= retirementAge && !s.continuesInRetirement) return false;
                return true;
            })
            .reduce((sum, s) => sum + s.annualAmount, 0);
    },

    /**
     * Render sources list in Step 1
     */
    _render() {
        const container = document.getElementById('income-sources-list');
        if (!container) return;

        if (this.sources.length === 0) {
            container.innerHTML = '<p class="empty-state">No additional income sources added</p>';
            return;
        }

        const html = this.sources.map(source => {
            const typeInfo = this.types[source.type] || { icon: '💰' };
            const ageRange = source.endAge 
                ? `Ages ${source.startAge}-${source.endAge}`
                : `Age ${source.startAge}+`;
            const retBadge = source.continuesInRetirement 
                ? '<span class="retirement-badge">📌 Into retirement</span>' 
                : '';

            return `
                <div class="income-source-item" data-id="${source.id}">
                    <div class="source-icon">${typeInfo.icon}</div>
                    <div class="source-details">
                        <div class="source-name">${source.name} ${retBadge}</div>
                        <div class="source-meta">${ageRange} • $${source.annualAmount.toLocaleString()}/year</div>
                    </div>
                    <button type="button" class="btn-remove-source" data-id="${source.id}">
                        ✕
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        // Attach remove listeners
        container.querySelectorAll('.btn-remove-source').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.closest('[data-id]').dataset.id);
                this.remove(id);
            });
        });
    },

    /**
     * Render read-only retirement income summary in Step 5
     */
    _renderRetirementSummary() {
        const container = document.getElementById('retirement-income-from-step1');
        if (!container) return;

        const retSources = this.getRetirementSources();
        
        if (retSources.length === 0) {
            container.innerHTML = '<p class="empty-state" style="font-size: 13px; color: var(--text-muted);">No income sources carrying into retirement. Add them in Step 1.</p>';
            return;
        }

        const html = retSources.map((source, i) => {
            const typeInfo = this.types[source.type] || { icon: '💰' };
            const monthly = Math.round(source.annualAmount / 12);
            return `
                <div class="income-source-item income-source-readonly" style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div class="source-icon">${typeInfo.icon}</div>
                        <div class="source-details">
                            <div class="source-name">${source.name}</div>
                            <div class="source-meta">$${monthly.toLocaleString()}/mo ($${source.annualAmount.toLocaleString()}/yr) • From Step 1</div>
                        </div>
                    </div>
                    <button type="button" class="btn-remove-step1-source" data-source-index="${i}" style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer;padding:4px 8px;" title="Remove">×</button>
                </div>
            `;
        }).join('');

        container.innerHTML = html + `
            <p style="margin: 8px 0 0; font-size: 12px; color: var(--text-muted);">
                <a href="#" class="link-to-step1" style="color: var(--primary);">← Edit in Step 1</a>
            </p>
        `;

        // Wire up remove buttons
        container.querySelectorAll('.btn-remove-step1-source').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.sourceIndex);
                const retSrc = this.sources.filter(s => s.continuesInRetirement);
                if (retSrc[idx]) {
                    const globalIdx = this.sources.indexOf(retSrc[idx]);
                    if (globalIdx >= 0) {
                        this.sources.splice(globalIdx, 1);
                        this.renderStep5Summary(container.id);
                    }
                }
            });
        });

        // Wire up "Edit in Step 1" link
        container.querySelector('.link-to-step1')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.card').forEach(c => c.classList.add('hidden'));
            document.getElementById('step-income')?.classList.remove('hidden');
            window.scrollTo(0, 0);
        });
    },

    /**
     * Initialize the add income dropdown + inline form
     */
    initModal() {
        const btn = document.getElementById('btn-add-income-source');
        const menu = document.getElementById('income-source-dropdown-menu');
        const form = document.getElementById('income-source-inline-form');

        if (!btn || !menu) return;

        this._selectedType = null;

        // Toggle dropdown
        btn.addEventListener('click', () => {
            menu.classList.toggle('hidden');
            form?.classList.add('hidden');
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        // Dropdown item click → show inline form
        menu.querySelectorAll('[data-income-type]').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.incomeType;
                this._selectedType = type;
                menu.classList.add('hidden');
                this._showInlineForm(type);
            });
        });

        // Save
        document.getElementById('inline-income-save')?.addEventListener('click', () => {
            const type = this._selectedType || 'other';
            const amount = parseFloat(document.getElementById('inline-income-amount')?.value);
            const startAge = parseInt(document.getElementById('inline-income-start-age')?.value);
            const endAgeVal = document.getElementById('inline-income-end-age')?.value;
            const endAge = endAgeVal ? parseInt(endAgeVal) : null;
            const customName = document.getElementById('inline-income-name')?.value;
            const continues = document.getElementById('inline-income-continues')?.checked || false;

            if (amount > 0 && startAge > 0) {
                this.add(type, amount, startAge, endAge, customName, false, continues);
                form?.classList.add('hidden');
                this._resetInlineForm();
            }
        });

        // Cancel
        document.getElementById('inline-income-cancel')?.addEventListener('click', () => {
            form?.classList.add('hidden');
            this._resetInlineForm();
        });
    },

    _showInlineForm(type) {
        const form = document.getElementById('income-source-inline-form');
        if (!form) return;

        const typeInfo = this.types[type] || this.types.other;
        const descriptions = {
            rental: 'Income from rental properties (after expenses). Fully taxable.',
            partTime: 'Part-time work, freelancing, or consulting income.',
            sideGig: 'Side business or self-employment income.',
            other: 'Any other recurring income source.'
        };

        document.getElementById('inline-income-type-label').textContent = `${typeInfo.icon} ${typeInfo.name}`;
        document.getElementById('inline-income-type-desc').textContent = descriptions[type] || '';

        // Set default "continues" based on type
        const cb = document.getElementById('inline-income-continues');
        if (cb) cb.checked = typeInfo.defaultContinues || false;

        form.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('inline-income-amount')?.focus();
    },

    _resetInlineForm() {
        ['inline-income-name', 'inline-income-amount', 'inline-income-start-age', 'inline-income-end-age'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const cb = document.getElementById('inline-income-continues');
        if (cb) cb.checked = false;
    }
};

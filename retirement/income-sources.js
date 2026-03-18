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

        const html = retSources.map(source => {
            const typeInfo = this.types[source.type] || { icon: '💰' };
            const monthly = Math.round(source.annualAmount / 12);
            return `
                <div class="income-source-item income-source-readonly">
                    <div class="source-icon">${typeInfo.icon}</div>
                    <div class="source-details">
                        <div class="source-name">${source.name}</div>
                        <div class="source-meta">$${monthly.toLocaleString()}/mo ($${source.annualAmount.toLocaleString()}/yr) • From Step 1</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html + `
            <p style="margin: 8px 0 0; font-size: 12px; color: var(--text-muted);">
                <a href="#" class="link-to-step1" style="color: var(--primary);">← Edit in Step 1</a>
            </p>
        `;

        // Wire up "Edit in Step 1" link
        container.querySelector('.link-to-step1')?.addEventListener('click', (e) => {
            e.preventDefault();
            // Navigate to Step 1
            document.querySelectorAll('.card').forEach(c => c.classList.add('hidden'));
            document.getElementById('step-income')?.classList.remove('hidden');
            window.scrollTo(0, 0);
        });
    },

    /**
     * Initialize the add income modal
     */
    initModal() {
        const btn = document.getElementById('btn-add-income-source');
        const modal = document.getElementById('income-source-modal');
        const closeBtn = document.getElementById('close-income-modal');
        const form = document.getElementById('income-source-form');
        const typeSelect = document.getElementById('income-source-type');

        if (!btn || !modal) return;

        // Show modal
        btn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            // Update default "continues" checkbox based on type
            this._updateModalForType(typeSelect?.value || 'rental');
        });

        // Close modal
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                form.reset();
            });
        }

        // Update type description
        if (typeSelect) {
            const updateTypeUI = (type) => {
                this._updateModalForType(type);
            };
            typeSelect.addEventListener('change', (e) => updateTypeUI(e.target.value));
            updateTypeUI(typeSelect.value);
        }

        // Form submission
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const type = document.getElementById('income-source-type').value;
                const amount = parseFloat(document.getElementById('income-amount').value);
                const startAge = parseInt(document.getElementById('income-start-age').value);
                const endAgeInput = document.getElementById('income-end-age').value;
                const endAge = endAgeInput ? parseInt(endAgeInput) : null;
                const customName = document.getElementById('income-custom-name').value;
                const continuesInRetirement = document.getElementById('income-continues-retirement')?.checked || false;

                if (amount > 0 && startAge > 0) {
                    this.add(type, amount, startAge, endAge, customName, false, continuesInRetirement);
                    modal.classList.add('hidden');
                    form.reset();
                }
            });
        }
    },

    /**
     * Update modal UI based on selected type
     */
    _updateModalForType(type) {
        const desc = document.getElementById('income-type-description');
        const continuesCheckbox = document.getElementById('income-continues-retirement');
        
        if (desc) {
            const descriptions = {
                rental: 'Income from rental properties (after expenses). Fully taxable. Counts for GIS/OAS clawback.',
                partTime: 'Part-time work, freelancing, or consulting income.',
                sideGig: 'Side business or self-employment income.',
                other: 'Any other recurring income source.'
            };
            desc.textContent = descriptions[type] || '';
        }

        // Set default "continues" based on type
        if (continuesCheckbox) {
            const typeInfo = this.types[type];
            continuesCheckbox.checked = typeInfo ? typeInfo.defaultContinues : false;
        }
    }
};

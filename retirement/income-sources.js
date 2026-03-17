// ═══════════════════════════════════════════
//  Additional Income Sources Manager
// ═══════════════════════════════════════════

const IncomeSources = {
    
    sources: [],
    nextId: 1,

    types: {
        pension: { name: 'Defined Benefit Pension', icon: '🏢' },
        annuity: { name: 'Annuity', icon: '📊' },
        rental: { name: 'Rental Income', icon: '🏠' },
        partTime: { name: 'Part-Time Work', icon: '💼' },
        other: { name: 'Other Income', icon: '💰' }
    },

    /**
     * Add a new income source
     */
    add(type, amount, startAge, endAge = null, name = null, indexed = false) {
        const source = {
            id: this.nextId++,
            type,
            name: name || this.types[type].name,
            annualAmount: amount,
            startAge,
            endAge, // null = lifetime
            indexed, // pension/annuity: grows with inflation
            isPension: (type === 'pension' || type === 'annuity')
        };

        this.sources.push(source);
        this._render();
        return source;
    },

    /**
     * Remove an income source
     */
    remove(id) {
        this.sources = this.sources.filter(s => s.id !== id);
        this._render();
    },

    /**
     * Get all sources
     */
    getAll() {
        return this.sources;
    },

    /**
     * Clear all sources
     */
    clear() {
        this.sources = [];
        this.nextId = 1;
        this._render();
    },

    /**
     * Calculate total income at a given age
     */
    getTotalAtAge(age) {
        return this.sources
            .filter(s => age >= s.startAge && (s.endAge === null || age <= s.endAge))
            .reduce((sum, s) => sum + s.annualAmount, 0);
    },

    /**
     * Render sources list
     */
    _render() {
        const container = document.getElementById('income-sources-list');
        if (!container) return;

        if (this.sources.length === 0) {
            container.innerHTML = '<p class="empty-state">No additional income sources added</p>';
            return;
        }

        const html = this.sources.map(source => {
            const typeInfo = this.types[source.type];
            const ageRange = source.endAge 
                ? `Ages ${source.startAge}-${source.endAge}`
                : `Age ${source.startAge}+`;

            return `
                <div class="income-source-item" data-id="${source.id}">
                    <div class="source-icon">${typeInfo.icon}</div>
                    <div class="source-details">
                        <div class="source-name">${source.name}</div>
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
        document.querySelectorAll('.btn-remove-source').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.remove(id);
            });
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
        });

        // Close modal
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                form.reset();
            });
        }

        // Update type description and show/hide pension options
        if (typeSelect) {
            const updateTypeUI = (type) => {
                const desc = document.getElementById('income-type-description');
                const pensionOpts = document.getElementById('income-pension-options');
                if (desc) {
                    const descriptions = {
                        pension: 'Regular monthly payments from a defined benefit pension plan. Qualifies for pension income credit at 65+.',
                        annuity: 'Fixed annual payments from an annuity contract. Qualifies for pension income credit at 65+.',
                        rental: 'Income from rental properties (after expenses). Taxable as regular income.',
                        partTime: 'Part-time work or consulting income',
                        other: 'Any other recurring income'
                    };
                    desc.textContent = descriptions[type] || '';
                }
                if (pensionOpts) {
                    pensionOpts.classList.toggle('hidden', type !== 'pension' && type !== 'annuity');
                }
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

                if (amount > 0 && startAge > 0) {
                    const indexed = document.getElementById('income-indexed')?.checked || false;
                    const isPension = (type === 'pension' || type === 'annuity');
                    this.add(type, amount, startAge, endAge, customName, isPension ? indexed : false);
                    modal.classList.add('hidden');
                    form.reset();
                }
            });
        }
    }
};

// ═══════════════════════════════════════════
//  Windfall Manager - Home Sales, Inheritances, etc.
//  Handles probability-weighted one-time events
// ═══════════════════════════════════════════

const WindfallManager = {
    /**
     * Apply windfalls to a projection
     * @param {Array} projection - Year-by-year projection
     * @param {Array} windfalls - List of windfall events
     * @param {Object} inputs - Base calculation inputs
     * @param {Boolean} randomize - If true, randomize based on probability
     * @returns {Array} Updated projection
     */
    applyWindfalls(projection, windfalls, inputs, randomize = false) {
        if (!windfalls || windfalls.length === 0) {
            return projection;
        }
        
        // Clone projection to avoid mutation
        const updatedProjection = JSON.parse(JSON.stringify(projection));
        
        windfalls.forEach(windfall => {
            // Determine if windfall occurs (if randomizing)
            const occurs = randomize 
                ? (Math.random() * 100 <= windfall.probability)
                : true; // In base case, assume all windfalls occur
            
            if (!occurs) return;
            
            // Find the year in projection
            const targetYear = windfall.year || (inputs.currentAge + windfall.yearsFromNow);
            const yearIndex = updatedProjection.findIndex(y => y.age === targetYear);
            
            if (yearIndex === -1) return; // Year not in projection
            
            const year = updatedProjection[yearIndex];
            
            // Calculate after-tax amount
            const afterTaxAmount = windfall.taxable
                ? this._calculateAfterTaxAmount(windfall.amount, year.income || 0, inputs.province)
                : windfall.amount;
            
            // Add to appropriate account(s)
            if (windfall.destination === 'rrsp') {
                year.rrsp = (year.rrsp || 0) + afterTaxAmount;
            } else if (windfall.destination === 'tfsa') {
                year.tfsa = (year.tfsa || 0) + afterTaxAmount;
            } else if (windfall.destination === 'nonReg') {
                year.nonReg = (year.nonReg || 0) + afterTaxAmount;
            } else if (windfall.destination === 'split') {
                // Default split: TFSA first (up to contribution room), then non-reg
                const tfsaSpace = 100000; // Simplified (assume some TFSA room)
                const toTFSA = Math.min(afterTaxAmount, tfsaSpace);
                const toNonReg = afterTaxAmount - toTFSA;
                
                year.tfsa = (year.tfsa || 0) + toTFSA;
                year.nonReg = (year.nonReg || 0) + toNonReg;
            }
            
            // Update total portfolio
            year.totalPortfolio = (year.rrsp || 0) + (year.tfsa || 0) + (year.nonReg || 0);
            
            // Mark windfall event
            year.windfall = {
                name: windfall.name,
                amount: windfall.amount,
                afterTaxAmount,
                probability: windfall.probability,
                occurred: true
            };
            
            // Compound forward (windfall grows in subsequent years)
            for (let i = yearIndex + 1; i < updatedProjection.length; i++) {
                const nextYear = updatedProjection[i];
                const returnRate = inputs.returnRate / 100;
                
                // Growth applies to all accounts
                if (windfall.destination === 'rrsp' || windfall.destination === 'split') {
                    nextYear.rrsp = (nextYear.rrsp || 0) * (1 + returnRate);
                }
                if (windfall.destination === 'tfsa' || windfall.destination === 'split') {
                    nextYear.tfsa = (nextYear.tfsa || 0) * (1 + returnRate);
                }
                if (windfall.destination === 'nonReg' || windfall.destination === 'split') {
                    nextYear.nonReg = (nextYear.nonReg || 0) * (1 + returnRate);
                }
                
                nextYear.totalPortfolio = (nextYear.rrsp || 0) + (nextYear.tfsa || 0) + (nextYear.nonReg || 0);
            }
        });
        
        return updatedProjection;
    },
    
    /**
     * Calculate after-tax amount for taxable windfall
     */
    _calculateAfterTaxAmount(amount, currentIncome, province) {
        // Simplified tax calculation
        // In reality, this would integrate with canada-tax.js
        
        const totalIncome = currentIncome + amount;
        let taxRate = 0;
        
        if (totalIncome < 50000) {
            taxRate = 0.20; // ~20% combined
        } else if (totalIncome < 100000) {
            taxRate = 0.30; // ~30% combined
        } else if (totalIncome < 200000) {
            taxRate = 0.40; // ~40% combined
        } else {
            taxRate = 0.50; // ~50% combined
        }
        
        const taxOnWindfall = amount * taxRate;
        return amount - taxOnWindfall;
    },
    
    /**
     * Calculate expected value (probability-weighted)
     */
    calculateExpectedValue(windfalls) {
        return windfalls.reduce((total, w) => {
            return total + (w.amount * (w.probability / 100));
        }, 0);
    },
    
    /**
     * Compare scenarios with/without windfalls
     */
    compareScenarios(baseProjection, windfalls, inputs) {
        const withoutWindfalls = baseProjection;
        const withWindfalls = this.applyWindfalls(baseProjection, windfalls, inputs, false);
        
        const basePortfolio = this._finalPortfolio(withoutWindfalls);
        const windfallPortfolio = this._finalPortfolio(withWindfalls);
        
        const improvement = windfallPortfolio - basePortfolio;
        const improvementPercent = (improvement / basePortfolio) * 100;
        
        return {
            withoutWindfalls: {
                finalPortfolio: basePortfolio,
                projection: withoutWindfalls
            },
            withWindfalls: {
                finalPortfolio: windfallPortfolio,
                projection: withWindfalls
            },
            impact: {
                amount: improvement,
                percent: improvementPercent
            }
        };
    },
    
    _finalPortfolio(projection) {
        if (!projection || projection.length === 0) return 0;
        return projection[projection.length - 1].totalPortfolio || 0;
    },
    
    /**
     * Validate windfall object
     */
    validate(windfall) {
        const errors = [];
        
        if (!windfall.name || windfall.name.trim() === '') {
            errors.push('Name is required');
        }
        
        if (!windfall.amount || windfall.amount <= 0) {
            errors.push('Amount must be greater than zero');
        }
        
        if (windfall.probability < 0 || windfall.probability > 100) {
            errors.push('Probability must be between 0 and 100');
        }
        
        if (!windfall.year && !windfall.yearsFromNow) {
            errors.push('Year or yearsFromNow is required');
        }
        
        if (!['rrsp', 'tfsa', 'nonReg', 'split'].includes(windfall.destination)) {
            errors.push('Destination must be rrsp, tfsa, nonReg, or split');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    /**
     * Get summary statistics for windfalls
     */
    getSummary(windfalls) {
        if (!windfalls || windfalls.length === 0) {
            return {
                count: 0,
                totalAmount: 0,
                expectedValue: 0,
                highestAmount: 0,
                lowestAmount: 0
            };
        }
        
        const amounts = windfalls.map(w => w.amount);
        const expectedValue = this.calculateExpectedValue(windfalls);
        
        return {
            count: windfalls.length,
            totalAmount: amounts.reduce((sum, a) => sum + a, 0),
            expectedValue,
            highestAmount: Math.max(...amounts),
            lowestAmount: Math.min(...amounts),
            averageProbability: windfalls.reduce((sum, w) => sum + w.probability, 0) / windfalls.length
        };
    },
    
    /**
     * Render windfall list UI
     */
    renderList(windfalls, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!windfalls || windfalls.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No windfalls added yet. Click "Add Windfall" to model potential one-time events.</p>
                </div>
            `;
            return;
        }
        
        const summary = this.getSummary(windfalls);
        
        const html = `
            <div class="windfalls-summary">
                <div class="summary-grid">
                    <div class="summary-stat">
                        <div class="stat-label">Total Count</div>
                        <div class="stat-value">${summary.count}</div>
                    </div>
                    <div class="summary-stat">
                        <div class="stat-label">Total Amount</div>
                        <div class="stat-value">$${(summary.totalAmount / 1000).toFixed(0)}K</div>
                    </div>
                    <div class="summary-stat">
                        <div class="stat-label">Expected Value</div>
                        <div class="stat-value">$${(summary.expectedValue / 1000).toFixed(0)}K</div>
                    </div>
                    <div class="summary-stat">
                        <div class="stat-label">Avg Probability</div>
                        <div class="stat-value">${summary.averageProbability.toFixed(0)}%</div>
                    </div>
                </div>
            </div>
            
            <div class="windfalls-list">
                ${windfalls.map((w, index) => `
                    <div class="windfall-item" data-index="${index}">
                        <div class="windfall-header">
                            <div class="windfall-name">${w.name}</div>
                            <div class="windfall-amount">$${(w.amount / 1000).toFixed(0)}K</div>
                        </div>
                        <div class="windfall-details">
                            <span>Year: ${w.year || 'Age ' + (w.yearsFromNow ? '+' + w.yearsFromNow : '?')}</span>
                            <span>•</span>
                            <span>Probability: ${w.probability}%</span>
                            <span>•</span>
                            <span>${w.taxable ? 'Taxable' : 'Non-taxable'}</span>
                            <span>•</span>
                            <span>→ ${w.destination.toUpperCase()}</span>
                        </div>
                        <div class="windfall-actions">
                            <button class="btn-edit-windfall" data-index="${index}">Edit</button>
                            <button class="btn-delete-windfall" data-index="${index}">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = html;
        this._attachListeners();
    },
    
    /**
     * Render windfall form
     */
    renderForm(containerId, windfall = null, onSave = null, onCancel = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const isEdit = windfall !== null;
        
        const html = `
            <div class="windfall-form">
                <h4>${isEdit ? 'Edit' : 'Add'} Windfall</h4>
                
                <div class="form-group">
                    <label>Name/Description</label>
                    <input type="text" id="windfall-name" placeholder="e.g., Home sale, Inheritance from parents"
                        value="${windfall?.name || ''}" />
                    <small>What is this windfall?</small>
                </div>
                
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" id="windfall-amount" placeholder="250000"
                        value="${windfall?.amount || ''}" step="1000" />
                    <small>Expected amount before tax</small>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Year (or Age)</label>
                        <input type="number" id="windfall-year" placeholder="2030 or 65"
                            value="${windfall?.year || ''}" />
                        <small>When will this occur?</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Probability (%)</label>
                        <input type="number" id="windfall-probability" placeholder="75"
                            value="${windfall?.probability || 50}" min="0" max="100" />
                        <small>How likely? (0-100%)</small>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Tax Treatment</label>
                        <select id="windfall-taxable">
                            <option value="false" ${windfall?.taxable === false ? 'selected' : ''}>Non-taxable</option>
                            <option value="true" ${windfall?.taxable === true ? 'selected' : ''}>Taxable</option>
                        </select>
                        <small>Inheritance = non-taxable, Business sale = taxable</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Destination Account</label>
                        <select id="windfall-destination">
                            <option value="split" ${windfall?.destination === 'split' ? 'selected' : ''}>Auto (TFSA + Non-Reg)</option>
                            <option value="tfsa" ${windfall?.destination === 'tfsa' ? 'selected' : ''}>TFSA</option>
                            <option value="rrsp" ${windfall?.destination === 'rrsp' ? 'selected' : ''}>RRSP</option>
                            <option value="nonReg" ${windfall?.destination === 'nonReg' ? 'selected' : ''}>Non-Registered</option>
                        </select>
                        <small>Where to deposit?</small>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn-primary" id="save-windfall">${isEdit ? 'Update' : 'Add'} Windfall</button>
                    <button class="btn-secondary" id="cancel-windfall">Cancel</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Attach save/cancel handlers
        document.getElementById('save-windfall')?.addEventListener('click', () => {
            const data = {
                name: document.getElementById('windfall-name').value,
                amount: parseFloat(document.getElementById('windfall-amount').value),
                year: parseInt(document.getElementById('windfall-year').value),
                probability: parseFloat(document.getElementById('windfall-probability').value),
                taxable: document.getElementById('windfall-taxable').value === 'true',
                destination: document.getElementById('windfall-destination').value
            };
            
            const validation = this.validate(data);
            if (!validation.valid) {
                alert('Validation errors:\n' + validation.errors.join('\n'));
                return;
            }
            
            onSave && onSave(data);
        });
        
        document.getElementById('cancel-windfall')?.addEventListener('click', () => {
            onCancel && onCancel();
        });
    },
    
    _attachListeners() {
        // Implemented by app controller
    }
};

console.log('[WindfallManager] Module loaded');

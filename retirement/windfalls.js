// ═══════════════════════════════════════════
//  Windfall Manager V2 - Shares, Inheritances, Simple Events
//  Three windfall types:
//    simple:    Fixed amount at specific age with probability %
//    shares:    Current value + growth rate + sell age
//    uncertain: Base amount ± range, target age ± range
// ═══════════════════════════════════════════

const WindfallManager = {
    /**
     * Apply windfalls to a projection
     */
    applyWindfalls(projection, windfalls, inputs, randomize = false) {
        if (!windfalls || windfalls.length === 0) return projection;
        
        const updatedProjection = JSON.parse(JSON.stringify(projection));
        
        windfalls.forEach(windfall => {
            const resolved = this._resolveWindfall(windfall, inputs, randomize);
            if (!resolved) return; // Didn't occur
            
            const yearIndex = updatedProjection.findIndex(y => y.age === resolved.age);
            if (yearIndex === -1) return;
            
            const year = updatedProjection[yearIndex];
            const afterTaxAmount = windfall.taxable
                ? this._calculateAfterTaxAmount(resolved.amount, year.income || 0, inputs.province)
                : resolved.amount;
            
            if (windfall.destination === 'rrsp') {
                year.rrsp = (year.rrsp || 0) + afterTaxAmount;
            } else if (windfall.destination === 'tfsa') {
                year.tfsa = (year.tfsa || 0) + afterTaxAmount;
            } else if (windfall.destination === 'nonReg') {
                year.nonReg = (year.nonReg || 0) + afterTaxAmount;
            } else {
                const toTFSA = Math.min(afterTaxAmount, 100000);
                year.tfsa = (year.tfsa || 0) + toTFSA;
                year.nonReg = (year.nonReg || 0) + (afterTaxAmount - toTFSA);
            }
            
            year.totalPortfolio = (year.rrsp || 0) + (year.tfsa || 0) + (year.nonReg || 0);
            year.windfall = { name: windfall.name, amount: resolved.amount, afterTaxAmount, occurred: true };
            
            for (let i = yearIndex + 1; i < updatedProjection.length; i++) {
                const ny = updatedProjection[i];
                const r = inputs.returnRate / 100;
                if (windfall.destination === 'rrsp' || windfall.destination === 'split') ny.rrsp = (ny.rrsp || 0) * (1 + r);
                if (windfall.destination === 'tfsa' || windfall.destination === 'split') ny.tfsa = (ny.tfsa || 0) * (1 + r);
                if (windfall.destination === 'nonReg' || windfall.destination === 'split') ny.nonReg = (ny.nonReg || 0) * (1 + r);
                ny.totalPortfolio = (ny.rrsp || 0) + (ny.tfsa || 0) + (ny.nonReg || 0);
            }
        });
        
        return updatedProjection;
    },

    /**
     * Resolve a windfall for a specific simulation run.
     * Returns { age, amount } or null if it didn't occur.
     */
    _resolveWindfall(windfall, inputs, randomize) {
        const type = windfall.type || 'simple';
        
        if (type === 'shares') {
            // Company shares: grow current value at custom rate until sell age
            const currentValue = windfall.currentValue || windfall.amount || 0;
            const growthRate = (windfall.growthRate || 6) / 100;
            const sellAge = windfall.sellAge || windfall.year || (inputs.currentAge + 5);
            const yearsToSell = sellAge - inputs.currentAge;
            if (yearsToSell <= 0) return { age: inputs.currentAge, amount: currentValue };
            const futureValue = currentValue * Math.pow(1 + growthRate, yearsToSell);
            return { age: sellAge, amount: Math.round(futureValue) };
        }
        
        if (type === 'uncertain') {
            // Uncertain windfall: base amount ± amountRange, target age ± ageRange
            const baseAmount = windfall.amount || 0;
            const amountRange = windfall.amountRange || 0;
            const baseAge = windfall.year || 65;
            const ageRange = windfall.ageRange || 0;
            
            if (randomize) {
                // Normal-ish distribution using central limit theorem (sum of 3 uniforms)
                const randNorm = () => {
                    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
                    return (u1 + u2 + u3 - 1.5) / 0.5; // roughly N(0,1)
                };
                const amountNoise = randNorm() * (amountRange / 2); // ±range covers ~95%
                const resolvedAmount = Math.max(0, baseAmount + amountNoise);
                const ageNoise = Math.round(randNorm() * (ageRange / 2));
                const resolvedAge = Math.max(inputs.currentAge + 1, Math.min(inputs.lifeExpectancy, baseAge + ageNoise));
                return { age: resolvedAge, amount: Math.round(resolvedAmount) };
            } else {
                // Deterministic: use base values
                return { age: baseAge, amount: baseAmount };
            }
        }
        
        // Simple windfall (original behavior)
        if (randomize && Math.random() * 100 > (windfall.probability || 100)) {
            return null; // Didn't occur
        }
        const age = windfall.year || (inputs.currentAge + (windfall.yearsFromNow || 0));
        return { age, amount: windfall.amount };
    },

    _calculateAfterTaxAmount(amount, currentIncome, province) {
        const totalIncome = currentIncome + amount;
        let taxRate = 0;
        if (totalIncome < 50000) taxRate = 0.20;
        else if (totalIncome < 100000) taxRate = 0.30;
        else if (totalIncome < 200000) taxRate = 0.40;
        else taxRate = 0.50;
        return amount - (amount * taxRate);
    },

    calculateExpectedValue(windfalls) {
        return windfalls.reduce((total, w) => {
            const type = w.type || 'simple';
            if (type === 'shares') {
                return total + (w.currentValue || w.amount || 0);
            }
            if (type === 'uncertain') {
                return total + (w.amount || 0); // base amount
            }
            return total + (w.amount * ((w.probability || 100) / 100));
        }, 0);
    },

    compareScenarios(baseProjection, windfalls, inputs) {
        const withWindfalls = this.applyWindfalls(baseProjection, windfalls, inputs, false);
        const basePortfolio = this._finalPortfolio(baseProjection);
        const windfallPortfolio = this._finalPortfolio(withWindfalls);
        const improvement = windfallPortfolio - basePortfolio;
        return {
            withoutWindfalls: { finalPortfolio: basePortfolio, projection: baseProjection },
            withWindfalls: { finalPortfolio: windfallPortfolio, projection: withWindfalls },
            impact: { amount: improvement, percent: basePortfolio > 0 ? (improvement / basePortfolio) * 100 : 0 }
        };
    },

    _finalPortfolio(projection) {
        if (!projection || projection.length === 0) return 0;
        return projection[projection.length - 1].totalPortfolio || 0;
    },

    validate(windfall) {
        const errors = [];
        const type = windfall.type || 'simple';
        
        if (!windfall.name || windfall.name.trim() === '') errors.push('Name is required');
        
        if (type === 'shares') {
            if (!windfall.currentValue || windfall.currentValue <= 0) errors.push('Current value must be > 0');
            if (!windfall.sellAge) errors.push('Sell age is required');
        } else if (type === 'uncertain') {
            if (!windfall.amount || windfall.amount <= 0) errors.push('Base amount must be > 0');
            if (!windfall.year) errors.push('Target age is required');
        } else {
            if (!windfall.amount || windfall.amount <= 0) errors.push('Amount must be > 0');
            if (windfall.probability < 0 || windfall.probability > 100) errors.push('Probability must be 0-100');
            if (!windfall.year && !windfall.yearsFromNow) errors.push('Year or age is required');
        }
        
        if (!['rrsp', 'tfsa', 'nonReg', 'split'].includes(windfall.destination || 'split')) {
            errors.push('Invalid destination');
        }
        
        return { valid: errors.length === 0, errors };
    },

    getSummary(windfalls) {
        if (!windfalls || windfalls.length === 0) {
            return { count: 0, totalAmount: 0, expectedValue: 0, highestAmount: 0, lowestAmount: 0, averageProbability: 100 };
        }
        const amounts = windfalls.map(w => {
            if (w.type === 'shares') return w.currentValue || w.amount || 0;
            return w.amount || 0;
        });
        return {
            count: windfalls.length,
            totalAmount: amounts.reduce((s, a) => s + a, 0),
            expectedValue: this.calculateExpectedValue(windfalls),
            highestAmount: Math.max(...amounts),
            lowestAmount: Math.min(...amounts),
            averageProbability: windfalls.reduce((s, w) => s + (w.probability || 100), 0) / windfalls.length
        };
    },

    renderList(windfalls, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!windfalls || windfalls.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No windfalls added yet.</p></div>';
            return;
        }
        
        const fmt = (v) => '$' + Math.round(v).toLocaleString();
        
        const html = `
            <div class="windfalls-list">
                ${windfalls.map((w, index) => {
                    const type = w.type || 'simple';
                    let subtitle = '';
                    let badge = '';
                    
                    if (type === 'shares') {
                        badge = '<span class="windfall-badge shares">📈 Shares</span>';
                        const growthYears = (w.sellAge || 65) - 31; // approximate
                        subtitle = `Current: ${fmt(w.currentValue || w.amount)} → Sell at age ${w.sellAge} (${w.growthRate || 6}% growth/yr)`;
                    } else if (type === 'uncertain') {
                        badge = '<span class="windfall-badge uncertain">🎲 Uncertain</span>';
                        const ageStr = w.ageRange ? `age ${w.year} ± ${w.ageRange} yrs` : `age ${w.year}`;
                        const amtStr = w.amountRange ? `${fmt(w.amount)} ± ${fmt(w.amountRange)}` : fmt(w.amount);
                        subtitle = `${amtStr} around ${ageStr}`;
                    } else {
                        badge = '<span class="windfall-badge simple">💰 Fixed</span>';
                        subtitle = `${fmt(w.amount)} at age ${w.year} • ${w.probability || 100}% chance`;
                    }
                    
                    return `
                        <div class="windfall-item" data-index="${index}">
                            <div class="windfall-header">
                                <div class="windfall-name">${badge} ${w.name}</div>
                            </div>
                            <div class="windfall-details">${subtitle}</div>
                            <div class="windfall-details">
                                <span>${w.taxable ? 'Taxable' : 'Non-taxable'}</span>
                                <span>•</span>
                                <span>→ ${(w.destination || 'split').toUpperCase()}</span>
                            </div>
                            <div class="windfall-actions">
                                <button class="btn-edit-windfall" data-index="${index}">Edit</button>
                                <button class="btn-delete-windfall" data-index="${index}">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        container.innerHTML = html;
        this._attachListeners();
    },

    renderForm(containerId, windfall = null, onSave = null, onCancel = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const isEdit = windfall !== null;
        const type = windfall?.type || 'simple';
        
        const html = `
            <div class="windfall-form">
                <h4>${isEdit ? 'Edit' : 'Add'} Windfall</h4>
                
                <div class="form-group">
                    <label>Type</label>
                    <div class="windfall-type-selector">
                        <button type="button" class="wf-type-btn ${type === 'simple' ? 'active' : ''}" data-type="simple">💰 Fixed Amount</button>
                        <button type="button" class="wf-type-btn ${type === 'shares' ? 'active' : ''}" data-type="shares">📈 Company Shares</button>
                        <button type="button" class="wf-type-btn ${type === 'uncertain' ? 'active' : ''}" data-type="uncertain">🎲 Uncertain</button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="windfall-name" placeholder="e.g., Inheritance, Stock options" value="${windfall?.name || ''}" />
                </div>
                
                <!-- Simple fields -->
                <div id="wf-simple-fields" class="${type === 'simple' ? '' : 'hidden'}">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Amount</label>
                            <div class="input-with-prefix"><span class="prefix">$</span>
                                <input type="number" id="windfall-amount" placeholder="250000" value="${type === 'simple' ? (windfall?.amount || '') : ''}" step="1000" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>At Age</label>
                            <input type="number" id="windfall-year" placeholder="55" value="${type === 'simple' ? (windfall?.year || '') : ''}" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Probability</label>
                        <div class="slider-container">
                            <input type="range" id="windfall-probability" min="0" max="100" value="${windfall?.probability || 75}" step="5" />
                            <div class="slider-labels"><span>0%</span><span>50%</span><span>100%</span></div>
                        </div>
                        <div style="text-align:center;font-weight:600;color:var(--primary);" id="wf-prob-display">${windfall?.probability || 75}%</div>
                    </div>
                </div>
                
                <!-- Shares fields -->
                <div id="wf-shares-fields" class="${type === 'shares' ? '' : 'hidden'}">
                    <div class="form-group">
                        <label>Current Value</label>
                        <div class="input-with-prefix"><span class="prefix">$</span>
                            <input type="number" id="windfall-current-value" placeholder="200000" value="${windfall?.currentValue || ''}" step="1000" />
                        </div>
                        <small>What your shares are worth today</small>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Expected Growth</label>
                            <div class="input-with-prefix"><span class="prefix">%/yr</span>
                                <input type="number" id="windfall-growth-rate" placeholder="15" value="${windfall?.growthRate || ''}" step="1" />
                            </div>
                            <small>Annual growth rate</small>
                        </div>
                        <div class="form-group">
                            <label>Sell at Age</label>
                            <input type="number" id="windfall-sell-age" placeholder="40" value="${windfall?.sellAge || ''}" />
                            <small>When you plan to sell</small>
                        </div>
                    </div>
                    <div id="shares-preview" class="windfall-preview"></div>
                </div>
                
                <!-- Uncertain fields -->
                <div id="wf-uncertain-fields" class="${type === 'uncertain' ? '' : 'hidden'}">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Expected Amount</label>
                            <div class="input-with-prefix"><span class="prefix">$</span>
                                <input type="number" id="windfall-base-amount" placeholder="500000" value="${type === 'uncertain' ? (windfall?.amount || '') : ''}" step="1000" />
                            </div>
                            <small>Your best guess</small>
                        </div>
                        <div class="form-group">
                            <label>± Range</label>
                            <div class="input-with-prefix"><span class="prefix">$</span>
                                <input type="number" id="windfall-amount-range" placeholder="200000" value="${windfall?.amountRange || ''}" step="1000" />
                            </div>
                            <small>Could be this much more or less</small>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Around Age</label>
                            <input type="number" id="windfall-target-age" placeholder="55" value="${type === 'uncertain' ? (windfall?.year || '') : ''}" />
                            <small>Your best guess</small>
                        </div>
                        <div class="form-group">
                            <label>± Years</label>
                            <input type="number" id="windfall-age-range" placeholder="5" value="${windfall?.ageRange || ''}" min="0" max="20" />
                            <small>Could be this many years earlier/later</small>
                        </div>
                    </div>
                    <div id="uncertain-preview" class="windfall-preview"></div>
                </div>
                
                <!-- Common fields -->
                <div class="form-row">
                    <div class="form-group">
                        <label>Tax Treatment</label>
                        <select id="windfall-taxable">
                            <option value="false" ${windfall?.taxable === false ? 'selected' : ''}>Non-taxable</option>
                            <option value="true" ${windfall?.taxable === true ? 'selected' : ''}>Taxable</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Destination</label>
                        <select id="windfall-destination">
                            <option value="split" ${(windfall?.destination || 'split') === 'split' ? 'selected' : ''}>Auto (TFSA + Non-Reg)</option>
                            <option value="tfsa" ${windfall?.destination === 'tfsa' ? 'selected' : ''}>TFSA</option>
                            <option value="rrsp" ${windfall?.destination === 'rrsp' ? 'selected' : ''}>RRSP</option>
                            <option value="nonReg" ${windfall?.destination === 'nonReg' ? 'selected' : ''}>Non-Registered</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn-primary" id="save-windfall">${isEdit ? 'Update' : 'Add'}</button>
                    <button class="btn-secondary" id="cancel-windfall">Cancel</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Type selector
        let currentType = type;
        container.querySelectorAll('.wf-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.wf-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentType = btn.dataset.type;
                document.getElementById('wf-simple-fields').classList.toggle('hidden', currentType !== 'simple');
                document.getElementById('wf-shares-fields').classList.toggle('hidden', currentType !== 'shares');
                document.getElementById('wf-uncertain-fields').classList.toggle('hidden', currentType !== 'uncertain');
            });
        });
        
        // Probability slider live display
        const probSlider = document.getElementById('windfall-probability');
        const probDisplay = document.getElementById('wf-prob-display');
        if (probSlider && probDisplay) {
            probSlider.addEventListener('input', () => {
                probDisplay.textContent = probSlider.value + '%';
            });
        }
        
        // Shares preview
        const updateSharesPreview = () => {
            const cv = parseFloat(document.getElementById('windfall-current-value')?.value) || 0;
            const gr = parseFloat(document.getElementById('windfall-growth-rate')?.value) || 0;
            const sa = parseInt(document.getElementById('windfall-sell-age')?.value) || 0;
            const preview = document.getElementById('shares-preview');
            if (preview && cv > 0 && sa > 0) {
                const years = Math.max(1, sa - 31); // approximate current age
                const fv = cv * Math.pow(1 + gr / 100, years);
                preview.innerHTML = `<div class="preview-calc">📊 Projected value at sale: <strong>$${Math.round(fv).toLocaleString()}</strong> (${years} years of ${gr}% growth)</div>`;
            }
        };
        ['windfall-current-value', 'windfall-growth-rate', 'windfall-sell-age'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', updateSharesPreview);
        });
        updateSharesPreview();
        
        // Uncertain preview
        const updateUncertainPreview = () => {
            const ba = parseFloat(document.getElementById('windfall-base-amount')?.value) || 0;
            const ar = parseFloat(document.getElementById('windfall-amount-range')?.value) || 0;
            const ta = parseInt(document.getElementById('windfall-target-age')?.value) || 0;
            const yr = parseInt(document.getElementById('windfall-age-range')?.value) || 0;
            const preview = document.getElementById('uncertain-preview');
            if (preview && ba > 0) {
                const fmt = (v) => '$' + Math.round(v).toLocaleString();
                const low = Math.max(0, ba - ar);
                const high = ba + ar;
                const ageLow = Math.max(18, ta - yr);
                const ageHigh = ta + yr;
                preview.innerHTML = `<div class="preview-calc">🎲 Range: <strong>${fmt(low)} – ${fmt(high)}</strong> between ages <strong>${ageLow} – ${ageHigh}</strong></div>`;
            }
        };
        ['windfall-base-amount', 'windfall-amount-range', 'windfall-target-age', 'windfall-age-range'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', updateUncertainPreview);
        });
        updateUncertainPreview();
        
        // Save
        document.getElementById('save-windfall')?.addEventListener('click', () => {
            let data;
            if (currentType === 'shares') {
                data = {
                    type: 'shares',
                    name: document.getElementById('windfall-name').value || 'Company Shares',
                    currentValue: parseFloat(document.getElementById('windfall-current-value').value) || 0,
                    amount: parseFloat(document.getElementById('windfall-current-value').value) || 0,
                    growthRate: parseFloat(document.getElementById('windfall-growth-rate').value) || 6,
                    sellAge: parseInt(document.getElementById('windfall-sell-age').value) || 65,
                    year: parseInt(document.getElementById('windfall-sell-age').value) || 65,
                    probability: 100,
                    taxable: document.getElementById('windfall-taxable').value === 'true',
                    destination: document.getElementById('windfall-destination').value || 'split'
                };
            } else if (currentType === 'uncertain') {
                data = {
                    type: 'uncertain',
                    name: document.getElementById('windfall-name').value || 'Inheritance',
                    amount: parseFloat(document.getElementById('windfall-base-amount').value) || 0,
                    amountRange: parseFloat(document.getElementById('windfall-amount-range').value) || 0,
                    year: parseInt(document.getElementById('windfall-target-age').value) || 65,
                    ageRange: parseInt(document.getElementById('windfall-age-range').value) || 0,
                    probability: 100,
                    taxable: document.getElementById('windfall-taxable').value === 'true',
                    destination: document.getElementById('windfall-destination').value || 'split'
                };
            } else {
                data = {
                    type: 'simple',
                    name: document.getElementById('windfall-name').value || 'Windfall',
                    amount: parseFloat(document.getElementById('windfall-amount').value) || 0,
                    year: parseInt(document.getElementById('windfall-year').value) || 65,
                    probability: parseFloat(document.getElementById('windfall-probability').value) || 75,
                    taxable: document.getElementById('windfall-taxable').value === 'true',
                    destination: document.getElementById('windfall-destination').value || 'split'
                };
            }
            
            const validation = this.validate(data);
            if (!validation.valid) {
                alert('Please fix:\n' + validation.errors.join('\n'));
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

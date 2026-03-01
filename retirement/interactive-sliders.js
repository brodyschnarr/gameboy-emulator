// ═══════════════════════════════════════════
//  Interactive Sliders - Real-time "What-If" Adjustments
//  Adjust spending/returns/etc and see instant updates
// ═══════════════════════════════════════════

const InteractiveSliders = {
    baseInputs: null,
    baseResults: null,
    currentAdjustments: {},
    
    /**
     * Initialize interactive sliders
     */
    init(inputs, results) {
        this.baseInputs = inputs;
        this.baseResults = results;
        this.currentAdjustments = {};
        
        console.log('[InteractiveSliders] Initialized');
    },
    
    /**
     * Render interactive slider controls
     */
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const html = `
            <div class="interactive-sliders">
                <h3>🎛️ Interactive What-If Sliders</h3>
                <p>Drag sliders to see how changes affect your retirement instantly:</p>
                
                <div class="slider-section">
                    <div class="slider-group">
                        <label class="slider-label">
                            <span class="slider-name">Annual Spending</span>
                            <span class="slider-value" id="spending-value">$${this.baseInputs.annualSpending.toLocaleString()}</span>
                        </label>
                        <input type="range" 
                               class="slider" 
                               id="spending-slider"
                               min="${Math.round(this.baseInputs.annualSpending * 0.5)}"
                               max="${Math.round(this.baseInputs.annualSpending * 1.5)}"
                               step="1000"
                               value="${this.baseInputs.annualSpending}">
                        <div class="slider-hint">Range: $${(this.baseInputs.annualSpending * 0.5).toLocaleString()} - $${(this.baseInputs.annualSpending * 1.5).toLocaleString()}</div>
                    </div>
                    
                    <div class="slider-group">
                        <label class="slider-label">
                            <span class="slider-name">Expected Returns</span>
                            <span class="slider-value" id="returns-value">${this.baseInputs.returnRate}%</span>
                        </label>
                        <input type="range" 
                               class="slider" 
                               id="returns-slider"
                               min="2"
                               max="12"
                               step="0.5"
                               value="${this.baseInputs.returnRate}">
                        <div class="slider-hint">Range: 2% - 12%</div>
                    </div>
                    
                    <div class="slider-group">
                        <label class="slider-label">
                            <span class="slider-name">Inflation Rate</span>
                            <span class="slider-value" id="inflation-value">${this.baseInputs.inflationRate}%</span>
                        </label>
                        <input type="range" 
                               class="slider" 
                               id="inflation-slider"
                               min="0"
                               max="6"
                               step="0.5"
                               value="${this.baseInputs.inflationRate}">
                        <div class="slider-hint">Range: 0% - 6%</div>
                    </div>
                    
                    <div class="slider-group">
                        <label class="slider-label">
                            <span class="slider-name">Retirement Age</span>
                            <span class="slider-value" id="retirement-age-value">${this.baseInputs.retirementAge}</span>
                        </label>
                        <input type="range" 
                               class="slider" 
                               id="retirement-age-slider"
                               min="${Math.max(this.baseInputs.currentAge + 5, 55)}"
                               max="75"
                               step="1"
                               value="${this.baseInputs.retirementAge}">
                        <div class="slider-hint">Range: ${Math.max(this.baseInputs.currentAge + 5, 55)} - 75</div>
                    </div>
                    
                    ${this.baseInputs.monthlyContribution > 0 ? `
                    <div class="slider-group">
                        <label class="slider-label">
                            <span class="slider-name">Monthly Savings</span>
                            <span class="slider-value" id="savings-value">$${this.baseInputs.monthlyContribution.toLocaleString()}</span>
                        </label>
                        <input type="range" 
                               class="slider" 
                               id="savings-slider"
                               min="0"
                               max="${Math.round(this.baseInputs.monthlyContribution * 2)}"
                               step="100"
                               value="${this.baseInputs.monthlyContribution}">
                        <div class="slider-hint">Range: $0 - $${(this.baseInputs.monthlyContribution * 2).toLocaleString()}</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="comparison-display">
                    <div class="comparison-header">
                        <h4>Impact of Changes</h4>
                        <button class="btn-reset" id="reset-sliders">↺ Reset All</button>
                    </div>
                    
                    <div class="comparison-grid">
                        <div class="comparison-item">
                            <div class="comparison-label">Portfolio at Retirement</div>
                            <div class="comparison-values">
                                <span class="base-value">Base: $${this.baseResults.summary.portfolioAtRetirement.toLocaleString()}</span>
                                <span class="current-value" id="portfolio-comparison">—</span>
                            </div>
                        </div>
                        
                        <div class="comparison-item">
                            <div class="comparison-label">Money Lasts Until</div>
                            <div class="comparison-values">
                                <span class="base-value">Base: Age ${this.baseResults.summary.moneyLastsAge}</span>
                                <span class="current-value" id="age-comparison">—</span>
                            </div>
                        </div>
                        
                        <div class="comparison-item">
                            <div class="comparison-label">Success Probability</div>
                            <div class="comparison-values">
                                <span class="base-value">Base: ${this.baseResults.probability}%</span>
                                <span class="current-value" id="probability-comparison">—</span>
                            </div>
                        </div>
                        
                        <div class="comparison-item">
                            <div class="comparison-label">Final Balance</div>
                            <div class="comparison-values">
                                <span class="base-value">Base: $${this.baseResults.summary.legacyAmount.toLocaleString()}</span>
                                <span class="current-value" id="legacy-comparison">—</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        this._attachListeners();
    },
    
    /**
     * Attach slider event listeners
     */
    _attachListeners() {
        // Spending slider
        const spendingSlider = document.getElementById('spending-slider');
        if (spendingSlider) {
            spendingSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                document.getElementById('spending-value').textContent = '$' + value.toLocaleString();
                this.currentAdjustments.annualSpending = value;
                this._updateComparison();
            });
        }
        
        // Returns slider
        const returnsSlider = document.getElementById('returns-slider');
        if (returnsSlider) {
            returnsSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('returns-value').textContent = value + '%';
                this.currentAdjustments.returnRate = value;
                this._updateComparison();
            });
        }
        
        // Inflation slider
        const inflationSlider = document.getElementById('inflation-slider');
        if (inflationSlider) {
            inflationSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('inflation-value').textContent = value + '%';
                this.currentAdjustments.inflationRate = value;
                this._updateComparison();
            });
        }
        
        // Retirement age slider
        const retirementSlider = document.getElementById('retirement-age-slider');
        if (retirementSlider) {
            retirementSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                document.getElementById('retirement-age-value').textContent = value;
                this.currentAdjustments.retirementAge = value;
                this._updateComparison();
            });
        }
        
        // Savings slider
        const savingsSlider = document.getElementById('savings-slider');
        if (savingsSlider) {
            savingsSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                document.getElementById('savings-value').textContent = '$' + value.toLocaleString();
                this.currentAdjustments.monthlyContribution = value;
                this._updateComparison();
            });
        }
        
        // Reset button
        const resetBtn = document.getElementById('reset-sliders');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.currentAdjustments = {};
                
                // Reset slider values
                if (spendingSlider) spendingSlider.value = this.baseInputs.annualSpending;
                if (returnsSlider) returnsSlider.value = this.baseInputs.returnRate;
                if (inflationSlider) inflationSlider.value = this.baseInputs.inflationRate;
                if (retirementSlider) retirementSlider.value = this.baseInputs.retirementAge;
                if (savingsSlider) savingsSlider.value = this.baseInputs.monthlyContribution;
                
                // Reset displays
                document.getElementById('spending-value').textContent = '$' + this.baseInputs.annualSpending.toLocaleString();
                document.getElementById('returns-value').textContent = this.baseInputs.returnRate + '%';
                document.getElementById('inflation-value').textContent = this.baseInputs.inflationRate + '%';
                document.getElementById('retirement-age-value').textContent = this.baseInputs.retirementAge;
                if (savingsSlider) {
                    document.getElementById('savings-value').textContent = '$' + this.baseInputs.monthlyContribution.toLocaleString();
                }
                
                this._clearComparison();
            });
        }
    },
    
    /**
     * Update comparison display with new calculations
     */
    _updateComparison() {
        // Debounce to avoid too many calculations
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
            const adjustedInputs = { ...this.baseInputs, ...this.currentAdjustments };
            
            try {
                const newResults = RetirementCalcV4.calculate(adjustedInputs);
                
                // Portfolio comparison
                const portfolioDiff = newResults.summary.portfolioAtRetirement - this.baseResults.summary.portfolioAtRetirement;
                const portfolioEl = document.getElementById('portfolio-comparison');
                if (portfolioEl) {
                    portfolioEl.textContent = this._formatDifference(
                        newResults.summary.portfolioAtRetirement,
                        portfolioDiff,
                        '$'
                    );
                    portfolioEl.className = 'current-value ' + (portfolioDiff >= 0 ? 'positive' : 'negative');
                }
                
                // Age comparison
                const ageDiff = newResults.summary.moneyLastsAge - this.baseResults.summary.moneyLastsAge;
                const ageEl = document.getElementById('age-comparison');
                if (ageEl) {
                    ageEl.textContent = `Age ${newResults.summary.moneyLastsAge} (${ageDiff >= 0 ? '+' : ''}${ageDiff} years)`;
                    ageEl.className = 'current-value ' + (ageDiff >= 0 ? 'positive' : 'negative');
                }
                
                // Probability comparison
                const probDiff = newResults.probability - this.baseResults.probability;
                const probEl = document.getElementById('probability-comparison');
                if (probEl) {
                    probEl.textContent = `${newResults.probability}% (${probDiff >= 0 ? '+' : ''}${probDiff}%)`;
                    probEl.className = 'current-value ' + (probDiff >= 0 ? 'positive' : 'negative');
                }
                
                // Legacy comparison
                const legacyDiff = newResults.summary.legacyAmount - this.baseResults.summary.legacyAmount;
                const legacyEl = document.getElementById('legacy-comparison');
                if (legacyEl) {
                    legacyEl.textContent = this._formatDifference(
                        newResults.summary.legacyAmount,
                        legacyDiff,
                        '$'
                    );
                    legacyEl.className = 'current-value ' + (legacyDiff >= 0 ? 'positive' : 'negative');
                }
            } catch (error) {
                console.error('[InteractiveSliders] Calculation error:', error);
                this._showError('Unable to calculate with these settings');
            }
        }, 500); // Wait 500ms after last slider change
    },
    
    /**
     * Format difference with + or - and color
     */
    _formatDifference(value, diff, prefix = '') {
        const sign = diff >= 0 ? '+' : '';
        return `${prefix}${value.toLocaleString()} (${sign}${prefix}${diff.toLocaleString()})`;
    },
    
    /**
     * Clear comparison display
     */
    _clearComparison() {
        const elements = [
            'portfolio-comparison',
            'age-comparison',
            'probability-comparison',
            'legacy-comparison'
        ];
        
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '—';
                el.className = 'current-value';
            }
        });
    },
    
    /**
     * Show error message
     */
    _showError(message) {
        const elements = [
            'portfolio-comparison',
            'age-comparison',
            'probability-comparison',
            'legacy-comparison'
        ];
        
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '⚠️ ' + message;
                el.className = 'current-value error';
            }
        });
    }
};

console.log('[InteractiveSliders] Module loaded');

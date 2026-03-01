// ═══════════════════════════════════════════
//  Scenario Storage - Save/Load/Share Scenarios
//  LocalStorage persistence + URL sharing
// ═══════════════════════════════════════════

const ScenarioStorage = {
    STORAGE_KEY: 'retirementCalculator_scenarios',
    MAX_SCENARIOS: 10,
    
    /**
     * Save current scenario to localStorage
     */
    save(name, inputs, results) {
        const scenarios = this.getAll();
        
        const scenario = {
            id: Date.now().toString(),
            name: name || `Scenario ${scenarios.length + 1}`,
            timestamp: new Date().toISOString(),
            inputs,
            summary: {
                portfolioAtRetirement: results.summary.portfolioAtRetirement,
                moneyLastsAge: results.summary.moneyLastsAge,
                probability: results.probability,
                legacyAmount: results.summary.legacyAmount
            }
        };
        
        scenarios.unshift(scenario);
        
        // Keep only most recent MAX_SCENARIOS
        if (scenarios.length > this.MAX_SCENARIOS) {
            scenarios.length = this.MAX_SCENARIOS;
        }
        
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scenarios));
            return { success: true, id: scenario.id };
        } catch (error) {
            console.error('[ScenarioStorage] Save error:', error);
            return { success: false, error: 'Unable to save scenario (storage full?)' };
        }
    },
    
    /**
     * Get all saved scenarios
     */
    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[ScenarioStorage] Load error:', error);
            return [];
        }
    },
    
    /**
     * Get single scenario by ID
     */
    get(id) {
        const scenarios = this.getAll();
        return scenarios.find(s => s.id === id);
    },
    
    /**
     * Delete scenario by ID
     */
    delete(id) {
        const scenarios = this.getAll();
        const filtered = scenarios.filter(s => s.id !== id);
        
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
            return { success: true };
        } catch (error) {
            console.error('[ScenarioStorage] Delete error:', error);
            return { success: false, error: 'Unable to delete scenario' };
        }
    },
    
    /**
     * Clear all scenarios
     */
    clearAll() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return { success: true };
        } catch (error) {
            console.error('[ScenarioStorage] Clear error:', error);
            return { success: false, error: 'Unable to clear scenarios' };
        }
    },
    
    /**
     * Export scenario to JSON file
     */
    exportToFile(scenario) {
        const dataStr = JSON.stringify(scenario, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `retirement-scenario-${scenario.name.replace(/\s+/g, '-')}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    },
    
    /**
     * Import scenario from JSON file
     */
    importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const scenario = JSON.parse(e.target.result);
                    
                    // Validate structure
                    if (!scenario.inputs || !scenario.summary) {
                        reject(new Error('Invalid scenario file'));
                        return;
                    }
                    
                    // Add to storage
                    scenario.id = Date.now().toString();
                    scenario.timestamp = new Date().toISOString();
                    
                    const scenarios = this.getAll();
                    scenarios.unshift(scenario);
                    
                    if (scenarios.length > this.MAX_SCENARIOS) {
                        scenarios.length = this.MAX_SCENARIOS;
                    }
                    
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scenarios));
                    resolve(scenario);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('File read error'));
            reader.readAsText(file);
        });
    },
    
    /**
     * Generate shareable URL with encoded inputs
     */
    generateShareURL(inputs) {
        // Compress inputs to URL-safe string
        const simplified = {
            a: inputs.currentAge,
            r: inputs.retirementAge,
            l: inputs.lifeExpectancy,
            p: inputs.province,
            rg: inputs.region,
            f: inputs.familyStatus === 'couple' ? 1 : 0,
            i1: inputs.income1,
            i2: inputs.income2 || 0,
            rrsp: inputs.rrsp,
            tfsa: inputs.tfsa,
            nr: inputs.nonReg,
            mc: inputs.monthlyContribution,
            sp: inputs.annualSpending,
            cpp: inputs.cppStartAge,
            ret: inputs.returnRate,
            inf: inputs.inflationRate
        };
        
        const encoded = btoa(JSON.stringify(simplified));
        const baseURL = window.location.origin + window.location.pathname;
        return `${baseURL}?scenario=${encoded}`;
    },
    
    /**
     * Parse inputs from share URL
     */
    parseShareURL() {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get('scenario');
        
        if (!encoded) return null;
        
        try {
            const simplified = JSON.parse(atob(encoded));
            
            // Expand to full inputs
            return {
                currentAge: simplified.a,
                partnerAge: simplified.a, // Assume same age if not specified
                retirementAge: simplified.r,
                lifeExpectancy: simplified.l,
                province: simplified.p || 'ON',
                region: simplified.rg || 'ON_Toronto',
                familyStatus: simplified.f ? 'couple' : 'single',
                currentIncome: simplified.i1,
                income1: simplified.i1,
                income2: simplified.i2,
                rrsp: simplified.rrsp,
                tfsa: simplified.tfsa,
                nonReg: simplified.nr,
                other: 0,
                monthlyContribution: simplified.mc,
                contributionSplit: { rrsp: 0.6, tfsa: 0.4, nonReg: 0 },
                annualSpending: simplified.sp,
                healthStatus: 'average',
                currentDebt: 0,
                debtPayoffAge: simplified.r,
                cppStartAge: simplified.cpp,
                additionalIncomeSources: [],
                returnRate: simplified.ret,
                inflationRate: simplified.inf
            };
        } catch (error) {
            console.error('[ScenarioStorage] URL parse error:', error);
            return null;
        }
    },
    
    /**
     * Copy share URL to clipboard
     */
    async copyShareURL(inputs) {
        const url = this.generateShareURL(inputs);
        
        try {
            await navigator.clipboard.writeText(url);
            return { success: true, url };
        } catch (error) {
            console.error('[ScenarioStorage] Copy error:', error);
            return { success: false, error: 'Unable to copy to clipboard' };
        }
    },
    
    /**
     * Render saved scenarios UI
     */
    renderSavedScenarios(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const scenarios = this.getAll();
        
        if (scenarios.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No saved scenarios yet. Fill out the calculator and click "Save Scenario" to save your plan.</p>
                </div>
            `;
            return;
        }
        
        const html = `
            <div class="saved-scenarios">
                <div class="scenarios-header">
                    <h4>${scenarios.length} Saved Scenario${scenarios.length !== 1 ? 's' : ''}</h4>
                    <button class="btn-clear-all" id="clear-all-scenarios">Clear All</button>
                </div>
                
                <div class="scenarios-list">
                    ${scenarios.map(scenario => `
                        <div class="scenario-item" data-id="${scenario.id}">
                            <div class="scenario-info">
                                <div class="scenario-name">${scenario.name}</div>
                                <div class="scenario-date">${new Date(scenario.timestamp).toLocaleDateString()}</div>
                                <div class="scenario-stats">
                                    <span>Portfolio: $${(scenario.summary.portfolioAtRetirement / 1000).toFixed(0)}K</span>
                                    <span>•</span>
                                    <span>Lasts: Age ${scenario.summary.moneyLastsAge}</span>
                                    <span>•</span>
                                    <span>Success: ${scenario.summary.probability}%</span>
                                </div>
                            </div>
                            <div class="scenario-actions">
                                <button class="btn-load" data-id="${scenario.id}">Load</button>
                                <button class="btn-export" data-id="${scenario.id}">Export</button>
                                <button class="btn-delete" data-id="${scenario.id}">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        this._attachScenarioListeners();
    },
    
    /**
     * Attach event listeners for saved scenarios
     */
    _attachScenarioListeners() {
        // Load buttons
        document.querySelectorAll('.btn-load').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const scenario = this.get(id);
                if (scenario) {
                    this.onLoad && this.onLoad(scenario.inputs);
                }
            });
        });
        
        // Export buttons
        document.querySelectorAll('.btn-export').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const scenario = this.get(id);
                if (scenario) {
                    this.exportToFile(scenario);
                }
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (confirm('Delete this scenario?')) {
                    this.delete(id);
                    this.onDelete && this.onDelete();
                }
            });
        });
        
        // Clear all button
        const clearAllBtn = document.getElementById('clear-all-scenarios');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm('Delete all saved scenarios? This cannot be undone.')) {
                    this.clearAll();
                    this.onClearAll && this.onClearAll();
                }
            });
        }
    },
    
    // Callbacks (set by app)
    onLoad: null,
    onDelete: null,
    onClearAll: null
};

console.log('[ScenarioStorage] Module loaded');

// ═══════════════════════════════════════════
//  Scenario Comparison Manager
// ═══════════════════════════════════════════

const ScenarioManager = {
    
    scenarios: [],
    baseInputs: null,

    /**
     * Create a new scenario
     */
    create(name, modifications) {
        const scenario = {
            id: Date.now(),
            name,
            modifications, // e.g., { retirementAge: 60, annualSpending: 50000 }
            results: null
        };
        
        this.scenarios.push(scenario);
        return scenario;
    },

    /**
     * Clear all scenarios
     */
    clear() {
        this.scenarios = [];
    },

    /**
     * Set base inputs (current form values)
     */
    setBaseInputs(inputs) {
        this.baseInputs = { ...inputs };
    },

    /**
     * Calculate a scenario (merge base inputs with modifications)
     */
    calculate(scenario, calculator) {
        if (!this.baseInputs) return null;
        
        const inputs = {
            ...this.baseInputs,
            ...scenario.modifications
        };
        
        scenario.results = calculator.calculate(inputs);
        return scenario.results;
    },

    /**
     * Calculate all scenarios
     */
    calculateAll(calculator) {
        return this.scenarios.map(scenario => {
            this.calculate(scenario, calculator);
            return scenario;
        });
    },

    /**
     * Get comparison data for display
     */
    getComparison() {
        if (this.scenarios.length === 0) return null;

        const comparison = {
            scenarios: this.scenarios.map(s => ({
                name: s.name,
                portfolioAtRetirement: s.results?.summary.portfolioAtRetirement || 0,
                annualIncome: s.results?.summary.annualIncomeAtRetirement || 0,
                moneyLastsAge: s.results?.summary.moneyLastsAge || 0,
                onTrack: s.results?.onTrack || false,
                modifications: s.modifications
            }))
        };

        return comparison;
    },

    /**
     * Generate common scenario templates
     */
    getTemplates(currentInputs) {
        return [
            {
                name: 'Retire 5 Years Earlier',
                modifications: {
                    retirementAge: currentInputs.retirementAge - 5
                }
            },
            {
                name: 'Retire 5 Years Later',
                modifications: {
                    retirementAge: currentInputs.retirementAge + 5
                }
            },
            {
                name: 'Spend 20% Less',
                modifications: {
                    annualSpending: Math.round(currentInputs.annualSpending * 0.8)
                }
            },
            {
                name: 'Spend 20% More',
                modifications: {
                    annualSpending: Math.round(currentInputs.annualSpending * 1.2)
                }
            },
            {
                name: 'Save $500/month More',
                modifications: {
                    monthlyContribution: currentInputs.monthlyContribution + 500
                }
            },
            {
                name: 'Stop Contributing Now',
                modifications: {
                    monthlyContribution: 0
                }
            }
        ];
    }
};

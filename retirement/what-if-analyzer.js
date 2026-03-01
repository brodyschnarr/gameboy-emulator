// ═══════════════════════════════════════════
//  What-If Analysis Engine
//  Compare multiple scenarios side-by-side
// ═══════════════════════════════════════════

const WhatIfAnalyzer = {
    
    /**
     * Generate comprehensive what-if scenarios
     * @param {Object} baseInputs - Base case inputs
     * @returns {Object} - All scenario results with comparisons
     */
    analyzeAll(baseInputs) {
        console.log('[WhatIfAnalyzer] Running comprehensive what-if analysis...');
        
        const scenarios = {
            base: {
                name: 'Base Plan',
                description: 'Your current plan',
                inputs: baseInputs,
                results: RetirementCalcV4.calculate(baseInputs)
            }
        };
        
        // Retirement age scenarios
        scenarios.retire5Earlier = this._createScenario(
            baseInputs,
            { retirementAge: baseInputs.retirementAge - 5 },
            'Retire 5 Years Earlier',
            `Retire at ${baseInputs.retirementAge - 5} instead of ${baseInputs.retirementAge}`
        );
        
        scenarios.retire5Later = this._createScenario(
            baseInputs,
            { retirementAge: baseInputs.retirementAge + 5 },
            'Retire 5 Years Later',
            `Retire at ${baseInputs.retirementAge + 5} instead of ${baseInputs.retirementAge}`
        );
        
        // Spending scenarios
        scenarios.spend20Less = this._createScenario(
            baseInputs,
            { annualSpending: Math.round(baseInputs.annualSpending * 0.8) },
            'Spend 20% Less',
            `Reduce annual spending to $${Math.round(baseInputs.annualSpending * 0.8).toLocaleString()}`
        );
        
        scenarios.spend20More = this._createScenario(
            baseInputs,
            { annualSpending: Math.round(baseInputs.annualSpending * 1.2) },
            'Spend 20% More',
            `Increase annual spending to $${Math.round(baseInputs.annualSpending * 1.2).toLocaleString()}`
        );
        
        // Savings scenarios
        if (baseInputs.monthlyContribution > 0) {
            scenarios.save50More = this._createScenario(
                baseInputs,
                { monthlyContribution: Math.round(baseInputs.monthlyContribution * 1.5) },
                'Save 50% More',
                `Increase savings to $${Math.round(baseInputs.monthlyContribution * 1.5).toLocaleString()}/month`
            );
            
            scenarios.save50Less = this._createScenario(
                baseInputs,
                { monthlyContribution: Math.round(baseInputs.monthlyContribution * 0.5) },
                'Save 50% Less',
                `Reduce savings to $${Math.round(baseInputs.monthlyContribution * 0.5).toLocaleString()}/month`
            );
        }
        
        // Market return scenarios
        scenarios.bearMarket = this._createScenario(
            baseInputs,
            { returnRate: baseInputs.returnRate - 2 },
            'Bear Market Returns',
            `${baseInputs.returnRate - 2}% returns instead of ${baseInputs.returnRate}%`
        );
        
        scenarios.bullMarket = this._createScenario(
            baseInputs,
            { returnRate: baseInputs.returnRate + 2 },
            'Bull Market Returns',
            `${baseInputs.returnRate + 2}% returns instead of ${baseInputs.returnRate}%`
        );
        
        // Inflation scenarios
        scenarios.highInflation = this._createScenario(
            baseInputs,
            { inflationRate: baseInputs.inflationRate + 2 },
            'High Inflation',
            `${baseInputs.inflationRate + 2}% inflation instead of ${baseInputs.inflationRate}%`
        );
        
        scenarios.lowInflation = this._createScenario(
            baseInputs,
            { inflationRate: Math.max(0, baseInputs.inflationRate - 1) },
            'Low Inflation',
            `${Math.max(0, baseInputs.inflationRate - 1)}% inflation instead of ${baseInputs.inflationRate}%`
        );
        
        // CPP timing scenarios
        scenarios.cppAt60 = this._createScenario(
            baseInputs,
            { cppStartAge: 60 },
            'Take CPP at 60',
            'Start CPP early (reduced benefits)'
        );
        
        scenarios.cppAt70 = this._createScenario(
            baseInputs,
            { cppStartAge: 70 },
            'Delay CPP to 70',
            'Delay CPP for maximum benefits (+42%)'
        );
        
        // Longevity scenarios
        scenarios.liveTo95 = this._createScenario(
            baseInputs,
            { lifeExpectancy: 95 },
            'Live to 95',
            'Plan for 5 extra years'
        );
        
        scenarios.liveTo100 = this._createScenario(
            baseInputs,
            { lifeExpectancy: 100 },
            'Live to 100',
            'Plan for exceptional longevity'
        );
        
        // Healthcare scenarios
        scenarios.healthIssues = this._createScenario(
            baseInputs,
            { healthStatus: 'fair' },
            'Health Issues',
            'Higher healthcare costs in retirement'
        );
        
        // Combined worst case
        scenarios.worstCase = this._createScenario(
            baseInputs,
            {
                retirementAge: baseInputs.retirementAge - 3,
                returnRate: baseInputs.returnRate - 2,
                inflationRate: baseInputs.inflationRate + 2,
                lifeExpectancy: 100,
                healthStatus: 'fair'
            },
            '😱 Worst Case',
            'Retire early + bear market + high inflation + long life + health issues'
        );
        
        // Combined best case
        scenarios.bestCase = this._createScenario(
            baseInputs,
            {
                retirementAge: baseInputs.retirementAge + 3,
                returnRate: baseInputs.returnRate + 2,
                inflationRate: Math.max(0, baseInputs.inflationRate - 1),
                annualSpending: Math.round(baseInputs.annualSpending * 0.85)
            },
            '🎉 Best Case',
            'Retire later + bull market + low inflation + modest spending'
        );
        
        // Generate comparison matrix
        const comparison = this._generateComparison(scenarios);
        
        return {
            scenarios,
            comparison,
            recommendations: this._generateRecommendations(scenarios, baseInputs)
        };
    },
    
    /**
     * Create a single scenario
     */
    _createScenario(baseInputs, changes, name, description) {
        const scenarioInputs = { ...baseInputs, ...changes };
        
        return {
            name,
            description,
            changes,
            inputs: scenarioInputs,
            results: RetirementCalcV4.calculate(scenarioInputs)
        };
    },
    
    /**
     * Generate comparison matrix (key metrics across scenarios)
     */
    _generateComparison(scenarios) {
        const comparison = {
            metrics: [
                'portfolioAtRetirement',
                'moneyLastsAge',
                'probability',
                'finalBalance',
                'onTrack'
            ],
            scenarios: {}
        };
        
        Object.keys(scenarios).forEach(key => {
            const scenario = scenarios[key];
            comparison.scenarios[key] = {
                name: scenario.name,
                portfolioAtRetirement: scenario.results.summary.portfolioAtRetirement,
                moneyLastsAge: scenario.results.summary.moneyLastsAge,
                probability: scenario.results.probability,
                finalBalance: scenario.results.summary.legacyAmount,
                onTrack: scenario.results.onTrack
            };
        });
        
        return comparison;
    },
    
    /**
     * Generate actionable recommendations based on scenarios
     */
    _generateRecommendations(scenarios, baseInputs) {
        const base = scenarios.base.results;
        const recommendations = [];
        
        // Check if retiring later helps significantly
        if (scenarios.retire5Later) {
            const improvement = scenarios.retire5Later.results.summary.moneyLastsAge - base.summary.moneyLastsAge;
            if (improvement >= 5) {
                recommendations.push({
                    priority: 'high',
                    category: 'Retirement Age',
                    recommendation: `Working 5 more years extends your money by ${improvement} years`,
                    impact: `Portfolio at retirement: +$${(scenarios.retire5Later.results.summary.portfolioAtRetirement - base.summary.portfolioAtRetirement).toLocaleString()}`,
                    action: `Consider retiring at ${baseInputs.retirementAge + 5} instead of ${baseInputs.retirementAge}`
                });
            }
        }
        
        // Check if spending less helps
        if (scenarios.spend20Less) {
            const improvement = scenarios.spend20Less.results.summary.moneyLastsAge - base.summary.moneyLastsAge;
            if (improvement >= 3) {
                recommendations.push({
                    priority: 'medium',
                    category: 'Spending',
                    recommendation: `Reducing spending by 20% extends your money by ${improvement} years`,
                    impact: `Annual spending: $${Math.round(baseInputs.annualSpending * 0.8).toLocaleString()} vs $${baseInputs.annualSpending.toLocaleString()}`,
                    action: 'Find ways to reduce retirement expenses'
                });
            }
        }
        
        // Check if saving more helps
        if (scenarios.save50More && baseInputs.currentAge < baseInputs.retirementAge) {
            const improvement = scenarios.save50More.results.summary.portfolioAtRetirement - base.summary.portfolioAtRetirement;
            if (improvement > 100000) {
                recommendations.push({
                    priority: 'high',
                    category: 'Savings Rate',
                    recommendation: `Increasing savings by 50% adds $${Math.round(improvement).toLocaleString()} to your retirement portfolio`,
                    impact: `Monthly: $${Math.round(baseInputs.monthlyContribution * 1.5).toLocaleString()} vs $${baseInputs.monthlyContribution.toLocaleString()}`,
                    action: `Save an extra $${Math.round(baseInputs.monthlyContribution * 0.5).toLocaleString()}/month`
                });
            }
        }
        
        // Check CPP optimization
        if (scenarios.cppAt70 && scenarios.cppAt60) {
            const cpp70Age = scenarios.cppAt70.results.summary.moneyLastsAge;
            const cpp60Age = scenarios.cppAt60.results.summary.moneyLastsAge;
            
            if (cpp70Age > cpp60Age + 2) {
                recommendations.push({
                    priority: 'medium',
                    category: 'CPP Timing',
                    recommendation: `Delaying CPP to 70 extends your money by ${cpp70Age - cpp60Age} years`,
                    impact: 'Higher lifetime benefits despite waiting',
                    action: 'Consider delaying CPP if you can afford it'
                });
            } else if (cpp60Age > cpp70Age + 2) {
                recommendations.push({
                    priority: 'medium',
                    category: 'CPP Timing',
                    recommendation: `Taking CPP at 60 may be better in your situation`,
                    impact: 'Early access helps preserve portfolio',
                    action: 'Consider taking CPP early to reduce portfolio withdrawals'
                });
            }
        }
        
        // Warn about worst case
        if (scenarios.worstCase) {
            const worstCaseAge = scenarios.worstCase.results.summary.moneyLastsAge;
            if (worstCaseAge < baseInputs.lifeExpectancy) {
                recommendations.push({
                    priority: 'critical',
                    category: 'Risk',
                    recommendation: `⚠️ In worst-case scenario, money runs out at age ${worstCaseAge}`,
                    impact: `${baseInputs.lifeExpectancy - worstCaseAge} years short`,
                    action: 'Consider building a larger safety buffer (save more or spend less)'
                });
            }
        }
        
        // Highlight best case
        if (scenarios.bestCase) {
            const bestCaseLegacy = scenarios.bestCase.results.summary.legacyAmount;
            if (bestCaseLegacy > base.summary.legacyAmount * 2) {
                recommendations.push({
                    priority: 'opportunity',
                    category: 'Upside',
                    recommendation: `🎉 In best-case scenario, you leave $${Math.round(bestCaseLegacy).toLocaleString()} legacy`,
                    impact: `${Math.round((bestCaseLegacy / base.summary.legacyAmount - 1) * 100)}% more than base case`,
                    action: 'Small optimizations could have big impact'
                });
            }
        }
        
        // Market sensitivity
        if (scenarios.bearMarket && scenarios.bullMarket) {
            const bearAge = scenarios.bearMarket.results.summary.moneyLastsAge;
            const bullAge = scenarios.bullMarket.results.summary.moneyLastsAge;
            const sensitivity = bullAge - bearAge;
            
            if (sensitivity > 8) {
                recommendations.push({
                    priority: 'high',
                    category: 'Market Risk',
                    recommendation: `Your plan is highly sensitive to market returns (${sensitivity} year range)`,
                    impact: '2% return difference = significant outcome change',
                    action: 'Consider more conservative assumptions or increase savings'
                });
            }
        }
        
        // Sort by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, opportunity: 3 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        
        return recommendations;
    },
    
    /**
     * Interactive scenario builder (for real-time UI updates)
     */
    buildCustomScenario(baseInputs, adjustments) {
        const customInputs = { ...baseInputs };
        
        // Apply adjustments
        Object.keys(adjustments).forEach(key => {
            if (adjustments[key] !== null && adjustments[key] !== undefined) {
                customInputs[key] = adjustments[key];
            }
        });
        
        return {
            inputs: customInputs,
            results: RetirementCalcV4.calculate(customInputs),
            changes: adjustments
        };
    },
    
    /**
     * Calculate sensitivity to each input variable
     */
    calculateSensitivity(baseInputs) {
        const base = RetirementCalcV4.calculate(baseInputs);
        const sensitivity = {};
        
        // Test each variable
        const testCases = {
            retirementAge: [baseInputs.retirementAge - 5, baseInputs.retirementAge + 5],
            annualSpending: [baseInputs.annualSpending * 0.8, baseInputs.annualSpending * 1.2],
            returnRate: [baseInputs.returnRate - 2, baseInputs.returnRate + 2],
            inflationRate: [Math.max(0, baseInputs.inflationRate - 1), baseInputs.inflationRate + 2],
            monthlyContribution: baseInputs.monthlyContribution > 0 
                ? [baseInputs.monthlyContribution * 0.5, baseInputs.monthlyContribution * 1.5]
                : null
        };
        
        Object.keys(testCases).forEach(variable => {
            if (testCases[variable] === null) return;
            
            const [low, high] = testCases[variable];
            
            const lowResult = RetirementCalcV4.calculate({ ...baseInputs, [variable]: low });
            const highResult = RetirementCalcV4.calculate({ ...baseInputs, [variable]: high });
            
            const baseAge = base.summary.moneyLastsAge;
            const lowAge = lowResult.summary.moneyLastsAge;
            const highAge = highResult.summary.moneyLastsAge;
            
            sensitivity[variable] = {
                impact: highAge - lowAge,
                range: [lowAge, baseAge, highAge],
                sensitivity: Math.abs(highAge - lowAge) / Math.abs(high - low),
                label: this._getVariableLabel(variable)
            };
        });
        
        // Sort by impact (most sensitive first)
        const sorted = Object.entries(sensitivity)
            .sort((a, b) => Math.abs(b[1].impact) - Math.abs(a[1].impact));
        
        return {
            sorted: sorted.map(([key, value]) => ({ variable: key, ...value })),
            mostSensitive: sorted[0] ? sorted[0][0] : null
        };
    },
    
    _getVariableLabel(variable) {
        const labels = {
            retirementAge: 'Retirement Age',
            annualSpending: 'Annual Spending',
            returnRate: 'Investment Returns',
            inflationRate: 'Inflation Rate',
            monthlyContribution: 'Monthly Savings'
        };
        return labels[variable] || variable;
    }
};

console.log('[WhatIfAnalyzer] Module loaded');

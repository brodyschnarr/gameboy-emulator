// ═══════════════════════════════════════════
//  Safe Withdrawal Rate Calculator
//  Dynamic withdrawal strategies beyond the 4% rule
// ═══════════════════════════════════════════

const SafeWithdrawalCalculator = {
    
    /**
     * Calculate safe withdrawal rate based on portfolio and timeframe
     * @param {Object} params - Portfolio value, retirement length, etc.
     * @returns {Object} - Recommended withdrawal rates and strategies
     */
    calculate(params) {
        const {
            portfolioValue,
            retirementYears,
            inflationRate = 2,
            successTarget = 90, // 90% success rate target
            includeGovernmentBenefits = true,
            governmentBenefitsAnnual = 0
        } = params;
        
        console.log('[SafeWithdrawalCalculator] Analyzing safe withdrawal rates...');
        
        // Classic 4% rule (Trinity Study baseline)
        const fourPercentRule = {
            name: '4% Rule (Classic)',
            withdrawalRate: 0.04,
            firstYearAmount: portfolioValue * 0.04,
            description: 'Classic safe withdrawal rate (Trinity Study)',
            successRate: this._estimateSuccessRate(0.04, retirementYears),
            pros: ['Simple', 'Historically proven', 'Well-researched'],
            cons: ['Ignores market conditions', 'May be too conservative for short retirements']
        };
        
        // Dynamic withdrawal (adjust based on portfolio performance)
        const dynamicRule = {
            name: 'Dynamic Withdrawal',
            withdrawalRate: 0.05, // Can start higher
            firstYearAmount: portfolioValue * 0.05,
            description: 'Adjust spending based on portfolio value each year',
            successRate: 95,
            pros: ['Adapts to market', 'Higher initial spending', 'Sustainable'],
            cons: ['Variable income', 'Requires discipline', 'More complex']
        };
        
        // Guardrails strategy (Guyton-Klinger)
        const guardrailsRule = {
            name: 'Guardrails Strategy',
            withdrawalRate: 0.055,
            firstYearAmount: portfolioValue * 0.055,
            description: 'Increase/decrease spending when portfolio crosses thresholds',
            successRate: 92,
            upperGuardrail: portfolioValue * 1.20, // Increase spending if portfolio grows 20%
            lowerGuardrail: portfolioValue * 0.85, // Decrease spending if portfolio drops 15%
            pros: ['Flexible', 'Protects portfolio', 'Allows lifestyle upgrades'],
            cons: ['Requires monitoring', 'Occasional spending cuts']
        };
        
        // Age-based (increase withdrawal rate as you age)
        const ageBasedRule = {
            name: 'Age-Based (RMD-style)',
            withdrawalRate: this._getAgeBasedRate(65, retirementYears),
            firstYearAmount: portfolioValue * this._getAgeBasedRate(65, retirementYears),
            description: 'Start lower, increase rate as life expectancy decreases',
            successRate: 94,
            schedule: this._getAgeBasedSchedule(65, retirementYears),
            pros: ['Aligned with longevity', 'More in later years', 'Tax-efficient'],
            cons: ['Low initial spending', 'Complex to calculate']
        };
        
        // Optimized for this specific situation
        const optimized = this._optimizeForScenario(params);
        
        // Comparison table
        const strategies = [
            fourPercentRule,
            dynamicRule,
            guardrailsRule,
            ageBasedRule,
            optimized
        ];
        
        // Rank by success rate and initial amount
        strategies.sort((a, b) => b.successRate - a.successRate);
        
        return {
            recommended: optimized,
            strategies,
            comparison: this._generateComparison(strategies, portfolioValue),
            analysis: this._analyzePortfolio(params)
        };
    },
    
    /**
     * Estimate success rate for a given withdrawal rate
     */
    _estimateSuccessRate(rate, years) {
        // Simplified model based on Trinity Study data
        // Assumes 60/40 stocks/bonds portfolio
        
        if (years <= 15) {
            // Shorter retirements can sustain higher rates
            if (rate <= 0.06) return 98;
            if (rate <= 0.07) return 95;
            if (rate <= 0.08) return 90;
            return 85;
        } else if (years <= 30) {
            // Standard retirement length
            if (rate <= 0.04) return 96;
            if (rate <= 0.05) return 88;
            if (rate <= 0.06) return 76;
            return 65;
        } else {
            // Very long retirements
            if (rate <= 0.035) return 95;
            if (rate <= 0.04) return 85;
            if (rate <= 0.05) return 70;
            return 55;
        }
    },
    
    /**
     * Get age-based withdrawal rate (similar to RMD tables)
     */
    _getAgeBasedRate(currentAge, totalYears) {
        // Start conservatively, increase as life expectancy decreases
        const endAge = currentAge + totalYears;
        const remainingYears = endAge - currentAge;
        
        if (remainingYears > 30) return 0.035;
        if (remainingYears > 25) return 0.038;
        if (remainingYears > 20) return 0.042;
        if (remainingYears > 15) return 0.048;
        if (remainingYears > 10) return 0.058;
        return 0.07;
    },
    
    /**
     * Generate age-based withdrawal schedule
     */
    _getAgeBasedSchedule(startAge, totalYears) {
        const schedule = [];
        const endAge = startAge + totalYears;
        
        for (let age = startAge; age < endAge; age += 5) {
            const remainingYears = endAge - age;
            const rate = this._getAgeBasedRate(age, remainingYears);
            schedule.push({
                age,
                rate,
                ratePercent: (rate * 100).toFixed(1) + '%'
            });
        }
        
        return schedule;
    },
    
    /**
     * Optimize withdrawal strategy for specific scenario
     */
    _optimizeForScenario(params) {
        const {
            portfolioValue,
            retirementYears,
            inflationRate,
            successTarget,
            governmentBenefitsAnnual
        } = params;
        
        // If government benefits cover a lot, can withdraw more
        const benefitCoverageRatio = governmentBenefitsAnnual / (portfolioValue * 0.04);
        
        let baseRate = 0.04;
        
        // Adjust based on retirement length
        if (retirementYears < 20) {
            baseRate += 0.01; // Shorter retirement = higher rate
        } else if (retirementYears > 35) {
            baseRate -= 0.005; // Longer retirement = lower rate
        }
        
        // Adjust based on government benefits
        if (benefitCoverageRatio > 0.5) {
            baseRate += 0.01; // High benefits = can withdraw more
        }
        
        // Adjust for inflation expectations
        if (inflationRate > 3) {
            baseRate -= 0.005; // High inflation = more conservative
        }
        
        // Cap at reasonable bounds
        baseRate = Math.max(0.03, Math.min(0.07, baseRate));
        
        const estimatedSuccess = this._estimateSuccessRate(baseRate, retirementYears);
        
        return {
            name: '🎯 Optimized for You',
            withdrawalRate: baseRate,
            firstYearAmount: portfolioValue * baseRate,
            description: `Customized rate based on your ${retirementYears}-year retirement`,
            successRate: estimatedSuccess,
            reasoning: [
                `${retirementYears} year time horizon`,
                governmentBenefitsAnnual > 0 
                    ? `Government benefits: $${governmentBenefitsAnnual.toLocaleString()}/year`
                    : 'No government benefits considered',
                `${inflationRate}% expected inflation`,
                `Target: ${successTarget}% success rate`
            ],
            pros: ['Tailored to your situation', 'Balances risk and spending'],
            cons: estimatedSuccess < successTarget 
                ? ['May not meet your success target - consider saving more']
                : ['None - this strategy fits your goals']
        };
    },
    
    /**
     * Generate comparison table
     */
    _generateComparison(strategies, portfolioValue) {
        return strategies.map(s => ({
            name: s.name,
            rate: (s.withdrawalRate * 100).toFixed(1) + '%',
            firstYearAmount: '$' + Math.round(s.firstYearAmount).toLocaleString(),
            monthlyIncome: '$' + Math.round(s.firstYearAmount / 12).toLocaleString(),
            successRate: s.successRate + '%',
            risk: s.successRate >= 95 ? 'Low' : s.successRate >= 85 ? 'Medium' : 'High'
        }));
    },
    
    /**
     * Analyze portfolio characteristics
     */
    _analyzePortfolio(params) {
        const { portfolioValue, retirementYears, governmentBenefitsAnnual } = params;
        
        const analysis = {
            size: portfolioValue,
            sizeCategory: this._getPortfolioSizeCategory(portfolioValue),
            timeHorizon: retirementYears,
            governmentBenefits: governmentBenefitsAnnual,
            benefitsCoverageRatio: governmentBenefitsAnnual / (portfolioValue * 0.04)
        };
        
        // Recommendations
        analysis.recommendations = [];
        
        if (portfolioValue < 500000) {
            analysis.recommendations.push({
                category: 'Portfolio Size',
                message: 'Consider working longer or saving more aggressively',
                impact: 'Small portfolios have less room for error'
            });
        }
        
        if (retirementYears > 35) {
            analysis.recommendations.push({
                category: 'Time Horizon',
                message: 'Long retirement requires conservative withdrawal rate',
                impact: 'Consider 3.5% instead of 4% for safety'
            });
        }
        
        if (analysis.benefitsCoverageRatio > 0.5) {
            analysis.recommendations.push({
                category: 'Government Benefits',
                message: 'Your government benefits provide strong support',
                impact: 'Can afford slightly higher withdrawal rate'
            });
        } else if (analysis.benefitsCoverageRatio < 0.2) {
            analysis.recommendations.push({
                category: 'Government Benefits',
                message: 'Low government benefits - portfolio bears most burden',
                impact: 'May need lower withdrawal rate or more savings'
            });
        }
        
        return analysis;
    },
    
    _getPortfolioSizeCategory(value) {
        if (value < 250000) return 'Small (<$250K)';
        if (value < 500000) return 'Modest ($250K-$500K)';
        if (value < 1000000) return 'Comfortable ($500K-$1M)';
        if (value < 2000000) return 'Strong ($1M-$2M)';
        return 'Very Strong (>$2M)';
    },
    
    /**
     * Calculate how much you need to save to support a given spending level
     */
    calculateRequiredPortfolio(targetAnnualSpending, withdrawalRate = 0.04) {
        return {
            required: targetAnnualSpending / withdrawalRate,
            withSafetyBuffer: (targetAnnualSpending / withdrawalRate) * 1.15,
            breakdown: {
                spending: targetAnnualSpending,
                rate: withdrawalRate,
                ratePercent: (withdrawalRate * 100) + '%'
            },
            examples: [
                {
                    spending: 40000,
                    required: 40000 / withdrawalRate,
                    label: 'Modest lifestyle'
                },
                {
                    spending: 60000,
                    required: 60000 / withdrawalRate,
                    label: 'Comfortable lifestyle'
                },
                {
                    spending: 80000,
                    required: 80000 / withdrawalRate,
                    label: 'Affluent lifestyle'
                }
            ]
        };
    },
    
    /**
     * Test withdrawal rate sustainability over time
     */
    testWithdrawalRate(portfolioValue, withdrawalRate, years, returnRate = 6, inflationRate = 2) {
        let balance = portfolioValue;
        const results = [];
        
        for (let year = 1; year <= years; year++) {
            // Withdraw (inflation-adjusted)
            const inflationFactor = Math.pow(1 + inflationRate / 100, year - 1);
            const withdrawal = portfolioValue * withdrawalRate * inflationFactor;
            
            // Grow remaining balance
            balance = (balance - withdrawal) * (1 + returnRate / 100);
            
            results.push({
                year,
                balance: Math.round(balance),
                withdrawal: Math.round(withdrawal),
                depleted: balance <= 0
            });
            
            if (balance <= 0) break;
        }
        
        const lastYear = results[results.length - 1];
        const survived = !lastYear.depleted;
        
        return {
            survived,
            yearsLasted: results.length,
            finalBalance: lastYear.balance,
            results
        };
    }
};

console.log('[SafeWithdrawalCalculator] Module loaded');

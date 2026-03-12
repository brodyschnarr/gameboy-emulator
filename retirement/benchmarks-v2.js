// ═══════════════════════════════════════════
//  Canadian Retirement Benchmarks (2024)
//  Based on: Statistics Canada, Bank surveys, RRSP/TFSA contribution data
//  NOTE: These are estimates - verify against latest published data
// ═══════════════════════════════════════════

const BenchmarksV2 = {
    
    // Total retirement savings by age (RRSP + TFSA + pension + investments)
    // Source estimates: Statistics Canada Family Finances Survey, bank retirement reports
    savingsByAge: {
        25: { 
            median: 5000,      // Most 25-year-olds have very little saved
            average: 18000,    // Pulled up by inheritance, early savers
            percentiles: {
                p25: 1000,     // 25th percentile
                p75: 25000     // 75th percentile
            }
        },
        30: { 
            median: 25000,     // Starting to save seriously
            average: 58000,    // Some have substantial amounts
            percentiles: {
                p25: 8000,
                p75: 85000
            }
        },
        35: { 
            median: 55000,     // Mid-career accumulation
            average: 115000,   // Gap widening
            percentiles: {
                p25: 20000,
                p75: 165000
            }
        },
        40: { 
            median: 95000,     // Peak earning/saving years begin
            average: 195000,   
            percentiles: {
                p25: 35000,
                p75: 285000
            }
        },
        45: { 
            median: 155000,    // Should have ~2-3x salary saved
            average: 305000,   
            percentiles: {
                p25: 60000,
                p75: 450000
            }
        },
        50: { 
            median: 235000,    // Retirement visible on horizon
            average: 455000,   
            percentiles: {
                p25: 95000,
                p75: 650000
            }
        },
        55: { 
            median: 325000,    // Final push to retirement
            average: 615000,   
            percentiles: {
                p25: 135000,
                p75: 900000
            }
        },
        60: { 
            median: 425000,    // Approaching retirement
            average: 775000,   
            percentiles: {
                p25: 185000,
                p75: 1150000
            }
        },
        65: { 
            median: 480000,    // Retirement age - what Canadians actually have
            average: 850000,   // Many have much more, many have much less
            percentiles: {
                p25: 200000,
                p75: 1300000
            }
        },
        70: { 
            median: 390000,    // Drawing down in early retirement
            average: 720000,   
            percentiles: {
                p25: 150000,
                p75: 1100000
            }
        },
        75: { 
            median: 310000,    // Continued drawdown
            average: 600000,   
            percentiles: {
                p25: 100000,
                p75: 900000
            }
        },
        80: { 
            median: 230000,    // Later retirement
            average: 480000,   
            percentiles: {
                p25: 60000,
                p75: 700000
            }
        }
    },

    // Monthly contribution benchmarks (all retirement accounts combined)
    monthlyContribution: {
        median: 485,           // Typical Canadian saves ~$485/month
        average: 725,          // Average pulled up by high earners
        recommended: 0.15,     // 15% of gross income is recommended
        byIncome: {
            under50k: { median: 200, average: 285 },
            '50kto75k': { median: 425, average: 575 },
            '75kto100k': { median: 650, average: 875 },
            '100kto150k': { median: 950, average: 1350 },
            over150k: { median: 1500, average: 2400 }
        }
    },

    // Annual spending in retirement (actual Canadian retiree data)
    retirementSpending: {
        modest: {
            annual: 35000,
            median: 32000,
            description: 'Basic needs, limited discretionary spending'
        },
        average: {
            annual: 48000,       // What typical Canadian retirees actually spend
            median: 44000,
            description: 'What most Canadian retirees actually spend'
        },
        comfortable: {
            annual: 62000,
            median: 58000,
            description: 'Above-average lifestyle, regular travel'
        },
        affluent: {
            annual: 95000,
            median: 85000,
            description: 'High-end lifestyle, frequent travel, luxury'
        },
        replacementRate: 0.70  // Rule of thumb: 70% of pre-retirement income
    },

    // Average income by age (Canadian workers, 2024)
    // Source: Statistics Canada Labour Force Survey data
    incomeByAge: {
        25: 43000,
        30: 54000,
        35: 64000,
        40: 72000,
        45: 78000,
        50: 82000,
        55: 80000,     // Slight decline as some reduce hours
        60: 72000,     // Many semi-retired
        65: 38000      // Mix of part-time, consulting
    },

    // Income distribution (for comparison messaging)
    incomePercentiles: {
        p25: 42000,    // 25th percentile
        median: 62000,  // Median Canadian income
        p75: 95000,    // 75th percentile
        p90: 135000    // 90th percentile
    },

    /**
     * Get benchmark savings for a given age
     */
    getSavingsBenchmark(age) {
        const ages = Object.keys(this.savingsByAge).map(Number).sort((a, b) => a - b);
        const closestAge = ages.reduce((prev, curr) => 
            Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev
        );
        
        return {
            age: closestAge,
            ...this.savingsByAge[closestAge]
        };
    },

    /**
     * Compare user's savings to benchmarks with detailed messaging
     */
    compareSavings(age, savings) {
        const benchmark = this.getSavingsBenchmark(age);
        
        const vsMedian = Math.round(((savings / benchmark.median) - 1) * 100);
        const vsAverage = ((savings / benchmark.average) - 1) * 100;
        
        // Determine percentile bracket
        let percentileBracket = '';
        if (savings >= benchmark.percentiles.p75) {
            percentileBracket = 'top 25%';
        } else if (savings >= benchmark.median) {
            percentileBracket = 'top 50%';
        } else if (savings >= benchmark.percentiles.p25) {
            percentileBracket = 'middle 50%';
        } else {
            percentileBracket = 'bottom 25%';
        }
        
        return {
            median: benchmark.median,
            average: benchmark.average,
            vsMedian: Math.round(vsMedian),
            vsAverage: Math.round(vsAverage),
            percentileBracket,
            message: this._getSavingsMessage(vsMedian, percentileBracket),
            detailedMessage: this._getDetailedSavingsMessage(age, savings, benchmark)
        };
    },

    /**
     * Compare monthly contribution to benchmarks
     */
    compareContribution(monthly, income) {
        const annual = monthly * 12;
        const recommended = income * this.monthlyContribution.recommended;
        const vsRecommended = ((annual / recommended) - 1) * 100;
        
        const vsMedian = Math.round(((monthly / this.monthlyContribution.median) - 1) * 100);
        const vsAverage = ((monthly / this.monthlyContribution.average) - 1) * 100;
        
        // Get income bracket benchmark
        let incomeBracket;
        if (income < 50000) incomeBracket = this.monthlyContribution.byIncome.under50k;
        else if (income < 75000) incomeBracket = this.monthlyContribution.byIncome['50kto75k'];
        else if (income < 100000) incomeBracket = this.monthlyContribution.byIncome['75kto100k'];
        else if (income < 150000) incomeBracket = this.monthlyContribution.byIncome['100kto150k'];
        else incomeBracket = this.monthlyContribution.byIncome.over150k;
        
        const vsIncomePeer = ((monthly / incomeBracket.median) - 1) * 100;
        
        return {
            recommended: Math.round(recommended / 12),
            vsRecommended: Math.round(vsRecommended),
            vsMedian: Math.round(vsMedian),
            vsAverage: Math.round(vsAverage),
            vsIncomePeer: Math.round(vsIncomePeer),
            incomePeerMedian: incomeBracket.median,
            message: this._getContributionMessage(vsRecommended, vsIncomePeer)
        };
    },

    /**
     * Compare income to Canadian averages
     */
    compareIncome(income, age) {
        const ageIncome = this.incomeByAge[Math.min(Math.max(age, 25), 65)] || this.incomePercentiles.median;
        const vsAge = ((income / ageIncome) - 1) * 100;
        const vsMedian = Math.round(((income / this.incomePercentiles.median) - 1) * 100);
        
        let percentileBracket = '';
        if (income >= this.incomePercentiles.p90) percentileBracket = 'top 10%';
        else if (income >= this.incomePercentiles.p75) percentileBracket = 'top 25%';
        else if (income >= this.incomePercentiles.median) percentileBracket = 'above median';
        else if (income >= this.incomePercentiles.p25) percentileBracket = 'below median';
        else percentileBracket = 'bottom 25%';
        
        return {
            ageAverage: ageIncome,
            median: this.incomePercentiles.median,
            vsAge: Math.round(vsAge),
            vsMedian: Math.round(vsMedian),
            percentileBracket,
            message: this._getIncomeMessage(vsAge, percentileBracket)
        };
    },

    /**
     * Get recommended retirement spending based on income
     */
    getRecommendedSpending(income) {
        return Math.round(income * this.retirementSpending.replacementRate);
    },

    /**
     * Compare retirement spending to actual Canadian retiree spending
     */
    compareSpending(spending) {
        const vsMedian = Math.round(((spending / this.retirementSpending.average.median) - 1) * 100);
        
        let category = '';
        if (spending <= this.retirementSpending.modest.annual) {
            category = 'modest';
        } else if (spending <= this.retirementSpending.average.annual) {
            category = 'average';
        } else if (spending <= this.retirementSpending.comfortable.annual) {
            category = 'comfortable';
        } else {
            category = 'affluent';
        }
        
        return {
            category,
            vsMedian: Math.round(vsMedian),
            medianSpending: this.retirementSpending.average.median,
            message: this._getSpendingMessage(category, vsMedian)
        };
    },

    // Internal: Generate savings comparison message
    _getSavingsMessage(vsMedian, percentileBracket, age) {
        if (vsMedian > 200) {
            return `You're <strong>well ahead</strong> — on track for an early or very comfortable retirement`;
        } else if (vsMedian > 100) {
            return `<strong>Strong position</strong> — you have real flexibility in when and how you retire`;
        } else if (vsMedian > 50) {
            return `<strong>Above average</strong> — keep this up and retirement should be comfortable`;
        } else if (vsMedian > 15) {
            return `<strong>Ahead of most</strong> Canadians your age — solid foundation`;
        } else if (vsMedian > -15) {
            return `<strong>Right around typical</strong> — increasing contributions now has outsized impact`;
        } else if (vsMedian > -40) {
            return `<strong>Below typical</strong> — consider boosting savings rate to close the gap`;
        } else {
            return `<strong>Behind most peers</strong> — even small increases now compound significantly`;
        }
    },

    _getDetailedSavingsMessage(age, savings, benchmark) {
        return `
            At age ${age}, typical Canadians have:
            • Median: $${benchmark.median.toLocaleString()}
            • Average: $${benchmark.average.toLocaleString()}
            • 25th percentile: $${benchmark.percentiles.p25.toLocaleString()}
            • 75th percentile: $${benchmark.percentiles.p75.toLocaleString()}
            
            You have: $${savings.toLocaleString()}
        `.trim();
    },

    _getContributionMessage(vsRecommended, vsIncomePeer) {
        if (vsRecommended > 20) {
            return `<strong>Exceeding the 15% target</strong> — you're building wealth faster than most`;
        } else if (vsRecommended > -5) {
            return `<strong>Meeting the recommended 15%</strong> — this is the savings sweet spot`;
        } else if (vsIncomePeer > 0) {
            return `<strong>Saving more than peers</strong> at your income level — good relative position`;
        } else if (vsRecommended > -25) {
            return `<strong>Below the 15% target</strong> — try to close the gap gradually`;
        } else {
            return `<strong>Well below target</strong> — even $100/mo more makes a real difference over time`;
        }
    },

    _getIncomeMessage(vsAge, percentileBracket) {
        if (percentileBracket === 'top 10%') {
            return `You're in the <strong>top 10%</strong> (high income)`;
        } else if (percentileBracket === 'top 25%') {
            return `You're in the <strong>top 25%</strong> — strong earning position`;
        } else if (percentileBracket === 'above median') {
            return `<strong>Above median</strong> Canadian income`;
        } else if (percentileBracket === 'below median') {
            return `<strong>Below median</strong> — savings rate matters more than income`;
        } else {
            return `<strong>Lower income bracket</strong> — GIS + OAS provide a solid safety net`;
        }
    },

    _getSpendingMessage(category, vsMedian) {
        if (category === 'modest') {
            return `<strong>Modest lifestyle</strong> — easier to fund, but consider if it covers healthcare costs`;
        } else if (category === 'average') {
            return `<strong>Typical retiree spending</strong> — realistic and sustainable for most portfolios`;
        } else if (category === 'comfortable') {
            return `<strong>Comfortable lifestyle</strong> — requires a well-funded portfolio to sustain`;
        } else {
            return `<strong>Affluent lifestyle</strong> — needs significant savings or income sources`;
        }
    }
};

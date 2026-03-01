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
    // Note: Single vs Couple spending differs significantly
    retirementSpending: {
        modest: {
            annual: 35000,
            median: 32000,
            coupleAnnual: 48000,     // ~1.35x single
            coupleMedian: 44000,
            description: 'Basic needs, limited discretionary spending'
        },
        average: {
            annual: 48000,           // Single retiree
            median: 44000,
            coupleAnnual: 65000,     // Couple (combined household)
            coupleMedian: 60000,
            description: 'What most Canadian retirees actually spend'
        },
        comfortable: {
            annual: 62000,           // Single
            median: 58000,
            coupleAnnual: 85000,     // Couple
            coupleMedian: 78000,
            description: 'Above-average lifestyle, regular travel'
        },
        affluent: {
            annual: 95000,           // Single
            median: 85000,
            coupleAnnual: 130000,    // Couple
            coupleMedian: 115000,
            description: 'High-end lifestyle, frequent travel, luxury'
        },
        ultrawealthy: {
            annual: 150000,          // Single - ultra-high-net-worth
            median: 135000,
            coupleAnnual: 200000,    // Couple
            coupleMedian: 180000,
            description: 'Top 5% lifestyle, unlimited travel, luxury everything'
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
        
        const vsMedian = ((savings / benchmark.median) - 1) * 100;
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
        
        const vsMedian = ((monthly / this.monthlyContribution.median) - 1) * 100;
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
        const vsMedian = ((income / this.incomePercentiles.median) - 1) * 100;
        
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
        const vsMedian = ((spending / this.retirementSpending.average.median) - 1) * 100;
        
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
    _getSavingsMessage(vsMedian, percentileBracket) {
        if (vsMedian > 100) {
            return `💪 Excellent! You're in the ${percentileBracket} (${vsMedian > 0 ? '+' : ''}${vsMedian}% vs median)`;
        } else if (vsMedian > 50) {
            return `📈 Well above median (${percentileBracket}, ${vsMedian > 0 ? '+' : ''}${vsMedian}%)`;
        } else if (vsMedian > 15) {
            return `✅ Above median (${percentileBracket}, ${vsMedian > 0 ? '+' : ''}${vsMedian}%)`;
        } else if (vsMedian > -15) {
            return `📊 Near median (${percentileBracket})`;
        } else if (vsMedian > -40) {
            return `⚠️ Below median (${percentileBracket}, ${vsMedian}%)`;
        } else {
            return `🚨 Well below median (${percentileBracket}, ${vsMedian}%)`;
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
            return `💪 Exceeding recommended 15% (${vsRecommended > 0 ? '+' : ''}${vsRecommended}%)`;
        } else if (vsRecommended > -5) {
            return `✅ Meeting recommended target`;
        } else if (vsIncomePeer > 0) {
            return `📊 Above peers at your income level (${vsIncomePeer > 0 ? '+' : ''}${vsIncomePeer}%)`;
        } else if (vsRecommended > -25) {
            return `⚠️ Below recommended 15% (${vsRecommended}%)`;
        } else {
            return `🚨 Well below recommended (${vsRecommended}%)`;
        }
    },

    _getIncomeMessage(vsAge, percentileBracket) {
        if (percentileBracket === 'top 10%') {
            return `💪 Top 10% of Canadian earners`;
        } else if (percentileBracket === 'top 25%') {
            return `📈 Top 25% of Canadian earners`;
        } else if (percentileBracket === 'above median') {
            return `✅ Above median Canadian income`;
        } else if (percentileBracket === 'below median') {
            return `📊 Below median Canadian income`;
        } else {
            return `⚠️ Bottom 25% of Canadian earners`;
        }
    },

    _getSpendingMessage(category, vsMedian) {
        const categories = {
            modest: '💰 Modest retirement lifestyle',
            average: '📊 Typical Canadian retiree spending',
            comfortable: '✨ Comfortable retirement lifestyle',
            affluent: '🌟 Affluent retirement lifestyle'
        };
        
        return `${categories[category]} (${vsMedian > 0 ? '+' : ''}${vsMedian}% vs median)`;
    }
};

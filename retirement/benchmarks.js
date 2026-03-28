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
            median: 5000, average: 18000,
            percentiles: { p1: 0, p10: 0, p25: 1000, p75: 25000, p90: 55000, p95: 90000, p99: 200000 }
        },
        30: { 
            median: 25000, average: 58000,
            percentiles: { p1: 0, p10: 1500, p25: 8000, p75: 85000, p90: 170000, p95: 280000, p99: 550000 }
        },
        35: { 
            median: 55000, average: 115000,
            percentiles: { p1: 0, p10: 5000, p25: 20000, p75: 165000, p90: 320000, p95: 500000, p99: 950000 }
        },
        40: { 
            median: 95000, average: 195000,
            percentiles: { p1: 0, p10: 10000, p25: 35000, p75: 285000, p90: 520000, p95: 800000, p99: 1500000 }
        },
        45: { 
            median: 155000, average: 305000,
            percentiles: { p1: 0, p10: 18000, p25: 60000, p75: 450000, p90: 780000, p95: 1150000, p99: 2200000 }
        },
        50: { 
            median: 235000, average: 455000,
            percentiles: { p1: 0, p10: 30000, p25: 95000, p75: 650000, p90: 1100000, p95: 1600000, p99: 3000000 }
        },
        55: { 
            median: 325000, average: 615000,
            percentiles: { p1: 500, p10: 45000, p25: 135000, p75: 900000, p90: 1500000, p95: 2100000, p99: 4000000 }
        },
        60: { 
            median: 425000, average: 775000,
            percentiles: { p1: 2000, p10: 65000, p25: 185000, p75: 1150000, p90: 1900000, p95: 2700000, p99: 5000000 }
        },
        65: { 
            median: 480000, average: 850000,
            percentiles: { p1: 5000, p10: 75000, p25: 200000, p75: 1300000, p90: 2100000, p95: 3000000, p99: 5500000 }
        }
    },

    // Couple savings multiplier (couples typically have ~1.6x individual savings)
    coupleSavingsMultiplier: 1.6,

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
        p1: 15000,     // 1st percentile
        p10: 25000,    // 10th percentile
        p25: 42000,    // 25th percentile
        median: 62000,  // Median Canadian income
        p75: 95000,    // 75th percentile
        p90: 135000,   // 90th percentile
        p95: 180000,   // 95th percentile
        p99: 300000    // 99th percentile
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
    compareSavings(age, savings, isCouple = false) {
        const benchmark = this.getSavingsBenchmark(age);
        const mult = isCouple ? this.coupleSavingsMultiplier : 1;
        const adjMedian = Math.round(benchmark.median * mult);
        const adjAverage = Math.round(benchmark.average * mult);
        const p = {};
        for (const k of Object.keys(benchmark.percentiles)) {
            p[k] = Math.round(benchmark.percentiles[k] * mult);
        }
        
        const vsMedian = adjMedian > 0 ? Math.round(((savings / adjMedian) - 1) * 100) : 0;
        
        let percentileBracket = '';
        if (savings >= p.p99) percentileBracket = 'top 1%';
        else if (savings >= p.p95) percentileBracket = 'top 5%';
        else if (savings >= p.p90) percentileBracket = 'top 10%';
        else if (savings >= p.p75) percentileBracket = 'top 25%';
        else if (savings >= adjMedian) percentileBracket = 'top 50%';
        else if (savings >= p.p25) percentileBracket = 'middle 50%';
        else if (savings >= p.p10) percentileBracket = 'bottom 25%';
        else if (savings >= p.p1) percentileBracket = 'bottom 10%';
        else percentileBracket = 'bottom 1%';
        
        return {
            median: adjMedian,
            average: adjAverage,
            vsMedian,
            vsAverage: adjAverage > 0 ? Math.round(((savings / adjAverage) - 1) * 100) : 0,
            percentileBracket,
            message: this._getSavingsMessage(vsMedian, percentileBracket),
            detailedMessage: this._getDetailedSavingsMessage(age, savings, { median: adjMedian, average: adjAverage, percentiles: p })
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
        if (income >= this.incomePercentiles.p99) percentileBracket = 'top 1%';
        else if (income >= this.incomePercentiles.p95) percentileBracket = 'top 5%';
        else if (income >= this.incomePercentiles.p90) percentileBracket = 'top 10%';
        else if (income >= this.incomePercentiles.p75) percentileBracket = 'top 25%';
        else if (income >= this.incomePercentiles.median) percentileBracket = 'above median';
        else if (income >= this.incomePercentiles.p25) percentileBracket = 'below median';
        else if (income >= this.incomePercentiles.p10) percentileBracket = 'bottom 25%';
        else if (income >= this.incomePercentiles.p1) percentileBracket = 'bottom 10%';
        else percentileBracket = 'bottom 1%';
        
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
    compareSpending(spending, isSingle = true) {
        const medianKey = isSingle ? 'median' : 'coupleMedian';
        const vsMedian = Math.round(((spending / this.retirementSpending.average[medianKey]) - 1) * 100);
        
        let category = '';
        const annualKey = isSingle ? 'annual' : 'coupleAnnual';
        if (spending <= this.retirementSpending.modest[annualKey]) {
            category = 'modest';
        } else if (spending <= this.retirementSpending.average[annualKey]) {
            category = 'average';
        } else if (spending <= this.retirementSpending.comfortable[annualKey]) {
            category = 'comfortable';
        } else if (spending <= this.retirementSpending.affluent[annualKey]) {
            category = 'affluent';
        } else {
            category = 'ultrawealthy';
        }
        
        return {
            category,
            vsMedian: Math.round(vsMedian),
            medianSpending: this.retirementSpending.average[medianKey],
            message: this._getSpendingMessage(category, vsMedian)
        };
    },

    /**
     * Get regional spending estimate (scales by cost of living)
     */
    getRegionalSpending(baseSpending, regionCode) {
        if (!regionCode) return baseSpending;
        
        // Import regional data if available
        if (typeof RegionalDataV2 !== 'undefined') {
            const region = RegionalDataV2.getRegion(regionCode);
            // Scale spending by cost of living index (100 = national average)
            const multiplier = region.costOfLivingIndex / 100;
            return Math.round(baseSpending * multiplier);
        }
        
        return baseSpending;
    },

    // Internal: Generate savings comparison message
    _getSavingsMessage(vsMedian, percentileBracket) {
        const pct = vsMedian > 0 ? `+${vsMedian}%` : `${vsMedian}%`;
        if (percentileBracket === 'top 1%') {
            return `🏆 Top 1% — wealth preservation & estate planning territory (${pct} vs median)`;
        } else if (percentileBracket === 'top 5%') {
            return `💎 Top 5% — tax-efficient drawdown is your biggest lever (${pct} vs median)`;
        } else if (percentileBracket === 'top 10%') {
            return `💪 Top 10% — well ahead, focus on tax optimization (${pct} vs median)`;
        } else if (percentileBracket === 'top 25%') {
            return `📈 Top 25% — above most Canadians your age (${pct} vs median)`;
        } else if (percentileBracket === 'top 50%') {
            return `✅ Above median (${pct} vs median)`;
        } else if (percentileBracket === 'middle 50%') {
            return `📊 Near median — on a typical path (${pct} vs median)`;
        } else if (percentileBracket === 'bottom 25%') {
            return `⚠️ Bottom 25% — maximize TFSA contributions first (${pct} vs median)`;
        } else if (percentileBracket === 'bottom 10%') {
            return `⚠️ Bottom 10% — start with employer match & automatic contributions (${pct} vs median)`;
        } else {
            return `🚨 Bottom 1% — even small regular contributions compound significantly`;
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
        const r = Math.round(vsRecommended);
        const p = Math.round(vsIncomePeer);
        if (r > 20) {
            return `💪 Exceeding recommended 15% (${r > 0 ? '+' : ''}${r}%)`;
        } else if (r > -5) {
            return `✅ Meeting recommended target`;
        } else if (p > 0) {
            return `📊 Above peers at your income level (${p > 0 ? '+' : ''}${p}%)`;
        } else if (r > -25) {
            return `⚠️ Below recommended 15% (${r}%)`;
        } else {
            return `🚨 Well below recommended (${r}%)`;
        }
    },

    _getIncomeMessage(vsAge, percentileBracket) {
        if (percentileBracket === 'top 1%') {
            return `🏆 Top 1% — consider corporate structures & advanced tax strategies`;
        } else if (percentileBracket === 'top 5%') {
            return `💎 Top 5% — estate planning & tax optimization are critical`;
        } else if (percentileBracket === 'top 10%') {
            return `💪 Top 10% — tax-efficient withdrawal planning matters most`;
        } else if (percentileBracket === 'top 25%') {
            return `📈 Top 25% of Canadian earners`;
        } else if (percentileBracket === 'above median') {
            return `✅ Above median Canadian income`;
        } else if (percentileBracket === 'below median') {
            return `📊 Below median Canadian income`;
        } else if (percentileBracket === 'bottom 25%') {
            return `⚠️ Bottom 25% — CPP/OAS will form a large share of retirement income`;
        } else if (percentileBracket === 'bottom 10%') {
            return `⚠️ Bottom 10% — below low-income cut-off, maximize GIS & benefits`;
        } else {
            return `⚠️ Bottom 1% — GIS/social assistance range, government benefits are key`;
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

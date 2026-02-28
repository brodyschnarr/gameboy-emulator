// ═══════════════════════════════════════════
//  Canadian Retirement Benchmarks (2024 data)
// ═══════════════════════════════════════════

const Benchmarks = {
    
    // Total savings by age (all retirement accounts combined)
    // Source: Statistics Canada, Bank of Canada surveys
    savingsByAge: {
        25: { median: 8000, average: 15000 },
        30: { median: 22000, average: 45000 },
        35: { median: 45000, average: 95000 },
        40: { median: 80000, average: 170000 },
        45: { median: 130000, average: 260000 },
        50: { median: 190000, average: 380000 },
        55: { median: 270000, average: 540000 },
        60: { median: 350000, average: 680000 },
        65: { median: 400000, average: 750000 }
    },

    // Monthly contribution benchmarks
    monthlyContribution: {
        median: 450,     // Typical Canadian saves ~$450/month
        average: 680,    // Average is pulled up by high earners
        recommended: 0.15 // 15% of gross income is recommended
    },

    // Annual spending in retirement by lifestyle
    retirementSpending: {
        modest: {
            annual: 35000,
            description: 'Basic needs, limited travel, modest lifestyle'
        },
        comfortable: {
            annual: 60000,
            description: 'Regular travel, hobbies, dining out, comfortable'
        },
        luxury: {
            annual: 90000,
            description: 'Frequent travel, expensive hobbies, high comfort'
        },
        // Rule of thumb: 70% of pre-retirement income
        replacementRate: 0.70
    },

    // Average Canadian income by age (2024)
    incomeByAge: {
        25: 42000,
        30: 52000,
        35: 62000,
        40: 70000,
        45: 75000,
        50: 78000,
        55: 75000,
        60: 68000,
        65: 35000  // Many semi-retired
    },

    /**
     * Get benchmark savings for a given age
     * @param {number} age - User's age
     * @returns {object} - Median and average savings
     */
    getSavingsBenchmark(age) {
        // Find closest age bracket
        const ages = Object.keys(this.savingsByAge).map(Number).sort((a, b) => a - b);
        const closestAge = ages.reduce((prev, curr) => 
            Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev
        );
        
        return this.savingsByAge[closestAge];
    },

    /**
     * Compare user's savings to benchmarks
     * @param {number} age - User's age
     * @param {number} savings - User's total savings
     * @returns {object} - Comparison with median/average
     */
    compareSavings(age, savings) {
        const benchmark = this.getSavingsBenchmark(age);
        
        const vsMedian = ((savings / benchmark.median) - 1) * 100;
        const vsAverage = ((savings / benchmark.average) - 1) * 100;
        
        return {
            median: benchmark.median,
            average: benchmark.average,
            vsMedian: Math.round(vsMedian),
            vsAverage: Math.round(vsAverage),
            message: this._getComparisonMessage(vsMedian, vsAverage)
        };
    },

    /**
     * Compare user's monthly contribution to benchmarks
     * @param {number} monthly - User's monthly contribution
     * @param {number} income - User's annual income
     * @returns {object} - Comparison message
     */
    compareContribution(monthly, income) {
        const annual = monthly * 12;
        const recommended = income * this.monthlyContribution.recommended;
        const vsRecommended = ((annual / recommended) - 1) * 100;
        
        const vsMedian = ((monthly / this.monthlyContribution.median) - 1) * 100;
        
        return {
            recommended: Math.round(recommended / 12),
            vsRecommended: Math.round(vsRecommended),
            vsMedian: Math.round(vsMedian),
            message: this._getContributionMessage(vsRecommended, vsMedian)
        };
    },

    /**
     * Get comparison message for savings
     */
    _getComparisonMessage(vsMedian, vsAverage) {
        if (vsMedian > 50) {
            return `💪 Well above median (${vsMedian > 0 ? '+' : ''}${vsMedian}%)`;
        } else if (vsMedian > 15) {
            return `📈 Above median (${vsMedian > 0 ? '+' : ''}${vsMedian}%)`;
        } else if (vsMedian > -15) {
            return `📊 Near median (${vsMedian > 0 ? '+' : ''}${vsMedian}%)`;
        } else if (vsMedian > -40) {
            return `⚠️ Below median (${vsMedian}%)`;
        } else {
            return `🚨 Well below median (${vsMedian}%)`;
        }
    },

    /**
     * Get comparison message for contributions
     */
    _getContributionMessage(vsRecommended, vsMedian) {
        if (vsRecommended > 20) {
            return `💪 Exceeding recommended (${vsRecommended > 0 ? '+' : ''}${vsRecommended}%)`;
        } else if (vsRecommended > -10) {
            return `✅ Meeting recommended target`;
        } else if (vsRecommended > -30) {
            return `⚠️ Below recommended (${vsRecommended}%)`;
        } else {
            return `🚨 Well below recommended (${vsRecommended}%)`;
        }
    },

    /**
     * Get recommended retirement spending based on income
     * @param {number} income - Pre-retirement income
     * @returns {number} - Recommended annual spending in retirement
     */
    getRecommendedSpending(income) {
        return Math.round(income * this.retirementSpending.replacementRate);
    }
};

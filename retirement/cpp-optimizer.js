// ═══════════════════════════════════════════
//  CPP Start Age Optimizer
// ═══════════════════════════════════════════

const CPPOptimizer = {
    
    /**
     * Calculate CPP amount based on start age
     * CPP reduces by 0.6% per month before 65 (36% at age 60)
     * CPP increases by 0.7% per month after 65 (42% at age 70)
     */
    calculateByAge(baseAmount, startAge) {
        const standardAge = 65;
        const monthsDiff = (startAge - standardAge) * 12;
        
        let adjustment = 0;
        if (startAge < 65) {
            // Reduction: 0.6% per month, max 36% (60 months)
            adjustment = Math.max(monthsDiff * 0.006, -0.36);
        } else if (startAge > 65) {
            // Increase: 0.7% per month, max 42% (60 months)
            adjustment = Math.min(monthsDiff * 0.007, 0.42);
        }
        
        return baseAmount * (1 + adjustment);
    },

    /**
     * Calculate lifetime CPP value for different start ages
     * Factors in: reduced/increased monthly amount + years of collection
     */
    calculateLifetimeValue(baseAmount, startAge, lifeExpectancy) {
        const monthlyAmount = this.calculateByAge(baseAmount, startAge) / 12;
        const yearsCollecting = lifeExpectancy - startAge;
        const monthsCollecting = yearsCollecting * 12;
        
        return {
            monthlyAmount: Math.round(monthlyAmount),
            annualAmount: Math.round(monthlyAmount * 12),
            totalLifetime: Math.round(monthlyAmount * monthsCollecting),
            yearsCollecting
        };
    },

    /**
     * Compare different start ages
     */
    compareStartAges(baseAmount, lifeExpectancy) {
        const ages = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70];
        
        return ages.map(age => {
            const data = this.calculateLifetimeValue(baseAmount, age, lifeExpectancy);
            return {
                age,
                ...data
            };
        });
    },

    /**
     * Find optimal start age (maximizes lifetime value)
     */
    findOptimal(baseAmount, lifeExpectancy) {
        const comparison = this.compareStartAges(baseAmount, lifeExpectancy);
        
        let optimal = comparison[0];
        comparison.forEach(option => {
            if (option.totalLifetime > optimal.totalLifetime) {
                optimal = option;
            }
        });
        
        return optimal;
    },

    /**
     * Get break-even age between two start ages
     */
    getBreakEven(baseAmount, startAge1, startAge2) {
        // Simplified break-even: when total collected equals
        const data1 = this.calculateLifetimeValue(baseAmount, startAge1, 100); // Use 100 as max
        const data2 = this.calculateLifetimeValue(baseAmount, startAge2, 100);
        
        // Find age where cumulative totals cross
        let age = Math.max(startAge1, startAge2);
        let total1 = 0;
        let total2 = 0;
        
        while (age < 100) {
            if (age >= startAge1) total1 += data1.annualAmount;
            if (age >= startAge2) total2 += data2.annualAmount;
            
            if (total2 > total1) {
                return age;
            }
            age++;
        }
        
        return null; // No break-even found
    }
};

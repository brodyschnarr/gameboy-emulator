// ═══════════════════════════════════════════
//  Healthcare Cost Estimator (Canadian)
// ═══════════════════════════════════════════

const HealthcareEstimator = {
    
    // Average annual costs by age (Canadian data)
    baseCosts: {
        age65to74: 3500,   // Prescriptions, dental, vision, supplements
        age75to84: 5500,   // Above + more frequent medical needs
        age85plus: 8500    // Above + potential home care/assistance
    },

    // Provincial health premium adjustments
    provincialAdjustments: {
        ON: 1.0,   // Base
        BC: 0.95,  // Slightly lower
        AB: 0.90,  // Lower (better coverage)
        QC: 1.05,  // Slightly higher
        MB: 0.95,
        SK: 0.90,
        NS: 1.10,  // Higher (limited coverage)
        NB: 1.08,
        PE: 1.12,
        NL: 1.05
    },

    /**
     * Estimate annual healthcare costs
     */
    estimateAnnual(age, province = 'ON', healthStatus = 'average') {
        // Base cost by age
        let baseCost = this.baseCosts.age65to74;
        if (age >= 85) baseCost = this.baseCosts.age85plus;
        else if (age >= 75) baseCost = this.baseCosts.age75to84;

        // Provincial adjustment
        const provincialFactor = this.provincialAdjustments[province] || 1.0;

        // Health status multiplier
        const healthMultipliers = {
            excellent: 0.7,
            good: 0.85,
            average: 1.0,
            fair: 1.3,
            poor: 1.8
        };
        const healthFactor = healthMultipliers[healthStatus] || 1.0;

        return Math.round(baseCost * provincialFactor * healthFactor);
    },

    /**
     * Project total healthcare costs over retirement
     */
    projectTotal(retirementAge, lifeExpectancy, province = 'ON', healthStatus = 'average') {
        let total = 0;
        const byYear = [];
        
        for (let age = retirementAge; age <= lifeExpectancy; age++) {
            const annualCost = this.estimateAnnual(age, province, healthStatus);
            total += annualCost;
            byYear.push({
                age: age,
                cost: annualCost
            });
        }

        return {
            total: Math.round(total),
            averageAnnual: Math.round(total / (lifeExpectancy - retirementAge + 1)),
            byYear: byYear,
            breakdown: {
                prescriptions: Math.round(total * 0.40),  // 40% prescriptions
                dental: Math.round(total * 0.25),         // 25% dental
                vision: Math.round(total * 0.15),         // 15% vision
                other: Math.round(total * 0.20)           // 20% other
            }
        };
    },

    /**
     * Get breakdown by category for display
     */
    getBreakdown() {
        return {
            categories: [
                { name: 'Prescriptions', percent: 40, description: 'Medications not covered by provincial plans' },
                { name: 'Dental Care', percent: 25, description: 'Cleanings, fillings, dentures' },
                { name: 'Vision Care', percent: 15, description: 'Glasses, eye exams, contacts' },
                { name: 'Other', percent: 20, description: 'Supplements, physio, massage, hearing aids' }
            ]
        };
    },

    /**
     * Get recommendations based on age/health
     */
    getRecommendations(age, income) {
        const recommendations = [];

        // Private insurance recommendation
        if (income > 50000) {
            recommendations.push({
                title: 'Consider Private Health Insurance',
                description: 'At your income level, a private health plan may be worth it to cover gaps in provincial coverage.',
                priority: 'medium'
            });
        }

        // Health Spending Account
        if (income > 75000) {
            recommendations.push({
                title: 'Health Spending Account (HSA)',
                description: 'Set aside $3,000-5,000/year tax-free for medical expenses.',
                priority: 'high'
            });
        }

        // Long-term care planning
        if (age >= 55) {
            recommendations.push({
                title: 'Plan for Long-Term Care',
                description: 'After age 75, costs can increase significantly. Consider long-term care insurance or setting aside extra savings.',
                priority: age >= 65 ? 'high' : 'medium'
            });
        }

        return recommendations;
    }
};

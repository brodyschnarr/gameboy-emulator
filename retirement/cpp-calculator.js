// ═══════════════════════════════════════════
//  CPP Calculator (2024 rates)
// ═══════════════════════════════════════════

const CPPCalculator = {
    
    // CPP1 (Base CPP) - 2024 values
    cpp1: {
        yearMaxPensionable: 68500,  // YMPE
        yearBasicExemption: 3500,   // YBE
        contributionRate: 0.0595,   // Employee rate (5.95%)
        maxMonthly: 1364.60,        // Max monthly benefit at 65
        maxAnnual: 16375.20         // Max annual benefit
    },

    // CPP2 (Enhanced CPP) - 2024 values
    cpp2: {
        yearMaxPensionable: 73200,  // YAMPE (Additional)
        contributionRate: 0.04,     // Employee rate on earnings above YMPE
        maxMonthly: 113.33,         // Max additional monthly benefit (phasing in)
        maxAnnual: 1360              // Max additional annual benefit (2024, will increase)
    },

    // GIS (Guaranteed Income Supplement) - 2024
    gis: {
        maxSingle: 11678,           // Max annual for singles
        maxCouple: 7025,            // Max annual per person in couple
        incomeThresholdSingle: 21624, // Income above which GIS phases out (single)
        incomeThresholdCouple: 28560, // Combined income threshold (couple)
        reductionRate: 0.50         // 50% reduction for every dollar of income
    },

    // OAS (Old Age Security) - 2024
    oas: {
        maxAnnual: 8479,            // Max annual OAS
        maxMonthly: 706.58,         // Max monthly OAS
        clawbackStart: 90997,       // Income where clawback starts
        clawbackEnd: 142609,        // Income where OAS fully clawed back
        clawbackRate: 0.15          // 15% clawback rate
    },

    /**
     * Estimate CPP benefit based on average career earnings
     * @param {number} avgIncome - Average annual income over career
     * @param {number} yearsContributing - Years of CPP contributions (max 39)
     * @returns {object} - CPP1 and CPP2 estimates
     */
    estimateCPP(avgIncome, yearsContributing = 39) {
        // CPP1 calculation
        const pensionableEarnings1 = Math.min(avgIncome, this.cpp1.yearMaxPensionable) - this.cpp1.yearBasicExemption;
        const contributionYears = Math.min(yearsContributing, 39); // Max 39 years counted
        const contributionRatio = contributionYears / 39;
        
        // Simplified: assume 25% replacement rate on pensionable earnings
        const cpp1Annual = Math.min(
            pensionableEarnings1 * 0.25 * contributionRatio,
            this.cpp1.maxAnnual
        );

        // CPP2 calculation (for earnings above YMPE)
        let cpp2Annual = 0;
        if (avgIncome > this.cpp1.yearMaxPensionable) {
            const excessEarnings = Math.min(
                avgIncome - this.cpp1.yearMaxPensionable,
                this.cpp2.yearMaxPensionable - this.cpp1.yearMaxPensionable
            );
            // CPP2 is phasing in, providing ~8.33% replacement on excess earnings
            cpp2Annual = Math.min(
                excessEarnings * 0.0833 * contributionRatio,
                this.cpp2.maxAnnual
            );
        }

        return {
            cpp1: Math.round(cpp1Annual),
            cpp2: Math.round(cpp2Annual),
            total: Math.round(cpp1Annual + cpp2Annual),
            isMax: cpp1Annual >= this.cpp1.maxAnnual * 0.95
        };
    },

    /**
     * Calculate GIS entitlement based on income
     * @param {number} otherIncome - Income from all other sources (OAS, CPP, private)
     * @param {boolean} isSingle - Single or couple
     * @returns {number} - Annual GIS amount
     */
    calculateGIS(otherIncome, isSingle = true) {
        const maxGIS = isSingle ? this.gis.maxSingle : this.gis.maxCouple;
        const threshold = isSingle ? this.gis.incomeThresholdSingle : this.gis.incomeThresholdCouple;
        
        // GIS is reduced by 50 cents for every dollar of income
        const excessIncome = Math.max(0, otherIncome - threshold);
        const reduction = excessIncome * this.gis.reductionRate;
        
        return Math.max(0, Math.round(maxGIS - reduction));
    },

    /**
     * Calculate OAS with clawback
     * @param {number} netIncome - Net world income
     * @returns {number} - Annual OAS after clawback
     */
    calculateOAS(netIncome) {
        if (netIncome <= this.oas.clawbackStart) {
            return this.oas.maxAnnual;
        }
        
        if (netIncome >= this.oas.clawbackEnd) {
            return 0;
        }

        const excessIncome = netIncome - this.oas.clawbackStart;
        const clawback = excessIncome * this.oas.clawbackRate;
        
        return Math.max(0, Math.round(this.oas.maxAnnual - clawback));
    },

    /**
     * Get full government benefits picture
     * @param {number} avgIncome - Average career income
     * @param {number} yearsContributing - Years of CPP contributions
     * @param {number} otherRetirementIncome - Income from RRSP/TFSA/etc withdrawals
     * @param {boolean} isSingle - Single or couple
     * @returns {object} - Full breakdown
     */
    getGovernmentBenefits(avgIncome, yearsContributing, otherRetirementIncome, isSingle = true) {
        // Calculate CPP
        const cpp = this.estimateCPP(avgIncome, yearsContributing);
        
        // Calculate OAS (based on total retirement income)
        const totalIncomeBeforeOAS = cpp.total + otherRetirementIncome;
        const oas = this.calculateOAS(totalIncomeBeforeOAS);
        
        // Calculate GIS (if eligible - typically low income only)
        const totalIncomeBeforeGIS = cpp.total + oas + otherRetirementIncome;
        const gis = this.calculateGIS(totalIncomeBeforeGIS, isSingle);

        return {
            cpp1: cpp.cpp1,
            cpp2: cpp.cpp2,
            cppTotal: cpp.total,
            cppIsMax: cpp.isMax,
            oas,
            gis,
            totalGovernment: cpp.total + oas + gis,
            breakdown: {
                'CPP (Base)': cpp.cpp1,
                'CPP (Enhanced)': cpp.cpp2,
                'OAS': oas,
                'GIS': gis
            }
        };
    }
};

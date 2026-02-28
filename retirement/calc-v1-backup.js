// ═══════════════════════════════════════════
//  Retirement Calculation Engine
// ═══════════════════════════════════════════

const RetirementCalc = {

    /**
     * Main calculation function
     * @param {Object} inputs - User inputs
     * @returns {Object} - Calculation results
     */
    calculate(inputs) {
        const {
            currentAge,
            retirementAge,
            totalSavings,
            monthlyContribution,
            annualSpending,
            returnRate,
            inflationRate,
            withdrawalRate,
            lifeExpectancy,
            includeCPP
        } = inputs;

        const yearsToRetirement = retirementAge - currentAge;
        const yearsInRetirement = lifeExpectancy - retirementAge;

        // 1. Project savings growth until retirement
        const projectedSavings = this._projectGrowth(
            totalSavings,
            monthlyContribution * 12,
            yearsToRetirement,
            returnRate
        );

        // 2. Calculate annual income needed (inflation-adjusted)
        const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsToRetirement);
        const futureAnnualSpending = annualSpending * inflationMultiplier;

        // 3. Add CPP/OAS if included
        let governmentIncome = 0;
        if (includeCPP) {
            governmentIncome = RetirementData.government.cppAverage + 
                             RetirementData.government.oasAverage;
        }

        // 4. Calculate required portfolio size for desired spending
        const netSpendingNeeded = futureAnnualSpending - governmentIncome;
        const requiredPortfolio = netSpendingNeeded / (withdrawalRate / 100);

        // 5. Determine if on track
        const onTrack = projectedSavings >= requiredPortfolio;
        const shortfall = onTrack ? 0 : requiredPortfolio - projectedSavings;

        // 6. Calculate how long money will last
        const withdrawalAmount = projectedSavings * (withdrawalRate / 100);
        const totalAnnualIncome = withdrawalAmount + governmentIncome;
        
        const moneyLastsYears = this._calculateLongevity(
            projectedSavings,
            futureAnnualSpending - governmentIncome,
            returnRate - inflationRate // real return
        );

        const moneyLastsAge = retirementAge + moneyLastsYears;

        // 7. Year-by-year projection
        const yearByYear = this._generateProjection(
            currentAge,
            retirementAge,
            lifeExpectancy,
            totalSavings,
            monthlyContribution * 12,
            returnRate,
            withdrawalRate,
            futureAnnualSpending - governmentIncome
        );

        return {
            onTrack,
            projectedSavings: Math.round(projectedSavings),
            requiredPortfolio: Math.round(requiredPortfolio),
            shortfall: Math.round(shortfall),
            annualIncome: Math.round(totalAnnualIncome),
            withdrawalAmount: Math.round(withdrawalAmount),
            governmentIncome: Math.round(governmentIncome),
            moneyLastsAge: Math.round(moneyLastsAge),
            moneyLastsYears: Math.round(moneyLastsYears),
            futureSpending: Math.round(futureAnnualSpending),
            yearByYear
        };
    },

    /**
     * Project portfolio growth with contributions
     */
    _projectGrowth(principal, annualContribution, years, rate) {
        let balance = principal;
        const r = rate / 100;

        for (let i = 0; i < years; i++) {
            balance = balance * (1 + r) + annualContribution;
        }

        return balance;
    },

    /**
     * Calculate how long portfolio will last
     */
    _calculateLongevity(balance, annualWithdrawal, realReturn) {
        if (annualWithdrawal <= 0) return 100; // money lasts forever
        
        let currentBalance = balance;
        let years = 0;
        const r = realReturn / 100;

        while (currentBalance > 0 && years < 100) {
            currentBalance = currentBalance * (1 + r) - annualWithdrawal;
            years++;
        }

        return years;
    },

    /**
     * Generate year-by-year projection
     */
    _generateProjection(currentAge, retirementAge, lifeExpectancy, 
                       initialSavings, annualContribution, returnRate, 
                       withdrawalRate, annualSpending) {
        const projection = [];
        let balance = initialSavings;
        const r = returnRate / 100;
        const wr = withdrawalRate / 100;

        for (let age = currentAge; age <= lifeExpectancy; age++) {
            const isRetired = age >= retirementAge;

            if (!isRetired) {
                // Accumulation phase
                balance = balance * (1 + r) + annualContribution;
            } else {
                // Withdrawal phase
                const withdrawal = balance * wr;
                balance = balance * (1 + r) - withdrawal;
            }

            projection.push({
                age,
                balance: Math.max(0, balance),
                phase: isRetired ? 'retirement' : 'saving'
            });

            if (balance <= 0) break;
        }

        return projection;
    },

    /**
     * Calculate additional monthly savings needed to hit goal
     */
    calculateNeededSavings(shortfall, yearsToRetirement, returnRate) {
        if (yearsToRetirement <= 0) return 0;

        const r = returnRate / 100;
        const n = yearsToRetirement;

        // Future value of annuity formula, solved for PMT
        // FV = PMT * ((1 + r)^n - 1) / r
        // PMT = FV * r / ((1 + r)^n - 1)
        
        const annualPayment = shortfall * r / (Math.pow(1 + r, n) - 1);
        const monthlyPayment = annualPayment / 12;

        return Math.round(monthlyPayment);
    }
};

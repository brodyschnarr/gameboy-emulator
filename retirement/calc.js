// ═══════════════════════════════════════════
//  Tax-Aware Retirement Calculation Engine V2
// ═══════════════════════════════════════════

const RetirementCalcV2 = {

    /**
     * Main calculation function with tax-aware withdrawals
     * @param {Object} inputs - User inputs
     * @returns {Object} - Detailed results with tax breakdown
     */
    calculate(inputs) {
        const {
            currentAge,
            retirementAge,
            lifeExpectancy,
            province,
            currentIncome,
            
            // Account balances
            rrsp,
            tfsa,
            nonReg,
            other,
            
            // Contributions
            monthlyContribution,
            contributionSplit, // { rrsp: 0.6, tfsa: 0.4, nonReg: 0 }
            
            // Spending
            annualSpending,
            
            // Assumptions
            returnRate,
            inflationRate
        } = inputs;

        const yearsToRetirement = retirementAge - currentAge;
        const yearsInRetirement = lifeExpectancy - retirementAge;

        // 1. Calculate government benefits
        const yearsContributing = Math.min(retirementAge - 18, 39); // Assume started at 18
        const govBenefits = CPPCalculator.getGovernmentBenefits(
            currentIncome,
            yearsContributing,
            0, // We'll calculate withdrawals separately
            true // Assume single for now
        );

        // 2. Inflation-adjusted spending
        const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsToRetirement);
        const futureAnnualSpending = annualSpending * inflationMultiplier;

        // 3. Year-by-year tax-aware projection (handles growth internally)
        const projection = this._generateTaxAwareProjection({
            startAge: currentAge,
            retirementAge,
            lifeExpectancy,
            accounts: { rrsp, tfsa, nonReg, other }, // Pass CURRENT balances, not projected
            annualContribution: monthlyContribution * 12,
            contributionSplit,
            targetSpending: futureAnnualSpending,
            returnRate,
            inflationRate,
            province,
            govBenefits,
            currentIncome
        });

        // 4. Get projected accounts at retirement from the projection
        const retirementYear = projection.find(p => p.age === retirementAge);
        const projectedAccounts = retirementYear ? {
            rrsp: retirementYear.rrsp,
            tfsa: retirementYear.tfsa,
            nonReg: retirementYear.nonReg,
            other: retirementYear.other,
            total: retirementYear.totalBalance
        } : { rrsp: 0, tfsa: 0, nonReg: 0, other: 0, total: 0 };

        // 5. Summary stats
        const retirementYear = projection.find(p => p.age === retirementAge);
        const finalYear = projection[projection.length - 1];
        const moneyLastsAge = finalYear.totalBalance > 0 ? lifeExpectancy : 
                             projection.find(p => p.totalBalance <= 0)?.age || retirementAge;

        // 6. Calculate if on track
        const needsThrough = projection.filter(p => p.age >= retirementAge && p.age <= lifeExpectancy);
        const onTrack = needsThrough.every(p => p.afterTaxIncome >= p.targetSpending);

        return {
            onTrack,
            projectedAccounts,
            govBenefits,
            yearByYear: projection,
            summary: {
                portfolioAtRetirement: retirementYear?.totalBalance || 0,
                annualIncomeAtRetirement: retirementYear?.afterTaxIncome || 0,
                governmentIncome: govBenefits.totalGovernment,
                moneyLastsAge,
                yearsInRetirement: moneyLastsAge - retirementAge,
                avgTaxRateInRetirement: this._calculateAvgTaxRate(projection.filter(p => p.age >= retirementAge))
            }
        };
    },

    /**
     * Project account growth during accumulation phase
     */
    _projectAccountGrowth(accounts, monthlyContribution, split, years, returnRate, income, province) {
        let balances = { ...accounts };
        const annualContribution = monthlyContribution * 12;
        const r = returnRate / 100;

        for (let i = 0; i < years; i++) {
            // Grow existing balances
            balances.rrsp *= (1 + r);
            balances.tfsa *= (1 + r);
            balances.nonReg *= (1 + r);
            balances.other *= (1 + r);

            // Add contributions (split according to user preference)
            balances.rrsp += annualContribution * (split.rrsp || 0);
            balances.tfsa += annualContribution * (split.tfsa || 0);
            balances.nonReg += annualContribution * (split.nonReg || 0);
        }

        return {
            rrsp: Math.round(balances.rrsp),
            tfsa: Math.round(balances.tfsa),
            nonReg: Math.round(balances.nonReg),
            other: Math.round(balances.other),
            total: Math.round(balances.rrsp + balances.tfsa + balances.nonReg + balances.other)
        };
    },

    /**
     * Generate year-by-year projection with tax-aware withdrawals
     */
    _generateTaxAwareProjection(params) {
        const {
            startAge,
            retirementAge,
            lifeExpectancy,
            accounts,
            annualContribution,
            contributionSplit,
            targetSpending,
            returnRate,
            inflationRate,
            province,
            govBenefits,
            currentIncome
        } = params;

        const projection = [];
        let balances = { ...accounts };
        const r = returnRate / 100;
        const inf = inflationRate / 100;
        let currentTargetSpending = targetSpending;

        for (let age = startAge; age <= lifeExpectancy; age++) {
            const isRetired = age >= retirementAge;
            const isWorking = age < retirementAge;

            // Working phase: contribute and grow
            if (isWorking) {
                balances.rrsp *= (1 + r);
                balances.tfsa *= (1 + r);
                balances.nonReg *= (1 + r);
                balances.other *= (1 + r);

                balances.rrsp += annualContribution * (contributionSplit.rrsp || 0);
                balances.tfsa += annualContribution * (contributionSplit.tfsa || 0);
                balances.nonReg += annualContribution * (contributionSplit.nonReg || 0);

                projection.push({
                    age,
                    phase: 'accumulation',
                    rrsp: Math.round(balances.rrsp),
                    tfsa: Math.round(balances.tfsa),
                    nonReg: Math.round(balances.nonReg),
                    other: Math.round(balances.other),
                    totalBalance: Math.round(balances.rrsp + balances.tfsa + balances.nonReg + balances.other),
                    grossIncome: currentIncome,
                    afterTaxIncome: CanadianTax.getAfterTaxIncome(currentIncome, province),
                    taxPaid: 0,
                    targetSpending: 0
                });
            }

            // Retirement phase: withdraw and calculate taxes
            if (isRetired) {
                // Grow accounts with investment returns
                balances.rrsp *= (1 + r);
                balances.tfsa *= (1 + r);
                balances.nonReg *= (1 + r);
                balances.other *= (1 + r);

                // Adjust target spending for inflation
                currentTargetSpending *= (1 + inf);

                // Calculate needed withdrawal (after accounting for government benefits)
                const neededFromPortfolio = Math.max(0, currentTargetSpending - govBenefits.totalGovernment);

                // Tax-aware withdrawal strategy
                const withdrawal = this._withdrawTaxOptimal(
                    balances,
                    neededFromPortfolio,
                    province,
                    govBenefits.totalGovernment
                );

                // Update balances
                balances.tfsa -= withdrawal.fromTFSA;
                balances.nonReg -= withdrawal.fromNonReg;
                balances.rrsp -= withdrawal.fromRRSP;
                balances.other -= withdrawal.fromOther;

                // Ensure no negative balances
                balances.tfsa = Math.max(0, balances.tfsa);
                balances.nonReg = Math.max(0, balances.nonReg);
                balances.rrsp = Math.max(0, balances.rrsp);
                balances.other = Math.max(0, balances.other);

                const totalBalance = balances.rrsp + balances.tfsa + balances.nonReg + balances.other;

                projection.push({
                    age,
                    phase: 'retirement',
                    rrsp: Math.round(balances.rrsp),
                    tfsa: Math.round(balances.tfsa),
                    nonReg: Math.round(balances.nonReg),
                    other: Math.round(balances.other),
                    totalBalance: Math.round(totalBalance),
                    withdrawal: withdrawal.total,
                    withdrawalBreakdown: {
                        tfsa: withdrawal.fromTFSA,
                        nonReg: withdrawal.fromNonReg,
                        rrsp: withdrawal.fromRRSP,
                        other: withdrawal.fromOther
                    },
                    taxableIncome: withdrawal.taxableIncome,
                    taxPaid: withdrawal.taxPaid,
                    grossIncome: withdrawal.total + govBenefits.totalGovernment,
                    afterTaxIncome: withdrawal.afterTax + govBenefits.totalGovernment,
                    targetSpending: Math.round(currentTargetSpending),
                    governmentIncome: govBenefits.totalGovernment
                });

                // Stop if money runs out
                if (totalBalance <= 0) break;
            }
        }

        return projection;
    },

    /**
     * Tax-optimal withdrawal strategy
     * Priority: TFSA → Non-Reg → RRSP → Other
     */
    _withdrawTaxOptimal(balances, neededAfterTax, province, otherIncome) {
        let remaining = neededAfterTax;
        let fromTFSA = 0;
        let fromNonReg = 0;
        let fromRRSP = 0;
        let fromOther = 0;
        let taxableIncome = otherIncome; // Start with government income
        let totalWithdrawn = 0;

        // 1. TFSA first (tax-free)
        if (remaining > 0 && balances.tfsa > 0) {
            fromTFSA = Math.min(remaining, balances.tfsa);
            remaining -= fromTFSA;
            totalWithdrawn += fromTFSA;
        }

        // 2. Non-Reg second (capital gains - 50% taxable)
        if (remaining > 0 && balances.nonReg > 0) {
            // Need to account for tax on capital gains
            // Assume 50% of withdrawal is capital gain (rest is return of capital)
            const maxFromNonReg = balances.nonReg;
            
            // Iteratively find amount to withdraw to meet after-tax need
            let withdrawAmount = remaining;
            for (let iter = 0; iter < 10; iter++) {
                const capitalGain = withdrawAmount * 0.5; // Assume 50% is gain
                const capGainsTax = CanadianTax.calculateCapitalGainsTax(
                    capitalGain,
                    taxableIncome,
                    province
                ).capitalGainsTax;
                
                const afterTax = withdrawAmount - capGainsTax;
                
                if (Math.abs(afterTax - remaining) < 100) break; // Close enough
                
                // Adjust withdrawal amount
                withdrawAmount = remaining * (withdrawAmount / afterTax);
            }
            
            fromNonReg = Math.min(withdrawAmount, maxFromNonReg);
            const capitalGain = fromNonReg * 0.5;
            const capGainsTax = CanadianTax.calculateCapitalGainsTax(
                capitalGain,
                taxableIncome,
                province
            );
            
            taxableIncome += capGainsTax.taxableGain;
            remaining -= (fromNonReg - capGainsTax.capitalGainsTax);
            totalWithdrawn += fromNonReg;
        }

        // 3. RRSP third (fully taxable)
        if (remaining > 0 && balances.rrsp > 0) {
            // RRSP withdrawals are fully taxable - need to gross up
            const maxFromRRSP = balances.rrsp;
            
            // Iteratively find gross amount needed
            let withdrawAmount = remaining * 1.4; // Start with estimate
            for (let iter = 0; iter < 10; iter++) {
                const tax = CanadianTax.calculateTax(
                    taxableIncome + withdrawAmount,
                    province
                ).total - CanadianTax.calculateTax(taxableIncome, province).total;
                
                const afterTax = withdrawAmount - tax;
                
                if (Math.abs(afterTax - remaining) < 100) break;
                
                withdrawAmount = remaining * (withdrawAmount / afterTax);
            }
            
            fromRRSP = Math.min(withdrawAmount, maxFromRRSP);
            taxableIncome += fromRRSP;
            const rrspTax = CanadianTax.calculateTax(taxableIncome, province).total -
                           CanadianTax.calculateTax(taxableIncome - fromRRSP, province).total;
            remaining -= (fromRRSP - rrspTax);
            totalWithdrawn += fromRRSP;
        }

        // 4. Other accounts last (treat as taxable like RRSP)
        if (remaining > 0 && balances.other > 0) {
            fromOther = Math.min(remaining * 1.4, balances.other);
            taxableIncome += fromOther;
            totalWithdrawn += fromOther;
        }

        // Calculate total tax paid
        const totalTax = CanadianTax.calculateTax(taxableIncome, province).total -
                        CanadianTax.calculateTax(otherIncome, province).total;

        return {
            total: Math.round(totalWithdrawn),
            fromTFSA: Math.round(fromTFSA),
            fromNonReg: Math.round(fromNonReg),
            fromRRSP: Math.round(fromRRSP),
            fromOther: Math.round(fromOther),
            taxableIncome: Math.round(taxableIncome),
            taxPaid: Math.round(totalTax),
            afterTax: Math.round(totalWithdrawn - totalTax)
        };
    },

    /**
     * Calculate average tax rate during retirement
     */
    _calculateAvgTaxRate(retirementYears) {
        if (retirementYears.length === 0) return 0;
        
        const totalTax = retirementYears.reduce((sum, year) => sum + (year.taxPaid || 0), 0);
        const totalIncome = retirementYears.reduce((sum, year) => sum + (year.grossIncome || 0), 0);
        
        return totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;
    }
};

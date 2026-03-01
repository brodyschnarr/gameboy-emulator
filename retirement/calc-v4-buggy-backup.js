// ═══════════════════════════════════════════
//  Retirement Calculation Engine V4
//  Tax-aware + Family + Healthcare + Debt + Probability
// ═══════════════════════════════════════════

const RetirementCalcV4 = {

    calculate(inputs) {
        const {
            currentAge,
            partnerAge,
            retirementAge,
            lifeExpectancy,
            province,
            region,
            familyStatus,
            
            // Income(s)
            currentIncome,
            income1,
            income2,
            
            // Accounts
            rrsp,
            tfsa,
            nonReg,
            other,
            
            // Contributions
            monthlyContribution,
            contributionSplit,
            
            // Spending
            annualSpending,
            
            // Healthcare
            healthStatus,
            
            // Debt
            currentDebt,
            debtPayoffAge,
            
            // CPP
            cppStartAge,
            
            // Additional income sources
            additionalIncomeSources,
            
            // Assumptions
            returnRate,
            inflationRate
        } = inputs;

        const yearsToRetirement = retirementAge - currentAge;
        const isFamilyMode = familyStatus === 'couple';

        // 1. Calculate government benefits
        const govBenefits = this._calculateGovernmentBenefits({
            income1: isFamilyMode ? income1 : currentIncome,
            income2: isFamilyMode ? income2 : 0,
            retirementAge,
            cppStartAge: cppStartAge || 65,
            isSingle: !isFamilyMode
        });

        // 2. Calculate healthcare costs
        const healthcareCosts = HealthcareEstimator.projectTotal(
            retirementAge,
            lifeExpectancy,
            province,
            healthStatus || 'average'
        );

        // 3. Inflation-adjusted spending
        const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsToRetirement);
        const futureAnnualSpending = annualSpending * inflationMultiplier;
        const futureHealthcare = healthcareCosts.averageAnnual * inflationMultiplier;

        // 4. Total annual need in retirement
        const totalAnnualNeed = futureAnnualSpending + futureHealthcare;

        // 5. Year-by-year projection
        const projection = this._generateProjection({
            startAge: currentAge,
            retirementAge,
            lifeExpectancy,
            accounts: { rrsp, tfsa, nonReg, other },
            annualContribution: monthlyContribution * 12,
            contributionSplit,
            targetSpending: totalAnnualNeed,
            govBenefits,
            additionalIncomeSources: additionalIncomeSources || [],
            currentDebt: currentDebt || 0,
            debtPayoffAge: debtPayoffAge || retirementAge,
            returnRate,
            inflationRate,
            province,
            cppStartAge: cppStartAge || 65
        });

        // 6. Summary stats
        const retirementYear = projection.find(p => p.age === retirementAge);
        const finalYear = projection[projection.length - 1];
        const moneyLastsAge = finalYear?.totalBalance > 0 ? lifeExpectancy : 
                             projection.find(p => p.totalBalance <= 0)?.age || retirementAge;

        const retirementYears = projection.filter(p => p.age >= retirementAge);
        const onTrack = retirementYears.every(p => (p.afterTaxIncome || 0) >= (p.targetSpending || 0));

        // 7. Probability of success (simplified Monte Carlo estimate)
        const probability = this._calculateProbability(projection, retirementAge, lifeExpectancy);

        // 8. Legacy calculation
        const legacy = this._calculateLegacy(projection, lifeExpectancy);

        return {
            onTrack,
            probability,
            govBenefits,
            healthcareCosts,
            yearByYear: projection,
            legacy,
            summary: {
                portfolioAtRetirement: retirementYear?.totalBalance || 0,
                annualIncomeAtRetirement: retirementYear?.afterTaxIncome || 0,
                governmentIncome: govBenefits.total,
                moneyLastsAge,
                yearsInRetirement: moneyLastsAge - retirementAge,
                avgTaxRateInRetirement: this._calculateAvgTaxRate(retirementYears),
                totalHealthcareCost: healthcareCosts.total
            }
        };
    },

    _calculateGovernmentBenefits({ income1, income2, retirementAge, cppStartAge, isSingle }) {
        const yearsContributing = Math.min(retirementAge - 18, 39);

        // Person 1 CPP
        const cpp1Base = CPPCalculator.estimateCPP(income1, yearsContributing);
        const cpp1 = CPPOptimizer.calculateByAge(cpp1Base.total, cppStartAge);

        // Person 2 CPP (if couple)
        let cpp2 = 0;
        if (!isSingle && income2 > 0) {
            const cpp2Base = CPPCalculator.estimateCPP(income2, yearsContributing);
            cpp2 = CPPOptimizer.calculateByAge(cpp2Base.total, cppStartAge);
        }

        const cppTotal = cpp1 + cpp2;

        // OAS (full amount, clawback calculated during projection)
        const oasMax = CPPCalculator.oas.maxAnnual;
        const oasTotal = isSingle ? oasMax : oasMax * 2;

        // GIS (calculated during projection based on actual income)
        // For now, assume 0 - will be calculated dynamically

        return {
            cpp1: Math.round(cpp1),
            cpp2: Math.round(cpp2),
            cppTotal: Math.round(cppTotal),
            oasMax: Math.round(oasTotal),
            total: Math.round(cppTotal + oasTotal),
            breakdown: {
                'CPP': Math.round(cppTotal),
                'OAS': Math.round(oasTotal)
            }
        };
    },

    _generateProjection(params) {
        const {
            startAge,
            retirementAge,
            lifeExpectancy,
            accounts,
            annualContribution,
            contributionSplit,
            targetSpending,
            govBenefits,
            additionalIncomeSources,
            currentDebt,
            debtPayoffAge,
            returnRate,
            inflationRate,
            province,
            cppStartAge
        } = params;

        const projection = [];
        let balances = { ...accounts };
        let debt = currentDebt;
        const r = returnRate / 100;
        const inf = inflationRate / 100;
        let currentTargetSpending = targetSpending;

        for (let age = startAge; age <= lifeExpectancy; age++) {
            const isRetired = age >= retirementAge;
            const isWorking = age < retirementAge;

            // Working phase
            if (isWorking) {
                // Grow accounts
                balances.rrsp *= (1 + r);
                balances.tfsa *= (1 + r);
                balances.nonReg *= (1 + r);
                balances.other *= (1 + r);

                // Add contributions
                balances.rrsp += annualContribution * (contributionSplit.rrsp || 0);
                balances.tfsa += annualContribution * (contributionSplit.tfsa || 0);
                balances.nonReg += annualContribution * (contributionSplit.nonReg || 0);

                // Pay down debt
                if (debt > 0 && age < debtPayoffAge) {
                    const yearsRemaining = debtPayoffAge - age;
                    const annualPayment = debt / yearsRemaining;
                    debt = Math.max(0, debt - annualPayment);
                } else if (age >= debtPayoffAge) {
                    debt = 0;
                }

                projection.push({
                    age,
                    phase: 'accumulation',
                    rrsp: Math.round(balances.rrsp),
                    tfsa: Math.round(balances.tfsa),
                    nonReg: Math.round(balances.nonReg),
                    other: Math.round(balances.other),
                    totalBalance: Math.round(balances.rrsp + balances.tfsa + balances.nonReg + balances.other),
                    debt: Math.round(debt)
                });
            }

            // Retirement phase
            if (isRetired) {
                // Grow accounts
                balances.rrsp *= (1 + r);
                balances.tfsa *= (1 + r);
                balances.nonReg *= (1 + r);
                balances.other *= (1 + r);

                // Inflate spending
                currentTargetSpending *= (1 + inf);

                // Calculate government income (CPP starts at cppStartAge)
                let govIncome = 0;
                if (age >= cppStartAge) {
                    govIncome += govBenefits.cppTotal;
                }
                if (age >= 65) {
                    // OAS starts at 65
                    govIncome += govBenefits.oasMax;
                }

                // Additional income sources
                const additionalIncome = additionalIncomeSources
                    .filter(s => age >= s.startAge && (s.endAge === null || age <= s.endAge))
                    .reduce((sum, s) => sum + s.annualAmount, 0);

                govIncome += additionalIncome;

                // Needed from portfolio
                const neededFromPortfolio = Math.max(0, currentTargetSpending - govIncome);

                // Tax-aware withdrawal
                const withdrawal = this._withdrawTaxOptimal(
                    balances,
                    neededFromPortfolio,
                    province,
                    govIncome
                );

                // Update balances
                balances.tfsa = Math.max(0, balances.tfsa - withdrawal.fromTFSA);
                balances.nonReg = Math.max(0, balances.nonReg - withdrawal.fromNonReg);
                balances.rrsp = Math.max(0, balances.rrsp - withdrawal.fromRRSP);
                balances.other = Math.max(0, balances.other - withdrawal.fromOther);

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
                    governmentIncome: Math.round(govIncome),
                    additionalIncome: Math.round(additionalIncome),
                    taxableIncome: withdrawal.taxableIncome,
                    taxPaid: withdrawal.taxPaid,
                    grossIncome: withdrawal.total + govIncome,
                    afterTaxIncome: withdrawal.afterTax + govIncome,
                    targetSpending: Math.round(currentTargetSpending)
                });

                if (totalBalance <= 0) break;
            }
        }

        return projection;
    },

    _withdrawTaxOptimal(balances, neededAfterTax, province, otherIncome) {
        let remaining = neededAfterTax;
        let fromTFSA = 0;
        let fromNonReg = 0;
        let fromRRSP = 0;
        let fromOther = 0;
        let taxableIncome = otherIncome;
        let totalWithdrawn = 0;

        // 1. TFSA first (tax-free)
        if (remaining > 0 && balances.tfsa > 0) {
            fromTFSA = Math.min(remaining, balances.tfsa);
            remaining -= fromTFSA;
            totalWithdrawn += fromTFSA;
        }

        // 2. Non-Reg (capital gains)
        if (remaining > 0 && balances.nonReg > 0) {
            const capitalGain = Math.min(remaining, balances.nonReg) * 0.5;
            const capGainsTax = CanadianTax.calculateCapitalGainsTax(
                capitalGain,
                taxableIncome,
                province
            ).capitalGainsTax;
            
            fromNonReg = Math.min(remaining + capGainsTax, balances.nonReg);
            taxableIncome += capitalGain;
            remaining -= (fromNonReg - capGainsTax);
            totalWithdrawn += fromNonReg;
        }

        // 3. RRSP (fully taxable)
        if (remaining > 0 && balances.rrsp > 0) {
            let withdrawAmount = remaining * 1.4; // Estimate
            for (let iter = 0; iter < 10; iter++) {
                const tax = CanadianTax.calculateTax(
                    taxableIncome + withdrawAmount,
                    province
                ).total - CanadianTax.calculateTax(taxableIncome, province).total;
                
                const afterTax = withdrawAmount - tax;
                if (Math.abs(afterTax - remaining) < 100) break;
                withdrawAmount = remaining * (withdrawAmount / afterTax);
            }
            
            fromRRSP = Math.min(withdrawAmount, balances.rrsp);
            taxableIncome += fromRRSP;
            totalWithdrawn += fromRRSP;
        }

        // 4. Other
        if (remaining > 0 && balances.other > 0) {
            fromOther = Math.min(remaining * 1.4, balances.other);
            taxableIncome += fromOther;
            totalWithdrawn += fromOther;
        }

        // Total tax
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

    _calculateProbability(projection, retirementAge, lifeExpectancy) {
        // Simplified probability based on success throughout retirement
        const retirementYears = projection.filter(p => p.age >= retirementAge && p.age <= lifeExpectancy);
        if (retirementYears.length === 0) return 0;

        const successYears = retirementYears.filter(p => p.totalBalance > 0 && p.afterTaxIncome >= p.targetSpending).length;
        const probability = (successYears / retirementYears.length) * 100;

        // Adjust for volatility risk (simplified)
        // Real Monte Carlo would run 1000+ scenarios with random returns
        // For now, reduce probability if highly dependent on high returns
        const avgBalanceRatio = retirementYears.reduce((sum, y) => sum + (y.totalBalance / (y.targetSpending * 25)), 0) / retirementYears.length;
        
        let adjustment = 0;
        if (avgBalanceRatio < 1.0) adjustment = -20; // Very tight
        else if (avgBalanceRatio < 1.5) adjustment = -10; // Somewhat tight
        else if (avgBalanceRatio > 3.0) adjustment = 5; // Very comfortable

        return Math.max(0, Math.min(100, Math.round(probability + adjustment)));
    },

    _calculateLegacy(projection, lifeExpectancy) {
        const finalYear = projection.find(p => p.age === lifeExpectancy);
        const remainingBalance = finalYear?.totalBalance || 0;

        let description = '';
        if (remainingBalance > 1000000) {
            description = 'Significant estate to leave for heirs or charity';
        } else if (remainingBalance > 500000) {
            description = 'Substantial legacy remaining';
        } else if (remainingBalance > 100000) {
            description = 'Modest legacy remaining';
        } else if (remainingBalance > 0) {
            description = 'Small legacy remaining';
        } else {
            description = 'No legacy - funds fully depleted';
        }

        return {
            amount: Math.round(remainingBalance),
            description
        };
    },

    _calculateAvgTaxRate(retirementYears) {
        if (retirementYears.length === 0) return 0;
        
        const totalTax = retirementYears.reduce((sum, y) => sum + (y.taxPaid || 0), 0);
        const totalIncome = retirementYears.reduce((sum, y) => sum + (y.grossIncome || 0), 0);
        
        return totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;
    }
};

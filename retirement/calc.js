// ═══════════════════════════════════════════
//  Retirement Calculation Engine V4 - FIXED
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

        // 3. Inflation-adjusted spending at retirement
        const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsToRetirement);
        const futureAnnualSpending = annualSpending * inflationMultiplier;

        // 4. Year-by-year projection
        const projection = this._generateProjection({
            startAge: currentAge,
            retirementAge,
            lifeExpectancy,
            accounts: { rrsp, tfsa, nonReg, other },
            annualContribution: monthlyContribution * 12,
            contributionSplit,
            baseAnnualSpending: futureAnnualSpending,
            healthcareByAge: healthcareCosts.byYear,
            govBenefits,
            additionalIncomeSources: additionalIncomeSources || [],
            currentDebt: currentDebt || 0,
            debtPayoffAge: debtPayoffAge || retirementAge,
            returnRate,
            inflationRate,
            province,
            cppStartAge: cppStartAge || 65
        });

        // 5. Calculate probability of success
        const probability = this._calculateProbability(projection, retirementAge, lifeExpectancy);

        // 6. Summary statistics
        const retirementYears = projection.filter(p => p.phase === 'retirement');
        const totalWithdrawals = retirementYears.reduce((sum, y) => sum + (y.withdrawal || 0), 0);
        const totalTaxes = retirementYears.reduce((sum, y) => sum + (y.taxPaid || 0), 0);
        const avgTaxRate = totalWithdrawals > 0 ? (totalTaxes / totalWithdrawals) * 100 : 0;
        
        const finalYear = projection[projection.length - 1];
        const legacyAmount = finalYear ? finalYear.totalBalance : 0;
        
        // Find when money runs out (balance drops to 0 or below)
        const runsOutYear = projection.find(p => p.totalBalance <= 0);
        const moneyLastsAge = runsOutYear ? runsOutYear.age : lifeExpectancy;
        
        // First retirement year income
        const firstRetirementYear = projection.find(p => p.age === retirementAge);
        const annualIncomeAtRetirement = firstRetirementYear 
            ? (firstRetirementYear.governmentIncome || 0) + (firstRetirementYear.withdrawal || 0)
            : 0;
        
        // Portfolio at retirement
        const portfolioAtRetirement = firstRetirementYear ? firstRetirementYear.totalBalance : 0;
        
        // On track = money lasts until life expectancy
        const onTrack = moneyLastsAge >= lifeExpectancy;
        
        // Legacy description
        let legacyDescription = '';
        if (legacyAmount > 1000000) {
            legacyDescription = 'Significant legacy for heirs';
        } else if (legacyAmount > 500000) {
            legacyDescription = 'Comfortable legacy';
        } else if (legacyAmount > 100000) {
            legacyDescription = 'Modest legacy';
        } else if (legacyAmount > 0) {
            legacyDescription = 'Small legacy';
        } else {
            legacyDescription = 'No legacy remaining';
        }

        return {
            yearByYear: projection,
            summary: {
                portfolioAtRetirement: Math.round(portfolioAtRetirement),
                annualIncomeAtRetirement: Math.round(annualIncomeAtRetirement),
                moneyLastsAge: moneyLastsAge,
                totalWithdrawals: Math.round(totalWithdrawals),
                totalGovernmentIncome: Math.round(retirementYears.reduce((sum, y) => sum + (y.governmentIncome || 0), 0)),
                avgTaxRateInRetirement: avgTaxRate,
                legacyAmount: Math.round(legacyAmount)
            },
            legacy: {
                amount: Math.round(legacyAmount),
                description: legacyDescription
            },
            probability: Math.round(probability),
            onTrack: onTrack,
            govBenefits,
            healthcareCosts: {
                total: healthcareCosts.total,
                averageAnnual: Math.round(healthcareCosts.total / (lifeExpectancy - retirementAge))
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
            baseAnnualSpending,
            healthcareByAge,
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
        let balances = {
            rrsp: accounts.rrsp || 0,
            tfsa: accounts.tfsa || 0,
            nonReg: accounts.nonReg || 0,
            other: accounts.other || 0
        };
        let debt = currentDebt;
        const r = returnRate / 100;
        const inf = inflationRate / 100;

        for (let age = startAge; age <= lifeExpectancy; age++) {
            const isRetired = age >= retirementAge;
            const isWorking = age < retirementAge;

            // ═══════════════════════════════════════
            //  WORKING PHASE
            // ═══════════════════════════════════════
            if (isWorking) {
                // Add contributions FIRST (beginning of year)
                const rrspContrib = annualContribution * (contributionSplit.rrsp || 0);
                const tfsaContrib = annualContribution * (contributionSplit.tfsa || 0);
                const nonRegContrib = annualContribution * (contributionSplit.nonReg || 0);
                
                balances.rrsp += rrspContrib;
                balances.tfsa += tfsaContrib;
                balances.nonReg += nonRegContrib;

                // Then grow accounts (end of year)
                balances.rrsp *= (1 + r);
                balances.tfsa *= (1 + r);
                balances.nonReg *= (1 + r);
                balances.other *= (1 + r);

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
                    debt: Math.round(debt),
                    contribution: Math.round(annualContribution)
                });
            }

            // ═══════════════════════════════════════
            //  RETIREMENT PHASE
            // ═══════════════════════════════════════
            if (isRetired) {
                // 1. Grow accounts FIRST (investment returns for the year)
                balances.rrsp *= (1 + r);
                balances.tfsa *= (1 + r);
                balances.nonReg *= (1 + r);
                balances.other *= (1 + r);

                // 2. Calculate this year's spending (inflation-adjusted)
                const yearsIntoRetirement = age - retirementAge;
                const inflationFactor = Math.pow(1 + inf, yearsIntoRetirement);
                const thisYearSpending = baseAnnualSpending * inflationFactor;
                
                // 3. Add healthcare costs
                const healthcareCost = healthcareByAge.find(h => h.age === age)?.cost || 0;
                const totalNeed = thisYearSpending + healthcareCost;

                // 4. Calculate government income
                let govIncome = 0;
                if (age >= cppStartAge) {
                    govIncome += govBenefits.cppTotal;
                }
                if (age >= 65) {
                    // OAS starts at 65 (clawback TODO)
                    govIncome += govBenefits.oasMax;
                }

                // 5. Additional income sources
                const additionalIncome = additionalIncomeSources
                    .filter(s => age >= s.startAge && (s.endAge === null || age <= s.endAge))
                    .reduce((sum, s) => sum + s.annualAmount, 0);

                const totalOtherIncome = govIncome + additionalIncome;

                // 6. How much do we need from portfolio (after-tax)?
                const neededFromPortfolio = Math.max(0, totalNeed - totalOtherIncome);

                // 7. Tax-aware withdrawal
                const withdrawal = this._withdrawTaxOptimal(
                    balances,
                    neededFromPortfolio,
                    province,
                    totalOtherIncome
                );

                // 8. Update balances
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
                    grossIncome: withdrawal.total + totalOtherIncome,
                    afterTaxIncome: withdrawal.afterTax + totalOtherIncome,
                    targetSpending: Math.round(totalNeed),
                    healthcareCost: Math.round(healthcareCost)
                });

                // Stop if portfolio is depleted
                if (totalBalance <= 0) break;
            }
        }

        return projection;
    },

    _withdrawTaxOptimal(balances, neededAfterTax, province, otherIncome) {
        // This function figures out HOW MUCH to withdraw (gross) from each account
        // to get neededAfterTax dollars after paying taxes
        
        let stillNeed = neededAfterTax;
        let fromTFSA = 0;
        let fromNonReg = 0;
        let fromRRSP = 0;
        let fromOther = 0;
        let cumulativeTaxableIncome = otherIncome;

        // ═══════════════════════════════════════
        //  STEP 1: TFSA (tax-free)
        // ═══════════════════════════════════════
        if (stillNeed > 0 && balances.tfsa > 0) {
            fromTFSA = Math.min(stillNeed, balances.tfsa);
            stillNeed -= fromTFSA;
            // No tax implications
        }

        // ═══════════════════════════════════════
        //  STEP 2: Non-Registered (capital gains)
        // ═══════════════════════════════════════
        if (stillNeed > 0 && balances.nonReg > 0) {
            // Assume 50% of withdrawal is capital gain (taxable)
            // We need to withdraw enough gross to get stillNeed after tax on the gain
            
            // Binary search for the right amount
            let low = 0;
            let high = Math.min(stillNeed * 2, balances.nonReg);
            let bestAmount = 0;
            
            for (let iter = 0; iter < 20; iter++) {
                const testAmount = (low + high) / 2;
                const capitalGain = testAmount * 0.5; // 50% inclusion rate
                
                const taxOnGain = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + capitalGain,
                    province
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province).total;
                
                const afterTax = testAmount - taxOnGain;
                
                if (Math.abs(afterTax - stillNeed) < 10) {
                    bestAmount = testAmount;
                    break;
                }
                
                if (afterTax < stillNeed) {
                    low = testAmount;
                } else {
                    high = testAmount;
                }
                bestAmount = testAmount;
            }
            
            fromNonReg = Math.min(bestAmount, balances.nonReg);
            const capitalGain = fromNonReg * 0.5;
            cumulativeTaxableIncome += capitalGain;
            
            const taxOnNonReg = CanadianTax.calculateTax(cumulativeTaxableIncome, province).total -
                               CanadianTax.calculateTax(cumulativeTaxableIncome - capitalGain, province).total;
            
            stillNeed -= (fromNonReg - taxOnNonReg);
        }

        // ═══════════════════════════════════════
        //  STEP 3: RRSP (fully taxable)
        // ═══════════════════════════════════════
        if (stillNeed > 0 && balances.rrsp > 0) {
            // Need to withdraw enough gross to get stillNeed after tax
            // Binary search
            let low = stillNeed;
            let high = Math.min(stillNeed * 2.5, balances.rrsp);
            let bestAmount = stillNeed * 1.4;
            
            for (let iter = 0; iter < 20; iter++) {
                const testAmount = (low + high) / 2;
                
                const taxOnRRSP = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + testAmount,
                    province
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province).total;
                
                const afterTax = testAmount - taxOnRRSP;
                
                if (Math.abs(afterTax - stillNeed) < 10) {
                    bestAmount = testAmount;
                    break;
                }
                
                if (afterTax < stillNeed) {
                    low = testAmount;
                } else {
                    high = testAmount;
                }
                bestAmount = testAmount;
            }
            
            fromRRSP = Math.min(bestAmount, balances.rrsp);
            cumulativeTaxableIncome += fromRRSP;
            stillNeed = 0; // Assume we got what we needed (or ran out)
        }

        // ═══════════════════════════════════════
        //  STEP 4: Other (assume fully taxable like RRSP)
        // ═══════════════════════════════════════
        if (stillNeed > 0 && balances.other > 0) {
            fromOther = Math.min(stillNeed * 1.5, balances.other);
            cumulativeTaxableIncome += fromOther;
        }

        // ═══════════════════════════════════════
        //  FINAL TAX CALCULATION
        // ═══════════════════════════════════════
        const totalTax = CanadianTax.calculateTax(cumulativeTaxableIncome, province).total -
                        CanadianTax.calculateTax(otherIncome, province).total;
        
        const totalWithdrawn = fromTFSA + fromNonReg + fromRRSP + fromOther;

        return {
            total: Math.round(totalWithdrawn),
            fromTFSA: Math.round(fromTFSA),
            fromNonReg: Math.round(fromNonReg),
            fromRRSP: Math.round(fromRRSP),
            fromOther: Math.round(fromOther),
            taxableIncome: Math.round(cumulativeTaxableIncome),
            taxPaid: Math.round(totalTax),
            afterTax: Math.round(totalWithdrawn - totalTax)
        };
    },

    _calculateProbability(projection, retirementAge, lifeExpectancy) {
        const retirementYears = projection.filter(p => p.age >= retirementAge && p.age <= lifeExpectancy);
        if (retirementYears.length === 0) return 0;

        // Count years where portfolio lasted AND spending needs were met
        const successYears = retirementYears.filter(p => 
            p.totalBalance > 0 && 
            p.afterTaxIncome >= p.targetSpending * 0.95 // Allow 5% shortfall
        ).length;
        
        const baseProb = (successYears / retirementYears.length) * 100;

        // Adjust for portfolio health (4% rule: need 25x spending)
        const avgYear = retirementYears[Math.floor(retirementYears.length / 2)];
        if (avgYear && avgYear.targetSpending > 0) {
            const portfolioMultiple = avgYear.totalBalance / avgYear.targetSpending;
            if (portfolioMultiple < 15) {
                return Math.max(0, baseProb - 20); // Risky
            } else if (portfolioMultiple > 30) {
                return Math.min(100, baseProb + 10); // Very safe
            }
        }

        return Math.max(0, Math.min(100, baseProb));
    }
};

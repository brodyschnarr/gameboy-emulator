// ═══════════════════════════════════════════
//  Retirement Calculation Engine V4.1
//  Tax-aware + OAS clawback + Smart withdrawal + CPP inflation indexing
//  + Contribution growth + Split normalization + Partner age
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
            cppStartAgeP2,
            
            // OAS
            oasStartAge = 65,
            
            // Additional income sources
            additionalIncomeSources,
            
            // Windfalls
            windfalls = [],
            
            // Assumptions
            returnRate,
            inflationRate,
            
            // New: contribution growth
            contributionGrowthRate = 0
        } = inputs;

        const yearsToRetirement = retirementAge - currentAge;
        const isFamilyMode = familyStatus === 'couple';

        // FIX #8: Normalize contribution split to sum to 1.0
        const normalizedSplit = this._normalizeSplit(contributionSplit);

        // FIX #1: Use partner age for person 2's CPP contribution years
        const p1ContribYears = Math.min(retirementAge - 18, 39);
        const p2ContribYears = isFamilyMode && partnerAge
            ? Math.min(retirementAge - (18 + (currentAge - partnerAge)), 39)
            : p1ContribYears;

        // 1. Calculate government benefits (base amounts at age 65)
        const govBenefits = this._calculateGovernmentBenefits({
            income1: isFamilyMode ? income1 : currentIncome,
            income2: isFamilyMode ? income2 : 0,
            retirementAge,
            cppStartAge: cppStartAge || 65,
            cppStartAgeP2: cppStartAgeP2 || cppStartAge || 65,
            isSingle: !isFamilyMode,
            p1ContribYears,
            p2ContribYears,
            oasStartAge: oasStartAge || 65
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
            contributionSplit: normalizedSplit,
            contributionGrowthRate: (contributionGrowthRate || 0) / 100,
            baseAnnualSpending: futureAnnualSpending,
            healthcareByAge: healthcareCosts.byYear,
            govBenefits,
            additionalIncomeSources: additionalIncomeSources || [],
            currentDebt: currentDebt || 0,
            debtPayoffAge: debtPayoffAge || retirementAge,
            returnRate,
            inflationRate,
            province,
            cppStartAge: cppStartAge || 65,
            cppStartAgeP2: cppStartAgeP2 || cppStartAge || 65,
            oasStartAge: oasStartAge || 65,
            isSingle: !isFamilyMode,
            windfalls: windfalls || [],
            currentAge
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
        
        const runsOutYear = projection.find(p => p.totalBalance <= 0);
        const moneyLastsAge = runsOutYear ? runsOutYear.age : lifeExpectancy;
        
        const firstRetirementYear = projection.find(p => p.age === retirementAge);
        const annualIncomeAtRetirement = firstRetirementYear 
            ? (firstRetirementYear.governmentIncome || 0) + (firstRetirementYear.withdrawal || 0)
            : 0;
        
        const portfolioAtRetirement = firstRetirementYear ? firstRetirementYear.totalBalance : 0;
        const onTrack = moneyLastsAge >= lifeExpectancy;
        
        let legacyDescription = '';
        if (legacyAmount > 1000000) legacyDescription = 'Significant legacy for heirs';
        else if (legacyAmount > 500000) legacyDescription = 'Comfortable legacy';
        else if (legacyAmount > 100000) legacyDescription = 'Modest legacy';
        else if (legacyAmount > 0) legacyDescription = 'Small legacy';
        else legacyDescription = 'No legacy remaining';

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
                averageAnnual: Math.round(healthcareCosts.total / Math.max(1, lifeExpectancy - retirementAge))
            }
        };
    },

    // ═══════════════════════════════════════
    // FIX #8: Normalize contribution split
    // ═══════════════════════════════════════
    _normalizeSplit(split) {
        const total = (split.rrsp || 0) + (split.tfsa || 0) + (split.nonReg || 0);
        if (total === 0) return { rrsp: 0, tfsa: 0, nonReg: 0 };
        if (Math.abs(total - 1.0) < 0.001) return split; // Already normalized
        return {
            rrsp: (split.rrsp || 0) / total,
            tfsa: (split.tfsa || 0) / total,
            nonReg: (split.nonReg || 0) / total
        };
    },

    _calculateGovernmentBenefits({ income1, income2, retirementAge, cppStartAge, cppStartAgeP2, isSingle, p1ContribYears, p2ContribYears, oasStartAge }) {
        // FIX #1: Use per-person contribution years
        const years1 = p1ContribYears || Math.min(retirementAge - 18, 39);
        const years2 = p2ContribYears || years1;

        // Person 1 CPP
        const cpp1Base = CPPCalculator.estimateCPP(income1, years1);
        const cpp1 = CPPOptimizer.calculateByAge(cpp1Base.total, cppStartAge);

        // Person 2 CPP (if couple)
        let cpp2 = 0;
        if (!isSingle && income2 > 0) {
            const cpp2Base = CPPCalculator.estimateCPP(income2, years2);
            cpp2 = CPPOptimizer.calculateByAge(cpp2Base.total, cppStartAgeP2 || cppStartAge);
        }

        const cppTotal = cpp1 + cpp2;

        // FIX #3: OAS with deferral bonus (0.6%/month after 65, max 36% at 70)
        const oasBase = CPPCalculator.oas.maxAnnual;
        let oasDeferralBonus = 1.0;
        if (oasStartAge > 65) {
            const monthsDeferred = Math.min((oasStartAge - 65) * 12, 60);
            oasDeferralBonus = 1 + (monthsDeferred * 0.006);
        }
        const oasPerPerson = Math.round(oasBase * oasDeferralBonus);
        const oasTotal = isSingle ? oasPerPerson : oasPerPerson * 2;

        return {
            cpp1: Math.round(cpp1),
            cpp2: Math.round(cpp2),
            cppTotal: Math.round(cppTotal),
            oasPerPerson,
            oasTotal,
            oasMax: oasTotal, // backward compat with v5-enhanced
            oasStartAge: oasStartAge || 65,
            oasDeferralBonus,
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
            contributionGrowthRate,
            baseAnnualSpending,
            healthcareByAge,
            govBenefits,
            additionalIncomeSources,
            currentDebt,
            debtPayoffAge,
            returnRate,
            inflationRate,
            province,
            cppStartAge,
            cppStartAgeP2,
            oasStartAge,
            isSingle,
            windfalls = [],
            currentAge = startAge
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

            // Process windfalls for this year
            if (windfalls && windfalls.length > 0) {
                windfalls.forEach(w => {
                    const targetAge = w.year > 150 ? (w.year - (new Date().getFullYear() - currentAge)) : (w.year || (currentAge + (w.yearsFromNow || 0)));
                    if (targetAge === age && (w.probability === undefined || w.probability >= 100)) {
                        const amount = w.taxable ? w.amount * 0.7 : w.amount;
                        if (w.destination === 'rrsp') balances.rrsp += amount;
                        else if (w.destination === 'tfsa') balances.tfsa += amount;
                        else if (w.destination === 'nonReg') balances.nonReg += amount;
                        else {
                            // Default: split between TFSA and non-reg
                            balances.tfsa += amount * 0.5;
                            balances.nonReg += amount * 0.5;
                        }
                    }
                });
            }

            // ═══════════════════════════════════════
            //  WORKING PHASE
            // ═══════════════════════════════════════
            if (isWorking) {
                // FIX #6: Grow contributions over time
                const yearsFromStart = age - startAge;
                const growthFactor = Math.pow(1 + contributionGrowthRate, yearsFromStart);
                const thisYearContribution = annualContribution * growthFactor;

                const rrspContrib = thisYearContribution * (contributionSplit.rrsp || 0);
                const tfsaContrib = thisYearContribution * (contributionSplit.tfsa || 0);
                const nonRegContrib = thisYearContribution * (contributionSplit.nonReg || 0);
                
                balances.rrsp += rrspContrib;
                balances.tfsa += tfsaContrib;
                balances.nonReg += nonRegContrib;

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
                    contribution: Math.round(thisYearContribution)
                });
            }

            // ═══════════════════════════════════════
            //  RETIREMENT PHASE
            // ═══════════════════════════════════════
            if (isRetired) {
                // 1. Grow accounts
                balances.rrsp *= (1 + r);
                balances.tfsa *= (1 + r);
                balances.nonReg *= (1 + r);
                balances.other *= (1 + r);

                // 2. Inflation-adjusted spending
                const yearsIntoRetirement = age - retirementAge;
                const inflationFactor = Math.pow(1 + inf, yearsIntoRetirement);
                const thisYearSpending = baseAnnualSpending * inflationFactor;
                
                // 3. Healthcare costs
                const healthcareCost = healthcareByAge.find(h => h.age === age)?.cost || 0;
                const totalNeed = thisYearSpending + healthcareCost;

                // FIX #2: CPP inflation-indexed from retirement start
                // CPP and OAS are indexed to CPI in Canada
                const cpiFromRetirement = Math.pow(1 + inf, yearsIntoRetirement);
                
                // 4. Government income (inflation-indexed)
                let cppIncome = 0;
                if (age >= cppStartAge) {
                    cppIncome += govBenefits.cpp1 * cpiFromRetirement;
                }
                if (!isSingle && age >= (cppStartAgeP2 || cppStartAge)) {
                    cppIncome += govBenefits.cpp2 * cpiFromRetirement;
                }
                
                // FIX #3 & #4: OAS with deferral and clawback
                let oasIncome = 0;
                const effectiveOASAge = oasStartAge || 65;
                if (age >= effectiveOASAge) {
                    // Base OAS (already includes deferral bonus from govBenefits)
                    oasIncome = govBenefits.oasPerPerson * (isSingle ? 1 : 2) * cpiFromRetirement;
                }

                // 5. Additional income sources
                const additionalIncome = additionalIncomeSources
                    .filter(s => age >= s.startAge && (s.endAge === null || age <= s.endAge))
                    .reduce((sum, s) => sum + s.annualAmount, 0);

                // Total non-portfolio income BEFORE clawback
                const totalOtherIncomePreClawback = cppIncome + oasIncome + additionalIncome;

                // FIX #9: Smart withdrawal — OAS-clawback-aware
                // We pass OAS amount so withdrawal can optimize around clawback threshold
                const neededFromPortfolio = Math.max(0, totalNeed - totalOtherIncomePreClawback);

                const withdrawal = this._withdrawSmartOptimal(
                    balances,
                    neededFromPortfolio,
                    province,
                    cppIncome + additionalIncome, // non-OAS taxable income
                    oasIncome,                    // OAS amount (may be clawed back)
                    age >= effectiveOASAge         // is OAS active?
                );

                // Update balances
                balances.tfsa = Math.max(0, balances.tfsa - withdrawal.fromTFSA);
                balances.nonReg = Math.max(0, balances.nonReg - withdrawal.fromNonReg);
                balances.rrsp = Math.max(0, balances.rrsp - withdrawal.fromRRSP);
                balances.other = Math.max(0, balances.other - withdrawal.fromOther);

                const totalBalance = balances.rrsp + balances.tfsa + balances.nonReg + balances.other;

                // Actual OAS after clawback (based on actual taxable income)
                const actualOAS = withdrawal.actualOAS !== undefined ? withdrawal.actualOAS : oasIncome;
                const govIncome = cppIncome + actualOAS;

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
                    oasReceived: Math.round(actualOAS),
                    cppReceived: Math.round(cppIncome),
                    taxableIncome: withdrawal.taxableIncome,
                    taxPaid: withdrawal.taxPaid,
                    grossIncome: withdrawal.total + govIncome + additionalIncome,
                    afterTaxIncome: withdrawal.afterTax + govIncome + additionalIncome,
                    targetSpending: Math.round(totalNeed),
                    healthcareCost: Math.round(healthcareCost)
                });

                if (totalBalance <= 0) break;
            }
        }

        return projection;
    },

    // ═══════════════════════════════════════
    // FIX #9: Smart OAS-clawback-aware withdrawal
    // 
    // WHEN OAS IS NOT ACTIVE (pre-65):
    //   TFSA (free) → Non-Reg (50% inclusion) → RRSP (100% taxable) → Other
    //   Minimize taxes, no clawback to worry about.
    //
    // WHEN OAS IS ACTIVE (65+):
    //   RRSP up to clawback threshold → Non-Reg (cheaper than RRSP) → TFSA → overflow RRSP → Other
    //   Fill cheap taxable room first, preserve TFSA, avoid clawback.
    // ═══════════════════════════════════════
    _withdrawSmartOptimal(balances, neededAfterTax, province, nonOASTaxableIncome, oasAmount, oasActive) {
        const OAS_CLAWBACK_START = 90997;
        const OAS_CLAWBACK_RATE = 0.15;

        let stillNeed = neededAfterTax;
        let fromTFSA = 0;
        let fromNonReg = 0;
        let fromRRSP = 0;
        let fromOther = 0;
        let cumulativeTaxableIncome = nonOASTaxableIncome;
        const oasForTax = oasActive ? oasAmount : 0;

        if (!oasActive) {
            // ═══════════════════════════════════════
            // PRE-OAS: Pure tax minimization
            // TFSA → Non-Reg → RRSP → Other
            // ═══════════════════════════════════════

            // 1. TFSA (tax-free)
            if (stillNeed > 0 && balances.tfsa > 0) {
                fromTFSA = Math.min(stillNeed, balances.tfsa);
                stillNeed -= fromTFSA;
            }

            // 2. Non-Reg (50% capital gains inclusion — cheaper than RRSP)
            if (stillNeed > 0 && balances.nonReg > 0) {
                fromNonReg = this._withdrawNonReg(stillNeed, cumulativeTaxableIncome, province, balances.nonReg);
                const capitalGain = fromNonReg * 0.5;
                const taxOnNonReg = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + capitalGain, province
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province).total;
                cumulativeTaxableIncome += capitalGain;
                stillNeed -= (fromNonReg - taxOnNonReg);
            }

            // 3. RRSP (fully taxable)
            if (stillNeed > 0 && balances.rrsp > 0) {
                fromRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome, province, balances.rrsp);
                cumulativeTaxableIncome += fromRRSP;
                stillNeed = 0;
            }

            // 4. Other (last resort, fully taxable)
            if (stillNeed > 0 && balances.other > 0) {
                fromOther = Math.min(stillNeed * 1.5, balances.other);
                cumulativeTaxableIncome += fromOther;
            }
        } else {
            // ═══════════════════════════════════════
            // OAS-ACTIVE: Clawback-aware strategy
            // RRSP (up to threshold) → Non-Reg → TFSA → overflow RRSP → Other
            // ═══════════════════════════════════════

            // Budget: how much taxable room before clawback?
            const rrspRoomBeforeClawback = Math.max(0,
                OAS_CLAWBACK_START - nonOASTaxableIncome - oasAmount
            );

            // 1. RRSP up to clawback threshold
            if (stillNeed > 0 && balances.rrsp > 0 && rrspRoomBeforeClawback > 0) {
                const maxRRSPGross = Math.min(rrspRoomBeforeClawback, balances.rrsp);
                const taxIfMaxRRSP = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + maxRRSPGross + oasForTax, province
                ).total - CanadianTax.calculateTax(
                    cumulativeTaxableIncome + oasForTax, province
                ).total;
                const maxAfterTax = maxRRSPGross - taxIfMaxRRSP;

                if (maxAfterTax >= stillNeed) {
                    fromRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome + oasForTax, province, balances.rrsp);
                    cumulativeTaxableIncome += fromRRSP;
                    stillNeed = 0;
                } else {
                    fromRRSP = maxRRSPGross;
                    cumulativeTaxableIncome += fromRRSP;
                    stillNeed -= maxAfterTax;
                }
            }

            // 2. Non-Reg (50% inclusion — cheaper than more RRSP, and cheaper than burning TFSA)
            if (stillNeed > 0 && balances.nonReg > 0) {
                fromNonReg = this._withdrawNonReg(stillNeed, cumulativeTaxableIncome + oasForTax, province, balances.nonReg);
                const capitalGain = fromNonReg * 0.5;
                const taxOnNonReg = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + capitalGain + oasForTax, province
                ).total - CanadianTax.calculateTax(
                    cumulativeTaxableIncome + oasForTax, province
                ).total;
                cumulativeTaxableIncome += capitalGain;
                stillNeed -= (fromNonReg - taxOnNonReg);
            }

            // 3. TFSA (tax-free, preserved as long as possible)
            if (stillNeed > 0 && balances.tfsa > 0) {
                fromTFSA = Math.min(stillNeed, balances.tfsa);
                stillNeed -= fromTFSA;
            }

            // 4. More RRSP if still needed (triggers clawback, unavoidable)
            if (stillNeed > 0 && balances.rrsp > fromRRSP) {
                const remainingRRSP = balances.rrsp - fromRRSP;
                const additionalRRSP = this._binarySearchGross(
                    stillNeed, cumulativeTaxableIncome + oasForTax, province, remainingRRSP
                );
                fromRRSP += additionalRRSP;
                cumulativeTaxableIncome += additionalRRSP;
                stillNeed = 0;
            }

            // 5. Other (last resort)
            if (stillNeed > 0 && balances.other > 0) {
                fromOther = Math.min(stillNeed * 1.5, balances.other);
                cumulativeTaxableIncome += fromOther;
            }
        }

        // Calculate actual OAS after clawback
        let actualOAS = oasAmount;
        if (oasActive && oasAmount > 0) {
            const totalTaxableIncome = cumulativeTaxableIncome + oasAmount;
            if (totalTaxableIncome > OAS_CLAWBACK_START) {
                const excessIncome = totalTaxableIncome - OAS_CLAWBACK_START;
                const clawback = excessIncome * OAS_CLAWBACK_RATE;
                actualOAS = Math.max(0, oasAmount - clawback);
            }
        }

        // Final tax
        const totalTaxableForCalc = cumulativeTaxableIncome + (oasActive ? actualOAS : 0);
        const totalTax = CanadianTax.calculateTax(totalTaxableForCalc, province).total -
                        CanadianTax.calculateTax(nonOASTaxableIncome, province).total;
        
        const totalWithdrawn = fromTFSA + fromNonReg + fromRRSP + fromOther;

        return {
            total: Math.round(totalWithdrawn),
            fromTFSA: Math.round(fromTFSA),
            fromNonReg: Math.round(fromNonReg),
            fromRRSP: Math.round(fromRRSP),
            fromOther: Math.round(fromOther),
            taxableIncome: Math.round(totalTaxableForCalc),
            taxPaid: Math.round(totalTax),
            afterTax: Math.round(totalWithdrawn - totalTax),
            actualOAS: Math.round(actualOAS)
        };
    },

    // Helper: Binary search Non-Reg withdrawal for target after-tax amount
    _withdrawNonReg(targetAfterTax, existingTaxable, province, maxAvailable) {
        let low = 0;
        let high = Math.min(targetAfterTax * 2, maxAvailable);
        let best = 0;
        
        for (let iter = 0; iter < 20; iter++) {
            const testAmount = (low + high) / 2;
            const capitalGain = testAmount * 0.5;
            const taxOnGain = CanadianTax.calculateTax(
                existingTaxable + capitalGain, province
            ).total - CanadianTax.calculateTax(existingTaxable, province).total;
            const afterTax = testAmount - taxOnGain;
            
            if (Math.abs(afterTax - targetAfterTax) < 10) { best = testAmount; break; }
            if (afterTax < targetAfterTax) low = testAmount;
            else high = testAmount;
            best = testAmount;
        }
        
        return Math.min(best, maxAvailable);
    },

    // Binary search for gross RRSP amount that yields targetAfterTax
    _binarySearchGross(targetAfterTax, existingTaxable, province, maxAvailable) {
        let low = targetAfterTax;
        let high = Math.min(targetAfterTax * 2.5, maxAvailable);
        let best = targetAfterTax * 1.4;
        
        for (let iter = 0; iter < 20; iter++) {
            const testAmount = (low + high) / 2;
            const taxOnAmount = CanadianTax.calculateTax(
                existingTaxable + testAmount, province
            ).total - CanadianTax.calculateTax(existingTaxable, province).total;
            
            const afterTax = testAmount - taxOnAmount;
            
            if (Math.abs(afterTax - targetAfterTax) < 10) {
                best = testAmount;
                break;
            }
            if (afterTax < targetAfterTax) low = testAmount;
            else high = testAmount;
            best = testAmount;
        }
        
        return Math.min(best, maxAvailable);
    },

    _calculateProbability(projection, retirementAge, lifeExpectancy) {
        const retirementYears = projection.filter(p => p.age >= retirementAge && p.age <= lifeExpectancy);
        if (retirementYears.length === 0) return 0;

        const successYears = retirementYears.filter(p => 
            p.totalBalance > 0 && 
            p.afterTaxIncome >= p.targetSpending * 0.95
        ).length;
        
        const baseProb = (successYears / retirementYears.length) * 100;

        const avgYear = retirementYears[Math.floor(retirementYears.length / 2)];
        if (avgYear && avgYear.targetSpending > 0) {
            const portfolioMultiple = avgYear.totalBalance / avgYear.targetSpending;
            if (portfolioMultiple < 15) return Math.max(0, baseProb - 20);
            else if (portfolioMultiple > 30) return Math.min(100, baseProb + 10);
        }

        return Math.max(0, Math.min(100, baseProb));
    }
};

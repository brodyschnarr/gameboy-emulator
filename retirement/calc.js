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
            cash = 0,
            
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
            cppOverride,
            cppOverrideP2,
            
            // OAS
            oasStartAge = 65,
            oasStartAgeP2,
            
            // Additional income sources
            additionalIncomeSources,
            
            // Windfalls
            windfalls = [],
            
            // Assumptions
            returnRate,
            inflationRate,
            
            // New: contribution growth
            contributionGrowthRate = 0,
            
            // MER / fees
            merFee = 0
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
            oasStartAge: oasStartAge || 65,
            oasStartAgeP2: oasStartAgeP2 || oasStartAge || 65,
            cppOverride: cppOverride || null,
            cppOverrideP2: cppOverrideP2 || null
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
            accounts: { rrsp, tfsa, nonReg, other, cash },
            annualContribution: monthlyContribution * 12,
            contributionSplit: normalizedSplit,
            contributionGrowthRate: (contributionGrowthRate || 0) / 100,
            baseAnnualSpending: futureAnnualSpending,
            healthcareByAge: healthcareCosts.byYear,
            govBenefits,
            additionalIncomeSources: additionalIncomeSources || [],
            currentDebt: currentDebt || 0,
            debtPayoffAge: debtPayoffAge || retirementAge,
            returnRate: returnRate - (merFee || 0), // Net of fees
            inflationRate,
            province,
            cppStartAge: cppStartAge || 65,
            cppStartAgeP2: cppStartAgeP2 || cppStartAge || 65,
            oasStartAge: oasStartAge || 65,
            oasStartAgeP2: oasStartAgeP2 || oasStartAge || 65,
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

    _calculateGovernmentBenefits({ income1, income2, retirementAge, cppStartAge, cppStartAgeP2, isSingle, p1ContribYears, p2ContribYears, oasStartAge, oasStartAgeP2, cppOverride, cppOverrideP2 }) {
        // FIX #1: Use per-person contribution years
        const years1 = p1ContribYears || Math.min(retirementAge - 18, 39);
        const years2 = p2ContribYears || years1;

        // Person 1 CPP — use override if provided (annual amount at age 65)
        let cpp1;
        if (cppOverride) {
            cpp1 = CPPOptimizer.calculateByAge(cppOverride, cppStartAge);
        } else {
            const cpp1Base = CPPCalculator.estimateCPP(income1, years1);
            cpp1 = CPPOptimizer.calculateByAge(cpp1Base.total, cppStartAge);
        }

        // Person 2 CPP (if couple)
        let cpp2 = 0;
        if (!isSingle && (income2 > 0 || cppOverrideP2)) {
            if (cppOverrideP2) {
                cpp2 = CPPOptimizer.calculateByAge(cppOverrideP2, cppStartAgeP2 || cppStartAge);
            } else {
                const cpp2Base = CPPCalculator.estimateCPP(income2, years2);
                cpp2 = CPPOptimizer.calculateByAge(cpp2Base.total, cppStartAgeP2 || cppStartAge);
            }
        }

        const cppTotal = cpp1 + cpp2;

        // FIX #3: OAS with deferral bonus (0.6%/month after 65, max 36% at 70)
        const oasBase = CPPCalculator.oas.maxAnnual;
        const effOAS1 = oasStartAge || 65;
        const effOAS2 = oasStartAgeP2 || effOAS1;
        
        const calcOASBonus = (startAge) => {
            if (startAge > 65) {
                const months = Math.min((startAge - 65) * 12, 60);
                return 1 + (months * 0.006);
            }
            return 1.0;
        };
        
        const oasDeferralBonus = calcOASBonus(effOAS1);
        const oasDeferralBonus2 = calcOASBonus(effOAS2);
        const oasPerPerson1 = Math.round(oasBase * oasDeferralBonus);
        const oasPerPerson2 = Math.round(oasBase * oasDeferralBonus2);
        const oasPerPerson = oasPerPerson1; // backward compat
        const oasTotal = isSingle ? oasPerPerson1 : oasPerPerson1 + oasPerPerson2;

        return {
            cpp1: Math.round(cpp1),
            cpp2: Math.round(cpp2),
            cppTotal: Math.round(cppTotal),
            oasPerPerson,
            oasPerPerson1,
            oasPerPerson2,
            oasTotal,
            oasMax: oasTotal,
            oasStartAge: effOAS1,
            oasStartAgeP2: effOAS2,
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
            other: accounts.other || 0,
            cash: accounts.cash || 0
        };
        const CASH_RATE = 0.015; // 1.5% for HISA/GICs
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
                balances.cash *= (1 + CASH_RATE);

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
                    cash: Math.round(balances.cash),
                    totalBalance: Math.round(balances.rrsp + balances.tfsa + balances.nonReg + balances.other + balances.cash),
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
                balances.cash *= (1 + CASH_RATE);

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
                
                // 4. Government income (inflation-indexed, tracked per-person for clawback)
                let cppP1 = 0, cppP2 = 0;
                if (age >= cppStartAge) {
                    cppP1 = govBenefits.cpp1 * cpiFromRetirement;
                }
                if (!isSingle && age >= (cppStartAgeP2 || cppStartAge)) {
                    cppP2 = govBenefits.cpp2 * cpiFromRetirement;
                }
                const cppIncome = cppP1 + cppP2;
                
                // FIX #3 & #4: OAS with deferral and clawback (per-person ages)
                const effOAS1 = govBenefits.oasStartAge || 65;
                const effOAS2 = govBenefits.oasStartAgeP2 || effOAS1;
                let oasP1 = 0, oasP2 = 0;
                if (age >= effOAS1) {
                    oasP1 = (govBenefits.oasPerPerson1 || govBenefits.oasPerPerson) * cpiFromRetirement;
                }
                if (!isSingle && age >= effOAS2) {
                    oasP2 = (govBenefits.oasPerPerson2 || govBenefits.oasPerPerson) * cpiFromRetirement;
                }
                const oasIncome = oasP1 + oasP2;

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
                    oasIncome,                    // OAS amount (combined, for withdrawal budget)
                    age >= effOAS1,               // is OAS active?
                    { cppP1, cppP2, oasP1, oasP2, additionalIncome, isSingle } // per-person for clawback
                );

                // Update balances
                balances.tfsa = Math.max(0, balances.tfsa - withdrawal.fromTFSA);
                balances.nonReg = Math.max(0, balances.nonReg - withdrawal.fromNonReg);
                balances.rrsp = Math.max(0, balances.rrsp - withdrawal.fromRRSP);
                balances.other = Math.max(0, balances.other - withdrawal.fromOther);
                balances.cash = Math.max(0, balances.cash - (withdrawal.fromCash || 0));

                const totalBalance = balances.rrsp + balances.tfsa + balances.nonReg + balances.other + balances.cash;

                // Actual OAS after clawback (based on actual taxable income)
                const actualOAS = withdrawal.actualOAS !== undefined ? withdrawal.actualOAS : oasIncome;
                
                // GIS (Guaranteed Income Supplement) — automatic for low-income OAS recipients
                // Max ~$12,780/yr (single) or ~$7,692/yr each (couple), claws back at 50% of income
                let gisIncome = 0;
                if (age >= effOAS1) {
                    const GIS_MAX_SINGLE = 12780;
                    const GIS_MAX_COUPLE = 7692; // per person
                    const GIS_CLAWBACK_RATE = 0.50;
                    const gisMax = isSingle ? GIS_MAX_SINGLE : GIS_MAX_COUPLE * 2;
                    // GIS income test excludes OAS but includes CPP, RRSP withdrawals, etc.
                    const gisTestIncome = cppIncome + (withdrawal.fromRRSP || 0) + (withdrawal.fromOther || 0) + additionalIncome
                        + ((withdrawal.fromNonReg || 0) * 0.5); // NonReg at 50% inclusion
                    const gisClawback = gisTestIncome * GIS_CLAWBACK_RATE;
                    gisIncome = Math.max(0, gisMax - gisClawback) * cpiFromRetirement;
                }
                
                const govIncome = cppIncome + actualOAS + gisIncome;

                projection.push({
                    age,
                    phase: 'retirement',
                    rrsp: Math.round(balances.rrsp),
                    tfsa: Math.round(balances.tfsa),
                    nonReg: Math.round(balances.nonReg),
                    other: Math.round(balances.other),
                    cash: Math.round(balances.cash),
                    totalBalance: Math.round(totalBalance),
                    withdrawal: withdrawal.total,
                    withdrawalBreakdown: {
                        tfsa: withdrawal.fromTFSA,
                        nonReg: withdrawal.fromNonReg,
                        rrsp: withdrawal.fromRRSP,
                        cash: withdrawal.fromCash || 0,
                        other: withdrawal.fromOther
                    },
                    governmentIncome: Math.round(govIncome),
                    additionalIncome: Math.round(additionalIncome),
                    oasReceived: Math.round(actualOAS),
                    gisReceived: Math.round(gisIncome),
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
    _withdrawSmartOptimal(balances, neededAfterTax, province, nonOASTaxableIncome, oasAmount, oasActive, perPerson) {
        const OAS_CLAWBACK_START = 90997;
        const OAS_CLAWBACK_RATE = 0.15;

        let stillNeed = neededAfterTax;
        let fromTFSA = 0;
        let fromNonReg = 0;
        let fromRRSP = 0;
        let fromOther = 0;
        let fromCash = 0;
        let cumulativeTaxableIncome = nonOASTaxableIncome;
        const oasForTax = oasActive ? oasAmount : 0;

        if (!oasActive) {
            // ═══════════════════════════════════════
            // PRE-OAS: RRSP Meltdown Strategy
            // 
            // This is the GOLDEN WINDOW to withdraw RRSP at low tax rates.
            // Once CPP/OAS kick in, those low brackets are consumed.
            // Strategy: RRSP first (fill low brackets) → NonReg → TFSA (preserve tax-free growth)
            //
            // Cap RRSP withdrawal at a sensible bracket ceiling to avoid
            // overpaying tax now. Target: fill up to ~$55K taxable income
            // (covers basic personal amount + first federal bracket in most provinces).
            // If spending need exceeds that, use NonReg then TFSA for the rest.
            // ═══════════════════════════════════════

            // How much low-bracket room is available for RRSP?
            // Use OAS clawback threshold: every dollar below this pre-OAS
            // is cheaper than withdrawing it post-OAS (where CPP+OAS consume
            // low brackets and additional income triggers clawback).
            const MELTDOWN_CEILING = OAS_CLAWBACK_START; // $90,997
            const rrspRoom = Math.max(0, MELTDOWN_CEILING - nonOASTaxableIncome);

            // 1. RRSP up to the meltdown ceiling (fill low brackets)
            if (stillNeed > 0 && balances.rrsp > 0 && rrspRoom > 0) {
                const maxGross = Math.min(rrspRoom, balances.rrsp);
                const taxIfMax = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + maxGross, province
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province).total;
                const maxAfterTax = maxGross - taxIfMax;

                if (maxAfterTax >= stillNeed) {
                    // Can cover everything within the low-bracket cap
                    fromRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome, province, balances.rrsp);
                    cumulativeTaxableIncome += fromRRSP;
                    stillNeed = 0;
                } else {
                    // Use all room, still need more
                    fromRRSP = maxGross;
                    cumulativeTaxableIncome += fromRRSP;
                    stillNeed -= maxAfterTax;
                }
            }

            // 2. Non-Reg (50% capital gains inclusion — cheaper than more RRSP above ceiling)
            if (stillNeed > 0 && balances.nonReg > 0) {
                fromNonReg = this._withdrawNonReg(stillNeed, cumulativeTaxableIncome, province, balances.nonReg);
                const capitalGain = fromNonReg * 0.5;
                const taxOnNonReg = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + capitalGain, province
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province).total;
                cumulativeTaxableIncome += capitalGain;
                stillNeed -= (fromNonReg - taxOnNonReg);
            }

            // 3. More RRSP if still needed (above the ceiling, still better than burning TFSA)
            if (stillNeed > 0 && balances.rrsp > fromRRSP) {
                const remainingRRSP = balances.rrsp - fromRRSP;
                const additionalRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome, province, remainingRRSP);
                fromRRSP += additionalRRSP;
                cumulativeTaxableIncome += additionalRRSP;
                stillNeed = 0;
            }

            // 4. TFSA (last resort — preserve tax-free growth as long as possible)
            if (stillNeed > 0 && balances.tfsa > 0) {
                fromTFSA = Math.min(stillNeed, balances.tfsa);
                stillNeed -= fromTFSA;
            }

            // 5. Cash (accessible savings, minimal growth anyway)
            if (stillNeed > 0 && balances.cash > 0) {
                fromCash = Math.min(stillNeed, balances.cash);
                stillNeed -= fromCash;
            }

            // 6. Other (truly last resort)
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
            // For couples: each person has their own $90,997 threshold, so combined room is ~2x
            // (assuming withdrawals split 50/50)
            const isCouple = perPerson && !perPerson.isSingle;
            let rrspRoomBeforeClawback;
            if (isCouple) {
                // Each person gets their own threshold. Estimate combined room.
                const p1Room = Math.max(0, OAS_CLAWBACK_START - (perPerson.cppP1 + (perPerson.oasP1 || 0) + (perPerson.additionalIncome || 0) / 2));
                const p2Room = Math.max(0, OAS_CLAWBACK_START - (perPerson.cppP2 + (perPerson.oasP2 || 0) + (perPerson.additionalIncome || 0) / 2));
                rrspRoomBeforeClawback = p1Room + p2Room;
            } else {
                rrspRoomBeforeClawback = Math.max(0,
                    OAS_CLAWBACK_START - nonOASTaxableIncome - oasAmount
                );
            }

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

            // 5. Cash (accessible savings)
            if (stillNeed > 0 && balances.cash > 0) {
                fromCash = Math.min(stillNeed, balances.cash);
                stillNeed -= fromCash;
            }

            // 6. Other (last resort)
            if (stillNeed > 0 && balances.other > 0) {
                fromOther = Math.min(stillNeed * 1.5, balances.other);
                cumulativeTaxableIncome += fromOther;
            }
        }

        // Calculate actual OAS after clawback — PER-PERSON (each files individually in Canada)
        let actualOAS = oasAmount;
        let actualOASP1 = perPerson ? perPerson.oasP1 : oasAmount;
        let actualOASP2 = perPerson ? perPerson.oasP2 : 0;
        
        if (oasActive && oasAmount > 0 && perPerson && !perPerson.isSingle) {
            // COUPLES: Each person's OAS clawback is based on their individual net income
            // Assume portfolio withdrawals split 50/50 between spouses
            const portfolioTaxablePerPerson = (cumulativeTaxableIncome - nonOASTaxableIncome) / 2;
            const addlPerPerson = (perPerson.additionalIncome || 0) / 2;
            
            // Person 1 individual income
            const p1Income = perPerson.cppP1 + actualOASP1 + portfolioTaxablePerPerson + addlPerPerson;
            if (p1Income > OAS_CLAWBACK_START) {
                const clawback1 = (p1Income - OAS_CLAWBACK_START) * OAS_CLAWBACK_RATE;
                actualOASP1 = Math.max(0, actualOASP1 - clawback1);
            }
            
            // Person 2 individual income
            const p2Income = perPerson.cppP2 + actualOASP2 + portfolioTaxablePerPerson + addlPerPerson;
            if (p2Income > OAS_CLAWBACK_START) {
                const clawback2 = (p2Income - OAS_CLAWBACK_START) * OAS_CLAWBACK_RATE;
                actualOASP2 = Math.max(0, actualOASP2 - clawback2);
            }
            
            actualOAS = actualOASP1 + actualOASP2;
        } else if (oasActive && oasAmount > 0) {
            // SINGLE: clawback on combined income (same as before)
            const totalTaxableIncome = cumulativeTaxableIncome + oasAmount;
            if (totalTaxableIncome > OAS_CLAWBACK_START) {
                const excessIncome = totalTaxableIncome - OAS_CLAWBACK_START;
                const clawback = excessIncome * OAS_CLAWBACK_RATE;
                actualOAS = Math.max(0, oasAmount - clawback);
                actualOASP1 = actualOAS;
            }
        }

        // Final tax
        const totalTaxableForCalc = cumulativeTaxableIncome + (oasActive ? actualOAS : 0);
        const totalTax = CanadianTax.calculateTax(totalTaxableForCalc, province).total -
                        CanadianTax.calculateTax(nonOASTaxableIncome, province).total;
        
        const totalWithdrawn = fromTFSA + fromNonReg + fromRRSP + fromOther + fromCash;

        return {
            total: Math.round(totalWithdrawn),
            fromTFSA: Math.round(fromTFSA),
            fromNonReg: Math.round(fromNonReg),
            fromRRSP: Math.round(fromRRSP),
            fromOther: Math.round(fromOther),
            fromCash: Math.round(fromCash),
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

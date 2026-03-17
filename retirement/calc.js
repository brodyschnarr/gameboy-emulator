// ═══════════════════════════════════════════
//  Retirement Calculation Engine V4.2
//  Tax-aware + OAS clawback + Smart withdrawal + CPP inflation indexing
//  + RRIF mandatory conversion at 71 + LIRA/LIF support
//  + Tax savings comparison (smart vs naive)
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
            spendingCurve = 'flat',
            
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
            merFee = 0,

            // LIRA (Locked-In Retirement Account)
            lira = 0,
            liraProvince,  // Provincial rules differ for LIF max withdrawals

            // Employer Pension (Defined Benefit)
            employerPension = 0,           // Monthly pension amount at retirement
            employerPensionStartAge,       // Age pension begins (default: retirementAge)
            employerPensionIndexed = true,  // Indexed to inflation?

            // Withdrawal strategy override (for comparison engine)
            _withdrawalStrategy = 'smart'
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
            accounts: { rrsp, tfsa, nonReg, other, cash, lira: lira || 0 },
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
            currentAge,
            spendingCurve: spendingCurve || 'flat',
            _withdrawalStrategy,
            employerPension: employerPension || 0,
            employerPensionStartAge: employerPensionStartAge || retirementAge,
            employerPensionIndexed: employerPensionIndexed !== false,
            isFamilyMode
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
    // ═══════════════════════════════════════
    // RRIF Minimum Withdrawal Rates (CRA)
    // At age 71, RRSP must convert to RRIF with mandatory minimums
    // ═══════════════════════════════════════
    RRIF_MINIMUMS: {
        71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
        76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
        81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
        86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
        91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879, 95: 0.2000
    },

    // LIF Maximum Withdrawal Rates (Ontario/Federal — most provinces similar)
    // LIRA converts to LIF; you can't withdraw more than this percentage per year
    LIF_MAXIMUMS: {
        55: 0.0640, 56: 0.0650, 57: 0.0660, 58: 0.0670, 59: 0.0680,
        60: 0.0690, 61: 0.0710, 62: 0.0720, 63: 0.0740, 64: 0.0760,
        65: 0.0780, 66: 0.0800, 67: 0.0830, 68: 0.0860, 69: 0.0890,
        70: 0.0930, 71: 0.0970, 72: 0.1020, 73: 0.1070, 74: 0.1130,
        75: 0.1190, 76: 0.1270, 77: 0.1350, 78: 0.1450, 79: 0.1570,
        80: 0.1710, 81: 0.1870, 82: 0.2070, 83: 0.2310, 84: 0.2610,
        85: 0.3000, 86: 0.3500, 87: 0.4150, 88: 0.5060, 89: 0.6390,
        90: 0.8510, 91: 1.0000, 92: 1.0000, 93: 1.0000, 94: 1.0000, 95: 1.0000
    },

    _getRRIFMinimum(age, balance) {
        if (age < 71) return 0;
        const rate = this.RRIF_MINIMUMS[Math.min(age, 95)] || 0.2000;
        return balance * rate;
    },

    _getLIFMaximum(age, balance) {
        if (age < 55) return 0;
        const rate = this.LIF_MAXIMUMS[Math.min(age, 95)] || 1.0;
        return balance * rate;
    },

    _getLIFMinimum(age, balance) {
        // LIF minimums are the same as RRIF minimums (after age 71)
        if (age < 71) return 0;
        return this._getRRIFMinimum(age, balance);
    },

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
            currentAge = startAge,
            spendingCurve = 'flat',
            _withdrawalStrategy = 'smart',
            employerPension = 0,
            employerPensionStartAge = retirementAge,
            employerPensionIndexed = true,
            isFamilyMode = false
        } = params;

        const projection = [];
        let balances = {
            rrsp: accounts.rrsp || 0,
            tfsa: accounts.tfsa || 0,
            nonReg: accounts.nonReg || 0,
            other: accounts.other || 0,
            cash: accounts.cash || 0,
            lira: accounts.lira || 0
        };
        let rrspConvertedToRRIF = false; // Track RRIF conversion at 71
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
                balances.lira *= (1 + r);
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
                    lira: Math.round(balances.lira),
                    totalBalance: Math.round(balances.rrsp + balances.tfsa + balances.nonReg + balances.other + balances.cash + balances.lira),
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
                balances.lira *= (1 + r);
                balances.cash *= (1 + CASH_RATE);

                // RRIF mandatory conversion at 71
                if (age >= 71 && !rrspConvertedToRRIF) {
                    rrspConvertedToRRIF = true;
                    // RRSP becomes RRIF — balance stays same, just subject to minimum withdrawals now
                }

                // RRIF mandatory minimum withdrawal (age 71+)
                let rrifMandatory = 0;
                if (age >= 71 && balances.rrsp > 0) {
                    rrifMandatory = RetirementCalcV4._getRRIFMinimum(age, balances.rrsp);
                }

                // LIF mandatory minimum (same as RRIF min, age 71+)
                let lifMandatory = 0;
                if (age >= 71 && balances.lira > 0) {
                    lifMandatory = RetirementCalcV4._getLIFMinimum(age, balances.lira);
                }

                // 2. Inflation-adjusted spending with optional spending curve
                const yearsIntoRetirement = age - retirementAge;
                const inflationFactor = Math.pow(1 + inf, yearsIntoRetirement);
                
                // Spending curve: "Go-Go / Slow-Go / No-Go" pattern
                // spendingCurve: 'flat' (default), 'frontloaded', 'custom'
                let spendingCurveMultiplier = 1.0;
                if (spendingCurve === 'frontloaded') {
                    // Go-Go (first 10 years): +20% spending (travel, activities)
                    // Slow-Go (years 11-20): baseline spending
                    // No-Go (years 21+): -20% spending (less mobility)
                    if (yearsIntoRetirement < 10) {
                        spendingCurveMultiplier = 1.20;
                    } else if (yearsIntoRetirement < 20) {
                        spendingCurveMultiplier = 1.0;
                    } else {
                        spendingCurveMultiplier = 0.80;
                    }
                }
                
                const thisYearSpending = baseAnnualSpending * inflationFactor * spendingCurveMultiplier;
                
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

                // 5. Additional income sources (with inflation indexing for pensions)
                const additionalIncome = additionalIncomeSources
                    .filter(s => age >= s.startAge && (s.endAge === null || age <= s.endAge))
                    .reduce((sum, s) => {
                        const base = s.annualAmount;
                        return sum + (s.indexed ? base * cpiFromRetirement : base);
                    }, 0);

                // Employer pension (standalone field — backwards compatible)
                let pensionIncome = 0;
                if (employerPension > 0 && age >= employerPensionStartAge) {
                    pensionIncome = employerPension * 12;
                    if (employerPensionIndexed) {
                        pensionIncome *= cpiFromRetirement;
                    }
                }
                
                // Check if any additional income is pension-type (for pension credit)
                const hasPensionTypeIncome = additionalIncomeSources.some(s => 
                    s.isPension && age >= s.startAge && (s.endAge === null || age <= s.endAge));

                // GIS estimate — two-pass approach to avoid circular dependency
                // Pass 1: estimate GIS assuming no taxable withdrawals
                // Pass 2: after withdrawal, recalculate GIS and re-withdraw if needed
                let gisEstimate = 0;
                if (age >= effOAS1) {
                    const GIS_MAX_SINGLE = 12780;
                    const GIS_MAX_COUPLE = 7692;
                    const gisMax = isSingle ? GIS_MAX_SINGLE : GIS_MAX_COUPLE * 2;
                    const gisTestPre = cppIncome + additionalIncome + pensionIncome;
                    
                    // If there are taxable accounts, assume withdrawal will reduce/eliminate GIS
                    const hasTaxableAccounts = (balances.rrsp > 0 || balances.nonReg > 0);
                    if (hasTaxableAccounts) {
                        // Conservative: estimate how much taxable withdrawal is needed
                        const roughNeed = Math.max(0, totalNeed - cppIncome - oasIncome - additionalIncome - pensionIncome);
                        const estimatedTaxableWithdrawal = Math.min(roughNeed, balances.rrsp + balances.nonReg);
                        // NonReg at 50% inclusion, RRSP at 100% — rough split
                        const nonRegShare = balances.nonReg > 0 ? Math.min(estimatedTaxableWithdrawal, balances.nonReg) : 0;
                        const rrspShare = estimatedTaxableWithdrawal - nonRegShare;
                        const estimatedGISTestIncome = gisTestPre + rrspShare + nonRegShare * 0.5;
                        gisEstimate = Math.max(0, gisMax - estimatedGISTestIncome * 0.5) * cpiFromRetirement;
                    } else {
                        // Only TFSA/cash — GIS unaffected by withdrawals
                        gisEstimate = Math.max(0, gisMax - gisTestPre * 0.5) * cpiFromRetirement;
                    }
                }

                // Total non-portfolio income BEFORE clawback
                const totalOtherIncomePreClawback = cppIncome + oasIncome + additionalIncome + pensionIncome + gisEstimate;

                // FIX #9: Smart withdrawal — OAS-clawback-aware
                const neededFromPortfolio = Math.max(0, totalNeed - totalOtherIncomePreClawback);

                // RRIF/LIF mandatory minimums — must be withdrawn regardless
                // These count toward meeting the spending need
                const totalMandatory = rrifMandatory + lifMandatory;
                const neededBeyondMandatory = Math.max(0, neededFromPortfolio - totalMandatory);

                let withdrawal;
                if (_withdrawalStrategy === 'naive') {
                    withdrawal = this._withdrawNaive(
                        balances,
                        neededBeyondMandatory,
                        province,
                        cppIncome + additionalIncome + pensionIncome + totalMandatory,
                        age
                    );
                } else {
                    withdrawal = this._withdrawSmartOptimal(
                        balances,
                        neededBeyondMandatory,
                        province,
                        cppIncome + additionalIncome + pensionIncome + totalMandatory,
                        oasIncome,
                        age >= effOAS1,
                        { cppP1, cppP2, oasP1, oasP2, additionalIncome: additionalIncome + pensionIncome, isSingle, age }
                    );
                }

                // Apply mandatory RRIF/LIF withdrawals (on top of smart withdrawal)
                // These are taxable and must be accounted for in tax calculation
                let mandatoryTax = 0;
                const baseTaxableBeforeMandatory = withdrawal.taxableIncome || (cppIncome + additionalIncome + pensionIncome);
                if (rrifMandatory > 0) {
                    const mandatoryRRSP = Math.min(rrifMandatory, balances.rrsp);
                    const extraRRSP = Math.max(0, mandatoryRRSP - withdrawal.fromRRSP);
                    withdrawal.fromRRSP += extraRRSP;
                    withdrawal.total += extraRRSP;
                    // Tax on mandatory RRSP withdrawal
                    if (extraRRSP > 0) {
                        mandatoryTax += CanadianTax.calculateTax(baseTaxableBeforeMandatory + extraRRSP, province).total
                            - CanadianTax.calculateTax(baseTaxableBeforeMandatory, province).total;
                    }
                }
                if (lifMandatory > 0 && balances.lira > 0) {
                    const mandatoryLIRA = Math.min(lifMandatory, balances.lira);
                    withdrawal.fromLIRA = mandatoryLIRA;
                    withdrawal.total += mandatoryLIRA;
                    mandatoryTax += CanadianTax.calculateTax(baseTaxableBeforeMandatory + (withdrawal.fromRRSP || 0) + mandatoryLIRA, province).total
                        - CanadianTax.calculateTax(baseTaxableBeforeMandatory + (withdrawal.fromRRSP || 0), province).total;
                }
                withdrawal.taxPaid = (withdrawal.taxPaid || 0) + mandatoryTax;
                
                // Pass 2: recalculate GIS with actual withdrawals and re-withdraw if short
                if (age >= effOAS1) {
                    const GIS_MAX_SINGLE = 12780;
                    const GIS_MAX_COUPLE = 7692;
                    const gisMax2 = isSingle ? GIS_MAX_SINGLE : GIS_MAX_COUPLE * 2;
                    const gisTestPost = cppIncome + (withdrawal.fromRRSP || 0) + (withdrawal.fromOther || 0) 
                        + additionalIncome + pensionIncome + ((withdrawal.fromNonReg || 0) * 0.5);
                    const gisActual = Math.max(0, gisMax2 - gisTestPost * 0.5) * cpiFromRetirement;
                    const shortfall = gisEstimate - gisActual;
                    
                    if (shortfall > 100) {
                        // GIS was overestimated — need more from portfolio
                        const extraNeeded = shortfall;
                        const balancesCopy = { ...balances };
                        // Reduce by what was already withdrawn
                        balancesCopy.tfsa = Math.max(0, balancesCopy.tfsa - withdrawal.fromTFSA);
                        balancesCopy.nonReg = Math.max(0, balancesCopy.nonReg - withdrawal.fromNonReg);
                        balancesCopy.rrsp = Math.max(0, balancesCopy.rrsp - withdrawal.fromRRSP);
                        balancesCopy.other = Math.max(0, balancesCopy.other - withdrawal.fromOther);
                        balancesCopy.cash = Math.max(0, balancesCopy.cash - (withdrawal.fromCash || 0));
                        
                        // Prefer TFSA for the shortfall (doesn't affect GIS)
                        const extraTFSA = Math.min(extraNeeded, balancesCopy.tfsa);
                        withdrawal = {
                            ...withdrawal,
                            fromTFSA: withdrawal.fromTFSA + extraTFSA,
                            total: withdrawal.total + extraTFSA
                        };
                    }
                }

                // Update balances
                balances.tfsa = Math.max(0, balances.tfsa - withdrawal.fromTFSA);
                balances.nonReg = Math.max(0, balances.nonReg - withdrawal.fromNonReg);
                balances.rrsp = Math.max(0, balances.rrsp - withdrawal.fromRRSP);
                balances.other = Math.max(0, balances.other - withdrawal.fromOther);
                balances.cash = Math.max(0, balances.cash - (withdrawal.fromCash || 0));
                balances.lira = Math.max(0, balances.lira - (withdrawal.fromLIRA || 0));

                const totalBalance = balances.rrsp + balances.tfsa + balances.nonReg + balances.other + balances.cash + balances.lira;

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
                        + pensionIncome + ((withdrawal.fromNonReg || 0) * 0.5); // NonReg at 50% inclusion
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
                    lira: Math.round(balances.lira),
                    totalBalance: Math.round(totalBalance),
                    withdrawal: withdrawal.total,
                    withdrawalBreakdown: {
                        tfsa: withdrawal.fromTFSA,
                        nonReg: withdrawal.fromNonReg,
                        rrsp: withdrawal.fromRRSP,
                        lira: withdrawal.fromLIRA || 0,
                        cash: withdrawal.fromCash || 0,
                        other: withdrawal.fromOther
                    },
                    rrifMandatory: Math.round(rrifMandatory),
                    lifMandatory: Math.round(lifMandatory),
                    governmentIncome: Math.round(govIncome),
                    additionalIncome: Math.round(additionalIncome),
                    pensionIncome: Math.round(pensionIncome),
                    oasReceived: Math.round(actualOAS),
                    gisReceived: Math.round(gisIncome),
                    cppReceived: Math.round(cppIncome),
                    taxableIncome: withdrawal.taxableIncome,
                    taxPaid: withdrawal.taxPaid,
                    grossIncome: withdrawal.total + govIncome + additionalIncome + pensionIncome,
                    afterTaxIncome: withdrawal.afterTax + govIncome + additionalIncome + pensionIncome,
                    targetSpending: Math.round(totalNeed),
                    healthcareCost: Math.round(healthcareCost)
                });

                // Continue projecting even after depletion if there's government income
                if (totalBalance <= 0 && govIncome + additionalIncome + pensionIncome <= 0) break;
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

            // Smart bracket-filling RRSP meltdown:
            // Pre-OAS, fill tax brackets precisely to minimize lifetime tax.
            // The optimal amount depends on what post-OAS income will look like.
            // 
            // Strategy: Fill to the LOWER of:
            //   a) First bracket ceiling ($55,867 federal — 20.5% rate)
            //   b) OAS clawback threshold ($90,997 — where 15% clawback kicks in)
            //   c) Whatever the spending need requires
            //
            // Beyond the first bracket, RRSP gets expensive (29%+ marginal).
            // Better to use NonReg (50% inclusion) or TFSA for the rest.
            const FIRST_BRACKET_CEILING = 55867; // Federal 15% bracket top (2024)
            const rrspTargetIncome = Math.min(FIRST_BRACKET_CEILING, OAS_CLAWBACK_START);
            const rrspRoom = Math.max(0, rrspTargetIncome - nonOASTaxableIncome);
            
            // If we have a lot of RRSP, also fill second bracket to prevent massive RRIF later
            // Second bracket top: $111,733 (at 26% federal)
            const SECOND_BRACKET_CEILING = 111733;
            const extraRoomIfNeeded = balances.rrsp > 300000 
                ? Math.max(0, SECOND_BRACKET_CEILING - rrspTargetIncome) 
                : 0;

            // 1. RRSP up to first bracket ceiling (cheapest tax room)
            if (stillNeed > 0 && balances.rrsp > 0 && rrspRoom > 0) {
                const maxGross = Math.min(rrspRoom, balances.rrsp);
                const taxIfMax = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + maxGross, province
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province).total;
                const maxAfterTax = maxGross - taxIfMax;

                if (maxAfterTax >= stillNeed) {
                    fromRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome, province, balances.rrsp);
                    cumulativeTaxableIncome += fromRRSP;
                    stillNeed = 0;
                } else {
                    fromRRSP = maxGross;
                    cumulativeTaxableIncome += fromRRSP;
                    stillNeed -= maxAfterTax;
                }
            }
            
            // 1b. If large RRSP (>$300K), extend meltdown into second bracket
            // to prevent massive RRIF later. Only if still have spending need.
            if (stillNeed > 0 && balances.rrsp > fromRRSP && extraRoomIfNeeded > 0) {
                const remaining = balances.rrsp - fromRRSP;
                const extraGross = Math.min(extraRoomIfNeeded, remaining);
                const taxOnExtra = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + extraGross, province
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province).total;
                const extraAfterTax = extraGross - taxOnExtra;
                
                if (extraAfterTax >= stillNeed) {
                    const additionalRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome, province, remaining);
                    fromRRSP += additionalRRSP;
                    cumulativeTaxableIncome += additionalRRSP;
                    stillNeed = 0;
                } else {
                    fromRRSP += extraGross;
                    cumulativeTaxableIncome += extraGross;
                    stillNeed -= extraAfterTax;
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

        // Final tax (with senior credits if 65+)
        const totalTaxableForCalc = cumulativeTaxableIncome + (oasActive ? actualOAS : 0);
        const currentAge = perPerson.age || 0;
        const eligiblePensionIncome = fromRRSP + (perPerson.additionalIncome || 0); // RRIF + DB pension
        const taxOpts = currentAge >= 65 ? { age: currentAge, pensionIncome: eligiblePensionIncome } : {};

        let totalTax;
        if (!perPerson.isSingle && currentAge >= 65 && eligiblePensionIncome > 0) {
            // Pension income splitting: transfer up to 50% of eligible pension to lower-income spouse
            // This reduces the higher earner's taxable income and gives the spouse the pension credit
            const splitAmount = eligiblePensionIncome * 0.5;
            const p1Taxable = totalTaxableForCalc - splitAmount;
            const p2Taxable = splitAmount; // spouse receives this as their pension income
            const p1Tax = CanadianTax.calculateTax(Math.max(0, p1Taxable), province, { age: currentAge, pensionIncome: eligiblePensionIncome - splitAmount }).total;
            const p2Tax = CanadianTax.calculateTax(p2Taxable, province, { age: currentAge, pensionIncome: splitAmount }).total;
            const baseTax = CanadianTax.calculateTax(nonOASTaxableIncome, province, taxOpts).total;
            totalTax = (p1Tax + p2Tax) - baseTax;
        } else {
            totalTax = CanadianTax.calculateTax(totalTaxableForCalc, province, taxOpts).total -
                        CanadianTax.calculateTax(nonOASTaxableIncome, province, taxOpts).total;
        }
        
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
    },

    // ═══════════════════════════════════════
    // Tax Savings Comparison: Smart vs Naive withdrawal
    // Shows how much the tax-optimized strategy saves
    // ═══════════════════════════════════════
    // Find the optimal CPP/OAS timing + withdrawal strategy for maximum sustainable spending
    // Two-phase: coarse sweep (every 2 years), then fine-tune around winner
    optimizePlan(inputs) {
        const lifeExp = inputs.lifeExpectancy || 90;

        const findMaxSpend = (overrides) => {
            let lo = 20000, hi = 200000;
            for (let i = 0; i < 18; i++) {
                const mid = (lo + hi) / 2;
                const r = this.calculate({ ...inputs, ...overrides, annualSpending: mid });
                if (r.summary.moneyLastsAge >= lifeExp) lo = mid; else hi = mid;
            }
            return Math.floor(lo / 1000) * 1000;
        };

        let bestMaxSpend = 0;
        let bestParams = null;

        // Phase 1: Coarse sweep (every 2 years) — ~36 combos × 2 strategies = 72
        const retAge = inputs.retirementAge || 65;
        const coarseCPP = [60, 62, 64, 65, 66, 68, 70].filter(a => a >= retAge);
        const coarseOAS = [65, 66, 68, 70];
        const strategies = ['smart', 'naive'];

        for (const strategy of strategies) {
            for (const cppAge of coarseCPP) {
                for (const oasAge of coarseOAS) {
                    try {
                        const overrides = {
                            cppStartAge: cppAge, oasStartAge: oasAge,
                            cppStartAgeP2: cppAge, oasStartAgeP2: oasAge,
                            _withdrawalStrategy: strategy
                        };
                        const maxSpend = findMaxSpend(overrides);
                        if (maxSpend > bestMaxSpend) {
                            bestMaxSpend = maxSpend;
                            bestParams = { cppAge, oasAge, strategy, maxSpend };
                        }
                    } catch(e) {}
                }
            }
        }

        // Phase 2: Fine-tune ±1 year around best (max 15 combos)
        const fineCPP = new Set();
        const fineOAS = new Set();
        for (let d = -1; d <= 1; d++) {
            const c = bestParams.cppAge + d;
            const o = bestParams.oasAge + d;
            if (c >= retAge && c <= 70) fineCPP.add(c);
            if (o >= 65 && o <= 70) fineOAS.add(o);
        }

        for (const strategy of strategies) {
            for (const cppAge of fineCPP) {
                for (const oasAge of fineOAS) {
                    try {
                        const overrides = {
                            cppStartAge: cppAge, oasStartAge: oasAge,
                            cppStartAgeP2: cppAge, oasStartAgeP2: oasAge,
                            _withdrawalStrategy: strategy
                        };
                        const maxSpend = findMaxSpend(overrides);
                        if (maxSpend > bestMaxSpend) {
                            bestMaxSpend = maxSpend;
                            bestParams = { cppAge, oasAge, strategy, maxSpend };
                        }
                    } catch(e) {}
                }
            }
        }

        // Guarantee optimizer >= both advisor AND user's plan
        const floors = [
            // Advisor config
            { cppStartAge: 65, oasStartAge: 65, cppStartAgeP2: 65, oasStartAgeP2: 65, _withdrawalStrategy: 'naive' },
            // User's own config (both strategies)
            { cppStartAge: inputs.cppStartAge, oasStartAge: inputs.oasStartAge, cppStartAgeP2: inputs.cppStartAgeP2 || inputs.cppStartAge, oasStartAgeP2: inputs.oasStartAgeP2 || inputs.oasStartAge, _withdrawalStrategy: 'smart' },
            { cppStartAge: inputs.cppStartAge, oasStartAge: inputs.oasStartAge, cppStartAgeP2: inputs.cppStartAgeP2 || inputs.cppStartAge, oasStartAgeP2: inputs.oasStartAgeP2 || inputs.oasStartAge, _withdrawalStrategy: 'naive' },
        ];
        for (const floorOverrides of floors) {
            try {
                const floorMax = findMaxSpend(floorOverrides);
                if (floorMax > bestMaxSpend) {
                    bestMaxSpend = floorMax;
                    bestParams = { 
                        cppAge: floorOverrides.cppStartAge, 
                        oasAge: floorOverrides.oasStartAge, 
                        strategy: floorOverrides._withdrawalStrategy, 
                        maxSpend: floorMax 
                    };
                }
            } catch(e) {}
        }

        // Re-run at user's actual spending with best params for display
        const bestInputs = {
            ...inputs,
            cppStartAge: bestParams.cppAge, oasStartAge: bestParams.oasAge,
            cppStartAgeP2: bestParams.cppAge, oasStartAgeP2: bestParams.oasAge,
            _withdrawalStrategy: bestParams.strategy
        };
        const bestResult = this.calculate(bestInputs);

        return { result: bestResult, params: bestParams, inputs: bestInputs };
    },

    compareTaxStrategies(inputs) {
        // Run smart strategy (default)
        const smartResult = this.calculate(inputs);
        
        // Run naive strategy: RRSP first → NonReg → TFSA → Other
        const naiveResult = this.calculate({ ...inputs, _withdrawalStrategy: 'naive' });
        
        const smartYears = smartResult.yearByYear.filter(y => y.phase === 'retirement');
        const naiveYears = naiveResult.yearByYear.filter(y => y.phase === 'retirement');
        
        const smartTotalTax = smartYears.reduce((s, y) => s + (y.taxPaid || 0), 0);
        const naiveTotalTax = naiveYears.reduce((s, y) => s + (y.taxPaid || 0), 0);
        const taxSaved = naiveTotalTax - smartTotalTax;
        
        const smartOAS = smartYears.reduce((s, y) => s + (y.oasReceived || 0), 0);
        const naiveOAS = naiveYears.reduce((s, y) => s + (y.oasReceived || 0), 0);
        const oasPreserved = smartOAS - naiveOAS;
        
        const smartGIS = smartYears.reduce((s, y) => s + (y.gisReceived || 0), 0);
        const naiveGIS = naiveYears.reduce((s, y) => s + (y.gisReceived || 0), 0);
        const gisPreserved = smartGIS - naiveGIS;
        
        return {
            smart: {
                totalTax: Math.round(smartTotalTax),
                totalOAS: Math.round(smartOAS),
                totalGIS: Math.round(smartGIS),
                moneyLastsAge: smartResult.summary.moneyLastsAge,
                legacy: Math.round(smartResult.summary.legacyAmount)
            },
            naive: {
                totalTax: Math.round(naiveTotalTax),
                totalOAS: Math.round(naiveOAS),
                totalGIS: Math.round(naiveGIS),
                moneyLastsAge: naiveResult.summary.moneyLastsAge,
                legacy: Math.round(naiveResult.summary.legacyAmount)
            },
            savings: {
                taxSaved: Math.round(taxSaved),
                oasPreserved: Math.round(oasPreserved),
                gisPreserved: Math.round(gisPreserved),
                extraYears: naiveResult.summary.moneyLastsAge < smartResult.summary.moneyLastsAge 
                    ? smartResult.summary.moneyLastsAge - naiveResult.summary.moneyLastsAge : 0,
                totalBenefit: Math.round(taxSaved + oasPreserved + gisPreserved)
            }
        };
    },

    // "Good Advisor" withdrawal strategy:
    // TFSA as primary source, but pull RRSP up to the basic personal amount
    // (~$15,705 federally tax-free) or low bracket ceiling to use cheap tax room.
    // This is what a competent (non-optimizing) advisor would do:
    // "Don't waste your personal amount — pull some RRSP to fill it, then use TFSA"
    _withdrawNaive(balances, neededAfterTax, province, taxableIncome, age) {
        let stillNeed = neededAfterTax;
        let fromRRSP = 0, fromNonReg = 0, fromTFSA = 0, fromOther = 0, fromCash = 0, fromLIRA = 0;
        let cumTaxable = taxableIncome;
        
        const BASIC_PERSONAL = 15705; // 2024 federal basic personal amount
        
        // 1. Pull RRSP up to fill basic personal amount (essentially tax-free)
        if (balances.rrsp > 0 && cumTaxable < BASIC_PERSONAL) {
            const roomToFill = BASIC_PERSONAL - cumTaxable;
            const rrspPull = Math.min(roomToFill, balances.rrsp, stillNeed > 0 ? stillNeed * 1.5 : roomToFill);
            fromRRSP = rrspPull;
            const taxOnPull = CanadianTax.calculateTax(cumTaxable + rrspPull, province).total
                - CanadianTax.calculateTax(cumTaxable, province).total;
            cumTaxable += rrspPull;
            stillNeed -= (rrspPull - taxOnPull);
        }
        
        // 2. TFSA for the rest of spending need (primary source)
        if (stillNeed > 0 && balances.tfsa > 0) {
            fromTFSA = Math.min(stillNeed, balances.tfsa);
            stillNeed -= fromTFSA;
        }
        
        // 3. Cash
        if (stillNeed > 0 && balances.cash > 0) {
            fromCash = Math.min(stillNeed, balances.cash);
            stillNeed -= fromCash;
        }
        
        // 4. Non-Reg (50% capital gains)
        if (stillNeed > 0 && balances.nonReg > 0) {
            fromNonReg = Math.min(stillNeed * 1.3, balances.nonReg);
            const capGain = fromNonReg * 0.5;
            const taxOnNR = CanadianTax.calculateTax(cumTaxable + capGain, province).total
                - CanadianTax.calculateTax(cumTaxable, province).total;
            cumTaxable += capGain;
            stillNeed -= (fromNonReg - taxOnNR);
        }
        
        // 5. More RRSP if still needed
        if (stillNeed > 0 && balances.rrsp > fromRRSP) {
            const moreRRSP = this._binarySearchGross(stillNeed, cumTaxable, province, balances.rrsp - fromRRSP);
            fromRRSP += moreRRSP;
            const taxOnMore = CanadianTax.calculateTax(cumTaxable + moreRRSP, province).total
                - CanadianTax.calculateTax(cumTaxable, province).total;
            cumTaxable += moreRRSP;
            stillNeed -= (moreRRSP - taxOnMore);
        }
        
        // 6. LIRA
        if (stillNeed > 0 && balances.lira > 0) {
            fromLIRA = Math.min(stillNeed * 1.5, balances.lira);
            cumTaxable += fromLIRA;
            stillNeed -= fromLIRA * 0.65;
        }
        
        // 7. Other
        if (stillNeed > 0 && balances.other > 0) {
            fromOther = Math.min(stillNeed * 1.5, balances.other);
            cumTaxable += fromOther;
        }
        
        const totalGross = fromRRSP + fromNonReg + fromTFSA + fromOther + fromCash + fromLIRA;
        const taxOpts = age >= 65 ? { age, pensionIncome: fromRRSP + fromLIRA } : {};
        const totalTax = CanadianTax.calculateTax(cumTaxable, province, taxOpts).total 
            - CanadianTax.calculateTax(taxableIncome, province, taxOpts).total;
        
        return {
            fromTFSA, fromNonReg, fromRRSP, fromOther, fromCash, fromLIRA,
            total: totalGross,
            taxableIncome: cumTaxable,
            taxPaid: totalTax,
            afterTax: totalGross - totalTax,
            actualOAS: undefined
        };
    }
};

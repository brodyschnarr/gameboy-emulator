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
            _withdrawalStrategy = 'smart',

            // Tier 2/3 features
            // rentalIncome removed — now flows through additionalIncomeSources with continuesInRetirement flag
            healthcareInflation = 5,       // Healthcare inflation % (default 5%)
            ltcMonthly = 0,                // Long-term care monthly cost
            ltcStartAge = 80,              // Age LTC costs begin
            annuityLumpSum = 0,            // Lump sum to purchase annuity
            annuityPurchaseAge,            // Age to buy annuity
            annuityMonthlyPayout = 0,      // Monthly annuity payout
            dtc = false,                   // Disability Tax Credit
            downsizingAge,                 // Age to sell home
            downsizingProceeds = 0,        // Net proceeds from home sale
            downsizingSpendingChange = 0,  // Monthly change in housing cost (negative = savings)
            categoryInflation,             // { housing, food, healthcare, discretionary } rates
            estateAssets = [],             // Non-liquid assets: [{name, value, isPrimaryResidence}]
            lifeInsurance = 0,             // Life insurance death benefit (tax-free)
            vehicleValue = 0,              // Vehicle/collectible value
            otherEstateValue = 0,          // Other estate asset value
            otherRetirementIncome = 0,     // Custom other income in retirement
            otherRetirementIncomeTaxable = true,
            otherRetirementExpense = 0,    // Custom other expense in retirement
        } = inputs;

        const yearsToRetirement = retirementAge - currentAge;
        const isFamilyMode = familyStatus === 'couple';
        
        // Sanitize income inputs (NaN from empty form fields)
        const safeIncome = (!currentIncome || isNaN(currentIncome)) ? 70000 : currentIncome;
        const safeIncome1 = isFamilyMode ? ((!income1 || isNaN(income1)) ? safeIncome : income1) : safeIncome;
        const safeIncome2 = isFamilyMode ? ((!income2 || isNaN(income2)) ? 0 : income2) : 0;

        // FIX #8: Normalize contribution split to sum to 1.0
        const normalizedSplit = this._normalizeSplit(contributionSplit);

        // FIX #1: Use partner age for person 2's CPP contribution years
        const p1ContribYears = Math.min(retirementAge - 18, 39);
        const p2ContribYears = isFamilyMode && partnerAge
            ? Math.min(retirementAge - (18 + (currentAge - partnerAge)), 39)
            : p1ContribYears;

        // 1. Calculate government benefits (base amounts at age 65)
        const govBenefits = this._calculateGovernmentBenefits({
            income1: safeIncome1,
            income2: safeIncome2,
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

        // 2. Calculate healthcare costs (with healthcare-specific inflation + LTC)
        // If healthStatus === 'none', user's spending already includes healthcare — skip add-on
        const skipHealthcare = (healthStatus === 'none');
        const healthcareInfRate = (healthcareInflation || 5) / 100;
        const ltcOpts = ltcMonthly > 0 ? { monthlyAmount: ltcMonthly, startAge: ltcStartAge || 80 } : null;
        const healthcareCosts = skipHealthcare
            ? { total: 0, averageAnnual: 0, byYear: [], breakdown: { prescriptions: 0, dental: 0, vision: 0, other: 0 } }
            : HealthcareEstimator.projectTotal(
                retirementAge,
                lifeExpectancy,
                province,
                healthStatus || 'average',
                healthcareInfRate,
                ltcOpts
            );

        // 3. Inflation-adjusted spending at retirement
        // Category inflation blends housing/food/healthcare/discretionary if provided
        // Pre-retirement: use base inflation to project spending to retirement age
        const baseInflation = inflationRate / 100;
        const inflationMultiplier = Math.pow(1 + baseInflation, yearsToRetirement);
        const futureAnnualSpending = annualSpending * inflationMultiplier;
        
        // Post-retirement: category inflation applied per-year in _generateProjection
        // effectiveInflation used for retirement-year spending escalation
        let effectiveInflation = baseInflation;
        if (categoryInflation && typeof categoryInflation === 'object') {
            // Weighted by user's spending breakdown or default weights
            const weights = categoryInflation._weights || { housing: 0.30, food: 0.15, healthcare: 0.15, discretionary: 0.40 };
            const h = (categoryInflation.housing ?? inflationRate) / 100;
            const f = (categoryInflation.food ?? inflationRate) / 100;
            const hc = (categoryInflation.healthcare ?? healthcareInflation ?? 5) / 100;
            const d = (categoryInflation.discretionary ?? inflationRate) / 100;
            effectiveInflation = h * weights.housing + f * weights.food + hc * weights.healthcare + d * weights.discretionary;
        }

        // 4. Year-by-year projection
        const projection = this._generateProjection({
            startAge: currentAge,
            retirementAge,
            lifeExpectancy,
            accounts: { rrsp, tfsa, nonReg, other, cash, lira: lira || 0 },
            annualContribution: monthlyContribution * 12,
            currentIncome: safeIncome,
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
            isFamilyMode,
            partnerAge: partnerAge || currentAge,
            rentalIncome: 0, // Legacy — now included in additionalIncomeSources
            effectiveInflation,
            annuityLumpSum: annuityLumpSum || 0,
            annuityPurchaseAge: annuityPurchaseAge || retirementAge,
            annuityMonthlyPayout: annuityMonthlyPayout || 0,
            dtc: dtc || false,
            downsizingAge: downsizingAge || null,
            downsizingProceeds: downsizingProceeds || 0,
            downsizingSpendingChange: downsizingSpendingChange || 0,
            rrspRoomOverride: inputs.rrspRoomOverride,
            tfsaRoomOverride: inputs.tfsaRoomOverride,
            otherRetirementIncome: otherRetirementIncome || 0,
            otherRetirementIncomeTaxable: otherRetirementIncomeTaxable !== false,
            otherRetirementExpense: otherRetirementExpense || 0,
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
        
        // Portfolio is "depleted" if balance < $100 OR if withdrawal can't meet spending need
        // (prevents floating-point $1 balances from falsely passing the check)
        const runsOutYear = projection.find(p => {
            if (p.phase !== 'retirement') return false;
            if (p.totalBalance <= 100) return true;
            // Also check if portfolio couldn't meet spending need
            // (withdrawal + govt income significantly short of target spending)
            if (p.targetSpending > 0) {
                const totalIncome = (p.withdrawal || 0) + (p.governmentIncome || 0) + (p.additionalIncome || 0) + (p.pensionIncome || 0) + (p.rentalIncome || 0) + (p.annuityIncome || 0) + (p.spouseAllowance || 0) + (p.otherIncome || 0);
                const shortfall = p.targetSpending - totalIncome;
                if (shortfall > p.targetSpending * 0.1) return true; // >10% short = can't sustain
            }
            return false;
        });
        const moneyLastsAge = runsOutYear ? runsOutYear.age : lifeExpectancy;
        
        const firstRetirementYear = projection.find(p => p.age === retirementAge);
        const annualIncomeAtRetirement = firstRetirementYear 
            ? (firstRetirementYear.governmentIncome || 0) + (firstRetirementYear.withdrawal || 0)
            : 0;
        
        const portfolioAtRetirement = firstRetirementYear ? firstRetirementYear.totalBalance : 0;
        const onTrack = moneyLastsAge >= lifeExpectancy;
        
        // Estate tax at death — deemed disposition of RRSP/RRIF + capital gains on non-reg + non-liquid assets
        let estateTax = 0;
        // Non-liquid estate assets (home, property, etc.)
        const cpiAtDeath = finalYear ? Math.pow(1 + inflationRate / 100, (finalYear.age || lifeExpectancy) - currentAge) : 1;
        let totalEstateAssets = 0;
        let estateAssetTax = 0;
        if (estateAssets && estateAssets.length > 0) {
            for (const asset of estateAssets) {
                const appreciatedValue = (asset.value || 0) * cpiAtDeath; // Assume appreciates with inflation
                totalEstateAssets += appreciatedValue;
                if (!asset.isPrimaryResidence) {
                    // Non-primary residence: capital gains on appreciation
                    const gain = appreciatedValue - (asset.value || 0);
                    estateAssetTax += gain * 0.5 * 0.25; // 50% inclusion × ~25% avg tax rate
                }
                // Primary residence = tax-exempt (principal residence exemption)
            }
        }
        // Add non-property estate assets
        totalEstateAssets += lifeInsurance; // Tax-free
        totalEstateAssets += (vehicleValue || 0) * cpiAtDeath; // Depreciates but rough estimate
        totalEstateAssets += (otherEstateValue || 0) * cpiAtDeath;

        if (finalYear && legacyAmount > 0) {
            const rrspAtDeath = finalYear.rrsp || 0;
            const nonRegAtDeath = finalYear.nonReg || 0;
            const deemedIncome = rrspAtDeath + (nonRegAtDeath * 0.5 * 0.5);
            const deathTax = CanadianTax.calculateTax(deemedIncome, province, { inflationFactor: cpiAtDeath }).total;
            estateTax = Math.round(deathTax + estateAssetTax);
        }
        const grossEstate = Math.round(legacyAmount) + Math.round(totalEstateAssets);
        const netEstate = Math.max(0, grossEstate - estateTax);

        let legacyDescription = '';
        if (netEstate > 1000000) legacyDescription = 'Significant legacy for heirs';
        else if (netEstate > 500000) legacyDescription = 'Comfortable legacy';
        else if (netEstate > 100000) legacyDescription = 'Modest legacy';
        else if (netEstate > 0) legacyDescription = 'Small legacy';
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
                estateAssets: Math.round(totalEstateAssets),
                grossEstate,
                description: legacyDescription,
                estateTax,
                netEstate
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
            currentIncome = 70000,
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
            isFamilyMode = false,
            effectiveInflation,
            annuityLumpSum = 0,
            annuityPurchaseAge = retirementAge,
            annuityMonthlyPayout = 0,
            dtc = false,
            downsizingAge = null,
            downsizingProceeds = 0,
            downsizingSpendingChange = 0,
            rrspRoomOverride,
            tfsaRoomOverride,
            otherRetirementIncome = 0,
            otherRetirementIncomeTaxable = true,
            otherRetirementExpense = 0,
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

        // ═══ TFSA Room: exact historical limits by year ═══
        // CRA published annual limits:
        const TFSA_LIMITS = {
            2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
            2013: 5500, 2014: 5500,
            2015: 10000,
            2016: 5500, 2017: 5500, 2018: 5500,
            2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
            2023: 6500,
            2024: 7000, 2025: 7000
        };
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - startAge;
        const tfsaEligibleFrom = Math.max(2009, birthYear + 18); // Age 18 or 2009

        // Sum up exact room from eligible year to current year
        let tfsaTotalRoom = 0;
        for (let yr = tfsaEligibleFrom; yr <= currentYear; yr++) {
            tfsaTotalRoom += TFSA_LIMITS[yr] || 7000; // Future years: $7K (indexed below)
        }
        // Available room = total accumulated - current balance (what they've already contributed)
        let tfsaRoom = Math.max(0, tfsaTotalRoom - (accounts.tfsa || 0));

        // ═══ RRSP Room: estimated from income history ═══
        // CRA RRSP dollar limits by year (for reference):
        const RRSP_MAX = {
            2009: 21000, 2010: 22000, 2011: 22450, 2012: 22970,
            2013: 23820, 2014: 24270, 2015: 24930, 2016: 25370,
            2017: 26010, 2018: 26230, 2019: 26500, 2020: 27230,
            2021: 27830, 2022: 29210, 2023: 30780, 2024: 31560, 2025: 32490
        };
        // Estimate past income trajectory: assume income grew ~3%/yr from a starting point
        // Working from current income backward gives more realistic estimates
        const workStartAge = 22;
        const yearsWorked = Math.max(0, startAge - workStartAge);
        const incomeGrowthRate = 0.03; // Assumed 3% annual raises
        let rrspTotalRoom = 0;
        for (let i = 0; i < yearsWorked; i++) {
            const yearNum = currentYear - yearsWorked + i;
            // Estimate income for that year (work backward from current income)
            const yearsAgo = yearsWorked - i;
            const estimatedIncome = currentIncome / Math.pow(1 + incomeGrowthRate, yearsAgo);
            const rrspMaxForYear = RRSP_MAX[yearNum] || 31560;
            const roomThisYear = Math.min(estimatedIncome * 0.18, rrspMaxForYear);
            rrspTotalRoom += roomThisYear;
        }
        // Available room = total accumulated room - current RRSP balance
        // (RRSP balance approximates lifetime contributions + growth, but contributions < balance due to growth)
        // Better estimate: assume avg return ~5%, back-calculate rough contributions from balance
        // Simple approach: assume current balance ≈ contributions × 1.5 (growth factor)
        const estimatedPastContributions = (accounts.rrsp || 0) / 1.5;
        let rrspRoom = Math.max(0, rrspTotalRoom - estimatedPastContributions);
        // Allow override if user provides it
        if (params.rrspRoomOverride !== undefined) rrspRoom = params.rrspRoomOverride;
        if (params.tfsaRoomOverride !== undefined) tfsaRoom = params.tfsaRoomOverride;

        for (let age = startAge; age <= lifeExpectancy; age++) {
            const isRetired = age >= retirementAge;
            const isWorking = age < retirementAge;

            // Process windfalls for this year
            if (windfalls && windfalls.length > 0) {
                windfalls.forEach(w => {
                    let targetAge;
                    if (w.type === 'shares') {
                        targetAge = w.sellAge || w.year || (currentAge + 5);
                    } else {
                        targetAge = w.year > 150 ? (w.year - (new Date().getFullYear() - currentAge)) : (w.year || (currentAge + (w.yearsFromNow || 0)));
                    }
                    if (targetAge === age && (w.probability === undefined || w.probability >= 100)) {
                        // Resolve the gross amount
                        let grossAmount = w.amount || 0;
                        let costBasis = grossAmount; // default: no gain
                        if (w.type === 'shares') {
                            // Shares: grow current value to sell date
                            const cv = w.currentValue || w.amount || 0;
                            const gr = (w.growthRate || 6) / 100;
                            const yearsToSell = Math.max(0, age - currentAge);
                            grossAmount = cv * Math.pow(1 + gr, yearsToSell);
                            costBasis = cv; // ACB = original value
                        }

                        let afterTaxAmount = grossAmount;
                        if (w.taxable) {
                            if (w.type === 'shares') {
                                // Capital gains: only the gain at 50% inclusion rate
                                const gain = Math.max(0, grossAmount - costBasis);
                                const taxableGain = gain * 0.5; // 50% inclusion
                                const marginalRate = 0.30; // approximate
                                afterTaxAmount = grossAmount - (taxableGain * marginalRate);
                            } else {
                                // Other taxable windfalls: approximate marginal rate
                                afterTaxAmount = grossAmount * 0.7;
                            }
                        }
                        // Inheritances (not taxable) pass through at full value
                        if (w.destination === 'rrsp') balances.rrsp += afterTaxAmount;
                        else if (w.destination === 'tfsa') balances.tfsa += afterTaxAmount;
                        else if (w.destination === 'nonReg') balances.nonReg += afterTaxAmount;
                        else {
                            balances.tfsa += afterTaxAmount * 0.5;
                            balances.nonReg += afterTaxAmount * 0.5;
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

                let rrspContrib = thisYearContribution * (contributionSplit.rrsp || 0);
                let tfsaContrib = thisYearContribution * (contributionSplit.tfsa || 0);
                let nonRegContrib = thisYearContribution * (contributionSplit.nonReg || 0);

                // Cap contributions to available room, overflow to Non-Reg
                if (tfsaContrib > tfsaRoom) {
                    nonRegContrib += tfsaContrib - Math.max(0, tfsaRoom);
                    tfsaContrib = Math.max(0, tfsaRoom);
                }
                if (rrspContrib > rrspRoom) {
                    nonRegContrib += rrspContrib - Math.max(0, rrspRoom);
                    rrspContrib = Math.max(0, rrspRoom);
                }

                // Deduct used room
                tfsaRoom -= tfsaContrib;
                rrspRoom -= rrspContrib;

                // Add next year's new room
                const nextCalYear = currentYear + (age - startAge + 1);
                const cpiNextYear = Math.pow(1 + inflationRate / 100, age - startAge + 1);
                // TFSA: use known limits or $7K indexed for future years
                const tfsaNewRoom = TFSA_LIMITS[nextCalYear] || Math.round(7000 * cpiNextYear / 500) * 500; // CRA rounds to nearest $500
                tfsaRoom += tfsaNewRoom;
                // RRSP: 18% of income (growing with contrib growth rate), capped at CRA max (indexed)
                const incomeForRRSP = currentIncome * Math.pow(1 + contributionGrowthRate, age - startAge + 1);
                const rrspMaxFuture = RRSP_MAX[nextCalYear] || Math.round(31560 * cpiNextYear / 10) * 10;
                rrspRoom += Math.min(incomeForRRSP * 0.18, rrspMaxFuture);
                
                // RRSP tax refund reinvestment: RRSP contributions generate a refund at marginal rate
                // Estimate marginal rate from income (federal + provincial rough)
                const estIncome = currentIncome * Math.pow(1 + contributionGrowthRate, age - startAge);
                let marginalRate = 0.20; // default
                if (estIncome > 220000) marginalRate = 0.33;
                else if (estIncome > 155000) marginalRate = 0.29;
                else if (estIncome > 110000) marginalRate = 0.26;
                else if (estIncome > 55000) marginalRate = 0.205;
                else marginalRate = 0.15;
                marginalRate += 0.05; // Provincial approximation

                const rrspRefund = rrspContrib * marginalRate;
                // Reinvest refund: split between TFSA (if room) and Non-Reg
                let refundToTFSA = Math.min(rrspRefund, Math.max(0, tfsaRoom));
                let refundToNonReg = rrspRefund - refundToTFSA;
                tfsaRoom -= refundToTFSA;

                balances.rrsp += rrspContrib;
                balances.tfsa += tfsaContrib + refundToTFSA;
                balances.nonReg += nonRegContrib + refundToNonReg;

                balances.rrsp *= (1 + r);
                balances.tfsa *= (1 + r);
                balances.nonReg *= (1 + r);
                balances.other *= (1 + r);
                balances.lira *= (1 + r);
                balances.cash *= (1 + CASH_RATE);

                // Pay down debt — deduct payments from non-registered first, then TFSA
                if (debt > 0 && age < debtPayoffAge) {
                    const yearsRemaining = debtPayoffAge - age;
                    const annualPayment = Math.min(debt, debt / yearsRemaining);
                    // Deduct from accounts (non-reg → TFSA → RRSP as last resort)
                    let remaining = annualPayment;
                    const fromNonReg = Math.min(remaining, balances.nonReg);
                    balances.nonReg -= fromNonReg;
                    remaining -= fromNonReg;
                    if (remaining > 0) {
                        const fromTFSA = Math.min(remaining, balances.tfsa);
                        balances.tfsa -= fromTFSA;
                        remaining -= fromTFSA;
                    }
                    if (remaining > 0) {
                        const fromRRSP = Math.min(remaining, balances.rrsp);
                        balances.rrsp -= fromRRSP;
                        remaining -= fromRRSP;
                    }
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
                // Use category-weighted inflation for spending, base inflation for everything else
                const retirementInflationRate = effectiveInflation || inf;
                const inflationFactor = Math.pow(1 + retirementInflationRate, yearsIntoRetirement);
                // CRA indexes tax brackets/credits to CPI from today
                const cpiFromToday = Math.pow(1 + inf, age - startAge);

                // Downsizing: add proceeds at sell age, adjust spending afterward
                let downsizingAdjustment = 0;
                if (downsizingAge && age === downsizingAge && downsizingProceeds > 0) {
                    const tfsaRoom = Math.max(0, 95000 - balances.tfsa);
                    const toTFSA = Math.min(downsizingProceeds, tfsaRoom);
                    balances.tfsa += toTFSA;
                    balances.nonReg += (downsizingProceeds - toTFSA);
                }
                if (downsizingAge && age >= downsizingAge && downsizingSpendingChange !== 0) {
                    downsizingAdjustment = downsizingSpendingChange * 12 * cpiFromToday;
                }

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
                
                // 3. Healthcare costs + spending adjustments
                const healthcareCost = healthcareByAge.find(h => h.age === age)?.cost || 0;
                // totalNeed adjusted by downsizing spending change (negative = savings)
                const otherExpenseInflated = otherRetirementExpense * inflationFactor;
                const totalNeed = Math.max(0, thisYearSpending + healthcareCost + downsizingAdjustment + otherExpenseInflated);

                // 4. Government income (inflation-indexed, tracked per-person for clawback)
                let cppP1 = 0, cppP2 = 0;
                if (age >= cppStartAge) {
                    cppP1 = govBenefits.cpp1 * cpiFromToday;
                }
                if (!isSingle && age >= (cppStartAgeP2 || cppStartAge)) {
                    cppP2 = govBenefits.cpp2 * cpiFromToday;
                }
                const cppIncome = cppP1 + cppP2;
                
                // FIX #3 & #4: OAS with deferral and clawback (per-person ages)
                const effOAS1 = govBenefits.oasStartAge || 65;
                const effOAS2 = govBenefits.oasStartAgeP2 || effOAS1;
                let oasP1 = 0, oasP2 = 0;
                if (age >= effOAS1) {
                    oasP1 = (govBenefits.oasPerPerson1 || govBenefits.oasPerPerson) * cpiFromToday;
                }
                if (!isSingle && age >= effOAS2) {
                    oasP2 = (govBenefits.oasPerPerson2 || govBenefits.oasPerPerson) * cpiFromToday;
                }
                const oasIncome = oasP1 + oasP2;

                // 5. Additional income sources (respects continuesInRetirement flag)
                const additionalIncome = additionalIncomeSources
                    .filter(s => {
                        if (age < s.startAge) return false;
                        if (s.endAge !== null && age > s.endAge) return false;
                        // In retirement years, only include sources flagged to continue
                        if (age >= retirementAge && s.continuesInRetirement === false) return false;
                        return true;
                    })
                    .reduce((sum, s) => {
                        const base = s.annualAmount;
                        return sum + (s.indexed ? base * cpiFromToday : base);
                    }, 0);

                // Other retirement income (custom user entry)
                const otherIncomeInflated = otherRetirementIncome > 0 ? otherRetirementIncome * cpiFromToday : 0;

                // Employer pension (standalone field — backwards compatible)
                let pensionIncome = 0;
                if (employerPension > 0 && age >= employerPensionStartAge) {
                    pensionIncome = employerPension * 12;
                    if (employerPensionIndexed) {
                        pensionIncome *= cpiFromToday;
                    }
                }
                
                // Rental income now included in additionalIncome above
                let rentalIncomeThisYear = 0; // kept for backward compat with year data output

                // Annuity: subtract lump sum at purchase age, add payout afterward
                let annuityPayoutThisYear = 0;
                if (annuityLumpSum > 0 && age === annuityPurchaseAge) {
                    // Subtract lump sum proportionally from accounts
                    const totalBal = balances.rrsp + balances.tfsa + balances.nonReg + balances.other + balances.cash;
                    if (totalBal > 0) {
                        const ratio = Math.min(1, annuityLumpSum / totalBal);
                        balances.rrsp *= (1 - ratio);
                        balances.tfsa *= (1 - ratio);
                        balances.nonReg *= (1 - ratio);
                        balances.other *= (1 - ratio);
                        balances.cash *= (1 - ratio);
                    }
                }
                if (annuityMonthlyPayout > 0 && age >= annuityPurchaseAge) {
                    annuityPayoutThisYear = annuityMonthlyPayout * 12 * cpiFromToday;
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
                    // GIS max is CPI-indexed — inflate to match income dollars
                    const gisMax = (isSingle ? GIS_MAX_SINGLE : GIS_MAX_COUPLE * 2) * cpiFromToday;
                    // Rental + annuity (taxable portion ~50%) count for GIS income test
                    // All income values are already in future nominal dollars (inflated by cpiFromToday)
                    const annuityTaxable = annuityPayoutThisYear * 0.5; // Prescribed annuity ~50% taxable
                    const gisTestPre = cppIncome + additionalIncome + pensionIncome + rentalIncomeThisYear + annuityTaxable;
                    
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
                        gisEstimate = Math.max(0, gisMax - estimatedGISTestIncome * 0.5);
                    } else {
                        // Only TFSA/cash — GIS unaffected by withdrawals
                        gisEstimate = Math.max(0, gisMax - gisTestPre * 0.5);
                    }
                }

                // Spouse allowance for 60-64 partner (GIS-like benefit)
                let spouseAllowance = 0;
                if (!isSingle && isFamilyMode) {
                    // If one partner is 60-64 and the other is 65+, younger qualifies for Allowance
                    // Max ~$1,354/mo ($16,248/yr), income-tested
                    const ALLOWANCE_MAX = 16248;
                    const partnerAgeNow = (params.partnerAge || startAge);
                    const partnerAgeThisYear = partnerAgeNow + (age - startAge);
                    if (partnerAgeThisYear >= 60 && partnerAgeThisYear < 65) {
                        const combinedIncome = cppIncome + additionalIncome + pensionIncome + rentalIncomeThisYear;
                        spouseAllowance = Math.max(0, ALLOWANCE_MAX - combinedIncome * 0.5) * cpiFromToday;
                    }
                }

                // Total non-portfolio income BEFORE clawback
                const totalOtherIncomePreClawback = cppIncome + oasIncome + additionalIncome + pensionIncome 
                    + gisEstimate + rentalIncomeThisYear + annuityPayoutThisYear + spouseAllowance + otherIncomeInflated;

                // FIX #9: Smart withdrawal — OAS-clawback-aware
                const neededFromPortfolio = Math.max(0, totalNeed - totalOtherIncomePreClawback);

                // RRIF/LIF mandatory minimums — must be withdrawn regardless
                // Don't subtract mandatory from need: the smart withdrawal usually pulls
                // from RRSP anyway (covering the mandatory within its pull).
                // The mandatory check after withdrawal ensures the minimum is met.
                const totalMandatory = rrifMandatory + lifMandatory;

                let withdrawal;
                if (_withdrawalStrategy === 'naive') {
                    withdrawal = this._withdrawNaive(
                        balances,
                        neededFromPortfolio,
                        province,
                        cppIncome + additionalIncome + pensionIncome + totalMandatory + rentalIncomeThisYear,
                        age,
                        cpiFromToday,
                        dtc
                    );
                } else {
                    withdrawal = this._withdrawSmartOptimal(
                        balances,
                        neededFromPortfolio,
                        province,
                        cppIncome + additionalIncome + pensionIncome + totalMandatory,
                        oasIncome,
                        age >= effOAS1,
                        { cppP1, cppP2, oasP1, oasP2, additionalIncome: additionalIncome + pensionIncome + rentalIncomeThisYear, isSingle, age, cpiFromToday, dtc }
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
                        const mTaxOpts = { inflationFactor: cpiFromToday };
                        mandatoryTax += CanadianTax.calculateTax(baseTaxableBeforeMandatory + extraRRSP, province, mTaxOpts).total
                            - CanadianTax.calculateTax(baseTaxableBeforeMandatory, province, mTaxOpts).total;
                    }
                }
                if (lifMandatory > 0 && balances.lira > 0) {
                    const mandatoryLIRA = Math.min(lifMandatory, balances.lira);
                    withdrawal.fromLIRA = mandatoryLIRA;
                    withdrawal.total += mandatoryLIRA;
                    const mTaxOpts = { inflationFactor: cpiFromToday };
                    mandatoryTax += CanadianTax.calculateTax(baseTaxableBeforeMandatory + (withdrawal.fromRRSP || 0) + mandatoryLIRA, province, mTaxOpts).total
                        - CanadianTax.calculateTax(baseTaxableBeforeMandatory + (withdrawal.fromRRSP || 0), province, mTaxOpts).total;
                }
                withdrawal.taxPaid = (withdrawal.taxPaid || 0) + mandatoryTax;
                
                // Pass 2: recalculate GIS with actual withdrawals and re-withdraw if short
                if (age >= effOAS1) {
                    const GIS_MAX_SINGLE2 = 12780;
                    const GIS_MAX_COUPLE2 = 7692;
                    const gisMax2 = (isSingle ? GIS_MAX_SINGLE2 : GIS_MAX_COUPLE2 * 2) * cpiFromToday;
                    const gisTestPost = cppIncome + (withdrawal.fromRRSP || 0) + (withdrawal.fromOther || 0) 
                        + additionalIncome + pensionIncome + ((withdrawal.fromNonReg || 0) * 0.5);
                    const gisActual = Math.max(0, gisMax2 - gisTestPost * 0.5);
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
                    const GIS_MAX_SINGLE3 = 12780;
                    const GIS_MAX_COUPLE3 = 7692; // per person
                    const GIS_CLAWBACK_RATE = 0.50;
                    // GIS max is CPI-indexed — inflate to match income dollars
                    const gisMax = (isSingle ? GIS_MAX_SINGLE3 : GIS_MAX_COUPLE3 * 2) * cpiFromToday;
                    // GIS income test excludes OAS but includes CPP, RRSP withdrawals, etc.
                    const gisTestIncome = cppIncome + (withdrawal.fromRRSP || 0) + (withdrawal.fromOther || 0) + additionalIncome
                        + pensionIncome + ((withdrawal.fromNonReg || 0) * 0.5); // NonReg at 50% inclusion
                    const gisClawback = gisTestIncome * GIS_CLAWBACK_RATE;
                    gisIncome = Math.max(0, gisMax - gisClawback);
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
                    oasBeforeClawback: Math.round(oasIncome),
                    oasClawback: Math.round(Math.max(0, oasIncome - actualOAS)),
                    gisReceived: Math.round(gisIncome),
                    cppReceived: Math.round(cppIncome),
                    rentalIncome: Math.round(rentalIncomeThisYear),
                    annuityIncome: Math.round(annuityPayoutThisYear),
                    spouseAllowance: Math.round(spouseAllowance),
                    taxableIncome: withdrawal.taxableIncome,
                    taxPaid: withdrawal.taxPaid,
                    otherIncome: Math.round(otherIncomeInflated),
                    grossIncome: withdrawal.total + govIncome + additionalIncome + pensionIncome + rentalIncomeThisYear + annuityPayoutThisYear + spouseAllowance + otherIncomeInflated,
                    afterTaxIncome: withdrawal.afterTax + govIncome + additionalIncome + pensionIncome + rentalIncomeThisYear + annuityPayoutThisYear + spouseAllowance + otherIncomeInflated,
                    targetSpending: Math.round(totalNeed),
                    healthcareCost: Math.round(healthcareCost)
                });

                // Continue projecting even after depletion if there's government income
                if (totalBalance <= 0 && govIncome + additionalIncome + pensionIncome + rentalIncomeThisYear + annuityPayoutThisYear + otherIncomeInflated <= 0) break;
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
        const cpi = (perPerson && perPerson.cpiFromToday) || 1.0;
        const hasDTC = perPerson && perPerson.dtc;
        const taxOpts = { inflationFactor: cpi, dtc: hasDTC };
        const OAS_CLAWBACK_START = 93454 * cpi;
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
            const FIRST_BRACKET_CEILING = 55867 * cpi; // Federal 15% bracket top, indexed
            const rrspTargetIncome = Math.min(FIRST_BRACKET_CEILING, OAS_CLAWBACK_START);
            const rrspRoom = Math.max(0, rrspTargetIncome - nonOASTaxableIncome);
            
            // If we have a lot of RRSP, also fill second bracket to prevent massive RRIF later
            const SECOND_BRACKET_CEILING = 111733 * cpi;
            const extraRoomIfNeeded = balances.rrsp > 300000 
                ? Math.max(0, SECOND_BRACKET_CEILING - rrspTargetIncome) 
                : 0;

            // 1. RRSP up to first bracket ceiling (cheapest tax room)
            if (stillNeed > 0 && balances.rrsp > 0 && rrspRoom > 0) {
                const maxGross = Math.min(rrspRoom, balances.rrsp);
                const taxIfMax = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + maxGross, province, taxOpts
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province, taxOpts).total;
                const maxAfterTax = maxGross - taxIfMax;

                if (maxAfterTax >= stillNeed) {
                    fromRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome, province, balances.rrsp, taxOpts);
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
                    cumulativeTaxableIncome + extraGross, province, taxOpts
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province, taxOpts).total;
                const extraAfterTax = extraGross - taxOnExtra;
                
                if (extraAfterTax >= stillNeed) {
                    const additionalRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome, province, remaining, taxOpts);
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
                fromNonReg = this._withdrawNonReg(stillNeed, cumulativeTaxableIncome, province, balances.nonReg, taxOpts);
                const capitalGain = fromNonReg * 0.5;
                const taxOnNonReg = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + capitalGain, province, taxOpts
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province, taxOpts).total;
                cumulativeTaxableIncome += capitalGain;
                stillNeed -= (fromNonReg - taxOnNonReg);
            }

            // 3. More RRSP if still needed (above the ceiling, still better than burning TFSA)
            if (stillNeed > 0 && balances.rrsp > fromRRSP) {
                const remainingRRSP = balances.rrsp - fromRRSP;
                const additionalRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome, province, remainingRRSP, taxOpts);
                const taxOnAdditional = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + additionalRRSP, province, taxOpts
                ).total - CanadianTax.calculateTax(cumulativeTaxableIncome, province, taxOpts).total;
                const afterTaxAdditional = additionalRRSP - taxOnAdditional;
                fromRRSP += additionalRRSP;
                cumulativeTaxableIncome += additionalRRSP;
                stillNeed = Math.max(0, stillNeed - afterTaxAdditional);
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
                    cumulativeTaxableIncome + maxRRSPGross + oasForTax, province, taxOpts
                ).total - CanadianTax.calculateTax(
                    cumulativeTaxableIncome + oasForTax, province, taxOpts
                ).total;
                const maxAfterTax = maxRRSPGross - taxIfMaxRRSP;

                if (maxAfterTax >= stillNeed) {
                    fromRRSP = this._binarySearchGross(stillNeed, cumulativeTaxableIncome + oasForTax, province, balances.rrsp, taxOpts);
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
                fromNonReg = this._withdrawNonReg(stillNeed, cumulativeTaxableIncome + oasForTax, province, balances.nonReg, taxOpts);
                const capitalGain = fromNonReg * 0.5;
                const taxOnNonReg = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + capitalGain + oasForTax, province, taxOpts
                ).total - CanadianTax.calculateTax(
                    cumulativeTaxableIncome + oasForTax, province, taxOpts
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
                    stillNeed, cumulativeTaxableIncome + oasForTax, province, remainingRRSP, taxOpts
                );
                const taxOnAdditional = CanadianTax.calculateTax(
                    cumulativeTaxableIncome + oasForTax + additionalRRSP, province, taxOpts
                ).total - CanadianTax.calculateTax(
                    cumulativeTaxableIncome + oasForTax, province, taxOpts
                ).total;
                const afterTaxAdditional = additionalRRSP - taxOnAdditional;
                fromRRSP += additionalRRSP;
                cumulativeTaxableIncome += additionalRRSP;
                stillNeed = Math.max(0, stillNeed - afterTaxAdditional);
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
        const seniorTaxOpts = currentAge >= 65 
            ? { age: currentAge, pensionIncome: eligiblePensionIncome, inflationFactor: cpi, dtc: hasDTC } 
            : { inflationFactor: cpi, dtc: hasDTC };

        let totalTax;
        if (!perPerson.isSingle && currentAge >= 65 && eligiblePensionIncome > 0) {
            const splitAmount = eligiblePensionIncome * 0.5;
            const p1Taxable = totalTaxableForCalc - splitAmount;
            const p2Taxable = splitAmount;
            const p1Tax = CanadianTax.calculateTax(Math.max(0, p1Taxable), province, { age: currentAge, pensionIncome: eligiblePensionIncome - splitAmount, inflationFactor: cpi, dtc: hasDTC }).total;
            const p2Tax = CanadianTax.calculateTax(p2Taxable, province, { age: currentAge, pensionIncome: splitAmount, inflationFactor: cpi, dtc: hasDTC }).total;
            const baseTax = CanadianTax.calculateTax(nonOASTaxableIncome, province, seniorTaxOpts).total;
            totalTax = (p1Tax + p2Tax) - baseTax;
        } else {
            totalTax = CanadianTax.calculateTax(totalTaxableForCalc, province, seniorTaxOpts).total -
                        CanadianTax.calculateTax(nonOASTaxableIncome, province, seniorTaxOpts).total;
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
    _withdrawNonReg(targetAfterTax, existingTaxable, province, maxAvailable, taxOpts) {
        let low = 0;
        let high = Math.min(targetAfterTax * 2, maxAvailable);
        let best = 0;
        
        for (let iter = 0; iter < 20; iter++) {
            const testAmount = (low + high) / 2;
            const capitalGain = testAmount * 0.5;
            const taxOnGain = CanadianTax.calculateTax(
                existingTaxable + capitalGain, province, taxOpts
            ).total - CanadianTax.calculateTax(existingTaxable, province, taxOpts).total;
            const afterTax = testAmount - taxOnGain;
            
            if (Math.abs(afterTax - targetAfterTax) < 10) { best = testAmount; break; }
            if (afterTax < targetAfterTax) low = testAmount;
            else high = testAmount;
            best = testAmount;
        }
        
        return Math.min(best, maxAvailable);
    },

    // Binary search for gross RRSP amount that yields targetAfterTax
    _binarySearchGross(targetAfterTax, existingTaxable, province, maxAvailable, taxOpts) {
        let low = targetAfterTax;
        let high = Math.min(targetAfterTax * 2.5, maxAvailable);
        let best = targetAfterTax * 1.4;
        
        for (let iter = 0; iter < 20; iter++) {
            const testAmount = (low + high) / 2;
            const taxOnAmount = CanadianTax.calculateTax(
                existingTaxable + testAmount, province, taxOpts
            ).total - CanadianTax.calculateTax(existingTaxable, province, taxOpts).total;
            
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
    /**
     * @param {Object} inputs
     * @param {Object} options
     * @param {boolean} options.includeSplitOptimization - if true, run Phase 3 (contribution split)
     * @param {number} options.marginalRate - user's marginal tax rate for RRSP refund adjustment (0-1)
     */
    optimizePlan(inputs, options = {}) {
        const { includeSplitOptimization = false, marginalRate = 0 } = options;
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

        // Phase 3: Test contribution split variations (only when requested)
        let bestSplit = inputs.contributionSplit;
        if (includeSplitOptimization) {
            const splitCandidates = [
                { rrsp: 0.70, tfsa: 0.20, nonReg: 0.10 }, // RRSP-heavy (max deductions)
                { rrsp: 0.20, tfsa: 0.60, nonReg: 0.20 }, // TFSA-heavy (GIS-friendly)
                { rrsp: 0.50, tfsa: 0.30, nonReg: 0.20 }, // Balanced (default)
                { rrsp: 0.40, tfsa: 0.40, nonReg: 0.20 }, // Even split
                { rrsp: 0.30, tfsa: 0.50, nonReg: 0.20 }, // Lean TFSA
                { rrsp: 0.60, tfsa: 0.30, nonReg: 0.10 }, // Lean RRSP
            ];
            for (const split of splitCandidates) {
                try {
                    // Adjust contribution for RRSP refund loss:
                    // If shifting away from RRSP, you lose the tax refund on those dollars
                    const userRRSPShare = inputs.contributionSplit?.rrsp || 0;
                    const newRRSPShare = split.rrsp;
                    let adjustedContribution = inputs.monthlyContribution;
                    if (marginalRate > 0 && newRRSPShare < userRRSPShare) {
                        const rrspDollarLoss = inputs.monthlyContribution * (userRRSPShare - newRRSPShare);
                        const refundLoss = rrspDollarLoss * marginalRate;
                        adjustedContribution = inputs.monthlyContribution - refundLoss;
                    }

                    const overrides = {
                        cppStartAge: bestParams.cppAge, oasStartAge: bestParams.oasAge,
                        cppStartAgeP2: bestParams.cppAge, oasStartAgeP2: bestParams.oasAge,
                        _withdrawalStrategy: bestParams.strategy,
                        contributionSplit: split,
                        monthlyContribution: adjustedContribution
                    };
                    const maxSpend = findMaxSpend(overrides);
                    if (maxSpend > bestMaxSpend) {
                        bestMaxSpend = maxSpend;
                        bestParams = { ...bestParams, maxSpend, contributionSplit: split, adjustedContribution };
                        bestSplit = split;
                    }
                } catch(e) {}
            }
        }
        if (!bestParams.contributionSplit) bestParams.contributionSplit = bestSplit;

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
            _withdrawalStrategy: bestParams.strategy,
            contributionSplit: bestParams.contributionSplit || inputs.contributionSplit
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
    // A competent advisor does bracket-filling RRSP meltdown, but conservatively:
    // - Fill up to first bracket ceiling ($55,867) from RRSP (cheap 15% federal rate)
    // - For large RRSPs (>$300K), also fill to OAS clawback threshold
    // - Use TFSA for remaining spending need
    // - Standard CPP/OAS at 65 timing
    // This is realistic — not a strawman. The difference vs "optimized" is timing
    // (CPP/OAS age) and meltdown aggressiveness, not basic competence.
    _withdrawNaive(balances, neededAfterTax, province, taxableIncome, age, cpiFromToday, dtcFlag) {
        let stillNeed = neededAfterTax;
        let fromRRSP = 0, fromNonReg = 0, fromTFSA = 0, fromOther = 0, fromCash = 0, fromLIRA = 0;
        let cumTaxable = taxableIncome;
        const cpi = cpiFromToday || 1.0;
        const taxOpts = { inflationFactor: cpi, dtc: dtcFlag };
        
        const FIRST_BRACKET_CEILING = 55867 * cpi;
        const OAS_CLAWBACK_START = 93454 * cpi;
        
        // 1. RRSP bracket-filling: pull up to first bracket ceiling (15% federal rate)
        // A good advisor always uses cheap tax room
        const rrspTarget = balances.rrsp > 300000 * cpi 
            ? OAS_CLAWBACK_START  // Large RRSP: fill to clawback threshold to prevent RRIF bomb
            : FIRST_BRACKET_CEILING; // Normal: fill first bracket
        const rrspRoom = Math.max(0, rrspTarget - cumTaxable);
        
        if (balances.rrsp > 0 && rrspRoom > 0) {
            const maxGross = Math.min(rrspRoom, balances.rrsp);
            const taxIfMax = CanadianTax.calculateTax(cumTaxable + maxGross, province, taxOpts).total
                - CanadianTax.calculateTax(cumTaxable, province, taxOpts).total;
            const maxAfterTax = maxGross - taxIfMax;
            
            if (stillNeed > 0 && maxAfterTax >= stillNeed) {
                fromRRSP = this._binarySearchGross(stillNeed, cumTaxable, province, balances.rrsp, taxOpts);
                cumTaxable += fromRRSP;
                stillNeed = 0;
            } else {
                fromRRSP = maxGross;
                cumTaxable += fromRRSP;
                if (stillNeed > 0) stillNeed -= maxAfterTax;
            }
        }
        
        // 2. TFSA for remaining spending need
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
            const taxOnNR = CanadianTax.calculateTax(cumTaxable + capGain, province, taxOpts).total
                - CanadianTax.calculateTax(cumTaxable, province, taxOpts).total;
            cumTaxable += capGain;
            stillNeed -= (fromNonReg - taxOnNR);
        }
        
        // 5. More RRSP if still needed
        if (stillNeed > 0 && balances.rrsp > fromRRSP) {
            const moreRRSP = this._binarySearchGross(stillNeed, cumTaxable, province, balances.rrsp - fromRRSP, taxOpts);
            fromRRSP += moreRRSP;
            const taxOnMore = CanadianTax.calculateTax(cumTaxable + moreRRSP, province, taxOpts).total
                - CanadianTax.calculateTax(cumTaxable, province, taxOpts).total;
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
        const finalTaxOpts = age >= 65 
            ? { age, pensionIncome: fromRRSP + fromLIRA, inflationFactor: cpi, dtc: dtcFlag } 
            : { inflationFactor: cpi, dtc: dtcFlag };
        const totalTax = CanadianTax.calculateTax(cumTaxable, province, finalTaxOpts).total 
            - CanadianTax.calculateTax(taxableIncome, province, finalTaxOpts).total;
        
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

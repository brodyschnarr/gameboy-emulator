// ═══════════════════════════════════════════
//  Monte Carlo Simulation Engine V2
//  Now uses tax-optimized withdrawal (same as deterministic calc)
//  + CPP/OAS inflation indexing + OAS clawback + contribution growth
// ═══════════════════════════════════════════

const MonteCarloSimulator = {
    
    simulate(baseInputs, options = {}) {
        const {
            iterations = 1000,
            volatility = 0.11,
            marketCrashProbability = 0.04,
            sequenceOfReturnsRisk = true
        } = options;
        
        console.log(`[MonteCarloSimulator] Running ${iterations} simulations...`);
        const startTime = Date.now();
        
        const results = [];
        
        for (let i = 0; i < iterations; i++) {
            const randomReturns = this._generateReturnSequence(
                baseInputs.currentAge,
                baseInputs.lifeExpectancy,
                baseInputs.returnRate,
                volatility,
                marketCrashProbability
            );
            
            const result = this._runSingleSimulation({
                ...baseInputs,
                returnSequence: randomReturns,
                simulationRun: true
            });
            results.push(result);
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`[MonteCarloSimulator] Completed ${iterations} simulations in ${elapsed}ms`);
        
        return this._analyzeResults(results, baseInputs);
    },
    
    _generateReturnSequence(startAge, endAge, expectedReturn, volatility, crashProb) {
        const sequence = [];
        const years = endAge - startAge + 1;
        
        for (let year = 0; year < years; year++) {
            const u1 = Math.random();
            const u2 = Math.random();
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            
            let annualReturn = (expectedReturn / 100) + (z * volatility);
            
            if (Math.random() < crashProb) {
                annualReturn = -0.20 + (Math.random() * 0.10);
            }
            
            sequence.push(annualReturn);
        }
        
        return sequence;
    },
    
    _runSingleSimulation(inputs) {
        const {
            currentAge,
            partnerAge,
            retirementAge,
            lifeExpectancy,
            province,
            familyStatus,
            currentIncome,
            income1,
            income2,
            rrsp,
            tfsa,
            nonReg,
            other,
            monthlyContribution,
            contributionSplit,
            contributionGrowthRate = 0,
            annualSpending,
            spendingCurve = 'flat',
            healthStatus,
            currentDebt,
            debtPayoffAge,
            cppStartAge,
            cppStartAgeP2,
            cppOverride,
            cppOverrideP2,
            oasStartAge = 65,
            oasStartAgeP2,
            additionalIncomeSources,
            windfalls = [],
            returnSequence,
            inflationRate,
            merFee = 0,
            healthcareInflation = 5,
            ltcMonthly = 0,
            ltcStartAge = 80,
            annuityLumpSum = 0,
            annuityPurchaseAge,
            annuityMonthlyPayout = 0,
            dtc = false,
            downsizingAge,
            downsizingProceeds = 0,
            downsizingSpendingChange = 0
        } = inputs;
        
        const merDecimal = (merFee || 0) / 100;
        const yearsToRetirement = retirementAge - currentAge;
        const isSingle = familyStatus === 'single';
        
        // Sanitize income (NaN from empty form fields)
        const safeIncome = (!currentIncome || isNaN(currentIncome)) ? 70000 : currentIncome;
        const safeIncome1 = !isSingle ? ((!income1 || isNaN(income1)) ? safeIncome : income1) : safeIncome;
        const safeIncome2 = !isSingle ? ((!income2 || isNaN(income2)) ? 0 : income2) : 0;
        
        // Normalize split (FIX #8)
        const normalizedSplit = RetirementCalcV4._normalizeSplit(contributionSplit);

        // Calculate government benefits
        const p1ContribYears = Math.min(retirementAge - 18, 39);
        const p2ContribYears = (!isSingle && partnerAge)
            ? Math.min(retirementAge - (18 + (currentAge - partnerAge)), 39)
            : p1ContribYears;

        const govBenefits = RetirementCalcV4._calculateGovernmentBenefits({
            income1: safeIncome1,
            income2: safeIncome2,
            retirementAge,
            cppStartAge: cppStartAge || 65,
            cppStartAgeP2: cppStartAgeP2 || cppStartAge || 65,
            isSingle,
            p1ContribYears,
            p2ContribYears,
            oasStartAge: oasStartAge || 65,
            oasStartAgeP2: oasStartAgeP2 || oasStartAge || 65,
            cppOverride: cppOverride || null,
            cppOverrideP2: cppOverrideP2 || null
        });
        
        // Healthcare costs — skip if user's spending already includes healthcare
        const skipHealthcare = (healthStatus === 'none');
        const ltcOpts = ltcMonthly > 0 ? { monthlyAmount: ltcMonthly, startAge: ltcStartAge || 80 } : null;
        const healthcareCosts = skipHealthcare
            ? { total: 0, averageAnnual: 0, byYear: [], breakdown: { prescriptions: 0, dental: 0, vision: 0, other: 0 } }
            : HealthcareEstimator.projectTotal(
                retirementAge,
                lifeExpectancy,
                province,
                healthStatus || 'average',
                (healthcareInflation || 5) / 100,
                ltcOpts
            );
        
        // Inflation-adjusted spending at retirement
        const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsToRetirement);
        const futureAnnualSpending = annualSpending * inflationMultiplier;
        
        const projection = [];
        let balances = {
            rrsp: rrsp || 0,
            tfsa: tfsa || 0,
            nonReg: nonReg || 0,
            other: other || 0,
            cash: inputs.cash || 0
        };
        const CASH_RATE = 0.015;
        let debt = currentDebt || 0;
        const inf = inflationRate / 100;
        const contribGrowth = (contributionGrowthRate || 0) / 100;
        const effOAS1 = oasStartAge || 65;
        const effOAS2 = oasStartAgeP2 || effOAS1;
        
        for (let age = currentAge; age <= lifeExpectancy; age++) {
            const yearIndex = age - currentAge;
            const isRetired = age >= retirementAge;
            const returnRate = (returnSequence[yearIndex] || 0) - merDecimal;
            
            const yearData = {
                age,
                phase: isRetired ? 'retirement' : 'accumulation',
                returnRate: returnRate * 100
            };
            
            // Windfalls (V2: supports simple, shares, uncertain types)
            if (windfalls && windfalls.length > 0 && typeof WindfallManager !== 'undefined') {
                windfalls.forEach(windfall => {
                    const resolved = WindfallManager._resolveWindfall(windfall, { currentAge, lifeExpectancy }, true);
                    if (!resolved || resolved.age !== age) return;
                    
                    let afterTaxAmount = resolved.amount;
                    if (windfall.taxable) {
                        if (windfall.type === 'shares') {
                            // Capital gains: only gain at 50% inclusion
                            const costBasis = windfall.currentValue || (resolved.amount * 0.5);
                            const gain = Math.max(0, resolved.amount - costBasis);
                            const taxableGain = gain * 0.5;
                            afterTaxAmount = resolved.amount - (taxableGain * 0.30);
                        } else {
                            afterTaxAmount = resolved.amount * 0.7;
                        }
                    }
                    
                    if (windfall.destination === 'rrsp') balances.rrsp += afterTaxAmount;
                    else if (windfall.destination === 'tfsa') balances.tfsa += afterTaxAmount;
                    else if (windfall.destination === 'nonReg') balances.nonReg += afterTaxAmount;
                    else {
                        balances.tfsa += afterTaxAmount * 0.5;
                        balances.nonReg += afterTaxAmount * 0.5;
                    }
                    
                    yearData.windfall = { name: windfall.name, amount: afterTaxAmount };
                });
            } else if (windfalls && windfalls.length > 0) {
                // Fallback: legacy simple windfall handling
                windfalls.forEach(windfall => {
                    const targetAge = windfall.year || (currentAge + (windfall.yearsFromNow || 0));
                    if (targetAge !== age) return;
                    if (Math.random() * 100 > (windfall.probability || 100)) return;
                    
                    const afterTaxAmount = windfall.taxable ? windfall.amount * 0.7 : windfall.amount;
                    if (windfall.destination === 'rrsp') balances.rrsp += afterTaxAmount;
                    else if (windfall.destination === 'tfsa') balances.tfsa += afterTaxAmount;
                    else if (windfall.destination === 'nonReg') balances.nonReg += afterTaxAmount;
                    else { balances.tfsa += afterTaxAmount * 0.5; balances.nonReg += afterTaxAmount * 0.5; }
                    yearData.windfall = { name: windfall.name, amount: afterTaxAmount };
                });
            }
            
            if (!isRetired) {
                // ACCUMULATION PHASE
                // FIX #6: Growing contributions
                const yearsFromStart = age - currentAge;
                const growthFactor = Math.pow(1 + contribGrowth, yearsFromStart);
                const thisYearContrib = monthlyContribution * 12 * growthFactor;

                balances.rrsp += thisYearContrib * (normalizedSplit.rrsp || 0);
                balances.tfsa += thisYearContrib * (normalizedSplit.tfsa || 0);
                balances.nonReg += thisYearContrib * (normalizedSplit.nonReg || 0);
                
                balances.rrsp *= (1 + returnRate);
                balances.tfsa *= (1 + returnRate);
                balances.nonReg *= (1 + returnRate);
                balances.other *= (1 + returnRate);
                balances.cash *= (1 + CASH_RATE);
                
                if (debt > 0 && age < debtPayoffAge) {
                    const yearsLeft = debtPayoffAge - age;
                    const annualPayment = debt / yearsLeft;
                    debt = Math.max(0, debt - annualPayment);
                    yearData.debtPayment = annualPayment;
                }
                yearData.debt = debt;
            } else {
                // RETIREMENT PHASE
                balances.rrsp *= (1 + returnRate);
                balances.tfsa *= (1 + returnRate);
                balances.nonReg *= (1 + returnRate);
                balances.other *= (1 + returnRate);
                balances.cash *= (1 + CASH_RATE);
                
                const yearsIntoRetirement = age - retirementAge;
                const inflationFactor = Math.pow(1 + inf, yearsIntoRetirement);
                const cpiFromToday = Math.pow(1 + inf, age - currentAge);
                // Spending curve multiplier
                let spendingCurveMultiplier = 1.0;
                if (spendingCurve === 'frontloaded') {
                    const yrsRetired = age - retirementAge;
                    if (yrsRetired < 10) spendingCurveMultiplier = 1.20;
                    else if (yrsRetired < 20) spendingCurveMultiplier = 1.0;
                    else spendingCurveMultiplier = 0.80;
                }
                const thisYearSpending = futureAnnualSpending * inflationFactor * spendingCurveMultiplier;
                
                const healthcareCost = healthcareCosts.byYear.find(h => h.age === age)?.cost || 0;
                // cpiFromToday already defined above (line 268)

                // Downsizing
                if (downsizingAge && age === downsizingAge && downsizingProceeds > 0) {
                    const tfsaRoom = Math.max(0, 95000 - balances.tfsa);
                    balances.tfsa += Math.min(downsizingProceeds, tfsaRoom);
                    balances.nonReg += Math.max(0, downsizingProceeds - tfsaRoom);
                }
                let downsizingAdj = (downsizingAge && age >= downsizingAge) ? (downsizingSpendingChange * 12 * cpiFromToday) : 0;
                const totalNeed = Math.max(0, thisYearSpending + healthcareCost + downsizingAdj);

                // Annuity purchase
                if (annuityLumpSum > 0 && age === (annuityPurchaseAge || retirementAge)) {
                    const totalBal = balances.rrsp + balances.tfsa + balances.nonReg + balances.other + balances.cash;
                    if (totalBal > 0) {
                        const ratio = Math.min(1, annuityLumpSum / totalBal);
                        balances.rrsp *= (1 - ratio); balances.tfsa *= (1 - ratio);
                        balances.nonReg *= (1 - ratio); balances.other *= (1 - ratio); balances.cash *= (1 - ratio);
                    }
                }
                const annuityPayout = (annuityMonthlyPayout > 0 && age >= (annuityPurchaseAge || retirementAge)) ? annuityMonthlyPayout * 12 * cpiFromToday : 0;
                const rentalIncomeYr = 0; // Rental now flows through additionalIncomeSources
                
                let cppP1 = 0, cppP2 = 0;
                if (age >= (cppStartAge || 65)) {
                    cppP1 = govBenefits.cpp1 * cpiFromToday;
                }
                if (!isSingle && age >= (cppStartAgeP2 || cppStartAge || 65)) {
                    cppP2 = govBenefits.cpp2 * cpiFromToday;
                }
                const cppIncome = cppP1 + cppP2;
                
                // FIX #3: OAS with deferral (per-person for clawback)
                let oasP1 = 0, oasP2 = 0;
                if (age >= effOAS1) {
                    oasP1 = (govBenefits.oasPerPerson1 || govBenefits.oasPerPerson) * cpiFromToday;
                }
                if (!isSingle && age >= effOAS2) {
                    oasP2 = (govBenefits.oasPerPerson2 || govBenefits.oasPerPerson) * cpiFromToday;
                }
                const oasIncome = oasP1 + oasP2;
                
                const additionalIncome = (additionalIncomeSources || [])
                    .filter(s => {
                        if (age < s.startAge) return false;
                        if (s.endAge !== null && age > s.endAge) return false;
                        if (age >= retirementAge && s.continuesInRetirement === false) return false;
                        return true;
                    })
                    .reduce((sum, s) => sum + (s.indexed ? s.annualAmount * cpiFromToday : s.annualAmount), 0);
                
                // GIS pre-estimate — account for taxable withdrawals
                let gisEstimateMC = 0;
                if (age >= effOAS1) {
                    const GIS_MAX_SINGLE_MC = 12780;
                    const GIS_MAX_COUPLE_MC = 7692;
                    const gisMaxMC = isSingle ? GIS_MAX_SINGLE_MC : GIS_MAX_COUPLE_MC * 2;
                    const gisTestPre = cppIncome + additionalIncome + rentalIncomeYr + annuityPayout * 0.5;
                    
                    const hasTaxable = (balances.rrsp > 0 || balances.nonReg > 0);
                    if (hasTaxable) {
                        const roughNeed = Math.max(0, totalNeed - cppIncome - oasIncome - additionalIncome);
                        const estTaxable = Math.min(roughNeed, balances.rrsp + balances.nonReg);
                        const nonRegPart = Math.min(estTaxable, balances.nonReg);
                        const rrspPart = estTaxable - nonRegPart;
                        const estGISTest = gisTestPre + rrspPart + nonRegPart * 0.5;
                        gisEstimateMC = Math.max(0, gisMaxMC - estGISTest * 0.5) * cpiFromToday;
                    } else {
                        gisEstimateMC = Math.max(0, gisMaxMC - gisTestPre * 0.5) * cpiFromToday;
                    }
                }

                const totalOtherIncome = cppIncome + oasIncome + additionalIncome + gisEstimateMC + rentalIncomeYr + annuityPayout;
                const neededFromPortfolio = Math.max(0, totalNeed - totalOtherIncome);
                
                let withdrawal = RetirementCalcV4._withdrawSmartOptimal(
                    balances,
                    neededFromPortfolio,
                    province,
                    cppIncome + additionalIncome + rentalIncomeYr,
                    oasIncome,
                    age >= effOAS1,
                    { cppP1, cppP2, oasP1, oasP2, additionalIncome: additionalIncome + rentalIncomeYr, isSingle, age, cpiFromToday, dtc }
                );
                
                // Pass 2: check if GIS was overestimated, compensate from TFSA
                if (age >= effOAS1) {
                    const gisMax2 = isSingle ? 12780 : 7692 * 2;
                    const gisTestPost = cppIncome + (withdrawal.fromRRSP || 0) + (withdrawal.fromOther || 0)
                        + additionalIncome + ((withdrawal.fromNonReg || 0) * 0.5);
                    const gisActual = Math.max(0, gisMax2 - gisTestPost * 0.5) * cpiFromToday;
                    const shortfall = gisEstimateMC - gisActual;
                    if (shortfall > 100) {
                        const remainTFSA = Math.max(0, balances.tfsa - withdrawal.fromTFSA);
                        const extra = Math.min(shortfall, remainTFSA);
                        withdrawal = { ...withdrawal, fromTFSA: withdrawal.fromTFSA + extra, total: withdrawal.total + extra };
                    }
                }
                
                balances.tfsa = Math.max(0, balances.tfsa - withdrawal.fromTFSA);
                balances.nonReg = Math.max(0, balances.nonReg - withdrawal.fromNonReg);
                balances.rrsp = Math.max(0, balances.rrsp - withdrawal.fromRRSP);
                balances.other = Math.max(0, balances.other - withdrawal.fromOther);
                balances.cash = Math.max(0, balances.cash - (withdrawal.fromCash || 0));
                
                const actualOAS = withdrawal.actualOAS !== undefined ? withdrawal.actualOAS : oasIncome;
                
                // GIS for low-income OAS recipients (post-withdrawal estimate)
                let gisIncome = 0;
                if (age >= effOAS1) {
                    const GIS_MAX_SINGLE = 12780;
                    const GIS_MAX_COUPLE = 7692;
                    const gisMax = isSingle ? GIS_MAX_SINGLE : GIS_MAX_COUPLE * 2;
                    const gisTestIncome = cppIncome + (withdrawal.fromRRSP || 0) + (withdrawal.fromOther || 0)
                        + ((withdrawal.fromNonReg || 0) * 0.5) + additionalIncome;
                    const gisClawback = gisTestIncome * 0.50;
                    gisIncome = Math.max(0, gisMax - gisClawback) * cpiFromToday;
                }
                
                yearData.withdrawal = withdrawal.total;
                yearData.withdrawalBreakdown = {
                    tfsa: withdrawal.fromTFSA,
                    nonReg: withdrawal.fromNonReg,
                    rrsp: withdrawal.fromRRSP,
                    other: withdrawal.fromOther,
                    cash: withdrawal.fromCash || 0
                };
                yearData.targetSpending = thisYearSpending;
                yearData.healthcareCost = healthcareCost;
                yearData.governmentIncome = Math.round(cppIncome + actualOAS + gisIncome);
                yearData.gisReceived = Math.round(gisIncome);
                yearData.oasReceived = Math.round(actualOAS);
                yearData.taxableIncome = withdrawal.taxableIncome;
                yearData.taxPaid = withdrawal.taxPaid;
            }
            
            yearData.totalBalance = balances.rrsp + balances.tfsa + balances.nonReg + balances.other + balances.cash;
            yearData.balances = { ...balances };
            
            projection.push(yearData);
        }
        
        const runsOutYear = projection.find(p => p.totalBalance <= 0);
        const moneyLastsAge = runsOutYear ? runsOutYear.age : lifeExpectancy;
        const retirementYear = projection.find(p => p.age === retirementAge);
        const portfolioAtRetirement = retirementYear ? retirementYear.totalBalance : 0;
        const finalYear = projection[projection.length - 1];
        const finalBalance = finalYear ? finalYear.totalBalance : 0;
        
        return {
            moneyLastsAge,
            portfolioAtRetirement,
            finalBalance,
            success: moneyLastsAge >= lifeExpectancy,
            projection
        };
    },
    
    _buildPerYearPercentiles(results, p10Run, p50Run, p90Run) {
        // Build per-year percentile projections across ALL simulations
        // Instead of picking a single run (which can have windfall randomness),
        // compute the 10th/50th/90th percentile of totalBalance at each age.
        const numYears = p50Run.projection.length;
        const p10Proj = [];
        const p50Proj = [];
        const p90Proj = [];

        for (let i = 0; i < numYears; i++) {
            const age = p50Run.projection[i].age;
            // Collect all balances at this year index
            const balancesAtYear = [];
            for (let r = 0; r < results.length; r++) {
                if (results[r].projection[i]) {
                    balancesAtYear.push(results[r].projection[i].totalBalance || 0);
                }
            }
            balancesAtYear.sort((a, b) => a - b);

            const getP = (pct) => {
                const idx = Math.min(Math.floor(balancesAtYear.length * pct), balancesAtYear.length - 1);
                return balancesAtYear[idx];
            };

            p10Proj.push({ age, totalBalance: getP(0.10) });
            p50Proj.push({ age, totalBalance: getP(0.50) });
            p90Proj.push({ age, totalBalance: getP(0.90) });
        }

        return {
            p10: {
                moneyLastsAge: p10Run.moneyLastsAge,
                finalBalance: Math.round(p10Run.finalBalance),
                projection: p10Proj
            },
            p50: {
                moneyLastsAge: p50Run.moneyLastsAge,
                finalBalance: Math.round(p50Run.finalBalance),
                projection: p50Proj
            },
            p90: {
                moneyLastsAge: p90Run.moneyLastsAge,
                finalBalance: Math.round(p90Run.finalBalance),
                projection: p90Proj
            }
        };
    },

    _analyzeResults(results, baseInputs) {
        const { lifeExpectancy } = baseInputs;
        
        results.sort((a, b) => a.finalBalance - b.finalBalance);
        
        const getPercentile = (pct) => {
            const index = Math.floor(results.length * pct);
            return results[Math.min(index, results.length - 1)];
        };
        
        const p10 = getPercentile(0.10);
        const p25 = getPercentile(0.25);
        const p50 = getPercentile(0.50);
        const p75 = getPercentile(0.75);
        const p90 = getPercentile(0.90);
        
        const successfulRuns = results.filter(r => r.success).length;
        const successRate = (successfulRuns / results.length) * 100;
        
        const portfoliosAtRetirement = results.map(r => r.portfolioAtRetirement).sort((a, b) => a - b);
        const portfolioP10 = portfoliosAtRetirement[Math.floor(portfoliosAtRetirement.length * 0.10)];
        const portfolioP50 = portfoliosAtRetirement[Math.floor(portfoliosAtRetirement.length * 0.50)];
        const portfolioP90 = portfoliosAtRetirement[Math.floor(portfoliosAtRetirement.length * 0.90)];
        
        const moneyLastsAges = results.map(r => r.moneyLastsAge).sort((a, b) => a - b);
        const ageP10 = moneyLastsAges[Math.floor(moneyLastsAges.length * 0.10)];
        const ageP50 = moneyLastsAges[Math.floor(moneyLastsAges.length * 0.50)];
        const ageP90 = moneyLastsAges[Math.floor(moneyLastsAges.length * 0.90)];
        
        const averageFinalBalance = results.reduce((sum, r) => sum + r.finalBalance, 0) / results.length;
        const worstCase = results[0];
        const bestCase = results[results.length - 1];
        
        // Successful runs percentiles (more meaningful than all-runs)
        const successfulResults = results.filter(r => r.success);
        const successP50Balance = successfulResults.length > 0
            ? successfulResults[Math.floor(successfulResults.length * 0.5)].finalBalance
            : 0;
        
        return {
            successRate: Math.round(successRate),
            totalRuns: results.length,
            successfulRuns,
            successP50Balance: Math.round(successP50Balance),
            
            finalBalance: {
                p10: Math.round(p10.finalBalance),
                p25: Math.round(p25.finalBalance),
                p50: Math.round(p50.finalBalance),
                p75: Math.round(p75.finalBalance),
                p90: Math.round(p90.finalBalance),
                average: Math.round(averageFinalBalance),
                worst: Math.round(worstCase.finalBalance),
                best: Math.round(bestCase.finalBalance)
            },
            
            portfolioAtRetirement: {
                p10: Math.round(portfolioP10),
                p50: Math.round(portfolioP50),
                p90: Math.round(portfolioP90)
            },
            
            moneyLastsAge: {
                p10: ageP10,
                p50: ageP50,
                p90: ageP90,
                worst: moneyLastsAges[0],
                best: moneyLastsAges[moneyLastsAges.length - 1]
            },
            
            percentiles: this._buildPerYearPercentiles(results, p10, p50, p90),
            
            worstCase: {
                moneyLastsAge: worstCase.moneyLastsAge,
                finalBalance: Math.round(worstCase.finalBalance),
                projection: worstCase.projection
            },
            
            bestCase: {
                moneyLastsAge: bestCase.moneyLastsAge,
                finalBalance: Math.round(bestCase.finalBalance),
                projection: bestCase.projection
            },
            
            allResults: results
        };
    },
    
    analyzeSequenceRisk(baseInputs) {
        console.log('[MonteCarloSimulator] Analyzing sequence of returns risk...');
        
        const bullThenBear = this._generateBullBearSequence(
            baseInputs.currentAge, baseInputs.lifeExpectancy, baseInputs.returnRate, 'bull-then-bear'
        );
        const bearThenBull = this._generateBullBearSequence(
            baseInputs.currentAge, baseInputs.lifeExpectancy, baseInputs.returnRate, 'bear-then-bull'
        );
        
        const result1 = this._runSingleSimulation({
            ...baseInputs, returnSequence: bullThenBear, simulationRun: true
        });
        const result2 = this._runSingleSimulation({
            ...baseInputs, returnSequence: bearThenBull, simulationRun: true
        });
        
        return {
            bullThenBear: {
                moneyLastsAge: result1.moneyLastsAge,
                finalBalance: result1.finalBalance,
                portfolioAtRetirement: result1.portfolioAtRetirement
            },
            bearThenBull: {
                moneyLastsAge: result2.moneyLastsAge,
                finalBalance: result2.finalBalance,
                portfolioAtRetirement: result2.portfolioAtRetirement
            },
            difference: {
                agesDifference: result1.moneyLastsAge - result2.moneyLastsAge,
                balanceDifference: result1.finalBalance - result2.finalBalance,
                sequenceMatters: Math.abs(result1.finalBalance - result2.finalBalance) > 100000
            }
        };
    },
    
    _generateBullBearSequence(startAge, endAge, expectedReturn, pattern) {
        const years = endAge - startAge + 1;
        const sequence = [];
        const halfYears = Math.floor(years / 2);
        
        for (let i = 0; i < years; i++) {
            let r;
            if (pattern === 'bull-then-bear') {
                r = i < halfYears ? (expectedReturn / 100) + 0.05 : (expectedReturn / 100) - 0.05;
            } else {
                r = i < halfYears ? (expectedReturn / 100) - 0.05 : (expectedReturn / 100) + 0.05;
            }
            sequence.push(r);
        }
        
        return sequence;
    }
};

console.log('[MonteCarloSimulator] Module loaded');

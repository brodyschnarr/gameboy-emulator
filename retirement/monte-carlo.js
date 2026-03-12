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
            merFee = 0
        } = inputs;
        
        const merDecimal = (merFee || 0) / 100;
        const yearsToRetirement = retirementAge - currentAge;
        const isSingle = familyStatus === 'single';
        
        // Normalize split (FIX #8)
        const normalizedSplit = RetirementCalcV4._normalizeSplit(contributionSplit);

        // Calculate government benefits
        const p1ContribYears = Math.min(retirementAge - 18, 39);
        const p2ContribYears = (!isSingle && partnerAge)
            ? Math.min(retirementAge - (18 + (currentAge - partnerAge)), 39)
            : p1ContribYears;

        const govBenefits = RetirementCalcV4._calculateGovernmentBenefits({
            income1: isSingle ? currentIncome : income1,
            income2: isSingle ? 0 : income2,
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
        
        // Healthcare costs
        const healthcareCosts = HealthcareEstimator.projectTotal(
            retirementAge,
            lifeExpectancy,
            province,
            healthStatus || 'average'
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
            
            // Windfalls
            if (windfalls && windfalls.length > 0) {
                const applicableWindfalls = windfalls.filter(w => {
                    const targetAge = w.year || (currentAge + w.yearsFromNow);
                    return targetAge === age;
                });
                
                applicableWindfalls.forEach(windfall => {
                    const occurs = Math.random() * 100 <= windfall.probability;
                    if (occurs) {
                        const afterTaxAmount = windfall.taxable
                            ? windfall.amount * 0.7
                            : windfall.amount;
                        
                        if (windfall.destination === 'rrsp') balances.rrsp += afterTaxAmount;
                        else if (windfall.destination === 'tfsa') balances.tfsa += afterTaxAmount;
                        else if (windfall.destination === 'nonReg') balances.nonReg += afterTaxAmount;
                        else {
                            balances.tfsa += afterTaxAmount * 0.5;
                            balances.nonReg += afterTaxAmount * 0.5;
                        }
                        
                        yearData.windfall = { name: windfall.name, amount: afterTaxAmount };
                    }
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
                const thisYearSpending = futureAnnualSpending * inflationFactor;
                
                const healthcareCost = healthcareCosts.byYear.find(h => h.age === age)?.cost || 0;
                const totalNeed = thisYearSpending + healthcareCost;
                
                // FIX #2: CPP inflation-indexed
                const cpiFromRetirement = Math.pow(1 + inf, yearsIntoRetirement);
                
                let cppP1 = 0, cppP2 = 0;
                if (age >= (cppStartAge || 65)) {
                    cppP1 = govBenefits.cpp1 * cpiFromRetirement;
                }
                if (!isSingle && age >= (cppStartAgeP2 || cppStartAge || 65)) {
                    cppP2 = govBenefits.cpp2 * cpiFromRetirement;
                }
                const cppIncome = cppP1 + cppP2;
                
                // FIX #3: OAS with deferral (per-person for clawback)
                let oasP1 = 0, oasP2 = 0;
                if (age >= effOAS1) {
                    oasP1 = (govBenefits.oasPerPerson1 || govBenefits.oasPerPerson) * cpiFromRetirement;
                }
                if (!isSingle && age >= effOAS2) {
                    oasP2 = (govBenefits.oasPerPerson2 || govBenefits.oasPerPerson) * cpiFromRetirement;
                }
                const oasIncome = oasP1 + oasP2;
                
                const additionalIncome = (additionalIncomeSources || [])
                    .filter(s => age >= s.startAge && (s.endAge === null || age <= s.endAge))
                    .reduce((sum, s) => sum + s.annualAmount, 0);
                
                const totalOtherIncome = cppIncome + oasIncome + additionalIncome;
                const neededFromPortfolio = Math.max(0, totalNeed - totalOtherIncome);
                
                // FIX #7 & #9: Use same smart tax-optimized withdrawal as deterministic
                const withdrawal = RetirementCalcV4._withdrawSmartOptimal(
                    balances,
                    neededFromPortfolio,
                    province,
                    cppIncome + additionalIncome,
                    oasIncome,
                    age >= effOAS1,
                    { cppP1, cppP2, oasP1, oasP2, additionalIncome, isSingle }
                );
                
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
                    gisIncome = Math.max(0, gisMax - gisClawback) * cpiFromRetirement;
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
        
        return {
            successRate: Math.round(successRate),
            totalRuns: results.length,
            successfulRuns,
            
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
            
            percentiles: {
                p10: {
                    moneyLastsAge: p10.moneyLastsAge,
                    finalBalance: Math.round(p10.finalBalance),
                    projection: p10.projection
                },
                p50: {
                    moneyLastsAge: p50.moneyLastsAge,
                    finalBalance: Math.round(p50.finalBalance),
                    projection: p50.projection
                },
                p90: {
                    moneyLastsAge: p90.moneyLastsAge,
                    finalBalance: Math.round(p90.finalBalance),
                    projection: p90.projection
                }
            },
            
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

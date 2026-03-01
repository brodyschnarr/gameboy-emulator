// ═══════════════════════════════════════════
//  Monte Carlo Simulation Engine
//  Probabilistic retirement analysis with market volatility
// ═══════════════════════════════════════════

const MonteCarloSimulator = {
    
    /**
     * Run Monte Carlo simulation (1000 scenarios with random returns)
     * @param {Object} baseInputs - Same inputs as RetirementCalcV4.calculate
     * @param {Object} options - Simulation options
     * @returns {Object} - Simulation results with percentile distributions
     */
    simulate(baseInputs, options = {}) {
        const {
            iterations = 1000,
            volatility = 0.15, // 15% standard deviation (typical for 60/40 portfolio)
            marketCrashProbability = 0.10, // 10% chance of -20%+ year
            sequenceOfReturnsRisk = true
        } = options;
        
        console.log(`[MonteCarloSimulator] Running ${iterations} simulations...`);
        const startTime = Date.now();
        
        const results = [];
        
        for (let i = 0; i < iterations; i++) {
            // Generate random return sequence
            const randomReturns = this._generateReturnSequence(
                baseInputs.currentAge,
                baseInputs.lifeExpectancy,
                baseInputs.returnRate,
                volatility,
                marketCrashProbability
            );
            
            // Run simulation with this return sequence
            const simulationInputs = {
                ...baseInputs,
                returnSequence: randomReturns, // Pass to modified calc engine
                simulationRun: true
            };
            
            const result = this._runSingleSimulation(simulationInputs);
            results.push(result);
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`[MonteCarloSimulator] Completed ${iterations} simulations in ${elapsed}ms`);
        
        // Analyze results
        return this._analyzeResults(results, baseInputs);
    },
    
    /**
     * Generate random return sequence using normal distribution
     */
    _generateReturnSequence(startAge, endAge, expectedReturn, volatility, crashProb) {
        const sequence = [];
        const years = endAge - startAge + 1;
        
        for (let year = 0; year < years; year++) {
            // Box-Muller transform for normal distribution
            const u1 = Math.random();
            const u2 = Math.random();
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            
            // Return = expected + (random * volatility)
            let annualReturn = (expectedReturn / 100) + (z * volatility);
            
            // Occasional market crashes
            if (Math.random() < crashProb) {
                annualReturn = -0.20 + (Math.random() * 0.10); // -20% to -10%
            }
            
            sequence.push(annualReturn);
        }
        
        return sequence;
    },
    
    /**
     * Run single simulation with given inputs
     */
    _runSingleSimulation(inputs) {
        // Modified version of RetirementCalcV4 that uses returnSequence
        const {
            currentAge,
            partnerAge,
            retirementAge,
            lifeExpectancy,
            province,
            region,
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
            annualSpending,
            healthStatus,
            currentDebt,
            debtPayoffAge,
            cppStartAge,
            additionalIncomeSources,
            windfalls,
            returnSequence, // Array of annual returns
            inflationRate
        } = inputs;
        
        const yearsToRetirement = retirementAge - currentAge;
        
        // 1. Calculate government benefits (same as before)
        const isSingle = familyStatus === 'single';
        const govBenefits = RetirementCalcV4._calculateGovernmentBenefits({
            income1,
            income2,
            retirementAge,
            cppStartAge,
            isSingle
        });
        
        // 2. Healthcare costs (same as before)
        const healthcareCosts = HealthcareEstimator.projectTotal(
            retirementAge,
            lifeExpectancy,
            province,
            healthStatus || 'average'
        );
        
        // 3. Inflation-adjusted spending
        const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsToRetirement);
        const futureAnnualSpending = annualSpending * inflationMultiplier;
        
        // 4. Year-by-year projection WITH RANDOM RETURNS
        const projection = [];
        let balances = {
            rrsp: rrsp || 0,
            tfsa: tfsa || 0,
            nonReg: nonReg || 0,
            other: other || 0
        };
        let debt = currentDebt || 0;
        const inf = inflationRate / 100;
        
        for (let age = currentAge; age <= lifeExpectancy; age++) {
            const yearIndex = age - currentAge;
            const isRetired = age >= retirementAge;
            
            // Get this year's return from sequence
            const returnRate = returnSequence[yearIndex] || 0;
            
            const yearData = {
                age,
                phase: isRetired ? 'retirement' : 'accumulation',
                returnRate: returnRate * 100 // Store as percentage
            };
            
            // Check for windfalls this year (randomize by probability)
            if (windfalls && windfalls.length > 0 && typeof WindfallManager !== 'undefined') {
                const applicableWindfalls = windfalls.filter(w => {
                    const targetAge = w.year || (currentAge + w.yearsFromNow);
                    return targetAge === age;
                });
                
                applicableWindfalls.forEach(windfall => {
                    // Randomize based on probability
                    const occurs = Math.random() * 100 <= windfall.probability;
                    
                    if (occurs) {
                        // Calculate after-tax amount (simplified)
                        const afterTaxAmount = windfall.taxable
                            ? windfall.amount * 0.7 // Assume 30% tax rate (simplified)
                            : windfall.amount;
                        
                        // Add to appropriate account
                        if (windfall.destination === 'rrsp') {
                            balances.rrsp += afterTaxAmount;
                        } else if (windfall.destination === 'tfsa') {
                            balances.tfsa += afterTaxAmount;
                        } else if (windfall.destination === 'nonReg') {
                            balances.nonReg += afterTaxAmount;
                        } else if (windfall.destination === 'split') {
                            // Default split: 50% TFSA, 50% non-reg
                            balances.tfsa += afterTaxAmount * 0.5;
                            balances.nonReg += afterTaxAmount * 0.5;
                        }
                        
                        yearData.windfall = {
                            name: windfall.name,
                            amount: afterTaxAmount
                        };
                    }
                });
            }
            
            if (!isRetired) {
                // ACCUMULATION PHASE
                // 1. Add contributions
                const annualContribution = monthlyContribution * 12;
                balances.rrsp += annualContribution * contributionSplit.rrsp;
                balances.tfsa += annualContribution * contributionSplit.tfsa;
                balances.nonReg += annualContribution * contributionSplit.nonReg;
                
                // 2. Investment returns (random!)
                balances.rrsp *= (1 + returnRate);
                balances.tfsa *= (1 + returnRate);
                balances.nonReg *= (1 + returnRate);
                balances.other *= (1 + returnRate);
                
                // 3. Pay down debt
                if (debt > 0 && age < debtPayoffAge) {
                    const yearsLeft = debtPayoffAge - age;
                    const annualPayment = debt / yearsLeft;
                    debt = Math.max(0, debt - annualPayment);
                    yearData.debtPayment = annualPayment;
                }
                
                yearData.debt = debt;
            } else {
                // RETIREMENT PHASE
                // 1. Grow accounts first
                balances.rrsp *= (1 + returnRate);
                balances.tfsa *= (1 + returnRate);
                balances.nonReg *= (1 + returnRate);
                balances.other *= (1 + returnRate);
                
                // 2. Calculate spending need
                const yearsIntoRetirement = age - retirementAge;
                const inflationFactor = Math.pow(1 + inf, yearsIntoRetirement);
                const thisYearSpending = futureAnnualSpending * inflationFactor;
                
                // 3. Healthcare costs
                const healthcareCost = healthcareCosts.byYear.find(h => h.age === age)?.cost || 0;
                const totalNeed = thisYearSpending + healthcareCost;
                
                // 4. Government income
                let govIncome = 0;
                if (age >= cppStartAge) {
                    govIncome += govBenefits.cppTotal;
                }
                if (age >= 65) {
                    govIncome += govBenefits.oasMax;
                }
                
                // 5. Additional income
                const additionalIncome = (additionalIncomeSources || [])
                    .filter(s => age >= s.startAge && (s.endAge === null || age <= s.endAge))
                    .reduce((sum, s) => sum + s.annualAmount, 0);
                
                const totalOtherIncome = govIncome + additionalIncome;
                
                // 6. Portfolio withdrawal needed
                const neededFromPortfolio = Math.max(0, totalNeed - totalOtherIncome);
                
                // Simple withdrawal (withdraw proportionally from all accounts)
                const totalBalance = balances.rrsp + balances.tfsa + balances.nonReg + balances.other;
                
                if (totalBalance > 0) {
                    const withdrawalRate = Math.min(1, neededFromPortfolio / totalBalance);
                    const rrspWithdrawal = balances.rrsp * withdrawalRate;
                    const tfsaWithdrawal = balances.tfsa * withdrawalRate;
                    const nonRegWithdrawal = balances.nonReg * withdrawalRate;
                    const otherWithdrawal = balances.other * withdrawalRate;
                    
                    balances.rrsp -= rrspWithdrawal;
                    balances.tfsa -= tfsaWithdrawal;
                    balances.nonReg -= nonRegWithdrawal;
                    balances.other -= otherWithdrawal;
                    
                    yearData.withdrawal = rrspWithdrawal + tfsaWithdrawal + nonRegWithdrawal + otherWithdrawal;
                } else {
                    yearData.withdrawal = 0;
                }
                
                yearData.targetSpending = thisYearSpending;
                yearData.healthcareCost = healthcareCost;
                yearData.governmentIncome = govIncome;
            }
            
            yearData.totalBalance = balances.rrsp + balances.tfsa + balances.nonReg + balances.other;
            yearData.balances = { ...balances };
            
            projection.push(yearData);
        }
        
        // Find when money runs out
        const runsOutYear = projection.find(p => p.totalBalance <= 0);
        const moneyLastsAge = runsOutYear ? runsOutYear.age : lifeExpectancy;
        
        // Portfolio at retirement
        const retirementYear = projection.find(p => p.age === retirementAge);
        const portfolioAtRetirement = retirementYear ? retirementYear.totalBalance : 0;
        
        // Final balance
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
    
    /**
     * Analyze simulation results and generate percentile distributions
     */
    _analyzeResults(results, baseInputs) {
        const { lifeExpectancy } = baseInputs;
        
        // Sort by final balance
        results.sort((a, b) => a.finalBalance - b.finalBalance);
        
        // Calculate percentiles
        const getPercentile = (pct) => {
            const index = Math.floor(results.length * pct);
            return results[index];
        };
        
        const p10 = getPercentile(0.10);
        const p25 = getPercentile(0.25);
        const p50 = getPercentile(0.50); // Median
        const p75 = getPercentile(0.75);
        const p90 = getPercentile(0.90);
        
        // Success rate
        const successfulRuns = results.filter(r => r.success).length;
        const successRate = (successfulRuns / results.length) * 100;
        
        // Portfolio at retirement distribution
        const portfoliosAtRetirement = results.map(r => r.portfolioAtRetirement).sort((a, b) => a - b);
        const portfolioP10 = portfoliosAtRetirement[Math.floor(portfoliosAtRetirement.length * 0.10)];
        const portfolioP50 = portfoliosAtRetirement[Math.floor(portfoliosAtRetirement.length * 0.50)];
        const portfolioP90 = portfoliosAtRetirement[Math.floor(portfoliosAtRetirement.length * 0.90)];
        
        // Money lasts distribution
        const moneyLastsAges = results.map(r => r.moneyLastsAge).sort((a, b) => a - b);
        const ageP10 = moneyLastsAges[Math.floor(moneyLastsAges.length * 0.10)];
        const ageP50 = moneyLastsAges[Math.floor(moneyLastsAges.length * 0.50)];
        const ageP90 = moneyLastsAges[Math.floor(moneyLastsAges.length * 0.90)];
        
        // Average and worst/best cases
        const averageFinalBalance = results.reduce((sum, r) => sum + r.finalBalance, 0) / results.length;
        const worstCase = results[0]; // Lowest final balance
        const bestCase = results[results.length - 1]; // Highest final balance
        
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
            
            allResults: results // For detailed analysis
        };
    },
    
    /**
     * Analyze sequence of returns risk
     * (How much does return ORDER matter vs just average?)
     */
    analyzeSequenceRisk(baseInputs) {
        console.log('[MonteCarloSimulator] Analyzing sequence of returns risk...');
        
        // Scenario 1: Bull then Bear (good returns early, bad later)
        const bullThenBear = this._generateBullBearSequence(
            baseInputs.currentAge,
            baseInputs.lifeExpectancy,
            baseInputs.returnRate,
            'bull-then-bear'
        );
        
        // Scenario 2: Bear then Bull (bad returns early, good later)
        const bearThenBull = this._generateBullBearSequence(
            baseInputs.currentAge,
            baseInputs.lifeExpectancy,
            baseInputs.returnRate,
            'bear-then-bull'
        );
        
        const result1 = this._runSingleSimulation({
            ...baseInputs,
            returnSequence: bullThenBear,
            simulationRun: true
        });
        
        const result2 = this._runSingleSimulation({
            ...baseInputs,
            returnSequence: bearThenBull,
            simulationRun: true
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
            let returnRate;
            
            if (pattern === 'bull-then-bear') {
                // Good returns first half, bad second half
                if (i < halfYears) {
                    returnRate = (expectedReturn / 100) + 0.05; // +5% bonus
                } else {
                    returnRate = (expectedReturn / 100) - 0.05; // -5% penalty
                }
            } else {
                // Bad returns first half, good second half
                if (i < halfYears) {
                    returnRate = (expectedReturn / 100) - 0.05;
                } else {
                    returnRate = (expectedReturn / 100) + 0.05;
                }
            }
            
            sequence.push(returnRate);
        }
        
        return sequence;
    }
};

console.log('[MonteCarloSimulator] Module loaded');

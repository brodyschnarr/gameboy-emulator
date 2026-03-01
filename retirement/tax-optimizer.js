// ═══════════════════════════════════════════
//  Advanced Tax Optimization Engine
//  Finds optimal withdrawal strategies to minimize lifetime tax
// ═══════════════════════════════════════════

const TaxOptimizer = {
    
    /**
     * Find optimal RRSP withdrawal strategy to avoid OAS clawback
     * @param {Object} retirementData - Portfolio, spending, government benefits
     * @returns {Object} - Optimal withdrawal strategy with tax savings
     */
    optimizeWithdrawals(retirementData) {
        const {
            rrsp,
            tfsa,
            nonReg,
            annualSpending,
            cppAnnual,
            oasAnnual,
            province,
            retirementAge,
            lifeExpectancy
        } = retirementData;
        
        console.log('[TaxOptimizer] Analyzing withdrawal strategies...');
        
        // OAS clawback threshold (2024: ~$90K income)
        const OAS_CLAWBACK_THRESHOLD = 90000;
        const OAS_CLAWBACK_END = 150000; // Fully clawed back
        
        // Strategy 1: Naive (withdraw as needed each year)
        const naiveStrategy = this._simulateNaiveWithdrawals(retirementData);
        
        // Strategy 2: Front-load RRSP (withdraw RRSP early to reduce future RRIFs)
        const frontLoadStrategy = this._simulateFrontLoadRRSP(retirementData);
        
        // Strategy 3: Stay under OAS threshold (carefully manage income)
        const oasOptimalStrategy = this._simulateOASOptimal(retirementData);
        
        // Compare strategies
        const comparison = {
            naive: {
                totalTax: naiveStrategy.totalTax,
                oasClawback: naiveStrategy.oasClawback,
                netIncome: naiveStrategy.netIncome,
                strategy: 'Withdraw as needed (no optimization)'
            },
            frontLoad: {
                totalTax: frontLoadStrategy.totalTax,
                oasClawback: frontLoadStrategy.oasClawback,
                netIncome: frontLoadStrategy.netIncome,
                strategy: 'Front-load RRSP withdrawals (before age 65)'
            },
            oasOptimal: {
                totalTax: oasOptimalStrategy.totalTax,
                oasClawback: oasOptimalStrategy.oasClawback,
                netIncome: oasOptimalStrategy.netIncome,
                strategy: 'Stay under OAS clawback threshold'
            }
        };
        
        // Find best strategy
        const strategies = [
            { name: 'naive', ...naiveStrategy },
            { name: 'frontLoad', ...frontLoadStrategy },
            { name: 'oasOptimal', ...oasOptimalStrategy }
        ];
        
        strategies.sort((a, b) => b.netIncome - a.netIncome);
        const optimal = strategies[0];
        
        const taxSavings = optimal.netIncome - naiveStrategy.netIncome;
        
        return {
            recommended: optimal.name,
            taxSavings: Math.round(taxSavings),
            comparison,
            optimalStrategy: {
                name: optimal.name,
                description: comparison[optimal.name].strategy,
                totalTax: optimal.totalTax,
                oasClawback: optimal.oasClawback,
                netIncome: optimal.netIncome,
                yearByYear: optimal.yearByYear
            }
        };
    },
    
    /**
     * Naive withdrawal strategy (baseline)
     */
    _simulateNaiveWithdrawals(data) {
        const {
            rrsp,
            tfsa,
            nonReg,
            annualSpending,
            cppAnnual,
            oasAnnual,
            province,
            retirementAge,
            lifeExpectancy
        } = data;
        
        let totalTax = 0;
        let oasClawback = 0;
        let netIncome = 0;
        const yearByYear = [];
        
        let balances = { rrsp, tfsa, nonReg };
        
        for (let age = retirementAge; age <= lifeExpectancy; age++) {
            const govIncome = (age >= 65 ? cppAnnual + oasAnnual : cppAnnual);
            const needed = annualSpending - govIncome;
            
            // Withdraw proportionally from all accounts
            const totalPortfolio = balances.rrsp + balances.tfsa + balances.nonReg;
            if (totalPortfolio > 0 && needed > 0) {
                const withdrawRate = Math.min(1, needed / totalPortfolio);
                const rrspW = balances.rrsp * withdrawRate;
                const tfsaW = balances.tfsa * withdrawRate;
                const nonRegW = balances.nonReg * withdrawRate;
                
                balances.rrsp -= rrspW;
                balances.tfsa -= tfsaW;
                balances.nonReg -= nonRegW;
                
                // Calculate tax
                const taxableIncome = govIncome + rrspW + (nonRegW * 0.5); // 50% of non-reg is capital gains
                const tax = CanadianTax.calculateTax(taxableIncome, province);
                
                totalTax += tax.total;
                netIncome += (govIncome + rrspW + tfsaW + nonRegW - tax.total);
                
                // OAS clawback
                if (age >= 65 && taxableIncome > 90000) {
                    const clawback = Math.min(oasAnnual, (taxableIncome - 90000) * 0.15);
                    oasClawback += clawback;
                }
                
                yearByYear.push({
                    age,
                    rrspWithdrawal: rrspW,
                    tfsaWithdrawal: tfsaW,
                    nonRegWithdrawal: nonRegW,
                    taxableIncome,
                    tax: tax.total
                });
            }
        }
        
        return {
            totalTax: Math.round(totalTax),
            oasClawback: Math.round(oasClawback),
            netIncome: Math.round(netIncome),
            yearByYear
        };
    },
    
    /**
     * Front-load RRSP withdrawals (withdraw early to reduce RRIFs)
     */
    _simulateFrontLoadRRSP(data) {
        const {
            rrsp,
            tfsa,
            nonReg,
            annualSpending,
            cppAnnual,
            oasAnnual,
            province,
            retirementAge,
            lifeExpectancy
        } = data;
        
        let totalTax = 0;
        let oasClawback = 0;
        let netIncome = 0;
        const yearByYear = [];
        
        let balances = { rrsp, tfsa, nonReg };
        
        // Withdraw extra RRSP before age 65 (when no OAS yet)
        const frontLoadYears = 65 - retirementAge;
        const extraRRSPPerYear = frontLoadYears > 0 ? balances.rrsp * 0.5 / frontLoadYears : 0;
        
        for (let age = retirementAge; age <= lifeExpectancy; age++) {
            const govIncome = (age >= 65 ? cppAnnual + oasAnnual : cppAnnual);
            const needed = annualSpending - govIncome;
            
            let rrspW = 0;
            let tfsaW = 0;
            let nonRegW = 0;
            
            // Before age 65: withdraw extra RRSP
            if (age < 65 && balances.rrsp > 0) {
                rrspW = Math.min(balances.rrsp, extraRRSPPerYear);
                balances.rrsp -= rrspW;
            }
            
            // Also withdraw to meet spending
            if (needed > 0) {
                // Prefer TFSA first (tax-free)
                if (balances.tfsa >= needed) {
                    tfsaW += needed;
                    balances.tfsa -= needed;
                } else if (balances.tfsa > 0) {
                    tfsaW += balances.tfsa;
                    const remaining = needed - balances.tfsa;
                    balances.tfsa = 0;
                    
                    // Then non-reg
                    if (balances.nonReg >= remaining) {
                        nonRegW = remaining;
                        balances.nonReg -= remaining;
                    } else {
                        nonRegW = balances.nonReg;
                        balances.nonReg = 0;
                        // Then RRSP
                        const stillNeeded = remaining - nonRegW;
                        if (balances.rrsp >= stillNeeded) {
                            rrspW += stillNeeded;
                            balances.rrsp -= stillNeeded;
                        }
                    }
                }
            }
            
            // Calculate tax
            const taxableIncome = govIncome + rrspW + (nonRegW * 0.5);
            const tax = CanadianTax.calculateTax(taxableIncome, province);
            
            totalTax += tax.total;
            netIncome += (govIncome + rrspW + tfsaW + nonRegW - tax.total);
            
            // OAS clawback
            if (age >= 65 && taxableIncome > 90000) {
                const clawback = Math.min(oasAnnual, (taxableIncome - 90000) * 0.15);
                oasClawback += clawback;
            }
            
            yearByYear.push({
                age,
                rrspWithdrawal: rrspW,
                tfsaWithdrawal: tfsaW,
                nonRegWithdrawal: nonRegW,
                taxableIncome,
                tax: tax.total
            });
        }
        
        return {
            totalTax: Math.round(totalTax),
            oasClawback: Math.round(oasClawback),
            netIncome: Math.round(netIncome),
            yearByYear
        };
    },
    
    /**
     * Stay under OAS clawback threshold (optimize for OAS retention)
     */
    _simulateOASOptimal(data) {
        const {
            rrsp,
            tfsa,
            nonReg,
            annualSpending,
            cppAnnual,
            oasAnnual,
            province,
            retirementAge,
            lifeExpectancy
        } = data;
        
        const OAS_THRESHOLD = 90000;
        
        let totalTax = 0;
        let oasClawback = 0;
        let netIncome = 0;
        const yearByYear = [];
        
        let balances = { rrsp, tfsa, nonReg };
        
        for (let age = retirementAge; age <= lifeExpectancy; age++) {
            const govIncome = (age >= 65 ? cppAnnual + oasAnnual : cppAnnual);
            const needed = annualSpending - govIncome;
            
            let rrspW = 0;
            let tfsaW = 0;
            let nonRegW = 0;
            
            if (needed > 0) {
                // Strategy: Maximize TFSA, then carefully manage taxable
                if (balances.tfsa >= needed) {
                    tfsaW = needed;
                    balances.tfsa -= needed;
                } else {
                    tfsaW = balances.tfsa;
                    balances.tfsa = 0;
                    
                    const remaining = needed - tfsaW;
                    
                    // If age >= 65, be careful not to exceed OAS threshold
                    if (age >= 65) {
                        const roomBeforeThreshold = Math.max(0, OAS_THRESHOLD - govIncome);
                        
                        // Withdraw up to threshold from RRSP
                        const rrspSafe = Math.min(balances.rrsp, roomBeforeThreshold);
                        rrspW = Math.min(remaining, rrspSafe);
                        balances.rrsp -= rrspW;
                        
                        // Rest from non-reg if still needed
                        const stillNeeded = remaining - rrspW;
                        if (stillNeeded > 0) {
                            nonRegW = Math.min(balances.nonReg, stillNeeded);
                            balances.nonReg -= nonRegW;
                        }
                    } else {
                        // Before 65: normal priority (TFSA → non-reg → RRSP)
                        if (balances.nonReg >= remaining) {
                            nonRegW = remaining;
                            balances.nonReg -= remaining;
                        } else {
                            nonRegW = balances.nonReg;
                            balances.nonReg = 0;
                            const stillNeeded = remaining - nonRegW;
                            rrspW = Math.min(balances.rrsp, stillNeeded);
                            balances.rrsp -= rrspW;
                        }
                    }
                }
            }
            
            // Calculate tax
            const taxableIncome = govIncome + rrspW + (nonRegW * 0.5);
            const tax = CanadianTax.calculateTax(taxableIncome, province);
            
            totalTax += tax.total;
            netIncome += (govIncome + rrspW + tfsaW + nonRegW - tax.total);
            
            // OAS clawback
            if (age >= 65 && taxableIncome > 90000) {
                const clawback = Math.min(oasAnnual, (taxableIncome - 90000) * 0.15);
                oasClawback += clawback;
            }
            
            yearByYear.push({
                age,
                rrspWithdrawal: rrspW,
                tfsaWithdrawal: tfsaW,
                nonRegWithdrawal: nonRegW,
                taxableIncome,
                tax: tax.total
            });
        }
        
        return {
            totalTax: Math.round(totalTax),
            oasClawback: Math.round(oasClawback),
            netIncome: Math.round(netIncome),
            yearByYear
        };
    },
    
    /**
     * Calculate tax efficiency score (0-100)
     * Higher score = more tax-efficient portfolio structure
     */
    calculateTaxEfficiency(portfolio) {
        const { rrsp, tfsa, nonReg } = portfolio;
        const total = rrsp + tfsa + nonReg;
        
        if (total === 0) return 0;
        
        const tfsaRatio = tfsa / total;
        const rrspRatio = rrsp / total;
        const nonRegRatio = nonReg / total;
        
        // Ideal mix: 40% TFSA, 40% RRSP, 20% non-reg
        const tfsaScore = 100 - Math.abs(0.40 - tfsaRatio) * 100;
        const rrspScore = 100 - Math.abs(0.40 - rrspRatio) * 100;
        const nonRegScore = 100 - Math.abs(0.20 - nonRegRatio) * 100;
        
        const overallScore = (tfsaScore * 0.4 + rrspScore * 0.4 + nonRegScore * 0.2);
        
        return {
            score: Math.round(overallScore),
            breakdown: {
                tfsa: { ratio: tfsaRatio, score: Math.round(tfsaScore) },
                rrsp: { ratio: rrspRatio, score: Math.round(rrspScore) },
                nonReg: { ratio: nonRegRatio, score: Math.round(nonRegScore) }
            },
            recommendation: this._getEfficiencyRecommendation(tfsaRatio, rrspRatio, nonRegRatio)
        };
    },
    
    _getEfficiencyRecommendation(tfsa, rrsp, nonReg) {
        const recommendations = [];
        
        if (tfsa < 0.30) {
            recommendations.push('Increase TFSA contributions (currently low)');
        }
        
        if (rrsp > 0.60) {
            recommendations.push('Consider diversifying away from RRSP to avoid future tax burden');
        }
        
        if (nonReg > 0.40) {
            recommendations.push('High non-registered ratio increases capital gains taxes');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Portfolio mix is tax-efficient');
        }
        
        return recommendations;
    }
};

console.log('[TaxOptimizer] Module loaded');

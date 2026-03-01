// ═══════════════════════════════════════════
//  Retirement Planner V5 - Enhanced with Monte Carlo & Advanced Analytics
//  Extends V4 with probabilistic analysis and optimization
// ═══════════════════════════════════════════

console.log('[AppV5] Loading enhanced features...');

const AppV5Enhanced = {
    monteCarloResults: null,
    taxOptimizationResults: null,
    whatIfResults: null,
    safeWithdrawalResults: null,
    
    /**
     * Run comprehensive analysis (Monte Carlo + Tax Optimization + What-If)
     */
    runEnhancedAnalysis(baseInputs, baseResults) {
        console.log('[AppV5] Running enhanced analysis suite...');
        
        // Validate inputs
        if (typeof ErrorHandler !== 'undefined') {
            const validation = ErrorHandler.validateInputs(baseInputs);
            if (!validation.valid) {
                validation.errors.forEach(err => ErrorHandler.showWarning('Input Error', err));
                return;
            }
        }
        
        // Show loading indicator
        this._showLoadingOverlay('Running 1000+ simulations and optimizations...');
        
        // Run analyses in sequence (async to avoid blocking)
        setTimeout(() => {
            try {
                // 1. Monte Carlo simulation (this is the heavy one)
                console.log('[AppV5] Starting Monte Carlo simulation...');
                try {
                    this.monteCarloResults = MonteCarloSimulator.simulate(baseInputs, {
                        iterations: 1000,
                        volatility: 0.15,
                        marketCrashProbability: 0.10
                    });
                } catch (mcError) {
                    console.error('[AppV5] Monte Carlo error:', mcError);
                    if (typeof ErrorHandler !== 'undefined') {
                        ErrorHandler.handleCalculationError(mcError, 'Monte Carlo simulation');
                    }
                    // Use base results as fallback
                    this.monteCarloResults = this._fallbackMonteCarloResults(baseResults);
                }
                
                // 2. Tax optimization
                console.log('[AppV5] Analyzing tax strategies...');
                try {
                    this.taxOptimizationResults = TaxOptimizer.optimizeWithdrawals({
                        rrsp: baseInputs.rrsp,
                        tfsa: baseInputs.tfsa,
                        nonReg: baseInputs.nonReg,
                        annualSpending: baseInputs.annualSpending,
                        cppAnnual: baseResults.govBenefits.cppTotal,
                        oasAnnual: baseResults.govBenefits.oasMax,
                        province: baseInputs.province,
                        retirementAge: baseInputs.retirementAge,
                        lifeExpectancy: baseInputs.lifeExpectancy
                    });
                } catch (taxError) {
                    console.error('[AppV5] Tax optimization error:', taxError);
                    if (typeof ErrorHandler !== 'undefined') {
                        ErrorHandler.handleCalculationError(taxError, 'Tax optimization');
                    }
                    this.taxOptimizationResults = this._fallbackTaxResults();
                }
                
                // 3. What-if scenarios
                console.log('[AppV5] Generating what-if scenarios...');
                try {
                    this.whatIfResults = WhatIfAnalyzer.analyzeAll(baseInputs);
                } catch (whatIfError) {
                    console.error('[AppV5] What-if error:', whatIfError);
                    if (typeof ErrorHandler !== 'undefined') {
                        ErrorHandler.handleCalculationError(whatIfError, 'What-if analysis');
                    }
                    this.whatIfResults = this._fallbackWhatIfResults(baseInputs, baseResults);
                }
                
                // 4. Safe withdrawal analysis
                console.log('[AppV5] Calculating safe withdrawal rates...');
                try {
                    const portfolioAtRetirement = baseResults.summary.portfolioAtRetirement;
                    const retirementYears = baseInputs.lifeExpectancy - baseInputs.retirementAge;
                    this.safeWithdrawalResults = SafeWithdrawalCalculator.calculate({
                        portfolioValue: portfolioAtRetirement,
                        retirementYears: retirementYears,
                        inflationRate: baseInputs.inflationRate,
                        successTarget: 90,
                        includeGovernmentBenefits: true,
                        governmentBenefitsAnnual: baseResults.govBenefits.total
                    });
                } catch (swrError) {
                    console.error('[AppV5] Safe withdrawal error:', swrError);
                    if (typeof ErrorHandler !== 'undefined') {
                        ErrorHandler.handleCalculationError(swrError, 'Safe withdrawal calculation');
                    }
                    this.safeWithdrawalResults = this._fallbackSWRResults(baseResults);
                }
                
                // Hide loading, show enhanced results
                this._hideLoadingOverlay();
                this._displayEnhancedResults(baseResults, baseInputs);
                
                console.log('[AppV5] Enhanced analysis complete!');
            } catch (error) {
                console.error('[AppV5] Analysis error:', error);
                this._hideLoadingOverlay();
                if (typeof ErrorHandler !== 'undefined') {
                    ErrorHandler.handleCalculationError(error, 'Enhanced analysis');
                } else {
                    alert('Analysis error: ' + error.message);
                }
            }
        }, 100);
    },
    
    _fallbackMonteCarloResults(baseResults) {
        return {
            successRate: baseResults.probability,
            totalRuns: 1,
            successfulRuns: baseResults.onTrack ? 1 : 0,
            finalBalance: {
                p10: Math.round(baseResults.summary.legacyAmount * 0.5),
                p50: baseResults.summary.legacyAmount,
                p90: Math.round(baseResults.summary.legacyAmount * 1.5)
            },
            portfolioAtRetirement: {
                p10: Math.round(baseResults.summary.portfolioAtRetirement * 0.85),
                p50: baseResults.summary.portfolioAtRetirement,
                p90: Math.round(baseResults.summary.portfolioAtRetirement * 1.15)
            },
            moneyLastsAge: {
                worst: baseResults.summary.moneyLastsAge - 3,
                p50: baseResults.summary.moneyLastsAge,
                best: baseResults.summary.moneyLastsAge + 5
            },
            percentiles: {
                p50: {
                    projection: baseResults.yearByYear
                }
            }
        };
    },
    
    _fallbackTaxResults() {
        return {
            recommended: 'naive',
            taxSavings: 0,
            comparison: {
                naive: {
                    strategy: 'Standard withdrawal',
                    totalTax: 0,
                    oasClawback: 0,
                    netIncome: 0
                }
            },
            optimalStrategy: {
                name: 'Standard Withdrawal',
                description: 'Tax optimization unavailable',
                reasoning: ['Using standard withdrawal approach']
            }
        };
    },
    
    _fallbackWhatIfResults(inputs, results) {
        return {
            scenarios: {
                base: {
                    name: 'Base Plan',
                    description: 'Your current plan',
                    inputs,
                    results
                }
            },
            comparison: {},
            recommendations: []
        };
    },
    
    _fallbackSWRResults(results) {
        return {
            recommended: {
                name: '4% Rule',
                withdrawalRate: 0.04,
                firstYearAmount: results.summary.portfolioAtRetirement * 0.04,
                successRate: results.probability
            },
            strategies: [],
            comparison: []
        };
    },
    
    /**
     * Display enhanced results with all advanced features
     */
    _displayEnhancedResults(baseResults, baseInputs) {
        // Create enhanced results section
        const resultsDiv = document.getElementById('results');
        if (!resultsDiv) return;
        
        let html = `
            <div class="card">
                <h2>📊 Advanced Analysis Results</h2>
                
                <!-- Tabs for different views -->
                <div class="analysis-tabs">
                    <button class="tab-btn active" data-tab="overview">Overview</button>
                    <button class="tab-btn" data-tab="monte-carlo">Monte Carlo (Probability)</button>
                    <button class="tab-btn" data-tab="tax">Tax Optimization</button>
                    <button class="tab-btn" data-tab="what-if">What-If Scenarios</button>
                    <button class="tab-btn" data-tab="withdrawal">Safe Withdrawal</button>
                </div>
                
                <!-- Tab content areas -->
                <div id="tab-overview" class="tab-content active">
                    ${this._renderOverviewTab(baseResults)}
                </div>
                
                <div id="tab-monte-carlo" class="tab-content hidden">
                    ${this._renderMonteCarloTab()}
                </div>
                
                <div id="tab-tax" class="tab-content hidden">
                    ${this._renderTaxTab()}
                </div>
                
                <div id="tab-what-if" class="tab-content hidden">
                    ${this._renderWhatIfTab()}
                </div>
                
                <div id="tab-withdrawal" class="tab-content hidden">
                    ${this._renderWithdrawalTab()}
                </div>
            </div>
        `;
        
        resultsDiv.innerHTML += html;
        
        // Setup tab switching
        this._setupTabs();
        
        // Draw charts
        setTimeout(() => {
            this._drawAllCharts(baseInputs);
        }, 100);
    },
    
    _renderOverviewTab(baseResults) {
        const mc = this.monteCarloResults;
        const tax = this.taxOptimizationResults;
        
        return `
            <h3>🎯 Quick Summary</h3>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Success Rate</div>
                    <div class="stat-value">${mc.successRate}%</div>
                    <div class="stat-note">${mc.successfulRuns} of ${mc.totalRuns} scenarios succeeded</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-label">Expected Final Balance</div>
                    <div class="stat-value">$${(mc.finalBalance.p50 / 1000).toFixed(0)}K</div>
                    <div class="stat-note">Median outcome (50th percentile)</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-label">Worst Case (10th %ile)</div>
                    <div class="stat-value">$${(mc.finalBalance.p10 / 1000).toFixed(0)}K</div>
                    <div class="stat-note">Still ends at age ${mc.moneyLastsAge.p10}</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-label">Tax Savings Available</div>
                    <div class="stat-value">$${(tax.taxSavings / 1000).toFixed(0)}K</div>
                    <div class="stat-note">vs naive withdrawal strategy</div>
                </div>
            </div>
            
            <h3>🏛️ Government Benefits</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">CPP (Annual)</div>
                    <div class="stat-value">$${(baseResults.govBenefits.cppTotal || 0).toLocaleString()}</div>
                    <div class="stat-note">Starting at age ${baseResults.govBenefits.cppStartAge || 65}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">OAS (Annual)</div>
                    <div class="stat-value">$${(baseResults.govBenefits.oasMax || 0).toLocaleString()}</div>
                    <div class="stat-note">Starting at age 65</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Gov Benefits</div>
                    <div class="stat-value">$${(baseResults.govBenefits.total || 0).toLocaleString()}/year</div>
                    <div class="stat-note">Reduces portfolio withdrawals</div>
                </div>
            </div>
            
            ${this._renderWindfallSummary(baseInputs)}
            
            <h3>📈 Confidence Bands</h3>
            <p>This chart shows the range of possible outcomes based on 1000 simulations with realistic market volatility:</p>
            <canvas id="confidence-bands-chart"></canvas>
            
            <div class="insight-box">
                <h4>💡 Key Insights</h4>
                <ul>
                    <li><strong>Probability:</strong> ${mc.successRate}% chance your money lasts until age ${baseResults.summary.moneyLastsAge || 90}</li>
                    <li><strong>Range:</strong> In 80% of scenarios, you'll have between $${(mc.finalBalance.p10 / 1000).toFixed(0)}K and $${(mc.finalBalance.p90 / 1000).toFixed(0)}K at the end</li>
                    <li><strong>Government Support:</strong> CPP ($${(baseResults.govBenefits.cppTotal || 0).toLocaleString()}) + OAS ($${(baseResults.govBenefits.oasMax || 0).toLocaleString()}) = $${(baseResults.govBenefits.total || 0).toLocaleString()}/year reduces portfolio stress</li>
                    <li><strong>Tax Efficiency:</strong> Optimized withdrawal strategy saves $${(tax.taxSavings / 1000).toFixed(0)}K over your lifetime</li>
                </ul>
            </div>
        `;
    },
    
    _renderMonteCarloTab() {
        const mc = this.monteCarloResults;
        
        return `
            <h3>🎲 Monte Carlo Simulation Results</h3>
            <p>We ran <strong>1,000 different market scenarios</strong> with realistic volatility and occasional crashes. Here's what we found:</p>
            
            <div class="stats-grid">
                <div class="stat-card success">
                    <div class="stat-label">Success Rate</div>
                    <div class="stat-value">${mc.successRate}%</div>
                    <div class="stat-note">${mc.successfulRuns} of ${mc.totalRuns} scenarios</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-label">Best Case (90th %ile)</div>
                    <div class="stat-value">$${mc.finalBalance.p90.toLocaleString()}</div>
                    <div class="stat-note">Top 10% of outcomes</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-label">Median Outcome (50th)</div>
                    <div class="stat-value">$${mc.finalBalance.p50.toLocaleString()}</div>
                    <div class="stat-note">Middle of the distribution</div>
                </div>
                
                <div class="stat-card warning">
                    <div class="stat-label">Worst Case (10th %ile)</div>
                    <div class="stat-value">$${mc.finalBalance.p10.toLocaleString()}</div>
                    <div class="stat-note">Bottom 10% of outcomes</div>
                </div>
            </div>
            
            <h4>Portfolio at Retirement</h4>
            <div class="range-display">
                <div class="range-item">
                    <span class="range-label">10th percentile:</span>
                    <span class="range-value">$${mc.portfolioAtRetirement.p10.toLocaleString()}</span>
                </div>
                <div class="range-item">
                    <span class="range-label">Median (50th):</span>
                    <span class="range-value">$${mc.portfolioAtRetirement.p50.toLocaleString()}</span>
                </div>
                <div class="range-item">
                    <span class="range-label">90th percentile:</span>
                    <span class="range-value">$${mc.portfolioAtRetirement.p90.toLocaleString()}</span>
                </div>
            </div>
            
            <h4>Money Lasts Until Age</h4>
            <div class="range-display">
                <div class="range-item">
                    <span class="range-label">Worst case:</span>
                    <span class="range-value">Age ${mc.moneyLastsAge.worst}</span>
                </div>
                <div class="range-item">
                    <span class="range-label">Median:</span>
                    <span class="range-value">Age ${mc.moneyLastsAge.p50}</span>
                </div>
                <div class="range-item">
                    <span class="range-label">Best case:</span>
                    <span class="range-value">Age ${mc.moneyLastsAge.best}+</span>
                </div>
            </div>
            
            <h4>Distribution of Final Balances</h4>
            <canvas id="probability-distribution-chart"></canvas>
            
            <div class="insight-box">
                <h4>What This Means</h4>
                <p><strong>Success rate of ${mc.successRate}%</strong> means that in ${mc.successRate} out of 100 simulations with realistic market conditions, your money lasted through your entire retirement.</p>
                <p>The wide range between worst case ($${mc.finalBalance.p10.toLocaleString()}) and best case ($${mc.finalBalance.p90.toLocaleString()}) shows the impact of market timing and sequence of returns.</p>
            </div>
        `;
    },
    
    _renderTaxTab() {
        const tax = this.taxOptimizationResults;
        
        return `
            <h3>💰 Tax Optimization Analysis</h3>
            <p>We compared different withdrawal strategies to minimize your lifetime tax burden:</p>
            
            <div class="comparison-table">
                <h4>Strategy Comparison</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Strategy</th>
                            <th>Total Tax</th>
                            <th>OAS Clawback</th>
                            <th>Net Income</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(tax.comparison).map(([key, strat]) => `
                            <tr class="${key === tax.recommended ? 'highlight' : ''}">
                                <td>${strat.strategy}</td>
                                <td>$${strat.totalTax.toLocaleString()}</td>
                                <td>$${strat.oasClawback.toLocaleString()}</td>
                                <td><strong>$${strat.netIncome.toLocaleString()}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="stat-card success">
                <h4>✅ Recommended Strategy: ${tax.optimalStrategy.name}</h4>
                <p>${tax.optimalStrategy.description}</p>
                <p><strong>Tax Savings: $${tax.taxSavings.toLocaleString()}</strong> over naive approach</p>
            </div>
            
            <h4>Withdrawal Pattern Over Time</h4>
            <canvas id="withdrawal-strategy-chart"></canvas>
            
            <div class="insight-box">
                <h4>💡 Key Tax Insights</h4>
                <ul>
                    ${(tax.optimalStrategy.reasoning || []).map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        `;
    },
    
    _renderWhatIfTab() {
        const whatIf = this.whatIfResults;
        
        return `
            <h3>🔮 What-If Scenario Analysis</h3>
            <p>See how small changes impact your retirement outcome:</p>
            
            <h4>🎛️ Interactive Sliders</h4>
            <div id="interactive-sliders-container"></div>
            
            <h4>📊 Scenario Heatmap</h4>
            <p>Success rate by retirement age and portfolio size:</p>
            <canvas id="success-heatmap"></canvas>
            
            <h4>Key Scenarios</h4>
            <div class="scenario-grid">
                ${this._renderScenarioCard(whatIf.scenarios.retire5Earlier)}
                ${this._renderScenarioCard(whatIf.scenarios.retire5Later)}
                ${this._renderScenarioCard(whatIf.scenarios.spend20Less)}
                ${this._renderScenarioCard(whatIf.scenarios.spend20More)}
                ${this._renderScenarioCard(whatIf.scenarios.worstCase)}
                ${this._renderScenarioCard(whatIf.scenarios.bestCase)}
            </div>
            
            <h4>🎯 Recommendations</h4>
            <div class="recommendations-list">
                ${whatIf.recommendations.map(rec => `
                    <div class="recommendation-card priority-${rec.priority}">
                        <div class="rec-header">
                            <span class="rec-category">${rec.category}</span>
                            <span class="rec-priority">${rec.priority}</span>
                        </div>
                        <div class="rec-content">
                            <p class="rec-main">${rec.recommendation}</p>
                            <p class="rec-impact"><strong>Impact:</strong> ${rec.impact}</p>
                            <p class="rec-action"><strong>Action:</strong> ${rec.action}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <h4>💾 Saved Scenarios</h4>
            <div id="saved-scenarios-container"></div>
        `;
    },
    
    _renderScenarioCard(scenario) {
        const result = scenario.results;
        const isGood = result.onTrack;
        
        return `
            <div class="scenario-card ${isGood ? 'good' : 'warning'}">
                <h5>${scenario.name}</h5>
                <p class="scenario-desc">${scenario.description}</p>
                <div class="scenario-stats">
                    <div>Portfolio: $${(result.summary.portfolioAtRetirement / 1000).toFixed(0)}K</div>
                    <div>Lasts: Age ${result.summary.moneyLastsAge}</div>
                    <div>Success: ${result.probability}%</div>
                </div>
            </div>
        `;
    },
    
    _renderWithdrawalTab() {
        const swr = this.safeWithdrawalResults;
        
        return `
            <h3>🏦 Safe Withdrawal Rate Analysis</h3>
            <p>How much can you safely withdraw each year?</p>
            
            <div class="stat-card success">
                <h4>✅ Recommended: ${swr.recommended.name}</h4>
                <p>${swr.recommended.description}</p>
                <div class="withdrawal-amount">
                    <div class="amount-label">Safe to withdraw:</div>
                    <div class="amount-value">$${swr.recommended.firstYearAmount.toLocaleString()}/year</div>
                    <div class="amount-note">(${(swr.recommended.withdrawalRate * 100).toFixed(1)}% of portfolio)</div>
                </div>
            </div>
            
            <h4>Strategy Comparison</h4>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Strategy</th>
                        <th>Rate</th>
                        <th>First Year Amount</th>
                        <th>Monthly Income</th>
                        <th>Success Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${swr.comparison.map(strat => `
                        <tr>
                            <td>${strat.name}</td>
                            <td>${strat.rate}</td>
                            <td>${strat.firstYearAmount}</td>
                            <td>${strat.monthlyIncome}</td>
                            <td class="${strat.successRate >= '90%' ? 'good' : 'warning'}">${strat.successRate}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="insight-box">
                <h4>💡 About Safe Withdrawal Rates</h4>
                <ul>
                    <li><strong>4% Rule:</strong> Classic safe withdrawal rate from Trinity Study (1998)</li>
                    <li><strong>Dynamic:</strong> Adjust spending based on portfolio performance</li>
                    <li><strong>Guardrails:</strong> Increase/decrease when portfolio crosses thresholds</li>
                    <li><strong>Age-Based:</strong> Start lower, increase as life expectancy decreases</li>
                </ul>
            </div>
        `;
    },
    
    _setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                // Update active button
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Show corresponding content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                document.getElementById(`tab-${tab}`).classList.remove('hidden');
            });
        });
    },
    
    _drawAllCharts(baseInputs) {
        // Cache data for responsive redrawing
        if (this.monteCarloResults) {
            AdvancedCharts.cacheData('monteCarlo', this.monteCarloResults);
            AdvancedCharts.drawConfidenceBands('confidence-bands-chart', this.monteCarloResults);
            AdvancedCharts.drawProbabilityDistribution('probability-distribution-chart', this.monteCarloResults);
        }
        
        if (this.taxOptimizationResults) {
            AdvancedCharts.cacheData('tax', this.taxOptimizationResults);
            AdvancedCharts.drawWithdrawalComparison('withdrawal-strategy-chart', this.taxOptimizationResults);
        }
        
        if (baseInputs) {
            AdvancedCharts.cacheData('inputs', baseInputs);
            AdvancedCharts.drawSuccessHeatmap('success-heatmap', baseInputs);
        }
        
        // Interactive sliders (if module loaded and container exists)
        if (typeof InteractiveSliders !== 'undefined' && document.getElementById('interactive-sliders-container')) {
            const baseResults = RetirementCalcV4.calculate(baseInputs);
            InteractiveSliders.init(baseInputs, baseResults);
            InteractiveSliders.render('interactive-sliders-container');
        }
        
        // Saved scenarios (if module loaded and container exists)
        if (typeof ScenarioStorage !== 'undefined' && document.getElementById('saved-scenarios-container')) {
            ScenarioStorage.renderSavedScenarios('saved-scenarios-container');
            
            // Set up callbacks
            ScenarioStorage.onDelete = () => {
                ScenarioStorage.renderSavedScenarios('saved-scenarios-container');
            };
            ScenarioStorage.onClearAll = () => {
                ScenarioStorage.renderSavedScenarios('saved-scenarios-container');
            };
        }
    },
    
    _showLoadingOverlay(message) {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <h3>Running Advanced Analysis...</h3>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    },
    
    _hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.remove();
    },
    
    _renderWindfallSummary(inputs) {
        if (!inputs) return '';
        
        const windfalls = inputs.windfalls || [];
        
        if (windfalls.length === 0 || typeof WindfallManager === 'undefined') {
            return '';
        }
        
        const summary = WindfallManager.getSummary(windfalls);
        
        return `
            <div class="windfall-impact-card">
                <h4>💰 Potential Windfalls</h4>
                <p>You've modeled ${summary.count} potential windfall${summary.count !== 1 ? 's' : ''} with probability-weighted expected value:</p>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Count</div>
                        <div class="stat-value">${summary.count}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Total Amount</div>
                        <div class="stat-value">$${(summary.totalAmount / 1000).toFixed(0)}K</div>
                        <div class="stat-note">If all occur</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Expected Value</div>
                        <div class="stat-value">$${(summary.expectedValue / 1000).toFixed(0)}K</div>
                        <div class="stat-note">Probability-weighted</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Avg Probability</div>
                        <div class="stat-value">${summary.averageProbability.toFixed(0)}%</div>
                    </div>
                </div>
                
                <div class="windfalls-list" style="margin-top: 20px;">
                    ${windfalls.map(w => `
                        <div class="windfall-item-summary">
                            <span class="windfall-name-summary">${w.name}</span>
                            <span class="windfall-amount-summary">$${(w.amount / 1000).toFixed(0)}K</span>
                            <span class="windfall-prob-summary">${w.probability}% likely</span>
                            <span class="windfall-year-summary">Age ${w.year || '?'}</span>
                        </div>
                    `).join('')}
                </div>
                
                <p style="margin-top: 15px; font-size: 13px; color: #78350f;">
                    <strong>Note:</strong> Monte Carlo simulation randomizes windfalls based on probability. 
                    Success rate reflects scenarios where windfalls may or may not occur.
                </p>
            </div>
        `;
    }
};

console.log('[AppV5] Enhanced features loaded');

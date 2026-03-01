// ═══════════════════════════════════════════
//  Retirement Planner V4 - Complete Controller
// ═══════════════════════════════════════════

console.log('[AppV4] Loading app.js...');

// Check dependencies
if (typeof CanadaMap === 'undefined') console.error('[AppV4] CanadaMap not loaded!');
if (typeof RegionalDataV2 === 'undefined') console.error('[AppV4] RegionalDataV2 not loaded!');
if (typeof IncomeSources === 'undefined') console.error('[AppV4] IncomeSources not loaded!');
if (typeof CPPOptimizer === 'undefined') console.error('[AppV4] CPPOptimizer not loaded!');
if (typeof ScenarioManager === 'undefined') console.error('[AppV4] ScenarioManager not loaded!');
if (typeof HealthcareEstimator === 'undefined') console.error('[AppV4] HealthcareEstimator not loaded!');
if (typeof RetirementCalcV4 === 'undefined') console.error('[AppV4] RetirementCalcV4 not loaded!');

const AppV4 = {
    currentStep: 'basic',
    familyStatus: 'single',
    selectedProvince: null,
    selectedRegion: null,
    healthStatus: 'average',
    cppStartAge: 65,
    scenarioResults: {},
    currentScenario: 'base',
    windfalls: [],

    init() {
        console.log('[AppV4] Initializing...');
        this._setupNavigation();
        this._setupFamilyMode();
        this._setupMap();
        this._setupIncome();
        this._setupBenchmarks();
        this._setupPresets();
        this._setupCPPOptimizer();
        this._setupHealthcare();
        this._setupDebt();
        this._setupIncomeSources();
        this._setupWindfalls();
        this._setupCalculate();
        this._setupScenarios();
        this._setupModals();
        this._setupAdvancedToggle();
        console.log('[AppV4] Init complete');
    },

    _setupNavigation() {
        // Forward navigation
        document.getElementById('btn-next-savings')?.addEventListener('click', () => {
            if (this._validateBasic()) {
                this._showStep('savings');
                this._updateSavingsBenchmark();
            }
        });

        document.getElementById('btn-next-contributions')?.addEventListener('click', () => {
            this._showStep('contributions');
            this._updateContributionBenchmark();
        });

        document.getElementById('btn-next-retirement')?.addEventListener('click', () => {
            this._showStep('retirement');
            this._updateSpendingRecommendation();
            this._updateCPPPreview();
        });

        document.getElementById('btn-next-healthcare')?.addEventListener('click', () => {
            this._showStep('healthcare');
            this._updateHealthcarePreview();
        });

        // Back navigation
        document.getElementById('btn-back-basic')?.addEventListener('click', () => {
            this._showStep('basic');
        });

        document.getElementById('btn-back-savings')?.addEventListener('click', () => {
            this._showStep('savings');
        });

        document.getElementById('btn-back-contributions')?.addEventListener('click', () => {
            this._showStep('contributions');
        });

        document.getElementById('btn-back-retirement')?.addEventListener('click', () => {
            this._showStep('retirement');
        });
    },

    _setupFamilyMode() {
        const singleBtn = document.getElementById('family-single');
        const coupleBtn = document.getElementById('family-couple');
        
        if (!singleBtn || !coupleBtn) {
            console.error('[AppV4] Family toggle buttons not found!');
            return;
        }
        
        console.log('[AppV4] Family mode setup, buttons found');
        
        singleBtn.addEventListener('click', () => {
            console.log('[AppV4] Single clicked');
            singleBtn.classList.add('active');
            coupleBtn.classList.remove('active');
            this.familyStatus = 'single';
            this._toggleFamilyUI();
        });
        
        coupleBtn.addEventListener('click', () => {
            console.log('[AppV4] Couple clicked');
            coupleBtn.classList.add('active');
            singleBtn.classList.remove('active');
            this.familyStatus = 'couple';
            this._toggleFamilyUI();
        });
    },

    _toggleFamilyUI() {
        const isCouple = this.familyStatus === 'couple';
        console.log('[AppV4] Toggling family UI, isCouple:', isCouple);
        
        // Show/hide partner age
        const partnerAgeGroup = document.getElementById('partner-age-group');
        console.log('[AppV4] Partner age group element:', partnerAgeGroup);
        if (partnerAgeGroup) {
            partnerAgeGroup.classList.toggle('hidden', !isCouple);
        }
        
        // Show/hide income sections
        const singleSection = document.getElementById('income-section-single');
        const coupleSection = document.getElementById('income-section-couple');
        console.log('[AppV4] Single section:', singleSection, 'Couple section:', coupleSection);
        
        if (singleSection) {
            singleSection.classList.toggle('hidden', isCouple);
        }
        if (coupleSection) {
            coupleSection.classList.toggle('hidden', !isCouple);
        }
        
        // Update household income if couple
        if (isCouple) {
            this._updateHouseholdIncome();
        }
        
        console.log('[AppV4] Family UI toggled successfully');
    },

    _updateHouseholdIncome() {
        const income1 = parseFloat(document.getElementById('income-person1')?.value) || 0;
        const income2 = parseFloat(document.getElementById('income-person2')?.value) || 0;
        const total = income1 + income2;
        
        const display = document.getElementById('household-income-display');
        if (display) {
            display.textContent = `$${total.toLocaleString()}`;
        }
        
        // Show household income benchmarks
        const benchmarkEl = document.getElementById('household-income-benchmark');
        if (benchmarkEl && total > 0) {
            const isFamilyMode = this.familyStatus === 'couple';
            
            // Canadian household income stats (2024 estimates)
            const medianHousehold = 92000;
            const averageHousehold = 106000;
            
            let percentile = '';
            let comparison = '';
            
            if (total < 50000) {
                percentile = 'bottom 25%';
                comparison = 'below average';
            } else if (total < medianHousehold) {
                percentile = 'bottom 50%';
                comparison = 'below median';
            } else if (total < 110000) {
                percentile = 'top 50%';
                comparison = 'above median';
            } else if (total < 150000) {
                percentile = 'top 25%';
                comparison = 'well above average';
            } else {
                percentile = 'top 10%';
                comparison = 'high income';
            }
            
            benchmarkEl.innerHTML = `
                <div class="benchmark-content">
                    <p>
                        <strong>Canadian ${isFamilyMode ? 'couples' : 'households'}:</strong>
                        Median $${medianHousehold.toLocaleString()}, Average $${averageHousehold.toLocaleString()}
                    </p>
                    <p class="benchmark-highlight">
                        You're in the <strong>${percentile}</strong> (${comparison})
                    </p>
                </div>
            `;
            benchmarkEl.classList.remove('hidden');
        } else if (benchmarkEl) {
            benchmarkEl.classList.add('hidden');
        }
    },

    _setupMap() {
        CanadaMap.render('map-container');
        CanadaMap.onSelect = (province, region) => {
            console.log('[AppV4] Map selection:', province, region);
            this.selectedProvince = province;
            this.selectedRegion = region;
            
            document.getElementById('province').value = province;
            document.getElementById('region').value = region;
            
            // Update benchmarks based on new selection
            this._updateRegionalBenchmarks();
        };
        
        // Set default location
        console.log('[AppV4] Setting default location: ON, ON_Toronto');
        CanadaMap.setSelection('ON', 'ON_Toronto');
        
        // Manually trigger the callback to ensure state is set
        this.selectedProvince = 'ON';
        this.selectedRegion = 'ON_Toronto';
        console.log('[AppV4] Default location set:', this.selectedProvince, this.selectedRegion);
    },

    _setupIncome() {
        // Single mode income
        const incomeInput = document.getElementById('current-income');
        if (incomeInput) {
            incomeInput.addEventListener('input', () => {
                this._updateIncomeBenchmark();
            });
        }
        
        // Couple mode incomes
        const income1 = document.getElementById('income-person1');
        const income2 = document.getElementById('income-person2');
        
        if (income1) {
            income1.addEventListener('input', () => {
                this._updateHouseholdIncome();
            });
        }
        
        if (income2) {
            income2.addEventListener('input', () => {
                this._updateHouseholdIncome();
            });
        }
    },

    _setupBenchmarks() {
        // Savings inputs
        ['rrsp', 'tfsa', 'nonreg', 'other'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    this._updateTotalSavings();
                });
            }
        });

        // Contribution split
        ['split-rrsp', 'split-tfsa', 'split-nonreg'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    this._validateSplit();
                });
            }
        });
    },

    _setupPresets() {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lifestyle = btn.dataset.lifestyle;
                const amount = parseInt(btn.dataset.amount);
                
                // Show detail modal
                this._showLifestyleDetail(lifestyle);
                
                // Set active
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update input
                const spendingInput = document.getElementById('annual-spending');
                if (spendingInput) {
                    spendingInput.value = amount;
                }
                
                this._updateSpendingRecommendation();
            });
        });

        // Close detail
        const closeBtn = document.getElementById('close-detail');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('lifestyle-detail')?.classList.add('hidden');
            });
        }
    },

    _setupCPPOptimizer() {
        const slider = document.getElementById('cpp-start-age');
        if (!slider) return;

        slider.addEventListener('input', (e) => {
            this.cppStartAge = parseInt(e.target.value);
            this._updateCPPPreview();
        });

        // CPP details button
        const detailsBtn = document.getElementById('btn-cpp-details');
        if (detailsBtn) {
            detailsBtn.addEventListener('click', () => {
                this._showCPPComparison();
            });
        }
    },

    _setupHealthcare() {
        document.querySelectorAll('.health-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.health-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.healthStatus = btn.dataset.health;
                this._updateHealthcarePreview();
            });
        });
    },

    _setupDebt() {
        const debtInput = document.getElementById('current-debt');
        if (debtInput) {
            debtInput.addEventListener('input', (e) => {
                const debt = parseFloat(e.target.value) || 0;
                const payoffGroup = document.getElementById('debt-payoff-group');
                if (payoffGroup) {
                    payoffGroup.classList.toggle('hidden', debt === 0);
                }
            });
        }
    },

    _setupIncomeSources() {
        IncomeSources.initModal();
    },

    _setupWindfalls() {
        if (typeof WindfallManager === 'undefined') {
            console.warn('[AppV4] WindfallManager not loaded, skipping windfall setup');
            return;
        }
        
        const addBtn = document.getElementById('btn-add-windfall');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this._showWindfallForm();
            });
        }
        
        this._updateWindfallsList();
    },

    _showWindfallForm(editIndex = null) {
        const container = document.getElementById('windfall-form-container');
        if (!container) return;
        
        const windfall = editIndex !== null ? this.windfalls[editIndex] : null;
        
        WindfallManager.renderForm(
            'windfall-form-container',
            windfall,
            (data) => {
                if (editIndex !== null) {
                    this.windfalls[editIndex] = data;
                } else {
                    this.windfalls.push(data);
                }
                this._updateWindfallsList();
                container.innerHTML = '';
            },
            () => {
                container.innerHTML = '';
            }
        );
    },

    _updateWindfallsList() {
        WindfallManager.renderList(this.windfalls, 'windfalls-list');
        
        // Attach edit/delete listeners
        WindfallManager._attachListeners = () => {
            document.querySelectorAll('.btn-edit-windfall').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    this._showWindfallForm(index);
                });
            });
            
            document.querySelectorAll('.btn-delete-windfall').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    if (confirm('Delete this windfall?')) {
                        this.windfalls.splice(index, 1);
                        this._updateWindfallsList();
                    }
                });
            });
        };
        
        WindfallManager._attachListeners();
    },

    _setupCalculate() {
        const calculateBtn = document.getElementById('btn-calculate');
        console.log('[AppV4] Calculate button:', calculateBtn);
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => {
                console.log('[AppV4] Calculate button clicked!');
                console.log('[AppV4] Selected province:', this.selectedProvince);
                console.log('[AppV4] Selected region:', this.selectedRegion);
                console.log('[AppV4] Family status:', this.familyStatus);
                
                if (this._validateAllInputs()) {
                    console.log('[AppV4] Validation passed, running calculation...');
                    this._runCalculation();
                } else {
                    console.error('[AppV4] Validation failed');
                }
            });
            console.log('[AppV4] Calculate button listener attached');
        } else {
            console.error('[AppV4] Calculate button NOT FOUND in DOM!');
        }

        const editBtn = document.getElementById('btn-edit');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                document.getElementById('results')?.classList.add('hidden');
                this._showStep('basic');
            });
        }

        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this._saveScenario();
            });
        }
    },

    _setupScenarios() {
        // Scenarios now auto-run on calculate - see _autoCalculateScenarios
    },

    _setupModals() {
        // Close CPP modal
        const closeCPPBtn = document.getElementById('close-cpp-modal');
        if (closeCPPBtn) {
            closeCPPBtn.addEventListener('click', () => {
                document.getElementById('cpp-details-modal')?.classList.add('hidden');
            });
        }
    },

    _setupAdvancedToggle() {
        const toggleBtn = document.getElementById('toggle-assumptions');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const content = document.getElementById('assumptions-content');
                const icon = document.querySelector('.toggle-icon');
                if (content) {
                    content.classList.toggle('hidden');
                    if (icon) {
                        icon.textContent = content.classList.contains('hidden') ? '▼' : '▲';
                    }
                }
            });
        }
    },

    _showStep(step) {
        const steps = ['basic', 'savings', 'contributions', 'retirement', 'healthcare'];
        
        // Hide all steps
        steps.forEach(s => {
            document.getElementById(`step-${s}`)?.classList.add('hidden');
        });
        
        // Show target step
        document.getElementById(`step-${step}`)?.classList.remove('hidden');
        this.currentStep = step;
        
        // Update progress indicator
        const currentIndex = steps.indexOf(step);
        document.querySelectorAll('.progress-step').forEach((el, index) => {
            el.classList.remove('active', 'completed');
            if (index < currentIndex) {
                el.classList.add('completed');
            } else if (index === currentIndex) {
                el.classList.add('active');
            }
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    _validateBasic() {
        const age = parseInt(document.getElementById('current-age')?.value);
        
        if (!age || age < 18 || age > 100) {
            alert('Please enter a valid age (18-100)');
            return false;
        }

        if (!this.selectedProvince || !this.selectedRegion) {
            alert('Please select your location on the map');
            return false;
        }

        // Validate income based on family status
        if (this.familyStatus === 'single') {
            const income = parseFloat(document.getElementById('current-income')?.value);
            if (!income || income < 0) {
                alert('Please enter your annual income');
                return false;
            }
        } else {
            const income1 = parseFloat(document.getElementById('income-person1')?.value);
            const income2 = parseFloat(document.getElementById('income-person2')?.value);
            if (!income1 || income1 < 0) {
                alert('Please enter Person 1 income');
                return false;
            }
            // Person 2 income is optional
        }

        return true;
    },

    _validateAllInputs() {
        if (!this._validateBasic()) return false;

        const retirementAge = parseInt(document.getElementById('retirement-age')?.value);
        const currentAge = parseInt(document.getElementById('current-age')?.value);
        const lifeExpectancy = parseInt(document.getElementById('life-expectancy')?.value);

        if (retirementAge <= currentAge) {
            alert('Retirement age must be greater than current age');
            return false;
        }

        if (lifeExpectancy <= retirementAge) {
            alert('Life expectancy must be greater than retirement age');
            return false;
        }

        const spending = parseFloat(document.getElementById('annual-spending')?.value);
        if (!spending || spending <= 0) {
            alert('Please enter expected annual spending');
            return false;
        }

        return true;
    },

    _updateIncomeBenchmark() {
        const income = parseFloat(document.getElementById('current-income')?.value) || 0;
        const age = parseInt(document.getElementById('current-age')?.value) || 35;
        
        if (income > 0) {
            const comparison = BenchmarksV2.compareIncome(income, age);
            const el = document.getElementById('income-benchmark');
            if (el) {
                el.innerHTML = `
                    ${comparison.message}<br>
                    <small style="opacity: 0.8;">
                        Age ${age} avg: $${comparison.ageAverage.toLocaleString()} | 
                        Canadian median: $${comparison.median.toLocaleString()}
                    </small>
                `;
            }
        }
    },

    _updateRegionalBenchmarks() {
        if (!this.selectedRegion) return;
        
        const age = parseInt(document.getElementById('current-age')?.value) || 35;
        const benchmarks = RegionalDataV2.getRegionalBenchmarks(this.selectedRegion, age);
        
        // Update income benchmark
        this._updateIncomeBenchmark();
        
        // Update savings benchmark (if on that step)
        if (this.currentStep === 'savings') {
            this._updateSavingsBenchmark();
        }
    },

    _updateSavingsBenchmark() {
        const age = parseInt(document.getElementById('current-age')?.value) || 35;
        const benchmarks = this.selectedRegion 
            ? RegionalDataV2.getRegionalBenchmarks(this.selectedRegion, age)
            : BenchmarksV2.getSavingsBenchmark(age);
        
        const html = `
            <strong>Typical ${benchmarks.name || 'Canadian'} at age ${age}:</strong><br>
            <div style="margin-top: 8px; font-size: 14px;">
                📊 Median: $${benchmarks.median.toLocaleString()} | 
                📈 Average: $${benchmarks.average.toLocaleString()}
            </div>
            <div style="margin-top: 4px; font-size: 13px; opacity: 0.8;">
                25th percentile: $${(benchmarks.p25 || 0).toLocaleString()} | 
                75th percentile: $${(benchmarks.p75 || 0).toLocaleString()}
            </div>
        `;
        
        const el = document.getElementById('savings-benchmark');
        if (el) el.innerHTML = html;
    },

    _updateTotalSavings() {
        const rrsp = parseFloat(document.getElementById('rrsp')?.value) || 0;
        const tfsa = parseFloat(document.getElementById('tfsa')?.value) || 0;
        const nonreg = parseFloat(document.getElementById('nonreg')?.value) || 0;
        const other = parseFloat(document.getElementById('other')?.value) || 0;
        
        const total = rrsp + tfsa + nonreg + other;
        
        const display = document.getElementById('total-savings-display');
        if (display) {
            display.textContent = `$${total.toLocaleString()}`;
        }

        const age = parseInt(document.getElementById('current-age')?.value) || 35;
        const comparison = BenchmarksV2.compareSavings(age, total);
        
        const benchmark = document.getElementById('total-savings-benchmark');
        if (benchmark) {
            benchmark.innerHTML = `
                <div>${comparison.message}</div>
                <div style="font-size: 12px; margin-top: 4px; opacity: 0.8;">
                    Median: $${comparison.median.toLocaleString()} | 
                    Average: $${comparison.average.toLocaleString()}
                </div>
            `;
        }
    },

    _updateContributionBenchmark() {
        const monthly = parseFloat(document.getElementById('monthly-contribution')?.value) || 0;
        
        let income = 0;
        if (this.familyStatus === 'single') {
            income = parseFloat(document.getElementById('current-income')?.value) || 60000;
        } else {
            const income1 = parseFloat(document.getElementById('income-person1')?.value) || 0;
            const income2 = parseFloat(document.getElementById('income-person2')?.value) || 0;
            income = income1 + income2;
        }
        
        if (monthly > 0) {
            const comparison = BenchmarksV2.compareContribution(monthly, income);
            const el = document.getElementById('contribution-benchmark');
            if (el) {
                el.innerHTML = `
                    <div>${comparison.message}</div>
                    <div style="font-size: 12px; margin-top: 4px; opacity: 0.8;">
                        Recommended (15% of income): $${comparison.recommended}/month | 
                        Canadian median: $${BenchmarksV2.monthlyContribution.median}/month | 
                        Avg at your income: $${comparison.incomePeerMedian}/month
                    </div>
                `;
            }
        }
    },

    _validateSplit() {
        const rrsp = parseFloat(document.getElementById('split-rrsp')?.value) || 0;
        const tfsa = parseFloat(document.getElementById('split-tfsa')?.value) || 0;
        const nonreg = parseFloat(document.getElementById('split-nonreg')?.value) || 0;
        
        const total = rrsp + tfsa + nonreg;
        const el = document.getElementById('split-total');
        
        if (!el) return;
        
        if (Math.abs(total - 100) < 0.1) {
            el.textContent = '✅ Total: 100%';
            el.style.color = 'var(--success, green)';
        } else {
            el.textContent = `⚠️ Total: ${total.toFixed(1)}% (should be 100%)`;
            el.style.color = 'var(--danger, red)';
        }
    },

    _updateSpendingRecommendation() {
        let income = 0;
        if (this.familyStatus === 'single') {
            income = parseFloat(document.getElementById('current-income')?.value) || 60000;
        } else {
            const income1 = parseFloat(document.getElementById('income-person1')?.value) || 0;
            const income2 = parseFloat(document.getElementById('income-person2')?.value) || 0;
            income = income1 + income2;
        }
        
        const spending = parseFloat(document.getElementById('annual-spending')?.value) || 0;
        const recommended = BenchmarksV2.getRecommendedSpending(income);
        
        // Get regional spending averages
        const isSingle = this.familyStatus === 'single';
        const baseMedian = isSingle ? BenchmarksV2.retirementSpending.average.median : BenchmarksV2.retirementSpending.average.coupleMedian;
        const baseAverage = isSingle ? BenchmarksV2.retirementSpending.average.annual : BenchmarksV2.retirementSpending.average.coupleAnnual;
        
        const regionalMedian = BenchmarksV2.getRegionalSpending(baseMedian, this.selectedRegion);
        const regionalAverage = BenchmarksV2.getRegionalSpending(baseAverage, this.selectedRegion);
        
        const el = document.getElementById('spending-recommendation');
        if (el) {
            let html = `Recommended (70% of income): $${recommended.toLocaleString()}/year`;
            
            if (spending > 0) {
                const comparison = BenchmarksV2.compareSpending(spending, isSingle);
                html += `<br><small style="opacity: 0.8;">${comparison.message}</small>`;
            }
            
            const regionData = this.selectedRegion ? RegionalDataV2.getRegion(this.selectedRegion) : null;
            const regionName = regionData ? regionData.name : 'Canada';
            
            html += `<br><small style="opacity: 0.8;">${regionName} retiree ${isSingle ? '' : 'couple '}median: $${regionalMedian.toLocaleString()}/year | Average: $${regionalAverage.toLocaleString()}/year</small>`;
            
            el.innerHTML = html;
        }
    },

    _updateCPPPreview() {
        let baseIncome = 0;
        if (this.familyStatus === 'single') {
            baseIncome = parseFloat(document.getElementById('current-income')?.value) || 60000;
        } else {
            baseIncome = parseFloat(document.getElementById('income-person1')?.value) || 60000;
        }

        const retirementAge = parseInt(document.getElementById('retirement-age')?.value) || 65;
        const lifeExpectancy = parseInt(document.getElementById('life-expectancy')?.value) || 90;
        const yearsContributing = Math.min(retirementAge - 18, 39);

        const baseCPP = CPPCalculator.estimateCPP(baseIncome, yearsContributing);
        const adjusted = CPPOptimizer.calculateByAge(baseCPP.total, this.cppStartAge);
        const lifetime = CPPOptimizer.calculateLifetimeValue(baseCPP.total, this.cppStartAge, lifeExpectancy);

        document.getElementById('cpp-age-value').textContent = this.cppStartAge;
        document.getElementById('cpp-amount-value').textContent = `$${Math.round(adjusted).toLocaleString()}/year`;
        document.getElementById('cpp-lifetime-value').textContent = `$${lifetime.totalLifetime.toLocaleString()}`;
    },

    _updateHealthcarePreview() {
        const retirementAge = parseInt(document.getElementById('retirement-age')?.value) || 65;
        const lifeExpectancy = parseInt(document.getElementById('life-expectancy')?.value) || 90;
        const province = this.selectedProvince || 'ON';

        const costs = HealthcareEstimator.projectTotal(
            retirementAge,
            lifeExpectancy,
            province,
            this.healthStatus
        );

        document.getElementById('healthcare-annual').textContent = `$${costs.averageAnnual.toLocaleString()}/year`;
        document.getElementById('healthcare-total').textContent = `$${costs.total.toLocaleString()}`;
    },

    _showLifestyleDetail(lifestyle) {
        const data = LifestyleData[lifestyle];
        if (!data) return;

        document.getElementById('lifestyle-detail-title').textContent = 
            `${data.name} Lifestyle - $${data.annual.toLocaleString()}/year`;
        document.getElementById('lifestyle-detail-tagline').textContent = data.tagline;

        const breakdownHTML = Object.entries(data.breakdown).map(([category, details]) => `
            <div class="breakdown-item">
                <div class="breakdown-category">${category.charAt(0).toUpperCase() + category.slice(1)}</div>
                <div class="breakdown-amount">$${details.monthly.toLocaleString()}/month</div>
                <div class="breakdown-description">${details.description}</div>
            </div>
        `).join('');
        document.getElementById('lifestyle-breakdown').innerHTML = breakdownHTML;

        const examplesHTML = data.examples.map(ex => `<li>${ex}</li>`).join('');
        document.getElementById('lifestyle-examples').innerHTML = examplesHTML;

        document.getElementById('lifestyle-detail')?.classList.remove('hidden');
    },

    _showCPPComparison() {
        let baseIncome = 0;
        if (this.familyStatus === 'single') {
            baseIncome = parseFloat(document.getElementById('current-income')?.value) || 60000;
        } else {
            baseIncome = parseFloat(document.getElementById('income-person1')?.value) || 60000;
        }

        const retirementAge = parseInt(document.getElementById('retirement-age')?.value) || 65;
        const lifeExpectancy = parseInt(document.getElementById('life-expectancy')?.value) || 90;
        const yearsContributing = Math.min(retirementAge - 18, 39);

        const baseCPP = CPPCalculator.estimateCPP(baseIncome, yearsContributing);
        const comparison = CPPOptimizer.compareStartAges(baseCPP.total, lifeExpectancy);

        const optimal = CPPOptimizer.findOptimal(baseCPP.total, lifeExpectancy);

        const html = `
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Start Age</th>
                        <th>Monthly</th>
                        <th>Annual</th>
                        <th>Lifetime Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${comparison.map(option => `
                        <tr ${option.age === optimal.age ? 'class="optimal-row"' : ''}>
                            <td>${option.age}${option.age === optimal.age ? ' ⭐' : ''}</td>
                            <td>$${option.monthlyAmount.toLocaleString()}</td>
                            <td>$${option.annualAmount.toLocaleString()}</td>
                            <td>$${option.totalLifetime.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p class="note">⭐ Optimal start age: ${optimal.age} (maximizes lifetime value to age ${lifeExpectancy})</p>
        `;

        document.getElementById('cpp-comparison-table').innerHTML = html;
        document.getElementById('cpp-details-modal')?.classList.remove('hidden');
    },

    _runCalculation() {
        try {
            const inputs = this._gatherInputs();
            console.log('[AppV4] Inputs:', inputs);

            // Check if RetirementCalcV4 exists
            if (typeof RetirementCalcV4 === 'undefined') {
                alert('❌ Calculation engine not loaded. Please refresh the page.');
                console.error('[AppV4] RetirementCalcV4 is undefined!');
                return;
            }

            // Calculate base scenario
            const baseResults = RetirementCalcV4.calculate(inputs);
            console.log('[AppV4] Base Results:', baseResults);

            // Store base scenario
            this.scenarioResults = {
                base: { inputs, results: baseResults }
            };

            // Auto-calculate common scenarios
            this._autoCalculateScenarios(inputs);

            // Display base results
            this.currentScenario = 'base';
            this._displayResults(baseResults, inputs);
            
            // Setup scenario tab switching
            this._setupScenarioTabs();
            
            // Show results
            ['basic', 'savings', 'contributions', 'retirement', 'healthcare'].forEach(s => {
                document.getElementById(`step-${s}`)?.classList.add('hidden');
            });
            document.getElementById('results')?.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Run V5 Enhanced Analysis (Monte Carlo, Tax Optimization, What-If)
            if (typeof AppV5Enhanced !== 'undefined') {
                console.log('[AppV4] Launching V5 enhanced analysis...');
                AppV5Enhanced.runEnhancedAnalysis(inputs, baseResults);
            }
        } catch (error) {
            console.error('[AppV4] Calculation error:', error);
            alert(`❌ Calculation failed: ${error.message}\n\nPlease check the console for details.`);
        }
    },

    _autoCalculateScenarios(baseInputs) {
        // Scenario 1: Retire 5 years earlier
        const retire5early = {
            ...baseInputs,
            retirementAge: baseInputs.retirementAge - 5
        };
        this.scenarioResults.retire5early = {
            inputs: retire5early,
            results: RetirementCalcV4.calculate(retire5early)
        };

        // Scenario 2: Retire 5 years later
        const retire5late = {
            ...baseInputs,
            retirementAge: baseInputs.retirementAge + 5
        };
        this.scenarioResults.retire5late = {
            inputs: retire5late,
            results: RetirementCalcV4.calculate(retire5late)
        };

        // Scenario 3: Spend 20% less
        const spend20less = {
            ...baseInputs,
            annualSpending: Math.round(baseInputs.annualSpending * 0.8)
        };
        this.scenarioResults.spend20less = {
            inputs: spend20less,
            results: RetirementCalcV4.calculate(spend20less)
        };

        // Scenario 4: Spend 20% more
        const spend20more = {
            ...baseInputs,
            annualSpending: Math.round(baseInputs.annualSpending * 1.2)
        };
        this.scenarioResults.spend20more = {
            inputs: spend20more,
            results: RetirementCalcV4.calculate(spend20more)
        };

        console.log('[AppV4] Auto-calculated scenarios:', Object.keys(this.scenarioResults));
    },

    _setupScenarioTabs() {
        document.querySelectorAll('.scenario-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const scenario = e.target.dataset.scenario;
                this._switchScenario(scenario);
            });
        });
    },

    _switchScenario(scenarioKey) {
        if (!this.scenarioResults[scenarioKey]) return;

        // Update active tab
        document.querySelectorAll('.scenario-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.scenario === scenarioKey) {
                tab.classList.add('active');
            }
        });

        // Display scenario results
        this.currentScenario = scenarioKey;
        const scenario = this.scenarioResults[scenarioKey];
        this._displayResults(scenario.results, scenario.inputs);
    },

    _gatherInputs() {
        const currentAge = parseInt(document.getElementById('current-age')?.value);
        const partnerAge = parseInt(document.getElementById('partner-age')?.value) || currentAge;
        
        let currentIncome, income1, income2;
        if (this.familyStatus === 'single') {
            currentIncome = parseFloat(document.getElementById('current-income')?.value);
            income1 = currentIncome;
            income2 = 0;
        } else {
            income1 = parseFloat(document.getElementById('income-person1')?.value) || 0;
            income2 = parseFloat(document.getElementById('income-person2')?.value) || 0;
            currentIncome = income1 + income2;
        }

        return {
            currentAge,
            partnerAge,
            retirementAge: parseInt(document.getElementById('retirement-age')?.value) || 65,
            lifeExpectancy: parseInt(document.getElementById('life-expectancy')?.value) || 90,
            province: this.selectedProvince || 'ON',
            region: this.selectedRegion || 'ON_Toronto',
            familyStatus: this.familyStatus,
            
            currentIncome,
            income1,
            income2,
            
            rrsp: parseFloat(document.getElementById('rrsp')?.value) || 0,
            tfsa: parseFloat(document.getElementById('tfsa')?.value) || 0,
            nonReg: parseFloat(document.getElementById('nonreg')?.value) || 0,
            other: parseFloat(document.getElementById('other')?.value) || 0,
            
            monthlyContribution: parseFloat(document.getElementById('monthly-contribution')?.value) || 0,
            contributionSplit: {
                rrsp: (parseFloat(document.getElementById('split-rrsp')?.value) || 0) / 100,
                tfsa: (parseFloat(document.getElementById('split-tfsa')?.value) || 0) / 100,
                nonReg: (parseFloat(document.getElementById('split-nonreg')?.value) || 0) / 100
            },
            
            annualSpending: parseFloat(document.getElementById('annual-spending')?.value),
            healthStatus: this.healthStatus,
            
            currentDebt: parseFloat(document.getElementById('current-debt')?.value) || 0,
            debtPayoffAge: parseInt(document.getElementById('debt-payoff-age')?.value) || 65,
            
            cppStartAge: this.cppStartAge,
            additionalIncomeSources: IncomeSources.getAll(),
            windfalls: (typeof WindfallManager !== 'undefined') ? (this.windfalls || []) : [],
            
            returnRate: parseFloat(document.getElementById('return-rate')?.value) || 6,
            inflationRate: parseFloat(document.getElementById('inflation-rate')?.value) || 2.5
        };
    },

    _displayResults(results, inputs) {
        // Status banner
        const banner = document.getElementById('status-banner');
        if (banner) {
            if (results.onTrack) {
                banner.className = 'card status-banner on-track';
                banner.textContent = '✅ You are on track for retirement!';
            } else {
                banner.className = 'card status-banner needs-work';
                banner.innerHTML = `⚠️ Your plan may need adjustments to meet your retirement goals`;
            }
        }

        // Stats
        document.getElementById('stat-portfolio').textContent = 
            `$${results.summary.portfolioAtRetirement.toLocaleString()}`;
        document.getElementById('stat-income').textContent = 
            `$${results.summary.annualIncomeAtRetirement.toLocaleString()}`;
        document.getElementById('stat-lasts').textContent = 
            `Age ${results.summary.moneyLastsAge}`;
        document.getElementById('stat-probability').textContent = 
            `${results.probability}%`;

        const lastsNote = document.getElementById('stat-lasts-note');
        if (lastsNote) {
            if (results.summary.moneyLastsAge >= inputs.lifeExpectancy) {
                lastsNote.textContent = '✅ Outlasts your plan';
                lastsNote.style.color = 'var(--success, green)';
            } else {
                const yearsShort = inputs.lifeExpectancy - results.summary.moneyLastsAge;
                lastsNote.textContent = `⚠️ Runs out ${yearsShort} years early`;
                lastsNote.style.color = 'var(--danger, red)';
            }
        }

        const probNote = document.getElementById('stat-probability-note');
        if (probNote) {
            if (results.probability >= 90) {
                probNote.textContent = 'Excellent';
                probNote.style.color = 'var(--success)';
            } else if (results.probability >= 70) {
                probNote.textContent = 'Good';
                probNote.style.color = 'green';
            } else if (results.probability >= 50) {
                probNote.textContent = 'Fair';
                probNote.style.color = 'orange';
            } else {
                probNote.textContent = 'Needs work';
                probNote.style.color = 'var(--danger)';
            }
        }

        // Legacy
        document.getElementById('legacy-amount').textContent = 
            `$${results.legacy.amount.toLocaleString()}`;
        document.getElementById('legacy-description').textContent = 
            results.legacy.description;

        // Charts
        this._drawChart(results.yearByYear, inputs.retirementAge);
        this._drawYearBreakdown(results.yearByYear, inputs.retirementAge);
        this._displayBreakdown(results, inputs);
    },

    _drawChart(yearByYear, retirementAge) {
        const canvas = document.getElementById('projection-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth - 40;
        canvas.height = 400;

        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;

        ctx.clearRect(0, 0, w, h);

        if (yearByYear.length === 0) return;

        const maxBalance = Math.max(...yearByYear.map(y => y.totalBalance));
        const minAge = yearByYear[0].age;
        const maxAge = yearByYear[yearByYear.length - 1].age;

        // Axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, h - padding);
        ctx.lineTo(w - padding, h - padding);
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h - padding);
        ctx.stroke();

        // Retirement line
        const retireX = padding + ((retirementAge - minAge) / (maxAge - minAge)) * (w - 2 * padding);
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(retireX, padding);
        ctx.lineTo(retireX, h - padding);
        ctx.stroke();
        ctx.setLineDash([]);

        // Balance curve
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.beginPath();

        yearByYear.forEach((point, i) => {
            const x = padding + ((point.age - minAge) / (maxAge - minAge)) * (w - 2 * padding);
            const y = h - padding - (point.totalBalance / maxBalance) * (h - 2 * padding);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

        // Labels
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.fillText(`Age ${minAge}`, padding - 10, h - padding + 25);
        ctx.fillText(`Age ${maxAge}`, w - padding - 35, h - padding + 25);
        ctx.fillText(`$${(maxBalance / 1000).toFixed(0)}K`, 5, padding + 5);
        
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('Retirement', retireX - 35, padding - 10);
    },

    _drawYearBreakdown(yearByYear, retirementAge) {
        const container = document.getElementById('year-breakdown-chart');
        if (!container) return;

        const retirementYears = yearByYear.filter(y => y.age >= retirementAge).slice(0, 25);

        if (retirementYears.length === 0) {
            container.innerHTML = '<p>No retirement data</p>';
            return;
        }

        const html = retirementYears.map(year => {
            const total = year.totalBalance;
            const rrspPct = total > 0 ? (year.rrsp / total) * 100 : 0;
            const tfsaPct = total > 0 ? (year.tfsa / total) * 100 : 0;
            const nonRegPct = total > 0 ? (year.nonReg / total) * 100 : 0;
            const otherPct = total > 0 ? (year.other / total) * 100 : 0;

            return `
                <div class="year-bar-row">
                    <div class="year-label">Age ${year.age}</div>
                    <div class="year-bar" title="Total: $${total.toLocaleString()}">
                        ${year.rrsp > 0 ? `<div class="bar-segment rrsp" style="width: ${rrspPct}%" title="RRSP: $${year.rrsp.toLocaleString()} (${rrspPct.toFixed(1)}%)"></div>` : ''}
                        ${year.tfsa > 0 ? `<div class="bar-segment tfsa" style="width: ${tfsaPct}%" title="TFSA: $${year.tfsa.toLocaleString()} (${tfsaPct.toFixed(1)}%)"></div>` : ''}
                        ${year.nonReg > 0 ? `<div class="bar-segment nonreg" style="width: ${nonRegPct}%" title="Non-Reg: $${year.nonReg.toLocaleString()} (${nonRegPct.toFixed(1)}%)"></div>` : ''}
                        ${year.other > 0 ? `<div class="bar-segment other" style="width: ${otherPct}%" title="Other: $${year.other.toLocaleString()} (${otherPct.toFixed(1)}%)"></div>` : ''}
                    </div>
                    <div class="year-breakdown-details">
                        <div class="year-total">$${total.toLocaleString()}</div>
                        <div class="year-percentages">
                            ${year.rrsp > 0 ? `<span class="pct-label rrsp-color">${rrspPct.toFixed(0)}%</span>` : ''}
                            ${year.tfsa > 0 ? `<span class="pct-label tfsa-color">${tfsaPct.toFixed(0)}%</span>` : ''}
                            ${year.nonReg > 0 ? `<span class="pct-label nonreg-color">${nonRegPct.toFixed(0)}%</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const legend = `
            <div class="chart-legend">
                <div class="legend-item"><span class="legend-color rrsp"></span> RRSP</div>
                <div class="legend-item"><span class="legend-color tfsa"></span> TFSA</div>
                <div class="legend-item"><span class="legend-color nonreg"></span> Non-Reg</div>
            </div>
        `;

        container.innerHTML = legend + html;
    },

    _displayBreakdown(results, inputs) {
        const retirementYears = results.yearByYear.filter(y => y.phase === 'retirement');
        
        if (retirementYears.length === 0) {
            document.getElementById('breakdown-content').innerHTML = '<p>No retirement years</p>';
            return;
        }

        const firstYear = retirementYears[0];
        const avgTaxRate = results.summary.avgTaxRateInRetirement;

        const html = `
            <h3>First Year of Retirement (Age ${inputs.retirementAge})</h3>
            <table class="breakdown-table">
                <tr>
                    <th>Withdrawal Source</th>
                    <th>Amount</th>
                </tr>
                <tr>
                    <td>TFSA (tax-free)</td>
                    <td>$${(firstYear.withdrawalBreakdown?.tfsa || 0).toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Non-Reg (50% taxable)</td>
                    <td>$${(firstYear.withdrawalBreakdown?.nonReg || 0).toLocaleString()}</td>
                </tr>
                <tr>
                    <td>RRSP (fully taxable)</td>
                    <td>$${(firstYear.withdrawalBreakdown?.rrsp || 0).toLocaleString()}</td>
                </tr>
                <tr class="total-row">
                    <td><strong>Total</strong></td>
                    <td><strong>$${(firstYear.withdrawal || 0).toLocaleString()}</strong></td>
                </tr>
            </table>

            <h3>Income & Taxes</h3>
            <ul style="line-height: 2;">
                <li><strong>Government:</strong> $${(firstYear.governmentIncome || 0).toLocaleString()}/year</li>
                <li><strong>Taxable Income:</strong> $${(firstYear.taxableIncome || 0).toLocaleString()}</li>
                <li><strong>Tax Paid:</strong> $${(firstYear.taxPaid || 0).toLocaleString()}</li>
                <li><strong>After-Tax Income:</strong> $${(firstYear.afterTaxIncome || 0).toLocaleString()}</li>
                <li><strong>Avg Tax Rate:</strong> ${avgTaxRate.toFixed(1)}%</li>
                <li><strong>Healthcare Costs:</strong> $${results.healthcareCosts.averageAnnual.toLocaleString()}/year</li>
            </ul>
        `;

        document.getElementById('breakdown-content').innerHTML = html;
    },

    _saveScenario() {
        alert('✅ Scenario saved!');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppV4.init();
});

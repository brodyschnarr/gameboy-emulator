// ═══════════════════════════════════════════
//  Retirement Planner V4 - Complete Controller
// ═══════════════════════════════════════════

// Format money: $1,234,567 (no decimals, rounds large numbers)
function fmtMoney(amount) {
    return '$' + Math.round(amount).toLocaleString();
}

// Check dependencies

const AppV4 = {
    currentStep: 'basic',
    familyStatus: 'single',
    selectedProvince: null,
    selectedRegion: null,
    healthStatus: 'average',
    cppStartAge: 65,
    cppStartAgeP1: 65,
    cppStartAgeP2: 65,
    visitedSteps: new Set(['basic']),
    scenarioResults: {},
    currentScenario: 'base',
    windfalls: [],

    init() {
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
            if (this.familyStatus === 'couple') this._updateCPPPreviewCouple();
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

        // Make progress steps clickable for navigation
        const steps = ['basic', 'savings', 'contributions', 'retirement', 'healthcare'];
        document.querySelectorAll('.progress-step').forEach((el, index) => {
            el.addEventListener('click', () => {
                const targetStep = steps[index];
                // Allow clicking completed or active steps
                if (el.classList.contains('completed') || el.classList.contains('active')) {
                    this._showStep(targetStep);
                }
            });
        });
    },

    _setupFamilyMode() {
        const singleBtn = document.getElementById('family-single');
        const coupleBtn = document.getElementById('family-couple');

        if (!singleBtn || !coupleBtn) {
            return;
        }


        singleBtn.addEventListener('click', () => {
            singleBtn.classList.add('active');
            coupleBtn.classList.remove('active');
            this.familyStatus = 'single';
            this._toggleFamilyUI();
        });

        coupleBtn.addEventListener('click', () => {
            coupleBtn.classList.add('active');
            singleBtn.classList.remove('active');
            this.familyStatus = 'couple';
            this._toggleFamilyUI();
        });
    },

    _toggleFamilyUI() {
        const isCouple = this.familyStatus === 'couple';

        // Show/hide partner age
        const partnerAgeGroup = document.getElementById('partner-age-group');
        if (partnerAgeGroup) {
            partnerAgeGroup.classList.toggle('hidden', !isCouple);
        }

        // Show/hide income sections
        const singleSection = document.getElementById('income-section-single');
        const coupleSection = document.getElementById('income-section-couple');

        if (singleSection) {
            singleSection.classList.toggle('hidden', isCouple);
        }
        if (coupleSection) {
            coupleSection.classList.toggle('hidden', !isCouple);
        }

                // Toggle CPP sections
        const cppSingle = document.getElementById('cpp-section-single');
        const cppCouple = document.getElementById('cpp-section-couple');
        if (cppSingle) cppSingle.classList.toggle('hidden', isCouple);
        if (cppCouple) cppCouple.classList.toggle('hidden', !isCouple);

        // Update household income if couple
        if (isCouple) {
            this._updateHouseholdIncome();
        }

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
            this.selectedProvince = province;
            this.selectedRegion = region;

            document.getElementById('province').value = province;
            document.getElementById('region').value = region;

            // Update benchmarks based on new selection
            this._updateRegionalBenchmarks();
        };

        // Set default location
        CanadaMap.setSelection('ON', 'ON_Toronto');

        // Manually trigger the callback to ensure state is set
        this.selectedProvince = 'ON';
        this.selectedRegion = 'ON_Toronto';
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

        // When user manually edits spending, clear active preset
        const spendingInput = document.getElementById('annual-spending');
        if (spendingInput) {
            spendingInput.addEventListener('input', () => {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                this._updateSpendingRecommendation();
            });
        }

        // Close detail
        const closeBtn = document.getElementById('close-detail');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('lifestyle-detail')?.classList.add('hidden');
            });
        }
    },

    _setupCPPOptimizer() {
        // Single CPP slider
        const slider = document.getElementById('cpp-start-age');
        if (slider) {
            slider.addEventListener('input', (e) => {
                this.cppStartAge = parseInt(e.target.value);
                this._updateCPPPreview();
            });
        }

        // Couple CPP sliders
        const sliderP1 = document.getElementById('cpp-start-age-p1');
        const sliderP2 = document.getElementById('cpp-start-age-p2');

        if (sliderP1) {
            sliderP1.addEventListener('input', (e) => {
                this.cppStartAgeP1 = parseInt(e.target.value);
                this._updateCPPPreviewCouple();
            });
        }
        if (sliderP2) {
            sliderP2.addEventListener('input', (e) => {
                this.cppStartAgeP2 = parseInt(e.target.value);
                this._updateCPPPreviewCouple();
            });
        }

        // CPP details buttons
        const detailsBtn = document.getElementById('btn-cpp-details');
        if (detailsBtn) {
            detailsBtn.addEventListener('click', () => {
                this._showCPPComparison();
            });
        }
        const detailsBtnCouple = document.getElementById('btn-cpp-details-couple');
        if (detailsBtnCouple) {
            detailsBtnCouple.addEventListener('click', () => {
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
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => {

                if (this._validateAllInputs()) {
                    this._runCalculation();
                } else {
                }
            });
        } else {
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

        // Track visited steps
        this.visitedSteps.add(step);

        // Hide all steps
        steps.forEach(s => {
            document.getElementById(`step-${s}`)?.classList.add('hidden');
        });

        // Show target step
        document.getElementById(`step-${step}`)?.classList.remove('hidden');
        this.currentStep = step;
        
        // Auto-update previews when entering certain steps
        if (step === 'retirement') {
            this._updateSpendingRecommendation();
            this._updateCPPPreview();
            if (this.familyStatus === 'couple') this._updateCPPPreviewCouple();
        }
        
        // Update progress indicator
        const currentIndex = steps.indexOf(step);
        document.querySelectorAll('.progress-step').forEach((el, index) => {
            el.classList.remove('active', 'completed');
            if (index === currentIndex) {
                el.classList.add('active');
            } else if (this.visitedSteps.has(steps[index])) {
                el.classList.add('completed');
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

    _updateCPPPreviewCouple() {
        const income1 = parseFloat(document.getElementById('income-person1')?.value) || 60000;
        const income2 = parseFloat(document.getElementById('income-person2')?.value) || 60000;
        const retirementAge = parseInt(document.getElementById('retirement-age')?.value) || 65;
        const yearsContributing = Math.min(retirementAge - 18, 39);

        const ageP1 = this.cppStartAgeP1 || 65;
        const ageP2 = this.cppStartAgeP2 || 65;

        const base1 = CPPCalculator.estimateCPP(income1, yearsContributing);
        const base2 = CPPCalculator.estimateCPP(income2, yearsContributing);
        const adjusted1 = CPPOptimizer.calculateByAge(base1.total, ageP1);
        const adjusted2 = CPPOptimizer.calculateByAge(base2.total, ageP2);

        // Person 1
        const ageEl1 = document.getElementById('cpp-age-value-p1');
        const amtEl1 = document.getElementById('cpp-amount-value-p1');
        if (ageEl1) ageEl1.textContent = ageP1;
        if (amtEl1) amtEl1.textContent = `$${Math.round(adjusted1).toLocaleString()}/year`;

        // Person 2
        const ageEl2 = document.getElementById('cpp-age-value-p2');
        const amtEl2 = document.getElementById('cpp-amount-value-p2');
        if (ageEl2) ageEl2.textContent = ageP2;
        if (amtEl2) amtEl2.textContent = `$${Math.round(adjusted2).toLocaleString()}/year`;

        // Combined total
        const combinedEl = document.getElementById('cpp-combined-value');
        if (combinedEl) {
            combinedEl.textContent = `$${Math.round(adjusted1 + adjusted2).toLocaleString()}/year`;
        }
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

            // Check if RetirementCalcV4 exists
            if (typeof RetirementCalcV4 === 'undefined') {
                alert('❌ Calculation engine not loaded. Please refresh the page.');
                return;
            }

            // Calculate base scenario
            const baseResults = RetirementCalcV4.calculate(inputs);

            // Apply windfalls to base calculation (deterministic - 100% probability)
            this._applyWindfallsToResults(baseResults, inputs);

            // Store base scenario
            this.scenarioResults = {
                base: { inputs, results: baseResults }
            };

            // Auto-calculate common scenarios
            this._autoCalculateScenarios(inputs);

            // FIX: Show results section FIRST (so charts can measure parent dimensions correctly)
            ['basic', 'savings', 'contributions', 'retirement', 'healthcare'].forEach(s => {
                document.getElementById(`step-${s}`)?.classList.add('hidden');
            });
            document.getElementById('results')?.classList.remove('hidden');

            // NOW display results (charts will draw to visible parent)
            this.currentScenario = 'base';
            this._displayResults(baseResults, inputs);

            // Setup scenario tab switching (after results are visible)
            this._setupScenarioTabs();

            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Run V5 Enhanced Analysis (Monte Carlo, Tax Optimization, What-If)
            if (typeof AppV5Enhanced !== 'undefined') {
                AppV5Enhanced.runEnhancedAnalysis(inputs, baseResults);

                // Use Monte Carlo success rate as the authoritative probability
                if (AppV5Enhanced.monteCarloResults) {
                    this.monteCarloResults = AppV5Enhanced.monteCarloResults;

                    // Update the main results display with Monte Carlo probability
                    const mcRate = AppV5Enhanced.monteCarloResults.successRate;
                    const probEl = document.getElementById('success-probability');
                    const probNote = document.getElementById('probability-note');
                    if (probEl) probEl.textContent = `${mcRate}%`;
                    if (probNote) {
                        probNote.textContent = `${mcRate >= 80 ? 'Strong' : mcRate >= 60 ? 'Moderate' : 'Needs work'} - based on 1,000 market simulations`;
                        probNote.style.color = mcRate >= 80 ? 'var(--success)' : mcRate >= 60 ? 'var(--warning)' : 'var(--danger)';
                    }
                }
            }
        } catch (error) {
            alert(`❌ Calculation failed: ${error.message}\n\nPlease check the console for details.`);
        }
    },

    _applyWindfallsToResults(results, inputs) {
        if (!inputs.windfalls || inputs.windfalls.length === 0) {
            return;
        }


        inputs.windfalls.forEach(windfall => {
            // Handle both calendar year (e.g., 2030) and age (e.g., 65)
            let targetAge;
            if (windfall.year > 150) {
                // Likely a calendar year, convert to age
                const currentYear = new Date().getFullYear();
                const yearsFromNow = windfall.year - currentYear;
                targetAge = inputs.currentAge + yearsFromNow;
            } else {
                // Already an age or yearsFromNow offset
                targetAge = windfall.year || (inputs.currentAge + (windfall.yearsFromNow || 0));
            }

            const yearIndex = results.yearByYear.findIndex(y => y.age === targetAge);

            if (yearIndex === -1) {
                if (typeof MobileDebug !== 'undefined') {
                    MobileDebug.addLog(`❌ Windfall age ${targetAge} out of range!`, true);
                }
                return; // Year not in projection
            }

            // Calculate after-tax amount (simplified)
            const afterTaxAmount = windfall.taxable
                ? windfall.amount * 0.7 // 30% tax rate (simplified)
                : windfall.amount;


            // Add windfall to appropriate account(s) for THIS year and all future years
            for (let i = yearIndex; i < results.yearByYear.length; i++) {
                const year = results.yearByYear[i];
                const returnRate = inputs.returnRate / 100;
                const yearsFromWindfall = i - yearIndex;
                const grownAmount = afterTaxAmount * Math.pow(1 + returnRate, yearsFromWindfall);

                if (windfall.destination === 'rrsp') {
                    year.rrsp = (year.rrsp || 0) + grownAmount;
                } else if (windfall.destination === 'tfsa') {
                    year.tfsa = (year.tfsa || 0) + grownAmount;
                } else if (windfall.destination === 'nonReg') {
                    year.nonReg = (year.nonReg || 0) + grownAmount;
                } else if (windfall.destination === 'split') {
                    year.tfsa = (year.tfsa || 0) + (grownAmount * 0.5);
                    year.nonReg = (year.nonReg || 0) + (grownAmount * 0.5);
                }

                // Update total (include ALL accounts)
                const newTotal = (year.rrsp || 0) + (year.tfsa || 0) + (year.nonReg || 0) + (year.other || 0);
                year.totalPortfolio = newTotal;
                year.totalBalance = newTotal; // CRITICAL: Also update totalBalance for chart display!
            }

            // Mark windfall in the year it occurs
            results.yearByYear[yearIndex].windfall = {
                name: windfall.name,
                amount: windfall.amount,
                afterTaxAmount
            };
        });

        // Recalculate summary based on updated projection
        const lastYear = results.yearByYear[results.yearByYear.length - 1];
        const retirementYear = results.yearByYear.find(y => y.age === inputs.retirementAge);

        if (retirementYear) {
            // Use totalBalance (that's what the base calculation creates)
            results.summary.portfolioAtRetirement = retirementYear.totalBalance || retirementYear.totalPortfolio || 0;
        }

        results.summary.legacyAmount = Math.round(lastYear.totalBalance || lastYear.totalPortfolio || 0);

        // FIX: Also update results.legacy object (display uses this, not summary.legacyAmount!)
        results.legacy.amount = results.summary.legacyAmount;
        results.legacy.description = results.summary.legacyAmount > 0
            ? `You'll leave an estate of ${fmtMoney(results.summary.legacyAmount)} for your beneficiaries.`
            : 'No legacy remaining - money runs out before end of life.';


        // Find when money runs out (check totalBalance first, then totalPortfolio)
        const runOutYear = results.yearByYear.find(y => {
            const balance = y.totalBalance !== undefined ? y.totalBalance : y.totalPortfolio;
            return (balance || 0) <= 0;
        });
        results.summary.moneyLastsAge = runOutYear ? runOutYear.age : inputs.lifeExpectancy;

        // Recalculate probability based on updated projection
        const yearsShort = runOutYear ? (inputs.lifeExpectancy - runOutYear.age) : 0;
        if (yearsShort === 0) {
            // Money lasts through life expectancy
            results.probability = Math.min(100, 75 + Math.floor(results.summary.legacyAmount / 50000));
            results.onTrack = true;
        } else {
            // Money runs out early
            const retirementYears = inputs.lifeExpectancy - inputs.retirementAge;
            const successRatio = (retirementYears - yearsShort) / retirementYears;
            results.probability = Math.round(successRatio * 100);
            results.onTrack = results.probability >= 70;
        }

    },

    _autoCalculateScenarios(baseInputs) {

        const scenarios = {
            retire5early: {
                ...baseInputs,
                windfalls: [...(baseInputs.windfalls || [])], // Deep clone windfalls
                retirementAge: baseInputs.retirementAge - 5
            },
            retire5late: {
                ...baseInputs,
                windfalls: [...(baseInputs.windfalls || [])], // Deep clone windfalls
                retirementAge: baseInputs.retirementAge + 5
            },
            spend20less: {
                ...baseInputs,
                windfalls: [...(baseInputs.windfalls || [])], // Deep clone windfalls
                annualSpending: Math.round(baseInputs.annualSpending * 0.8)
            },
            spend20more: {
                ...baseInputs,
                windfalls: [...(baseInputs.windfalls || [])], // Deep clone windfalls
                annualSpending: Math.round(baseInputs.annualSpending * 1.2)
            }
        };

        // Calculate each scenario and apply windfalls
        Object.keys(scenarios).forEach(key => {
            const scenarioInputs = scenarios[key];
            const results = RetirementCalcV4.calculate(scenarioInputs);

            // Apply windfalls to this scenario too
            this._applyWindfallsToResults(results, scenarioInputs);

            this.scenarioResults[key] = {
                inputs: scenarioInputs,
                results
            };
        });

    },

    _setupScenarioTabs() {
        // FIX: Use event delegation instead of cloning (more robust)
        const tabContainer = document.getElementById('scenario-tabs');
        if (!tabContainer) {
            return;
        }

        const tabs = tabContainer.querySelectorAll('.scenario-tab');

        // Remove old listener if it exists
        if (tabContainer._scenarioClickHandler) {
            tabContainer.removeEventListener('click', tabContainer._scenarioClickHandler);
        }

        // Add delegated listener to parent container
        const handler = (e) => {
            const tab = e.target.closest('.scenario-tab');
            if (!tab) {
                return; // Click wasn't on a tab
            }

            e.preventDefault();
            const scenario = tab.dataset.scenario;

            // Update active state
            tabContainer.querySelectorAll('.scenario-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Switch scenario
            this._switchScenario(scenario);
        };

        // Store handler reference for cleanup
        tabContainer._scenarioClickHandler = handler;
        tabContainer.addEventListener('click', handler);

    },

    _switchScenario(scenarioKey) {
        if (!this.scenarioResults[scenarioKey]) {
            return;
        }

        // Display scenario results (active state handled by _setupScenarioTabs)
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

            cppStartAge: this.familyStatus === 'couple' ? (this.cppStartAgeP1 || 65) : this.cppStartAge,
            cppStartAgeP2: this.familyStatus === 'couple' ? (this.cppStartAgeP2 || 65) : null,
            additionalIncomeSources: IncomeSources.getAll(),
            windfalls: this.windfalls || [],

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
        const portfolio = results.summary.portfolioAtRetirement || 0;
        const income = results.summary.annualIncomeAtRetirement || 0;
        const lastsAge = results.summary.moneyLastsAge || inputs.lifeExpectancy;

        // FIX: Use Monte Carlo probability if available (more accurate than deterministic)
        let probability = results.probability || 0;
        if (this.monteCarloResults && this.monteCarloResults.successRate !== undefined) {
            probability = this.monteCarloResults.successRate;
        } else {
        }


        document.getElementById('stat-portfolio').textContent = fmtMoney(portfolio);
        document.getElementById('stat-income').textContent = fmtMoney(income);
        document.getElementById('stat-lasts').textContent =
            `Age ${lastsAge}`;
        document.getElementById('stat-probability').textContent =
            `${probability}%`;

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
        document.getElementById('legacy-amount').textContent = fmtMoney(results.legacy.amount);
        document.getElementById('legacy-description').textContent =
            results.legacy.description;

        // Charts
        try {
            this._drawChart(results.yearByYear, inputs.retirementAge);
            this._drawYearBreakdown(results.yearByYear, inputs.retirementAge);
        } catch (chartError) {
            const status = document.getElementById('chart-status');
            if (status) {
                status.style.display = 'block';
                status.style.background = '#fee2e2';
                status.innerHTML = `❌ Chart error: ${chartError.message}`;
            }
        }

        this._displayBreakdown(results, inputs);
    },

    _drawChart(yearByYear, retirementAge) {
        const canvas = document.getElementById('projection-chart');
        if (!canvas) throw new Error('Canvas element not found');

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get 2D context');

        // Set dimensions
        const parent = canvas.parentElement;
        const width = Math.max((parent ? parent.offsetWidth : 300) - 40, 300);
        canvas.width = width;
        canvas.height = 400;

        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;

        // Clear and set background
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        if (!yearByYear || yearByYear.length === 0) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data to display', w / 2, h / 2);
            return;
        }

        const balances = yearByYear.map(y => y.totalBalance || y.totalPortfolio || 0);
        const maxBalance = Math.max(...balances);

        if (maxBalance === 0 || isNaN(maxBalance)) {
            ctx.fillStyle = '#ef4444';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No valid balance data', w / 2, h / 2);
            return;
        }

        const minAge = yearByYear[0].age;
        const maxAge = yearByYear[yearByYear.length - 1].age;

        // Draw axes
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
            const balance = point.totalBalance || point.totalPortfolio || 0;
            const y = h - padding - (balance / maxBalance) * (h - 2 * padding);
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
            // FIX: Use fallback for total balance
            const total = year.totalBalance || year.totalPortfolio || 0;
            const rrspPct = total > 0 ? ((year.rrsp || 0) / total) * 100 : 0;
            const tfsaPct = total > 0 ? ((year.tfsa || 0) / total) * 100 : 0;
            const nonRegPct = total > 0 ? ((year.nonReg || 0) / total) * 100 : 0;
            const otherPct = total > 0 ? ((year.other || 0) / total) * 100 : 0;

            return `
                <div class="year-bar-row">
                    <div class="year-label">Age ${year.age}</div>
                    <div class="year-bar" title="Total: ${fmtMoney(total)}">
                        ${year.rrsp > 0 ? `<div class="bar-segment rrsp" style="width: ${rrspPct}%" title="RRSP: ${fmtMoney(year.rrsp)} (${rrspPct.toFixed(0)}%)"></div>` : ''}
                        ${year.tfsa > 0 ? `<div class="bar-segment tfsa" style="width: ${tfsaPct}%" title="TFSA: ${fmtMoney(year.tfsa)} (${tfsaPct.toFixed(0)}%)"></div>` : ''}
                        ${year.nonReg > 0 ? `<div class="bar-segment nonreg" style="width: ${nonRegPct}%" title="Non-Reg: ${fmtMoney(year.nonReg)} (${nonRegPct.toFixed(0)}%)"></div>` : ''}
                        ${year.other > 0 ? `<div class="bar-segment other" style="width: ${otherPct}%" title="Other: ${fmtMoney(year.other)} (${otherPct.toFixed(0)}%)"></div>` : ''}
                    </div>
                    <div class="year-breakdown-details">
                        <div class="year-total">${fmtMoney(total)}</div>
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

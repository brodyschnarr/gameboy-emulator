// ═══════════════════════════════════════════
//  Retirement Planner V4 - Complete Controller
// ═══════════════════════════════════════════

// Format money: $1,234,567 (no decimals, rounds large numbers)
function fmtMoney(amount) {
    return '$' + Math.round(amount).toLocaleString();
}

// Format money with millions shorthand: $1.2M, $450K, $1,234
function fmtCompact(amount) {
    const n = Math.round(Math.abs(amount));
    const sign = amount < 0 ? '-' : '';
    if (n >= 1000000) {
        const m = n / 1000000;
        return sign + '$' + (m >= 10 ? Math.round(m) + 'M' : m.toFixed(1).replace(/\.0$/, '') + 'M');
    }
    if (n >= 10000) return sign + '$' + Math.round(n / 1000) + 'K';
    return sign + '$' + n.toLocaleString();
}

// Check dependencies

const AppV4 = {
    currentStep: 'basic',
    familyStatus: 'single',
    selectedProvince: null,
    selectedRegion: null,
    healthStatus: 'average',
    healthcareExplicitlyAdded: false,
    cppStartAge: 65,
    cppStartAgeP1: 65,
    cppStartAgeP2: 65,
    cppOverride: null,       // Single mode: annual CPP at 65 (null = use estimate)
    cppOverrideP1: null,     // Couple mode: person 1
    cppOverrideP2: null,     // Couple mode: person 2
    visitedSteps: new Set(['basic']),
    scenarioResults: {},
    currentScenario: 'base',
    windfalls: [],
    otherIncomeItems: [],   // Multi-add: [{name, amount, taxable}]
    otherExpenseItems: [],  // Multi-add: [{name, amount}]

    init() {
        this._setupNavigation();
        this._setupFamilyMode();
        this._setupMap();
        this._setupIncome();
        this._setupBenchmarks();
        this._setupPresets();
        this._setupCPPOptimizer();
        this._setupOASOptimizer();
        this._setupSplitValidation();
        this._setupHealthcare();
        this._setupDebt();
        this._setupCustomSpending();
        this._setupIncomeSources();
        this._setupPostRetirementWork();
        this._setupHouseSale();
        this._setupWindfalls();
        this._setupEstateAssets();
        this._setupStep5Dropdowns();
        this._setupCalculate();
        this._setupScenarios();
        this._setupModals();
        this._setupAdvancedToggle();
        this._setupCategoryInflation();
        this._setupSpendingCurve();
        this._restoreFormState();
        this._setupFormAutosave();
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
        this._updateSpendingPresets();
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

        // Toggle OAS sections
        const oasSingle = document.getElementById('oas-section-single');
        const oasCouple = document.getElementById('oas-section-couple');
        if (oasSingle) oasSingle.classList.toggle('hidden', isCouple);
        if (oasCouple) oasCouple.classList.toggle('hidden', !isCouple);
        
        // Show/hide couple accounts toggle
        const coupleAcctToggle = document.getElementById('couple-accounts-toggle');
        if (coupleAcctToggle) coupleAcctToggle.classList.toggle('hidden', !isCouple);

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
        this._updateSpendingPresets();
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
        ['rrsp', 'tfsa', 'nonreg', 'lira', 'other', 'cash',
         'rrsp-p1', 'tfsa-p1', 'nonreg-p1', 'lira-p1', 'other-p1', 'cash-p1',
         'rrsp-p2', 'tfsa-p2', 'nonreg-p2', 'lira-p2', 'other-p2', 'cash-p2'].forEach(id => {
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

        // Live update contribution benchmark & grounding on slider/input change
        const contribInput = document.getElementById('monthly-contribution');
        if (contribInput) {
            contribInput.addEventListener('input', () => {
                this._updateContributionBenchmark();
                this._updateContributionGrounding();
            });
        }
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
                    if (window.syncSlider) window.syncSlider('annual-spending');
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

        // CPP override toggles
        const overrideToggle = document.getElementById('cpp-override-toggle');
        if (overrideToggle) {
            overrideToggle.addEventListener('change', () => {
                const input = document.getElementById('cpp-override-input');
                if (input) input.classList.toggle('hidden', !overrideToggle.checked);
                this.cppOverride = overrideToggle.checked
                    ? parseFloat(document.getElementById('cpp-override-amount')?.value) || null
                    : null;
                this._updateCPPPreview();
            });
            const overrideAmt = document.getElementById('cpp-override-amount');
            if (overrideAmt) {
                overrideAmt.addEventListener('input', () => {
                    if (overrideToggle.checked) {
                        this.cppOverride = parseFloat(overrideAmt.value) || null;
                        this._updateCPPPreview();
                    }
                });
            }
        }

        const overrideToggleCouple = document.getElementById('cpp-override-toggle-couple');
        if (overrideToggleCouple) {
            overrideToggleCouple.addEventListener('change', () => {
                const input = document.getElementById('cpp-override-input-couple');
                if (input) input.classList.toggle('hidden', !overrideToggleCouple.checked);
                if (overrideToggleCouple.checked) {
                    this.cppOverrideP1 = parseFloat(document.getElementById('cpp-override-amount-p1')?.value) || null;
                    this.cppOverrideP2 = parseFloat(document.getElementById('cpp-override-amount-p2')?.value) || null;
                } else {
                    this.cppOverrideP1 = null;
                    this.cppOverrideP2 = null;
                }
                this._updateCPPPreviewCouple();
            });
            ['cpp-override-amount-p1', 'cpp-override-amount-p2'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', () => {
                        if (overrideToggleCouple.checked) {
                            this.cppOverrideP1 = parseFloat(document.getElementById('cpp-override-amount-p1')?.value) || null;
                            this.cppOverrideP2 = parseFloat(document.getElementById('cpp-override-amount-p2')?.value) || null;
                            this._updateCPPPreviewCouple();
                        }
                    });
                }
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

    _setupOASOptimizer() {
        // Single OAS
        const slider = document.getElementById('oas-start-age');
        if (slider) {
            this.oasStartAge = 65;
            slider.addEventListener('input', (e) => {
                this.oasStartAge = parseInt(e.target.value);
                this._updateOASPreview();
            });
            this._updateOASPreview();
        }
        // Couple OAS
        const sliderP1 = document.getElementById('oas-start-age-p1');
        const sliderP2 = document.getElementById('oas-start-age-p2');
        this.oasStartAgeP1 = 65;
        this.oasStartAgeP2 = 65;
        if (sliderP1) {
            sliderP1.addEventListener('input', (e) => {
                this.oasStartAgeP1 = parseInt(e.target.value);
                this._updateOASPreviewCouple();
            });
        }
        if (sliderP2) {
            sliderP2.addEventListener('input', (e) => {
                this.oasStartAgeP2 = parseInt(e.target.value);
                this._updateOASPreviewCouple();
            });
        }
        this._updateOASPreviewCouple();
    },

    _calcOAS(age) {
        const oasBase = 8479;
        const monthsDeferred = Math.max(0, (age - 65)) * 12;
        const bonus = monthsDeferred * 0.006;
        return { amount: Math.round(oasBase * (1 + bonus)), bonus };
    },

    _updateOASPreview() {
        const age = this.oasStartAge || 65;
        const { amount, bonus } = this._calcOAS(age);
        
        const ageEl = document.getElementById('oas-age-value');
        const amountEl = document.getElementById('oas-amount-value');
        const bonusEl = document.getElementById('oas-bonus-value');
        
        if (ageEl) ageEl.textContent = age;
        if (amountEl) amountEl.textContent = '$' + amount.toLocaleString() + '/year';
        if (bonusEl) bonusEl.textContent = bonus > 0 ? `+${Math.round(bonus * 100)}%` : 'No bonus';
    },

    _updateOASPreviewCouple() {
        const age1 = this.oasStartAgeP1 || 65;
        const age2 = this.oasStartAgeP2 || 65;
        const oas1 = this._calcOAS(age1);
        const oas2 = this._calcOAS(age2);

        const amtEl1 = document.getElementById('oas-amount-value-p1');
        const bonEl1 = document.getElementById('oas-bonus-value-p1');
        const amtEl2 = document.getElementById('oas-amount-value-p2');
        const bonEl2 = document.getElementById('oas-bonus-value-p2');
        const combinedEl = document.getElementById('oas-combined-value');

        if (amtEl1) amtEl1.textContent = '$' + oas1.amount.toLocaleString() + '/year';
        if (bonEl1) bonEl1.textContent = oas1.bonus > 0 ? `+${Math.round(oas1.bonus * 100)}%` : 'No bonus';
        if (amtEl2) amtEl2.textContent = '$' + oas2.amount.toLocaleString() + '/year';
        if (bonEl2) bonEl2.textContent = oas2.bonus > 0 ? `+${Math.round(oas2.bonus * 100)}%` : 'No bonus';
        if (combinedEl) combinedEl.textContent = '$' + (oas1.amount + oas2.amount).toLocaleString() + '/year';
    },

    _setupSplitValidation() {
        const rrspEl = document.getElementById('split-rrsp');
        const tfsaEl = document.getElementById('split-tfsa');
        const nonRegEl = document.getElementById('split-nonreg');
        const warning = document.getElementById('split-warning');
        
        const validate = () => {
            const total = (parseFloat(rrspEl?.value) || 0) + (parseFloat(tfsaEl?.value) || 0) + (parseFloat(nonRegEl?.value) || 0);
            if (warning) {
                warning.style.display = (Math.abs(total - 100) > 0.5 && total > 0) ? '' : 'none';
            }
        };
        
        [rrspEl, tfsaEl, nonRegEl].forEach(el => {
            if (el) el.addEventListener('input', validate);
        });
    },

    _setupHealthcare() {
        // Slider-based health selector
        const healthSlider = document.getElementById('health-status-slider');
        if (healthSlider) {
            const healthMap = ['excellent', 'average', 'fair'];
            healthSlider.addEventListener('input', () => {
                this.healthStatus = healthMap[parseInt(healthSlider.value)];
                this._updateHealthcarePreview();
            });
        }
        // Legacy: button-based health selector (fallback)
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
        // Render Step 5 retirement income summary (initially empty)
        IncomeSources._renderRetirementSummary();
    },

    _setupCustomSpending() {
        const toggleBtn = document.getElementById('btn-toggle-custom-spending');
        const form = document.getElementById('custom-spending-form');
        
        if (toggleBtn && form) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = form.classList.toggle('hidden');
                toggleBtn.textContent = isHidden 
                    ? '📝 Customize spending by category →' 
                    : '📝 Hide category breakdown ←';
                    
                // If opening, populate from current preset or spending amount
                if (!isHidden) this._populateCustomSpending();
            });
        }
        
        // Listen for changes on all custom inputs
        document.querySelectorAll('.custom-spend-input').forEach(input => {
            input.addEventListener('input', () => {
                this._updateCustomSpendingTotal();
                this._updateSpendingHints();
            });
        });
    },

    _populateCustomSpending() {
        // Try to use lifestyle preset data, or fall back to even split
        const spending = parseFloat(document.getElementById('annual-spending')?.value) || 48000;
        const activePreset = document.querySelector('.preset-btn.active');
        const presetKey = activePreset?.dataset.lifestyle;
        
        if (presetKey && typeof LifestyleData !== 'undefined' && LifestyleData[presetKey]) {
            const data = LifestyleData[presetKey];
            document.querySelectorAll('.custom-spend-input').forEach(input => {
                const cat = input.dataset.category;
                if (data.breakdown[cat]) {
                    input.value = data.breakdown[cat].monthly;
                }
            });
        } else {
            // Proportional split based on typical Canadian retiree spending
            // Housing ~30%, Food ~15%, Transport ~10%, Healthcare ~6%, Travel ~10%, Entertainment ~12%, Misc ~17%
            const proportions = {
                housing: 0.30,
                food: 0.15,
                transportation: 0.10,
                healthcare: 0.06,
                travel: 0.10,
                entertainment: 0.12,
                misc: 0.17
            };
            const monthly = spending / 12;
            document.querySelectorAll('.custom-spend-input').forEach(input => {
                const cat = input.dataset.category;
                const pct = proportions[cat] || 0.14;
                input.value = Math.round(monthly * pct / 50) * 50; // round to nearest $50
            });
        }
        this._updateSpendingHints();
        
        // Update category total display WITHOUT overwriting the main spending input
        // (category rounding causes drift — preserve user's exact amount)
        let monthlyTotal = 0;
        document.querySelectorAll('.custom-spend-input').forEach(input => {
            monthlyTotal += parseFloat(input.value) || 0;
        });
        const monthlyEl = document.getElementById('custom-spending-monthly');
        const annualEl = document.getElementById('custom-spending-annual');
        if (monthlyEl) monthlyEl.textContent = '$' + Math.round(monthlyTotal).toLocaleString();
        if (annualEl) annualEl.textContent = '$' + Math.round(monthlyTotal * 12).toLocaleString();
    },

    // Spending hints: concrete examples of what each amount gets you
    _spendingHintData: {
        housing: [
            [0, 500, '= Living with family or very low-cost shared housing'],
            [500, 900, '= Paid-off home: ~$300/mo property tax + $200 utilities + basic repairs'],
            [900, 1500, '= Mortgage-free home: $350/mo tax, $250 utilities, $400 maintenance fund'],
            [1500, 2200, '= Nice home or condo: $400/mo tax, $300 utilities, $200 condo fees, upgrades'],
            [2200, 3500, '= Upscale: $500/mo tax + $500 condo fees + $300 utilities + cleaner + renos'],
            [3500, Infinity, '= Luxury property or two homes, premium condo fees, full-service maintenance']
        ],
        food: [
            [0, 300, '= ~$10/day — rice, beans, basics, cooking every meal at home'],
            [300, 500, '= ~$15/day — groceries at home + takeout/fast food 1-2x/week'],
            [500, 800, '= ~$25/day — good groceries ($400) + restaurants 1-2x/week ($100-400)'],
            [800, 1200, '= ~$35/day — organic produce, dining out 2-3x/week, wine with dinner'],
            [1200, 2000, '= ~$55/day — Whole Foods groceries, fine dining weekly, wine collection'],
            [2000, Infinity, '= Premium everything, restaurants 4-5x/week, private chef occasionally']
        ],
        transportation: [
            [0, 150, '= Bus pass ($100) or cycling, no car payment or insurance'],
            [150, 350, '= 1 paid-off car: $150 insurance + $100 gas + $50 oil changes/tires'],
            [350, 600, '= Reliable 5-8yr car: $200 insurance + $150 gas + $100 maintenance + parking'],
            [600, 1000, '= Newer SUV or 2 cars: $350 insurance + $200 gas + $150 maintenance'],
            [1000, 1500, '= Leased luxury car ($500) + insurance ($250) + gas + detailing'],
            [1500, Infinity, '= 2 luxury vehicles, both leased/financed, premium everything']
        ],
        healthcare: [
            [0, 150, '= Provincial coverage only + maybe $50/mo in vitamins/Tylenol'],
            [150, 300, '= Prescriptions ($80) + dental cleaning 2x/yr ($60) + glasses ($40) + supplements'],
            [300, 500, '= Extended health plan ($150) + dental ($100) + massage 1x/mo ($80) + vision'],
            [500, 800, '= Premium plan ($200) + dental ($150) + physio/massage ($150) + specialists'],
            [800, 1200, '= Concierge doctor ($400) + full dental ($200) + wellness programs + naturopath'],
            [1200, Infinity, '= Private clinic membership, all specialists, wellness retreats, premium dental']
        ],
        travel: [
            [0, 125, '= ~$1,500/yr — visiting family by car, 1-2 weekend road trips or camping'],
            [125, 300, '= ~$3,000/yr — 1-2 domestic flights + hotels, maybe Mexico every 2-3 years'],
            [300, 600, '= ~$5,000/yr — 2-3 trips: e.g. Florida in winter + a week in Europe'],
            [600, 1250, '= ~$10,000/yr — 3-4 trips, 1-2 international (Europe, Caribbean), nice hotels'],
            [1250, 2500, '= ~$20,000/yr — frequent travel, business class, resorts, Alaska cruise + Europe'],
            [2500, Infinity, '= $30K+/yr — first class, 5-star resorts, Africa safari, multiple international']
        ],
        entertainment: [
            [0, 150, '= Netflix + Spotify ($30) + library + parks + free community events'],
            [150, 350, '= Streaming ($40) + gym ($50) + 1 concert/mo ($80) + hobbies ($100)'],
            [350, 600, '= Golf green fees ($150) + streaming ($40) + concerts/theatre ($150) + hobbies ($200)'],
            [600, 1000, '= Golf membership ($300) + gym ($60) + season tickets ($200) + hobbies ($300)'],
            [1000, 1500, '= Club membership ($500) + premium hobbies ($400) + events ($300) + sports ($200)'],
            [1500, Infinity, '= Yacht/country club, art collecting, expensive hobbies, VIP experiences']
        ],
        misc: [
            [0, 200, '= Basic clothing ($50) + household supplies ($50) + small gifts ($50) + haircuts'],
            [200, 450, '= Clothing ($100) + gifts for family ($100) + home supplies ($100) + phone/internet ($100)'],
            [450, 700, '= Wardrobe updates ($150) + gifts/grandkids ($200) + tech ($100) + home décor ($100)'],
            [700, 1200, '= Nice clothing ($250) + generous gifts ($300) + gadgets ($200) + home projects ($250)'],
            [1200, 1800, '= Designer clothing ($400) + lavish gifts ($400) + latest tech ($300) + upgrades ($300)'],
            [1800, Infinity, '= Premium wardrobe, philanthropy, concierge services, luxury goods']
        ]
    },

    _updateSpendingHints() {
        document.querySelectorAll('.custom-spend-input').forEach(input => {
            const cat = input.dataset.category;
            const val = parseFloat(input.value) || 0;
            const hintEl = document.getElementById('hint-' + cat);
            if (!hintEl) return;
            
            const ranges = this._spendingHintData[cat];
            if (!ranges) { hintEl.textContent = ''; return; }
            
            const match = ranges.find(([min, max]) => val >= min && val < max);
            if (match) {
                // Show actual yearly amount + description (strip any leading "= ~$X/yr — " pattern)
                const yearly = Math.round(val * 12);
                const desc = match[2].replace(/^= ~?\$[\d,]+\/yr\s*—?\s*/, '= ');
                hintEl.textContent = `$${yearly.toLocaleString()}/yr — ${desc.replace(/^= /, '')}`;
            } else {
                hintEl.textContent = '';
            }
        });
    },

    _updateCustomSpendingTotal() {
        let monthlyTotal = 0;
        document.querySelectorAll('.custom-spend-input').forEach(input => {
            monthlyTotal += parseFloat(input.value) || 0;
        });
        
        const annualTotal = monthlyTotal * 12;
        
        const monthlyEl = document.getElementById('custom-spending-monthly');
        const annualEl = document.getElementById('custom-spending-annual');
        if (monthlyEl) monthlyEl.textContent = '$' + Math.round(monthlyTotal).toLocaleString();
        if (annualEl) annualEl.textContent = '$' + Math.round(annualTotal).toLocaleString();
        
        // Update the main spending input
        const spendingInput = document.getElementById('annual-spending');
        if (spendingInput) {
            spendingInput.value = Math.round(annualTotal);
            spendingInput.dispatchEvent(new Event('input', { bubbles: true }));
            if (window.syncSlider) window.syncSlider('annual-spending');
        }
        
        // Clear active preset (user customized)
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    },

    _runSpendingOptimizer(inputs, results) {
        const section = document.getElementById('spending-optimizer');
        const content = document.getElementById('spending-optimizer-content');
        if (!section || !content) return;
        
        section.classList.remove('hidden');
        
        const currentSpending = inputs.annualSpending;
        const moneyLastsAge = results.summary.moneyLastsAge;
        const lifeExpectancy = inputs.lifeExpectancy;
        const legacy = results.summary.legacyAmount;
        const fmt = (v) => '$' + Math.round(v).toLocaleString();
        
        // Binary search for max sustainable spending (money lasts to life expectancy)
        let low = 10000;
        let high = currentSpending * 3;
        let maxSustainable = currentSpending;
        
        for (let iter = 0; iter < 20; iter++) {
            const testSpending = Math.round((low + high) / 2);
            const testResult = RetirementCalcV4.calculate({
                ...inputs,
                annualSpending: testSpending
            });
            
            if (testResult.summary.moneyLastsAge >= lifeExpectancy) {
                maxSustainable = testSpending;
                low = testSpending;
            } else {
                high = testSpending;
            }
            
            if (high - low < 1000) break;
        }
        
        // Round to nearest $1K
        maxSustainable = Math.floor(maxSustainable / 1000) * 1000;
        this._lastMaxSustainable = maxSustainable;
        
        let icon, amountClass, message, barClass;
        
        // Safety: if plan fails but optimizer says we can spend MORE, cap it
        if (moneyLastsAge < lifeExpectancy && maxSustainable >= currentSpending) {
            // Contradiction — recalculate more carefully
            // Try stepping down from currentSpending in $1K increments
            maxSustainable = currentSpending;
            for (let test = currentSpending; test >= 10000; test -= 1000) {
                const tr = RetirementCalcV4.calculate({ ...inputs, annualSpending: test });
                if (tr.summary.moneyLastsAge >= lifeExpectancy) {
                    maxSustainable = test;
                    break;
                }
            }
            this._lastMaxSustainable = maxSustainable;
        }

        const diff = maxSustainable - currentSpending;
        const pctOfMax = Math.min(100, (currentSpending / (maxSustainable || 1)) * 100);
        
        // Calculate savings guidance: how much more/less monthly savings to close the gap
        const currentContrib = inputs.monthlyContribution || 0;
        const yearsToRetire = Math.max(1, inputs.retirementAge - inputs.currentAge);
        let savingsGuidance = '';

        if (moneyLastsAge < lifeExpectancy) {
            // Binary search: find monthly contribution that makes plan last to lifeExpectancy
            let lo = currentContrib, hi = currentContrib + 5000;
            for (let i = 0; i < 20; i++) {
                const mid = Math.round((lo + hi) / 2);
                const test = RetirementCalcV4.calculate({ ...inputs, monthlyContribution: mid });
                if (test.summary.moneyLastsAge >= lifeExpectancy) {
                    hi = mid;
                } else {
                    lo = mid + 1;
                }
            }
            const extraNeeded = Math.max(0, hi - currentContrib);
            if (extraNeeded > 0) {
                savingsGuidance = `<br><small style="opacity:0.85">💰 Or save <strong>${fmt(extraNeeded)}/month</strong> more (${fmt(currentContrib + extraNeeded)}/mo total) to keep ${fmt(currentSpending)}/year.</small>`;
            }
        }

        if (moneyLastsAge < lifeExpectancy) {
            // Money runs out — need to cut
            icon = '⚠️';
            amountClass = 'need-to-cut';
            message = `Your plan runs out at age ${moneyLastsAge}. Reduce spending to <strong>${fmt(maxSustainable)}/year</strong> to last until ${lifeExpectancy}.`;
            message += savingsGuidance;
            barClass = 'danger';
        } else if (diff > 10000) {
            // Lots of room — show how much less they could save
            let savingsNote = '';
            if (currentContrib > 0) {
                let lo = 0, hi = currentContrib;
                for (let i = 0; i < 20; i++) {
                    const mid = Math.round((lo + hi) / 2);
                    const test = RetirementCalcV4.calculate({ ...inputs, monthlyContribution: mid });
                    if (test.summary.moneyLastsAge >= lifeExpectancy) {
                        hi = mid;
                    } else {
                        lo = mid + 1;
                    }
                }
                const canSaveLess = Math.max(0, currentContrib - hi);
                if (canSaveLess > 0) {
                    savingsNote = `<br><small style="opacity:0.85">💰 You could save <strong>${fmt(canSaveLess)}/month less</strong> (${fmt(hi)}/mo) and still sustain ${fmt(currentSpending)}/year.</small>`;
                }
            }
            icon = '🎉';
            amountClass = 'can-spend-more';
            message = `You're well-funded! You could spend up to <strong>${fmt(maxSustainable)}/year</strong> and still last to age ${lifeExpectancy}.`;
            message += savingsNote;
            barClass = 'safe';
        } else if (diff > 0) {
            // Small room — still safe
            icon = '✅';
            amountClass = 'on-target';
            message = `You're close to your max. Sustainable spending: <strong>${fmt(maxSustainable)}/year</strong>.`;
            barClass = 'safe-tight';
        } else {
            // Exactly at limit
            icon = '✅';
            amountClass = 'on-target';
            message = `Your spending is right at the sustainable limit.`;
            barClass = 'safe-tight';
        }
        
        // ── Retirement age optimization ──
        const currentRetireAge = inputs.retirementAge;
        let earliestAge = currentRetireAge;
        let latestAge = currentRetireAge;

        if (moneyLastsAge >= lifeExpectancy) {
            // Ahead: find how early they could retire with same spending
            // Can't retire earlier than current age
            let ageLow = Math.max(inputs.currentAge + 1, 50), ageHigh = currentRetireAge;
            for (let i = 0; i < 15; i++) {
                const testAge = Math.round((ageLow + ageHigh) / 2);
                if (testAge === ageHigh) break;
                const testResult = RetirementCalcV4.calculate({ ...inputs, retirementAge: testAge });
                if (testResult.summary.moneyLastsAge >= lifeExpectancy) {
                    earliestAge = testAge;
                    ageHigh = testAge;
                } else {
                    ageLow = testAge + 1;
                }
            }
        } else {
            // Behind: find what retirement age would make it work
            let aLow = currentRetireAge, aHigh = 80;
            for (let i = 0; i < 15; i++) {
                const testAge = Math.round((aLow + aHigh) / 2);
                if (testAge === aLow) break;
                const testResult = RetirementCalcV4.calculate({ ...inputs, retirementAge: testAge });
                if (testResult.summary.moneyLastsAge >= lifeExpectancy) {
                    latestAge = testAge;
                    aHigh = testAge;
                } else {
                    aLow = testAge + 1;
                }
            }
        }

        let ageMessage = '';
        if (moneyLastsAge >= lifeExpectancy && earliestAge < currentRetireAge) {
            const yearsSaved = currentRetireAge - earliestAge;
            ageMessage = `<div class="optimizer-age-insight">🎯 You could retire at <strong>${earliestAge}</strong> instead of ${currentRetireAge} and enjoy the same retirement — that's <strong>${yearsSaved} year${yearsSaved > 1 ? 's' : ''} earlier</strong>!</div>`;
        } else if (moneyLastsAge < lifeExpectancy && latestAge > currentRetireAge) {
            const yearsMore = latestAge - currentRetireAge;
            ageMessage = `<div class="optimizer-age-insight warning">📅 For this retirement lifestyle, you'd need to work until <strong>age ${latestAge}</strong> — that's <strong>${yearsMore} more year${yearsMore > 1 ? 's' : ''}</strong> than planned.</div>`;
        } else if (moneyLastsAge < lifeExpectancy) {
            ageMessage = `<div class="optimizer-age-insight warning">📅 Even retiring later may not be enough — consider reducing spending or increasing savings.</div>`;
        }

        content.innerHTML = `
            <div class="spending-optimizer-card">
                <h3>${icon} Spending Check</h3>
                <div class="optimizer-detail">Your plan: ${fmt(currentSpending)}/year</div>
                <div class="optimizer-amount ${amountClass}">
                    ${diff > 0 ? '+' + fmt(diff) + ' room' : diff < 0 ? fmt(Math.abs(diff)) + ' over' : 'On target'}
                </div>
                <div class="optimizer-detail">${message}</div>
                <div class="optimizer-bar">
                    <div class="optimizer-bar-fill ${barClass}" style="width: ${Math.min(100, pctOfMax).toFixed(0)}%"></div>
                </div>
                <div class="optimizer-detail" style="display: flex; justify-content: space-between; font-size: 12px;">
                    <span>$0</span>
                    <span>Max sustainable: ${fmt(maxSustainable)}</span>
                </div>
                ${ageMessage}
            </div>
        `;
    },

    _setupHouseSale() {
        const toggle = document.getElementById('house-sale-toggle');
        const form = document.getElementById('house-sale-form');
        
        if (toggle && form) {
            toggle.addEventListener('change', () => {
                form.classList.toggle('hidden', !toggle.checked);
                // Re-enhance sliders for newly visible inputs
                if (toggle.checked && window.syncAllSliders) {
                    setTimeout(() => {
                        // Force slider init for house sale inputs
                        if (window.syncSlider) {
                            window.syncSlider('house-sale-price');
                            window.syncSlider('house-current-costs');
                            window.syncSlider('house-rent-after');
                        }
                    }, 50);
                }
            });
        }
        
        // Live preview
        const priceEl = document.getElementById('house-sale-price');
        const costsEl = document.getElementById('house-current-costs');
        const rentEl = document.getElementById('house-rent-after');
        
        const updatePreview = () => {
            const price = parseFloat(priceEl?.value) || 0;
            const costs = parseFloat(costsEl?.value) || 0;
            const rent = parseFloat(rentEl?.value) || 0;
            const diff = costs - rent;
            
            const proceedsEl = document.getElementById('house-proceeds-display');
            const diffEl = document.getElementById('house-monthly-diff');
            
            if (proceedsEl) proceedsEl.textContent = '$' + price.toLocaleString();
            if (diffEl) {
                if (diff > 0) {
                    diffEl.textContent = 'Save $' + diff.toLocaleString() + '/mo';
                    diffEl.style.color = '#10b981';
                } else if (diff < 0) {
                    diffEl.textContent = 'Extra $' + Math.abs(diff).toLocaleString() + '/mo';
                    diffEl.style.color = '#ef4444';
                } else {
                    diffEl.textContent = 'No change';
                    diffEl.style.color = '';
                }
            }
        };
        
        [priceEl, costsEl, rentEl].forEach(el => {
            if (el) el.addEventListener('input', updatePreview);
        });
    },

    _getHouseSaleInputs() {
        const enabled = document.getElementById('house-sale-toggle')?.checked;
        if (!enabled) return null;
        
        return {
            salePrice: parseFloat(document.getElementById('house-sale-price')?.value) || 0,
            saleAge: parseInt(document.getElementById('house-sale-age')?.value) || 65,
            currentMonthlyCosts: parseFloat(document.getElementById('house-current-costs')?.value) || 0,
            rentAfter: parseFloat(document.getElementById('house-rent-after')?.value) || 0
        };
    },

    _runHouseSaleComparison(sellInputs, sellResults) {
        // sellInputs/sellResults already include house sale (injected in _runCalculation)
        const houseSale = this._getHouseSaleInputs();
        if (!houseSale) {
            const section = document.getElementById('house-sale-comparison');
            if (section) section.classList.add('hidden');
            return;
        }
        
        const { salePrice, saleAge, currentMonthlyCosts, rentAfter } = houseSale;
        
        // Calculate the "keep house" scenario (remove house sale windfall, restore spending)
        const netSpendingChange = (rentAfter * 12) - (currentMonthlyCosts * 12);
        const keepInputs = {
            ...sellInputs,
            annualSpending: sellInputs.annualSpending - netSpendingChange,
            windfalls: (sellInputs.windfalls || []).filter(w => w.name !== 'House Sale')
        };
        
        const keepResults = RetirementCalcV4.calculate(keepInputs);
        
        // Display comparison (keep vs sell)
        this._displayHouseSaleComparison(keepResults, sellResults, keepInputs, houseSale);
    },

    _displayHouseSaleComparison(keepResults, sellResults, inputs, houseSale) {
        const section = document.getElementById('house-sale-comparison');
        const content = document.getElementById('house-sale-comparison-content');
        if (!section || !content) return;
        
        section.classList.remove('hidden');
        
        const fmt = (v) => fmtCompact(v);
        const keepLegacy = keepResults.summary.legacyAmount;
        const sellLegacy = sellResults.summary.legacyAmount;
        const diff = sellLegacy - keepLegacy;
        const keepLasts = keepResults.summary.moneyLastsAge;
        const sellLasts = sellResults.summary.moneyLastsAge;
        
        const monthlySaved = houseSale.currentMonthlyCosts - houseSale.rentAfter;
        
        let verdictClass, verdictText;
        if (Math.abs(diff) < 50000) {
            verdictClass = 'close-call';
            verdictText = '🤝 It\'s roughly a wash — both paths are similar';
        } else if (diff > 0) {
            verdictClass = 'sell-wins';
            verdictText = `📈 Selling adds ${fmt(diff)} to your legacy`;
        } else {
            verdictClass = 'keep-wins';
            verdictText = `🏠 Keeping the home preserves ${fmt(Math.abs(diff))} more`;
        }
        
        // If one scenario fails (money runs out) and other doesn't
        if (sellLasts > keepLasts) {
            verdictClass = 'sell-wins';
            verdictText = `📈 Selling: money lasts ${sellLasts - keepLasts} years longer`;
        } else if (keepLasts > sellLasts) {
            verdictClass = 'keep-wins';
            verdictText = `🏠 Keeping: money lasts ${keepLasts - sellLasts} years longer`;
        }
        
        content.innerHTML = `
            <div class="comparison-grid">
                <div class="comparison-column keep-home">
                    <h3>🏠 Keep Home</h3>
                    <div class="comparison-stat">
                        Portfolio at ${inputs.retirementAge}
                        <strong>${fmt(keepResults.summary.portfolioAtRetirement)}</strong>
                    </div>
                    <div class="comparison-stat">
                        Money lasts to
                        <strong>Age ${keepLasts}</strong>
                    </div>
                    <div class="comparison-stat">
                        Legacy at ${inputs.lifeExpectancy}
                        <strong>${fmt(keepLegacy)}</strong>
                    </div>
                    <div class="comparison-stat">
                        Housing: ${fmt(houseSale.currentMonthlyCosts)}/mo
                    </div>
                </div>
                <div class="comparison-column sell-home">
                    <h3>💰 Sell at ${houseSale.saleAge}</h3>
                    <div class="comparison-stat">
                        Sale proceeds
                        <strong>${fmt(houseSale.salePrice)}</strong>
                    </div>
                    <div class="comparison-stat">
                        Money lasts to
                        <strong>Age ${sellLasts}</strong>
                    </div>
                    <div class="comparison-stat">
                        Legacy at ${inputs.lifeExpectancy}
                        <strong>${fmt(sellLegacy)}</strong>
                    </div>
                    <div class="comparison-stat">
                        Rent: ${fmt(houseSale.rentAfter)}/mo
                        ${monthlySaved > 0 ? '<br><span style="color:#10b981">Save ' + fmt(monthlySaved) + '/mo</span>' : ''}
                        ${monthlySaved < 0 ? '<br><span style="color:#ef4444">Extra ' + fmt(Math.abs(monthlySaved)) + '/mo</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="comparison-verdict ${verdictClass}">${verdictText}</div>
        `;
    },

    _setupPostRetirementWork() {
        this.postRetirementWorkItems = [];
        
        const form = document.getElementById('form-post-retirement-work');
        const saveBtn = document.getElementById('btn-save-prt-work');
        const cancelBtn = document.getElementById('btn-cancel-prt-work');
        const whoSelect = document.getElementById('prt-who');
        
        // Hide partner option for singles
        if (whoSelect && this.familyStatus !== 'couple') {
            const partnerOpt = whoSelect.querySelector('option[value="partner"]');
            if (partnerOpt) partnerOpt.style.display = 'none';
        }
        
        if (cancelBtn && form) {
            cancelBtn.addEventListener('click', () => {
                form.classList.add('hidden');
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const who = document.getElementById('prt-who')?.value || 'me';
                const income = parseFloat(document.getElementById('prt-income')?.value) || 0;
                const startAge = parseInt(document.getElementById('prt-start')?.value) || 0;
                const endAge = parseInt(document.getElementById('prt-end')?.value) || 0;
                
                if (income <= 0 || startAge <= 0 || endAge <= 0 || endAge < startAge) return;
                
                const label = who === 'partner' ? 'Partner' : 'My';
                const name = `${label} part-time work`;
                
                // Add to IncomeSources
                const source = IncomeSources.add('partTime', income, startAge, endAge, name);
                
                this.postRetirementWorkItems.push({
                    id: source.id,
                    who, income, startAge, endAge, name
                });
                
                // Reset form
                form.classList.add('hidden');
                document.getElementById('prt-income').value = '';
                
                this._renderPostRetirementWork();
            });
        }
    },

    _renderPostRetirementWork() {
        const container = document.getElementById('post-retirement-work-list');
        if (!container) return;
        
        if (this.postRetirementWorkItems.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        const fmt = (v) => '$' + v.toLocaleString();
        container.innerHTML = this.postRetirementWorkItems.map(item => `
            <div class="income-source-item" style="margin-bottom: 8px;">
                <div class="source-icon">💼</div>
                <div class="source-details">
                    <div class="source-name">${item.name}</div>
                    <div class="source-meta">Ages ${item.startAge}-${item.endAge} • ${fmt(item.income)}/year</div>
                </div>
                <button type="button" class="btn-remove-source" data-prt-id="${item.id}">✕</button>
            </div>
        `).join('');
        
        container.querySelectorAll('.btn-remove-source').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.prtId);
                IncomeSources.remove(id);
                this.postRetirementWorkItems = this.postRetirementWorkItems.filter(i => i.id !== id);
                this._renderPostRetirementWork();
            });
        });
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

    _setupEstateAssets() {
        this.estateAssets = [];
        const addBtn = document.getElementById('btn-add-estate-asset');
        const form = document.getElementById('estate-asset-form');
        const saveBtn = document.getElementById('btn-save-estate-asset');
        const cancelBtn = document.getElementById('btn-cancel-estate-asset');

        if (addBtn && form) {
            addBtn.addEventListener('click', () => {
                form.classList.remove('hidden');
                addBtn.classList.add('hidden');
            });
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                form.classList.add('hidden');
                addBtn?.classList.remove('hidden');
            });
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const name = document.getElementById('estate-asset-name')?.value || 'Asset';
                const value = parseFloat(document.getElementById('estate-asset-value')?.value) || 0;
                const isPrimaryResidence = document.getElementById('estate-asset-primary')?.checked || false;
                if (value > 0) {
                    this.estateAssets.push({ name, value, isPrimaryResidence });
                    form.classList.add('hidden');
                    addBtn?.classList.remove('hidden');
                    document.getElementById('estate-asset-name').value = '';
                    document.getElementById('estate-asset-value').value = '';
                    this._renderEstateAssets();
                }
            });
        }
    },

    _renderEstateAssets() {
        const container = document.getElementById('estate-assets-list');
        if (!container) return;
        if (this.estateAssets.length === 0) {
            container.innerHTML = '';
            return;
        }
        const fmt = (v) => '$' + Math.round(v).toLocaleString();
        container.innerHTML = this.estateAssets.map((a, i) => `
            <div class="income-source-item" style="margin-bottom: 8px;">
                <div class="source-icon">${a.isPrimaryResidence ? '🏠' : '🏢'}</div>
                <div class="source-details">
                    <div class="source-name">${a.name}</div>
                    <div class="source-meta">${fmt(a.value)} • ${a.isPrimaryResidence ? 'Tax-exempt (primary residence)' : 'Capital gains on appreciation'}</div>
                </div>
                <button type="button" class="btn-remove-source" data-estate-idx="${i}">✕</button>
            </div>
        `).join('');
        container.querySelectorAll('.btn-remove-source').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.closest('[data-estate-idx]').dataset.estateIdx);
                this.estateAssets.splice(idx, 1);
                this._renderEstateAssets();
            });
        });
    },

    _setupStep5Dropdowns() {
        // Wire up dropdown toggles
        const setupDropdown = (btnId, menuId) => {
            const btn = document.getElementById(btnId);
            const menu = document.getElementById(menuId);
            if (!btn || !menu) return;
            btn.addEventListener('click', () => {
                // Close other dropdowns
                document.querySelectorAll('.step5-dropdown').forEach(d => { if (d !== menu) d.classList.add('hidden'); });
                menu.classList.toggle('hidden');
            });
            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!btn.contains(e.target) && !menu.contains(e.target)) menu.classList.add('hidden');
            });
        };
        // Couple accounts toggle (Joint vs Separate)
        document.getElementById('accounts-joint')?.addEventListener('click', () => {
            document.getElementById('accounts-joint').classList.add('active');
            document.getElementById('accounts-separate').classList.remove('active');
            // Show combined inputs, hide separate
            document.querySelectorAll('#step-savings > .input-group').forEach(g => g.classList.remove('hidden'));
            document.getElementById('separate-accounts-section')?.classList.add('hidden');
            // Show combined extra accounts that were added, hide per-person
            ['lira', 'other', 'cash'].forEach(acct => {
                const p1 = document.getElementById(acct + '-p1-group');
                const p2 = document.getElementById(acct + '-p2-group');
                const combined = document.getElementById(acct + '-group');
                if (p1 && !p1.classList.contains('hidden')) {
                    // Was visible in separate mode — show combined instead
                    if (combined) combined.classList.remove('hidden');
                }
                if (p1) p1.classList.add('hidden');
                if (p2) p2.classList.add('hidden');
            });
            this.accountMode = 'joint';
        });
        document.getElementById('accounts-separate')?.addEventListener('click', () => {
            document.getElementById('accounts-separate').classList.add('active');
            document.getElementById('accounts-joint').classList.remove('active');
            // Hide combined RRSP/TFSA/NonReg inputs, show separate
            ['rrsp', 'tfsa', 'nonreg'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.closest('.input-group')?.classList.add('hidden');
            });
            document.getElementById('separate-accounts-section')?.classList.remove('hidden');
            // Migrate visible extra accounts to per-person fields
            ['lira', 'other', 'cash'].forEach(acct => {
                const combined = document.getElementById(acct + '-group');
                if (combined && !combined.classList.contains('hidden')) {
                    combined.classList.add('hidden');
                    const p1 = document.getElementById(acct + '-p1-group');
                    const p2 = document.getElementById(acct + '-p2-group');
                    if (p1) p1.classList.remove('hidden');
                    if (p2) p2.classList.remove('hidden');
                }
            });
            this.accountMode = 'separate';
        });

        setupDropdown('btn-add-income-dropdown', 'income-dropdown-menu');
        setupDropdown('btn-add-expense-dropdown', 'expense-dropdown-menu');
        setupDropdown('btn-add-estate-dropdown', 'estate-dropdown-menu');
        setupDropdown('btn-add-account-dropdown', 'account-dropdown-menu');
        
        // Account dropdown items show hidden account fields
        document.querySelectorAll('[data-account]').forEach(item => {
            item.addEventListener('click', () => {
                const acct = item.dataset.account;
                // In separate mode, show per-person fields; in joint mode, show combined
                if (this.accountMode === 'separate') {
                    const p1 = document.getElementById(acct + '-p1-group');
                    const p2 = document.getElementById(acct + '-p2-group');
                    if (p1) p1.classList.remove('hidden');
                    if (p2) p2.classList.remove('hidden');
                    if (p1) p1.querySelector('input')?.focus();
                } else {
                    const group = document.getElementById(acct + '-group');
                    if (group) {
                        group.classList.remove('hidden');
                        group.querySelector('input')?.focus();
                    }
                }
                item.closest('.step5-dropdown').classList.add('hidden');
                item.style.display = 'none'; // Hide from dropdown once added
            });
        });

        // Wire dropdown items to show forms
        document.querySelectorAll('.step5-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const form = document.getElementById('form-' + type);
                if (form) {
                    // Hide all forms, show this one
                    document.querySelectorAll('.step5-form').forEach(f => f.classList.add('hidden'));
                    form.classList.remove('hidden');
                    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    // Auto-open windfall add form (always, skip the intermediate step)
                    if (type === 'windfall') {
                        this._showWindfallForm();
                    }
                    // Auto-populate post-retirement work ages
                    if (type === 'post-retirement-work') {
                        const retAge = parseInt(document.getElementById('retirement-age')?.value) || 65;
                        if (!document.getElementById('prt-start')?.value) document.getElementById('prt-start').value = retAge;
                        if (!document.getElementById('prt-end')?.value) document.getElementById('prt-end').value = retAge + 5;
                    }
                    // Refresh chips so items from other sections stay visible
                    this._updateStep5AddedItems();
                }
                // Close dropdown
                item.closest('.step5-dropdown').classList.add('hidden');
            });
        });

        // DTC inline toggle — update chips live
        document.getElementById('dtc-checkbox')?.addEventListener('change', () => {
            this._updateStep5AddedItems();
        });

        // Wire save/cancel buttons on all forms
        document.querySelectorAll('[data-save]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.save;
                if (type === 'healthcare') this.healthcareExplicitlyAdded = true;
                
                // Other income — multi-add to array
                if (type === 'other-income') {
                    const name = document.getElementById('other-income-name')?.value || 'Other Income';
                    const amount = parseFloat(document.getElementById('other-income-amount')?.value) || 0;
                    const taxable = document.getElementById('other-income-taxable')?.checked !== false;
                    if (amount > 0) {
                        this.otherIncomeItems.push({ name, amount, taxable });
                        document.getElementById('other-income-name').value = '';
                        document.getElementById('other-income-amount').value = '';
                        document.getElementById('other-income-taxable').checked = true;
                    }
                }

                // Other expense — multi-add to array
                if (type === 'other-expense') {
                    const name = document.getElementById('other-expense-name')?.value || 'Other Expense';
                    const amount = parseFloat(document.getElementById('other-expense-amount')?.value) || 0;
                    if (amount > 0) {
                        this.otherExpenseItems.push({ name, amount });
                        document.getElementById('other-expense-name').value = '';
                        document.getElementById('other-expense-amount').value = '';
                    }
                }

                // Stock options — add as windfall of type 'shares'
                if (type === 'stock-options') {
                    const currentValue = parseFloat(document.getElementById('stock-current-value')?.value) || 0;
                    const costBasis = parseFloat(document.getElementById('stock-cost-basis')?.value) || 0;
                    const sellAge = parseInt(document.getElementById('stock-sell-age')?.value) || 55;
                    const growth = parseFloat(document.getElementById('stock-growth')?.value) || 8;
                    if (currentValue > 0) {
                        if (!this.windfalls) this.windfalls = [];
                        this.windfalls.push({
                            name: 'Stock / Equity Options',
                            type: 'shares',
                            currentValue, costBasis, sellAge,
                            growthRate: growth / 100,
                            amount: currentValue
                        });
                        // Reset form
                        document.getElementById('stock-current-value').value = '';
                        document.getElementById('stock-cost-basis').value = '';
                        document.getElementById('stock-sell-age').value = '';
                    }
                }
                
                const form = document.getElementById('form-' + type);
                if (form) form.classList.add('hidden');
                this._updateStep5AddedItems();
            });
        });
        document.querySelectorAll('[data-cancel]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.cancel;
                const form = document.getElementById('form-' + type);
                if (form) form.classList.add('hidden');
            });
        });
    },

    _makeChip(icon, label, value, editType, deleteCallback) {
        const deleteBtn = deleteCallback ? `<button type="button" class="chip-delete" data-delete="${editType}" title="Remove">×</button>` : '';
        return `<div class="step5-added-item" data-edit-type="${editType}" style="cursor:pointer;">
            <span class="item-label">${icon} ${label}</span>
            <span class="item-value">${value}</span>
            ${deleteBtn}
        </div>`;
    },

    _clearFormFields(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        form.querySelectorAll('input[type="number"], input[type="text"]').forEach(el => { el.value = ''; });
        form.querySelectorAll('input[type="checkbox"]').forEach(el => { 
            // Reset to default (checked for pension-indexed, unchecked for others)
            el.checked = el.id === 'pension-indexed';
        });
    },

    _removeItem(type) {
        const clearMap = {
            'employer-pension': () => { document.getElementById('employer-pension').value = ''; document.getElementById('pension-start-age').value = '65'; },
            'debt': () => { document.getElementById('current-debt').value = ''; document.getElementById('debt-payoff-age').value = '65'; },
            'healthcare': () => { this.healthcareExplicitlyAdded = false; },
            'ltc': () => { document.getElementById('ltc-monthly').value = ''; document.getElementById('ltc-start-age').value = '80'; },
            'annuity': () => { document.getElementById('annuity-lump-sum').value = ''; document.getElementById('annuity-purchase-age').value = ''; document.getElementById('annuity-monthly-payout').value = ''; },
            'downsizing': () => { document.getElementById('downsizing-age').value = ''; document.getElementById('downsizing-proceeds').value = ''; document.getElementById('downsizing-spending-change').value = ''; },
            'dtc': () => { document.getElementById('dtc-checkbox').checked = false; this._updateStep5AddedItems(); },
            // other-income and other-expense handled via indexed delete below
            'life-insurance': () => { document.getElementById('life-insurance-amount').value = ''; },
            'vehicle': () => { document.getElementById('vehicle-name').value = ''; document.getElementById('vehicle-value').value = ''; },
            'other-estate': () => { document.getElementById('other-estate-name').value = ''; document.getElementById('other-estate-value').value = ''; },
        };
        if (clearMap[type]) clearMap[type]();
        // Sync sliders after clearing
        if (typeof window.syncAllSliders === 'function') window.syncAllSliders();
        this._updateStep5AddedItems();
    },

    _updateDropdownVisibility() {
        // Hide single-use dropdown items that are already added
        const singleUseChecks = {
            'employer-pension': () => (parseFloat(document.getElementById('employer-pension')?.value) || 0) > 0,
            'debt': () => (parseFloat(document.getElementById('current-debt')?.value) || 0) > 0,
            'healthcare': () => this.healthcareExplicitlyAdded,
            'ltc': () => (parseFloat(document.getElementById('ltc-monthly')?.value) || 0) > 0,
            'annuity': () => (parseFloat(document.getElementById('annuity-lump-sum')?.value) || 0) > 0,
            'downsizing': () => (parseFloat(document.getElementById('downsizing-proceeds')?.value) || 0) > 0,
            'dtc': () => document.getElementById('dtc-checkbox')?.checked,
            // other-income and other-expense are multi-add, always visible in dropdown
            'life-insurance': () => (parseFloat(document.getElementById('life-insurance-amount')?.value) || 0) > 0,
            'vehicle': () => (parseFloat(document.getElementById('vehicle-value')?.value) || 0) > 0,
            'other-estate': () => (parseFloat(document.getElementById('other-estate-value')?.value) || 0) > 0,
        };
        document.querySelectorAll('.step5-dropdown-item').forEach(item => {
            const type = item.dataset.type;
            if (singleUseChecks[type]) {
                item.style.display = singleUseChecks[type]() ? 'none' : '';
            }
        });
    },

    _updateStep5AddedItems() {
        // Show summary chips of added items
        const incomeContainer = document.getElementById('added-income-items');
        const expenseContainer = document.getElementById('added-expense-items');
        if (!incomeContainer || !expenseContainer) return;
        
        const fmt = (v) => '$' + Math.round(v).toLocaleString();
        let incomeHTML = '';
        let expenseHTML = '';
        
        // Employer pension
        const pension = parseFloat(document.getElementById('employer-pension')?.value) || 0;
        if (pension > 0) {
            const age = document.getElementById('pension-start-age')?.value || '65';
            incomeHTML += this._makeChip('🏢', 'Employer Pension', `${fmt(pension)}/mo from age ${age}`, 'employer-pension', true);
        }
        
        // LTC
        const ltc = parseFloat(document.getElementById('ltc-monthly')?.value) || 0;
        if (ltc > 0) {
            const age = document.getElementById('ltc-start-age')?.value || '80';
            expenseHTML += this._makeChip('🏠', 'Long-Term Care', `${fmt(ltc)}/mo from age ${age}`, 'ltc', true);
        }
        
        // Annuity
        const annuity = parseFloat(document.getElementById('annuity-lump-sum')?.value) || 0;
        if (annuity > 0) {
            const payout = parseFloat(document.getElementById('annuity-monthly-payout')?.value) || 0;
            incomeHTML += this._makeChip('🔒', 'Annuity', `${fmt(annuity)} → ${fmt(payout)}/mo`, 'annuity', true);
        }
        
        // DTC
        const dtc = document.getElementById('dtc-checkbox')?.checked;
        if (dtc) {
            incomeHTML += this._makeChip('♿', 'DTC', '~$1,900/yr savings', 'dtc', true);
        }
        
        // Debt
        const debt = parseFloat(document.getElementById('current-debt')?.value) || 0;
        if (debt > 0) {
            expenseHTML += this._makeChip('💳', 'Debt', fmt(debt), 'debt', true);
        }
        
        // Healthcare (only if user explicitly added it)
        if (this.healthcareExplicitlyAdded) {
            const hcCost = document.getElementById('healthcare-annual')?.textContent || '';
            if (hcCost && hcCost !== '$0') {
                expenseHTML += this._makeChip('🏥', 'Healthcare', `${hcCost}/yr extra`, 'healthcare', true);
            }
        }

        // Downsizing (now in income section)
        const downProceeds = parseFloat(document.getElementById('downsizing-proceeds')?.value) || 0;
        if (downProceeds > 0) {
            const downAge = document.getElementById('downsizing-age')?.value || '70';
            incomeHTML += this._makeChip('🏡', 'Downsizing', `${fmt(downProceeds)} at age ${downAge}`, 'downsizing', true);
        }
        
        // Windfalls & Stock Options
        if (this.windfalls && this.windfalls.length > 0) {
            this.windfalls.forEach((w, i) => {
                const isStock = w.type === 'shares';
                const icon = isStock ? '📈' : '💰';
                const wName = w.name || (isStock ? 'Stock / Equity' : 'Windfall');
                const wAmt = isStock ? (w.currentValue || w.amount || 0) : (w.amount || 0);
                const wAge = isStock ? (w.sellAge || '?') : (w.year || '?');
                incomeHTML += this._makeChip(icon, wName, `${fmt(wAmt)} at age ${wAge}`, `windfall-${i}`, true);
            });
        }
        
        // Other income (multi-add)
        if (this.otherIncomeItems && this.otherIncomeItems.length > 0) {
            this.otherIncomeItems.forEach((item, i) => {
                incomeHTML += this._makeChip('📝', item.name, `${fmt(item.amount)}/yr${item.taxable ? '' : ' (non-tax)'}`, `oi-${i}`, true);
            });
        }
        
        // Other expense (multi-add)
        if (this.otherExpenseItems && this.otherExpenseItems.length > 0) {
            this.otherExpenseItems.forEach((item, i) => {
                expenseHTML += this._makeChip('📝', item.name, `${fmt(item.amount)}/yr`, `oe-${i}`, true);
            });
        }

        // Estate assets (separate section)
        let estateHTML = '';
        if (this.estateAssets && this.estateAssets.length > 0) {
            this.estateAssets.forEach((a, i) => {
                estateHTML += this._makeChip(a.isPrimaryResidence ? '🏠' : '🏢', a.name, `${fmt(a.value)}${a.isPrimaryResidence ? ' (tax-exempt)' : ''}`, `estate-${i}`, true);
            });
        }
        const lifeIns = parseFloat(document.getElementById('life-insurance-amount')?.value) || 0;
        if (lifeIns > 0) {
            estateHTML += this._makeChip('🛡️', 'Life Insurance', `${fmt(lifeIns)} (tax-free)`, 'life-insurance', true);
        }
        const vehicleName = document.getElementById('vehicle-name')?.value;
        const vehicleVal = parseFloat(document.getElementById('vehicle-value')?.value) || 0;
        if (vehicleVal > 0) {
            estateHTML += this._makeChip('🚗', vehicleName || 'Vehicle', fmt(vehicleVal), 'vehicle', true);
        }
        const otherEstateName = document.getElementById('other-estate-name')?.value;
        const otherEstateVal = parseFloat(document.getElementById('other-estate-value')?.value) || 0;
        if (otherEstateVal > 0) {
            estateHTML += this._makeChip('📝', otherEstateName || 'Other', fmt(otherEstateVal), 'other-estate', true);
        }
        const estateContainer = document.getElementById('added-estate-items');
        if (estateContainer) estateContainer.innerHTML = estateHTML;
        
        incomeContainer.innerHTML = incomeHTML;
        expenseContainer.innerHTML = expenseHTML;

        // Update dropdown visibility (hide added single-use items)
        this._updateDropdownVisibility();

        // Wire chip click handlers (edit + delete)
        document.querySelectorAll('.step5-added-item').forEach(chip => {
            const editType = chip.dataset.editType;
            if (!editType) return;
            
            // Tap chip to re-edit
            chip.addEventListener('click', (e) => {
                if (e.target.classList.contains('chip-delete')) return; // Let delete handle itself
                // For windfall/estate indexed items, just open the parent form
                let formType = editType;
                if (editType.startsWith('windfall-')) formType = 'windfall';
                else if (editType.startsWith('estate-')) formType = 'estate';
                const form = document.getElementById('form-' + formType);
                if (form) {
                    document.querySelectorAll('.step5-form').forEach(f => f.classList.add('hidden'));
                    form.classList.remove('hidden');
                    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        });

        // Wire delete buttons
        document.querySelectorAll('.chip-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.dataset.delete;
                if (type.startsWith('windfall-')) {
                    const idx = parseInt(type.split('-')[1]);
                    if (this.windfalls) this.windfalls.splice(idx, 1);
                    this._updateStep5AddedItems();
                } else if (type.startsWith('estate-')) {
                    const idx = parseInt(type.split('-')[1]);
                    if (this.estateAssets) this.estateAssets.splice(idx, 1);
                    this._updateStep5AddedItems();
                } else if (type.startsWith('oi-')) {
                    const idx = parseInt(type.split('-')[1]);
                    this.otherIncomeItems.splice(idx, 1);
                    this._updateStep5AddedItems();
                } else if (type.startsWith('oe-')) {
                    const idx = parseInt(type.split('-')[1]);
                    this.otherExpenseItems.splice(idx, 1);
                    this._updateStep5AddedItems();
                } else {
                    this._removeItem(type);
                }
            });
        });
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

        // Email report modal
        const emailModal = document.getElementById('email-modal');
        const cancelEmail = document.getElementById('btn-cancel-email');
        const sendReport = document.getElementById('btn-send-report');
        
        document.getElementById('btn-email-report')?.addEventListener('click', () => emailModal?.classList.remove('hidden'));
        cancelEmail?.addEventListener('click', () => emailModal?.classList.add('hidden'));
        emailModal?.addEventListener('click', (e) => { if (e.target === emailModal) emailModal.classList.add('hidden'); });
        sendReport?.addEventListener('click', () => this._sendEmailReport());
        
        // Edit button → back to inputs
        document.getElementById('btn-edit-inputs')?.addEventListener('click', () => {
            document.getElementById('results')?.classList.add('hidden');
            document.getElementById('email-fixed-bar').style.display = 'none';
            this._showStep('basic');
        });
        
        // Plan/Tweak tabs
        document.querySelectorAll('.plan-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.planTab;
                document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tweakPanel = document.getElementById('tweak-panel');
                if (mode === 'tweak') {
                    tweakPanel?.classList.remove('hidden');
                    this._updateTweakDisplay();
                } else {
                    tweakPanel?.classList.add('hidden');
                }
            });
        });
        
        // Spending/Savings/Age adjusters
        this._setupAdjusters();
    },

    _setupAdjusters() {
        this._tweakAdj = { spending: 0, savings: 0, retireAge: 0 };
        
        // +/- buttons
        document.querySelectorAll('.tweak-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.tweak;
                const dir = parseInt(btn.dataset.dir);
                
                if (field === 'spending') {
                    const step = Math.round((this._baseInputs?.annualSpending || 50000) * 0.1);
                    this._tweakAdj.spending += dir * step;
                } else if (field === 'savings') {
                    this._tweakAdj.savings += dir * 250;
                } else if (field === 'retireAge') {
                    const base = this._baseInputs?.retirementAge || 65;
                    const newAge = base + this._tweakAdj.retireAge + dir;
                    if (newAge < (this._baseInputs?.currentAge || 30) + 1 || newAge > 80) return;
                    this._tweakAdj.retireAge += dir;
                }
                this._updateTweakDisplay();
            });
        });
        
        // Apply button
        document.getElementById('btn-tweak-apply')?.addEventListener('click', () => {
            this._applyTweaks();
        });
        
        // Reset button
        document.getElementById('btn-tweak-reset')?.addEventListener('click', () => {
            this._tweakAdj = { spending: 0, savings: 0, retireAge: 0 };
            this._applyTweaks();
        });
    },
    
    _updateTweakDisplay() {
        if (!this._baseInputs) return;
        const fmt = v => '$' + Math.round(v).toLocaleString();
        const adj = this._tweakAdj;
        
        const spendEl = document.getElementById('tweak-spending');
        const saveEl = document.getElementById('tweak-savings');
        const ageEl = document.getElementById('tweak-retire-age');
        
        if (spendEl) {
            const total = this._baseInputs.annualSpending + adj.spending;
            spendEl.textContent = fmt(total) + '/yr';
            spendEl.style.color = adj.spending === 0 ? '#1e293b' : (adj.spending > 0 ? '#dc2626' : '#059669');
        }
        if (saveEl) {
            const total = Math.max(0, this._baseInputs.monthlyContribution + adj.savings);
            saveEl.textContent = fmt(total) + '/mo';
            saveEl.style.color = adj.savings === 0 ? '#1e293b' : (adj.savings > 0 ? '#059669' : '#dc2626');
        }
        if (ageEl) {
            const total = this._baseInputs.retirementAge + adj.retireAge;
            ageEl.textContent = 'Age ' + total;
            ageEl.style.color = adj.retireAge === 0 ? '#1e293b' : (adj.retireAge < 0 ? '#059669' : '#dc2626');
        }
    },
    
    _updateAdjusterDisplay() {
        this._updateTweakDisplay();
    },
    
    _applyTweaks() {
        if (!this._baseInputs) return;
        this._updateTweakDisplay();
        
        const adj = this._tweakAdj;
        const adjustedInputs = {
            ...this._baseInputs,
            windfalls: [...(this._baseInputs.windfalls || [])],
            annualSpending: Math.max(0, this._baseInputs.annualSpending + (adj.spending || 0)),
            monthlyContribution: Math.max(0, this._baseInputs.monthlyContribution + (adj.savings || 0)),
            retirementAge: Math.max(this._baseInputs.currentAge + 1, this._baseInputs.retirementAge + (adj.retireAge || 0))
        };
        
        const results = RetirementCalcV4.calculate(adjustedInputs);
        this._lastCalcResults = results;
        this._lastCalcInputs = adjustedInputs;
        this._displayResults(results, adjustedInputs);
        
        // Re-run all result sections
        this._runSpendingOptimizer(adjustedInputs, results);
        this._buildStrategyComparison(adjustedInputs, results);
        this._generateRetirementNarrative(adjustedInputs, results);
        this._runHouseSaleComparison(adjustedInputs, results);
        
        if (typeof AppV5Enhanced !== 'undefined') {
            AppV5Enhanced.runEnhancedAnalysis(adjustedInputs, results);
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

    _setupCategoryInflation() {
        const inputs = ['inf-housing', 'inf-food', 'inf-discretionary', 'healthcare-inflation'];
        inputs.forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this._updateBlendedRate());
        });
        this._updateBlendedRate();
    },

    _updateBlendedRate() {
        const el = document.getElementById('blended-inflation-rate');
        if (!el) return;
        const weights = this._getSpendingWeights();
        const h = parseFloat(document.getElementById('inf-housing')?.value) || 2.5;
        const f = parseFloat(document.getElementById('inf-food')?.value) || 3.0;
        const hc = parseFloat(document.getElementById('healthcare-inflation')?.value) || 4;
        const d = parseFloat(document.getElementById('inf-discretionary')?.value) || 2.0;
        const blended = h * weights.housing + f * weights.food + hc * weights.healthcare + d * weights.discretionary;
        const baseRate = parseFloat(document.getElementById('inflation-rate')?.value) || 2.5;
        const diff = blended - baseRate;
        const diffStr = diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
        el.innerHTML = `📊 Blended retirement inflation: <strong>${blended.toFixed(1)}%</strong> (${diffStr} vs base ${baseRate}%) — weighted by your spending: Housing ${(weights.housing*100).toFixed(0)}%, Food ${(weights.food*100).toFixed(0)}%, Healthcare ${(weights.healthcare*100).toFixed(0)}%, Other ${(weights.discretionary*100).toFixed(0)}%`;
    },

    _setupSpendingCurve() {
        this.spendingCurve = 'flat';
        const btns = document.querySelectorAll('.curve-btn');
        const detail = document.getElementById('spending-curve-detail');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.spendingCurve = btn.dataset.curve;
                if (detail) detail.classList.toggle('hidden', this.spendingCurve === 'flat');
            });
        });
    },

    _buildStrategyComparison(inputs, smartResults) {
        const tabs = document.getElementById('strategy-tabs');
        const summary = document.getElementById('strategy-comparison-summary');
        if (!tabs || !summary) return;

        try {
            // 1. "Good advisor" plan
            const advisorInputs = {
                ...inputs,
                cppStartAge: 65, oasStartAge: 65,
                cppStartAgeP2: 65, oasStartAgeP2: 65,
                _withdrawalStrategy: 'naive'
            };
            const advisorResults = RetirementCalcV4.calculate(advisorInputs);

            // 2. Optimized plan — sweep CPP/OAS timing + strategy for max spending (same savings split)
            const optimized = RetirementCalcV4.optimizePlan(inputs, { includeSplitOptimization: false });
            const optResult = optimized.result;
            const optParams = optimized.params;
            const optInputs = optimized.inputs;

            // Store all three for tab switching
            this._strategyData = {
                smart: { results: smartResults, inputs },
                advisor: { results: advisorResults, inputs: advisorInputs },
                optimized: { results: optResult, inputs: optInputs }
            };

            // Stats helper
            const getStats = (results) => {
                const yrs = results.yearByYear.filter(y => y.phase === 'retirement');
                const s = (key) => yrs.reduce((a, y) => a + (y[key] || 0), 0);
                const lastYear = yrs[yrs.length - 1];
                const legacy = lastYear ? lastYear.totalBalance : 0;
                return { tax: s('taxPaid'), cpp: s('cppReceived'), oas: s('oasReceived'), gis: s('gisReceived'), legacy, lasts: results.summary.moneyLastsAge, estateTax: results.legacy?.estateTax || 0, netEstate: results.legacy?.netEstate || 0, estateAssets: results.legacy?.estateAssets || 0, grossEstate: results.legacy?.grossEstate || legacy };
            };

            const userStats = getStats(smartResults);
            const advStats = getStats(advisorResults);
            const optStats = getStats(optResult);

            // Find max sustainable spending for each (binary search)
            const findMaxSpend = (overrides) => {
                try {
                    let lo = 20000, hi = (inputs.annualSpending || 50000) * 2.5;
                    for (let i = 0; i < 18; i++) {
                        const mid = (lo + hi) / 2;
                        const r = RetirementCalcV4.calculate({ ...inputs, ...overrides, annualSpending: mid });
                        if (r.summary.moneyLastsAge >= (inputs.lifeExpectancy || 90)) lo = mid; else hi = mid;
                    }
                    return Math.floor(lo / 1000) * 1000;
                } catch(e) { return null; }
            };

            const userMax = findMaxSpend({});
            const advMax = findMaxSpend({ cppStartAge:65, oasStartAge:65, cppStartAgeP2:65, oasStartAgeP2:65, _withdrawalStrategy:'naive' });
            const optMax = findMaxSpend({ cppStartAge:optParams.cppAge, oasStartAge:optParams.oasAge, cppStartAgeP2:optParams.cppAge, oasStartAgeP2:optParams.oasAge, _withdrawalStrategy:optParams.strategy });

            const fmt = (v) => '$' + Math.round(Math.abs(v)).toLocaleString();
            const fmtC = (v) => fmtCompact(Math.abs(v));

            // Winner = highest max sustainable spending (the real question: "how much can I spend?")
            const allPlans = [
                { key: 'smart', max: userMax, label: 'Your Plan', stats: userStats },
                { key: 'advisor', max: advMax, label: 'Advisor', stats: advStats },
                { key: 'optimized', max: optMax || optParams.maxSpend, label: 'Optimized', stats: optStats }
            ];
            allPlans.sort((a, b) => (b.max||0) - (a.max||0));
            const winnerKey = allPlans[0].key;

            // MER fee impact: advisor charges ~1% AUM, DIY ~0.25%
            const estimateLifetimeFees = (results, merRate) => {
                return results.yearByYear.filter(y => y.phase === 'retirement')
                    .reduce((s, y) => s + (y.totalBalance || 0) * merRate, 0);
            };

            // Compute lifetime tax (income tax + estate tax) for each strategy
            const lifetimeTax = (stats) => stats.tax + (stats.estateTax || 0);
            const userLifetimeTax = lifetimeTax(userStats);

            const buildCol = (header, stats, maxSpend, isWinner, note, merFees, merRate) => {
                const govTotal = stats.cpp + stats.oas + stats.gis;
                const thisLifetimeTax = lifetimeTax(stats);
                const retYears = (inputs.lifeExpectancy || 90) - (inputs.retirementAge || 65);
                const avgAnnualTax = retYears > 0 ? Math.round(stats.tax / retYears) : 0;
                const avgAnnualFee = retYears > 0 && merFees ? Math.round(merFees / retYears) : 0;
                return `
                <div class="strategy-col ${isWinner ? '' : 'loser'}">
                    <div class="strategy-col-header">${header}</div>
                    ${maxSpend ? `<div class="strategy-stat highlight"><span>Max Spending</span><span>${fmt(maxSpend)}/yr</span></div>` : ''}
                    <details class="strategy-details">
                        <summary class="strategy-stat"><span>💰 Lifetime Tax</span><span>${fmtC(thisLifetimeTax)}</span></summary>
                        <div class="strategy-stat sub"><span>Income tax</span><span>${fmtC(stats.tax)}</span></div>
                        <div class="strategy-stat sub"><span>Avg/yr</span><span>${fmt(avgAnnualTax)}/yr</span></div>
                        <div class="strategy-stat sub"><span>Estate tax</span><span>${fmtC(stats.estateTax || 0)}</span></div>
                    </details>
                    <details class="strategy-details">
                        <summary class="strategy-stat"><span>🏛️ Gov Benefits</span><span>${fmtC(govTotal)}</span></summary>
                        <div class="strategy-stat sub"><span>CPP</span><span>${fmtC(stats.cpp)}</span></div>
                        <div class="strategy-stat sub"><span>OAS</span><span>${fmtC(stats.oas)}</span></div>
                        ${stats.gis > 0 ? `<div class="strategy-stat sub"><span>GIS</span><span>${fmtC(stats.gis)}</span></div>` : ''}
                    </details>
                    <details class="strategy-details">
                        <summary class="strategy-stat"><span>📋 Fees</span><span>${merFees !== undefined ? fmtC(merFees) : '$0'}</span></summary>
                        <div class="strategy-stat sub"><span>MER rate</span><span>${merRate || '0'}%</span></div>
                        <div class="strategy-stat sub"><span>Avg/yr</span><span>${fmt(avgAnnualFee)}/yr</span></div>
                        <div class="strategy-stat sub hint"><span>Charged on portfolio balance each year</span></div>
                    </details>
                    <details class="strategy-details">
                        <summary class="strategy-stat"><span>🏠 Estate</span><span>${fmtC(stats.netEstate)}</span></summary>
                        <div class="strategy-stat sub"><span>Portfolio at death</span><span>${fmtC(stats.legacy)}</span></div>
                        ${stats.estateAssets > 0 ? `<div class="strategy-stat sub"><span>Other assets</span><span>${fmtC(stats.estateAssets)}</span></div>` : ''}
                        ${stats.estateTax > 0 ? `<div class="strategy-stat sub"><span>Deemed disposition</span><span>-${fmtC(stats.estateTax)}</span></div>` : ''}
                        <div class="strategy-stat sub"><span>Net to heirs</span><span>${fmtC(stats.netEstate)}</span></div>
                        ${header.includes('Optimized') ? `<div class="strategy-stat sub hint"><span>Optimized prioritizes spending over estate</span></div>` : ''}
                    </details>
                    <div class="strategy-stat"><span>📅 Lasts To</span><span>Age ${stats.lasts}</span></div>
                    ${note ? `<div class="strategy-note">${note}</div>` : ''}
                    <button type="button" class="btn-deep-dive" data-strategy="${header}">📋 Deep Dive</button>
                </div>`;
            };

            let optNote = `CPP at ${optParams.cppAge}, OAS at ${optParams.oasAge}` +
                (optParams.strategy === 'naive' ? ', TFSA-primary' : ', RRSP meltdown');

            const bestMax = allPlans[0].max || 0;
            const worstMax = allPlans[allPlans.length-1].max || 0;

            // Estimate lifetime fees: advisor ~1% MER, DIY ~0.25%
            const userFees = Math.round(estimateLifetimeFees(smartResults, 0.0025));
            const advFees = Math.round(estimateLifetimeFees(advisorResults, 0.01));
            const optFees = Math.round(estimateLifetimeFees(optResult, 0.0025));

            // Generate strategy narratives
            const narratives = this._generateStrategyNarratives(inputs, optParams, userStats, advStats, optStats, userMax, advMax, optMax || optParams.maxSpend);

            tabs.classList.remove('hidden');
            summary.innerHTML = `
                <div class="strategy-summary-grid three-col">
                    ${buildCol('📋 Your Plan', userStats, userMax, winnerKey === 'smart',
                        `CPP at ${inputs.cppStartAge}, OAS at ${inputs.oasStartAge}`, userFees, '0.25')}
                    ${buildCol('👔 Advisor', advStats, advMax, winnerKey === 'advisor',
                        'CPP/OAS at 65, bracket-filling', advFees, '1.0')}
                    ${buildCol('🎯 Optimized', optStats, optMax || optParams.maxSpend, winnerKey === 'optimized', optNote, optFees, '0.25')}
                </div>
                <div class="strategy-verdict positive">
                    🏆 <strong>${allPlans[0].label}</strong> lets you spend <strong>${fmt(bestMax)}/yr</strong>
                    ${bestMax > worstMax ? ` — <strong>${fmt(bestMax - worstMax)}/yr more</strong> than ${allPlans[allPlans.length-1].label}` : ''}
                </div>
                <div id="savings-split-suggestion" class="savings-split-box hidden"></div>
                <button type="button" class="btn-link" id="btn-optimize-savings" style="margin-top: 8px; font-size: 13px;">
                    💡 What if I also changed my savings split?
                </button>
                <details class="strategy-narrative-details">
                    <summary class="strategy-narrative-toggle">📖 How each strategy works</summary>
                    <div class="strategy-narratives">
                        <div class="narrative-card">
                            <h4>📋 Your Plan</h4>
                            <p>${narratives.user}</p>
                        </div>
                        <div class="narrative-card">
                            <h4>👔 Advisor</h4>
                            <p>${narratives.advisor}</p>
                        </div>
                        <div class="narrative-card">
                            <h4>🎯 Optimized</h4>
                            <p>${narratives.optimized}</p>
                        </div>
                    </div>
                </details>
            `;
            summary.classList.remove('hidden');

            // Wire up savings split optimizer button
            const splitBtn = document.getElementById('btn-optimize-savings');
            if (splitBtn) {
                splitBtn.addEventListener('click', () => {
                    splitBtn.disabled = true;
                    splitBtn.textContent = '⏳ Analyzing savings splits...';
                    setTimeout(() => {
                        this._runSavingsSplitAnalysis(inputs, optParams, optMax, fmt);
                        splitBtn.classList.add('hidden');
                    }, 50);
                });
            }

            // Tab switching
            tabs.querySelectorAll('.strategy-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.querySelectorAll('.strategy-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const data = this._strategyData[tab.dataset.strategy];
                    if (data) this._drawYearBreakdown(data.results.yearByYear, data.inputs.retirementAge);
                });
            });

            // Deep Dive buttons
            const deepDiveBtns = summary.querySelectorAll('.btn-deep-dive');
            console.log('[DeepDive] Found', deepDiveBtns.length, 'buttons, DeepDive defined:', typeof DeepDive !== 'undefined');
            deepDiveBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const label = btn.dataset.strategy;
                    console.log('[DeepDive] Button clicked, label:', label);
                    let data;
                    if (label.includes('Your Plan')) data = this._strategyData.smart;
                    else if (label.includes('Advisor')) data = this._strategyData.advisor;
                    else data = this._strategyData.optimized;
                    console.log('[DeepDive] Data found:', !!data, 'DeepDive:', typeof DeepDive);
                    if (data && typeof DeepDive !== 'undefined') {
                        try {
                            DeepDive.show(data.results, data.inputs, label.replace(/[📋👔🎯]\s*/g, '').trim());
                            console.log('[DeepDive] show() completed');
                        } catch(e) {
                            console.error('[DeepDive] show() ERROR:', e.message, e.stack);
                            alert('Deep Dive error: ' + e.message);
                        }
                    } else {
                        console.error('[DeepDive] Missing data or DeepDive module');
                        alert('Deep Dive not available: data=' + !!data + ' module=' + (typeof DeepDive));
                    }
                });
            });

        } catch (e) {
            console.error('Strategy comparison error:', e);
            tabs.classList.add('hidden');
            summary.classList.add('hidden');
        }
    },

    _runSavingsSplitAnalysis(inputs, optParams, currentOptMax, fmt) {
        const box = document.getElementById('savings-split-suggestion');
        if (!box) return;

        try {
            // Estimate marginal rate from income
            const income = inputs.currentIncome || 70000;
            let marginalRate = 0.20; // default
            if (income > 220000) marginalRate = 0.33;
            else if (income > 155000) marginalRate = 0.29;
            else if (income > 110000) marginalRate = 0.26;
            else if (income > 55000) marginalRate = 0.205;
            else marginalRate = 0.15;
            // Add ~5% for provincial
            marginalRate += 0.05;

            const splitOptimized = RetirementCalcV4.optimizePlan(inputs, {
                includeSplitOptimization: true,
                marginalRate
            });

            const newSplit = splitOptimized.params.contributionSplit;
            const userSplit = inputs.contributionSplit || { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 };

            const splitChanged = newSplit && (
                Math.abs((newSplit.rrsp || 0) - (userSplit.rrsp || 0)) > 0.05 ||
                Math.abs((newSplit.tfsa || 0) - (userSplit.tfsa || 0)) > 0.05
            );

            if (!splitChanged) {
                box.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">✅ Your current savings split is already optimal for this strategy.</p>`;
                box.classList.remove('hidden');
                return;
            }

            // Calculate the max spend with the new split (accounting for refund loss)
            const newMax = splitOptimized.params.maxSpend;
            const adjustedContrib = splitOptimized.params.adjustedContribution;
            const contribDiff = adjustedContrib ? (inputs.monthlyContribution - adjustedContrib) : 0;

            const s = newSplit;
            let html = `<div class="savings-split-result">`;
            html += `<strong>💡 Optimized Savings Split</strong>`;
            html += `<div style="margin: 8px 0; font-size: 13px;">`;
            html += `<div>Current: ${Math.round(userSplit.rrsp*100)}% RRSP / ${Math.round(userSplit.tfsa*100)}% TFSA / ${Math.round((userSplit.nonReg||0)*100)}% Non-Reg</div>`;
            html += `<div>Suggested: <strong>${Math.round(s.rrsp*100)}% RRSP / ${Math.round(s.tfsa*100)}% TFSA / ${Math.round((s.nonReg||0)*100)}% Non-Reg</strong></div>`;
            html += `</div>`;

            if (contribDiff > 0) {
                html += `<div class="refund-warning">`;
                html += `⚠️ Shifting from RRSP reduces your tax refund by ~${fmt(contribDiff)}/mo (${fmt(contribDiff * 12)}/yr). `;
                html += `Your effective contribution drops from ${fmt(inputs.monthlyContribution)}/mo to ${fmt(adjustedContrib)}/mo.`;
                html += `</div>`;
            }

            if (newMax > currentOptMax) {
                html += `<div class="split-benefit positive">Even after the refund loss, this split lets you spend <strong>${fmt(newMax)}/yr</strong> (${fmt(newMax - currentOptMax)}/yr more).</div>`;
            } else if (newMax === currentOptMax) {
                html += `<div class="split-benefit neutral">Same spending power, but may improve tax efficiency or estate value.</div>`;
            } else {
                html += `<div class="split-benefit negative">After accounting for the lost RRSP refund, this actually reduces spending to ${fmt(newMax)}/yr. <strong>Keep your current split.</strong></div>`;
            }

            html += `</div>`;
            box.innerHTML = html;
            box.classList.remove('hidden');
        } catch(e) {
            console.error('Split analysis error:', e);
            box.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">Couldn't analyze savings splits.</p>`;
            box.classList.remove('hidden');
        }
    },

    _generateStrategyNarratives(inputs, optParams, userStats, advStats, optStats, userMax, advMax, optMax) {
        const fmt = (v) => '$' + Math.round(Math.abs(v)).toLocaleString();
        const lifetimeTax = (stats) => stats.tax + (stats.estateTax || 0);
        const retAge = inputs.retirementAge || 65;
        const lifeExp = inputs.lifeExpectancy || 90;
        const retYears = lifeExp - retAge;

        // Your Plan narrative
        const userCppDelay = inputs.cppStartAge > 65;
        const userOasDelay = inputs.oasStartAge > 65;
        let userNarr = `You're taking CPP at ${inputs.cppStartAge} and OAS at ${inputs.oasStartAge}. `;
        if (userCppDelay || userOasDelay) {
            userNarr += `By delaying, you get larger monthly cheques — your total government benefits come to ${fmt(userStats.cpp + userStats.oas + userStats.gis)} over ${retYears} years. `;
            if (inputs.cppStartAge > retAge) {
                userNarr += `From ${retAge} to ${inputs.cppStartAge - 1}, you draw from your portfolio (mainly RRSP at low tax brackets) to bridge the gap. `;
            }
        } else {
            userNarr += `Taking benefits right at 65 gives you income immediately. `;
        }
        userNarr += `Lifetime tax (income + estate): ${fmt(lifetimeTax(userStats))}. `;
        if (userStats.legacy > 0) userNarr += `You'd leave about ${fmt(userStats.legacy)} to your estate.`;

        // Advisor narrative
        let advNarr = `A good advisor starts CPP and OAS at 65 and does conservative bracket-filling — `;
        advNarr += `pulling from RRSP up to the first tax bracket ($55K) to use cheap tax room, then TFSA for the rest. `;
        advNarr += `For large RRSPs (>$300K), they'll fill up to the OAS clawback threshold. `;
        advNarr += `Lifetime tax: ${fmt(lifetimeTax(advStats))}. `;
        if (advMax < userMax) {
            advNarr += `Result: you can only sustain ${fmt(advMax)}/yr — ${fmt(userMax - advMax)}/yr less than your plan.`;
        } else if (advMax > userMax) {
            advNarr += `Result: you can sustain ${fmt(advMax)}/yr.`;
        } else {
            advNarr += `Result: same spending power at ${fmt(advMax)}/yr.`;
        }

        // Optimized narrative
        let optNarr = `The optimizer tested ~70 combinations of CPP timing, OAS timing, and withdrawal strategies to find the best fit. `;
        optNarr += `Best result: CPP at ${optParams.cppAge}, OAS at ${optParams.oasAge}`;
        if (optParams.strategy !== 'naive') {
            optNarr += ` with RRSP meltdown — deliberately pulling from your RRSP in low-tax years to avoid massive forced withdrawals after 71. `;
            optNarr += `Lifetime tax: ${fmt(lifetimeTax(optStats))}. `;
        } else {
            optNarr += ` with TFSA-primary withdrawals. `;
        }
        if (optStats.gis > 0) {
            optNarr += `This strategy also qualifies you for ${fmt(optStats.gis)} in GIS by keeping taxable income low in key years. `;
        }
        if (optMax >= userMax && optStats.legacy > userStats.legacy) {
            optNarr += `Same spending power as your plan, but ${fmt(optStats.legacy - userStats.legacy)} more in estate value.`;
        } else if (optMax > userMax) {
            optNarr += `You can spend ${fmt(optMax - userMax)}/yr more than your current plan.`;
        } else {
            optNarr += `Max sustainable spending: ${fmt(optMax)}/yr.`;
        }

        optNarr += ` Use the "What if I changed my savings split?" button above to explore further.`;

        return { user: userNarr, advisor: advNarr, optimized: optNarr };
    },

    _displayTaxComparison(inputs) {
        const section = document.getElementById('tax-comparison');
        const content = document.getElementById('tax-comparison-content');
        if (!section || !content) return;

        try {
            const comparison = RetirementCalcV4.compareTaxStrategies(inputs);
            const s = comparison.savings;
            const fmt = (v) => '$' + Math.abs(Math.round(v)).toLocaleString();

            // Only show if there's meaningful savings
            if (s.totalBenefit < 500 && s.taxSaved < 500) {
                section.classList.add('hidden');
                return;
            }

            section.classList.remove('hidden');

            const items = [];
            if (s.taxSaved > 0) items.push(`<div class="tax-saving-item"><span class="saving-label">💰 Tax Savings</span><span class="saving-value">${fmt(s.taxSaved)}</span><span class="saving-desc">Less tax paid over retirement</span></div>`);
            if (s.oasPreserved > 0) items.push(`<div class="tax-saving-item"><span class="saving-label">🏛️ OAS Preserved</span><span class="saving-value">${fmt(s.oasPreserved)}</span><span class="saving-desc">More OAS by avoiding clawback</span></div>`);
            if (s.gisPreserved > 0) items.push(`<div class="tax-saving-item"><span class="saving-label">🛡️ GIS Preserved</span><span class="saving-value">${fmt(s.gisPreserved)}</span><span class="saving-desc">More GIS by managing taxable income</span></div>`);
            if (s.extraYears > 0) items.push(`<div class="tax-saving-item"><span class="saving-label">📅 Extra Years</span><span class="saving-value">+${s.extraYears} years</span><span class="saving-desc">Money lasts longer</span></div>`);

            const totalBenefit = Math.max(0, s.totalBenefit);

            content.innerHTML = `
                <h3>🧮 Smart Withdrawal Strategy</h3>
                <p class="section-intro">How our tax-optimized approach compares to a basic "use TFSA first" strategy:</p>
                
                <div class="tax-comparison-total">
                    <div class="total-saved">${fmt(totalBenefit)}</div>
                    <div class="total-label">Total lifetime benefit</div>
                </div>

                <div class="tax-saving-grid">${items.join('')}</div>

                <div class="tax-comparison-detail">
                    <div class="strategy-row">
                        <span>📊 Our strategy (tax paid):</span>
                        <span>${fmt(comparison.smart.totalTax)}</span>
                    </div>
                    <div class="strategy-row">
                        <span>📉 Basic strategy (tax paid):</span>
                        <span>${fmt(comparison.naive.totalTax)}</span>
                    </div>
                </div>

                <details class="tax-explainer">
                    <summary>How does this work?</summary>
                    <div class="explainer-content">
                        <p><strong>Basic approach:</strong> Most people use TFSA first ("why pay tax?"), then savings, then RRSP last. This leaves RRSP growing — but at 71, CRA forces minimum withdrawals (RRIF). With a large balance, these forced withdrawals push you into high tax brackets and can trigger OAS clawback.</p>
                        <p><strong>Our approach:</strong> Strategic RRSP "meltdown" in the gap years (retirement to 65) fills low tax brackets cheaply. By 71, your RRSP balance is smaller, so forced RRIF minimums are manageable. TFSA is preserved for tax-free income when you need it most.</p>
                    </div>
                </details>
            `;
        } catch (e) {
            section.classList.add('hidden');
        }
    },

    _generateRetirementNarrative(inputs, results) {
        const section = document.getElementById('retirement-narrative');
        const content = document.getElementById('retirement-narrative-content');
        if (!section || !content) return;

        section.classList.remove('hidden');

        const fmt = (v) => '$' + Math.round(v).toLocaleString();
        const fmtK = (v) => {
            const n = Math.round(v);
            if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000) return '$' + Math.round(n / 1000).toLocaleString() + 'K';
            return '$' + n.toLocaleString();
        };

        const retireAge = inputs.retirementAge;
        const lifeExp = inputs.lifeExpectancy;
        const retirementYears = lifeExp - retireAge;
        const annualSpending = inputs.annualSpending;
        const monthlySpending = Math.round(annualSpending / 12);
        const portfolio = results.summary.portfolioAtRetirement || 0;
        const lastsAge = results.summary.moneyLastsAge || lifeExp;
        const legacy = results.summary.legacyAmount || 0;
        const isOnTrack = lastsAge >= lifeExp;
        const probability = this.monteCarloResults?.successRate || 0;

        // Get gov income
        const retYear = results.yearByYear?.find(y => y.age === retireAge);
        const cpp = retYear?.cppReceived || 0;
        const oas = retYear?.oasReceived || 0;
        const gis = retYear?.gisReceived || 0;
        const govTotal = cpp + oas + gis;

        // Spending curve info
        const isFrontLoaded = inputs.spendingCurve === 'frontloaded';
        const goGoSpending = isFrontLoaded ? Math.round(annualSpending * 1.2) : annualSpending;
        const noGoSpending = isFrontLoaded ? Math.round(annualSpending * 0.8) : annualSpending;

        // Max sustainable from optimizer
        const maxSustainable = this._lastMaxSustainable || annualSpending;
        const extraRoom = maxSustainable - annualSpending;
        const extraMonthly = Math.round(extraRoom / 12);

        // Build narrative
        let narrative = '';

        // Opening
        if (isOnTrack) {
            narrative += `<h3>📖 Your Retirement Story</h3>`;
            narrative += `<p>You retire at <strong>${retireAge}</strong> with a portfolio of <strong>${fmtK(portfolio)}</strong> and <strong>${retirementYears} years</strong> of retirement ahead.</p>`;
        } else {
            narrative += `<h3>📖 Your Retirement Outlook</h3>`;
            narrative += `<p>At age <strong>${retireAge}</strong>, you'd have <strong>${fmtK(portfolio)}</strong> saved — but your plan runs short at age <strong>${lastsAge}</strong>, leaving a ${lifeExp - lastsAge}-year gap.</p>`;
        }

        // Monthly picture
        narrative += `<p style="margin-top:12px"><strong>Monthly life:</strong> Your ${fmt(annualSpending)}/year budget means <strong>${fmt(monthlySpending)}/month</strong> to work with.`;
        if (govTotal > 0) {
            narrative += ` Government benefits (CPP + OAS${gis > 0 ? ' + GIS' : ''}) cover <strong>${fmt(govTotal)}/year</strong> of that — the rest comes from your savings.`;
        }
        narrative += `</p>`;

        // Spending curve narrative
        if (isFrontLoaded) {
            narrative += `<div class="narrative-info-box" style="margin: 12px 0; padding: 10px 12px; border-radius: 8px; border-left: 3px solid #3b82f6;">`;
            narrative += `<strong>🎢 Your spending curve:</strong><br>`;
            narrative += `<strong>Go-Go years</strong> (${retireAge}–${retireAge + 9}): ${fmt(goGoSpending)}/yr — travel, hobbies, bucket list items<br>`;
            narrative += `<strong>Slow-Go years</strong> (${retireAge + 10}–${retireAge + 19}): ${fmt(annualSpending)}/yr — settling into routine<br>`;
            narrative += `<strong>No-Go years</strong> (${retireAge + 20}+): ${fmt(noGoSpending)}/yr — simpler lifestyle, less mobility`;
            narrative += `</div>`;
        }

        // Extra room / what it means
        if (isOnTrack && extraRoom > 1000) {
            narrative += `<div class="narrative-success-box" style="margin: 12px 0; padding: 10px 12px; border-radius: 8px; border-left: 3px solid #10b981;">`;
            narrative += `<strong>💰 You have room:</strong> You could spend up to <strong>${fmt(maxSustainable)}/year</strong> and still be funded to ${lifeExp}. `;
            narrative += `That extra <strong>${fmt(extraRoom)}/year</strong> (${fmt(extraMonthly)}/month) could mean:`;
            narrative += `<ul style="margin: 6px 0 0; padding-left: 20px; font-size: 14px;">`;

            if (extraMonthly >= 1500) {
                narrative += `<li>An extra international vacation every year</li>`;
                narrative += `<li>Upgrading to a nicer car every few years</li>`;
                narrative += `<li>Regular gifts or help for family members</li>`;
            } else if (extraMonthly >= 800) {
                narrative += `<li>One extra trip per year (domestic or a deal abroad)</li>`;
                narrative += `<li>Regular restaurant meals and entertainment</li>`;
                narrative += `<li>A hobby budget (golf, workshops, equipment)</li>`;
            } else if (extraMonthly >= 300) {
                narrative += `<li>A few nice dinners out each month</li>`;
                narrative += `<li>A weekend getaway every quarter</li>`;
                narrative += `<li>Subscription services, gym membership, hobbies</li>`;
            } else {
                narrative += `<li>A couple of extra treats per month</li>`;
                narrative += `<li>Small splurges or gifts</li>`;
            }
            narrative += `</ul></div>`;
        }

        // Legacy
        if (isOnTrack && legacy > 10000) {
            narrative += `<p>📦 <strong>Legacy:</strong> At age ${lifeExp}, you'd leave behind roughly <strong>${fmtK(legacy)}</strong> for family or causes you care about.</p>`;
        }

        // Probability context
        if (probability > 0) {
            narrative += `<p style="font-size: 13px; color: var(--text-muted);">`;
            if (probability >= 85) {
                narrative += `With an ${probability}% success rate across 1,000 market simulations, this plan is robust against most economic downturns.`;
            } else if (probability >= 70) {
                narrative += `An ${probability}% success rate means your plan works in most scenarios, but a prolonged market downturn could require adjustments.`;
            } else if (probability >= 50) {
                narrative += `A ${probability}% success rate means there's meaningful risk. Consider increasing savings or reducing spending for more security.`;
            } else {
                narrative += `At ${probability}%, this plan has significant risk. Strongly consider adjustments — more savings, later retirement, or lower spending.`;
            }
            narrative += `</p>`;
        }

        content.innerHTML = `<div class="retirement-narrative-card">${narrative}</div>`;
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
        
        // Close any open Advanced Assumptions / details sections
        document.querySelectorAll('.step5-section[open]').forEach(d => d.removeAttribute('open'));
        const assumptionsContent = document.getElementById('assumptions-content');
        const assumptionsIcon = document.querySelector('.toggle-icon');
        if (assumptionsContent && !assumptionsContent.classList.contains('hidden')) {
            assumptionsContent.classList.add('hidden');
            if (assumptionsIcon) assumptionsIcon.textContent = '▼';
        }
        
        // Auto-update previews when entering certain steps
        if (step === 'contributions') {
            this._updateContributionGrounding();
            this._updateContributionRoomEstimate();
        }
        if (step === 'retirement') {
            this._updateSpendingRecommendation();
            this._updateCPPPreview();
            if (this.familyStatus === 'couple') this._updateCPPPreviewCouple();
            this._updateRetirementGrounding();
        }
        
        if (step === 'healthcare') {
            this._updateStep5AddedItems();
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

        // Update spending recommendation and presets with regional cost of living
        this._updateSpendingRecommendation();
        this._updateSpendingPresets();
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
        const pv = (id) => parseFloat(document.getElementById(id)?.value) || 0;
        let rrsp, tfsa, nonreg, lira, other, cash;
        if (this.accountMode === 'separate') {
            rrsp = pv('rrsp-p1') + pv('rrsp-p2');
            tfsa = pv('tfsa-p1') + pv('tfsa-p2');
            nonreg = pv('nonreg-p1') + pv('nonreg-p2');
            lira = pv('lira-p1') + pv('lira-p2');
            other = pv('other-p1') + pv('other-p2');
            cash = pv('cash-p1') + pv('cash-p2');
        } else {
            rrsp = pv('rrsp');
            tfsa = pv('tfsa');
            nonreg = pv('nonreg');
            lira = pv('lira');
            other = pv('other');
            cash = pv('cash');
        }

        const total = rrsp + tfsa + nonreg + lira + other + cash;

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

    _updateContributionGrounding() {
        const el = document.getElementById('contribution-grounding');
        if (!el) return;
        const age = parseInt(document.getElementById('current-age')?.value) || 35;
        const retAge = parseInt(document.getElementById('retirement-age')?.value) || 65;
        const totalSavings = (parseFloat(document.getElementById('rrsp')?.value) || 0)
            + (parseFloat(document.getElementById('tfsa')?.value) || 0)
            + (parseFloat(document.getElementById('nonreg')?.value) || 0)
            + (parseFloat(document.getElementById('other')?.value) || 0);
        const yearsToRetire = Math.max(1, retAge - age);
        const rate = 0.06; // 6% assumed growth
        
        // Future value of existing savings with compounding
        const fvExisting = totalSavings * Math.pow(1 + rate, yearsToRetire);
        const target = 500000;
        const gap = Math.max(0, target - fvExisting);
        
        // Monthly contribution needed to fill the gap (future value of annuity)
        let recommended = 0;
        if (gap > 0) {
            const monthlyRate = rate / 12;
            const months = yearsToRetire * 12;
            // FV of annuity: PMT × ((1+r)^n - 1) / r = gap
            // PMT = gap × r / ((1+r)^n - 1)
            const annuityFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
            recommended = Math.round(gap / annuityFactor);
        }
        
        const fvFormatted = fvExisting >= 1000000 
            ? `$${(fvExisting/1000000).toFixed(1)}M` 
            : `$${Math.round(fvExisting/1000).toLocaleString()}K`;
        
        if (fvExisting >= target) {
            el.innerHTML = `
                <strong>💡 Quick math:</strong> Your $${Math.round(totalSavings/1000).toLocaleString()}K grows to ~<strong>${fvFormatted}</strong> by ${retAge} at 6% return — you're already on track!
                <br><small style="opacity: 0.8;">Canadian median savings rate: 15% of income | Average monthly: $500-800</small>
            `;
        } else {
            el.innerHTML = `
                <strong>💡 Quick math:</strong> Your savings grow to ~${fvFormatted} by ${retAge}. To reach $500K, add ~<strong>$${recommended.toLocaleString()}/month</strong>
                <br><small style="opacity: 0.8;">Canadian median savings rate: 15% of income | Average monthly: $500-800</small>
            `;
        }
    },

    _updateContributionRoomEstimate() {
        const rrspInput = document.getElementById('rrsp-room-override');
        const tfsaInput = document.getElementById('tfsa-room-override');
        if (!rrspInput || !tfsaInput) return;
        
        const age = parseInt(document.getElementById('current-age')?.value) || 35;
        const income = parseFloat(document.getElementById('annual-income')?.value) || 70000;
        const rrspBal = parseFloat(document.getElementById('rrsp')?.value) || 0;
        const tfsaBal = parseFloat(document.getElementById('tfsa')?.value) || 0;
        
        // TFSA room estimate
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - age;
        const tfsaFrom = Math.max(2009, birthYear + 18);
        const TFSA_LIMITS = {2009:5000,2010:5000,2011:5000,2012:5000,2013:5500,2014:5500,2015:10000,2016:5500,2017:5500,2018:5500,2019:6000,2020:6000,2021:6000,2022:6000,2023:6500,2024:7000,2025:7000};
        let tfsaTotal = 0;
        for (let yr = tfsaFrom; yr <= currentYear; yr++) tfsaTotal += TFSA_LIMITS[yr] || 7000;
        const tfsaRoom = Math.max(0, tfsaTotal - tfsaBal);
        
        // RRSP room estimate  
        const workStart = 22;
        const yearsWorked = Math.max(0, age - workStart);
        let rrspTotal = 0;
        for (let i = 0; i < yearsWorked; i++) {
            const estIncome = income / Math.pow(1.03, yearsWorked - i);
            rrspTotal += Math.min(estIncome * 0.18, 31560);
        }
        const rrspRoom = Math.max(0, rrspTotal - (rrspBal / 1.5));
        
        const fmt = (v) => '$' + Math.round(v).toLocaleString();
        rrspInput.placeholder = fmt(Math.round(rrspRoom));
        tfsaInput.placeholder = fmt(Math.round(tfsaRoom));
    },

    _updateRetirementGrounding() {
        const el = document.getElementById('retirement-grounding');
        if (!el) return;
        const age = parseInt(document.getElementById('current-age')?.value) || 35;
        const totalSavings = (parseFloat(document.getElementById('rrsp')?.value) || 0)
            + (parseFloat(document.getElementById('tfsa')?.value) || 0)
            + (parseFloat(document.getElementById('nonreg')?.value) || 0)
            + (parseFloat(document.getElementById('other')?.value) || 0);
        const monthly = parseFloat(document.getElementById('monthly-contribution')?.value) || 0;
        const returnRate = (parseFloat(document.getElementById('return-rate')?.value) || 6) / 100;
        const merFee = (parseFloat(document.getElementById('mer-fee')?.value) || 0) / 100;
        const netReturn = returnRate - merFee;
        const contribGrowth = (parseFloat(document.getElementById('contribution-growth')?.value) || 0) / 100;
        const fv = (years) => {
            if (years <= 0) return totalSavings;
            // Year-by-year to handle contribution growth
            let balance = totalSavings;
            for (let y = 0; y < years; y++) {
                const thisYearMonthly = monthly * Math.pow(1 + contribGrowth, y);
                balance = balance * (1 + netReturn) + thisYearMonthly * 12;
            }
            return balance;
        };
        // Pick two meaningful milestone ages based on current age
        // If already 55+, show current + 5 years out
        let age1, age2;
        if (age >= 60) {
            age1 = age + 1;
            age2 = age + 5;
        } else if (age >= 55) {
            age1 = 60;
            age2 = 65;
        } else {
            age1 = 60;
            age2 = 65;
        }
        const at1 = Math.round(fv(age1 - age));
        const at2 = Math.round(fv(age2 - age));
        const fmtK = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}K`;
        el.innerHTML = `
            <strong>📊 Your projected portfolio:</strong><br>
            At ${age1}: ~<strong>${fmtK(at1)}</strong> | At ${age2}: ~<strong>${fmtK(at2)}</strong>
            <br><small style="opacity: 0.8;">Based on ${(netReturn*100).toFixed(1)}% net return${contribGrowth > 0 ? `, ${(contribGrowth*100).toFixed(1)}% annual contrib increase` : ''}</small>
        `;
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

        // Update placeholder to reflect regional average
        const spendingInput = document.getElementById('annual-spending');
        if (spendingInput && !spendingInput.value) {
            spendingInput.placeholder = regionalAverage.toLocaleString();
        }
    },

    _updateSpendingPresets() {
        const regionData = this.selectedRegion ? RegionalDataV2.getRegion(this.selectedRegion) : null;
        const multiplier = regionData ? (regionData.costOfLivingIndex / 100) : 1;
        const isSingle = this.familyStatus === 'single';

        // Map lifestyle keys to BenchmarksV2 data
        const lifestyleMap = {
            modest: isSingle ? 35000 : 48000,
            average: isSingle ? 48000 : 65000,
            comfortable: isSingle ? 62000 : 85000,
            luxury: isSingle ? 95000 : 130000,
            ultrawealthy: isSingle ? 150000 : 200000
        };

        document.querySelectorAll('.preset-btn').forEach(btn => {
            const lifestyle = btn.dataset.lifestyle;
            const base = lifestyleMap[lifestyle] || parseInt(btn.dataset.baseAmount) || 48000;
            const adjusted = Math.round((base * multiplier) / 1000) * 1000;
            btn.dataset.amount = adjusted;
            const amountEl = btn.querySelector('.preset-amount');
            if (amountEl) {
                amountEl.textContent = adjusted >= 1000 ? `$${Math.round(adjusted / 1000)}K` : `$${adjusted.toLocaleString()}`;
            }
        });
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

        let adjusted, lifetime;
        if (this.cppOverride) {
            // User provided their own CPP at 65 — apply start age adjustment
            adjusted = CPPOptimizer.calculateByAge(this.cppOverride, this.cppStartAge);
            lifetime = CPPOptimizer.calculateLifetimeValue(this.cppOverride, this.cppStartAge, lifeExpectancy);
        } else {
            const baseCPP = CPPCalculator.estimateCPP(baseIncome, yearsContributing);
            adjusted = CPPOptimizer.calculateByAge(baseCPP.total, this.cppStartAge);
            lifetime = CPPOptimizer.calculateLifetimeValue(baseCPP.total, this.cppStartAge, lifeExpectancy);
        }

        document.getElementById('cpp-age-value').textContent = this.cppStartAge;
        document.getElementById('cpp-amount-value').textContent = `$${Math.round(adjusted).toLocaleString()}/year${this.cppOverride ? ' (override)' : ''}`;
        const cppBonusEl = document.getElementById('cpp-bonus-value');
        if (cppBonusEl) {
            const cppPct = this.cppStartAge < 65
                ? `-${((65 - this.cppStartAge) * 12 * 0.6).toFixed(0)}%`
                : this.cppStartAge > 65
                ? `+${((this.cppStartAge - 65) * 12 * 0.7).toFixed(0)}%`
                : 'No adjustment';
            cppBonusEl.textContent = cppPct;
        }
    },

    _updateCPPPreviewCouple() {
        const income1 = parseFloat(document.getElementById('income-person1')?.value) || 60000;
        const income2 = parseFloat(document.getElementById('income-person2')?.value) || 60000;
        const retirementAge = parseInt(document.getElementById('retirement-age')?.value) || 65;
        const yearsContributing = Math.min(retirementAge - 18, 39);

        const ageP1 = this.cppStartAgeP1 || 65;
        const ageP2 = this.cppStartAgeP2 || 65;

        const adjusted1 = this.cppOverrideP1
            ? CPPOptimizer.calculateByAge(this.cppOverrideP1, ageP1)
            : CPPOptimizer.calculateByAge(CPPCalculator.estimateCPP(income1, yearsContributing).total, ageP1);
        const adjusted2 = this.cppOverrideP2
            ? CPPOptimizer.calculateByAge(this.cppOverrideP2, ageP2)
            : CPPOptimizer.calculateByAge(CPPCalculator.estimateCPP(income2, yearsContributing).total, ageP2);

        // Person 1
        const ageEl1 = document.getElementById('cpp-age-value-p1');
        const amtEl1 = document.getElementById('cpp-amount-value-p1');
        const bonusEl1 = document.getElementById('cpp-bonus-value-p1');
        if (ageEl1) ageEl1.textContent = ageP1;
        if (amtEl1) amtEl1.textContent = `$${Math.round(adjusted1).toLocaleString()}/year`;
        if (bonusEl1) bonusEl1.textContent = ageP1 < 65 ? `-${((65 - ageP1) * 12 * 0.6).toFixed(0)}%` : ageP1 > 65 ? `+${((ageP1 - 65) * 12 * 0.7).toFixed(0)}%` : 'No adjustment';

        // Person 2
        const ageEl2 = document.getElementById('cpp-age-value-p2');
        const amtEl2 = document.getElementById('cpp-amount-value-p2');
        const bonusEl2 = document.getElementById('cpp-bonus-value-p2');
        if (ageEl2) ageEl2.textContent = ageP2;
        if (amtEl2) amtEl2.textContent = `$${Math.round(adjusted2).toLocaleString()}/year`;
        if (bonusEl2) bonusEl2.textContent = ageP2 < 65 ? `-${((65 - ageP2) * 12 * 0.6).toFixed(0)}%` : ageP2 > 65 ? `+${((ageP2 - 65) * 12 * 0.7).toFixed(0)}%` : 'No adjustment';

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

        // Scale for couple + region
        const isSingle = this.familyStatus === 'single';
        const regionData = this.selectedRegion ? RegionalDataV2.getRegion(this.selectedRegion) : null;
        const regionMultiplier = regionData ? (regionData.costOfLivingIndex / 100) : 1;
        // LifestyleData has single values; couple presets in _updateSpendingPresets use different base
        const activeBtn = document.querySelector(`.preset-btn[data-lifestyle="${lifestyle}"]`);
        const adjustedAnnual = activeBtn ? parseInt(activeBtn.dataset.amount) : Math.round(data.annual * regionMultiplier);
        const scaleFactor = adjustedAnnual / data.annual;

        document.getElementById('lifestyle-detail-title').textContent =
            `${data.name} Lifestyle - $${adjustedAnnual.toLocaleString()}/year`;
        document.getElementById('lifestyle-detail-tagline').textContent = data.tagline;

        const breakdownHTML = Object.entries(data.breakdown).map(([category, details]) => {
            const adjMonthly = Math.round(details.monthly * scaleFactor);
            const adjAnnual = Math.round(details.annual * scaleFactor);
            return `
            <div class="breakdown-item">
                <div class="breakdown-category">${category.charAt(0).toUpperCase() + category.slice(1)}</div>
                <div class="breakdown-amount">$${adjMonthly.toLocaleString()}/mo <span style="color:#64748b; font-size:12px;">($${adjAnnual.toLocaleString()}/yr)</span></div>
                <div class="breakdown-description">${details.description}</div>
            </div>
        `}).join('');
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

            // If house sale is enabled, inject it as a windfall + adjust spending
            // so the main projection/chart/MC all reflect the sale
            const houseSale = this._getHouseSaleInputs();
            if (houseSale) {
                const { salePrice, saleAge, currentMonthlyCosts, rentAfter } = houseSale;
                const netSpendingChange = (rentAfter * 12) - (currentMonthlyCosts * 12);
                inputs.annualSpending = inputs.annualSpending + netSpendingChange;
                inputs.windfalls = [
                    ...(inputs.windfalls || []),
                    {
                        name: 'House Sale',
                        amount: salePrice,
                        year: saleAge,
                        probability: 100,
                        taxable: false,
                        destination: 'nonReg'
                    }
                ];
            }

            // Calculate base scenario (now includes house sale if enabled)
            // NOTE: calc.js handles windfalls internally in _generateProjection
            const baseResults = RetirementCalcV4.calculate(inputs);

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
            document.getElementById('email-fixed-bar').style.display = 'flex';
            
            // Reset tweak tab to "Your Plan"
            document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.plan-tab[data-plan-tab="plan"]')?.classList.add('active');
            document.getElementById('tweak-panel')?.classList.add('hidden');

            // NOW display results (charts will draw to visible parent)
            this.currentScenario = 'base';
            this._lastCalcInputs = inputs;
            this._lastCalcResults = baseResults;
            this._baseInputs = { ...inputs, windfalls: [...(inputs.windfalls || [])] };
            this._spendAdjust = 0;
            this._saveAdjust = 0;
            this._updateAdjusterDisplay();
            this._displayResults(baseResults, inputs);

            // House sale comparison (if enabled)
            this._runHouseSaleComparison(inputs, baseResults);

            // Spending optimizer
            this._runSpendingOptimizer(inputs, baseResults);

            // Tax savings comparison + strategy comparison view
            // Tax comparison removed — covered by strategy comparison
            this._buildStrategyComparison(inputs, baseResults);
            
            // Retirement narrative
            this._generateRetirementNarrative(inputs, baseResults);

            // Setup scenario tab switching (after results are visible)
            this._setupScenarioTabs();

            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Run V5 Enhanced Analysis (Monte Carlo, Tax Optimization, What-If)
            // NOTE: MC runs async in setTimeout, so we set a callback to update when done
            if (typeof AppV5Enhanced !== 'undefined') {
                AppV5Enhanced.onMCComplete = (mcResults) => {
                    this.monteCarloResults = mcResults;
                    // Also pre-compute MC for each scenario (200 iterations for speed)
                    this._precomputeScenarioMC();
                    // Update stat card with MC rate
                    if (this.currentScenario === 'base') {
                        this._updateSuccessRateDisplay(mcResults.successRate);
                    }
                };
                AppV5Enhanced.runEnhancedAnalysis(inputs, baseResults);
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


        // Find when money runs out — use $100 threshold to avoid floating-point ghost balances
        // Also check if income can't meet spending need (>10% shortfall = effectively depleted)
        const runOutYear = results.yearByYear.find(y => {
            if (y.phase !== 'retirement') return false;
            const balance = y.totalBalance !== undefined ? y.totalBalance : y.totalPortfolio;
            if ((balance || 0) <= 100) return true;
            // Check if spending need can't be met
            if (y.targetSpending > 0) {
                const totalIncome = (y.withdrawal || 0) + (y.governmentIncome || 0) + (y.additionalIncome || 0) + (y.pensionIncome || 0);
                const shortfall = y.targetSpending - totalIncome;
                if (shortfall > y.targetSpending * 0.1) return true;
            }
            return false;
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
                windfalls: [...(baseInputs.windfalls || [])],
                annualSpending: Math.round(baseInputs.annualSpending * 1.2)
            },
            save500more: {
                ...baseInputs,
                windfalls: [...(baseInputs.windfalls || [])],
                monthlyContribution: baseInputs.monthlyContribution + 500
            },
            save500less: {
                ...baseInputs,
                windfalls: [...(baseInputs.windfalls || [])],
                monthlyContribution: Math.max(0, baseInputs.monthlyContribution - 500)
            }
        };

        // Calculate each scenario (calc.js handles windfalls internally)
        Object.keys(scenarios).forEach(key => {
            const scenarioInputs = scenarios[key];
            const results = RetirementCalcV4.calculate(scenarioInputs);

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

    _updateSuccessRateDisplay(rate) {
        const el = document.getElementById('stat-probability');
        if (el) {
            el.textContent = `${rate}%`;
            el.style.color = rate >= 80 ? 'var(--success, green)' : rate >= 60 ? 'orange' : 'var(--danger, red)';
        }
        const note = document.getElementById('stat-probability-note');
        if (note) {
            if (rate >= 90) { note.textContent = 'Excellent'; note.style.color = 'var(--success)'; }
            else if (rate >= 70) { note.textContent = 'Good'; note.style.color = 'green'; }
            else if (rate >= 50) { note.textContent = 'Fair'; note.style.color = 'orange'; }
            else { note.textContent = 'Needs work'; note.style.color = 'var(--danger)'; }
        }
    },

    _precomputeScenarioMC() {
        if (typeof MonteCarloSimulator === 'undefined') return;
        // Quick MC for each scenario (200 iterations for speed)
        Object.keys(this.scenarioResults).forEach(key => {
            if (key === 'base') {
                this.scenarioResults[key].mcRate = this.monteCarloResults?.successRate;
                return;
            }
            try {
                const mc = MonteCarloSimulator.simulate(this.scenarioResults[key].inputs, {
                    iterations: 200, volatility: 0.12, marketCrashProbability: 0.00
                });
                this.scenarioResults[key].mcRate = mc.successRate;
            } catch(e) {
                this.scenarioResults[key].mcRate = null;
            }
        });
    },

    _switchScenario(scenarioKey) {
        if (!this.scenarioResults[scenarioKey]) {
            return;
        }

        this.currentScenario = scenarioKey;
        const scenario = this.scenarioResults[scenarioKey];
        this._displayResults(scenario.results, scenario.inputs);
        this._runSpendingOptimizer(scenario.inputs, scenario.results);

        // Update success rate with scenario-specific MC rate if available
        if (scenario.mcRate !== undefined && scenario.mcRate !== null) {
            this._updateSuccessRateDisplay(scenario.mcRate);
        }
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

            rrsp: this.accountMode === 'separate' 
                ? (parseFloat(document.getElementById('rrsp-p1')?.value) || 0) + (parseFloat(document.getElementById('rrsp-p2')?.value) || 0)
                : (parseFloat(document.getElementById('rrsp')?.value) || 0),
            tfsa: this.accountMode === 'separate'
                ? (parseFloat(document.getElementById('tfsa-p1')?.value) || 0) + (parseFloat(document.getElementById('tfsa-p2')?.value) || 0)
                : (parseFloat(document.getElementById('tfsa')?.value) || 0),
            nonReg: this.accountMode === 'separate'
                ? (parseFloat(document.getElementById('nonreg-p1')?.value) || 0) + (parseFloat(document.getElementById('nonreg-p2')?.value) || 0)
                : (parseFloat(document.getElementById('nonreg')?.value) || 0),
            lira: this.accountMode === 'separate'
                ? (parseFloat(document.getElementById('lira-p1')?.value) || 0) + (parseFloat(document.getElementById('lira-p2')?.value) || 0)
                : (parseFloat(document.getElementById('lira')?.value) || 0),
            other: this.accountMode === 'separate'
                ? (parseFloat(document.getElementById('other-p1')?.value) || 0) + (parseFloat(document.getElementById('other-p2')?.value) || 0)
                : (parseFloat(document.getElementById('other')?.value) || 0),
            cash: this.accountMode === 'separate'
                ? (parseFloat(document.getElementById('cash-p1')?.value) || 0) + (parseFloat(document.getElementById('cash-p2')?.value) || 0)
                : (parseFloat(document.getElementById('cash')?.value) || 0),

            monthlyContribution: parseFloat(document.getElementById('monthly-contribution')?.value) || 0,
            contributionSplit: {
                rrsp: (parseFloat(document.getElementById('split-rrsp')?.value) || 0) / 100,
                tfsa: (parseFloat(document.getElementById('split-tfsa')?.value) || 0) / 100,
                nonReg: (parseFloat(document.getElementById('split-nonreg')?.value) || 0) / 100
            },

            annualSpending: parseFloat(document.getElementById('annual-spending')?.value),
            healthStatus: this.healthcareExplicitlyAdded ? this.healthStatus : 'none',

            currentDebt: parseFloat(document.getElementById('current-debt')?.value) || 0,
            debtPayoffAge: parseInt(document.getElementById('debt-payoff-age')?.value) || 65,

            cppStartAge: this.familyStatus === 'couple' ? (this.cppStartAgeP1 || 65) : this.cppStartAge,
            cppStartAgeP2: this.familyStatus === 'couple' ? (this.cppStartAgeP2 || 65) : null,
            cppOverride: this.familyStatus === 'couple' ? (this.cppOverrideP1 || null) : (this.cppOverride || null),
            cppOverrideP2: this.familyStatus === 'couple' ? (this.cppOverrideP2 || null) : null,
            oasStartAge: this.familyStatus === 'couple' ? (this.oasStartAgeP1 || 65) : (this.oasStartAge || 65),
            oasStartAgeP2: this.oasStartAgeP2 || 65,
            additionalIncomeSources: IncomeSources.getAll(),
            windfalls: this.windfalls || [],

            employerPension: parseFloat(document.getElementById('employer-pension')?.value) || 0,
            employerPensionStartAge: parseInt(document.getElementById('pension-start-age')?.value) || 65,
            employerPensionIndexed: document.getElementById('pension-indexed')?.checked !== false,

            returnRate: parseFloat(document.getElementById('return-rate')?.value) || 6,
            inflationRate: parseFloat(document.getElementById('inflation-rate')?.value) || 2.5,
            contributionGrowthRate: parseFloat(document.getElementById('contribution-growth')?.value) || 0,
            merFee: parseFloat(document.getElementById('mer-fee')?.value) || 0,
            spendingCurve: this.spendingCurve || 'flat',

            // Home value (safety net, not counted as retirement savings)
            homeValue: parseFloat(document.getElementById('home-value')?.value) || 0,

            // Estate assets (non-liquid, not sold in retirement)
            estateAssets: this.estateAssets || [],

            // Contribution room overrides (optional)
            rrspRoomOverride: document.getElementById('rrsp-room-override')?.value ? parseFloat(document.getElementById('rrsp-room-override').value) : undefined,
            tfsaRoomOverride: document.getElementById('tfsa-room-override')?.value ? parseFloat(document.getElementById('tfsa-room-override').value) : undefined,

            // Tier 2/3 features
            healthcareInflation: parseFloat(document.getElementById('healthcare-inflation')?.value) || 5,
            ltcMonthly: parseFloat(document.getElementById('ltc-monthly')?.value) || 0,
            ltcStartAge: parseInt(document.getElementById('ltc-start-age')?.value) || 80,
            annuityLumpSum: parseFloat(document.getElementById('annuity-lump-sum')?.value) || 0,
            annuityPurchaseAge: parseInt(document.getElementById('annuity-purchase-age')?.value) || undefined,
            annuityMonthlyPayout: parseFloat(document.getElementById('annuity-monthly-payout')?.value) || 0,
            dtc: document.getElementById('dtc-checkbox')?.checked || false,
            downsizingAge: parseInt(document.getElementById('downsizing-age')?.value) || undefined,
            downsizingProceeds: parseFloat(document.getElementById('downsizing-proceeds')?.value) || 0,
            downsizingSpendingChange: -(parseFloat(document.getElementById('downsizing-spending-change')?.value) || 0), // Negative = savings
            categoryInflation: this._getCategoryInflation(),

            // Other income/expense (multi-add arrays, summed for calc engine)
            otherRetirementIncome: (this.otherIncomeItems || []).reduce((s, i) => s + (i.amount || 0), 0),
            otherRetirementIncomeName: (this.otherIncomeItems || []).map(i => i.name).join(', ') || 'Other',
            otherRetirementIncomeTaxable: (this.otherIncomeItems || []).every(i => i.taxable !== false),
            otherRetirementExpense: (this.otherExpenseItems || []).reduce((s, i) => s + (i.amount || 0), 0),
            otherRetirementExpenseName: (this.otherExpenseItems || []).map(i => i.name).join(', ') || 'Other',
            otherIncomeItems: this.otherIncomeItems || [],
            otherExpenseItems: this.otherExpenseItems || [],

            // Additional estate assets (non-property)
            lifeInsurance: parseFloat(document.getElementById('life-insurance-amount')?.value) || 0,
            vehicleValue: parseFloat(document.getElementById('vehicle-value')?.value) || 0,
            vehicleName: document.getElementById('vehicle-name')?.value || 'Vehicle',
            otherEstateValue: parseFloat(document.getElementById('other-estate-value')?.value) || 0,
            otherEstateName: document.getElementById('other-estate-name')?.value || 'Other'
        };
    },

    // ═══════════════════════════════════════
    // Email Report
    // ═══════════════════════════════════════
    _sendEmailReport() {
        const emailInput = document.getElementById('report-email');
        const statusEl = document.getElementById('email-status');
        const sendBtn = document.getElementById('btn-send-report');
        const email = emailInput?.value?.trim();
        
        if (!email || !email.includes('@')) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#dc2626';
            statusEl.textContent = 'Please enter a valid email address.';
            return;
        }
        
        sendBtn.disabled = true;
        sendBtn.textContent = 'Generating PDF...';
        statusEl.style.display = 'block';
        statusEl.style.color = '#64748b';
        statusEl.textContent = 'Building your retirement report...';
        
        // Store email for future contact
        const emails = JSON.parse(localStorage.getItem('retirement_emails') || '[]');
        emails.push({ email, date: new Date().toISOString(), province: document.getElementById('province')?.value });
        localStorage.setItem('retirement_emails', JSON.stringify(emails));
        
        try {
            this._generatePDF(email);
            statusEl.style.color = '#059669';
            statusEl.textContent = '✅ PDF downloaded!';
            sendBtn.textContent = '✓ Done';
            setTimeout(() => {
                document.getElementById('email-modal')?.classList.add('hidden');
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send Report';
                statusEl.style.display = 'none';
            }, 2000);
        } catch (e) {
            console.error('PDF generation error:', e);
            statusEl.style.color = '#dc2626';
            statusEl.textContent = 'Error generating PDF: ' + e.message;
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Report';
        }
    },

    _generatePDF(email) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        const inputs = this._lastCalcInputs;
        const results = this._lastCalcResults;
        const summary = results?.summary;
        if (!summary) throw new Error('No results to export');
        
        const fmt = v => '$' + Math.round(v).toLocaleString();
        const fmtK = v => v >= 1000000 ? '$' + (v/1000000).toFixed(1) + 'M' : v >= 1000 ? '$' + Math.round(v/1000) + 'K' : '$' + Math.round(v);
        const pageW = 216; // letter width mm
        const margin = 20;
        const contentW = pageW - margin * 2;
        let y = 20;
        
        const addPage = () => { doc.addPage(); y = 20; };
        const checkPage = (need) => { if (y + need > 260) addPage(); };
        
        // ── Header ──
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, pageW, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Retirement Plan Report', margin, 18);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Prepared for: ${email}`, margin, 27);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-CA')}`, pageW - margin, 27, { align: 'right' });
        y = 45;
        
        // ── Plan Overview ──
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Plan Overview', margin, y); y += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        
        const province = document.getElementById('province')?.selectedOptions?.[0]?.text || inputs.province || '';
        const overviewRows = [
            ['Current Age', `${inputs.currentAge}`],
            ['Retirement Age', `${inputs.retirementAge}`],
            ['Life Expectancy', `${inputs.lifeExpectancy}`],
            ['Province', province],
            ['Annual Income', fmt(inputs.currentIncome || 0)],
            ['Monthly Savings', fmt(inputs.monthlyContribution || 0)],
            ['Annual Spending', fmt(inputs.annualSpending || 0)],
        ];
        
        overviewRows.forEach(([label, val]) => {
            doc.setFont('helvetica', 'normal');
            doc.text(label, margin, y);
            doc.setFont('helvetica', 'bold');
            doc.text(val, margin + 55, y);
            y += 5.5;
        });
        y += 5;
        
        // ── Current Savings ──
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Current Savings', margin, y); y += 7;
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        
        const savingsRows = [
            ['RRSP', fmt(inputs.rrsp || 0)],
            ['TFSA', fmt(inputs.tfsa || 0)],
            ['Non-Registered', fmt(inputs.nonReg || 0)],
        ];
        if (inputs.lira) savingsRows.push(['LIRA', fmt(inputs.lira)]);
        const totalSavings = (inputs.rrsp || 0) + (inputs.tfsa || 0) + (inputs.nonReg || 0) + (inputs.lira || 0);
        savingsRows.push(['Total', fmt(totalSavings)]);
        
        savingsRows.forEach(([label, val], i) => {
            if (i === savingsRows.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.line(margin, y - 1, margin + 80, y - 1);
                doc.setFont('helvetica', 'bold');
            } else {
                doc.setFont('helvetica', 'normal');
            }
            doc.text(label, margin, y);
            doc.text(val, margin + 55, y);
            y += 5.5;
        });
        y += 8;
        
        // ── Key Results ──
        checkPage(50);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Results', margin, y); y += 8;
        
        // Result boxes
        const boxes = [
            { label: 'Portfolio at Retirement', value: fmtK(summary.portfolioAtRetirement || 0), color: [59, 130, 246] },
            { label: 'Money Lasts Until', value: `Age ${summary.moneyLastsAge || '?'}`, color: summary.moneyLastsAge >= inputs.lifeExpectancy ? [16, 185, 129] : [239, 68, 68] },
            { label: 'Max Sustainable Spending', value: fmt(summary.maxSustainableSpending || inputs.annualSpending || 0) + '/yr', color: [139, 92, 246] },
            { label: 'Estate Value', value: fmtK(summary.legacyAmount || 0), color: [245, 158, 11] },
        ];
        
        const boxW = (contentW - 6) / 2;
        const boxH = 22;
        boxes.forEach((box, i) => {
            const bx = margin + (i % 2) * (boxW + 6);
            const by = y + Math.floor(i / 2) * (boxH + 4);
            doc.setFillColor(...box.color);
            doc.roundedRect(bx, by, boxW, boxH, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(box.label, bx + 4, by + 7);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(box.value, bx + 4, by + 17);
        });
        y += (boxH + 4) * 2 + 10;
        
        // ── Government Benefits ──
        checkPage(35);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Government Benefits', margin, y); y += 7;
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        
        const gov = results.govBenefits || {};
        const govRows = [
            ['CPP', fmt(gov.cppTotal || 0) + '/yr', `Starting age ${gov.cppStartAge || 65}`],
            ['OAS', fmt(gov.oasMax || 0) + '/yr', `Starting age 65`],
        ];
        if (gov.gisReceived > 0) govRows.push(['GIS', fmt(gov.gisReceived) + '/yr', 'Income-tested']);
        govRows.push(['Total', fmt(gov.total || 0) + '/yr', '']);
        
        govRows.forEach(([label, val, note], i) => {
            if (i === govRows.length - 1) doc.setFont('helvetica', 'bold');
            else doc.setFont('helvetica', 'normal');
            doc.text(label, margin, y);
            doc.text(val, margin + 35, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(note, margin + 75, y);
            doc.setFontSize(10);
            y += 5.5;
        });
        y += 8;
        
        // ── Strategy Comparison ──
        if (this._strategyData) {
            checkPage(60);
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Strategy Comparison', margin, y); y += 8;
            
            const strategies = [
                { name: 'Your Plan', key: 'smart', icon: '📋' },
                { name: 'Advisor', key: 'advisor', icon: '👔' },
                { name: 'Optimized', key: 'optimized', icon: '🎯' },
            ];
            
            // Table header
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, y - 3, contentW, 7, 'F');
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            const cols = [margin, margin + 45, margin + 85, margin + 120, margin + 150];
            doc.text('Strategy', cols[0] + 2, y + 1);
            doc.text('Max Spending', cols[1], y + 1);
            doc.text('Lasts Until', cols[2], y + 1);
            doc.text('Estate', cols[3], y + 1);
            doc.text('Lifetime Tax', cols[4], y + 1);
            y += 8;
            
            strategies.forEach(s => {
                const data = this._strategyData[s.key];
                const sum = data?.results?.summary;
                if (!sum) return;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(51, 65, 85);
                doc.text(s.name, cols[0] + 2, y);
                doc.text(fmt(sum.maxSustainableSpending || inputs.annualSpending || 0), cols[1], y);
                doc.text(`Age ${sum.moneyLastsAge || '?'}`, cols[2], y);
                doc.text(fmtK(sum.legacyAmount || 0), cols[3], y);
                doc.text(fmtK(sum.lifetimeTax || 0), cols[4], y);
                y += 6;
            });
            y += 8;
        }
        
        // ── Year-by-Year Summary (first 10 + last 5) ──
        const yearByYear = results.yearByYear;
        if (yearByYear && yearByYear.length > 0) {
            addPage();
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Year-by-Year Projection', margin, y); y += 3;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('Showing key years from your retirement projection', margin, y); y += 6;
            
            // Table header
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, y - 3, contentW, 7, 'F');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            const yCols = [margin, margin+14, margin+38, margin+62, margin+86, margin+110, margin+135, margin+155];
            ['Age', 'Income', 'Spending', 'Tax', 'CPP', 'OAS', 'Withdrawal', 'Balance'].forEach((h, i) => {
                doc.text(h, yCols[i], y + 1);
            });
            y += 7;
            
            // Select representative years
            const retIdx = yearByYear.findIndex(yr => yr.age >= inputs.retirementAge);
            const retYears = retIdx >= 0 ? yearByYear.slice(retIdx) : yearByYear;
            const showYears = [];
            // First 10 retirement years
            showYears.push(...retYears.slice(0, 10));
            // Then every 5th year
            for (let i = 10; i < retYears.length; i += 5) showYears.push(retYears[i]);
            // Always include last year
            if (retYears.length > 10 && showYears[showYears.length - 1] !== retYears[retYears.length - 1]) {
                showYears.push(retYears[retYears.length - 1]);
            }
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            showYears.forEach(yr => {
                checkPage(6);
                const vals = [
                    `${yr.age}`,
                    fmtK(yr.afterTaxIncome || yr.totalIncome || 0),
                    fmtK(yr.spending || yr.annualSpending || 0),
                    fmtK(yr.tax || yr.totalTax || 0),
                    fmtK(yr.cpp || 0),
                    fmtK(yr.oas || 0),
                    fmtK(yr.totalWithdrawal || 0),
                    fmtK(yr.totalBalance || yr.totalPortfolio || 0),
                ];
                vals.forEach((v, i) => doc.text(v, yCols[i], y));
                y += 5;
            });
        }
        
        // ── Footer on every page ──
        const pageCount = doc.internal.getNumberOfPages();
        for (let p = 1; p <= pageCount; p++) {
            doc.setPage(p);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'normal');
            doc.text('Canadian Retirement Planner — retirementplanner.ca', margin, 270);
            doc.text(`Page ${p} of ${pageCount}`, pageW - margin, 270, { align: 'right' });
        }
        
        // Save
        doc.save(`retirement-report-${new Date().toISOString().slice(0,10)}.pdf`);
    },

    // Scenario Save/Compare
    // ═══════════════════════════════════════
    _initScenarioButtons() {
        const saveBtn = document.getElementById('btn-save-scenario');
        const compareBtn = document.getElementById('btn-compare-scenarios');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this._saveScenario());
        }
        if (compareBtn) {
            compareBtn.addEventListener('click', () => this._showScenarioComparison());
        }
        this._updateScenarioUI();
    },

    _getSavedScenarios() {
        try {
            return JSON.parse(localStorage.getItem('retirement_scenarios') || '[]');
        } catch { return []; }
    },

    _saveScenario() {
        if (!this._lastCalcInputs || !this._lastCalcResults) return;
        const name = prompt('Name this scenario:', `Scenario ${this._getSavedScenarios().length + 1}`);
        if (!name) return;
        
        const scenarios = this._getSavedScenarios();
        const inputs = this._lastCalcInputs;
        const results = this._lastCalcResults;
        const summary = results.summary;
        
        scenarios.push({
            name,
            savedAt: Date.now(),
            inputs: {
                retirementAge: inputs.retirementAge,
                annualSpending: inputs.annualSpending,
                cppStartAge: inputs.cppStartAge,
                oasStartAge: inputs.oasStartAge,
                province: inputs.province,
                monthlyContribution: inputs.monthlyContribution,
                rrsp: inputs.rrsp, tfsa: inputs.tfsa, nonReg: inputs.nonReg,
                downsizingAge: inputs.downsizingAge,
                ltcMonthly: inputs.ltcMonthly || 0,
            },
            results: {
                moneyLastsAge: summary.moneyLastsAge,
                portfolioAtRetirement: summary.portfolioAtRetirement,
                totalTax: summary.avgTaxRateInRetirement,
                legacyAmount: summary.legacyAmount,
                estateTax: results.legacy?.estateTax || 0,
                netEstate: results.legacy?.netEstate || 0,
            }
        });
        
        localStorage.setItem('retirement_scenarios', JSON.stringify(scenarios.slice(-10))); // Keep last 10
        this._updateScenarioUI();
    },

    _updateScenarioUI() {
        const scenarios = this._getSavedScenarios();
        const compareBtn = document.getElementById('btn-compare-scenarios');
        if (compareBtn) {
            compareBtn.style.display = scenarios.length >= 1 ? '' : 'none';
            compareBtn.textContent = `📊 Compare (${scenarios.length} saved)`;
        }
    },

    _showScenarioComparison() {
        const panel = document.getElementById('scenario-compare-panel');
        if (!panel) return;
        
        const scenarios = this._getSavedScenarios();
        if (scenarios.length === 0) { panel.classList.add('hidden'); return; }
        
        const fmt = (v) => '$' + Math.round(Math.abs(v || 0)).toLocaleString();
        
        // Add current plan as first column
        const current = this._lastCalcResults ? {
            name: '📍 Current',
            results: {
                moneyLastsAge: this._lastCalcResults.summary.moneyLastsAge,
                portfolioAtRetirement: this._lastCalcResults.summary.portfolioAtRetirement,
                legacyAmount: this._lastCalcResults.summary.legacyAmount,
                estateTax: this._lastCalcResults.legacy?.estateTax || 0,
                netEstate: this._lastCalcResults.legacy?.netEstate || 0,
            },
            inputs: this._lastCalcInputs || {}
        } : null;
        
        const allScenarios = current ? [current, ...scenarios] : scenarios;
        
        const cols = allScenarios.map((s, i) => {
            const isCurrent = i === 0 && current;
            return `
                <div class="scenario-compare-col ${isCurrent ? 'current' : ''}">
                    <div class="scenario-compare-name">${s.name}${!isCurrent ? `<button class="btn-delete-scenario" data-idx="${i-1}" title="Delete">✕</button>` : ''}</div>
                    <div class="scenario-compare-stat">
                        <span>Retire at</span><strong>${s.inputs.retirementAge || '?'}</strong>
                    </div>
                    <div class="scenario-compare-stat">
                        <span>Spending</span><strong>${fmt(s.inputs.annualSpending)}/yr</strong>
                    </div>
                    <div class="scenario-compare-stat">
                        <span>Lasts to</span><strong>Age ${s.results.moneyLastsAge}</strong>
                    </div>
                    <div class="scenario-compare-stat">
                        <span>Portfolio</span><strong>${fmtCompact(s.results.portfolioAtRetirement)}</strong>
                    </div>
                    <div class="scenario-compare-stat">
                        <span>Estate</span><strong>${fmtCompact(s.results.legacyAmount)}</strong>
                    </div>
                    ${s.results.estateTax > 0 ? `<div class="scenario-compare-stat sub"><span>Net to heirs</span><strong>${fmtCompact(s.results.netEstate)}</strong></div>` : ''}
                </div>
            `;
        }).join('');
        
        panel.innerHTML = `
            <div class="scenario-compare-grid">${cols}</div>
            <button type="button" class="btn-link" id="btn-clear-scenarios" style="margin-top: 8px; color: #dc2626;">🗑️ Clear all saved</button>
        `;
        panel.classList.remove('hidden');
        
        // Delete handlers
        panel.querySelectorAll('.btn-delete-scenario').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const sc = this._getSavedScenarios();
                sc.splice(idx, 1);
                localStorage.setItem('retirement_scenarios', JSON.stringify(sc));
                this._showScenarioComparison();
                this._updateScenarioUI();
            });
        });
        
        document.getElementById('btn-clear-scenarios')?.addEventListener('click', () => {
            localStorage.removeItem('retirement_scenarios');
            panel.classList.add('hidden');
            this._updateScenarioUI();
        });
    },

    // ═══════════════════════════════════════
    // Form State Persistence (localStorage)
    // ═══════════════════════════════════════
    _formFields: [
        'current-age', 'partner-age', 'current-income', 'income-1', 'income-2',
        'rrsp-balance', 'tfsa-balance', 'non-reg-balance', 'other-balance', 'cash-balance', 'lira-balance',
        'monthly-contribution', 'split-rrsp', 'split-tfsa', 'split-nonreg',
        'retirement-age', 'life-expectancy', 'annual-spending',
        'current-debt', 'debt-payoff-age',
        'return-rate', 'inflation-rate', 'mer-fee', 'contribution-growth',
        'rrsp-p1', 'tfsa-p1', 'nonreg-p1', 'lira-p1', 'other-p1', 'cash-p1',
        'rrsp-p2', 'tfsa-p2', 'nonreg-p2', 'lira-p2', 'other-p2', 'cash-p2',
        'employer-pension', 'pension-start-age',
        'annuity-lump-sum', 'annuity-purchase-age', 'annuity-monthly-payout',
        'downsizing-age', 'downsizing-proceeds', 'downsizing-spending-change',
        'ltc-monthly', 'ltc-start-age', 'healthcare-inflation',
        'inf-housing', 'inf-food', 'inf-discretionary'
    ],

    _setupFormAutosave() {
        // Auto-save on input change (debounced)
        let saveTimeout;
        const save = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => this._saveFormState(), 500);
        };
        this._formFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', save);
        });
        // Checkboxes
        document.getElementById('dtc-checkbox')?.addEventListener('change', save);
        document.getElementById('pension-indexed')?.addEventListener('change', save);
    },

    _saveFormState() {
        const state = {};
        this._formFields.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value) state[id] = el.value;
        });
        // Checkboxes
        const dtc = document.getElementById('dtc-checkbox');
        if (dtc) state['dtc-checkbox'] = dtc.checked;
        const pi = document.getElementById('pension-indexed');
        if (pi) state['pension-indexed'] = pi.checked;
        // Select fields
        const fs = document.getElementById('family-status');
        if (fs) state['family-status'] = fs.value;
        
        localStorage.setItem('retirement_form_state', JSON.stringify(state));
    },

    _restoreFormState() {
        try {
            const state = JSON.parse(localStorage.getItem('retirement_form_state') || '{}');
            if (Object.keys(state).length === 0) return;
            
            this._formFields.forEach(id => {
                const el = document.getElementById(id);
                if (el && state[id] !== undefined) el.value = state[id];
            });
            // Checkboxes
            const dtc = document.getElementById('dtc-checkbox');
            if (dtc && state['dtc-checkbox'] !== undefined) dtc.checked = state['dtc-checkbox'];
            const pi = document.getElementById('pension-indexed');
            if (pi && state['pension-indexed'] !== undefined) pi.checked = state['pension-indexed'];
            // Family status select
            const fs = document.getElementById('family-status');
            if (fs && state['family-status']) {
                fs.value = state['family-status'];
                fs.dispatchEvent(new Event('change'));
            }
        } catch(e) {}
    },

    _getCategoryInflation() {
        // Always compute category inflation with spending-weighted rates
        const weights = this._getSpendingWeights();
        return {
            housing: parseFloat(document.getElementById('inf-housing')?.value) || 2.5,
            food: parseFloat(document.getElementById('inf-food')?.value) || 3.0,
            healthcare: parseFloat(document.getElementById('healthcare-inflation')?.value) || 4,
            discretionary: parseFloat(document.getElementById('inf-discretionary')?.value) || 2.0,
            _weights: weights
        };
    },

    _getSpendingWeights() {
        // Get actual spending breakdown from lifestyle preset or custom inputs
        const spending = parseFloat(document.getElementById('annual-spending')?.value) || 48000;
        const activePreset = document.querySelector('.preset-btn.active');
        const presetKey = activePreset?.dataset.lifestyle;
        
        let breakdown;
        if (presetKey && typeof LifestyleData !== 'undefined' && LifestyleData[presetKey]) {
            const data = LifestyleData[presetKey];
            // Scale by actual spending vs preset base
            const scale = spending / data.annual;
            breakdown = {};
            for (const [cat, vals] of Object.entries(data.breakdown)) {
                breakdown[cat] = vals.annual * scale;
            }
        } else {
            // Default proportions for Canadian retirees
            breakdown = {
                housing: spending * 0.30,
                food: spending * 0.15,
                transportation: spending * 0.10,
                healthcare: spending * 0.06,
                travel: spending * 0.10,
                entertainment: spending * 0.12,
                misc: spending * 0.17
            };
        }
        
        // Map 7 categories → 4 inflation buckets
        // Housing = housing
        // Food = food
        // Healthcare = healthcare
        // Discretionary = transportation + travel + entertainment + misc
        const housingAmt = breakdown.housing || 0;
        const foodAmt = breakdown.food || 0;
        const healthcareAmt = breakdown.healthcare || 0;
        const discretionaryAmt = (breakdown.transportation || 0) + (breakdown.travel || 0) 
            + (breakdown.entertainment || 0) + (breakdown.misc || 0);
        const total = housingAmt + foodAmt + healthcareAmt + discretionaryAmt;
        
        if (total <= 0) return { housing: 0.30, food: 0.15, healthcare: 0.15, discretionary: 0.40 };
        
        return {
            housing: housingAmt / total,
            food: foodAmt / total,
            healthcare: healthcareAmt / total,
            discretionary: discretionaryAmt / total
        };
    },

    _displayResults(results, inputs) {
        // Status banner — use spending optimizer result for consistency
        // If money runs out before life expectancy, it needs work
        const banner = document.getElementById('status-banner');
        if (banner) {
            const lastsAge = results.summary.moneyLastsAge || inputs.lifeExpectancy;
            const isOnTrack = lastsAge >= inputs.lifeExpectancy;
            if (isOnTrack) {
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

        // Use scenario-specific MC rate if available, otherwise deterministic
        let probability = results.probability || 0;
        const scenarioData = this.scenarioResults[this.currentScenario];
        if (scenarioData?.mcRate !== undefined && scenarioData?.mcRate !== null) {
            probability = scenarioData.mcRate;
        } else if (this.currentScenario === 'base' && this.monteCarloResults?.successRate !== undefined) {
            probability = this.monteCarloResults.successRate;
        }


        document.getElementById('stat-portfolio').textContent = fmtCompact(portfolio);
        document.getElementById('stat-income').textContent = fmtCompact(income);
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

        // Legacy — show gross estate (portfolio + property/assets) minus estate tax
        const estateTotal = results.legacy.netEstate || results.legacy.amount || 0;
        const estateAssetVal = results.legacy.estateAssets || 0;
        document.getElementById('legacy-amount').textContent = fmtMoney(estateTotal);
        let estateDesc = results.legacy.description;
        if (estateAssetVal > 0) {
            estateDesc += ` (includes ${fmtMoney(estateAssetVal)} in property/assets)`;
        }
        if (results.legacy.estateTax > 0) {
            estateDesc += ` — after ${fmtMoney(results.legacy.estateTax)} estate tax`;
        }
        document.getElementById('legacy-description').textContent = estateDesc;

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
        this._renderChartBase(yearByYear, retirementAge);
        this._setupChartTooltip(yearByYear, retirementAge);
    },

    _renderChartBase(yearByYear, retirementAge) {
        const canvas = document.getElementById('projection-chart');
        if (!canvas) throw new Error('Canvas element not found');

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get 2D context');

        // Set dimensions (only on first draw, preserve on redraws)
        if (!canvas._sized) {
            const parent = canvas.parentElement;
            const width = Math.max((parent ? parent.offsetWidth : 300) - 40, 300);
            canvas.width = width;
            canvas.height = 400;
            canvas._sized = true;
        }

        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;

        // Clear and set background
        const isDark = document.documentElement.dataset.theme === 'dark';
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = isDark ? '#1e1e2e' : '#ffffff';
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
        ctx.strokeStyle = isDark ? '#374151' : '#e5e7eb';
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
        ctx.fillText(maxBalance >= 1000000 ? `$${(maxBalance / 1000000).toFixed(1)}M` : `$${(maxBalance / 1000).toFixed(0)}K`, 5, padding + 5);

        ctx.fillStyle = '#f59e0b';
        ctx.fillText('Retirement', retireX - 35, padding - 10);
    },

    _setupChartTooltip(yearByYear, retirementAge) {
        const canvas = document.getElementById('projection-chart');
        if (!canvas) return;
        const isDark = document.documentElement.dataset.theme === 'dark';

        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;
        const balances = yearByYear.map(y => y.totalBalance || 0);
        const maxBalance = Math.max(...balances);
        const minAge = yearByYear[0].age;
        const maxAge = yearByYear[yearByYear.length - 1].age;

        // Remove old listeners (avoid stacking)
        if (canvas._tooltipHandler) {
            canvas.removeEventListener('mousemove', canvas._tooltipHandler);
            canvas.removeEventListener('touchmove', canvas._tooltipHandler);
            canvas.removeEventListener('touchstart', canvas._tooltipHandler);
            canvas.removeEventListener('mouseleave', canvas._tooltipLeave);
        }

        // Get or create tooltip element
        let tooltip = document.getElementById('chart-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'chart-tooltip';
            tooltip.className = 'chart-tooltip';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(tooltip);
        }

        const getAgeFromX = (clientX) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const canvasX = (clientX - rect.left) * scaleX;
            const chartX = canvasX - padding;
            const chartWidth = w - 2 * padding;
            const ratio = Math.max(0, Math.min(1, chartX / chartWidth));
            return Math.round(minAge + ratio * (maxAge - minAge));
        };

        const showTooltip = (clientX, clientY) => {
            const age = getAgeFromX(clientX);
            const point = yearByYear.find(y => y.age === age);
            if (!point) { tooltip.style.display = 'none'; return; }

            const bal = point.totalBalance || 0;
            const phase = point.phase === 'retirement' ? '🏖️' : '📈';
            let html = `<strong>${phase} Age ${age}</strong><br>`;
            html += `Portfolio: <strong>$${Math.round(bal).toLocaleString()}</strong>`;
            
            if (point.phase === 'retirement') {
                if (point.cppReceived) html += `<br>CPP: $${Math.round(point.cppReceived).toLocaleString()}`;
                if (point.oasReceived) html += `<br>OAS: $${Math.round(point.oasReceived).toLocaleString()}`;
                if (point.gisReceived) html += `<br>GIS: $${Math.round(point.gisReceived).toLocaleString()}`;
                if (point.withdrawal) html += `<br>Withdrawal: $${Math.round(point.withdrawal).toLocaleString()}`;
                if (point.taxPaid) html += `<br>Tax: $${Math.round(point.taxPaid).toLocaleString()}`;
                if (point.targetSpending) html += `<br>Spending: $${Math.round(point.targetSpending).toLocaleString()}`;
            } else {
                if (point.contribution) html += `<br>Contribution: $${Math.round(point.contribution).toLocaleString()}`;
            }

            tooltip.innerHTML = html;
            tooltip.style.display = 'block';

            // Position tooltip
            const rect = canvas.getBoundingClientRect();
            const parentRect = canvas.parentElement.getBoundingClientRect();
            let left = clientX - parentRect.left;
            let top = clientY - parentRect.top - tooltip.offsetHeight - 12;
            
            // Keep tooltip in bounds
            const tooltipWidth = tooltip.offsetWidth || 180;
            if (left + tooltipWidth > parentRect.width) left = parentRect.width - tooltipWidth - 8;
            if (left < 8) left = 8;
            if (top < 0) top = clientY - parentRect.top + 20;
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';

            // Draw crosshair on canvas (redraw base without re-attaching tooltip)
            this._renderChartBase(yearByYear, retirementAge);
            const x = padding + ((age - minAge) / (maxAge - minAge)) * (w - 2 * padding);
            const balance = point.totalBalance || 0;
            const y2 = h - padding - (balance / maxBalance) * (h - 2 * padding);
            
            const ctx2 = canvas.getContext('2d');
            // Vertical line
            ctx2.strokeStyle = 'rgba(37, 99, 235, 0.3)';
            ctx2.lineWidth = 1;
            ctx2.setLineDash([3, 3]);
            ctx2.beginPath();
            ctx2.moveTo(x, padding);
            ctx2.lineTo(x, h - padding);
            ctx2.stroke();
            ctx2.setLineDash([]);
            
            // Dot on curve
            ctx2.fillStyle = '#2563eb';
            ctx2.beginPath();
            ctx2.arc(x, y2, 6, 0, Math.PI * 2);
            ctx2.fill();
            ctx2.strokeStyle = isDark ? '#1e1e2e' : '#fff';
            ctx2.lineWidth = 2;
            ctx2.stroke();
        };

        canvas._tooltipHandler = (e) => {
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            showTooltip(touch.clientX, touch.clientY);
        };
        canvas._tooltipLeave = () => {
            tooltip.style.display = 'none';
            // Redraw without crosshair
            this._renderChartBase(yearByYear, retirementAge);
        };

        canvas.addEventListener('mousemove', canvas._tooltipHandler);
        canvas.addEventListener('touchmove', canvas._tooltipHandler, { passive: false });
        canvas.addEventListener('touchstart', canvas._tooltipHandler, { passive: false });
        canvas.addEventListener('mouseleave', canvas._tooltipLeave);
        
        // Close tooltip when tapping anywhere outside the chart
        if (!canvas._tooltipOutsideHandler) {
            canvas._tooltipOutsideHandler = (e) => {
                if (!canvas.contains(e.target) && !tooltip.contains(e.target)) {
                    tooltip.style.display = 'none';
                    this._renderChartBase(yearByYear, retirementAge);
                }
            };
            document.addEventListener('touchstart', canvas._tooltipOutsideHandler, { passive: true });
            document.addEventListener('click', canvas._tooltipOutsideHandler);
        }
    },

    _drawYearBreakdown(yearByYear, retirementAge) {
        const container = document.getElementById('year-breakdown-chart');
        if (!container) return;

        const allRetirementYears = yearByYear.filter(y => y.age >= retirementAge).slice(0, 30);
        const retirementYears = allRetirementYears;

        if (retirementYears.length === 0) {
            container.innerHTML = '<p>No retirement data</p>';
            return;
        }

        // Income sources for each year
        const html = retirementYears.map(year => {
            const wb = year.withdrawalBreakdown || {};
            const cpp = year.cppReceived || 0;
            const oas = year.oasReceived || 0;
            const gis = year.gisReceived || 0;
            const additional = year.additionalIncome || 0;
            const fromTFSA = wb.tfsa || 0;
            const fromNonReg = wb.nonReg || 0;
            const fromRRSP = wb.rrsp || 0;
            const fromOther = wb.other || 0;
            const fromCash = wb.cash || 0;
            const fromLIRA = wb.lira || 0;
            const pension = year.pensionIncome || 0;
            
            const grossIncome = cpp + oas + gis + additional + pension + fromTFSA + fromNonReg + fromRRSP + fromOther + fromCash + fromLIRA;
            if (grossIncome <= 0) return '';
            
            // Show after-tax income as the headline number (what you actually get to spend)
            const tax = year.taxPaid || 0;
            const totalIncome = grossIncome - tax;
            if (totalIncome <= 0) return '';

            // For the bar, show after-tax proportions
            // Tax-free sources: TFSA, GIS (not taxed), OAS/CPP/RRSP/NonReg are taxed proportionally
            const taxableGross = cpp + oas + fromRRSP + fromNonReg + fromOther + fromLIRA + additional + pension;
            const taxRate = taxableGross > 0 ? tax / taxableGross : 0;
            const afterTaxCPP = cpp * (1 - taxRate);
            const afterTaxOAS = oas * (1 - taxRate);
            const afterTaxRRSP = fromRRSP * (1 - taxRate);
            const afterTaxNonReg = fromNonReg * (1 - taxRate);
            const afterTaxOther = fromOther * (1 - taxRate);
            const afterTaxLIRA = fromLIRA * (1 - taxRate);
            const afterTaxAdditional = additional * (1 - taxRate);
            // GIS, TFSA, Cash are tax-free
            const afterTaxGIS = gis;
            const afterTaxTFSA = fromTFSA;
            const afterTaxCash = fromCash;

            const pct = (val) => ((val / totalIncome) * 100).toFixed(1);
            const fmt = (val) => '$' + Math.round(val).toLocaleString();

            // Build segments (only show non-zero, using after-tax amounts)
            const segments = [];
            if (afterTaxCPP > 0) segments.push({ cls: 'cpp', pct: pct(afterTaxCPP), label: 'CPP', amount: fmt(afterTaxCPP) });
            if (afterTaxOAS > 0) segments.push({ cls: 'oas', pct: pct(afterTaxOAS), label: 'OAS', amount: fmt(afterTaxOAS) });
            if (afterTaxGIS > 0) segments.push({ cls: 'gis', pct: pct(afterTaxGIS), label: 'GIS', amount: fmt(afterTaxGIS) });
            const afterTaxPension = pension * (1 - taxRate);
            if (afterTaxPension > 0) segments.push({ cls: 'pension', pct: pct(afterTaxPension), label: 'Pension', amount: fmt(afterTaxPension) });
            if (afterTaxAdditional > 0) segments.push({ cls: 'additional', pct: pct(afterTaxAdditional), label: 'Other Income', amount: fmt(afterTaxAdditional) });
            if (afterTaxRRSP > 0) segments.push({ cls: 'rrsp', pct: pct(afterTaxRRSP), label: 'RRSP', amount: fmt(afterTaxRRSP) });
            if (afterTaxTFSA > 0) segments.push({ cls: 'tfsa', pct: pct(afterTaxTFSA), label: 'TFSA', amount: fmt(afterTaxTFSA) });
            if (afterTaxNonReg > 0) segments.push({ cls: 'nonreg', pct: pct(afterTaxNonReg), label: 'Non-Reg', amount: fmt(afterTaxNonReg) });
            if (afterTaxOther > 0) segments.push({ cls: 'other', pct: pct(afterTaxOther), label: 'Other', amount: fmt(afterTaxOther) });
            if (afterTaxLIRA > 0) segments.push({ cls: 'lira', pct: pct(afterTaxLIRA), label: 'LIRA/LIF', amount: fmt(afterTaxLIRA) });
            if (afterTaxCash > 0) segments.push({ cls: 'cash', pct: pct(afterTaxCash), label: 'Cash', amount: fmt(afterTaxCash) });
            const annuity = year.annuityIncome || 0;
            const spouseAllow = year.spouseAllowance || 0;
            if (annuity > 0) segments.push({ cls: 'annuity', pct: pct(annuity * 0.85), label: 'Annuity', amount: fmt(annuity * 0.85) });
            if (spouseAllow > 0) segments.push({ cls: 'gis', pct: pct(spouseAllow), label: 'Allowance', amount: fmt(spouseAllow) });

            const barSegments = segments.map(s => 
                `<div class="bar-segment ${s.cls}" style="width: ${s.pct}%" title="${s.label}: ${s.amount} (${s.pct}%)"></div>`
            ).join('');

            const detailItems = segments.map(s =>
                `<span class="income-detail-item ${s.cls}-color">${s.label} ${s.amount}</span>`
            ).join('');

            const taxLine = year.taxPaid > 0 
                ? `<div class="year-tax-note">Tax: ${fmt(year.taxPaid)}</div>` 
                : '';
            
            const clawbackLine = (year.oasClawback || 0) > 0
                ? `<div class="year-tax-note clawback">OAS clawback: -${fmt(year.oasClawback)}</div>`
                : '';

            const balance = year.totalBalance || 0;
            const balanceLine = balance > 0 
                ? `<div class="year-balance-note">💰 Portfolio: ${fmtCompact(balance)}</div>`
                : balance <= 0 && year.age > retirementAge 
                    ? `<div class="year-balance-note depleted">💰 Portfolio: depleted</div>`
                    : '';

            // Account balance breakdown (expandable)
            const acctBalances = [];
            if (year.rrsp > 0) acctBalances.push(`<div class="acct-bal"><span class="acct-label rrsp-color">RRSP</span><span>${fmt(year.rrsp)}</span></div>`);
            if (year.tfsa > 0) acctBalances.push(`<div class="acct-bal"><span class="acct-label tfsa-color">TFSA</span><span>${fmt(year.tfsa)}</span></div>`);
            if (year.nonReg > 0) acctBalances.push(`<div class="acct-bal"><span class="acct-label nonreg-color">Non-Reg</span><span>${fmt(year.nonReg)}</span></div>`);
            if (year.lira > 0) acctBalances.push(`<div class="acct-bal"><span class="acct-label lira-color">LIRA</span><span>${fmt(year.lira)}</span></div>`);
            if (year.cash > 0) acctBalances.push(`<div class="acct-bal"><span class="acct-label">Cash</span><span>${fmt(year.cash)}</span></div>`);
            if (year.other > 0) acctBalances.push(`<div class="acct-bal"><span class="acct-label">Other</span><span>${fmt(year.other)}</span></div>`);

            const acctSection = acctBalances.length > 0 ? `
                <div class="year-accounts-breakdown">
                    ${acctBalances.join('')}
                </div>
            ` : '';

            return `
                <div class="year-bar-row income-breakdown-row expandable-row">
                    <div class="year-bar-header">
                        <span class="year-label">Age ${year.age}</span>
                        <span class="year-total-income">${fmt(totalIncome)} <span class="expand-arrow">▸</span></span>
                    </div>
                    ${balanceLine}
                    <div class="year-bar">${barSegments}</div>
                    <div class="year-income-details">${detailItems}</div>
                    ${taxLine}
                    ${clawbackLine}
                    ${acctSection}
                </div>
            `;
        }).join('');

        const legend = `
            <div class="chart-legend income-legend">
                <div class="legend-item"><span class="legend-color cpp"></span> CPP</div>
                <div class="legend-item"><span class="legend-color oas"></span> OAS</div>
                <div class="legend-item"><span class="legend-color gis"></span> GIS</div>
                <div class="legend-item"><span class="legend-color rrsp"></span> RRSP</div>
                <div class="legend-item"><span class="legend-color tfsa"></span> TFSA</div>
                <div class="legend-item"><span class="legend-color nonreg"></span> Non-Reg</div>
                <div class="legend-item"><span class="legend-color other"></span> Other</div>
            </div>
        `;

        // Show first 5 years, rest hidden behind "Show all" button
        const rows = html.split('</div>\n            ');
        // Actually, use DOM approach after inserting
        container.innerHTML = legend + html;

        // Expandable year rows — tap to show account balances
        container.querySelectorAll('.expandable-row').forEach(row => {
            const header = row.querySelector('.year-bar-header');
            const accounts = row.querySelector('.year-accounts-breakdown');
            const arrow = row.querySelector('.expand-arrow');
            if (header && accounts) {
                accounts.style.display = 'none';
                header.style.cursor = 'pointer';
                header.addEventListener('click', () => {
                    const isOpen = accounts.style.display !== 'none';
                    accounts.style.display = isOpen ? 'none' : '';
                    if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
                    row.classList.toggle('expanded', !isOpen);
                });
            }
        });
        
        const allRows = container.querySelectorAll('.income-breakdown-row');
        const INITIAL_SHOW = 5;
        if (allRows.length > INITIAL_SHOW) {
            allRows.forEach((row, i) => {
                if (i >= INITIAL_SHOW) row.style.display = 'none';
            });
            const showBtn = document.createElement('button');
            showBtn.className = 'btn-link';
            showBtn.textContent = `Show all ${allRows.length} years ↓`;
            showBtn.style.marginTop = '12px';
            showBtn.addEventListener('click', () => {
                const isExpanded = showBtn.dataset.expanded === 'true';
                allRows.forEach((row, i) => {
                    if (i >= INITIAL_SHOW) row.style.display = isExpanded ? 'none' : '';
                });
                showBtn.dataset.expanded = isExpanded ? 'false' : 'true';
                showBtn.textContent = isExpanded ? `Show all ${allRows.length} years ↓` : 'Show less ↑';
            });
            container.appendChild(showBtn);
        }
    },

    _displayBreakdown(results, inputs) {
        const retirementYears = results.yearByYear.filter(y => y.phase === 'retirement');

        if (retirementYears.length === 0) {
            const bc = document.getElementById('breakdown-content');
            if (bc) bc.innerHTML = '<p>No retirement years</p>';
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

        const bc = document.getElementById('breakdown-content');
        if (bc) bc.innerHTML = html;
    },

    _saveScenario() {
        alert('✅ Scenario saved!');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppV4.init();
});

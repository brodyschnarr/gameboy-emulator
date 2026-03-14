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
    cppOverride: null,       // Single mode: annual CPP at 65 (null = use estimate)
    cppOverrideP1: null,     // Couple mode: person 1
    cppOverrideP2: null,     // Couple mode: person 2
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
        this._setupOASOptimizer();
        this._setupSplitValidation();
        this._setupHealthcare();
        this._setupDebt();
        this._setupCustomSpending();
        this._setupIncomeSources();
        this._setupPostRetirementWork();
        this._setupHouseSale();
        this._setupWindfalls();
        this._setupCalculate();
        this._setupScenarios();
        this._setupModals();
        this._setupAdvancedToggle();
        this._setupSpendingCurve();
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

        // Toggle OAS sections
        const oasSingle = document.getElementById('oas-section-single');
        const oasCouple = document.getElementById('oas-section-couple');
        if (oasSingle) oasSingle.classList.toggle('hidden', isCouple);
        if (oasCouple) oasCouple.classList.toggle('hidden', !isCouple);

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
        
        const diff = maxSustainable - currentSpending;
        const pctOfMax = Math.min(100, (currentSpending / maxSustainable) * 100);
        
        let icon, amountClass, message, barClass;
        
        if (moneyLastsAge < lifeExpectancy) {
            // Money runs out — need to cut
            icon = '⚠️';
            amountClass = 'need-to-cut';
            message = `Your plan runs out at age ${moneyLastsAge}. Reduce spending to <strong>${fmt(maxSustainable)}/year</strong> to last until ${lifeExpectancy}.`;
            barClass = 'danger';
        } else if (diff > 10000) {
            // Lots of room
            icon = '🎉';
            amountClass = 'can-spend-more';
            message = `You're well-funded! You could spend up to <strong>${fmt(maxSustainable)}/year</strong> and still last to age ${lifeExpectancy}.`;
            barClass = 'safe';
        } else if (diff > 0) {
            // Small room
            icon = '✅';
            amountClass = 'on-target';
            message = `You're close to your max. Sustainable spending: <strong>${fmt(maxSustainable)}/year</strong>.`;
            barClass = 'warning';
        } else {
            // Exactly at limit
            icon = '✅';
            amountClass = 'on-target';
            message = `Your spending is right at the sustainable limit.`;
            barClass = 'warning';
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
        
        const fmt = (v) => '$' + Math.round(v).toLocaleString();
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
        
        const addBtn = document.getElementById('btn-add-post-retirement-work');
        const form = document.getElementById('post-retirement-work-form');
        const saveBtn = document.getElementById('btn-save-prt-work');
        const cancelBtn = document.getElementById('btn-cancel-prt-work');
        const whoSelect = document.getElementById('prt-who');
        
        // Hide partner option for singles
        if (whoSelect && this.familyStatus !== 'couple') {
            const partnerOpt = whoSelect.querySelector('option[value="partner"]');
            if (partnerOpt) partnerOpt.style.display = 'none';
        }
        
        if (addBtn && form) {
            addBtn.addEventListener('click', () => {
                form.classList.remove('hidden');
                addBtn.classList.add('hidden');
                // Default ages based on retirement age
                const retAge = parseInt(document.getElementById('retirement-age')?.value) || 65;
                document.getElementById('prt-start').value = retAge;
                document.getElementById('prt-end').value = retAge + 5;
            });
        }
        
        if (cancelBtn && form && addBtn) {
            cancelBtn.addEventListener('click', () => {
                form.classList.add('hidden');
                addBtn.classList.remove('hidden');
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
                document.getElementById('btn-add-post-retirement-work').classList.remove('hidden');
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
            narrative += `<div style="margin: 12px 0; padding: 10px 12px; background: #f0f9ff; border-radius: 8px; border-left: 3px solid #3b82f6;">`;
            narrative += `<strong>🎢 Your spending curve:</strong><br>`;
            narrative += `<strong>Go-Go years</strong> (${retireAge}–${retireAge + 9}): ${fmt(goGoSpending)}/yr — travel, hobbies, bucket list items<br>`;
            narrative += `<strong>Slow-Go years</strong> (${retireAge + 10}–${retireAge + 19}): ${fmt(annualSpending)}/yr — settling into routine<br>`;
            narrative += `<strong>No-Go years</strong> (${retireAge + 20}+): ${fmt(noGoSpending)}/yr — simpler lifestyle, less mobility`;
            narrative += `</div>`;
        }

        // Extra room / what it means
        if (isOnTrack && extraRoom > 1000) {
            narrative += `<div style="margin: 12px 0; padding: 10px 12px; background: #ecfdf5; border-radius: 8px; border-left: 3px solid #10b981;">`;
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
        
        // Auto-update previews when entering certain steps
        if (step === 'contributions') {
            this._updateContributionGrounding();
        }
        if (step === 'retirement') {
            this._updateSpendingRecommendation();
            this._updateCPPPreview();
            if (this.familyStatus === 'couple') this._updateCPPPreviewCouple();
            this._updateRetirementGrounding();
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

    _updateContributionGrounding() {
        const el = document.getElementById('contribution-grounding');
        if (!el) return;
        const age = parseInt(document.getElementById('current-age')?.value) || 35;
        const totalSavings = (parseFloat(document.getElementById('rrsp')?.value) || 0)
            + (parseFloat(document.getElementById('tfsa')?.value) || 0)
            + (parseFloat(document.getElementById('nonreg')?.value) || 0)
            + (parseFloat(document.getElementById('other')?.value) || 0);
        const yearsToRetire = Math.max(1, 65 - age);
        const recommended = Math.round((500000 - totalSavings) / yearsToRetire / 12);
        el.innerHTML = `
            <strong>💡 Quick math:</strong> To reach $500K by 65 (${yearsToRetire} years), you'd need ~<strong>$${Math.max(0, recommended).toLocaleString()}/month</strong> at 6% return
            <br><small style="opacity: 0.8;">Canadian median savings rate: 15% of income | Average monthly: $500-800</small>
        `;
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
        const fv = (years) => {
            if (years <= 0) return totalSavings;
            const r = 0.06 / 12;
            const n = years * 12;
            return totalSavings * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
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
            <br><small style="opacity: 0.8;">Based on current savings + contributions at 6% return</small>
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

            // NOW display results (charts will draw to visible parent)
            this.currentScenario = 'base';
            this._displayResults(baseResults, inputs);

            // House sale comparison (if enabled)
            this._runHouseSaleComparison(inputs, baseResults);

            // Spending optimizer
            this._runSpendingOptimizer(inputs, baseResults);
            
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
                    iterations: 200, volatility: 0.11, marketCrashProbability: 0.04
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
            cppOverride: this.familyStatus === 'couple' ? (this.cppOverrideP1 || null) : (this.cppOverride || null),
            cppOverrideP2: this.familyStatus === 'couple' ? (this.cppOverrideP2 || null) : null,
            oasStartAge: this.familyStatus === 'couple' ? (this.oasStartAgeP1 || 65) : (this.oasStartAge || 65),
            oasStartAgeP2: this.oasStartAgeP2 || 65,
            additionalIncomeSources: IncomeSources.getAll(),
            windfalls: this.windfalls || [],

            returnRate: parseFloat(document.getElementById('return-rate')?.value) || 6,
            inflationRate: parseFloat(document.getElementById('inflation-rate')?.value) || 2.5,
            contributionGrowthRate: parseFloat(document.getElementById('contribution-growth')?.value) || 0,
            merFee: parseFloat(document.getElementById('mer-fee')?.value) || 0,
            spendingCurve: this.spendingCurve || 'flat'
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

    _setupChartTooltip(yearByYear, retirementAge) {
        const canvas = document.getElementById('projection-chart');
        if (!canvas) return;

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
            ctx2.strokeStyle = '#fff';
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
            
            const totalIncome = cpp + oas + gis + additional + fromTFSA + fromNonReg + fromRRSP + fromOther + fromCash;
            if (totalIncome <= 0) return '';

            const pct = (val) => ((val / totalIncome) * 100).toFixed(1);
            const fmt = (val) => '$' + Math.round(val).toLocaleString();

            // Build segments (only show non-zero)
            const segments = [];
            if (cpp > 0) segments.push({ cls: 'cpp', pct: pct(cpp), label: 'CPP', amount: fmt(cpp) });
            if (oas > 0) segments.push({ cls: 'oas', pct: pct(oas), label: 'OAS', amount: fmt(oas) });
            if (gis > 0) segments.push({ cls: 'gis', pct: pct(gis), label: 'GIS', amount: fmt(gis) });
            if (additional > 0) segments.push({ cls: 'additional', pct: pct(additional), label: 'Other Income', amount: fmt(additional) });
            if (fromRRSP > 0) segments.push({ cls: 'rrsp', pct: pct(fromRRSP), label: 'RRSP', amount: fmt(fromRRSP) });
            if (fromTFSA > 0) segments.push({ cls: 'tfsa', pct: pct(fromTFSA), label: 'TFSA', amount: fmt(fromTFSA) });
            if (fromNonReg > 0) segments.push({ cls: 'nonreg', pct: pct(fromNonReg), label: 'Non-Reg', amount: fmt(fromNonReg) });
            if (fromOther > 0) segments.push({ cls: 'other', pct: pct(fromOther), label: 'Other', amount: fmt(fromOther) });
            if (fromCash > 0) segments.push({ cls: 'cash', pct: pct(fromCash), label: 'Cash', amount: fmt(fromCash) });

            const barSegments = segments.map(s => 
                `<div class="bar-segment ${s.cls}" style="width: ${s.pct}%" title="${s.label}: ${s.amount} (${s.pct}%)"></div>`
            ).join('');

            const detailItems = segments.map(s =>
                `<span class="income-detail-item ${s.cls}-color">${s.label} ${s.amount}</span>`
            ).join('');

            const taxLine = year.taxPaid > 0 
                ? `<div class="year-tax-note">Tax: ${fmt(year.taxPaid)}</div>` 
                : '';

            return `
                <div class="year-bar-row income-breakdown-row">
                    <div class="year-bar-header">
                        <span class="year-label">Age ${year.age}</span>
                        <span class="year-total-income">${fmt(totalIncome)}</span>
                    </div>
                    <div class="year-bar">${barSegments}</div>
                    <div class="year-income-details">${detailItems}</div>
                    ${taxLine}
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

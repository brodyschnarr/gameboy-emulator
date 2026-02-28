// ═══════════════════════════════════════════
//  Retirement Planner - App Controller
// ═══════════════════════════════════════════

const App = {
    mode: 'simple',
    selectedLifestyle: null,
    customActivities: [],

    init() {
        console.log('[App] Initializing...');
        this._setupModeSelector();
        this._setupForm();
        this._setupLifestyleSelector();
        this._setupAssumptionsToggle();
        this._setupActivityBuilder();
        this._loadSavedData();
        console.log('[App] Init complete');
    },

    _setupModeSelector() {
        const buttons = document.querySelectorAll('.mode-btn');
        console.log('[App] Found mode buttons:', buttons.length);
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                console.log('[App] Mode button clicked:', btn.dataset.mode);
                this.mode = btn.dataset.mode;
                document.getElementById('mode-selector').classList.add('hidden');
                document.getElementById('planner-form').classList.remove('hidden');
                
                if (this.mode === 'detailed') {
                    const expandBtn = document.getElementById('expand-accounts');
                    if (expandBtn) expandBtn.click();
                }
            });
        });
    },

    _setupForm() {
        const form = document.getElementById('planner-form');
        if (!form) {
            console.error('[App] Form not found!');
            return;
        }
        
        // Account breakdown toggle
        const expandBtn = document.getElementById('expand-accounts');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                const breakdown = document.getElementById('account-breakdown');
                const totalSavings = document.getElementById('total-savings');
                if (breakdown) breakdown.classList.toggle('hidden');
                if (totalSavings) totalSavings.disabled = breakdown && !breakdown.classList.contains('hidden');
            });
        }

        // Auto-update contribution comparison
        const monthlyContrib = document.getElementById('monthly-contribution');
        if (monthlyContrib) {
            monthlyContrib.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value) || 0;
                const annual = value * 12;
                const avgAnnual = RetirementData.averages.annualSaving;
                
                let comparison = '';
                if (annual > avgAnnual * 1.2) {
                    comparison = `💪 ${Math.round((annual / avgAnnual - 1) * 100)}% above Canadian average`;
                } else if (annual < avgAnnual * 0.8) {
                    comparison = `📊 Canadian avg: $${Math.round(avgAnnual/12)}/month`;
                }
                
                const comparisonEl = document.getElementById('contribution-comparison');
                if (comparisonEl) comparisonEl.textContent = comparison;
            });
        }

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._calculate();
        });

        // Preset return rate buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const rate = btn.dataset.presetReturn;
                const rateInput = document.getElementById('return-rate');
                if (rateInput) rateInput.value = rate;
            });
        });
    },

    _setupLifestyleSelector() {
        document.querySelectorAll('.lifestyle-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.lifestyle-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                const lifestyle = card.dataset.lifestyle;
                this.selectedLifestyle = lifestyle;

                const builder = document.getElementById('activity-builder');
                if (builder) {
                    if (lifestyle === 'custom') {
                        builder.classList.remove('hidden');
                    } else {
                        builder.classList.add('hidden');
                    }
                }
            });
        });

        // Pre-select comfortable as default
        const defaultCard = document.querySelector('[data-lifestyle="comfortable"]');
        if (defaultCard) {
            defaultCard.click();
        }
    },

    _setupAssumptionsToggle() {
        const toggleBtn = document.getElementById('toggle-assumptions');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const content = document.getElementById('assumptions-content');
                const icon = document.querySelector('.toggle-icon');
                
                if (content) content.classList.toggle('hidden');
                if (icon) icon.classList.toggle('expanded');
            });
        }
    },

    _setupActivityBuilder() {
        const addBtn = document.getElementById('add-activity');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this._addActivity();
            });
        }
    },

    _addActivity() {
        const list = document.getElementById('activity-list');
        const activityId = `activity-${Date.now()}`;
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <input type="text" placeholder="Activity name" class="activity-name">
            <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input type="number" placeholder="0" min="0" class="activity-cost" style="width:100px">
                <span class="suffix">/year</span>
            </div>
            <button type="button" class="btn-secondary" onclick="this.parentElement.remove(); App._updateCustomBudget()">✕</button>
        `;
        
        list.appendChild(item);
        
        item.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this._updateCustomBudget());
        });
    },

    _updateCustomBudget() {
        const items = document.querySelectorAll('.activity-item');
        let total = 0;
        
        items.forEach(item => {
            const cost = parseFloat(item.querySelector('.activity-cost').value) || 0;
            total += cost;
        });
        
        document.getElementById('custom-budget-total').textContent = `$${total.toLocaleString()}`;
    },

    _calculate() {
        // Gather inputs
        const inputs = this._gatherInputs();
        
        // Run calculation
        const results = RetirementCalc.calculate(inputs);
        
        // Display results
        this._displayResults(results, inputs);
        
        // Save to localStorage
        this._saveData(inputs);
        
        // Scroll to results
        document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
    },

    _gatherInputs() {
        const useBreakdown = !document.getElementById('account-breakdown').classList.contains('hidden');
        
        let totalSavings;
        if (useBreakdown) {
            totalSavings = 
                parseFloat(document.getElementById('rrsp').value || 0) +
                parseFloat(document.getElementById('tfsa').value || 0) +
                parseFloat(document.getElementById('nonreg').value || 0) +
                parseFloat(document.getElementById('other').value || 0);
        } else {
            totalSavings = parseFloat(document.getElementById('total-savings').value || 0);
        }

        let annualSpending;
        if (this.selectedLifestyle === 'custom') {
            const items = document.querySelectorAll('.activity-item');
            annualSpending = 0;
            items.forEach(item => {
                annualSpending += parseFloat(item.querySelector('.activity-cost').value) || 0;
            });
        } else {
            annualSpending = RetirementData.lifestyles[this.selectedLifestyle].annual;
        }

        return {
            currentAge: parseInt(document.getElementById('current-age').value),
            retirementAge: parseInt(document.getElementById('retirement-age').value),
            totalSavings,
            monthlyContribution: parseFloat(document.getElementById('monthly-contribution').value || 0),
            annualSpending,
            returnRate: parseFloat(document.getElementById('return-rate').value),
            inflationRate: parseFloat(document.getElementById('inflation-rate').value),
            withdrawalRate: parseFloat(document.getElementById('withdrawal-rate').value),
            lifeExpectancy: parseInt(document.getElementById('life-expectancy').value),
            includeCPP: document.getElementById('include-cpp').checked
        };
    },

    _displayResults(results, inputs) {
        document.getElementById('planner-form').classList.add('hidden');
        document.getElementById('results').classList.remove('hidden');

        // Status banner
        const banner = document.getElementById('status-banner');
        if (results.onTrack) {
            banner.className = 'card status-banner on-track';
            banner.textContent = 'You are on track for retirement!';
        } else {
            banner.className = 'card status-banner needs-work';
            const neededSavings = RetirementCalc.calculateNeededSavings(
                results.shortfall,
                inputs.retirementAge - inputs.currentAge,
                inputs.returnRate
            );
            banner.innerHTML = `You need to save an additional <strong>$${neededSavings.toLocaleString()}/month</strong> to reach your goal`;
        }

        // Key stats
        document.getElementById('final-portfolio').textContent = `$${results.projectedSavings.toLocaleString()}`;
        document.getElementById('annual-income').textContent = `$${results.annualIncome.toLocaleString()}`;
        document.getElementById('money-lasts').textContent = `Age ${results.moneyLastsAge}`;
        
        const longevityNote = document.getElementById('longevity-note');
        if (results.moneyLastsAge >= inputs.lifeExpectancy) {
            longevityNote.textContent = '✅ Outlasts your plan';
            longevityNote.style.color = 'var(--success)';
        } else {
            longevityNote.textContent = `⚠️ Runs out ${inputs.lifeExpectancy - results.moneyLastsAge} years early`;
            longevityNote.style.color = 'var(--danger)';
        }

        // Projection chart
        this._drawChart(results.yearByYear, inputs.retirementAge);

        // Breakdown
        this._displayBreakdown(results, inputs);

        // Setup action buttons
        document.getElementById('btn-edit').onclick = () => {
            document.getElementById('results').classList.add('hidden');
            document.getElementById('planner-form').classList.remove('hidden');
        };

        document.getElementById('btn-save').onclick = () => {
            alert('Scenario saved to your browser!');
        };
    },

    _drawChart(yearByYear, retirementAge) {
        const canvas = document.getElementById('projection-chart');
        const ctx = canvas.getContext('2d');
        
        canvas.width = canvas.offsetWidth;
        canvas.height = 300;

        const w = canvas.width;
        const h = canvas.height;
        const padding = 40;

        ctx.clearRect(0, 0, w, h);

        if (yearByYear.length === 0) return;

        const maxBalance = Math.max(...yearByYear.map(y => y.balance));
        const minAge = yearByYear[0].age;
        const maxAge = yearByYear[yearByYear.length - 1].age;

        // Draw axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, h - padding);
        ctx.lineTo(w - padding, h - padding);
        ctx.lineTo(w - padding, padding);
        ctx.stroke();

        // Draw retirement age line
        const retireX = padding + ((retirementAge - minAge) / (maxAge - minAge)) * (w - 2 * padding);
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(retireX, padding);
        ctx.lineTo(retireX, h - padding);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw growth curve
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.beginPath();

        yearByYear.forEach((point, i) => {
            const x = padding + ((point.age - minAge) / (maxAge - minAge)) * (w - 2 * padding);
            const y = h - padding - (point.balance / maxBalance) * (h - 2 * padding);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

        // Labels
        ctx.fillStyle = '#6b7280';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Age ${minAge}`, padding, h - padding + 20);
        ctx.fillText(`Age ${maxAge}`, w - padding - 30, h - padding + 20);
        ctx.fillText(`$${(maxBalance / 1000).toFixed(0)}K`, 5, padding);
        ctx.fillText('Retirement', retireX - 30, padding - 5);
    },

    _displayBreakdown(results, inputs) {
        const content = document.getElementById('breakdown-content');
        content.innerHTML = `
            <ul style="line-height: 2;">
                <li><strong>Current savings:</strong> $${inputs.totalSavings.toLocaleString()}</li>
                <li><strong>Monthly contributions:</strong> $${inputs.monthlyContribution.toLocaleString()}</li>
                <li><strong>Years until retirement:</strong> ${inputs.retirementAge - inputs.currentAge}</li>
                <li><strong>Expected return:</strong> ${inputs.returnRate}% annually</li>
                <li><strong>Projected at retirement:</strong> $${results.projectedSavings.toLocaleString()}</li>
                <li><strong>Annual spending goal:</strong> $${results.futureSpending.toLocaleString()} (inflation-adjusted)</li>
                <li><strong>CPP + OAS income:</strong> $${results.governmentIncome.toLocaleString()}/year</li>
                <li><strong>Withdrawal from savings:</strong> $${results.withdrawalAmount.toLocaleString()}/year</li>
                <li><strong>Total annual income:</strong> $${results.annualIncome.toLocaleString()}</li>
            </ul>
        `;
    },

    _saveData(inputs) {
        localStorage.setItem('retirement_calc_inputs', JSON.stringify(inputs));
    },

    _loadSavedData() {
        const saved = localStorage.getItem('retirement_calc_inputs');
        if (saved) {
            // Could auto-fill form here
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());

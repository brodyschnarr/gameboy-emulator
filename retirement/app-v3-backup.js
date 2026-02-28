// ═══════════════════════════════════════════
//  Retirement Planner V3 - App Controller
// ═══════════════════════════════════════════

const AppV3 = {
    currentStep: 'basic',
    inputs: {},
    familyStatus: 'single',
    selectedProvince: '',
    customCPP: null,
    customOAS: null,

    init() {
        console.log('[AppV3] Initializing...');
        this._setupNavigation();
        this._setupFamilyToggle();
        this._setupProvinceSelector();
        this._setupBenchmarks();
        this._setupPresets();
        this._setupCPPCustomization();
        this._setupCalculate();
        this._setupAdvancedToggle();
        this._loadSavedData();
        console.log('[AppV3] Init complete');
    },

    _setupNavigation() {
        // Step 1 → 2
        document.getElementById('btn-next-savings').addEventListener('click', () => {
            if (this._validateBasic()) {
                this._showStep('savings');
                this._updateSavingsBenchmark();
            }
        });

        // Step 2 → 3
        document.getElementById('btn-next-contributions').addEventListener('click', () => {
            this._showStep('contributions');
            this._updateContributionBenchmark();
        });

        // Step 3 → 4
        document.getElementById('btn-next-retirement').addEventListener('click', () => {
            this._showStep('retirement');
            this._updateSpendingRecommendation();
            this._updateGovBenefitsPreview();
        });

        // Back buttons
        document.getElementById('btn-back-basic').addEventListener('click', () => {
            this._showStep('basic');
        });

        document.getElementById('btn-back-savings').addEventListener('click', () => {
            this._showStep('savings');
        });

        document.getElementById('btn-back-contributions').addEventListener('click', () => {
            this._showStep('retirement');
        });
    },

    _setupFamilyToggle() {
        document.querySelectorAll('[data-family]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-family]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.familyStatus = btn.dataset.family;
                console.log('[AppV3] Family status:', this.familyStatus);
            });
        });
    },

    _setupProvinceSelector() {
        document.querySelectorAll('.province-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.province-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedProvince = btn.dataset.province;
                document.getElementById('province').value = this.selectedProvince;
                console.log('[AppV3] Province selected:', this.selectedProvince);
            });
        });

        // Set default province (ON)
        const defaultBtn = document.querySelector('.province-btn[data-province="ON"]');
        if (defaultBtn) {
            defaultBtn.click();
        }
    },

    _setupBenchmarks() {
        // Income benchmark
        document.getElementById('current-income').addEventListener('input', (e) => {
            const income = parseFloat(e.target.value) || 0;
            const age = parseInt(document.getElementById('current-age').value) || 35;
            
            if (income > 0) {
                const avgIncome = Benchmarks.incomeByAge[Math.min(Math.max(age, 25), 65)] || 60000;
                const diff = ((income / avgIncome) - 1) * 100;
                
                let message = '';
                if (diff > 20) message = `💪 ${Math.round(diff)}% above average for age ${age}`;
                else if (diff > -10) message = `📊 Near average for age ${age}`;
                else message = `⚠️ ${Math.round(Math.abs(diff))}% below average for age ${age}`;
                
                document.getElementById('income-benchmark').textContent = message;
            }

            // Update CPP estimate when income changes
            this._updateGovBenefitsPreview();
        });

        // Total savings calculator
        const savingsInputs = ['rrsp', 'tfsa', 'nonreg', 'other'];
        savingsInputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this._updateTotalSavings();
            });
        });

        // Contribution split validator
        const splits = ['split-rrsp', 'split-tfsa', 'split-nonreg'];
        splits.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this._validateSplit();
            });
        });
    },

    _setupPresets() {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lifestyle = btn.dataset.lifestyle;
                const amount = parseInt(btn.dataset.amount);
                
                // Show detail modal
                this._showLifestyleDetail(lifestyle);
                
                // Set as active and update input
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('annual-spending').value = amount;
                this._updateSpendingRecommendation();
            });
        });

        // Close detail modal
        document.getElementById('close-detail').addEventListener('click', () => {
            document.getElementById('lifestyle-detail').classList.add('hidden');
        });
    },

    _setupCPPCustomization() {
        document.getElementById('btn-customize-cpp').addEventListener('click', () => {
            const customInputs = document.getElementById('custom-gov-inputs');
            customInputs.classList.toggle('hidden');
        });

        // Listen for custom inputs
        document.getElementById('custom-cpp').addEventListener('input', (e) => {
            this.customCPP = e.target.value ? parseFloat(e.target.value) : null;
            this._updateGovBenefitsPreview();
        });

        document.getElementById('custom-oas').addEventListener('input', (e) => {
            this.customOAS = e.target.value ? parseFloat(e.target.value) : null;
            this._updateGovBenefitsPreview();
        });
    },

    _setupCalculate() {
        document.getElementById('btn-calculate').addEventListener('click', () => {
            if (this._validateAllInputs()) {
                this._runCalculation();
            }
        });

        document.getElementById('btn-edit').addEventListener('click', () => {
            document.getElementById('results').classList.add('hidden');
            this._showStep('basic');
        });

        document.getElementById('btn-save').addEventListener('click', () => {
            this._saveScenario();
        });
    },

    _setupAdvancedToggle() {
        document.getElementById('toggle-assumptions').addEventListener('click', () => {
            const content = document.getElementById('assumptions-content');
            const icon = document.querySelector('.toggle-icon');
            content.classList.toggle('hidden');
            icon.textContent = content.classList.contains('hidden') ? '▼' : '▲';
        });
    },

    _showStep(step) {
        ['basic', 'savings', 'contributions', 'retirement'].forEach(s => {
            document.getElementById(`step-${s}`).classList.add('hidden');
        });
        
        document.getElementById(`step-${step}`).classList.remove('hidden');
        this.currentStep = step;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    _validateBasic() {
        const age = parseInt(document.getElementById('current-age').value);
        const income = parseFloat(document.getElementById('current-income').value);
        const province = this.selectedProvince;

        if (!age || age < 18 || age > 100) {
            alert('Please enter a valid age (18-100)');
            return false;
        }

        if (!income || income < 0) {
            alert('Please enter your annual income');
            return false;
        }

        if (!province) {
            alert('Please select your province');
            return false;
        }

        return true;
    },

    _validateAllInputs() {
        if (!this._validateBasic()) return false;

        const retirementAge = parseInt(document.getElementById('retirement-age').value);
        const currentAge = parseInt(document.getElementById('current-age').value);
        const lifeExpectancy = parseInt(document.getElementById('life-expectancy').value);

        if (retirementAge <= currentAge) {
            alert('Retirement age must be greater than your current age');
            return false;
        }

        if (lifeExpectancy <= retirementAge) {
            alert('Life expectancy must be greater than retirement age');
            return false;
        }

        const spending = parseFloat(document.getElementById('annual-spending').value);
        if (!spending || spending <= 0) {
            alert('Please enter your expected annual spending in retirement');
            return false;
        }

        return true;
    },

    _updateSavingsBenchmark() {
        const age = parseInt(document.getElementById('current-age').value) || 35;
        const benchmark = Benchmarks.getSavingsBenchmark(age);
        
        const html = `
            <strong>Typical Canadian at age ${age}:</strong><br>
            Median: $${benchmark.median.toLocaleString()} | 
            Average: $${benchmark.average.toLocaleString()}
        `;
        
        document.getElementById('savings-benchmark').innerHTML = html;
    },

    _updateTotalSavings() {
        const rrsp = parseFloat(document.getElementById('rrsp').value) || 0;
        const tfsa = parseFloat(document.getElementById('tfsa').value) || 0;
        const nonreg = parseFloat(document.getElementById('nonreg').value) || 0;
        const other = parseFloat(document.getElementById('other').value) || 0;
        
        const total = rrsp + tfsa + nonreg + other;
        document.getElementById('total-savings-display').textContent = `$${total.toLocaleString()}`;

        const age = parseInt(document.getElementById('current-age').value) || 35;
        const comparison = Benchmarks.compareSavings(age, total);
        document.getElementById('total-savings-benchmark').textContent = comparison.message;
    },

    _updateContributionBenchmark() {
        const monthly = parseFloat(document.getElementById('monthly-contribution').value) || 0;
        const income = parseFloat(document.getElementById('current-income').value) || 60000;
        
        if (monthly > 0) {
            const comparison = Benchmarks.compareContribution(monthly, income);
            document.getElementById('contribution-benchmark').textContent = 
                `${comparison.message} (Recommended: $${comparison.recommended}/month)`;
        }
    },

    _validateSplit() {
        const rrsp = parseFloat(document.getElementById('split-rrsp').value) || 0;
        const tfsa = parseFloat(document.getElementById('split-tfsa').value) || 0;
        const nonreg = parseFloat(document.getElementById('split-nonreg').value) || 0;
        
        const total = rrsp + tfsa + nonreg;
        const el = document.getElementById('split-total');
        
        if (Math.abs(total - 100) < 0.1) {
            el.textContent = '✅ Total: 100%';
            el.style.color = 'var(--success, green)';
        } else {
            el.textContent = `⚠️ Total: ${total.toFixed(1)}% (should be 100%)`;
            el.style.color = 'var(--danger, red)';
        }
    },

    _updateSpendingRecommendation() {
        const income = parseFloat(document.getElementById('current-income').value) || 60000;
        const recommended = Benchmarks.getRecommendedSpending(income);
        
        document.getElementById('spending-recommendation').textContent = 
            `Recommended: $${recommended.toLocaleString()}/year (70% of current income)`;
    },

    _updateGovBenefitsPreview() {
        const income = parseFloat(document.getElementById('current-income').value) || 60000;
        const retirementAge = parseInt(document.getElementById('retirement-age').value) || 65;
        const yearsContributing = Math.min(retirementAge - 18, 39);
        
        const isSingle = this.familyStatus === 'single';
        const govBenefits = CPPCalculator.getGovernmentBenefits(income, yearsContributing, 0, isSingle);

        const cpp = this.customCPP !== null ? this.customCPP : govBenefits.cppTotal;
        const oas = this.customOAS !== null ? this.customOAS : govBenefits.oas;
        const total = cpp + oas + govBenefits.gis;

        document.getElementById('cpp-estimate').textContent = `$${Math.round(cpp).toLocaleString()}/year`;
        document.getElementById('oas-estimate').textContent = `$${Math.round(oas).toLocaleString()}/year`;
        document.getElementById('gov-total-estimate').textContent = `$${Math.round(total).toLocaleString()}/year`;
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

        document.getElementById('lifestyle-detail').classList.remove('hidden');
    },

    _runCalculation() {
        const inputs = {
            currentAge: parseInt(document.getElementById('current-age').value),
            retirementAge: parseInt(document.getElementById('retirement-age').value),
            lifeExpectancy: parseInt(document.getElementById('life-expectancy').value),
            province: this.selectedProvince,
            currentIncome: parseFloat(document.getElementById('current-income').value),
            
            rrsp: parseFloat(document.getElementById('rrsp').value) || 0,
            tfsa: parseFloat(document.getElementById('tfsa').value) || 0,
            nonReg: parseFloat(document.getElementById('nonreg').value) || 0,
            other: parseFloat(document.getElementById('other').value) || 0,
            
            monthlyContribution: parseFloat(document.getElementById('monthly-contribution').value) || 0,
            contributionSplit: {
                rrsp: (parseFloat(document.getElementById('split-rrsp').value) || 0) / 100,
                tfsa: (parseFloat(document.getElementById('split-tfsa').value) || 0) / 100,
                nonReg: (parseFloat(document.getElementById('split-nonreg').value) || 0) / 100
            },
            
            annualSpending: parseFloat(document.getElementById('annual-spending').value),
            
            returnRate: parseFloat(document.getElementById('return-rate').value) || 6,
            inflationRate: parseFloat(document.getElementById('inflation-rate').value) || 2.5,

            familyStatus: this.familyStatus,
            customCPP: this.customCPP,
            customOAS: this.customOAS
        };

        console.log('[AppV3] Inputs:', inputs);

        const results = RetirementCalcV2.calculate(inputs);
        console.log('[AppV3] Results:', results);

        this._displayResults(results, inputs);
        
        ['basic', 'savings', 'contributions', 'retirement'].forEach(s => {
            document.getElementById(`step-${s}`).classList.add('hidden');
        });
        document.getElementById('results').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    _displayResults(results, inputs) {
        const banner = document.getElementById('status-banner');
        if (results.onTrack) {
            banner.className = 'card status-banner on-track';
            banner.textContent = '✅ You are on track for retirement!';
        } else {
            banner.className = 'card status-banner needs-work';
            banner.innerHTML = `⚠️ You may need to adjust your plan to meet your retirement goals`;
        }

        document.getElementById('stat-portfolio').textContent = 
            `$${results.summary.portfolioAtRetirement.toLocaleString()}`;
        
        document.getElementById('stat-income').textContent = 
            `$${results.summary.annualIncomeAtRetirement.toLocaleString()}`;
        
        document.getElementById('stat-government').textContent = 
            `$${results.govBenefits.totalGovernment.toLocaleString()}`;
        
        const govBreakdown = Object.entries(results.govBenefits.breakdown)
            .filter(([k, v]) => v > 0)
            .map(([k, v]) => `${k}: $${v.toLocaleString()}`)
            .join(' | ');
        document.getElementById('stat-government-breakdown').textContent = govBreakdown;

        document.getElementById('stat-lasts').textContent = 
            `Age ${results.summary.moneyLastsAge}`;
        
        const lastsNote = document.getElementById('stat-lasts-note');
        if (results.summary.moneyLastsAge >= inputs.lifeExpectancy) {
            lastsNote.textContent = '✅ Outlasts your plan';
            lastsNote.style.color = 'var(--success, green)';
        } else {
            const yearsShort = inputs.lifeExpectancy - results.summary.moneyLastsAge;
            lastsNote.textContent = `⚠️ Runs out ${yearsShort} years early`;
            lastsNote.style.color = 'var(--danger, red)';
        }

        this._drawChart(results.yearByYear, inputs.retirementAge);
        this._drawYearBreakdown(results.yearByYear, inputs.retirementAge);
        this._displayBreakdown(results, inputs);
    },

    _drawChart(yearByYear, retirementAge) {
        const canvas = document.getElementById('projection-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match container
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

        // Draw axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, h - padding);
        ctx.lineTo(w - padding, h - padding);
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h - padding);
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

        // Draw balance curve
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
        ctx.fillText('$0', 5, h - padding + 5);
        
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('Retirement', retireX - 35, padding - 10);
    },

    _drawYearBreakdown(yearByYear, retirementAge) {
        const container = document.getElementById('year-breakdown-chart');
        if (!container) return;

        // Filter to retirement years only
        const retirementYears = yearByYear.filter(y => y.age >= retirementAge).slice(0, 25); // Show first 25 years

        if (retirementYears.length === 0) {
            container.innerHTML = '<p>No retirement data available</p>';
            return;
        }

        const maxBalance = Math.max(...retirementYears.map(y => y.totalBalance));

        const html = retirementYears.map(year => {
            const rrspPct = (year.rrsp / maxBalance) * 100;
            const tfsaPct = (year.tfsa / maxBalance) * 100;
            const nonRegPct = (year.nonReg / maxBalance) * 100;
            const otherPct = (year.other / maxBalance) * 100;

            return `
                <div class="year-bar-row">
                    <div class="year-label">Age ${year.age}</div>
                    <div class="year-bar">
                        <div class="bar-segment rrsp" style="width: ${rrspPct}%" title="RRSP: $${year.rrsp.toLocaleString()}"></div>
                        <div class="bar-segment tfsa" style="width: ${tfsaPct}%" title="TFSA: $${year.tfsa.toLocaleString()}"></div>
                        <div class="bar-segment nonreg" style="width: ${nonRegPct}%" title="Non-Reg: $${year.nonReg.toLocaleString()}"></div>
                        ${otherPct > 0 ? `<div class="bar-segment other" style="width: ${otherPct}%" title="Other: $${year.other.toLocaleString()}"></div>` : ''}
                    </div>
                    <div class="year-total">$${year.totalBalance.toLocaleString()}</div>
                </div>
            `;
        }).join('');

        const legend = `
            <div class="chart-legend">
                <div class="legend-item"><span class="legend-color rrsp"></span> RRSP</div>
                <div class="legend-item"><span class="legend-color tfsa"></span> TFSA</div>
                <div class="legend-item"><span class="legend-color nonreg"></span> Non-Reg</div>
                ${retirementYears.some(y => y.other > 0) ? '<div class="legend-item"><span class="legend-color other"></span> Other</div>' : ''}
            </div>
        `;

        container.innerHTML = legend + html;
    },

    _displayBreakdown(results, inputs) {
        const retirementYears = results.yearByYear.filter(y => y.phase === 'retirement');
        
        if (retirementYears.length === 0) {
            document.getElementById('breakdown-content').innerHTML = '<p>No retirement years projected.</p>';
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
                    <td>Non-Registered (50% taxable)</td>
                    <td>$${(firstYear.withdrawalBreakdown?.nonReg || 0).toLocaleString()}</td>
                </tr>
                <tr>
                    <td>RRSP (fully taxable)</td>
                    <td>$${(firstYear.withdrawalBreakdown?.rrsp || 0).toLocaleString()}</td>
                </tr>
                <tr>
                    <td>Other</td>
                    <td>$${(firstYear.withdrawalBreakdown?.other || 0).toLocaleString()}</td>
                </tr>
                <tr class="total-row">
                    <td><strong>Total Withdrawal</strong></td>
                    <td><strong>$${(firstYear.withdrawal || 0).toLocaleString()}</strong></td>
                </tr>
            </table>

            <h3>Income & Taxes</h3>
            <ul style="line-height: 2;">
                <li><strong>Government Benefits:</strong> $${results.govBenefits.totalGovernment.toLocaleString()}/year</li>
                <li><strong>Taxable Income:</strong> $${(firstYear.taxableIncome || 0).toLocaleString()}</li>
                <li><strong>Tax Paid:</strong> $${(firstYear.taxPaid || 0).toLocaleString()}</li>
                <li><strong>After-Tax Income:</strong> $${(firstYear.afterTaxIncome || 0).toLocaleString()}</li>
                <li><strong>Average Tax Rate in Retirement:</strong> ${avgTaxRate.toFixed(1)}%</li>
            </ul>

            <p class="tax-note">
                💡 <strong>Why this order?</strong> Withdrawing from TFSA first minimizes taxes. 
                Then non-registered (only 50% taxable), then RRSP (fully taxable). 
                This strategy maximizes your after-tax income.
            </p>
        `;

        document.getElementById('breakdown-content').innerHTML = html;
    },

    _saveScenario() {
        const data = {
            familyStatus: this.familyStatus,
            currentAge: document.getElementById('current-age').value,
            province: this.selectedProvince,
            currentIncome: document.getElementById('current-income').value,
            rrsp: document.getElementById('rrsp').value,
            tfsa: document.getElementById('tfsa').value,
            nonreg: document.getElementById('nonreg').value,
            other: document.getElementById('other').value,
            monthlyContribution: document.getElementById('monthly-contribution').value,
            retirementAge: document.getElementById('retirement-age').value,
            lifeExpectancy: document.getElementById('life-expectancy').value,
            annualSpending: document.getElementById('annual-spending').value
        };

        localStorage.setItem('retirementPlannerV3', JSON.stringify(data));
        alert('✅ Scenario saved!');
    },

    _loadSavedData() {
        const saved = localStorage.getItem('retirementPlannerV3');
        if (!saved) return;

        const data = JSON.parse(saved);
        
        // Restore family status
        if (data.familyStatus) {
            this.familyStatus = data.familyStatus;
            document.querySelector(`[data-family="${data.familyStatus}"]`)?.click();
        }

        // Restore province
        if (data.province) {
            this.selectedProvince = data.province;
            document.querySelector(`[data-province="${data.province}"]`)?.click();
        }

        // Restore other fields
        Object.keys(data).forEach(key => {
            const el = document.getElementById(key);
            if (el && key !== 'familyStatus' && key !== 'province') {
                el.value = data[key];
            }
        });

        console.log('[AppV3] Loaded saved data');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppV3.init();
});

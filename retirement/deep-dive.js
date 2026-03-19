// ═══════════════════════════════════════════
//  Deep Dive Retirement Breakdown
//  Premium analysis: phase-by-phase narrative,
//  tax strategy explanation, action items
// ═══════════════════════════════════════════

const DeepDive = {

    generate(results, inputs, strategyLabel = 'Your Plan') {
        const years = results.yearByYear || [];
        const accum = years.filter(y => y.phase === 'accumulation');
        const retire = years.filter(y => y.phase === 'retirement');
        const retAge = inputs.retirementAge || 65;
        const lifeExp = inputs.lifeExpectancy || 90;
        const currentAge = inputs.currentAge || 35;
        const province = inputs.province || 'ON';
        const fmt = (v) => '$' + Math.round(Math.abs(v)).toLocaleString();
        const fmtK = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : fmt(v);
        const pct = (v) => (v * 100).toFixed(1) + '%';

        // Gather key data points
        const portfolioAtRet = results.summary?.portfolioAtRetirement || 0;
        const lastYear = retire[retire.length - 1] || {};
        const legacyAmount = lastYear.totalBalance || 0;
        const totalTaxPaid = retire.reduce((s, y) => s + (y.taxPaid || 0), 0);
        const totalGovBenefits = retire.reduce((s, y) => s + (y.cppReceived || 0) + (y.oasReceived || 0) + (y.gisReceived || 0), 0);
        const totalWithdrawals = retire.reduce((s, y) => s + (y.withdrawal || 0), 0);
        const estateTax = results.legacy?.estateTax || 0;
        const retYears = lifeExp - retAge;

        // Find key milestones
        const cppStartYear = retire.find(y => y.cppReceived > 0);
        const oasStartYear = retire.find(y => y.oasReceived > 0);
        const gisStartYear = retire.find(y => y.gisReceived > 0);
        const rrifStartYear = retire.find(y => (y.rrifMandatory || 0) > 0);
        const depletionYear = retire.find(y => (y.totalBalance || 0) < 100);
        const peakBalance = years.length > 0 ? Math.max(...years.map(y => y.totalBalance || 0)) : 0;
        const peakYear = years.find(y => (y.totalBalance || 0) === peakBalance);
        const clawbackYears = retire.filter(y => (y.oasClawback || 0) > 0);
        const totalClawback = clawbackYears.reduce((s, y) => s + (y.oasClawback || 0), 0);

        // Identify withdrawal patterns
        const earlyRetire = retire.slice(0, 5);
        const midRetire = retire.slice(Math.floor(retire.length/3), Math.floor(2*retire.length/3));
        const lateRetire = retire.slice(-5);

        const avgEarlyTax = earlyRetire.length ? earlyRetire.reduce((s,y) => s + (y.taxPaid||0), 0) / earlyRetire.length : 0;
        const avgLateTax = lateRetire.length ? lateRetire.reduce((s,y) => s + (y.taxPaid||0), 0) / lateRetire.length : 0;

        // Account composition at retirement
        const retYr = years.find(y => y.age === retAge) || {};
        const rrspAtRet = retYr.rrsp || 0;
        const tfsaAtRet = retYr.tfsa || 0;
        const nonRegAtRet = retYr.nonReg || 0;
        const liraAtRet = retYr.lira || 0;
        const otherAtRet = retYr.other || 0;
        const cashAtRet = retYr.cash || 0;

        // Build sections
        let html = '';

        // ═══ 1. EXECUTIVE SUMMARY ═══
        html += `<div class="dd-section">
            <h3 class="dd-section-title">📊 Executive Summary</h3>
            <div class="dd-summary-grid">
                <div class="dd-summary-item">
                    <div class="dd-summary-value">${fmtK(portfolioAtRet)}</div>
                    <div class="dd-summary-label">Portfolio at ${retAge}</div>
                </div>
                <div class="dd-summary-item">
                    <div class="dd-summary-value">${fmt(inputs.annualSpending || 0)}/yr</div>
                    <div class="dd-summary-label">Annual Spending</div>
                </div>
                <div class="dd-summary-item">
                    <div class="dd-summary-value">${fmtK(totalGovBenefits)}</div>
                    <div class="dd-summary-label">Gov Benefits (total)</div>
                </div>
                <div class="dd-summary-item">
                    <div class="dd-summary-value">${pct(totalTaxPaid / (totalWithdrawals + totalGovBenefits || 1))}</div>
                    <div class="dd-summary-label">Effective Tax Rate</div>
                </div>
            </div>
            <div class="dd-verdict">
                ${depletionYear 
                    ? `⚠️ Your portfolio depletes at age <strong>${depletionYear.age}</strong>, but government benefits (${fmt((depletionYear.cppReceived||0) + (depletionYear.oasReceived||0) + (depletionYear.gisReceived||0))}/yr) continue for life.`
                    : `✅ Your money lasts to <strong>age ${lifeExp}</strong> with ${fmtK(legacyAmount)} remaining for your estate.`
                }
            </div>
        </div>`;

        // ═══ 2. YOUR RETIREMENT TIMELINE ═══
        html += `<div class="dd-section">
            <h3 class="dd-section-title">🗓️ Your Retirement Timeline</h3>
            <div class="dd-timeline">`;

        // Accumulation milestone
        if (accum.length > 0) {
            const totalContribs = accum.reduce((s, y) => s + (y.contribution || 0), 0);
            const growth = portfolioAtRet - (accum[0]?.totalBalance || 0) - totalContribs;
            html += this._timelineItem(currentAge, retAge - 1, '💼 Saving Phase',
                `You contribute ${fmtK(totalContribs)} over ${retAge - currentAge} years. ` +
                `Investment growth adds ${fmtK(growth)}. ` +
                `Portfolio peaks at ${fmtK(peakBalance)} (age ${peakYear?.age || retAge}).`,
                'accumulation');
        }

        // Early retirement (before CPP/OAS)
        const preCPP = retire.filter(y => (y.cppReceived || 0) === 0);
        if (preCPP.length > 0 && cppStartYear) {
            const avgWithdrawal = preCPP.reduce((s,y) => s + (y.withdrawal||0), 0) / preCPP.length;
            html += this._timelineItem(retAge, cppStartYear.age - 1, '🏖️ Early Retirement',
                `No CPP/OAS yet — you live entirely on portfolio withdrawals. ` +
                `Average withdrawal: ${fmt(avgWithdrawal)}/yr. ` +
                `This is a key window for RRSP meltdown (converting RRSP to cash at low tax rates before government benefits push you into higher brackets).`,
                'early');
        }

        // CPP/OAS phase
        if (cppStartYear) {
            const cppNote = cppStartYear.age === 60 ? 'Starting CPP early means 36% less than at 65.' :
                           cppStartYear.age === 65 ? 'Taking CPP at the standard age.' :
                           cppStartYear.age > 65 ? `Deferring CPP to ${cppStartYear.age} earns ${((cppStartYear.age - 65) * 8.4).toFixed(0)}% more — patience pays.` : '';
            const oasNote = oasStartYear ? (oasStartYear.age > 65 ? `OAS deferred to ${oasStartYear.age} for ${((oasStartYear.age - 65) * 7.2).toFixed(0)}% bonus.` : 'OAS at 65.') : '';
            html += this._timelineItem(cppStartYear.age, oasStartYear ? Math.max(cppStartYear.age, oasStartYear.age) : cppStartYear.age, '🏛️ Government Benefits Begin',
                `CPP starts: ${fmt(cppStartYear.cppReceived)}/yr. ${cppNote} ` +
                (oasStartYear ? `OAS starts: ${fmt(oasStartYear.oasReceived)}/yr. ${oasNote} ` : '') +
                (gisStartYear ? `GIS: ${fmt(gisStartYear.gisReceived)}/yr (income-tested top-up). ` : '') +
                `These benefits reduce how much you need from your portfolio.`,
                'benefits');
        }

        // RRIF conversion at 71
        if (rrifStartYear) {
            html += this._timelineItem(71, 71, '🔄 RRIF Conversion (Age 71)',
                `CRA requires you to convert RRSP to RRIF and take mandatory minimum withdrawals. ` +
                `First year minimum: ${fmt(rrifStartYear.rrifMandatory)} (${pct(rrifStartYear.rrifMandatory / (retYr.rrsp || 1))} of RRSP). ` +
                `This is forced taxable income — which is why meltdown before 71 can be smart.`,
                'rrif');
        }

        // OAS Clawback warning
        if (clawbackYears.length > 0) {
            const firstClawback = clawbackYears[0];
            html += this._timelineItem(firstClawback.age, clawbackYears[clawbackYears.length-1].age, '🔻 OAS Clawback Zone',
                `Your income exceeds the clawback threshold (~$93K) in ${clawbackYears.length} years. ` +
                `Total OAS clawed back: ${fmt(totalClawback)}. ` +
                `Each dollar above the threshold costs you 15¢ of OAS. ` +
                `Strategies: use TFSA withdrawals (not counted as income), spread RRSP withdrawals evenly.`,
                'warning');
        }

        // Late retirement
        if (lateRetire.length > 0) {
            const lastBal = lateRetire[lateRetire.length - 1].totalBalance || 0;
            html += this._timelineItem(lifeExp - 5, lifeExp, '🌅 Final Years',
                `Portfolio balance: ${fmtK(lastBal)}. ` +
                (lastBal > 100000 ? `Comfortable cushion remaining. ` : lastBal > 0 ? `Getting thin — mostly living on government benefits. ` : `Portfolio depleted — relying entirely on CPP/OAS/GIS. `) +
                `Healthcare costs may be higher in these years${inputs.ltcMonthly > 0 ? ` (LTC: ${fmt(inputs.ltcMonthly * 12)}/yr from age ${inputs.ltcStartAge || 80})` : ''}.`,
                'late');
        }

        html += `</div></div>`;

        // ═══ 3. ACCOUNT STRATEGY ═══
        html += `<div class="dd-section">
            <h3 class="dd-section-title">🏦 Account Strategy</h3>
            <div class="dd-accounts">
                <div class="dd-account-composition">
                    <h4>Portfolio at Retirement (Age ${retAge})</h4>
                    <div class="dd-account-bars">`;

        const accounts = [
            { name: 'RRSP', val: rrspAtRet, cls: 'rrsp', note: 'Taxed on withdrawal. CRA forces RRIF at 71.' },
            { name: 'TFSA', val: tfsaAtRet, cls: 'tfsa', note: 'Tax-free withdrawals. Doesn\'t count for GIS/OAS.' },
            { name: 'Non-Reg', val: nonRegAtRet, cls: 'nonreg', note: 'Only capital gains taxed (50% inclusion).' },
            { name: 'LIRA', val: liraAtRet, cls: 'lira', note: 'Locked-in. Converts to LIF with provincial max limits.' },
            { name: 'Other', val: otherAtRet + cashAtRet, cls: 'other', note: 'Fully taxable on withdrawal.' }
        ].filter(a => a.val > 0);

        const maxAcct = accounts.length > 0 ? Math.max(...accounts.map(a => a.val)) : 1;
        for (const acct of accounts) {
            const width = Math.max(5, (acct.val / maxAcct) * 100);
            const share = (acct.val / portfolioAtRet * 100).toFixed(0);
            html += `
                <div class="dd-account-row">
                    <div class="dd-account-label">${acct.name} <span class="dd-account-pct">${share}%</span></div>
                    <div class="dd-account-bar-track">
                        <div class="dd-account-bar bar-segment ${acct.cls}" style="width: ${width}%"></div>
                    </div>
                    <div class="dd-account-value">${fmtK(acct.val)}</div>
                </div>
                <div class="dd-account-note">${acct.note}</div>`;
        }

        html += `</div></div>`;

        // Withdrawal order explanation
        html += `<div class="dd-withdrawal-order">
            <h4>Withdrawal Order</h4>
            <p class="dd-text">The strategy withdraws in this priority to minimize lifetime tax:</p>
            <ol class="dd-ordered-list">`;

        if (inputs._withdrawalStrategy === 'naive' || strategyLabel.includes('TFSA')) {
            html += `<li><strong>TFSA first</strong> — tax-free, preserves GIS eligibility</li>`;
            html += `<li><strong>Non-Registered</strong> — only capital gains portion taxed</li>`;
            html += `<li><strong>RRSP/RRIF</strong> — fully taxable, but deferred as long as possible</li>`;
        } else {
            html += `<li><strong>Pre-65: TFSA → Non-Reg → RRSP</strong> — minimize tax while income is low</li>`;
            html += `<li><strong>Post-65: RRSP (capped at OAS threshold) → Non-Reg → TFSA</strong> — fill low brackets, avoid clawback</li>`;
            html += `<li><strong>Overflow: Additional RRSP if needed</strong></li>`;
        }
        html += `</ol></div></div>`;

        // ═══ 4. TAX DEEP DIVE ═══
        html += `<div class="dd-section">
            <h3 class="dd-section-title">💰 Tax Deep Dive</h3>`;

        // Tax by phase
        const phase1 = retire.filter(y => y.age < (cppStartYear?.age || 65));
        const phase2 = retire.filter(y => y.age >= (cppStartYear?.age || 65) && y.age < 71);
        const phase3 = retire.filter(y => y.age >= 71);

        const phases = [
            { name: `Pre-Benefits (${retAge}-${(cppStartYear?.age || 65) - 1})`, years: phase1 },
            { name: `Benefits Active (${cppStartYear?.age || 65}-70)`, years: phase2 },
            { name: `RRIF Phase (71+)`, years: phase3 }
        ].filter(p => p.years.length > 0);

        html += `<div class="dd-tax-phases">`;
        for (const phase of phases) {
            const totalTax = phase.years.reduce((s, y) => s + (y.taxPaid || 0), 0);
            const avgTax = totalTax / phase.years.length;
            const avgIncome = phase.years.reduce((s, y) => s + (y.taxableIncome || y.grossIncome || 0), 0) / phase.years.length;
            const effRate = avgIncome > 0 ? avgTax / avgIncome : 0;
            html += `
                <div class="dd-tax-phase">
                    <div class="dd-tax-phase-header">${phase.name}</div>
                    <div class="dd-tax-phase-stats">
                        <span>Avg income: ${fmt(avgIncome)}/yr</span>
                        <span>Avg tax: ${fmt(avgTax)}/yr</span>
                        <span>Rate: ${pct(effRate)}</span>
                    </div>
                </div>`;
        }
        html += `</div>`;

        // Tax vs age mini-chart (text-based)
        html += `<div class="dd-tax-trend">
            <h4>Tax Over Time</h4>
            <div class="dd-mini-chart">`;
        const maxTax = Math.max(...retire.map(y => y.taxPaid || 0), 1);
        // Sample every 3rd year to keep it compact
        for (let i = 0; i < retire.length; i += 3) {
            const y = retire[i];
            const barWidth = Math.max(2, ((y.taxPaid || 0) / maxTax) * 100);
            html += `<div class="dd-chart-row">
                <span class="dd-chart-age">${y.age}</span>
                <div class="dd-chart-bar-track"><div class="dd-chart-bar" style="width: ${barWidth}%"></div></div>
                <span class="dd-chart-val">${fmtK(y.taxPaid || 0)}</span>
            </div>`;
        }
        html += `</div></div>`;

        // Year-by-year expandable
        const avgAnnualTax = retire.length > 0 ? totalTaxPaid / retire.length : 0;
        html += `<details class="dd-year-detail">
            <summary class="dd-year-detail-toggle">📅 Year-by-Year Tax Detail</summary>
            <div class="dd-year-table">
                <div class="dd-year-header">
                    <span>Age</span><span>Income</span><span>Tax</span><span>Rate</span><span>From</span>
                </div>`;
        for (const y of retire) {
            const income = y.taxableIncome || y.grossIncome || 0;
            const tax = y.taxPaid || 0;
            const rate = income > 0 ? ((tax / income) * 100).toFixed(1) : '0.0';
            const wb = y.withdrawalBreakdown || {};
            // Build source summary
            const sources = [];
            if ((wb.rrsp || 0) > 0) sources.push(`RRSP ${fmtK(wb.rrsp)}`);
            if ((wb.tfsa || 0) > 0) sources.push(`TFSA ${fmtK(wb.tfsa)}`);
            if ((wb.nonReg || 0) > 0) sources.push(`NR ${fmtK(wb.nonReg)}`);
            if ((wb.lira || 0) > 0) sources.push(`LIRA ${fmtK(wb.lira)}`);
            if ((y.cppReceived || 0) > 0) sources.push(`CPP ${fmtK(y.cppReceived)}`);
            if ((y.oasReceived || 0) > 0) sources.push(`OAS ${fmtK(y.oasReceived)}`);
            if ((y.gisReceived || 0) > 0) sources.push(`GIS ${fmtK(y.gisReceived)}`);
            if ((y.additionalIncome || 0) > 0) sources.push(`Other ${fmtK(y.additionalIncome)}`);
            
            const clawback = (y.oasClawback || 0) > 0 ? ` <span class="dd-clawback">⚠ -${fmtK(y.oasClawback)} clawback</span>` : '';
            const rrif = (y.rrifMandatory || 0) > 0 ? ` <span class="dd-rrif-tag">RRIF</span>` : '';
            
            html += `<details class="dd-year-row-detail">
                <summary class="dd-year-row ${tax > avgAnnualTax * 1.5 ? 'high-tax' : ''}">
                    <span>${y.age}${rrif}</span><span>${fmtK(income)}</span><span>${fmtK(tax)}</span><span>${rate}%</span><span class="dd-source-preview">${sources[0] || ''}</span>
                </summary>
                <div class="dd-year-expanded">
                    <div class="dd-year-sources">${sources.join(' · ')}${clawback}</div>
                    <div class="dd-year-balances">
                        💰 Portfolio: ${fmtK(y.totalBalance || 0)}
                        ${y.rrsp ? `(RRSP ${fmtK(y.rrsp)}, TFSA ${fmtK(y.tfsa)}, NR ${fmtK(y.nonReg)})` : ''}
                    </div>
                    <div class="dd-year-spending">🛒 Spending: ${fmtK(y.targetSpending || 0)} · HC: ${fmtK(y.healthcareCost || 0)}</div>
                </div>
            </details>`;
        }
        html += `</div></details>`;

        // Estate tax explanation
        if (estateTax > 0) {
            html += `<div class="dd-callout">
                <h4>🏠 Estate Tax at Death</h4>
                <p class="dd-text">
                    When you pass away, CRA treats your RRSP/RRIF as fully withdrawn (100% taxable). 
                    Non-registered investments trigger capital gains on unrealized profits.
                </p>
                <div class="dd-stat-row">
                    <span>RRSP/RRIF deemed disposition</span>
                    <span>${fmtK(lastYear.rrsp || 0)} at full income tax</span>
                </div>
                <div class="dd-stat-row">
                    <span>Non-reg capital gains</span>
                    <span>~${fmtK((lastYear.nonReg || 0) * 0.25)} (50% of value × 50% inclusion)</span>
                </div>
                <div class="dd-stat-row highlight">
                    <span>Total estate tax</span>
                    <span>${fmt(estateTax)}</span>
                </div>
                <p class="dd-text muted">
                    💡 To reduce this: melt down RRSP in retirement (pay tax at lower rates now), 
                    or use TFSA (no deemed disposition).
                </p>
            </div>`;
        }
        html += `</div>`;

        // ═══ 5. RISK FACTORS ═══
        html += `<div class="dd-section">
            <h3 class="dd-section-title">⚠️ What Could Change</h3>
            <div class="dd-risks">`;

        const buffer = legacyAmount;
        const annualSpending = inputs.annualSpending || 50000;
        const bufferYears = annualSpending > 0 ? (buffer / annualSpending).toFixed(1) : '∞';

        html += `<div class="dd-risk-item">
            <div class="dd-risk-title">📉 Market Returns</div>
            <div class="dd-risk-body">This plan assumes ${inputs.returnRate || 6}% annual returns. A 2% lower return could deplete your portfolio ${Math.round(buffer / annualSpending * 0.4) || 3}-5 years earlier. Your ${fmtK(buffer)} buffer = ~${bufferYears} years of spending cushion.</div>
        </div>`;

        html += `<div class="dd-risk-item">
            <div class="dd-risk-title">📈 Inflation</div>
            <div class="dd-risk-body">Assumes ${inputs.inflationRate || 2.5}% inflation. Your ${fmt(annualSpending)}/yr spending costs ${fmt(annualSpending * Math.pow(1 + (inputs.inflationRate || 2.5)/100, 20))} in 20 years. CPI-indexed tax brackets help, but healthcare inflates faster (~5%).</div>
        </div>`;

        html += `<div class="dd-risk-item">
            <div class="dd-risk-title">🎂 Longevity</div>
            <div class="dd-risk-body">Plan runs to age ${lifeExp}. If you live to ${lifeExp + 5}, you need ${fmt(annualSpending * 5)} more — ${buffer > annualSpending * 5 ? 'your estate buffer covers this' : 'consider annuity or lower spending'}. CPP/OAS continue for life regardless.</div>
        </div>`;

        if (inputs.healthStatus === 'fair' || (inputs.ltcMonthly || 0) > 0) {
            html += `<div class="dd-risk-item">
                <div class="dd-risk-title">🏥 Healthcare</div>
                <div class="dd-risk-body">Healthcare costs rise ~5%/yr vs 2.5% general inflation. ${inputs.ltcMonthly > 0 ? `Your LTC budget (${fmt(inputs.ltcMonthly * 12)}/yr from age ${inputs.ltcStartAge}) is included.` : 'Consider budgeting for long-term care ($5-10K/month) after age 80.'}</div>
            </div>`;
        }
        html += `</div></div>`;

        // ═══ 6. ACTION ITEMS ═══
        html += `<div class="dd-section">
            <h3 class="dd-section-title">✅ Action Items</h3>
            <div class="dd-actions">`;

        const yearsToRet = retAge - currentAge;

        // Now actions
        html += `<div class="dd-action-group">
            <div class="dd-action-period">📌 Now (Age ${currentAge})</div>`;
        
        if (inputs.monthlyContribution > 0) {
            const split = inputs.contributionSplit || {};
            html += `<div class="dd-action">Save ${fmt(inputs.monthlyContribution)}/mo: ${Math.round((split.rrsp||0)*100)}% RRSP / ${Math.round((split.tfsa||0)*100)}% TFSA / ${Math.round((split.nonReg||0)*100)}% Non-Reg</div>`;
        }
        if (inputs.currentDebt > 0) {
            html += `<div class="dd-action">Pay off ${fmt(inputs.currentDebt)} in debt by age ${inputs.debtPayoffAge || retAge}</div>`;
        }
        html += `<div class="dd-action">Max out TFSA room ($7,000/yr in 2025) — it's the most flexible account</div>`;
        html += `<div class="dd-action">Check My Service Canada for your actual CPP estimate</div>`;
        html += `</div>`;

        // Pre-retirement actions
        if (yearsToRet > 5) {
            html += `<div class="dd-action-group">
                <div class="dd-action-period">🔜 5 Years Before Retirement (Age ${retAge - 5})</div>
                <div class="dd-action">Start building 2-3 years of cash/GICs for market downturns</div>
                <div class="dd-action">Consider gradually shifting to more conservative investments</div>
                <div class="dd-action">Model different retirement dates — each year earlier costs ~${fmtK(annualSpending)}</div>
            </div>`;
        }

        // At retirement
        html += `<div class="dd-action-group">
            <div class="dd-action-period">🏖️ At Retirement (Age ${retAge})</div>
            <div class="dd-action">Stop contributions, begin withdrawal strategy</div>`;
        if (rrspAtRet > 200000 && retAge < 71) {
            html += `<div class="dd-action">Start RRSP meltdown: convert ${fmtK(Math.min(55000, rrspAtRet * 0.05))}/yr to stay in the lowest bracket</div>`;
        }
        if (cppStartYear && cppStartYear.age > retAge) {
            html += `<div class="dd-action">Wait on CPP until age ${cppStartYear.age} — use portfolio to bridge the gap</div>`;
        }
        html += `</div>`;

        // At 65
        if (retAge < 65) {
            html += `<div class="dd-action-group">
                <div class="dd-action-period">🎂 Age 65</div>
                <div class="dd-action">Apply for OAS (starts automatically if registered)</div>
                <div class="dd-action">Age Amount credit kicks in — saves ~$1,300/yr federal</div>
                <div class="dd-action">Pension Income Credit available on RRIF/pension income — saves ~$300/yr</div>
            </div>`;
        }

        // At 71
        html += `<div class="dd-action-group">
            <div class="dd-action-period">🔄 Age 71</div>
            <div class="dd-action">RRSP must convert to RRIF — mandatory minimum withdrawals begin</div>
            <div class="dd-action">RRIF balance at 71: ~${fmtK(years.find(y => y.age === 71)?.rrsp || rrspAtRet * 0.7)}</div>
            <div class="dd-action">First year minimum: 5.28% of balance — this is forced taxable income</div>
        </div>`;

        html += `</div></div>`;

        // ═══ 7. KEY NUMBERS AT A GLANCE ═══
        html += `<div class="dd-section">
            <h3 class="dd-section-title">🔢 Key Numbers</h3>
            <div class="dd-key-numbers">`;

        const keyNums = [
            ['Years saving', `${retAge - currentAge}`],
            ['Years in retirement', `${retYears}`],
            ['Total contributions', fmtK(accum.reduce((s, y) => s + (y.contribution || 0), 0))],
            ['Portfolio at retirement', fmtK(portfolioAtRet)],
            ['Total withdrawals', fmtK(totalWithdrawals)],
            ['Total gov benefits', fmtK(totalGovBenefits)],
            ['Total income tax paid', fmtK(totalTaxPaid)],
            ['Average tax rate', pct(totalTaxPaid / (totalWithdrawals + totalGovBenefits || 1))],
            ['Estate tax at death', fmt(estateTax)],
            ['Net to heirs', fmtK(legacyAmount - estateTax)]
        ];

        for (const [label, value] of keyNums) {
            html += `<div class="dd-key-row"><span>${label}</span><span>${value}</span></div>`;
        }
        html += `</div></div>`;

        return html;
    },

    _timelineItem(startAge, endAge, title, description, type) {
        const range = startAge === endAge ? `Age ${startAge}` : `Ages ${startAge}-${endAge}`;
        return `
            <div class="dd-timeline-item dd-timeline-${type}">
                <div class="dd-timeline-marker"></div>
                <div class="dd-timeline-content">
                    <div class="dd-timeline-range">${range}</div>
                    <div class="dd-timeline-title">${title}</div>
                    <div class="dd-timeline-desc">${description}</div>
                </div>
            </div>`;
    },

    /**
     * Show deep dive in a modal/panel
     */
    show(results, inputs, strategyLabel) {
        const html = this.generate(results, inputs, strategyLabel);
        let panel = document.getElementById('deep-dive-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'deep-dive-panel';
            panel.className = 'deep-dive-overlay';
            document.body.appendChild(panel);
        }
        panel.innerHTML = `
            <div class="deep-dive-content">
                <div class="dd-header">
                    <h2>📋 Deep Dive: ${strategyLabel || 'Your Plan'}</h2>
                    <button type="button" class="dd-close" id="dd-close">✕</button>
                </div>
                <div class="dd-body">${html}</div>
            </div>
        `;
        panel.classList.remove('hidden');
        document.getElementById('dd-close')?.addEventListener('click', () => {
            panel.classList.add('hidden');
        });
        // Close on backdrop click
        panel.addEventListener('click', (e) => {
            if (e.target === panel) panel.classList.add('hidden');
        });
    }
};

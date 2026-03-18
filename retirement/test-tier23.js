const fs = require('fs');
const fn = new Function(
    fs.readFileSync('canada-tax.js','utf8')+'\n'+
    fs.readFileSync('cpp-calculator.js','utf8')+'\n'+
    fs.readFileSync('cpp-optimizer.js','utf8')+'\n'+
    fs.readFileSync('healthcare-estimator.js','utf8')+'\n'+
    fs.readFileSync('calc.js','utf8')+
    '\nreturn{RetirementCalcV4, CanadianTax, HealthcareEstimator};'
);
const {RetirementCalcV4, CanadianTax, HealthcareEstimator} = fn();

let pass = 0, fail = 0;
function assert(cond, msg) {
    if (cond) { pass++; console.log('  ✅ ' + msg); }
    else { fail++; console.log('  ❌ ' + msg); }
}

const base = {
    currentAge:35, retirementAge:65, lifeExpectancy:90, annualSpending:48000,
    currentIncome:70000, income1:70000, income2:0,
    rrsp:30000, tfsa:15000, nonReg:5000, lira:0, other:0,
    monthlyContribution:600, contributionSplit:{rrsp:0.5,tfsa:0.3,nonReg:0.2},
    contributionGrowthRate:0, returnRate:5.5, inflationRate:2.5,
    province:'ON', cppStartAge:65, oasStartAge:65,
    spendingCurve:'flat', windfalls:[], additionalIncomeSources:[],
    employerPension:0, employerPensionStartAge:65, employerPensionIndexed:true,
    healthStatus:'average', currentDebt:0, debtPayoffAge:65, merFee:0,
    familyStatus:'single', _withdrawalStrategy:'smart'
};

console.log('\n📊 1. Ontario Health Premium');
{
    const t15 = CanadianTax.calculateTax(15000, 'ON');
    assert(t15.ontarioHealthPremium === 0, 'OHP $0 at $15K income');
    
    const t22 = CanadianTax.calculateTax(22000, 'ON');
    assert(Math.abs(t22.ontarioHealthPremium - 120) < 1, 'OHP $120 at $22K');
    
    const t50 = CanadianTax.calculateTax(50000, 'ON');
    assert(t50.ontarioHealthPremium > 600, 'OHP >$600 at $50K');
    
    const t250 = CanadianTax.calculateTax(250000, 'ON');
    assert(t250.ontarioHealthPremium === 900, 'OHP capped at $900');
    
    const tBC = CanadianTax.calculateTax(80000, 'BC');
    assert(tBC.ontarioHealthPremium === 0, 'No OHP for BC');
    
    // OHP adds to total
    assert(t50.total > t50.federal + t50.provincial, 'OHP included in total tax');
}

console.log('\n📊 2. Disability Tax Credit');
{
    const noDTC = CanadianTax.calculateTax(60000, 'ON');
    const withDTC = CanadianTax.calculateTax(60000, 'ON', {dtc: true});
    const savings = noDTC.total - withDTC.total;
    assert(savings > 1500 && savings < 2500, `DTC saves $${Math.round(savings)}/yr (~$1,900 expected)`);
    
    // DTC can't make tax negative
    const lowDTC = CanadianTax.calculateTax(5000, 'ON', {dtc: true});
    assert(lowDTC.federal >= 0 && lowDTC.provincial >= 0, 'DTC floors at $0');
    
    // DTC in calc engine
    const rNoDTC = RetirementCalcV4.calculate({...base});
    const rDTC = RetirementCalcV4.calculate({...base, dtc: true});
    assert(rDTC.summary.moneyLastsAge >= rNoDTC.summary.moneyLastsAge, 'DTC extends plan or keeps same');
}

console.log('\n📊 3. Rental Income');
{
    const rNoRental = RetirementCalcV4.calculate({...base, annualSpending: 30000});
    const rRental = RetirementCalcV4.calculate({...base, annualSpending: 30000, rentalIncome: 1000});
    // $1K/mo rental = $12K/yr extra income
    assert(rRental.summary.moneyLastsAge >= rNoRental.summary.moneyLastsAge, 'Rental income extends plan');
    
    const y70 = rRental.yearByYear.find(y => y.age === 70);
    assert(y70 && y70.rentalIncome > 12000, 'Rental income inflated above $12K at age 70');
    
    // Rental is taxable — should appear in income
    assert(y70.afterTaxIncome > rNoRental.yearByYear.find(y => y.age === 70).afterTaxIncome, 'Rental adds to after-tax income');
}

console.log('\n📊 4. Healthcare Inflation');
{
    const hcLow = HealthcareEstimator.projectTotal(65, 90, 'ON', 'average', 0.02);
    const hcHigh = HealthcareEstimator.projectTotal(65, 90, 'ON', 'average', 0.08);
    assert(hcHigh.total > hcLow.total * 1.5, 'Higher HC inflation = much higher total costs');
    
    // At age 85 (20 years in), 8% compounds to 4.66x vs 2% at 1.49x
    const cost85Low = hcLow.byYear.find(y => y.age === 85).cost;
    const cost85High = hcHigh.byYear.find(y => y.age === 85).cost;
    assert(cost85High > cost85Low * 2, '8% HC inflation > 2x of 2% at age 85');
    
    const rLowInf = RetirementCalcV4.calculate({...base, healthcareInflation: 2});
    const rHighInf = RetirementCalcV4.calculate({...base, healthcareInflation: 8});
    assert(rHighInf.summary.moneyLastsAge <= rLowInf.summary.moneyLastsAge, 'Higher HC inflation = earlier depletion');
}

console.log('\n📊 5. Long-Term Care');
{
    const hcNoLTC = HealthcareEstimator.projectTotal(65, 90, 'ON', 'average', 0.05, null);
    const hcLTC = HealthcareEstimator.projectTotal(65, 90, 'ON', 'average', 0.05, {monthlyAmount: 5000, startAge: 80});
    assert(hcLTC.total > hcNoLTC.total + 500000, 'LTC adds >$500K over retirement');
    
    // LTC only starts at startAge
    const pre80 = hcLTC.byYear.find(y => y.age === 79);
    const at80 = hcLTC.byYear.find(y => y.age === 80);
    assert(pre80.ltcCost === 0, 'No LTC before start age');
    assert(at80.ltcCost > 50000, 'LTC kicks in at start age');
    
    const rNoLTC = RetirementCalcV4.calculate({...base, currentAge: 40, annualSpending: 45000, rrsp: 80000, tfsa: 40000, nonReg: 10000});
    const rLTC = RetirementCalcV4.calculate({...base, currentAge: 40, annualSpending: 45000, rrsp: 80000, tfsa: 40000, nonReg: 10000, ltcMonthly: 5000, ltcStartAge: 80});
    assert(rLTC.summary.moneyLastsAge <= rNoLTC.summary.moneyLastsAge, 'LTC costs shorten or equal plan');
}

console.log('\n📊 6. OAS Clawback Visibility');
{
    // High income = OAS clawback
    const r = RetirementCalcV4.calculate({...base, rrsp: 800000, tfsa: 200000, annualSpending: 80000});
    const clawbackYears = r.yearByYear.filter(y => y.oasClawback > 0);
    // With $800K RRSP, RRSP meltdown creates taxable income above clawback threshold
    const y67 = r.yearByYear.find(y => y.age === 67);
    assert(y67 && y67.oasBeforeClawback !== undefined, 'oasBeforeClawback tracked');
    assert(y67 && y67.oasClawback !== undefined, 'oasClawback tracked');
}

console.log('\n📊 7. Annuity');
{
    const rNoAnnuity = RetirementCalcV4.calculate({...base, annualSpending: 35000});
    const rAnnuity = RetirementCalcV4.calculate({...base, annualSpending: 35000, 
        annuityLumpSum: 100000, annuityPurchaseAge: 70, annuityMonthlyPayout: 600});
    
    // At purchase age, portfolio drops
    const pre70 = rAnnuity.yearByYear.find(y => y.age === 69);
    const at70 = rAnnuity.yearByYear.find(y => y.age === 70);
    // Portfolio should be lower at 70 due to lump sum withdrawal
    
    // After purchase, annuity payout shows
    assert(at70 && at70.annuityIncome > 0, 'Annuity payout shows after purchase age');
    
    const pre70NoA = rNoAnnuity.yearByYear.find(y => y.age === 69);
    const at70NoA = rNoAnnuity.yearByYear.find(y => y.age === 70);
    // With annuity, total balance at 70 should be lower (lump sum taken out)
    if (at70 && at70NoA) {
        assert(at70.totalBalance < at70NoA.totalBalance, 'Annuity lump sum reduces portfolio');
    }
}

console.log('\n📊 8. Downsizing');
{
    const rNoDwn = RetirementCalcV4.calculate({...base, annualSpending: 35000});
    const rDwn = RetirementCalcV4.calculate({...base, annualSpending: 35000,
        downsizingAge: 70, downsizingProceeds: 300000, downsizingSpendingChange: -500});
    
    // Portfolio should jump at age 70
    const at70Dwn = rDwn.yearByYear.find(y => y.age === 70);
    const at70No = rNoDwn.yearByYear.find(y => y.age === 70);
    assert(at70Dwn.totalBalance > at70No.totalBalance + 200000, 'Downsizing adds proceeds to portfolio');
    
    // Spending should be lower after downsizing ($500/mo = $6K/yr savings)
    assert(rDwn.summary.moneyLastsAge >= rNoDwn.summary.moneyLastsAge, 'Downsizing extends plan');
}

console.log('\n📊 9. Estate Tax at Death');
{
    // Big RRSP = big estate tax
    const r = RetirementCalcV4.calculate({...base, rrsp: 500000, tfsa: 200000, annualSpending: 30000});
    assert(r.legacy.estateTax !== undefined, 'Estate tax calculated');
    assert(r.legacy.netEstate !== undefined, 'Net estate calculated');
    
    if (r.legacy.amount > 0) {
        assert(r.legacy.estateTax >= 0, 'Estate tax is non-negative');
        assert(r.legacy.netEstate <= r.legacy.amount, 'Net estate <= gross estate');
        assert(r.legacy.netEstate >= 0, 'Net estate non-negative');
        if (r.yearByYear[r.yearByYear.length-1].rrsp > 10000) {
            assert(r.legacy.estateTax > 0, 'Estate tax > $0 when RRSP balance remains');
        }
    }
}

console.log('\n📊 10. Category Inflation');
{
    const rGeneral = RetirementCalcV4.calculate({...base});
    const rHighHousing = RetirementCalcV4.calculate({...base, 
        categoryInflation: {housing: 6, food: 3, healthcare: 5, discretionary: 2}});
    // Higher housing inflation (30% weight at 6% vs 2.5%) should deplete faster
    assert(rHighHousing.summary.moneyLastsAge <= rGeneral.summary.moneyLastsAge, 'Higher housing inflation = earlier depletion');
}

console.log('\n📊 11. Spouse Allowance');
{
    // Couple where partner is younger (60-64 range during retirement)
    const r = RetirementCalcV4.calculate({...base, 
        familyStatus: 'couple', partnerAge: 30, // 5 years younger, will be 60 when primary is 65
        income2: 0, annualSpending: 30000
    });
    const allowanceYears = r.yearByYear.filter(y => (y.spouseAllowance || 0) > 0);
    // Partner turns 60 when primary is 65, allowance for ages 60-64
    assert(r.yearByYear.some(y => y.spouseAllowance !== undefined), 'Spouse allowance field exists');
}

console.log('\n📊 12. Contribution Split Optimization');
{
    const t1 = Date.now();
    const opt = RetirementCalcV4.optimizePlan({...base, monthlyContribution: 1000});
    const elapsed = Date.now() - t1;
    assert(elapsed < 2000, `Optimizer completes in ${elapsed}ms (<2s)`);
    assert(opt.params.contributionSplit !== undefined, 'Optimizer returns contribution split');
    assert(opt.params.contributionSplit.rrsp + opt.params.contributionSplit.tfsa + opt.params.contributionSplit.nonReg > 0.95, 'Split sums to ~1.0');
}

console.log('\n📊 13. Monotonicity with all features');
{
    let prev = 999, ok = true;
    for (let s = 20000; s <= 120000; s += 5000) {
        const r = RetirementCalcV4.calculate({...base, annualSpending: s,
            rentalIncome: 500, healthcareInflation: 5, ltcMonthly: 3000, ltcStartAge: 82,
            dtc: true, downsizingAge: 72, downsizingProceeds: 200000, downsizingSpendingChange: -500,
            categoryInflation: {housing: 3, food: 3, healthcare: 5, discretionary: 2}
        });
        if (r.summary.moneyLastsAge > prev) { ok = false; break; }
        prev = r.summary.moneyLastsAge;
    }
    assert(ok, 'Monotonic with all features enabled');
}

console.log('\n══════════════════════════════════════════');
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) console.log('❌ FAILURES DETECTED');
else console.log('✅ ALL TIER 2/3 TESTS PASSED');

const fs = require('fs');
const scripts = ['canada-tax.js','cpp-calculator.js','cpp-optimizer.js','healthcare-estimator.js','income-sources.js','calc.js','monte-carlo.js'];
for (const s of scripts) { try { let code = fs.readFileSync(s, 'utf8').replace(/^const /gm, 'var '); eval(code); } catch(e) { console.log(`${s}: ${e.message}`); } }

// Try to match the screenshots: $458K at retirement, $7.8M legacy
// User age 31, retirement 65, $60K spending
const inputs = {
    currentAge: 31, partnerAge: 31, retirementAge: 65, lifeExpectancy: 90,
    province: 'ON', familyStatus: 'single',
    currentIncome: 80000, income1: 80000, income2: 0,
    rrsp: 40000, tfsa: 5000, nonReg: 5000, other: 0,
    monthlyContribution: 100,
    contributionSplit: { rrsp: 1.0, tfsa: 0.0, nonReg: 0.0 },
    annualSpending: 60000, healthStatus: 'average',
    currentDebt: 0, debtPayoffAge: 65,
    cppStartAge: 65, oasStartAge: 65,
    additionalIncomeSources: [], windfalls: [],
    returnRate: 6, inflationRate: 2.5, contributionGrowthRate: 0
};

const r = RetirementCalcV4.calculate(inputs);
console.log('=== Trying to reproduce screenshots ===');
console.log('Portfolio at retirement:', r.summary.portfolioAtRetirement);
console.log('Annual income:', r.summary.annualIncomeAtRetirement);
console.log('Money lasts:', r.summary.moneyLastsAge);
console.log('Legacy:', r.summary.legacyAmount);
console.log('Probability:', r.probability);

// Show first retirement year breakdown
const first = r.yearByYear.find(y => y.age === 65);
if (first) {
    console.log('\nFirst retirement year:');
    console.log('  Balance:', first.totalBalance);
    console.log('  RRSP:', first.rrsp, 'TFSA:', first.tfsa, 'NonReg:', first.nonReg);
    console.log('  Withdrawal:', first.withdrawal);
    console.log('  Breakdown:', JSON.stringify(first.withdrawalBreakdown));
    console.log('  Gov:', first.governmentIncome, 'CPP:', first.cppReceived, 'OAS:', first.oasReceived);
    console.log('  Target spending:', first.targetSpending);
    console.log('  Tax:', first.taxPaid);
}

// Show some retirement years
[70, 75, 80, 85, 90].forEach(age => {
    const y = r.yearByYear.find(p => p.age === age);
    if (y) console.log(`Age ${age}: bal=${Math.round(y.totalBalance)} w=${y.withdrawal} gov=${y.governmentIncome} target=${y.targetSpending}`);
});

// Now test spending optimizer: what max spending lasts to 90?
let low = 10000, high = 180000, maxSust = 60000;
for (let i = 0; i < 20; i++) {
    const test = Math.round((low + high) / 2);
    const tr = RetirementCalcV4.calculate({...inputs, annualSpending: test});
    if (tr.summary.moneyLastsAge >= 90) { maxSust = test; low = test; }
    else { high = test; }
    if (high - low < 1000) break;
}
console.log('\nMax sustainable spending:', maxSust);

// MC
const mc = MonteCarloSimulator.simulate(inputs, { iterations: 500, volatility: 0.11, marketCrashProbability: 0.04 });
console.log('MC success:', mc.successRate + '%');
console.log('MC p50 final:', mc.finalBalance.p50);
console.log('MC p10 final:', mc.finalBalance.p10);

const fs = require('fs');
const scripts = ['canada-tax.js','cpp-calculator.js','cpp-optimizer.js','healthcare-estimator.js','income-sources.js','calc.js','monte-carlo.js'];
for (const s of scripts) { try { let code = fs.readFileSync(s, 'utf8').replace(/^const /gm, 'var '); eval(code); } catch(e) { console.log(`${s}: ${e.message}`); } }

// Test 1: Without windfalls - should be unchanged
const baseInputs = {
    currentAge: 31, partnerAge: 31, retirementAge: 65, lifeExpectancy: 90,
    province: 'ON', familyStatus: 'single',
    currentIncome: 80000, income1: 80000, income2: 0,
    rrsp: 30000, tfsa: 0, nonReg: 0, other: 0,
    monthlyContribution: 200,
    contributionSplit: { rrsp: 1.0, tfsa: 0.0, nonReg: 0.0 },
    annualSpending: 60000, healthStatus: 'average',
    currentDebt: 0, debtPayoffAge: 65,
    cppStartAge: 65, oasStartAge: 65,
    additionalIncomeSources: [], windfalls: [],
    returnRate: 6, inflationRate: 2.5, contributionGrowthRate: 0
};

const r1 = RetirementCalcV4.calculate(baseInputs);
console.log('TEST 1 - No windfalls:');
console.log('  Portfolio at ret:', r1.summary.portfolioAtRetirement);
console.log('  Legacy:', r1.summary.legacyAmount);
console.log('  Lasts:', r1.summary.moneyLastsAge);

// Test 2: With $800K house sale windfall at 65
const wfInputs = {
    ...baseInputs,
    windfalls: [{
        name: 'House Sale', amount: 800000, year: 65,
        probability: 100, taxable: false, destination: 'nonReg'
    }]
};

const r2 = RetirementCalcV4.calculate(wfInputs);
console.log('\nTEST 2 - With $800K windfall (calc.js only, no double-count):');
console.log('  Portfolio at ret:', r2.summary.portfolioAtRetirement);
console.log('  Legacy:', r2.summary.legacyAmount);
console.log('  Lasts:', r2.summary.moneyLastsAge);

// Verify windfall appears in projection
const wfYear = r2.yearByYear.find(y => y.age === 65);
console.log('  Age 65 balance:', wfYear?.totalBalance, 'NonReg:', wfYear?.nonReg);

// Test 3: MC should roughly agree with deterministic
const mc = MonteCarloSimulator.simulate(wfInputs, { iterations: 500, volatility: 0.11, marketCrashProbability: 0.04 });
console.log('\nTEST 3 - MC with windfall:');
console.log('  Success:', mc.successRate + '%');
console.log('  P50 final:', mc.finalBalance.p50);
console.log('  P50 portfolio at ret:', mc.portfolioAtRetirement.p50);

// Test 4: Brody's typical inputs
const brodyInputs = {
    currentAge: 31, partnerAge: 31, retirementAge: 60, lifeExpectancy: 90,
    province: 'ON', familyStatus: 'single',
    currentIncome: 80000, income1: 80000, income2: 0,
    rrsp: 200000, tfsa: 150000, nonReg: 100000, other: 50000,
    monthlyContribution: 5000,
    contributionSplit: { rrsp: 0.4, tfsa: 0.3, nonReg: 0.3 },
    annualSpending: 60000, healthStatus: 'average',
    currentDebt: 0, debtPayoffAge: 60,
    cppStartAge: 65, oasStartAge: 65,
    additionalIncomeSources: [], windfalls: [],
    returnRate: 6, inflationRate: 2.5, contributionGrowthRate: 0
};

const r4 = RetirementCalcV4.calculate(brodyInputs);
const mc4 = MonteCarloSimulator.simulate(brodyInputs, { iterations: 500, volatility: 0.11, marketCrashProbability: 0.04 });
console.log('\nTEST 4 - Brody profile ($500K start, $5K/mo):');
console.log('  Det: port=$' + r4.summary.portfolioAtRetirement + ' legacy=$' + r4.summary.legacyAmount + ' lasts=' + r4.summary.moneyLastsAge);
console.log('  MC: ' + mc4.successRate + '% success, p50=$' + mc4.finalBalance.p50);

console.log('\n✅ All tests complete');

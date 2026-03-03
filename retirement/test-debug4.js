const fs = require('fs');
const scripts = ['canada-tax.js','cpp-calculator.js','cpp-optimizer.js','healthcare-estimator.js','income-sources.js','calc.js','monte-carlo.js'];
for (const s of scripts) { try { let code = fs.readFileSync(s, 'utf8').replace(/^const /gm, 'var '); eval(code); } catch(e) { console.log(`${s}: ${e.message}`); } }

// The screenshots show retirement at age 65 (withdrawal section says "First Year of Retirement (Age 65)")
// RRSP $36,993 withdrawal, TFSA $0, Non-Reg $0
// Portfolio at retirement: $458,065
// Annual income: $74,383
// Legacy: $7,791,576
// MC: 69% success

// If TFSA=$0 and NonReg=$0 at retirement, all savings are in RRSP
// $36,993 from RRSP, gov income ~$37K (to make $74K total)
// But at age 65, CPP base is ~$17K and OAS ~$8.5K = $25.5K. Not $37K.
// Unless couple mode or high income

// Let me try different configs to match $458K portfolio
// and $74K income

// Try: age 31, ret 65, couple with $80K each
const configs = [
    { label: 'Single $80K, low savings', currentIncome: 80000, income1: 80000, income2: 0, familyStatus: 'single',
      rrsp: 30000, tfsa: 0, nonReg: 0, other: 0, monthly: 200 },
    { label: 'Single $100K', currentIncome: 100000, income1: 100000, income2: 0, familyStatus: 'single',
      rrsp: 50000, tfsa: 0, nonReg: 0, other: 0, monthly: 100 },
    { label: 'Single $80K, $0 start', currentIncome: 80000, income1: 80000, income2: 0, familyStatus: 'single',
      rrsp: 0, tfsa: 0, nonReg: 0, other: 0, monthly: 350 },
];

for (const c of configs) {
    const inputs = {
        currentAge: 31, partnerAge: 31, retirementAge: 65, lifeExpectancy: 90,
        province: 'ON', familyStatus: c.familyStatus,
        currentIncome: c.currentIncome, income1: c.income1, income2: c.income2,
        rrsp: c.rrsp, tfsa: 0, nonReg: 0, other: 0,
        monthlyContribution: c.monthly,
        contributionSplit: { rrsp: 1.0, tfsa: 0.0, nonReg: 0.0 },
        annualSpending: 60000, healthStatus: 'average',
        currentDebt: 0, debtPayoffAge: 65,
        cppStartAge: 65, oasStartAge: 65,
        additionalIncomeSources: [], windfalls: [],
        returnRate: 6, inflationRate: 2.5, contributionGrowthRate: 0
    };
    const r = RetirementCalcV4.calculate(inputs);
    const first = r.yearByYear.find(y => y.age === 65);
    console.log(`\n${c.label}: port=$${r.summary.portfolioAtRetirement} income=$${r.summary.annualIncomeAtRetirement} legacy=$${r.summary.legacyAmount} lasts=${r.summary.moneyLastsAge}`);
    if (first) console.log(`  First yr: w=${first.withdrawal} rrsp=${first.withdrawalBreakdown?.rrsp} gov=${first.governmentIncome} target=${first.targetSpending}`);
}

// KEY TEST: What if the user has a windfall that gets double-counted?
console.log('\n=== WINDFALL DOUBLE-COUNT TEST ===');
const inputs_wf = {
    currentAge: 31, partnerAge: 31, retirementAge: 65, lifeExpectancy: 90,
    province: 'ON', familyStatus: 'single',
    currentIncome: 80000, income1: 80000, income2: 0,
    rrsp: 30000, tfsa: 0, nonReg: 0, other: 0,
    monthlyContribution: 200,
    contributionSplit: { rrsp: 1.0, tfsa: 0.0, nonReg: 0.0 },
    annualSpending: 60000, healthStatus: 'average',
    currentDebt: 0, debtPayoffAge: 65,
    cppStartAge: 65, oasStartAge: 65,
    additionalIncomeSources: [],
    windfalls: [{
        name: 'House Sale', amount: 800000, year: 65,
        probability: 100, taxable: false, destination: 'nonReg'
    }],
    returnRate: 6, inflationRate: 2.5, contributionGrowthRate: 0
};
const r_wf = RetirementCalcV4.calculate(inputs_wf);
console.log('WITH windfall (calc.js processes it):');
console.log('  Portfolio at ret:', r_wf.summary.portfolioAtRetirement);
console.log('  Legacy:', r_wf.summary.legacyAmount);
console.log('  Lasts:', r_wf.summary.moneyLastsAge);
const first_wf = r_wf.yearByYear.find(y => y.age === 65);
if (first_wf) console.log('  Age 65 balance:', first_wf.totalBalance, 'NonReg:', first_wf.nonReg);

// Now simulate what _applyWindfallsToResults would do (double count)
const r_wf2 = RetirementCalcV4.calculate(inputs_wf);
// Mimic _applyWindfallsToResults
const windfall = inputs_wf.windfalls[0];
const targetAge = windfall.year;
const yearIndex = r_wf2.yearByYear.findIndex(y => y.age === targetAge);
const afterTaxAmount = windfall.amount; // non-taxable
console.log('\nAfter double-counting (_applyWindfallsToResults):');
for (let i = yearIndex; i < r_wf2.yearByYear.length; i++) {
    const year = r_wf2.yearByYear[i];
    const yearsFromWindfall = i - yearIndex;
    const grownAmount = afterTaxAmount * Math.pow(1.06, yearsFromWindfall);
    year.nonReg = (year.nonReg || 0) + grownAmount;
    year.totalBalance = (year.rrsp || 0) + (year.tfsa || 0) + (year.nonReg || 0) + (year.other || 0);
}
const lastYear = r_wf2.yearByYear[r_wf2.yearByYear.length - 1];
console.log('  Legacy (double-counted):', Math.round(lastYear.totalBalance));
console.log('  Portfolio at ret:', r_wf2.yearByYear.find(y => y.age === 65)?.totalBalance);

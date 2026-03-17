const fs = require('fs');
const taxCode = fs.readFileSync('canada-tax.js', 'utf8');
const cppCode = fs.readFileSync('cpp-calculator.js', 'utf8');
const cppOptCode = fs.readFileSync('cpp-optimizer.js', 'utf8');
const healthCode = fs.readFileSync('healthcare-estimator.js', 'utf8');
const calcCode = fs.readFileSync('calc.js', 'utf8');
const fn = new Function(taxCode + '\n' + cppCode + '\n' + cppOptCode + '\n' + healthCode + '\n' + calcCode + '\nreturn { CanadianTax, RetirementCalcV4 };');
const { CanadianTax, RetirementCalcV4 } = fn();

// Try to match screenshot: portfolio $603,770 at 65, CPP@70, OAS@70
// Trying different current ages/savings to hit ~$604K at 65
const inputs = {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualSpending: 48000,
    currentIncome: 70000,
    income1: 70000,
    income2: 0,
    rrsp: 30000,
    tfsa: 15000,
    nonReg: 5000,
    lira: 0,
    other: 0,
    monthlyContribution: 600,
    contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 },
    contributionGrowthRate: 0,
    returnRate: 5.5,
    inflationRate: 2.5,
    province: 'ON',
    cppStartAge: 70,
    oasStartAge: 70,
    spendingCurve: 'flat',
    windfalls: [],
    additionalIncomeSources: [],
    employerPension: 0,
    employerPensionStartAge: 65,
    employerPensionIndexed: true,
    healthStatus: 'average',
    currentDebt: 0,
    debtPayoffAge: 65,
    merFee: 0,
    familyStatus: 'single',
    _withdrawalStrategy: 'smart'
};

const r = RetirementCalcV4.calculate(inputs);
console.log('Portfolio at retirement:', r.summary.portfolioAtRetirement);
console.log('Money lasts to:', r.summary.moneyLastsAge);
console.log('Legacy:', r.summary.legacyAmount);

// Now binary search for max spending
let lo = 20000, hi = 48000 * 2.5;
for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const tr = RetirementCalcV4.calculate({ ...inputs, annualSpending: mid });
    if (tr.summary.moneyLastsAge >= 90) lo = mid; else hi = mid;
}
console.log('Binary search max:', Math.floor(lo / 1000) * 1000);

// Check consistency: at increasing spending levels, when does it fail?
console.log('\n=== SPENDING vs LASTS-TO ===');
for (let s = 30000; s <= 100000; s += 5000) {
    const tr = RetirementCalcV4.calculate({ ...inputs, annualSpending: s });
    console.log(`$${s}: lasts to ${tr.summary.moneyLastsAge}, legacy ${tr.summary.legacyAmount}`);
}

// Check if there's a non-monotonic pattern (higher spending lasting longer)
console.log('\n=== FINE GRAIN AROUND FAILURE ===');
const baseResult = RetirementCalcV4.calculate(inputs);
const baseLasts = baseResult.summary.moneyLastsAge;
if (baseLasts < 90) {
    // Try around the failure point
    for (let s = inputs.annualSpending - 5000; s <= inputs.annualSpending + 20000; s += 1000) {
        const tr = RetirementCalcV4.calculate({ ...inputs, annualSpending: s });
        console.log(`$${s}: lasts to ${tr.summary.moneyLastsAge}`);
    }
}

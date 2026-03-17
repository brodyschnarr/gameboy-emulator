// Test: why does "Lasts To" show 89 while "Max Spending" shows $70K?
// If $48K runs out at 89, $70K can't be the max.

// Load calc engine
const fs = require('fs');
const taxCode = fs.readFileSync('canada-tax.js', 'utf8');
const cppCode = fs.readFileSync('cpp-calculator.js', 'utf8');
const cppOptCode = fs.readFileSync('cpp-optimizer.js', 'utf8');
const healthCode = fs.readFileSync('healthcare-estimator.js', 'utf8');
const calcCode = fs.readFileSync('calc.js', 'utf8');
const fn = new Function(taxCode + '\n' + cppCode + '\n' + cppOptCode + '\n' + healthCode + '\n' + calcCode + '\nreturn { CanadianTax, RetirementCalcV4 };');
const { CanadianTax, RetirementCalcV4 } = fn();

// Approximate Brody's inputs from the screenshot:
// - Portfolio ~$603K at retirement (age 65)
// - CPP at 70, OAS at 70
// - Annual spending ~$48K
// - Life expectancy ~90

const inputs = {
    currentAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualSpending: 48000,
    currentSavings: 50000,
    rrspBalance: 40000,
    tfsaBalance: 10000,
    nonRegBalance: 0,
    otherBalance: 0,
    monthlyContribution: 800,
    contributionGrowthRate: 0.02,
    returnRate: 5.5,
    inflationRate: 2.5,
    province: 'ON',
    cppStartAge: 70,
    oasStartAge: 70,
    annualCPP: 16375,  // max CPP
    annualOAS: 8560,
    spendingCurve: 'flat',
    windfalls: [],
    _withdrawalStrategy: 'smart',
    contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 }
};

// Run main calculation
const results = RetirementCalcV4.calculate(inputs);
console.log('=== BASE CALCULATION (spending $48K) ===');
console.log('Money lasts to age:', results.summary.moneyLastsAge);
console.log('Portfolio at retirement:', results.summary.portfolioAtRetirement);
console.log('Legacy:', results.summary.legacyAmount);

// Binary search for max spending (same as strategy comparison)
let lo = 20000, hi = 48000 * 2.5;
for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const r = RetirementCalcV4.calculate({ ...inputs, annualSpending: mid });
    if (r.summary.moneyLastsAge >= 90) lo = mid; else hi = mid;
}
const maxSpend = Math.floor(lo / 1000) * 1000;
console.log('\n=== BINARY SEARCH MAX SPENDING ===');
console.log('Max sustainable:', maxSpend);

// Test at max spending
const maxResults = RetirementCalcV4.calculate({ ...inputs, annualSpending: maxSpend });
console.log('At max spending, lasts to:', maxResults.summary.moneyLastsAge);

// Now try different scenarios to reproduce the $70K bug
console.log('\n=== TESTING $70K ===');
const r70 = RetirementCalcV4.calculate({ ...inputs, annualSpending: 70000 });
console.log('At $70K, lasts to:', r70.summary.moneyLastsAge);

// Show year-by-year for last few years of retirement
console.log('\n=== LAST 5 YEARS OF $48K PLAN ===');
const retYears = results.yearByYear.filter(y => y.phase === 'retirement');
retYears.slice(-5).forEach(y => {
    console.log(`Age ${y.age}: balance=${Math.round(y.totalBalance)}, withdrawal=${Math.round(y.withdrawal||0)}, govt=${Math.round(y.governmentIncome||0)}, tax=${Math.round(y.taxPaid||0)}`);
});

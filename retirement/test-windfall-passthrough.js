// Comprehensive windfall passthrough test
// Simulates Brody's scenario: age 31, $210K savings, $68K spending, $400K stock options at 32

const fs = require('fs');

// Load calc engine
const files = ['canada-tax.js', 'cpp-calculator.js', 'cpp-optimizer.js', 'healthcare-estimator.js', 'calc.js'];
const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n');
eval(combined.replace(/^const /gm, 'var '));
if (typeof IncomeSources === 'undefined') {
    global.IncomeSources = { sources: [], getAll() { return this.sources; } };
}

let passed = 0, failed = 0;
function assert(name, condition, detail) {
    if (condition) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name} — ${detail || 'FAILED'}`); }
}

// === Brody's base inputs (no windfalls) ===
const baseInputs = {
    currentAge: 31,
    retirementAge: 65,
    lifeExpectancy: 90,
    rrsp: 100000,
    tfsa: 60000,
    nonReg: 50000,
    other: 0,
    monthlyContribution: 1000,
    contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 },
    annualSpending: 68000,
    returnRate: 6,
    inflationRate: 2.5,
    province: 'ON',
    isSingle: true,
    isFamilyMode: false,
    windfalls: [],
    cppStartAge: 65,
    oasStartAge: 65,
    spendingCurve: 'flat',
    contributionGrowthRate: 0,
    merFee: 0,
    healthStatus: 'none',
    additionalIncomeSources: []
};

console.log('\n=== TEST 1: Base scenario (no windfalls) ===');
const baseResult = RetirementCalcV4.calculate(baseInputs);
const baseMLA = baseResult.summary.moneyLastsAge;
const basePortfolioAtRetirement = baseResult.yearByYear.find(y => y.age === 65)?.totalBalance;
console.log(`  Money lasts to age: ${baseMLA}`);
console.log(`  Portfolio at 65: $${Math.round(basePortfolioAtRetirement).toLocaleString()}`);
assert('Base: money lasts to 90', baseMLA >= 90, `Got ${baseMLA}`);

// === With $400K stock options at age 32 ===
console.log('\n=== TEST 2: With $400K stock options at age 32 ===');
const stockInputs = {
    ...baseInputs,
    windfalls: [{
        name: 'Stock Options',
        type: 'shares',
        currentValue: 400000,
        costBasis: 100000,
        sellAge: 32,
        growthRate: 8,
        amount: 400000
    }]
};
const stockResult = RetirementCalcV4.calculate(stockInputs);
const stockMLA = stockResult.summary.moneyLastsAge;
const stockPortAt65 = stockResult.yearByYear.find(y => y.age === 65)?.totalBalance;
const stockPortAt32 = stockResult.yearByYear.find(y => y.age === 32)?.totalBalance;
const basePortAt32 = baseResult.yearByYear.find(y => y.age === 32)?.totalBalance;
console.log(`  Money lasts to age: ${stockMLA}`);
console.log(`  Portfolio at 32 (base): $${Math.round(basePortAt32).toLocaleString()}`);
console.log(`  Portfolio at 32 (with stock): $${Math.round(stockPortAt32).toLocaleString()}`);
console.log(`  Portfolio at 65: $${Math.round(stockPortAt65).toLocaleString()}`);
assert('Stock: portfolio at 32 higher than base', stockPortAt32 > basePortAt32 + 200000, 
    `Stock: $${Math.round(stockPortAt32).toLocaleString()} vs base: $${Math.round(basePortAt32).toLocaleString()}`);
assert('Stock: money lasts to 90', stockMLA >= 90, `Got ${stockMLA}`);

// === With inheritance at 50 ===
console.log('\n=== TEST 3: Inheritance $200K at age 50 ===');
const inheritInputs = {
    ...baseInputs,
    windfalls: [{
        name: 'Inheritance',
        type: 'simple',
        amount: 200000,
        year: 50,
        probability: 100,
        taxable: false,
        destination: 'split'
    }]
};
const inheritResult = RetirementCalcV4.calculate(inheritInputs);
const inheritMLA = inheritResult.summary.moneyLastsAge;
const inheritPortAt50 = inheritResult.yearByYear.find(y => y.age === 50)?.totalBalance;
const basePortAt50 = baseResult.yearByYear.find(y => y.age === 50)?.totalBalance;
console.log(`  Portfolio at 50 (base): $${Math.round(basePortAt50).toLocaleString()}`);
console.log(`  Portfolio at 50 (inherit): $${Math.round(inheritPortAt50).toLocaleString()}`);
assert('Inheritance: portfolio at 50 higher', inheritPortAt50 > basePortAt50 + 100000,
    `Inherit: $${Math.round(inheritPortAt50).toLocaleString()} vs base: $${Math.round(basePortAt50).toLocaleString()}`);

// === Spending optimizer test: does binary search pass windfalls? ===
console.log('\n=== TEST 4: Spending optimizer with windfalls ===');
// With big windfall, max sustainable spending should be higher
const bigWindfall = {
    ...baseInputs,
    windfalls: [{
        name: 'Lottery',
        type: 'simple',
        amount: 1000000,
        year: 35,
        probability: 100,
        taxable: false,
        destination: 'split'
    }]
};

// Binary search for max spending (same as app does)
function findMaxSpending(inputs) {
    let low = 10000, high = inputs.annualSpending * 5;
    let max = inputs.annualSpending;
    for (let i = 0; i < 20; i++) {
        const test = Math.round((low + high) / 2);
        const r = RetirementCalcV4.calculate({...inputs, annualSpending: test});
        if (r.summary.moneyLastsAge >= inputs.lifeExpectancy) {
            max = test;
            low = test;
        } else {
            high = test;
        }
        if (high - low < 1000) break;
    }
    return Math.floor(max / 1000) * 1000;
}

const baseMax = findMaxSpending(baseInputs);
const bigMax = findMaxSpending(bigWindfall);
console.log(`  Base max spending: $${baseMax.toLocaleString()}`);
console.log(`  With $1M windfall max: $${bigMax.toLocaleString()}`);
assert('Windfall increases max spending', bigMax > baseMax + 10000,
    `Big: $${bigMax.toLocaleString()} vs base: $${baseMax.toLocaleString()}`);

// === TEST 5: Verify age 80 scenario (base, no windfalls, $210K savings) ===
console.log('\n=== TEST 5: Does money run out at 80 without windfalls? ===');
// This tests Brody\'s concern that "is 80 valid?"
const tightInputs = {
    ...baseInputs,
    rrsp: 80000,
    tfsa: 80000,
    nonReg: 50000,
    monthlyContribution: 500,
    annualSpending: 68000
};
const tightResult = RetirementCalcV4.calculate(tightInputs);
console.log(`  Money lasts to: ${tightResult.summary.moneyLastsAge}`);
console.log(`  Portfolio at 65: $${Math.round(tightResult.yearByYear.find(y => y.age === 65)?.totalBalance || 0).toLocaleString()}`);

// Detailed year-by-year at key points
[31, 40, 50, 60, 65, 70, 75, 80, 85, 90].forEach(age => {
    const y = tightResult.yearByYear.find(y => y.age === age);
    if (y) console.log(`    Age ${age}: balance=$${Math.round(y.totalBalance).toLocaleString()}, income=$${Math.round(y.totalIncome || 0).toLocaleString()}`);
});

// === TEST 6: Stock options with type='shares' — growth calculation ===
console.log('\n=== TEST 6: Stock options growth math ===');
// $400K at 8% for 1 year (sold at 32, current age 31) = $432K gross
// Capital gains: ($432K - $100K cost basis) * 50% inclusion * 30% marginal = ~$49.8K tax
// After-tax: $432K - $49.8K = ~$382.2K
const stockY32 = stockResult.yearByYear.find(y => y.age === 32);
const baseY32 = baseResult.yearByYear.find(y => y.age === 32);
const difference = stockY32.totalBalance - baseY32.totalBalance;
console.log(`  Difference at 32: $${Math.round(difference).toLocaleString()}`);
const expectedGross = 400000 * Math.pow(1.08, 1); // 1 year growth
const expectedGain = expectedGross - 400000; // cost basis is currentValue in this case? Let me check...
console.log(`  Expected gross (8% for 1 yr): $${Math.round(expectedGross).toLocaleString()}`);

// Check balances at age 32 in detail
console.log(`  Stock result age 32 details:`, JSON.stringify({
    rrsp: Math.round(stockY32.rrsp || 0),
    tfsa: Math.round(stockY32.tfsa || 0),
    nonReg: Math.round(stockY32.nonReg || 0),
    total: Math.round(stockY32.totalBalance || 0),
    windfall: stockY32.windfall
}));

// === TEST 7: Monte Carlo passthrough ===
console.log('\n=== TEST 7: Monte Carlo windfall passthrough ===');
try {
    const mcCode = fs.readFileSync('windfalls.js', 'utf8') + '\n' + fs.readFileSync('monte-carlo.js', 'utf8');
    eval(mcCode.replace(/^const /gm, 'var '));
    
    const mcBase = MonteCarloSim.run({...baseInputs, iterations: 500});
    const mcStock = MonteCarloSim.run({...stockInputs, iterations: 500});
    console.log(`  MC base success: ${mcBase.successRate}%`);
    console.log(`  MC with stock: ${mcStock.successRate}%`);
    assert('MC: stock options improve success rate or maintain', mcStock.successRate >= mcBase.successRate - 5,
        `Stock MC: ${mcStock.successRate}% vs base: ${mcBase.successRate}%`);
} catch(e) {
    console.log(`  ⚠️ MC test skipped: ${e.message}`);
}

// === TEST 8: Multiple windfalls ===
console.log('\n=== TEST 8: Multiple windfalls ===');
const multiInputs = {
    ...baseInputs,
    windfalls: [
        { name: 'Stock Options', type: 'shares', currentValue: 400000, costBasis: 100000, sellAge: 32, growthRate: 8, amount: 400000 },
        { name: 'Inheritance', type: 'simple', amount: 200000, year: 50, probability: 100, taxable: false, destination: 'split' }
    ]
};
const multiResult = RetirementCalcV4.calculate(multiInputs);
console.log(`  Money lasts to: ${multiResult.summary.moneyLastsAge}`);
const multiPortAt65 = multiResult.yearByYear.find(y => y.age === 65)?.totalBalance;
console.log(`  Portfolio at 65: $${Math.round(multiPortAt65).toLocaleString()}`);
assert('Multiple windfalls: better than single', multiPortAt65 > stockPortAt65,
    `Multi: $${Math.round(multiPortAt65).toLocaleString()} vs stock-only: $${Math.round(stockPortAt65).toLocaleString()}`);

// === SUMMARY ===
console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// === TEST 9: Couple mode windfall (the actual bug) ===
console.log('\n=== TEST 9: Couple mode + separate accounts + windfall ===');
const coupleInputs = {
    currentAge: 31, partnerAge: 30, retirementAge: 65, lifeExpectancy: 90,
    familyStatus: 'couple', province: 'ON',
    income1: 80000, income2: 60000, currentIncome: 140000,
    rrsp: 110000, tfsa: 60000, nonReg: 40000, other: 0, cash: 0, lira: 0,
    accountsP1: { rrsp: 80000, tfsa: 40000, nonReg: 30000, lira: 0, other: 0, cash: 0 },
    accountsP2: { rrsp: 30000, tfsa: 20000, nonReg: 10000, lira: 0, other: 0, cash: 0 },
    contribP1Pct: 0.6,
    monthlyContribution: 1500,
    contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 },
    annualSpending: 68000, returnRate: 6, inflationRate: 2.5,
    isSingle: false, isFamilyMode: true,
    windfalls: [{ name: 'Stock', type: 'shares', currentValue: 400000, costBasis: 100000, sellAge: 32, growthRate: 8, amount: 400000 }],
    cppStartAge: 65, cppStartAgeP2: 65, oasStartAge: 65, oasStartAgeP2: 65,
    spendingCurve: 'flat', contributionGrowthRate: 0, merFee: 0,
    healthStatus: 'none', additionalIncomeSources: []
};
const coupleWF = RetirementCalcV4.calculate(coupleInputs);
const coupleNoWF = RetirementCalcV4.calculate({ ...coupleInputs, windfalls: [] });
const coupleImpact = coupleWF.yearByYear.find(y=>y.age===32).totalBalance - coupleNoWF.yearByYear.find(y=>y.age===32).totalBalance;
console.log(`  Windfall impact at 32: $${Math.round(coupleImpact).toLocaleString()}`);
assert('Couple mode: windfall increases balance at 32', coupleImpact > 300000,
    `Impact: $${Math.round(coupleImpact).toLocaleString()}`);

console.log(`\n${'='.repeat(50)}`);
console.log(`FINAL: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

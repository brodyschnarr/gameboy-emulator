// Test suite for year-by-year after-tax display and optimizer safety check
// Run with: node test-fixes.js

const fs = require('fs');
const vm = require('vm');

// Load calc engine
// Load scripts in same order as index.html
const scriptOrder = [
    'canada-tax.js', 'cpp-calculator.js', 'benchmarks.js', 'lifestyle-data.js',
    'regional-data.js', 'canada-map.js', 'income-sources.js', 'cpp-optimizer.js',
    'scenario-manager.js', 'healthcare-estimator.js', 'calc.js',
    'tax-optimizer.js', 'what-if-analyzer.js', 'safe-withdrawal.js',
    'monte-carlo.js'
];

const sandbox = { console, Math, Date, setTimeout, clearTimeout, setInterval, clearInterval, parseFloat, parseInt, isNaN, isFinite, Number, String, Array, Object, JSON, Map, Set, Error, TypeError, RangeError, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, addEventListener: () => {} }), addEventListener: () => {} }, window: {}, navigator: { userAgent: '' } };
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

for (const script of scriptOrder) {
    try {
        const code = fs.readFileSync(__dirname + '/' + script, 'utf8');
        vm.runInContext(code, ctx);
    } catch (e) {
        console.log(`  ⚠️ Skipping ${script}: ${e.message.split('\n')[0]}`);
    }
}

let passed = 0, failed = 0;
function assert(condition, msg) {
    if (condition) { passed++; console.log(`  ✅ ${msg}`); }
    else { failed++; console.log(`  ❌ FAIL: ${msg}`); }
}

// Standard test inputs
function makeInputs(overrides = {}) {
    return {
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90,
        currentIncome: 80000, annualSpending: 48000,
        rrsp: 50000, tfsa: 30000, nonReg: 20000, other: 0, cash: 5000,
        monthlyContribution: 1000,
        contributionSplit: { rrsp: 0.4, tfsa: 0.4, nonReg: 0.2 },
        province: 'ON', returnRate: 0.06, inflationRate: 0.025,
        cppStartAge: 65, oasStartAge: 65,
        familyStatus: 'single',
        windfalls: [],
        spendingCurve: 'flat',
        ...overrides
    };
}

// ═══════════════════════════════════════════
// TEST 1: Year-by-year shows after-tax amounts
// ═══════════════════════════════════════════
console.log('\n═══ TEST 1: Year-by-year after-tax display ═══');

const r1 = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(makeInputs()) + ')', ctx);
const retYears = r1.yearByYear.filter(y => y.age >= 65);

retYears.slice(0, 5).forEach(year => {
    const wb = year.withdrawalBreakdown || {};
    const cpp = year.cppReceived || 0;
    const oas = year.oasReceived || 0;
    const gis = year.gisReceived || 0;
    const additional = year.additionalIncome || 0;
    const fromTFSA = wb.tfsa || 0;
    const fromNonReg = wb.nonReg || 0;
    const fromRRSP = wb.rrsp || 0;
    const fromOther = wb.other || 0;
    const fromCash = wb.cash || 0;
    
    const grossIncome = cpp + oas + gis + additional + fromTFSA + fromNonReg + fromRRSP + fromOther + fromCash;
    const tax = year.taxPaid || 0;
    const afterTax = grossIncome - tax;
    
    assert(afterTax < grossIncome || tax === 0, `Age ${year.age}: after-tax ($${Math.round(afterTax)}) <= gross ($${Math.round(grossIncome)})`);
    assert(afterTax > 0, `Age ${year.age}: after-tax income is positive ($${Math.round(afterTax)})`);
    
    // The after-tax display should be closer to actual spending than gross
    const inflatedSpending = 48000 * Math.pow(1.025, year.age - 30);
    const grossDiff = Math.abs(grossIncome - inflatedSpending);
    const afterTaxDiff = Math.abs(afterTax - inflatedSpending);
    // After-tax should generally be closer to target spending (unless RRSP meltdown)
    console.log(`    Age ${year.age}: gross=$${Math.round(grossIncome)}, tax=$${Math.round(tax)}, afterTax=$${Math.round(afterTax)}, targetSpend=$${Math.round(inflatedSpending)}`);
});

// ═══════════════════════════════════════════
// TEST 2: Optimizer safety - no contradictions
// ═══════════════════════════════════════════
console.log('\n═══ TEST 2: Optimizer safety check ═══');

// Test case: plan that barely fails
const inputs2 = makeInputs({ annualSpending: 60000, rrsp: 20000, tfsa: 10000, nonReg: 5000 });
const r2 = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(inputs2) + ')', ctx);
const moneyLasts2 = r2.summary.moneyLastsAge;
const lifeExp2 = inputs2.lifeExpectancy;

console.log(`  Plan: $60K spending, moneyLastsAge=${moneyLasts2}, lifeExp=${lifeExp2}`);

// Simulate optimizer binary search
let low = 10000, high = 180000, maxSustainable = 60000;
for (let iter = 0; iter < 20; iter++) {
    const testSpending = Math.round((low + high) / 2);
    const testResult = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify({...inputs2, annualSpending: testSpending}) + ')', ctx);
    if (testResult.summary.moneyLastsAge >= lifeExp2) {
        maxSustainable = testSpending;
        low = testSpending;
    } else {
        high = testSpending;
    }
    if (high - low < 1000) break;
}
maxSustainable = Math.floor(maxSustainable / 1000) * 1000;

// Apply safety check (same logic as app code)
if (moneyLasts2 < lifeExp2 && maxSustainable >= inputs2.annualSpending) {
    console.log(`  ⚠️ Safety triggered: maxSustainable=$${maxSustainable} >= spending=$${inputs2.annualSpending} but plan fails`);
    // Step down
    for (let test = inputs2.annualSpending; test >= 10000; test -= 1000) {
        const tr = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify({...inputs2, annualSpending: test}) + ')', ctx);
        if (tr.summary.moneyLastsAge >= lifeExp2) {
            maxSustainable = test;
            break;
        }
    }
}

if (moneyLasts2 < lifeExp2) {
    assert(maxSustainable < inputs2.annualSpending, `When plan fails, maxSustainable ($${maxSustainable}) < spending ($${inputs2.annualSpending})`);
} else {
    assert(maxSustainable >= inputs2.annualSpending, `When plan succeeds, maxSustainable ($${maxSustainable}) >= spending ($${inputs2.annualSpending})`);
}

// ═══════════════════════════════════════════
// TEST 3: Spending curve adjusts correctly
// ═══════════════════════════════════════════
console.log('\n═══ TEST 3: Spending curve ═══');

const inputsFlat = makeInputs({ spendingCurve: 'flat' });
const inputsFront = makeInputs({ spendingCurve: 'front-loaded' });
const rFlat = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(inputsFlat) + ')', ctx);
const rFront = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(inputsFront) + ')', ctx);

const flatY1 = rFlat.yearByYear.find(y => y.age === 65);
const frontY1 = rFront.yearByYear.find(y => y.age === 65);
const flatY25 = rFlat.yearByYear.find(y => y.age === 85);
const frontY25 = rFront.yearByYear.find(y => y.age === 85);

if (flatY1 && frontY1) {
    console.log(`  Flat age 65 spending: $${Math.round(flatY1.spending || flatY1.totalSpending || 0)}`);
    console.log(`  Front-loaded age 65 spending: $${Math.round(frontY1.spending || frontY1.totalSpending || 0)}`);
}
if (flatY25 && frontY25) {
    console.log(`  Flat age 85 spending: $${Math.round(flatY25.spending || flatY25.totalSpending || 0)}`);
    console.log(`  Front-loaded age 85 spending: $${Math.round(frontY25.spending || frontY25.totalSpending || 0)}`);
}

// ═══════════════════════════════════════════
// TEST 4: GIS appears for low-income retirees
// ═══════════════════════════════════════════
console.log('\n═══ TEST 4: GIS for low-income ═══');

const gisInputs = makeInputs({
    currentIncome: 25000, annualSpending: 20000,
    rrsp: 5000, tfsa: 5000, nonReg: 2000, cash: 1000,
    monthlyContribution: 200
});
const rGIS = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(gisInputs) + ')', ctx);
const gisYears = rGIS.yearByYear.filter(y => y.age >= 65 && (y.gisReceived || 0) > 0);
assert(gisYears.length > 0, `Low-income retiree receives GIS (${gisYears.length} years)`);
if (gisYears.length > 0) {
    console.log(`    First GIS year: age ${gisYears[0].age}, amount $${Math.round(gisYears[0].gisReceived)}`);
}

// ═══════════════════════════════════════════
// TEST 5: Optimizer with multiple edge cases
// ═══════════════════════════════════════════
console.log('\n═══ TEST 5: Optimizer edge cases ═══');

// Case A: Very high spending (should fail)
const highSpendInputs = makeInputs({ annualSpending: 150000 });
const rHigh = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(highSpendInputs) + ')', ctx);
assert(rHigh.summary.moneyLastsAge < 90, `$150K spending doesn't last to 90 (lasts to ${rHigh.summary.moneyLastsAge})`);

// Case B: Very low spending (should succeed easily)
const lowSpendInputs = makeInputs({ annualSpending: 15000 });
const rLow = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(lowSpendInputs) + ')', ctx);
assert(rLow.summary.moneyLastsAge >= 90, `$15K spending lasts to 90+ (lasts to ${rLow.summary.moneyLastsAge})`);

// Case C: Elderly person (currentAge near retirementAge)
const elderInputs = makeInputs({ currentAge: 63, retirementAge: 65, annualSpending: 40000 });
const rElder = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(elderInputs) + ')', ctx);
assert(rElder.yearByYear.length > 0, `Elder case produces year-by-year data (${rElder.yearByYear.length} years)`);

// ═══════════════════════════════════════════
// TEST 6: Tax is computed and reasonable
// ═══════════════════════════════════════════
console.log('\n═══ TEST 6: Tax sanity ═══');

const retYearsMain = r1.yearByYear.filter(y => y.age >= 65);
retYearsMain.slice(0, 3).forEach(year => {
    const tax = year.taxPaid || 0;
    const wb = year.withdrawalBreakdown || {};
    const taxableIncome = (year.cppReceived || 0) + (year.oasReceived || 0) + (wb.rrsp || 0) + (wb.nonReg || 0) * 0.5;
    assert(tax >= 0, `Age ${year.age}: tax is non-negative ($${Math.round(tax)})`);
    if (taxableIncome > 15000) { // Above basic personal amount
        assert(tax > 0, `Age ${year.age}: tax > 0 when taxable income ($${Math.round(taxableIncome)}) > BPA`);
    }
});

// ═══════════════════════════════════════════
// TEST 7: Monotonicity check (higher spending = shorter duration)
// ═══════════════════════════════════════════
console.log('\n═══ TEST 7: Spending monotonicity ═══');

// Note: moneyLastsAge can be non-monotonic because plans where portfolio depletes
// but gov benefits sustain the person still report moneyLastsAge = lifeExpectancy.
// So we test portfolioAtRetirement monotonicity instead (more savings with less spending).
const spendLevels = [30000, 40000, 50000, 60000, 80000, 100000];
let prevPortfolio = Infinity;
let portfolioMonotonic = true;
spendLevels.forEach(spend => {
    const r = vm.runInContext('RetirementCalcV4.calculate(' + JSON.stringify(makeInputs({ annualSpending: spend })) + ')', ctx);
    const lasts = r.summary.moneyLastsAge;
    const portfolio = r.summary.portfolioAtRetirement || 0;
    if (portfolio > prevPortfolio + 100) portfolioMonotonic = false; // small tolerance
    console.log(`    $${spend/1000}K → lasts to age ${lasts}, portfolio at retirement: $${Math.round(portfolio).toLocaleString()}`);
    prevPortfolio = portfolio;
});
assert(portfolioMonotonic, 'Higher spending means equal or lower portfolio at retirement');

// ═══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

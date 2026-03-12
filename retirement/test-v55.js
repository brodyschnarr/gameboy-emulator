// Test V5.5 changes: cash account + GIS
const fs = require('fs');

// Load dependencies
// Load in global scope
function load(f) { eval.call(globalThis, fs.readFileSync(f, 'utf8').replace(/\bconst (\w+)\s*=/g, 'var $1 =')); }
['cpp-calculator.js','cpp-optimizer.js','tax-optimizer.js','healthcare-estimator.js','canada-tax.js','calc.js'].forEach(load);

const defaultSplit = { rrsp: 40, tfsa: 30, nonReg: 20, other: 10 };
let passed = 0, failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch(e) {
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('\n📊 Test Group 1: Cash Account');

test('Cash included in total balance', () => {
    const r = RetirementCalcV4.calculate({
        currentAge: 55, retirementAge: 60, lifeExpectancy: 90,
        province: 'ON', currentIncome: 80000,
        rrsp: 100000, tfsa: 50000, nonReg: 0, other: 0, cash: 30000,
        monthlyContribution: 1000, contributionSplit: defaultSplit, returnRate: 6, inflationRate: 2, annualSpending: 40000
    });
    const age55 = r.yearByYear.find(y => y.age === 55);
    assert(age55.totalBalance > 180000, `Total should include cash: got ${age55.totalBalance}`);
    assert(age55.cash > 0, `Cash should be tracked: got ${age55.cash}`);
});

test('Cash grows at ~1.5% not portfolio rate', () => {
    const r = RetirementCalcV4.calculate({
        currentAge: 30, retirementAge: 65, lifeExpectancy: 90,
        province: 'ON', currentIncome: 60000,
        rrsp: 0, tfsa: 0, nonReg: 0, other: 0, cash: 100000,
        monthlyContribution: 0, contributionSplit: defaultSplit, returnRate: 6, inflationRate: 2, annualSpending: 40000
    });
    // After 10 years at 1.5%, cash should be ~116K (not ~179K at 6%)
    const age40 = r.yearByYear.find(y => y.age === 40);
    assert(age40.cash > 114000 && age40.cash < 118000, 
        `Cash after 10yr at 1.5% should be ~116K, got ${age40.cash}`);
});

test('Cash withdrawn in retirement', () => {
    const r = RetirementCalcV4.calculate({
        currentAge: 59, retirementAge: 60, lifeExpectancy: 70,
        province: 'ON', currentIncome: 50000,
        rrsp: 0, tfsa: 0, nonReg: 0, other: 0, cash: 500000,
        monthlyContribution: 0, contributionSplit: defaultSplit, returnRate: 6, inflationRate: 2, annualSpending: 40000
    });
    const age65 = r.yearByYear.find(y => y.age === 65);
    assert(age65.cash < 500000, `Cash should decrease from withdrawals, got ${age65.cash}`);
});

console.log('\n📊 Test Group 2: GIS (Guaranteed Income Supplement)');

test('GIS kicks in for low-income single at 65+', () => {
    const r = RetirementCalcV4.calculate({
        currentAge: 64, retirementAge: 60, lifeExpectancy: 90,
        province: 'ON', currentIncome: 20000, familyStatus: 'single',
        rrsp: 0, tfsa: 50000, nonReg: 0, other: 0, cash: 0,
        monthlyContribution: 0, contributionSplit: defaultSplit, returnRate: 6, inflationRate: 2, annualSpending: 20000
    });
    const age66 = r.yearByYear.find(y => y.age === 66);
    assert(age66.gisReceived > 0, `GIS should be > 0 for low-income, got ${age66.gisReceived}`);
    assert(age66.governmentIncome > age66.cppReceived + age66.oasReceived, 
        `Gov income should include GIS: gov=${age66.governmentIncome}, cpp+oas=${age66.cppReceived + age66.oasReceived}`);
});

test('GIS is zero for high-income earner', () => {
    const r = RetirementCalcV4.calculate({
        currentAge: 64, retirementAge: 60, lifeExpectancy: 90,
        province: 'ON', currentIncome: 100000, familyStatus: 'single',
        rrsp: 500000, tfsa: 200000, nonReg: 100000, other: 0, cash: 0,
        monthlyContribution: 0, contributionSplit: defaultSplit, returnRate: 6, inflationRate: 2, annualSpending: 60000
    });
    const age66 = r.yearByYear.find(y => y.age === 66);
    assert(age66.gisReceived === 0, `GIS should be 0 for high-income, got ${age66.gisReceived}`);
});

test('GIS not present before age 65', () => {
    const r = RetirementCalcV4.calculate({
        currentAge: 55, retirementAge: 60, lifeExpectancy: 90,
        province: 'ON', currentIncome: 20000, familyStatus: 'single',
        rrsp: 50000, tfsa: 50000, nonReg: 0, other: 0, cash: 0,
        monthlyContribution: 500, contributionSplit: defaultSplit, returnRate: 6, inflationRate: 2, annualSpending: 15000
    });
    const age62 = r.yearByYear.find(y => y.age === 62);
    assert(age62, `Should have year at age 62`);
    assert(!age62.gisReceived || age62.gisReceived === 0, `GIS should be 0 before 65, got ${age62.gisReceived}`);
});

console.log('\n📊 Test Group 3: Benchmarks post-65');

load('benchmarks-v2.js');

test('Benchmarks decline after 65', () => {
    const b65 = BenchmarksV2.getSavingsBenchmark(65);
    const b75 = BenchmarksV2.getSavingsBenchmark(75);
    assert(b75.median < b65.median, `75 median (${b75.median}) should be less than 65 (${b65.median})`);
});

test('Age 80 benchmark exists', () => {
    const b80 = BenchmarksV2.getSavingsBenchmark(80);
    assert(b80.median > 0, `80 should have benchmark data, got median ${b80.median}`);
});

console.log(`\n✅ ${passed} passed, ❌ ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

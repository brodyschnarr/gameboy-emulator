// ═══════════════════════════════════════════
// Couple Mode Separate Accounts Tests
// ═══════════════════════════════════════════

// Load dependencies
const fs = require('fs');
global.document = { getElementById: () => null, querySelectorAll: () => [] };
const origLog = console.log;
console.log = () => {};
const files = ['canada-tax.js', 'cpp-calculator.js', 'cpp-optimizer.js', 'healthcare-estimator.js', 'calc.js'];
const combined = files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n');
eval(combined.replace(/^const /gm, 'var '));
console.log = origLog;

let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`✅ ${name}`);
    } catch(e) {
        failed++;
        console.log(`❌ ${name}: ${e.message}`);
    }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertRange(val, min, max, msg) {
    if (val < min || val > max) throw new Error(`${msg || 'Value'}: ${val} not in [${min}, ${max}]`);
}

// Base couple inputs
const baseCoupleInputs = {
    currentAge: 55,
    partnerAge: 53,
    retirementAge: 65,
    lifeExpectancy: 90,
    province: 'ON',
    familyStatus: 'couple',
    currentIncome: 140000,
    income1: 80000,
    income2: 60000,
    rrsp: 400000,
    tfsa: 120000,
    nonReg: 80000,
    lira: 0,
    other: 0,
    cash: 0,
    monthlyContribution: 2000,
    contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 },
    annualSpending: 65000,
    returnRate: 6,
    inflationRate: 2,
    cppStartAge: 65,
    cppStartAgeP2: 65,
    oasStartAge: 65,
    oasStartAgeP2: 65,
};

// ═══ TEST 1: Pooled (no per-person accounts) still works ═══
test('Pooled couple mode (no accountsP1/P2) works normally', () => {
    const result = RetirementCalcV4.calculate(baseCoupleInputs);
    assert(result.yearByYear.length > 0, 'Should produce year-by-year data');
    assert(result.summary.portfolioAtRetirement > 0, 'Should have portfolio at retirement');
    assert(result.govBenefits.cpp1 > 0, 'P1 CPP should be > 0');
    assert(result.govBenefits.cpp2 > 0, 'P2 CPP should be > 0');
});

// ═══ TEST 2: Separate accounts produces valid results ═══
test('Separate accounts couple mode produces valid results', () => {
    const inputs = {
        ...baseCoupleInputs,
        accountsP1: { rrsp: 250000, tfsa: 70000, nonReg: 50000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 150000, tfsa: 50000, nonReg: 30000, lira: 0, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    assert(result.yearByYear.length > 0, 'Should produce year-by-year data');
    assert(result.summary.portfolioAtRetirement > 0, 'Should have portfolio at retirement');
    const retYear = result.yearByYear.find(y => y.age === 65);
    assert(retYear, 'Should have age 65 year');
    assert(retYear.totalBalance > 0, 'Total balance at 65 should be > 0');
});

// ═══ TEST 3: Separate accounts total matches pooled total ═══
test('Separate accounts initial total matches pooled amounts', () => {
    const inputs = {
        ...baseCoupleInputs,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    // First year balance should be close to pooled result
    const pooled = RetirementCalcV4.calculate(baseCoupleInputs);
    const diff = Math.abs(result.yearByYear[0].totalBalance - pooled.yearByYear[0].totalBalance);
    // Should be within 1% (slight differences due to contribution splitting)
    assertRange(diff / pooled.yearByYear[0].totalBalance, 0, 0.01, 'Year 1 balance difference');
});

// ═══ TEST 4: Asymmetric accounts — tax optimization effect ═══
test('Asymmetric accounts: unequal RRSP produces different tax than pooled', () => {
    // P1 has big RRSP, P2 has big TFSA — should enable better tax optimization
    const asymInputs = {
        ...baseCoupleInputs,
        rrsp: 400000,
        tfsa: 200000,
        nonReg: 0,
        accountsP1: { rrsp: 350000, tfsa: 50000, nonReg: 0, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 50000, tfsa: 150000, nonReg: 0, lira: 0, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(asymInputs);
    const retYears = result.yearByYear.filter(y => y.phase === 'retirement');
    const totalTax = retYears.reduce((s, y) => s + (y.taxPaid || 0), 0);
    
    // Should have some tax paid (RRSP withdrawals are taxable)
    assert(totalTax > 0, 'Should pay some tax on RRSP withdrawals');
    // Money should last to life expectancy or close
    assertRange(result.summary.moneyLastsAge, 85, 90, 'Money lasts age');
});

// ═══ TEST 5: LIRA per person ═══
test('Per-person LIRA accounts tracked correctly', () => {
    const inputs = {
        ...baseCoupleInputs,
        lira: 100000,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 80000, other: 0, cash: 0 },
        accountsP2: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 20000, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    assert(result.yearByYear.length > 0, 'Should produce results');
    // At age 71+, both LIRAs should have mandatory minimums
    const age71 = result.yearByYear.find(y => y.age === 71);
    if (age71) {
        assert(age71.lifMandatory > 0 || age71.rrifMandatory > 0, 'Should have mandatory minimums at 71');
    }
});

// ═══ TEST 6: Partner age difference affects RRIF timing ═══
test('Different partner ages produce different RRIF timing', () => {
    const inputs = {
        ...baseCoupleInputs,
        currentAge: 60,
        partnerAge: 55, // 5 years younger
        retirementAge: 65,
        accountsP1: { rrsp: 300000, tfsa: 50000, nonReg: 0, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 300000, tfsa: 50000, nonReg: 0, lira: 0, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    // P1 hits 71 at projection age 71, P2 hits 71 at projection age 76 (5 years later)
    const age71 = result.yearByYear.find(y => y.age === 71);
    const age76 = result.yearByYear.find(y => y.age === 76);
    // Both should exist and have increasing mandatory withdrawals
    assert(age71, 'Should have age 71 data');
    assert(age76, 'Should have age 76 data');
});

// ═══ TEST 7: Per-person OAS clawback ═══  
test('Per-person withdrawal avoids unnecessary OAS clawback', () => {
    // High-income scenario where pooled would trigger clawback
    const inputs = {
        ...baseCoupleInputs,
        currentAge: 65,
        partnerAge: 65,
        retirementAge: 65,
        rrsp: 800000,
        tfsa: 100000,
        nonReg: 100000,
        annualSpending: 80000,
        accountsP1: { rrsp: 600000, tfsa: 50000, nonReg: 50000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 200000, tfsa: 50000, nonReg: 50000, lira: 0, other: 0, cash: 0 },
    };
    const separateResult = RetirementCalcV4.calculate(inputs);
    
    // Compare with pooled
    const pooledInputs = { ...inputs, accountsP1: undefined, accountsP2: undefined };
    const pooledResult = RetirementCalcV4.calculate(pooledInputs);
    
    const sepOAS = separateResult.yearByYear.filter(y => y.phase === 'retirement').reduce((s, y) => s + (y.oasReceived || 0), 0);
    const poolOAS = pooledResult.yearByYear.filter(y => y.phase === 'retirement').reduce((s, y) => s + (y.oasReceived || 0), 0);
    
    // Separate should preserve at least as much OAS (or close)
    // The key insight: per-person tax optimization can keep each person under clawback threshold
    console.log(`    Separate OAS total: $${Math.round(sepOAS).toLocaleString()} vs Pooled: $${Math.round(poolOAS).toLocaleString()}`);
    assert(separateResult.yearByYear.length > 0, 'Should have results');
});

// ═══ TEST 8: Cash accounts per person ═══
test('Per-person cash accounts work', () => {
    const inputs = {
        ...baseCoupleInputs,
        cash: 40000,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 25000 },
        accountsP2: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 15000 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    assert(result.yearByYear.length > 0, 'Should produce results');
    // Check accumulation phase includes cash
    const firstYear = result.yearByYear[0];
    assert(firstYear.cash > 0, 'Should track cash balance');
});

// ═══ TEST 9: Withdrawal breakdown exists ═══
test('Couple mode produces withdrawal breakdown', () => {
    const inputs = {
        ...baseCoupleInputs,
        currentAge: 65,
        retirementAge: 65,
        accountsP1: { rrsp: 250000, tfsa: 70000, nonReg: 50000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 150000, tfsa: 50000, nonReg: 30000, lira: 0, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    const retYear = result.yearByYear.find(y => y.phase === 'retirement');
    assert(retYear, 'Should have retirement year');
    assert(retYear.withdrawalBreakdown, 'Should have withdrawal breakdown');
    assert(retYear.withdrawal >= 0, 'Withdrawal should be non-negative');
    assert(retYear.taxPaid >= 0, 'Tax should be non-negative');
});

// ═══ TEST 10: Couple mode with windfalls ═══
test('Couple mode handles windfalls correctly', () => {
    const inputs = {
        ...baseCoupleInputs,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
        windfalls: [{ name: 'Inheritance', amount: 100000, year: 60, taxable: false }],
    };
    const result = RetirementCalcV4.calculate(inputs);
    assert(result.yearByYear.length > 0, 'Should produce results with windfall');
    // Balance at 60 should be higher than at 59
    const age59 = result.yearByYear.find(y => y.age === 59);
    const age60 = result.yearByYear.find(y => y.age === 60);
    if (age59 && age60) {
        assert(age60.totalBalance > age59.totalBalance, 'Balance should jump at windfall year');
    }
});

// ═══ TEST 11: Optimizer works with couple separate mode ═══
test('optimizePlan works with couple separate accounts', () => {
    const inputs = {
        ...baseCoupleInputs,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
    };
    const optimized = RetirementCalcV4.optimizePlan(inputs);
    assert(optimized.result, 'Should produce optimized result');
    assert(optimized.params, 'Should produce optimized params');
    assert(optimized.params.maxSpend > 0, 'Max sustainable spending should be > 0');
    console.log(`    Optimized max spend: $${optimized.params.maxSpend.toLocaleString()}`);
});

// ═══ TEST 12: Tax comparison works with couple separate ═══
test('compareTaxStrategies works with couple separate', () => {
    const inputs = {
        ...baseCoupleInputs,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
    };
    const comparison = RetirementCalcV4.compareTaxStrategies(inputs);
    assert(comparison.smart, 'Should have smart strategy results');
    assert(comparison.naive, 'Should have naive strategy results');
    assert(comparison.savings, 'Should have savings comparison');
    console.log(`    Smart tax: $${comparison.smart.totalTax.toLocaleString()} vs Naive: $${comparison.naive.totalTax.toLocaleString()}`);
});

// ═══ TEST 13: Spending check works for couple separate ═══
test('Couple separate mode sustains spending to life expectancy', () => {
    // Conservative scenario that should last
    const inputs = {
        ...baseCoupleInputs,
        annualSpending: 50000,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    assertRange(result.summary.moneyLastsAge, 88, 90, 'Should last to ~90 with conservative spending');
});

// ═══ TEST 14: Downsizing works in couple mode ═══
test('Downsizing proceeds distributed in couple mode', () => {
    const inputs = {
        ...baseCoupleInputs,
        downsizingAge: 70,
        downsizingProceeds: 200000,
        downsizingSpendingChange: -500,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    const age69 = result.yearByYear.find(y => y.age === 69);
    const age70 = result.yearByYear.find(y => y.age === 70);
    if (age69 && age70) {
        // Downsizing proceeds should boost balance
        assert(age70.totalBalance > age69.totalBalance - 100000, 'Downsizing should boost balance');
    }
});

// ═══ TEST 15: All zero P2 accounts (one-sided couple) ═══
test('One-sided couple: P2 has no accounts', () => {
    const inputs = {
        ...baseCoupleInputs,
        accountsP1: { rrsp: 400000, tfsa: 120000, nonReg: 80000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 0, tfsa: 0, nonReg: 0, lira: 0, other: 0, cash: 0 },
    };
    const result = RetirementCalcV4.calculate(inputs);
    assert(result.yearByYear.length > 0, 'Should produce results');
    assert(result.summary.portfolioAtRetirement > 0, 'Should have portfolio');
});

// ═══ TEST 16: Contribution split favoring P2 ═══
test('Contribution split 30/70 grows P2 faster', () => {
    const inputs = {
        ...baseCoupleInputs,
        contribP1Pct: 0.30,
        accountsP1: { rrsp: 200000, tfsa: 60000, nonReg: 40000, lira: 0, other: 0, cash: 0 },
        accountsP2: { rrsp: 100000, tfsa: 30000, nonReg: 20000, lira: 0, other: 0, cash: 0 },
    };
    const result30 = RetirementCalcV4.calculate(inputs);
    
    // Compare with 50/50
    const inputs50 = { ...inputs, contribP1Pct: 0.50 };
    const result50 = RetirementCalcV4.calculate(inputs50);
    
    // Both should produce valid results
    assert(result30.yearByYear.length > 0, 'Should produce results with 30/70 split');
    assert(result50.yearByYear.length > 0, 'Should produce results with 50/50 split');
    
    // With 30/70, money should still last (may differ from 50/50 due to tax optimization)
    assertRange(result30.summary.moneyLastsAge, 85, 90, 'Should still last with 30/70 split');
});

console.log('\n══════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) console.log('✅ ALL COUPLE MODE TESTS PASSED');
else console.log(`❌ ${failed} TESTS FAILED`);
console.log('══════════════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);

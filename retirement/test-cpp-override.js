const fs = require('fs');
const scripts = ['canada-tax.js','cpp-calculator.js','cpp-optimizer.js','healthcare-estimator.js','income-sources.js','calc.js','monte-carlo.js'];
for (const s of scripts) { try { let code = fs.readFileSync(s, 'utf8').replace(/^const /gm, 'var '); eval(code); } catch(e) { console.log(`${s}: ${e.message}`); } }

const base = {
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

// Test 1: No override (estimated CPP)
const r1 = RetirementCalcV4.calculate(base);
console.log('TEST 1 - Estimated CPP (from $80K income):');
console.log('  CPP1:', r1.govBenefits.cpp1, 'CPP total:', r1.govBenefits.cppTotal);
console.log('  OAS:', r1.govBenefits.oasTotal);

// Test 2: Override CPP to $10,000/year at 65
const r2 = RetirementCalcV4.calculate({ ...base, cppOverride: 10000 });
console.log('\nTEST 2 - Override CPP to $10,000/year at 65:');
console.log('  CPP1:', r2.govBenefits.cpp1, 'CPP total:', r2.govBenefits.cppTotal);
console.log('  Legacy diff:', r2.summary.legacyAmount - r1.summary.legacyAmount, '(should be negative)');

// Test 3: Override CPP to $5,000/year (low earner)
const r3 = RetirementCalcV4.calculate({ ...base, cppOverride: 5000 });
console.log('\nTEST 3 - Override CPP to $5,000/year:');
console.log('  CPP1:', r3.govBenefits.cpp1, 'CPP total:', r3.govBenefits.cppTotal);

// Test 4: Couple mode with overrides
const couple = { ...base, familyStatus: 'couple', income1: 80000, income2: 60000,
    cppStartAgeP2: 65, cppOverride: 12000, cppOverrideP2: 8000 };
const r4 = RetirementCalcV4.calculate(couple);
console.log('\nTEST 4 - Couple with overrides ($12K + $8K):');
console.log('  CPP1:', r4.govBenefits.cpp1, 'CPP2:', r4.govBenefits.cpp2, 'Total:', r4.govBenefits.cppTotal);

// Test 5: MC also uses override
const mc = MonteCarloSimulator.simulate({ ...base, cppOverride: 10000 }, { iterations: 100, volatility: 0.11, marketCrashProbability: 0.04 });
console.log('\nTEST 5 - MC with override:');
console.log('  Success:', mc.successRate + '%');

// Test 6: No override set (null) — should use estimate
const r6 = RetirementCalcV4.calculate({ ...base, cppOverride: null, cppOverrideP2: null });
console.log('\nTEST 6 - Null override (should match TEST 1):');
console.log('  CPP1:', r6.govBenefits.cpp1, '(same as TEST 1?', r6.govBenefits.cpp1 === r1.govBenefits.cpp1, ')');

console.log('\n✅ All CPP override tests complete');

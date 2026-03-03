const fs = require('fs');
const scripts = ['canada-tax.js','cpp-calculator.js','cpp-optimizer.js','healthcare-estimator.js','income-sources.js','calc.js','monte-carlo.js'];
for (const s of scripts) { try { let code = fs.readFileSync(s, 'utf8').replace(/^const /gm, 'var '); eval(code); } catch(e) { console.log(`${s}: ${e.message}`); } }

// Inputs that would produce ~$458K at retirement age 65
// Starting age 31, small balances/contributions
const inputs = {
    currentAge: 31, partnerAge: 31, retirementAge: 65, lifeExpectancy: 90,
    province: 'ON', familyStatus: 'single',
    currentIncome: 80000, income1: 80000, income2: 0,
    rrsp: 50000, tfsa: 30000, nonReg: 20000, other: 0,
    monthlyContribution: 500,
    contributionSplit: { rrsp: 0.4, tfsa: 0.3, nonReg: 0.3 },
    annualSpending: 60000, healthStatus: 'average',
    currentDebt: 0, debtPayoffAge: 65,
    cppStartAge: 65, oasStartAge: 65,
    additionalIncomeSources: [], windfalls: [],
    returnRate: 6, inflationRate: 2.5, contributionGrowthRate: 0
};

const r = RetirementCalcV4.calculate(inputs);
console.log('Portfolio at retirement:', r.summary.portfolioAtRetirement);
console.log('Legacy:', r.summary.legacyAmount);
console.log('Money lasts:', r.summary.moneyLastsAge);
console.log('Probability:', r.probability);

// Print last 5 years of projection
const last5 = r.yearByYear.slice(-5);
last5.forEach(y => {
    console.log(`Age ${y.age}: bal=${Math.round(y.totalBalance)} w=${y.withdrawal||0} gov=${y.governmentIncome||0} tax=${y.taxPaid||0} target=${y.targetSpending||0}`);
});

// Also check: year income breakdown near end
const age85 = r.yearByYear.find(y => y.age === 85);
if (age85) {
    console.log('\nAge 85 detail:', JSON.stringify({
        bal: Math.round(age85.totalBalance),
        withdrawal: age85.withdrawal,
        gov: age85.governmentIncome,
        cpp: age85.cppReceived,
        oas: age85.oasReceived,
        breakdown: age85.withdrawalBreakdown,
        target: age85.targetSpending
    }));
}

// Run MC
const mc = MonteCarloSimulator.simulate(inputs, { iterations: 500, volatility: 0.11, marketCrashProbability: 0.04 });
console.log('\nMC success:', mc.successRate + '%');
console.log('MC p50 final:', mc.finalBalance.p50);

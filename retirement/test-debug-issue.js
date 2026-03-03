// Test: Compare deterministic vs MC with fixed returns
// Load all dependencies
const fs = require('fs');

// Minimal DOM mock
global.document = { getElementById: () => null, querySelectorAll: () => [] };
global.window = {};
global.console = console;

// Load scripts in order
const scripts = [
    'canada-tax.js',
    'cpp-calculator.js', 
    'cpp-optimizer.js',
    'healthcare-estimator.js',
    'income-sources.js',
    'calc.js',
    'monte-carlo.js'
];

for (const s of scripts) {
    try { 
        let code = fs.readFileSync(s, 'utf8');
        // Convert const to var for global scope
        code = code.replace(/^const /gm, 'var ');
        eval(code);
    } catch(e) { console.log(`Loading ${s}: ${e.message}`); }
}


// Brody-like inputs
const inputs = {
    currentAge: 31,
    partnerAge: 31,
    retirementAge: 60,
    lifeExpectancy: 90,
    province: 'ON',
    region: 'ON_Toronto',
    familyStatus: 'single',
    currentIncome: 80000,
    income1: 80000,
    income2: 0,
    rrsp: 200000,
    tfsa: 150000,
    nonReg: 100000,
    other: 50000,
    monthlyContribution: 5000,
    contributionSplit: { rrsp: 0.4, tfsa: 0.3, nonReg: 0.3 },
    annualSpending: 60000,
    healthStatus: 'average',
    currentDebt: 0,
    debtPayoffAge: 60,
    cppStartAge: 65,
    oasStartAge: 65,
    additionalIncomeSources: [],
    windfalls: [],
    returnRate: 6,
    inflationRate: 2.5,
    contributionGrowthRate: 0
};

// Run deterministic
const detResult = RetirementCalcV4.calculate(inputs);
console.log('\n=== DETERMINISTIC ===');
console.log('Portfolio at retirement:', detResult.summary.portfolioAtRetirement);
console.log('Money lasts age:', detResult.summary.moneyLastsAge);
console.log('Legacy:', detResult.summary.legacyAmount);
console.log('Annual income at retirement:', detResult.summary.annualIncomeAtRetirement);
console.log('Probability:', detResult.probability);

// Check first retirement year
const firstRetYear = detResult.yearByYear.find(y => y.age === 60);
if (firstRetYear) {
    console.log('\nFirst retirement year (age 60):');
    console.log('  Total balance:', firstRetYear.totalBalance);
    console.log('  Withdrawal:', firstRetYear.withdrawal);
    console.log('  Gov income:', firstRetYear.governmentIncome);
    console.log('  CPP:', firstRetYear.cppReceived);
    console.log('  OAS:', firstRetYear.oasReceived);
    console.log('  Tax:', firstRetYear.taxPaid);
    console.log('  Target spending:', firstRetYear.targetSpending);
}

const age65 = detResult.yearByYear.find(y => y.age === 65);
if (age65) {
    console.log('\nAge 65:');
    console.log('  Total balance:', age65.totalBalance);
    console.log('  Withdrawal:', age65.withdrawal);
    console.log('  Gov income:', age65.governmentIncome);
    console.log('  CPP:', age65.cppReceived);
    console.log('  OAS:', age65.oasReceived);
    console.log('  Breakdown:', JSON.stringify(age65.withdrawalBreakdown));
}

// Run MC with fixed 6% return (to compare apples to apples)
console.log('\n=== MC SINGLE RUN (fixed 6%) ===');
const fixedReturns = Array(60).fill(0.06);
const mcSingle = MonteCarloSimulator._runSingleSimulation({
    ...inputs,
    returnSequence: fixedReturns,
    simulationRun: true
});
console.log('Portfolio at retirement:', mcSingle.portfolioAtRetirement);
console.log('Money lasts age:', mcSingle.moneyLastsAge);
console.log('Final balance:', mcSingle.finalBalance);
console.log('Success:', mcSingle.success);

const mcFirstRet = mcSingle.projection.find(y => y.age === 60);
if (mcFirstRet) {
    console.log('\nMC First retirement year (age 60):');
    console.log('  Total balance:', mcFirstRet.totalBalance);
    console.log('  Withdrawal:', mcFirstRet.withdrawal);
    console.log('  Gov income:', mcFirstRet.governmentIncome);
}

const mcAge65 = mcSingle.projection.find(y => y.age === 65);
if (mcAge65) {
    console.log('\nMC Age 65:');
    console.log('  Total balance:', mcAge65.totalBalance);
    console.log('  Withdrawal:', mcAge65.withdrawal);
    console.log('  Gov income:', mcAge65.governmentIncome);
    console.log('  Breakdown:', JSON.stringify(mcAge65.withdrawalBreakdown));
}

// Now run full MC
console.log('\n=== FULL MC (1000 runs) ===');
const mcResults = MonteCarloSimulator.simulate(inputs, {
    iterations: 1000,
    volatility: 0.11,
    marketCrashProbability: 0.04
});
console.log('Success rate:', mcResults.successRate + '%');
console.log('Median final balance:', mcResults.finalBalance.p50);
console.log('P10 final balance:', mcResults.finalBalance.p10);
console.log('P90 final balance:', mcResults.finalBalance.p90);
console.log('Portfolio at retirement P50:', mcResults.portfolioAtRetirement.p50);

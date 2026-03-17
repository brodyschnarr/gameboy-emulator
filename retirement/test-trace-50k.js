const fs = require('fs');
const fn = new Function(
    fs.readFileSync('canada-tax.js', 'utf8') + '\n' +
    fs.readFileSync('cpp-calculator.js', 'utf8') + '\n' +
    fs.readFileSync('cpp-optimizer.js', 'utf8') + '\n' +
    fs.readFileSync('healthcare-estimator.js', 'utf8') + '\n' +
    fs.readFileSync('calc.js', 'utf8') +
    '\nreturn { CanadianTax, RetirementCalcV4 };'
);
const { CanadianTax, RetirementCalcV4 } = fn();

const baseInputs = {
    currentAge: 35, retirementAge: 65, lifeExpectancy: 90,
    annualSpending: 50000,
    currentIncome: 70000, income1: 70000, income2: 0,
    rrsp: 30000, tfsa: 15000, nonReg: 5000, lira: 0, other: 0,
    monthlyContribution: 600,
    contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 },
    contributionGrowthRate: 0, returnRate: 5.5, inflationRate: 2.5,
    province: 'ON', cppStartAge: 70, oasStartAge: 70,
    spendingCurve: 'flat', windfalls: [], additionalIncomeSources: [],
    employerPension: 0, employerPensionStartAge: 65, employerPensionIndexed: true,
    healthStatus: 'average', currentDebt: 0, debtPayoffAge: 65, merFee: 0,
    familyStatus: 'single', _withdrawalStrategy: 'smart'
};

const r = RetirementCalcV4.calculate(baseInputs);
console.log(`Lasts to: ${r.summary.moneyLastsAge}`);
const ret = r.yearByYear.filter(y => y.phase === 'retirement');
for (const y of ret) {
    const wb = y.withdrawalBreakdown || {};
    const totalIncome = (y.withdrawal||0) + (y.governmentIncome||0);
    const shortfall = y.targetSpending - totalIncome;
    const shortPct = y.targetSpending > 0 ? (shortfall / y.targetSpending * 100).toFixed(0) : 0;
    console.log(`Age ${y.age}: rrsp=${y.rrsp} tfsa=${y.tfsa} nreg=${y.nonReg} | need=${y.targetSpending} w.total=${Math.round(y.withdrawal)} (rrsp=${Math.round(wb.rrsp||0)} tfsa=${Math.round(wb.tfsa||0)} nreg=${Math.round(wb.nonReg||0)}) govt=${y.governmentIncome} tax=${Math.round(y.taxPaid||0)} | short=${Math.round(shortfall)} (${shortPct}%)`);
}

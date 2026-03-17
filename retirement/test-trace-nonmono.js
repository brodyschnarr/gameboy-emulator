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

// Compare $50K (lasts 69) vs $55K (lasts 72) - higher spending lasts LONGER
for (const spend of [50000, 55000]) {
    const r = RetirementCalcV4.calculate({ ...baseInputs, annualSpending: spend });
    console.log(`\n=== $${spend}/yr — Lasts to ${r.summary.moneyLastsAge} ===`);
    const ret = r.yearByYear.filter(y => y.phase === 'retirement');
    for (const y of ret) {
        if (y.age <= 72 || y.age >= r.summary.moneyLastsAge - 2) {
            const wb = y.withdrawalBreakdown || {};
            console.log(`Age ${y.age}: bal=${y.totalBalance} | need=${y.targetSpending} | w.rrsp=${Math.round(wb.rrsp||0)} w.tfsa=${Math.round(wb.tfsa||0)} w.nonReg=${Math.round(wb.nonReg||0)} | govt=${y.governmentIncome} tax=${Math.round(y.taxPaid||0)}`);
        }
    }
}

const fs = require('fs');
const taxCode = fs.readFileSync('canada-tax.js', 'utf8');
const cppCode = fs.readFileSync('cpp-calculator.js', 'utf8');
const cppOptCode = fs.readFileSync('cpp-optimizer.js', 'utf8');
const healthCode = fs.readFileSync('healthcare-estimator.js', 'utf8');
const calcCode = fs.readFileSync('calc.js', 'utf8');
const fn = new Function(taxCode + '\n' + cppCode + '\n' + cppOptCode + '\n' + healthCode + '\n' + calcCode + '\nreturn { CanadianTax, RetirementCalcV4 };');
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

// Compare $30K (lasts 88) vs $45K (lasts 90) — $45K should be WORSE
for (const spend of [30000, 45000]) {
    const r = RetirementCalcV4.calculate({ ...baseInputs, annualSpending: spend });
    console.log(`\n=== $${spend}/yr — Lasts to ${r.summary.moneyLastsAge} ===`);
    const ret = r.yearByYear.filter(y => y.phase === 'retirement');
    // Show key years
    for (const y of ret) {
        if (y.age >= 65 && y.age <= 72 || y.age >= 85) {
            console.log(`Age ${y.age}: bal=${y.totalBalance}, w=${y.withdrawal}, rrsp=${y.rrsp}, tfsa=${y.tfsa}, nonReg=${y.nonReg}, govt=${y.governmentIncome}, tax=${y.taxPaid}, target=${y.targetSpending}`);
        }
    }
}

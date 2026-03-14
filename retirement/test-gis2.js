const vm = require('vm');
const fs = require('fs');
const ctx = vm.createContext({
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    window: {}, console, Math, parseInt, parseFloat, isNaN, isFinite, Number, String, Array, Object, JSON, Date, setTimeout, clearTimeout,
});
function loadJS(file) { vm.runInContext(fs.readFileSync(__dirname + '/' + file, 'utf8'), ctx, { filename: file }); }
loadJS('cpp-calculator.js'); loadJS('cpp-optimizer.js'); loadJS('canada-tax.js'); loadJS('healthcare-estimator.js'); loadJS('calc.js');

// Low-income scenario: small savings, mostly TFSA, should qualify for GIS
vm.runInContext(`
const inputs = {
    currentAge: 31, currentIncome: 40000, retirementAge: 60, lifeExpectancy: 90,
    annualSpending: 40000, province: 'ON',
    rrsp: 5000, tfsa: 30000, nonReg: 10000, other: 0, cash: 0,
    monthlyContribution: 500,
    contributionSplit: { rrsp: 10, tfsa: 80, nonReg: 10, other: 0, cash: 0 },
    cppStartAge: 65, oasStartAge: 65, healthStatus: 'average', currentDebt: 0,
    returnRate: 6, inflationRate: 2.5, contributionGrowthRate: 0, merFee: 0,
    additionalIncomeSources: [], windfalls: [],
};

const results = RetirementCalcV4.calculate(inputs);
let gisFound = false;
for (const year of results.yearByYear) {
    if (year.age >= 65 && year.age <= 85) {
        const gis = year.gisReceived || 0;
        const wb = year.withdrawalBreakdown || {};
        console.log('Age ' + year.age + ': CPP=$' + year.cppReceived + ' OAS=$' + year.oasReceived + ' GIS=$' + gis + 
            ' RRSP=$' + Math.round(wb.rrsp||0) + ' TFSA=$' + Math.round(wb.tfsa||0) + ' NonReg=$' + Math.round(wb.nonReg||0));
        if (gis > 0) gisFound = true;
    }
}
console.log('GIS FOUND:', gisFound);

// Also test: what if RRSP is 0 and all TFSA?
console.log('\\n--- TFSA-only scenario ---');
const inputs2 = { ...inputs, rrsp: 0, contributionSplit: { rrsp: 0, tfsa: 90, nonReg: 10, other: 0, cash: 0 } };
const results2 = RetirementCalcV4.calculate(inputs2);
for (const year of results2.yearByYear) {
    if (year.age >= 75 && year.age <= 85) {
        const gis = year.gisReceived || 0;
        const wb = year.withdrawalBreakdown || {};
        console.log('Age ' + year.age + ': CPP=$' + year.cppReceived + ' OAS=$' + year.oasReceived + ' GIS=$' + gis + 
            ' RRSP=$' + Math.round(wb.rrsp||0) + ' TFSA=$' + Math.round(wb.tfsa||0));
        if (gis > 0) gisFound = true;
    }
}
console.log('GIS FOUND (TFSA-only):', gisFound);
`, ctx);

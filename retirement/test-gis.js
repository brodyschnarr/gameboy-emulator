// Test GIS calculation end-to-end
const vm = require('vm');
const fs = require('fs');

const ctx = vm.createContext({
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    window: {},
    console,
    Math, parseInt, parseFloat, isNaN, isFinite, Number, String, Array, Object, JSON, Date,
    setTimeout, clearTimeout,
});

function loadJS(file) {
    const code = fs.readFileSync(__dirname + '/' + file, 'utf8');
    vm.runInContext(code, ctx, { filename: file });
}

loadJS('cpp-calculator.js');
loadJS('cpp-optimizer.js');
loadJS('canada-tax.js');
loadJS('healthcare-estimator.js');
loadJS('calc.js');

const testCode = `
const inputs = {
    currentAge: 31,
    currentIncome: 60000,
    retirementAge: 60,
    lifeExpectancy: 90,
    annualSpending: 50000,
    province: 'ON',
    rrsp: 30000,
    tfsa: 50000,
    nonReg: 20000,
    other: 0,
    cash: 0,
    monthlyContribution: 1500,
    contributionSplit: { rrsp: 60, tfsa: 30, nonReg: 10, other: 0, cash: 0 },
    cppStartAge: 65,
    oasStartAge: 65,
    healthStatus: 'average',
    currentDebt: 0,
    returnRate: 6,
    inflationRate: 2.5,
    contributionGrowthRate: 0,
    merFee: 0,
    additionalIncomeSources: [],
    windfalls: [],
};

const results = RetirementCalcV4.calculate(inputs);

console.log('\\n=== GIS TEST ===');
console.log('Projection length:', results.yearByYear.length);

let gisFound = false;
for (const year of results.yearByYear) {
    if (year.age >= 65) {
        const gis = year.gisReceived || 0;
        const cpp = year.cppReceived || 0;
        const oas = year.oasReceived || 0;
        const wb = year.withdrawalBreakdown || {};
        console.log('Age ' + year.age + ': CPP=$' + cpp + ' OAS=$' + oas + ' GIS=$' + gis + ' TFSA=$' + Math.round(wb.tfsa||0) + ' RRSP=$' + Math.round(wb.rrsp||0) + ' NonReg=$' + Math.round(wb.nonReg||0));
        if (gis > 0) gisFound = true;
    }
}

console.log('\\nGIS FOUND:', gisFound);

if (!gisFound) {
    const age77 = results.yearByYear.find(y => y.age === 77);
    if (age77) {
        console.log('\\nAge 77 full:', JSON.stringify(age77, null, 2));
    } else {
        console.log('\\nNo age 77! Last age:', results.yearByYear[results.yearByYear.length-1]?.age);
    }
}
`;

vm.runInContext(testCode, ctx);

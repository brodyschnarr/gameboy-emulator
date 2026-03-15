// Test suite for V4.2 features: RRIF conversion, LIRA/LIF, Tax comparison
const fs = require('fs');
const vm = require('vm');

const scripts = ['canada-tax.js','cpp-calculator.js','benchmarks.js','lifestyle-data.js','regional-data.js','canada-map.js','income-sources.js','cpp-optimizer.js','scenario-manager.js','healthcare-estimator.js','calc.js','tax-optimizer.js','what-if-analyzer.js','safe-withdrawal.js','windfalls.js','monte-carlo.js'];
const sb = {console:{log:()=>{},warn:()=>{},error:()=>{}},Math,Date,setTimeout,clearTimeout,setInterval,clearInterval,parseFloat,parseInt,isNaN,isFinite,Number,String,Array,Object,JSON,Map,Set,Error,TypeError,RangeError,document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},addEventListener:()=>{}}),addEventListener:()=>{}},window:{},navigator:{userAgent:''},alert:()=>{}};
sb.window=sb;
const ctx = vm.createContext(sb);
for (const s of scripts) { try { vm.runInContext(fs.readFileSync(__dirname+'/'+s,'utf8'),ctx) } catch(e) {} }

let passed = 0, failed = 0;
function assert(cond, msg) { if(cond){passed++;console.log('  ✅ '+msg)}else{failed++;console.log('  ❌ FAIL: '+msg)} }

function run(code) { return vm.runInContext(code, ctx); }
function runJSON(code) { return JSON.parse(vm.runInContext('JSON.stringify('+code+')', ctx)); }

const baseInputs = `{
    currentAge:55, retirementAge:65, lifeExpectancy:90,
    familyStatus:'single', currentIncome:100000, annualSpending:50000,
    rrsp:400000, tfsa:100000, nonReg:80000, other:0, cash:10000, lira:0,
    monthlyContribution:2000, contributionSplit:{rrsp:0.5,tfsa:0.3,nonReg:0.2},
    province:'ON', returnRate:6, inflationRate:2.5,
    cppStartAge:65, oasStartAge:65, spendingCurve:'flat', windfalls:[]
}`;

// ═══════════════════════════════════════
console.log('\n═══ TEST GROUP 1: RRIF Minimum Tables ═══');

const rrifMin71 = run('RetirementCalcV4._getRRIFMinimum(71, 500000)');
assert(Math.abs(rrifMin71 - 26400) < 100, `RRIF min at 71 on $500K = $26,400 (got $${Math.round(rrifMin71)})`);

const rrifMin80 = run('RetirementCalcV4._getRRIFMinimum(80, 500000)');
assert(Math.abs(rrifMin80 - 34100) < 100, `RRIF min at 80 on $500K = $34,100 (got $${Math.round(rrifMin80)})`);

const rrifMin60 = run('RetirementCalcV4._getRRIFMinimum(60, 500000)');
assert(rrifMin60 === 0, `RRIF min at 60 = $0 (not yet converted)`);

const lifMax65 = run('RetirementCalcV4._getLIFMaximum(65, 300000)');
assert(lifMax65 > 20000 && lifMax65 < 30000, `LIF max at 65 on $300K in range (got $${Math.round(lifMax65)})`);

const lifMax55 = run('RetirementCalcV4._getLIFMaximum(55, 300000)');
assert(lifMax55 > 15000 && lifMax55 < 25000, `LIF max at 55 on $300K in range (got $${Math.round(lifMax55)})`);

// ═══════════════════════════════════════
console.log('\n═══ TEST GROUP 2: RRIF Mandatory Withdrawals ═══');

const r1 = runJSON(`RetirementCalcV4.calculate(${baseInputs})`);
const y71 = r1.yearByYear.find(y => y.age === 71);
const y70 = r1.yearByYear.find(y => y.age === 70);

assert(y71 !== undefined, 'Year 71 exists in projection');
if (y71) {
    assert(y71.rrifMandatory > 0 || y71.rrsp === 0, `RRIF mandatory at 71 > 0 or RRSP depleted (mandatory=$${y71.rrifMandatory}, rrsp=$${y71.rrsp})`);
}
if (y70) {
    assert(y70.rrifMandatory === 0 || y70.rrifMandatory === undefined, `No RRIF mandatory at 70`);
}

// RRIF mandatory should be withdrawing from RRSP (withdrawal breakdown includes RRSP)
const y75 = r1.yearByYear.find(y => y.age === 75);
if (y71 && y71.rrsp > 0) {
    // With 6% growth and 5.28% min withdrawal, RRSP may not decrease immediately.
    // But the withdrawal breakdown should show RRSP being pulled.
    const hasRRSPWithdrawal = y71.withdrawalBreakdown && y71.withdrawalBreakdown.rrsp > 0;
    assert(hasRRSPWithdrawal, `RRIF mandatory causes RRSP withdrawal at 71 ($${Math.round(y71.withdrawalBreakdown?.rrsp || 0)})`);
}

// ═══════════════════════════════════════
console.log('\n═══ TEST GROUP 3: LIRA Account ═══');

const liraInputs = baseInputs.replace('lira:0', 'lira:200000');
const r2 = runJSON(`RetirementCalcV4.calculate(${liraInputs})`);

// LIRA should grow during accumulation
const y55lira = r2.yearByYear.find(y => y.age === 55);
const y64lira = r2.yearByYear.find(y => y.age === 64);
assert(y55lira && y55lira.lira > 0, `LIRA balance exists at 55 ($${y55lira?.lira})`);
assert(y64lira && y64lira.lira > y55lira.lira, `LIRA grows during accumulation (55: $${y55lira?.lira}, 64: $${y64lira?.lira})`);

// LIRA should have LIF mandatory after 71
const y71lira = r2.yearByYear.find(y => y.age === 71);
if (y71lira && y71lira.lira > 0) {
    assert(y71lira.lifMandatory > 0, `LIF mandatory at 71 > $0 (got $${y71lira.lifMandatory})`);
}

// Total balance includes LIRA
const y65lira = r2.yearByYear.find(y => y.age === 65);
if (y65lira) {
    const sum = (y65lira.rrsp||0) + (y65lira.tfsa||0) + (y65lira.nonReg||0) + (y65lira.other||0) + (y65lira.cash||0) + (y65lira.lira||0);
    assert(Math.abs(y65lira.totalBalance - sum) < 10, `Total balance includes LIRA ($${y65lira.totalBalance} ≈ $${Math.round(sum)})`);
}

// LIRA plan should last longer (more money)
const noLira = runJSON(`RetirementCalcV4.calculate(${baseInputs})`);
assert(r2.summary.moneyLastsAge >= noLira.summary.moneyLastsAge, `LIRA plan lasts at least as long (${r2.summary.moneyLastsAge} >= ${noLira.summary.moneyLastsAge})`);

// ═══════════════════════════════════════
console.log('\n═══ TEST GROUP 4: Tax Strategy Comparison ═══');

const comparison = runJSON(`RetirementCalcV4.compareTaxStrategies(${baseInputs})`);

assert(comparison.smart.totalTax >= 0, `Smart total tax >= 0 ($${comparison.smart.totalTax})`);
assert(comparison.naive.totalTax >= 0, `Naive total tax >= 0 ($${comparison.naive.totalTax})`);
assert(comparison.savings.taxSaved >= 0, `Tax saved >= 0 ($${comparison.savings.taxSaved})`);
console.log(`    Smart tax: $${comparison.smart.totalTax.toLocaleString()}`);
console.log(`    Naive tax: $${comparison.naive.totalTax.toLocaleString()}`);
console.log(`    Tax saved: $${comparison.savings.taxSaved.toLocaleString()}`);
console.log(`    OAS preserved: $${comparison.savings.oasPreserved.toLocaleString()}`);
console.log(`    Total benefit: $${comparison.savings.totalBenefit.toLocaleString()}`);
console.log(`    Smart lasts: ${comparison.smart.moneyLastsAge}, Naive lasts: ${comparison.naive.moneyLastsAge}`);

// With significant RRSP balance, smart should save meaningful tax
if (comparison.smart.totalTax > 10000) {
    assert(comparison.savings.taxSaved > 0, `Smart strategy saves tax with large RRSP`);
}

// ═══════════════════════════════════════
console.log('\n═══ TEST GROUP 5: Naive vs Smart — Known Edge Cases ═══');

// Low income scenario (GIS eligible)
const lowIncomeInputs = baseInputs
    .replace('currentIncome:100000', 'currentIncome:30000')
    .replace('annualSpending:50000', 'annualSpending:22000')
    .replace('rrsp:400000', 'rrsp:50000')
    .replace('tfsa:100000', 'tfsa:20000')
    .replace('nonReg:80000', 'nonReg:5000')
    .replace('monthlyContribution:2000', 'monthlyContribution:300');

const lowComp = runJSON(`RetirementCalcV4.compareTaxStrategies(${lowIncomeInputs})`);
console.log(`    Low-income: Smart tax=$${lowComp.smart.totalTax}, Naive tax=$${lowComp.naive.totalTax}`);
console.log(`    GIS preserved: $${lowComp.savings.gisPreserved}`);

// High RRSP scenario (OAS clawback risk)
const highRRSP = baseInputs
    .replace('rrsp:400000', 'rrsp:800000')
    .replace('currentIncome:100000', 'currentIncome:150000');

const highComp = runJSON(`RetirementCalcV4.compareTaxStrategies(${highRRSP})`);
console.log(`    High RRSP: Smart tax=$${highComp.smart.totalTax}, Naive tax=$${highComp.naive.totalTax}`);
console.log(`    OAS preserved: $${highComp.savings.oasPreserved}`);
console.log(`    Tax saved: $${highComp.savings.taxSaved}`);

// ═══════════════════════════════════════
console.log('\n═══ TEST GROUP 6: Backward Compatibility ═══');

// Existing inputs without LIRA should still work
const oldInputs = `{
    currentAge:30, retirementAge:65, lifeExpectancy:90,
    familyStatus:'single', currentIncome:80000, annualSpending:48000,
    rrsp:50000, tfsa:30000, nonReg:20000, other:0, cash:5000,
    monthlyContribution:1000, contributionSplit:{rrsp:0.4,tfsa:0.4,nonReg:0.2},
    province:'ON', returnRate:6, inflationRate:2.5,
    cppStartAge:65, oasStartAge:65, spendingCurve:'flat', windfalls:[]
}`;

const oldResult = runJSON(`RetirementCalcV4.calculate(${oldInputs})`);
assert(oldResult.summary.moneyLastsAge > 0, `Old inputs still work (lasts to ${oldResult.summary.moneyLastsAge})`);
assert(oldResult.yearByYear.length > 0, `Old inputs produce year-by-year data`);

// Check LIRA defaults to 0
const y65old = oldResult.yearByYear.find(y => y.age === 65);
assert(y65old && (y65old.lira === 0 || y65old.lira === undefined), 'LIRA defaults to 0 for old inputs');

// ═══════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

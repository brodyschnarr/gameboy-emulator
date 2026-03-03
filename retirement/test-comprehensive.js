const vm = require('vm');
const fs = require('fs');

// Load all dependencies
vm.runInThisContext(fs.readFileSync('canada-tax.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('cpp-calculator.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('cpp-optimizer.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('healthcare-estimator.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('calc.js', 'utf8'));

let passed = 0, failed = 0;
function assert(name, condition, detail) {
    if (condition) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

function runCalc(overrides = {}) {
    const base = {
        currentAge: 35, retirementAge: 65, lifeExpectancy: 90,
        province: 'ON', region: 'toronto', familyStatus: 'single',
        currentIncome: 100000, income1: 0, income2: 0,
        rrsp: 100000, tfsa: 50000, nonReg: 30000, other: 0,
        monthlyContribution: 2000,
        contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 },
        annualSpending: 60000, healthStatus: 'average',
        currentDebt: 0, debtPayoffAge: 65,
        cppStartAge: 65, returnRate: 6, inflationRate: 2,
        contributionGrowthRate: 0, merFee: 0,
        oasStartAge: 65, additionalIncomeSources: [], windfalls: []
    };
    return RetirementCalcV4.calculate({ ...base, ...overrides });
}

// ══════════════════════════════════════
console.log('\n📊 GROUP 1: Single — Basic Inputs');
// ══════════════════════════════════════

const s1 = runCalc();
assert('Single: returns projection', s1.yearByYear.length > 0);
assert('Single: has accumulation years', s1.yearByYear.filter(y => y.phase === 'accumulation').length === 30);
assert('Single: has retirement years', s1.yearByYear.filter(y => y.phase === 'retirement').length === 26);
assert('Single: portfolio grows during accumulation', s1.summary.portfolioAtRetirement > 100000 + 50000 + 30000);
assert('Single: CPP present', s1.govBenefits.cpp1 > 0);
assert('Single: CPP2 is zero', s1.govBenefits.cpp2 === 0);
assert('Single: OAS present', s1.govBenefits.oasPerPerson1 > 0);
assert('Single: probability is number', typeof s1.probability === 'number' && s1.probability >= 0);

// ══════════════════════════════════════
console.log('\n📊 GROUP 2: Couple — Basic Inputs');
// ══════════════════════════════════════

const c1 = runCalc({
    familyStatus: 'couple', currentIncome: 0,
    income1: 100000, income2: 80000, partnerAge: 33
});
assert('Couple: returns projection', c1.yearByYear.length > 0);
assert('Couple: CPP1 > 0', c1.govBenefits.cpp1 > 0);
assert('Couple: CPP2 > 0', c1.govBenefits.cpp2 > 0);
assert('Couple: CPP total = CPP1 + CPP2', c1.govBenefits.cppTotal === c1.govBenefits.cpp1 + c1.govBenefits.cpp2);
assert('Couple: OAS1 > 0', c1.govBenefits.oasPerPerson1 > 0);
assert('Couple: OAS2 > 0', c1.govBenefits.oasPerPerson2 > 0);
assert('Couple: OAS total = OAS1 + OAS2', c1.govBenefits.oasTotal === c1.govBenefits.oasPerPerson1 + c1.govBenefits.oasPerPerson2);

// ══════════════════════════════════════
console.log('\n📊 GROUP 3: CPP Start Age');
// ══════════════════════════════════════

const cppEarly = runCalc({ cppStartAge: 60 });
const cppNormal = runCalc({ cppStartAge: 65 });
const cppLate = runCalc({ cppStartAge: 70 });
assert('CPP at 60 < CPP at 65', cppEarly.govBenefits.cpp1 < cppNormal.govBenefits.cpp1);
assert('CPP at 70 > CPP at 65', cppLate.govBenefits.cpp1 > cppNormal.govBenefits.cpp1);

// Retirement year check: CPP should appear at correct age
const cppEarlyRetYears = cppEarly.yearByYear.filter(y => y.phase === 'retirement');
const ageWhenCPPStarts60 = cppEarlyRetYears.find(y => y.cppReceived > 0);
assert('CPP income starts at age 60 (retire 65 so first CPP at 65)', 
    ageWhenCPPStarts60 && ageWhenCPPStarts60.age === 65,
    `starts at age ${ageWhenCPPStarts60?.age}`);

// Try retiring at 58 to test CPP at 60
const earlyRetire = runCalc({ cppStartAge: 60, retirementAge: 58 });
const earlyRetYears = earlyRetire.yearByYear.filter(y => y.phase === 'retirement');
const cppAt60 = earlyRetYears.find(y => y.age === 60);
const cppAt59 = earlyRetYears.find(y => y.age === 59);
assert('CPP at 60: income at age 60 > 0', cppAt60 && cppAt60.cppReceived > 0, `cppReceived=${cppAt60?.cppReceived}`);
assert('CPP at 60: no income at age 59', cppAt59 && cppAt59.cppReceived === 0, `cppReceived=${cppAt59?.cppReceived}`);

// Couple CPP start ages
const coupleCPP = runCalc({
    familyStatus: 'couple', income1: 100000, income2: 80000,
    cppStartAge: 60, cppStartAgeP2: 70, retirementAge: 58
});
const cplRetYears = coupleCPP.yearByYear.filter(y => y.phase === 'retirement');
const cplAt60 = cplRetYears.find(y => y.age === 60);
const cplAt69 = cplRetYears.find(y => y.age === 69);
const cplAt70 = cplRetYears.find(y => y.age === 70);
assert('Couple: P1 CPP starts at 60', cplAt60 && cplAt60.cppReceived > 0);
assert('Couple: P2 CPP not yet at 69', cplAt69 && cplAt69.cppReceived === cplAt60.cppReceived,
    `at 69: ${cplAt69?.cppReceived}, at 60: ${cplAt60?.cppReceived}`);
assert('Couple: P2 CPP starts at 70 (more total CPP)', cplAt70 && cplAt70.cppReceived > cplAt69.cppReceived,
    `at 70: ${cplAt70?.cppReceived} vs 69: ${cplAt69?.cppReceived}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 4: CPP Override');
// ══════════════════════════════════════

const cppOvr = runCalc({ cppOverride: 10000, cppStartAge: 65 });
assert('CPP override: uses override value', cppOvr.govBenefits.cpp1 === 10000,
    `got ${cppOvr.govBenefits.cpp1}`);

const cppOvrCouple = runCalc({
    familyStatus: 'couple', income1: 100000, income2: 80000,
    cppOverride: 12000, cppOverrideP2: 8000, cppStartAge: 65, cppStartAgeP2: 65
});
assert('Couple CPP override P1', cppOvrCouple.govBenefits.cpp1 === 12000, `got ${cppOvrCouple.govBenefits.cpp1}`);
assert('Couple CPP override P2', cppOvrCouple.govBenefits.cpp2 === 8000, `got ${cppOvrCouple.govBenefits.cpp2}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 5: OAS Start Age');
// ══════════════════════════════════════

const oas65 = runCalc({ oasStartAge: 65, retirementAge: 60 });
const oas70 = runCalc({ oasStartAge: 70, retirementAge: 60 });
assert('OAS at 70 > OAS at 65 (36% deferral bonus)', oas70.govBenefits.oasPerPerson1 > oas65.govBenefits.oasPerPerson1);
const oasBonusPct = (oas70.govBenefits.oasPerPerson1 / oas65.govBenefits.oasPerPerson1 - 1) * 100;
assert('OAS deferral bonus ~36%', Math.abs(oasBonusPct - 36) < 1, `got ${oasBonusPct.toFixed(1)}%`);

// OAS timing in projection
const oas65Years = oas65.yearByYear.filter(y => y.phase === 'retirement');
const oasAt64 = oas65Years.find(y => y.age === 64);
const oasAt65 = oas65Years.find(y => y.age === 65);
assert('OAS: no income at 64', oasAt64 && oasAt64.oasReceived === 0);
assert('OAS: income starts at 65', oasAt65 && oasAt65.oasReceived > 0);

// Couple OAS different start ages
const coupleOAS = runCalc({
    familyStatus: 'couple', income1: 100000, income2: 80000,
    oasStartAge: 65, oasStartAgeP2: 70, retirementAge: 60
});
const oasCplYears = coupleOAS.yearByYear.filter(y => y.phase === 'retirement');
const oasCplAt65 = oasCplYears.find(y => y.age === 65);
const oasCplAt69 = oasCplYears.find(y => y.age === 69);
const oasCplAt70 = oasCplYears.find(y => y.age === 70);
assert('Couple OAS: P1 starts at 65', oasCplAt65 && oasCplAt65.oasReceived > 0);
assert('Couple OAS: only P1 at 69', oasCplAt69 && oasCplAt69.oasReceived === oasCplAt65.oasReceived,
    `at 69: ${oasCplAt69?.oasReceived}, at 65: ${oasCplAt65?.oasReceived}`);
assert('Couple OAS: P2 starts at 70', oasCplAt70 && oasCplAt70.oasReceived > oasCplAt69.oasReceived,
    `at 70: ${oasCplAt70?.oasReceived} vs 69: ${oasCplAt69?.oasReceived}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 6: OAS Clawback — Per-Person for Couples');
// ══════════════════════════════════════

// Couple where combined is over $91K but each individually under
const clawCouple = runCalc({
    familyStatus: 'couple', income1: 60000, income2: 40000,
    rrsp: 50000, tfsa: 200000, nonReg: 50000,
    annualSpending: 30000, retirementAge: 65, cppStartAge: 65, cppStartAgeP2: 65
});
const clawCplAt65 = clawCouple.yearByYear.find(y => y.age === 65);
const totalOASExpected = clawCouple.govBenefits.oasPerPerson1 + clawCouple.govBenefits.oasPerPerson2;
assert('Couple clawback: at 65 OAS received close to full',
    clawCplAt65 && Math.abs(clawCplAt65.oasReceived - totalOASExpected) < 500,
    `received ${clawCplAt65?.oasReceived}, expected ~${totalOASExpected}`);

// Single with high RRSP withdrawal — should trigger clawback
const clawSingle = runCalc({
    rrsp: 2000000, tfsa: 0, nonReg: 0, annualSpending: 120000,
    retirementAge: 65, cppStartAge: 65
});
const clawSAt65 = clawSingle.yearByYear.find(y => y.age === 65);
assert('Single clawback: high income reduces OAS',
    clawSAt65 && clawSAt65.oasReceived < clawSingle.govBenefits.oasPerPerson1,
    `received ${clawSAt65?.oasReceived} vs max ${clawSingle.govBenefits.oasPerPerson1}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 7: Contribution Growth');
// ══════════════════════════════════════

const noGrowth = runCalc({ contributionGrowthRate: 0 });
const withGrowth = runCalc({ contributionGrowthRate: 3 });
assert('Contribution growth: higher portfolio at retirement',
    withGrowth.summary.portfolioAtRetirement > noGrowth.summary.portfolioAtRetirement,
    `${withGrowth.summary.portfolioAtRetirement} vs ${noGrowth.summary.portfolioAtRetirement}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 8: MER/Fees');
// ══════════════════════════════════════

const noFee = runCalc({ merFee: 0 });
const withFee = runCalc({ merFee: 1.5 });
assert('MER reduces portfolio at retirement',
    withFee.summary.portfolioAtRetirement < noFee.summary.portfolioAtRetirement,
    `with fee: ${withFee.summary.portfolioAtRetirement} vs no fee: ${noFee.summary.portfolioAtRetirement}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 9: Windfalls');
// ══════════════════════════════════════

const noWindfall = runCalc();
const withWindfall = runCalc({
    windfalls: [{ year: 50, amount: 500000, taxable: false, destination: 'tfsa' }]
});
assert('Windfall increases portfolio',
    withWindfall.summary.portfolioAtRetirement > noWindfall.summary.portfolioAtRetirement);

// Windfall at specific age appears in projection
const wfYear = withWindfall.yearByYear.find(y => y.age === 50);
const wfPrevYear = withWindfall.yearByYear.find(y => y.age === 49);
const noWfYear = noWindfall.yearByYear.find(y => y.age === 50);
assert('Windfall at age 50: TFSA jumps',
    wfYear.tfsa > noWfYear.tfsa,
    `with: ${wfYear.tfsa} vs without: ${noWfYear.tfsa}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 10: Debt');
// ══════════════════════════════════════

const noDebt = runCalc({ currentDebt: 0 });
const withDebt = runCalc({ currentDebt: 50000, debtPayoffAge: 45 });
// Debt should be tracked in accumulation
const debtAt36 = withDebt.yearByYear.find(y => y.age === 36);
const debtAt46 = withDebt.yearByYear.find(y => y.age === 46);
assert('Debt at 36 > 0', debtAt36 && debtAt36.debt > 0, `debt=${debtAt36?.debt}`);
assert('Debt at 46 = 0 (paid off by 45)', debtAt46 && debtAt46.debt === 0, `debt=${debtAt46?.debt}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 11: Additional Income Sources');
// ══════════════════════════════════════

const noAddl = runCalc({ retirementAge: 60 });
const withAddl = runCalc({
    retirementAge: 60,
    additionalIncomeSources: [{ startAge: 60, endAge: 65, annualAmount: 30000 }]
});
const addlAt62 = withAddl.yearByYear.find(y => y.age === 62);
const addlAt66 = withAddl.yearByYear.find(y => y.age === 66);
assert('Additional income at 62', addlAt62 && addlAt62.additionalIncome === 30000,
    `got ${addlAt62?.additionalIncome}`);
assert('Additional income stops at 66', addlAt66 && addlAt66.additionalIncome === 0,
    `got ${addlAt66?.additionalIncome}`);
assert('Additional income improves longevity',
    withAddl.summary.moneyLastsAge >= noAddl.summary.moneyLastsAge);

// ══════════════════════════════════════
console.log('\n📊 GROUP 12: Partner Age');
// ══════════════════════════════════════

// Partner age affects CPP contribution years for person 2
const sameAge = runCalc({
    familyStatus: 'couple', income1: 100000, income2: 80000, partnerAge: 35
});
const youngerPartner = runCalc({
    familyStatus: 'couple', income1: 100000, income2: 80000, partnerAge: 30
});
// Younger partner has fewer years of CPP contributions
assert('Younger partner: fewer CPP years = lower CPP2',
    youngerPartner.govBenefits.cpp2 <= sameAge.govBenefits.cpp2,
    `younger: ${youngerPartner.govBenefits.cpp2} vs same: ${sameAge.govBenefits.cpp2}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 13: Withdrawal Strategy — Smart Ordering');
// ══════════════════════════════════════

// Pre-OAS (retire at 55, no CPP/OAS yet): should use TFSA first
const preOAS = runCalc({
    retirementAge: 55, cppStartAge: 65, oasStartAge: 65,
    rrsp: 200000, tfsa: 200000, nonReg: 200000, annualSpending: 40000
});
const preOASYear = preOAS.yearByYear.find(y => y.age === 55);
assert('Pre-OAS: TFSA withdrawn first',
    preOASYear && preOASYear.withdrawalBreakdown.tfsa > 0,
    `TFSA: ${preOASYear?.withdrawalBreakdown?.tfsa}, RRSP: ${preOASYear?.withdrawalBreakdown?.rrsp}`);

// Post-OAS (at 65): should cap RRSP to avoid clawback
const postOAS = runCalc({
    retirementAge: 65, cppStartAge: 65, oasStartAge: 65,
    rrsp: 500000, tfsa: 200000, nonReg: 200000, annualSpending: 50000
});
const postOASYear = postOAS.yearByYear.find(y => y.age === 65);
assert('Post-OAS: uses RRSP (clawback-aware)',
    postOASYear && postOASYear.withdrawalBreakdown.rrsp > 0);
assert('Post-OAS: taxable income under clawback threshold (single)',
    postOASYear && postOASYear.taxableIncome < 95000,
    `taxableIncome=${postOASYear?.taxableIncome}`);

// ══════════════════════════════════════
console.log('\n📊 GROUP 14: Return Rate & Inflation');
// ══════════════════════════════════════

const lowReturn = runCalc({ returnRate: 3 });
const highReturn = runCalc({ returnRate: 8 });
assert('Higher return = larger portfolio',
    highReturn.summary.portfolioAtRetirement > lowReturn.summary.portfolioAtRetirement);

const lowInf = runCalc({ inflationRate: 1 });
const highInf = runCalc({ inflationRate: 4 });
assert('Higher inflation = money lasts shorter',
    highInf.summary.moneyLastsAge <= lowInf.summary.moneyLastsAge);

// ══════════════════════════════════════
console.log('\n📊 GROUP 15: Province Affects Tax');
// ══════════════════════════════════════

const onResult = runCalc({ province: 'ON' });
const abResult = runCalc({ province: 'AB' });
// Alberta has lower provincial tax
assert('Alberta vs Ontario: different tax outcomes',
    onResult.yearByYear.find(y => y.age === 65)?.taxPaid !== abResult.yearByYear.find(y => y.age === 65)?.taxPaid);

// ══════════════════════════════════════
console.log('\n📊 GROUP 16: Edge Cases');
// ══════════════════════════════════════

// Zero contributions
const zeroContrib = runCalc({ monthlyContribution: 0 });
assert('Zero contributions: still runs', zeroContrib.yearByYear.length > 0);
assert('Zero contributions: portfolio still grows (returns on existing)',
    zeroContrib.summary.portfolioAtRetirement > 100000 + 50000 + 30000);

// Single with income1/income2 = 0 (uses currentIncome)
const singleIncome = runCalc({ currentIncome: 80000, income1: 0, income2: 0 });
assert('Single uses currentIncome for CPP', singleIncome.govBenefits.cpp1 > 0);

// Couple where P2 income is 0
const oneIncome = runCalc({
    familyStatus: 'couple', income1: 100000, income2: 0
});
assert('Couple with P2 income=0: CPP2 = 0', oneIncome.govBenefits.cpp2 === 0);
assert('Couple with P2 income=0: OAS2 still present', oneIncome.govBenefits.oasPerPerson2 > 0);

// ══════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);

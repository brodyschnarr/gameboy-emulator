#!/usr/bin/env node
/**
 * Test Suite: V6 UI Features
 * Map affordability, couple separate accounts, NaN guards, Deep Dive granularity
 */

global.document = { getElementById: () => null, querySelectorAll: () => [] };
const origLog = console.log;
console.log = () => {};
const fs = require('fs');
const files = ['canada-tax.js', 'cpp-calculator.js', 'cpp-optimizer.js', 'healthcare-estimator.js', 'calc.js', 'monte-carlo.js'];
eval(files.map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n;\n').replace(/^const /gm, 'var '));
if (typeof IncomeSources === 'undefined') global.IncomeSources = { sources: [], getAll() { return this.sources; } };
// Load regional data + canada map
eval(fs.readFileSync(__dirname + '/regional-data.js', 'utf8').replace(/^const /gm, 'var '));
eval(fs.readFileSync(__dirname + '/canada-map.js', 'utf8').replace(/^const /gm, 'var '));
// Load deep dive
eval(fs.readFileSync(__dirname + '/deep-dive.js', 'utf8').replace(/^const /gm, 'var '));
console.log = origLog;

let passed = 0, failed = 0;
function assert(condition, msg) {
    if (condition) { passed++; console.log(`  ✅ ${msg}`); }
    else { failed++; console.log(`  ❌ ${msg}`); }
}

function baseInputs(overrides = {}) {
    return {
        currentAge: 35, retirementAge: 65, lifeExpectancy: 90,
        province: 'ON', region: 'toronto', familyStatus: 'single',
        currentIncome: 80000,
        rrsp: 50000, tfsa: 30000, nonReg: 10000, other: 0, cash: 0,
        monthlyContribution: 1500, contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 },
        annualSpending: 45000, spendingCurve: 'flat',
        healthStatus: 'average',
        currentDebt: 0, debtPayoffAge: 35,
        cppStartAge: 65, oasStartAge: 65,
        returnRate: 5.5, inflationRate: 2.5,
        contributionGrowthRate: 0, merFee: 0.25,
        _withdrawalStrategy: 'smart',
        ...overrides
    };
}

// ════════════════════════════════════════
console.log('\n📊 1. Map Affordability Data');
// ════════════════════════════════════════

{
    assert(CanadaMap._provinceAffordability !== undefined, 'Affordability data exists');
    assert(Object.keys(CanadaMap._provinceAffordability).length === 10, 'All 10 provinces have affordability data');
    
    // Check tiers are valid
    const validTiers = ['high', 'mid', 'low'];
    let allValid = true;
    for (const [prov, data] of Object.entries(CanadaMap._provinceAffordability)) {
        if (!validTiers.includes(data.tier)) { allValid = false; }
        if (!data.label) { allValid = false; }
    }
    assert(allValid, 'All provinces have valid tier and label');
    
    // BC and ON should be expensive
    assert(CanadaMap._provinceAffordability.BC.tier === 'low', 'BC is expensive (low affordability)');
    assert(CanadaMap._provinceAffordability.ON.tier === 'low', 'ON is expensive');
    // SK and MB should be affordable
    assert(CanadaMap._provinceAffordability.SK.tier === 'high', 'SK is affordable');
    assert(CanadaMap._provinceAffordability.MB.tier === 'high', 'MB is affordable');
}

// ════════════════════════════════════════
console.log('\n📊 2. Map Label Positions');
// ════════════════════════════════════════

{
    assert(Object.keys(CanadaMap._labels).length === 10, 'All 10 provinces have labels');
    assert(Object.keys(CanadaMap._paths).length === 10, 'All 10 provinces have paths');
    
    // Every label should have a corresponding path
    let allMatch = true;
    for (const prov of Object.keys(CanadaMap._labels)) {
        if (!CanadaMap._paths[prov]) { allMatch = false; }
    }
    assert(allMatch, 'Every label has a corresponding path');
}

// ════════════════════════════════════════
console.log('\n📊 3. Map SVG Generation');
// ════════════════════════════════════════

{
    const svg = CanadaMap._getMapSVG();
    assert(svg.includes('<svg'), 'SVG contains svg element');
    assert(svg.includes('province-path'), 'SVG contains province paths');
    assert(svg.includes('province-label'), 'SVG contains province labels');
    // Affordability is on region buttons now, not SVG
    assert(!svg.includes('province-indicator'), 'SVG no longer has inline affordability indicators');
    
    // White stroke (fixes gaps)
    assert(svg.includes('stroke: #fff'), 'Provinces use white stroke (fixes gaps)');
}

// ════════════════════════════════════════
console.log('\n📊 4. Location Tracking');
// ════════════════════════════════════════

{
    // Mock localStorage
    const storage = {};
    global.localStorage = { 
        getItem: (k) => storage[k] || null, 
        setItem: (k, v) => { storage[k] = v; } 
    };
    global.navigator = { userAgent: 'test-agent', sendBeacon: null };
    
    CanadaMap._trackLocationSelection('ON', 'toronto');
    const events = JSON.parse(storage['rc_location_events'] || '[]');
    assert(events.length === 1, 'Location event stored');
    assert(events[0].province === 'ON', 'Province recorded correctly');
    assert(events[0].region === 'toronto', 'Region recorded correctly');
    assert(events[0].timestamp, 'Timestamp recorded');
    
    // Test multiple events
    CanadaMap._trackLocationSelection('BC', 'vancouver');
    const events2 = JSON.parse(storage['rc_location_events']);
    assert(events2.length === 2, 'Multiple events stored');
}

// ════════════════════════════════════════
console.log('\n📊 5. Couple Mode — Separate Accounts Sum Correctly');
// ════════════════════════════════════════

{
    // Separate accounts: person 1 has $100K RRSP, person 2 has $50K RRSP
    // Combined should equal $150K
    const combined = baseInputs({ rrsp: 150000, tfsa: 80000, nonReg: 30000 });
    const rCombined = RetirementCalcV4.calculate(combined);
    
    // Same total but split differently between people shouldn't change results
    // (since calc.js pools accounts anyway)
    assert(rCombined && rCombined.yearByYear, 'Combined couple calculation runs');
    
    const retRow = rCombined.yearByYear.find(y => y.age === 65);
    assert(retRow && retRow.rrsp > 0, 'Combined RRSP grows to retirement');
}

{
    // Couple mode with separate incomes
    const coupleInputs = baseInputs({
        familyStatus: 'couple',
        partnerAge: 33,
        income1: 80000,
        income2: 60000,
        rrsp: 150000,
        tfsa: 80000,
        nonReg: 30000,
        cppStartAgeP2: 65,
        oasStartAgeP2: 65
    });
    const r = RetirementCalcV4.calculate(coupleInputs);
    assert(r && r.yearByYear, 'Couple mode with separate incomes runs');
    
    const retRow = r.yearByYear.find(y => y.age === 65);
    // Couple should have higher gov benefits (2x CPP, 2x OAS)
    assert(retRow && retRow.cppReceived > 15000, `Couple CPP: $${Math.round(retRow.cppReceived || 0)} (should be > $15K for two people)`);
}

// ════════════════════════════════════════
console.log('\n📊 6. Deep Dive — Granular Year Detail');
// ════════════════════════════════════════

{
    const inputs = baseInputs();
    const results = RetirementCalcV4.calculate(inputs);
    const html = DeepDive.generate(results, inputs, 'Your Plan');
    
    // Check for granular sections
    assert(html.includes('Account Balances'), 'Year detail has Account Balances section');
    assert(html.includes('Income Sources'), 'Year detail has Income Sources section');
    assert(html.includes('Taxes & Spending'), 'Year detail has Taxes & Spending section');
    
    // Check specific fields are present
    assert(html.includes('RRSP withdrawal') || html.includes('RRSP'), 'Shows RRSP details');
    assert(html.includes('CPP'), 'Shows CPP income');
    assert(html.includes('OAS'), 'Shows OAS income');
    assert(html.includes('Taxable income'), 'Shows taxable income');
    assert(html.includes('Tax paid'), 'Shows tax paid');
    assert(html.includes('After-tax income'), 'Shows after-tax income');
    assert(html.includes('Target spending'), 'Shows target spending');
    assert(html.includes('Total Portfolio'), 'Shows total portfolio');
    assert(html.includes('Gross Income'), 'Shows gross income');
    
    // No NaN or undefined
    const nanCount = (html.match(/NaN/g) || []).length;
    const undefCount = (html.match(/undefined/g) || []).length;
    assert(nanCount === 0, `No NaN in Deep Dive output (found ${nanCount})`);
    assert(undefCount === 0, `No undefined in Deep Dive output (found ${undefCount})`);
}

{
    // Deep Dive with LIRA
    const inputs = baseInputs({ lira: 200000, liraProvince: 'ON' });
    const results = RetirementCalcV4.calculate(inputs);
    const html = DeepDive.generate(results, inputs, 'With LIRA');
    assert(html.includes('LIRA'), 'LIRA shows in Deep Dive year detail');
}

{
    // Deep Dive with employer pension
    const inputs = baseInputs({ employerPension: 2000, employerPensionStartAge: 65 });
    const results = RetirementCalcV4.calculate(inputs);
    const html = DeepDive.generate(results, inputs, 'With Pension');
    assert(html.includes('Pension'), 'Pension shows in Deep Dive year detail');
}

// ════════════════════════════════════════
console.log('\n📊 7. Deep Dive — All Three Strategies');
// ════════════════════════════════════════

{
    const inputs = baseInputs();
    const smart = RetirementCalcV4.calculate(inputs);
    const advisor = RetirementCalcV4.calculate({ ...inputs, _withdrawalStrategy: 'naive' });
    const opt = RetirementCalcV4.optimizePlan(inputs);
    
    let allOK = true;
    for (const [label, results, inp] of [
        ['Your Plan', smart, inputs],
        ['Advisor', advisor, { ...inputs, _withdrawalStrategy: 'naive' }],
        ['Optimized', opt.result, opt.inputs]
    ]) {
        try {
            const html = DeepDive.generate(results, inp, label);
            if (html.includes('NaN') || html.includes('undefined')) allOK = false;
        } catch (e) {
            allOK = false;
            console.log(`    ⚠️ ${label} failed: ${e.message}`);
        }
    }
    assert(allOK, 'Deep Dive works for all three strategies without NaN/undefined');
}

// ════════════════════════════════════════
console.log('\n📊 8. Regional Data — All Provinces Have Regions');
// ════════════════════════════════════════

{
    const provinces = ['AB', 'BC', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL'];
    let allHaveRegions = true;
    for (const prov of provinces) {
        const regions = RegionalDataV2.getRegionsByProvince(prov);
        if (!regions || regions.length === 0) {
            allHaveRegions = false;
            console.log(`    ⚠️ ${prov} has no regions`);
        }
    }
    assert(allHaveRegions, 'All 10 provinces have at least one region');
}

// ════════════════════════════════════════
console.log('\n📊 9. Edge Cases — Empty/Zero Accounts');
// ════════════════════════════════════════

{
    // All accounts zero
    const inputs = baseInputs({ rrsp: 0, tfsa: 0, nonReg: 0, other: 0, cash: 0 });
    const r = RetirementCalcV4.calculate(inputs);
    assert(r && r.yearByYear, 'Zero accounts scenario runs');
    
    // Deep Dive with zero accounts
    try {
        const html = DeepDive.generate(r, inputs, 'Zero Accounts');
        assert(!html.includes('NaN'), 'Deep Dive with zero accounts has no NaN');
    } catch (e) {
        assert(false, `Deep Dive with zero accounts: ${e.message}`);
    }
}

{
    // Very large accounts
    const inputs = baseInputs({ rrsp: 5000000, tfsa: 2000000, nonReg: 3000000 });
    const r = RetirementCalcV4.calculate(inputs);
    assert(r && r.yearByYear, 'Very large accounts scenario runs');
}

// ════════════════════════════════════════
console.log('\n📊 10. Couple Mode — Both CPP/OAS Ages');
// ════════════════════════════════════════

{
    // Person 1 defers CPP to 70, Person 2 takes at 60
    const inputs = baseInputs({
        familyStatus: 'couple', partnerAge: 33,
        income1: 100000, income2: 50000,
        cppStartAge: 70, cppStartAgeP2: 60,
        oasStartAge: 67, oasStartAgeP2: 65
    });
    const r = RetirementCalcV4.calculate(inputs);
    assert(r && r.yearByYear, 'Couple with different CPP/OAS ages runs');
    
    // At age 65, only person 2 should have CPP (person 1 deferred to 70)
    const age65 = r.yearByYear.find(y => y.age === 65);
    // At age 70, both should have CPP
    const age70 = r.yearByYear.find(y => y.age === 70);
    if (age65 && age70) {
        assert(age70.cppReceived > age65.cppReceived, 
            `CPP at 70 ($${Math.round(age70.cppReceived)}) > CPP at 65 ($${Math.round(age65.cppReceived)}) — person 1 starts at 70`);
    }
}

// ════════════════════════════════════════
console.log('\n📊 11. Province Tax Variation');
// ════════════════════════════════════════

{
    // Alberta should have lower taxes than Quebec at same income
    const abTax = CanadianTax.calculateTax(80000, 'AB', {});
    const qcTax = CanadianTax.calculateTax(80000, 'QC', {});
    assert(abTax.total < qcTax.total, `AB tax ($${Math.round(abTax.total)}) < QC tax ($${Math.round(qcTax.total)}) at $80K`);
}

// ══════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) console.log('✅ ALL V6 UI TESTS PASSED');
else console.log('❌ SOME TESTS FAILED');
console.log('══════════════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);

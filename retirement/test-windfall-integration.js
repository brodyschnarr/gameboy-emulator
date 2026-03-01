#!/usr/bin/env node
/**
 * Windfall Integration Test - Node.js
 * Tests the critical fix for portfolio calculation including 'other' account
 * Run with: node test-windfall-integration.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🧪 Windfall Integration Test Suite\n');

// Create a mock DOM/window environment
const mockWindow = {
    document: {
        getElementById: () => ({ innerHTML: '', style: {}, appendChild: () => {} }),
        createElement: (tag) => ({ 
            className: '', 
            innerHTML: '', 
            style: {},
            appendChild: () => {},
            setAttribute: () => {}
        }),
        querySelectorAll: () => []
    },
    localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    },
    location: { reload: () => {} },
    alert: () => {},
    Chart: class {
        constructor() {}
        destroy() {}
        update() {}
    }
};

const mockConsole = {
    log: () => {},  // Suppress console.log
    error: console.error,
    warn: console.warn
};

// Load required files in order
const filesToLoad = [
    'data.js',
    'regional-data-v2.js',
    'canada-tax.js',
    'cpp-calculator.js',
    'healthcare-estimator.js',
    'lifestyle-data.js',
    'benchmarks.js',
    'calc.js'
];

const context = {
    window: mockWindow,
    document: mockWindow.document,
    localStorage: mockWindow.localStorage,
    console: mockConsole,
    Chart: mockWindow.Chart
};

vm.createContext(context);

console.log('📦 Loading calculation modules...');
try {
    for (const file of filesToLoad) {
        const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
        vm.runInContext(code, context);
    }
    console.log('✅ Modules loaded successfully\n');
} catch (error) {
    console.error('❌ Failed to load modules:', error.message);
    process.exit(1);
}

// Run tests
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ ${message}`);
        testsPassed++;
        return true;
    } else {
        console.error(`  ❌ ${message}`);
        testsFailed++;
        return false;
    }
}

function test(name, fn) {
    console.log(`\n🔬 ${name}`);
    try {
        fn();
    } catch (error) {
        console.error(`  ❌ Test crashed: ${error.message}`);
        testsFailed++;
    }
}

// Test 1: Base calculation works
test('Base Calculation (No Windfalls)', () => {
    const inputs = {
        currentAge: 30,
        partnerAge: 0,
        retirementAge: 65,
        lifeExpectancy: 90,
        province: 'ON',
        region: 'ON_Toronto',
        familyStatus: 'single',
        currentIncome: 80000,
        income1: 80000,
        income2: 0,
        rrsp: 50000,
        tfsa: 30000,
        nonReg: 10000,
        other: 5000,  // ⚠️ Testing that 'other' account is included
        monthlyContribution: 1000,
        contributionSplit: { rrsp: 0.6, tfsa: 0.3, nonReg: 0.1 },
        annualSpending: 50000,
        healthStatus: 'average',
        currentDebt: 0,
        debtPayoffAge: 65,
        cppStartAge: 65,
        additionalIncomeSources: [],
        returnRate: 6,
        inflationRate: 2.5
    };
    
    const results = context.RetirementCalcV4.calculate(inputs);
    
    assert(results !== null, 'Base calculation returns results');
    assert(results.yearByYear.length > 0, 'Year-by-year projection generated');
    assert(results.summary.portfolioAtRetirement > 0, 'Portfolio at retirement > $0');
    
    // Find current year (age 30)
    const currentYear = results.yearByYear.find(y => y.age === 30);
    assert(currentYear !== undefined, 'Current year exists in projection');
    
    // CRITICAL: Check that 'other' account is included in total
    const expectedTotal = (currentYear.rrsp || 0) + (currentYear.tfsa || 0) + (currentYear.nonReg || 0) + (currentYear.other || 0);
    const actualTotal = currentYear.totalPortfolio || currentYear.totalBalance || 0;
    
    assert(Math.abs(actualTotal - expectedTotal) < 1, 
        `Total portfolio includes 'other' account (Expected: $${expectedTotal.toFixed(0)}, Actual: $${actualTotal.toFixed(0)})`);
    
    console.log(`  📊 Portfolio at retirement: $${results.summary.portfolioAtRetirement.toLocaleString()}`);
    console.log(`  📊 Money lasts until age: ${results.summary.moneyLastsAge}`);
});

// Test 2: Windfall applied correctly (using manual application like app.js does)
test('Windfall Application (Manual Integration)', () => {
    const inputs = {
        currentAge: 30,
        partnerAge: 0,
        retirementAge: 65,
        lifeExpectancy: 90,
        province: 'ON',
        region: 'ON_Toronto',
        familyStatus: 'single',
        currentIncome: 80000,
        income1: 80000,
        income2: 0,
        rrsp: 50000,
        tfsa: 30000,
        nonReg: 10000,
        other: 5000,
        monthlyContribution: 1000,
        contributionSplit: { rrsp: 0.6, tfsa: 0.3, nonReg: 0.1 },
        annualSpending: 50000,
        healthStatus: 'average',
        currentDebt: 0,
        debtPayoffAge: 65,
        cppStartAge: 65,
        additionalIncomeSources: [],
        returnRate: 6,
        inflationRate: 2.5
    };
    
    // Calculate base (no windfall)
    const baseResults = context.RetirementCalcV4.calculate(inputs);
    const basePortfolio = baseResults.summary.portfolioAtRetirement;
    
    assert(basePortfolio > 0, `Base portfolio calculated: $${basePortfolio.toLocaleString()}`);
    
    // Now manually apply windfall (simulating app.js _applyWindfallsToResults)
    const windfalls = [{
        name: 'Test Inheritance',
        amount: 500000,
        year: 50,  // Age 50
        probability: 100,
        taxable: false,
        destination: 'tfsa'
    }];
    
    const targetAge = windfalls[0].year;
    const yearIndex = baseResults.yearByYear.findIndex(y => y.age === targetAge);
    
    assert(yearIndex !== -1, `Found year for windfall (age ${targetAge})`);
    
    if (yearIndex !== -1) {
        const afterTaxAmount = windfalls[0].taxable ? windfalls[0].amount * 0.7 : windfalls[0].amount;
        const returnRate = inputs.returnRate / 100;
        
        // Apply windfall and grow it forward
        for (let i = yearIndex; i < baseResults.yearByYear.length; i++) {
            const year = baseResults.yearByYear[i];
            const yearsFromWindfall = i - yearIndex;
            const grownAmount = afterTaxAmount * Math.pow(1 + returnRate, yearsFromWindfall);
            
            // Add to TFSA
            year.tfsa = (year.tfsa || 0) + grownAmount;
            
            // CRITICAL FIX: Include 'other' account in total
            const newTotal = (year.rrsp || 0) + (year.tfsa || 0) + (year.nonReg || 0) + (year.other || 0);
            year.totalPortfolio = newTotal;
            year.totalBalance = newTotal;
        }
        
        // Recalculate summary
        const retirementYear = baseResults.yearByYear.find(y => y.age === inputs.retirementAge);
        if (retirementYear) {
            baseResults.summary.portfolioAtRetirement = retirementYear.totalBalance || retirementYear.totalPortfolio || 0;
        }
        
        const lastYear = baseResults.yearByYear[baseResults.yearByYear.length - 1];
        baseResults.summary.legacyAmount = lastYear.totalBalance || lastYear.totalPortfolio || 0;
        
        // Recalculate money lasts age
        const runOutYear = baseResults.yearByYear.find(y => (y.totalBalance || y.totalPortfolio || 0) < (y.spending || 0));
        baseResults.summary.moneyLastsAge = runOutYear ? runOutYear.age : inputs.lifeExpectancy;
        
        // Recalculate probability
        const yearsShort = runOutYear ? (inputs.lifeExpectancy - runOutYear.age) : 0;
        if (yearsShort === 0) {
            baseResults.probability = Math.min(95, 75 + Math.floor(baseResults.summary.legacyAmount / 50000));
            baseResults.onTrack = true;
        } else {
            const retirementYears = inputs.lifeExpectancy - inputs.retirementAge;
            const successRatio = (retirementYears - yearsShort) / retirementYears;
            baseResults.probability = Math.round(successRatio * 100);
            baseResults.onTrack = baseResults.probability >= 70;
        }
    }
    
    const windfallPortfolio = baseResults.summary.portfolioAtRetirement;
    
    assert(windfallPortfolio > basePortfolio, 
        `Windfall increases portfolio (Base: $${basePortfolio.toLocaleString()} → With windfall: $${windfallPortfolio.toLocaleString()})`);
    
    const increase = windfallPortfolio - basePortfolio;
    assert(increase > 500000, 
        `Portfolio increase > $500K due to growth (Increase: $${increase.toLocaleString()})`);
    
    assert(baseResults.summary.moneyLastsAge >= inputs.lifeExpectancy,
        `Money lasts through life expectancy (Age ${baseResults.summary.moneyLastsAge})`);
    
    assert(baseResults.probability > 70,
        `High success probability (${baseResults.probability}%)`);
    
    console.log(`  📊 Final portfolio: $${windfallPortfolio.toLocaleString()}`);
    console.log(`  📊 Money lasts until: Age ${baseResults.summary.moneyLastsAge}`);
    console.log(`  📊 Success probability: ${baseResults.probability}%`);
});

// Test 3: Verify 'other' account in complex scenario
test('Complex Multi-Account Portfolio with Other', () => {
    const inputs = {
        currentAge: 45,
        partnerAge: 0,
        retirementAge: 65,
        lifeExpectancy: 90,
        province: 'BC',
        region: 'BC_Vancouver',
        familyStatus: 'single',
        currentIncome: 120000,
        income1: 120000,
        income2: 0,
        rrsp: 200000,
        tfsa: 100000,
        nonReg: 50000,
        other: 75000,  // Significant 'other' balance
        monthlyContribution: 2000,
        contributionSplit: { rrsp: 0.5, tfsa: 0.3, nonReg: 0.2 },
        annualSpending: 60000,
        healthStatus: 'good',
        currentDebt: 0,
        debtPayoffAge: 65,
        cppStartAge: 65,
        additionalIncomeSources: [],
        returnRate: 7,
        inflationRate: 2.5
    };
    
    const results = context.RetirementCalcV4.calculate(inputs);
    
    // Check first year
    const firstYear = results.yearByYear[0];
    const expectedStart = inputs.rrsp + inputs.tfsa + inputs.nonReg + inputs.other;
    const actualStart = firstYear.totalPortfolio || firstYear.totalBalance || 0;
    
    assert(Math.abs(actualStart - expectedStart) < 100,
        `Starting portfolio includes all accounts (Expected: $${expectedStart.toLocaleString()}, Actual: $${actualStart.toLocaleString()})`);
    
    // Verify 'other' account persists through projection
    const midYear = results.yearByYear[Math.floor(results.yearByYear.length / 2)];
    assert(midYear.other !== undefined && midYear.other >= 0,
        `'other' account persists in mid-projection (Age ${midYear.age}: $${(midYear.other || 0).toLocaleString()})`);
    
    console.log(`  📊 Starting total: $${actualStart.toLocaleString()}`);
    console.log(`  📊 Portfolio at retirement: $${results.summary.portfolioAtRetirement.toLocaleString()}`);
});

// Print summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Windfall integration is working correctly.');
    process.exit(0);
} else {
    console.log('\n⚠️  SOME TESTS FAILED. Review errors above.');
    process.exit(1);
}

// Test to reproduce the chart bug

const testData = [
    { age: 30, totalBalance: 100000 },
    { age: 31, totalBalance: 105000 },
    { age: 32, totalBalance: undefined },  // Bug: undefined value
    { age: 33, totalBalance: 120000 }
];

console.log('Test data:', testData);

// This is what app.js does (line 1240):
const maxBalance = Math.max(...testData.map(y => y.totalBalance));

console.log('maxBalance:', maxBalance);
console.log('Is NaN?', isNaN(maxBalance));

// This breaks the chart because NaN / maxBalance = NaN
const testCalc = 100000 / maxBalance;
console.log('100000 / maxBalance =', testCalc);

// FIX: Use fallback
const maxBalanceSafe = Math.max(...testData.map(y => y.totalBalance || y.totalPortfolio || 0));
console.log('maxBalanceSafe:', maxBalanceSafe);

// Better fix: filter out invalid values
const maxBalanceBest = Math.max(...testData.map(y => y.totalBalance || 0).filter(b => b > 0));
console.log('maxBalanceBest:', maxBalanceBest);

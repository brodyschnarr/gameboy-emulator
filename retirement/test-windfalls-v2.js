const fs = require('fs'); const vm = require('vm');
const scripts = ['canada-tax.js','cpp-calculator.js','benchmarks.js','lifestyle-data.js','regional-data.js','canada-map.js','income-sources.js','cpp-optimizer.js','scenario-manager.js','healthcare-estimator.js','calc.js','tax-optimizer.js','what-if-analyzer.js','safe-withdrawal.js','windfalls.js','monte-carlo.js'];
const sb = {console:{log:()=>{},warn:()=>{},error:()=>{}},Math,Date,setTimeout,clearTimeout,setInterval,clearInterval,parseFloat,parseInt,isNaN,isFinite,Number,String,Array,Object,JSON,Map,Set,Error,TypeError,RangeError,document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},addEventListener:()=>{}}),addEventListener:()=>{}},window:{},navigator:{userAgent:''},alert:()=>{}};
sb.window=sb; const ctx=vm.createContext(sb);
for(const s of scripts){try{vm.runInContext(fs.readFileSync(__dirname+'/'+s,'utf8'),ctx)}catch(e){console.log('err loading '+s+': '+e.message)}}

let passed = 0, failed = 0;
function assert(cond, msg) { if(cond){passed++;console.log('  ✅ '+msg)}else{failed++;console.log('  ❌ FAIL: '+msg)} }

console.log('\n═══ Windfall V2 Tests ═══');

// Test 1: Shares resolve correctly
const r1 = vm.runInContext(`
    WindfallManager._resolveWindfall(
        { type:'shares', currentValue:200000, growthRate:15, sellAge:40, name:'Startup' },
        { currentAge:31, lifeExpectancy:90 }, false
    )
`, ctx);
const expected = Math.round(200000 * Math.pow(1.15, 9));
assert(r1.age === 40, `Shares sell age = 40 (got ${r1.age})`);
assert(Math.abs(r1.amount - expected) < 100, `Shares value ~${expected} (got ${r1.amount})`);

// Test 2: Uncertain deterministic = base values
const r2 = vm.runInContext(`
    WindfallManager._resolveWindfall(
        { type:'uncertain', amount:500000, amountRange:200000, year:55, ageRange:5, name:'Inheritance' },
        { currentAge:31, lifeExpectancy:90 }, false
    )
`, ctx);
assert(r2.age === 55, `Uncertain det age = 55 (got ${r2.age})`);
assert(r2.amount === 500000, `Uncertain det amount = 500000 (got ${r2.amount})`);

// Test 3: Uncertain randomized produces spread
const dist = vm.runInContext(`
    var amounts=[], ages=[];
    for(var i=0;i<2000;i++){
        var r=WindfallManager._resolveWindfall(
            {type:'uncertain',amount:500000,amountRange:200000,year:55,ageRange:5,name:'Inh'},
            {currentAge:31,lifeExpectancy:90}, true
        );
        amounts.push(r.amount);
        ages.push(r.age);
    }
    amounts.sort(function(a,b){return a-b});
    ages.sort(function(a,b){return a-b});
    JSON.stringify({
        amtP10:amounts[200], amtP50:amounts[1000], amtP90:amounts[1800],
        ageP10:ages[200], ageP50:ages[1000], ageP90:ages[1800],
        amtMin:amounts[0], amtMax:amounts[1999]
    });
`, ctx);
const d = JSON.parse(dist);
assert(d.amtP10 > 300000 && d.amtP10 < 500000, `Uncertain p10 amount in range (got ${d.amtP10})`);
assert(d.amtP90 > 500000 && d.amtP90 < 700000, `Uncertain p90 amount in range (got ${d.amtP90})`);
assert(d.ageP10 >= 50 && d.ageP10 <= 55, `Uncertain p10 age in range (got ${d.ageP10})`);
assert(d.ageP90 >= 55 && d.ageP90 <= 60, `Uncertain p90 age in range (got ${d.ageP90})`);

// Test 4: Simple windfall backward compat
const r4 = vm.runInContext(`
    WindfallManager._resolveWindfall(
        { type:'simple', amount:100000, year:45, probability:75, name:'Bonus' },
        { currentAge:31 }, false
    )
`, ctx);
assert(r4.age === 45, `Simple age = 45`);
assert(r4.amount === 100000, `Simple amount = 100000`);

// Test 5: Simple probability filtering
const probResults = vm.runInContext(`
    var occurred = 0;
    for(var i=0;i<1000;i++){
        var r=WindfallManager._resolveWindfall(
            {type:'simple',amount:100000,year:45,probability:75,name:'Bonus'},
            {currentAge:31}, true
        );
        if(r) occurred++;
    }
    occurred;
`, ctx);
assert(probResults > 650 && probResults < 850, `Simple 75% prob occurs ~750/1000 times (got ${probResults})`);

// Test 6: Validation
const v1 = vm.runInContext(`WindfallManager.validate({type:'shares',name:'X',currentValue:100,sellAge:40,destination:'split'}).valid`, ctx);
const v2 = vm.runInContext(`WindfallManager.validate({type:'uncertain',name:'X',amount:500,year:55,destination:'split'}).valid`, ctx);
const v3 = vm.runInContext(`WindfallManager.validate({type:'simple',name:'X',amount:100,year:45,probability:50,destination:'split'}).valid`, ctx);
const v4 = vm.runInContext(`WindfallManager.validate({type:'shares',name:'',currentValue:0,destination:'split'}).valid`, ctx);
assert(v1 === true, 'Shares validation passes');
assert(v2 === true, 'Uncertain validation passes');
assert(v3 === true, 'Simple validation passes');
assert(v4 === false, 'Bad shares validation fails');

// Test 7: MC integration with shares windfall
const mcResult = vm.runInContext(`
    var mc = MonteCarloSimulator.simulate({
        currentAge:31, retirementAge:65, lifeExpectancy:90,
        familyStatus:'single', currentIncome:80000, annualSpending:48000,
        rrsp:50000, tfsa:30000, nonReg:20000, other:0, cash:0,
        monthlyContribution:1000, contributionSplit:{rrsp:0.4,tfsa:0.4,nonReg:0.2},
        province:'ON', returnRate:6, inflationRate:2.5,
        cppStartAge:65, oasStartAge:65, spendingCurve:'flat',
        windfalls:[{type:'shares',name:'Startup',currentValue:500000,growthRate:20,sellAge:40,taxable:true,destination:'split',probability:100}]
    }, {iterations:100, volatility:0.12, marketCrashProbability:0});
    JSON.stringify({success:mc.successRate, p50:mc.finalBalance.p50});
`, ctx);
const mc = JSON.parse(mcResult);
assert(mc.success >= 90, `MC with shares windfall: success >= 90% (got ${mc.success}%)`);

console.log('\n═══════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

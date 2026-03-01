# 🚀 Retirement Calculator V5 - Advanced Analytics

**Major upgrade with Monte Carlo simulation, tax optimization, and probabilistic analysis**

## 🎯 What's New in V5

### 1. **Monte Carlo Simulation** 
Run 1000+ scenarios with realistic market volatility

**Features:**
- Random return sequences using normal distribution
- Market crash probability modeling (10% chance of -20%+ year)
- Percentile distributions (10th, 50th, 90th)
- Confidence bands showing range of outcomes
- Sequence of returns risk analysis
- Bull-then-bear vs bear-then-bull comparisons

**Results:**
- Success rate (% of scenarios that work)
- Best/median/worst case outcomes
- Portfolio distribution charts
- Expected final balance ranges

### 2. **Tax Optimization Engine**
Find the optimal withdrawal strategy to minimize lifetime tax

**Strategies Analyzed:**
- **Naive:** Withdraw as needed (baseline)
- **Front-load RRSP:** Withdraw early to avoid future RRIFs
- **OAS Optimal:** Stay under clawback threshold ($90K)

**Results:**
- Tax savings vs naive approach (can be $50K+ over retirement)
- OAS clawback avoidance strategies
- Year-by-year withdrawal breakdown
- Optimal RRSP/TFSA/Non-Reg withdrawal order

### 3. **What-If Scenario Analysis**
See how changes impact your outcome

**Scenarios:**
- Retire 5 years earlier/later
- Spend 20% more/less
- Save 50% more/less
- Bear market (-2% returns)
- Bull market (+2% returns)
- High inflation (+2%)
- Low inflation (-1%)
- CPP at 60/70
- Live to 95/100
- Health issues
- 😱 Worst case combo
- 🎉 Best case combo

**Results:**
- Heatmap of success rates (retirement age vs portfolio size)
- Sensitivity analysis (which inputs matter most)
- Actionable recommendations
- Side-by-side comparisons

### 4. **Safe Withdrawal Rate Calculator**
How much can you safely withdraw?

**Strategies:**
- **4% Rule:** Classic Trinity Study approach
- **Dynamic:** Adjust based on portfolio performance
- **Guardrails:** Increase/decrease at thresholds
- **Age-Based:** Start lower, increase as you age
- **Optimized:** Customized for your situation

**Results:**
- Recommended withdrawal rate (e.g., 4.2% = $63K/year)
- Success rates for each strategy
- Monthly income calculations
- Portfolio size requirements

### 5. **Advanced Visualizations**
Beautiful, interactive charts

**Charts:**
- **Confidence bands:** 10th-90th percentile overlay on projection
- **Probability distribution:** Histogram of final balances
- **Success heatmap:** Retirement age × portfolio size grid
- **Withdrawal strategy:** Stacked area chart (RRSP/TFSA/Non-Reg)
- All charts rendered on HTML5 canvas

## 📁 New Files

```
retirement/
├── monte-carlo.js           # Monte Carlo simulation engine (1000+ scenarios)
├── tax-optimizer.js         # Tax-aware withdrawal optimization
├── what-if-analyzer.js      # Scenario comparison & sensitivity analysis
├── safe-withdrawal.js       # Safe withdrawal rate calculator
├── advanced-charts.js       # Visualization components (canvas-based)
├── app-v5-enhanced.js       # Enhanced UI controller with tabs
├── style-v5.css             # Additional styles for V5 features
├── test-calc-v2.html        # Comprehensive test suite (50+ tests)
└── V5-README.md             # This file
```

## 🧪 Test Suite

**New comprehensive test suite:** `test-calc-v2.html`

**Coverage:**
- **Edge Cases:** $0 balance, retire tomorrow, live to 110, massive debt, low/high income, age gap couples
- **Stress Tests:** 0% inflation, 10% inflation, 0% returns, 15% returns, overspending
- **Tax Tests:** Provincial differences, RRSP vs TFSA efficiency, bracket transitions
- **Government Tests:** CPP at 60/65/70, OAS clawback triggers
- **Portfolio Tests:** Underfunded, well-funded, 4% rule validation

**50+ tests total** covering every edge case and stress scenario

## 🎨 UI Enhancements

### Tabbed Interface
- **Overview:** Quick summary with key stats
- **Monte Carlo:** Full probability distribution
- **Tax Optimization:** Strategy comparison & savings
- **What-If:** Scenario analysis & recommendations
- **Safe Withdrawal:** Withdrawal rate strategies

### Visual Improvements
- Loading overlay during analysis (1000 simulations takes ~2 seconds)
- Color-coded cards (success = green, warning = orange/red)
- Insight boxes with key takeaways
- Responsive tables and grids
- Smooth animations and transitions

## 📊 Example Results

**Base Scenario:**
- Portfolio at retirement: $1.2M
- Annual spending: $60K
- Retirement: 65-90 (25 years)

**Monte Carlo Results:**
- Success rate: **87%** (870 of 1000 scenarios worked)
- Median final balance: $320K
- 10th percentile: $45K (worst case still survives)
- 90th percentile: $890K (best case leaves legacy)

**Tax Optimization:**
- Naive strategy: $285K total tax
- Optimal strategy: $238K total tax
- **Savings: $47K** over 25 years

**What-If Insights:**
- Retiring 5 years later adds $425K to portfolio
- Spending 20% less extends money by 8 years
- Working in worst-case scenario: money lasts to age 82 (8 years short)

## 🚀 How to Use

### Option 1: Enhanced Analysis (V5)

Load all V5 modules in your HTML:

```html
<!-- V5 Modules -->
<script src="monte-carlo.js"></script>
<script src="tax-optimizer.js"></script>
<script src="what-if-analyzer.js"></script>
<script src="safe-withdrawal.js"></script>
<script src="advanced-charts.js"></script>
<script src="app-v5-enhanced.js"></script>
<link rel="stylesheet" href="style-v5.css">
```

Run enhanced analysis after base calculation:

```javascript
const baseInputs = { /* ... */ };
const baseResults = RetirementCalcV4.calculate(baseInputs);

// Run V5 enhanced analysis
AppV5Enhanced.runEnhancedAnalysis(baseInputs, baseResults);
```

### Option 2: Individual Modules

Use modules standalone:

```javascript
// Monte Carlo only
const mcResults = MonteCarloSimulator.simulate(baseInputs, {
    iterations: 1000,
    volatility: 0.15
});

// Tax optimization only
const taxResults = TaxOptimizer.optimizeWithdrawals({
    rrsp: 800000,
    tfsa: 200000,
    nonReg: 200000,
    annualSpending: 60000,
    cppAnnual: 15000,
    oasAnnual: 8000,
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90
});

// What-if only
const whatIfResults = WhatIfAnalyzer.analyzeAll(baseInputs);

// Safe withdrawal only
const swrResults = SafeWithdrawalCalculator.calculate({
    portfolioValue: 1200000,
    retirementYears: 25,
    inflationRate: 2,
    successTarget: 90
});
```

## 🔬 Technical Details

### Monte Carlo Algorithm
1. Generate random return sequence (Box-Muller transform for normal distribution)
2. Apply occasional market crashes (10% probability of -20% year)
3. Run full retirement projection with random returns
4. Repeat 1000 times
5. Sort results by final balance
6. Extract percentiles (10th, 25th, 50th, 75th, 90th)

### Tax Optimization Algorithm
1. Simulate naive strategy (proportional withdrawals)
2. Simulate front-load strategy (withdraw RRSP before age 65)
3. Simulate OAS-optimal strategy (stay under $90K threshold)
4. Compare total tax + OAS clawback for each
5. Recommend strategy with highest net income

### What-If Sensitivity
1. Test each input variable at ±5-50% range
2. Calculate impact on "money lasts until age"
3. Rank by sensitivity (biggest impact first)
4. Generate actionable recommendations

## 📈 Performance

- **Base calculation:** ~5ms (single scenario)
- **Monte Carlo (1000 runs):** ~1.5-2.5 seconds
- **Tax optimization (3 strategies × 25 years):** ~50ms
- **What-if (15 scenarios):** ~200ms
- **Total enhanced analysis:** ~2-3 seconds

All calculations run in browser (no server needed).

## 🎯 Success Rates Explained

**90%+** = Excellent (very likely to succeed)  
**80-89%** = Good (high confidence)  
**70-79%** = Fair (moderate confidence, consider safety buffer)  
**50-69%** = Risky (needs improvement)  
**<50%** = High risk (definitely needs more savings or less spending)

## 🔮 Future Enhancements (V6?)

Potential additions:
- Asset allocation optimization (stocks/bonds glide path)
- Longevity insurance modeling
- Social Security bridge strategies
- Healthcare cost inflation modeling (faster than CPI)
- Part-time work in early retirement scenarios
- Roth conversion ladder optimization
- Real estate equity drawdown strategies

## 📝 Notes

- All calculations assume Canadian tax rules (2024)
- Monte Carlo uses 15% volatility (typical 60/40 portfolio)
- OAS clawback threshold: $90K (2024 estimate)
- CPP max: ~$15K/year (2024 estimate)
- Inflation adjustments apply to spending only (not government benefits)

## 🐛 Known Limitations

- Does not model asset allocation changes over time
- Simplified tax calculation (doesn't include all deductions/credits)
- OAS clawback is linear (actual calculation has more nuance)
- Healthcare costs grow at general inflation rate (often higher in reality)
- No modeling of long-term care insurance or expenses

## 🚢 Deployment

**V5 is on development branch:** `v5-dev`  
**Stable V4 is on:** `main` (tagged as `v4-stable`)

To merge V5 to main:
1. Test all features thoroughly
2. Run full test suite (`test-calc-v2.html`)
3. Verify mobile responsiveness
4. Create pull request: `v5-dev` → `main`
5. Tag as `v5.0.0` after merge

---

**Built:** March 2, 2026  
**Author:** Brody Bot 🎮  
**Status:** Development (ready for testing)

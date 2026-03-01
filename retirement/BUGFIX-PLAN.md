# Comprehensive Bug Fix Plan
**Date**: 2026-03-02  
**Issues**: 3 critical bugs reported by user

## Issues Reported

1. ❌ **Scenario buttons not clickable** (retire 5 years sooner/later buttons)
2. ❌ **Success % different between Monte Carlo and retirement snapshot**
3. ❌ **Portfolio projection chart not loading**

---

## Deep Investigation Results

### Issue #1: Scenario Buttons Not Clickable

**Location**: `app.js` line 1060-1093 (`_setupScenarioTabs()`)

**Current Code**:
```javascript
_setupScenarioTabs() {
    const tabs = document.querySelectorAll('.scenario-tab');
    console.log('[AppV4] Setting up', tabs.length, 'scenario tabs');
    
    tabs.forEach(tab => {
        // Remove old listeners
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        // Add fresh listener
        newTab.addEventListener('click', (e) => {
            e.preventDefault();
            const scenario = e.currentTarget.dataset.scenario;
            console.log('[AppV4] Scenario tab clicked:', scenario);
            this._switchScenario(scenario);
        });
    });
}
```

**Root Cause**: The code clones nodes and replaces them, which SHOULD work. But there's a timing issue:
1. `_setupScenarioTabs()` queries `.scenario-tab` elements
2. After cloning and replacing, the NEW tabs are orphaned from the querySelectorAll result
3. The event listener is added to the cloned node, but the reference is lost

**Test**: Created `diagnose-issues.html` to verify the cloneNode pattern works in isolation.

**Fix Strategy**:
- After cloning and replacing, re-query the DOM to get fresh references
- OR: Don't clone — just remove listeners differently
- OR: Use event delegation on parent container

**Preferred Fix**: Event delegation (most robust)

---

### Issue #2: Monte Carlo vs Snapshot Probability Mismatch

**Location**: 
- `app.js` line 998-1010 (deterministic probability calculation)
- `app.js` line 1178 (displays `results.probability` in main banner)
- `app-v5-enhanced.js` line 337 (displays `mc.successRate` in Monte Carlo tab)

**Root Cause**: Two different probability calculations:

**Deterministic (app.js)**:
```javascript
if (yearsShort === 0) {
    // Money lasts through life expectancy
    results.probability = Math.min(95, 75 + Math.floor(results.summary.legacyAmount / 50000));
} else {
    // Money runs out early
    const successRatio = (retirementYears - yearsShort) / retirementYears;
    results.probability = Math.round(successRatio * 100);
}
```

**Monte Carlo (monte-carlo.js)**:
```javascript
const successfulRuns = results.filter(r => r.success).length;
const successRate = (successfulRuns / results.length) * 100;
```

**Analysis**:
- These SHOULD be different (deterministic vs probabilistic)
- But the user sees different numbers and gets confused
- The deterministic calc is simplistic and doesn't account for market volatility
- The Monte Carlo result is more accurate

**Fix Strategy**:
- Option A: Update main stats banner to show Monte Carlo success rate when available
- Option B: Hide deterministic probability and only show Monte Carlo
- Option C: Show both with clear labels ("Simple estimate" vs "Monte Carlo simulation")

**Preferred Fix**: Option A — use Monte Carlo result in main banner when available

---

### Issue #3: Portfolio Projection Chart Not Loading

**Location**: `app.js` line 1222-1273 (`_drawChart()`)

**Root Cause**: Using `y.totalBalance` without fallback causes NaN when any year is missing the value

**Problematic Lines**:
```javascript
Line 1240: const maxBalance = Math.max(...yearByYear.map(y => y.totalBalance));
Line 1267: const y = h - padding - (point.totalBalance / maxBalance) * (h - 2 * padding);
Line 1289: const total = year.totalBalance;  // in _drawYearBreakdown
```

**Test Result**: If ANY year has `undefined` for `totalBalance`, `Math.max()` returns `NaN`, breaking the entire chart.

**Fix Strategy**: Use fallback to `totalPortfolio` or 0

**Fixed Code**:
```javascript
// Line 1240
const maxBalance = Math.max(...yearByYear.map(y => y.totalBalance || y.totalPortfolio || 0));

// Line 1267
const balance = point.totalBalance || point.totalPortfolio || 0;
const y = h - padding - (balance / maxBalance) * (h - 2 * padding);

// Line 1289
const total = year.totalBalance || year.totalPortfolio || 0;
```

---

## Complete Fix Implementation

### File 1: `app.js`

**Change #1**: Fix `_setupScenarioTabs()` with event delegation (line 1060)

```javascript
_setupScenarioTabs() {
    // Use event delegation instead of direct listeners
    const tabContainer = document.getElementById('scenario-tabs');
    if (!tabContainer) {
        console.error('[AppV4] Scenario tabs container not found!');
        return;
    }
    
    // Remove old listener if it exists
    if (tabContainer._scenarioClickHandler) {
        tabContainer.removeEventListener('click', tabContainer._scenarioClickHandler);
    }
    
    // Add delegated listener
    const handler = (e) => {
        const tab = e.target.closest('.scenario-tab');
        if (!tab) return;
        
        e.preventDefault();
        const scenario = tab.dataset.scenario;
        console.log('[AppV4] Scenario tab clicked:', scenario);
        this._switchScenario(scenario);
        
        // Update active state
        tabContainer.querySelectorAll('.scenario-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    };
    
    tabContainer._scenarioClickHandler = handler;
    tabContainer.addEventListener('click', handler);
    
    console.log('[AppV4] Scenario tabs setup complete (event delegation)');
},
```

**Change #2**: Use Monte Carlo probability in main banner (line 1168-1179)

```javascript
_displayResults(results, inputs) {
    // ... existing code ...
    
    // Use Monte Carlo probability if available, otherwise use deterministic
    let probability = results.probability || 0;
    if (this.monteCarloResults && this.monteCarloResults.successRate !== undefined) {
        probability = this.monteCarloResults.successRate;
        console.log('[AppV4] Using Monte Carlo probability:', probability + '%');
    } else {
        console.log('[AppV4] Using deterministic probability:', probability + '%');
    }
    
    document.getElementById('stat-probability').textContent = `${probability}%`;
    
    // ... existing code ...
}
```

**Change #3**: Fix chart rendering with fallback (line 1240, 1267, 1289)

```javascript
_drawChart(yearByYear, retirementAge) {
    const canvas = document.getElementById('projection-chart');
    if (!canvas) {
        console.error('[AppV4] Portfolio chart canvas not found!');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('[AppV4] Cannot get 2D context from canvas!');
        return;
    }
    
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth - 40;
    canvas.height = 400;

    const w = canvas.width;
    const h = canvas.height;
    const padding = 60;

    ctx.clearRect(0, 0, w, h);

    if (yearByYear.length === 0) {
        console.warn('[AppV4] No data for portfolio chart');
        return;
    }

    // FIX: Use fallback for totalBalance
    const maxBalance = Math.max(...yearByYear.map(y => y.totalBalance || y.totalPortfolio || 0));
    
    if (maxBalance === 0 || isNaN(maxBalance)) {
        console.error('[AppV4] Invalid maxBalance:', maxBalance);
        ctx.fillStyle = '#ef4444';
        ctx.font = '16px sans-serif';
        ctx.fillText('Error: No valid balance data', w / 2 - 100, h / 2);
        return;
    }
    
    const minAge = yearByYear[0].age;
    const maxAge = yearByYear[yearByYear.length - 1].age;

    // ... axes and retirement line code ...

    // Balance curve
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();

    yearByYear.forEach((point, i) => {
        const x = padding + ((point.age - minAge) / (maxAge - minAge)) * (w - 2 * padding);
        
        // FIX: Use fallback for balance
        const balance = point.totalBalance || point.totalPortfolio || 0;
        const y = h - padding - (balance / maxBalance) * (h - 2 * padding);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();
    
    // ... labels ...
},

_drawYearBreakdown(yearByYear, retirementAge) {
    const container = document.getElementById('year-breakdown-chart');
    if (!container) return;

    const retirementYears = yearByYear.filter(y => y.age >= retirementAge).slice(0, 25);

    if (retirementYears.length === 0) {
        container.innerHTML = '<p>No retirement data</p>';
        return;
    }

    const html = retirementYears.map(year => {
        // FIX: Use fallback for total
        const total = year.totalBalance || year.totalPortfolio || 0;
        
        // ... rest of code ...
    }).join('');
    
    container.innerHTML = html;
}
```

**Change #4**: Store Monte Carlo results in AppV4 (line 895-900)

```javascript
// Run V5 Enhanced Analysis (Monte Carlo, Tax Optimization, What-If)
if (typeof AppV5Enhanced !== 'undefined') {
    console.log('[AppV4] Launching V5 enhanced analysis...');
    AppV5Enhanced.runEnhancedAnalysis(inputs, baseResults);
    
    // Store Monte Carlo results for use in main stats
    if (AppV5Enhanced.monteCarloResults) {
        this.monteCarloResults = AppV5Enhanced.monteCarloResults;
    }
}
```

---

## Testing Plan

### Test #1: Scenario Buttons
1. Calculate a retirement plan
2. Click "Retire 5 Years Earlier" button
3. Verify stats update to reflect earlier retirement
4. Click "Spend 20% Less" button
5. Verify stats update again
6. **Expected**: All buttons clickable, stats update correctly

### Test #2: Probability Display
1. Calculate a retirement plan
2. Check main banner probability %
3. Click on "Monte Carlo (Probability)" tab
4. Compare success rates
5. **Expected**: Main banner shows Monte Carlo result, both match

### Test #3: Portfolio Chart
1. Calculate a retirement plan
2. Scroll down to "Portfolio Projection" chart
3. **Expected**: Chart renders with blue line showing portfolio growth over time
4. Verify chart shows ages on X-axis, dollar amounts on Y-axis
5. Verify retirement line (orange dashed) appears

### Test #4: With Windfalls
1. Add a windfall ($500K at age 50)
2. Calculate
3. **Expected**: All three fixes work with windfall data

---

## Deployment Checklist

- [ ] Update `app.js` with all 4 changes
- [ ] Test scenario buttons work
- [ ] Test probability display matches
- [ ] Test chart renders correctly
- [ ] Test with windfalls
- [ ] Commit changes
- [ ] Push to GitHub
- [ ] Wait 60s for deployment
- [ ] Verify on live site

---

## Rollback Plan

If issues persist:
```bash
git revert HEAD
git push
```

Previous working commit: `995a017`

---

*Created: 2026-03-02*  
*Author: Brody Bot 🎮*

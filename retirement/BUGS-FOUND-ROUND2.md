# Critical Bugs Found - Round 2 Deep Investigation
**Date**: 2026-03-02  
**Status**: Bugs identified, fixes in progress

## Bug #1: Legacy Showing $0 (CONFIRMED)

**Root Cause**: Data inconsistency between `results.summary.legacyAmount` and `results.legacy.amount`

**Evidence**:
- `app.js` line 995: Updates `results.summary.legacyAmount`
- `app.js` line 1239: Displays `results.legacy.amount` (NOT summary.legacyAmount!)
- When windfalls are applied, `summary.legacyAmount` is recalculated
- But `results.legacy.amount` is NEVER updated
- Display shows the old $0 value from before windfalls

**Fix**: Update BOTH `results.legacy.amount` AND `results.legacy.description` in `_applyWindfallsToResults`

```javascript
// Line 995 - ADD THIS:
results.summary.legacyAmount = lastYear.totalBalance || lastYear.totalPortfolio || 0;
results.legacy.amount = results.summary.legacyAmount; // FIX: Also update legacy object
results.legacy.description = results.summary.legacyAmount > 0 
    ? `You'll leave an estate of $${results.summary.legacyAmount.toLocaleString()} for your beneficiaries.`
    : 'No legacy remaining - money runs out before end of life.';
```

---

## Bug #2: Portfolio Chart Blank (SUSPECTED)

**Possible Causes**:

###Cause A: Canvas parent has zero width
- `app.js` line 1263: `canvas.width = container.offsetWidth - 40`
- If parent is hidden or has width < 40, canvas width will be 0 or negative
- Need minimum width validation

### Cause B: Chart is drawn before element is visible
- If chart is drawn while parent is `display: none`, offsetWidth = 0
- Need to defer drawing or ensure parent is visible

### Cause C: CSS is hiding the canvas
- Check if canvas or parent has `display: none` or `visibility: hidden`

**Fix Strategy**:
1. Add minimum width check (e.g., 300px minimum)
2. Add logging to debug actual widths
3. Ensure parent section is visible before drawing
4. Add error message on canvas if rendering fails

```javascript
const container = canvas.parentElement;
const containerWidth = Math.max(container.offsetWidth - 40, 300); // Minimum 300px
canvas.width = containerWidth;
canvas.height = 400;

console.log('[AppV4] Chart canvas size:', canvas.width, 'x', canvas.height);

if (canvas.width < 100) {
    console.error('[AppV4] Canvas too narrow:', canvas.width);
    ctx.fillStyle = '#ef4444';
    ctx.font = '14px sans-serif';
    ctx.fillText('Error: Container too narrow to render chart', 10, 20);
    return;
}
```

---

## Bug #3: Scenario Buttons Still Not Working (NEEDS VERIFICATION)

**Hypothesis**: Event delegation was implemented correctly, but maybe:

### Cause A: `_setupScenarioTabs()` is called BEFORE tabs exist in DOM
- If called too early, `getElementById('scenario-tabs')` returns null
- Event listener never attached

### Cause B: Tabs are being recreated/replaced AFTER `_setupScenarioTabs()` runs
- Some other code might be modifying the DOM
- Event delegation handler gets removed

### Cause C: Clicks are being prevented by another element
- Another overlay or element might be intercepting clicks
- Check z-index and pointer-events

**Debug Steps**:
1. Add console logging to confirm `_setupScenarioTabs()` runs
2. Log when tabs are clicked
3. Check if `tabContainer._scenarioClickHandler` exists after calculation
4. Test clicking tabs directly in console

**Fix Strategy**:
```javascript
_setupScenarioTabs() {
    const tabContainer = document.getElementById('scenario-tabs');
    if (!tabContainer) {
        console.error('[AppV4] ❌ Scenario tabs container not found! DOM might not be ready.');
        return;
    }
    
    console.log('[AppV4] ✅ Found scenario tabs container');
    
    // Rest of code...
    
    console.log('[AppV4] ✅ Scenario tabs setup complete');
    console.log('[AppV4] Handler attached:', !!tabContainer._scenarioClickHandler);
}
```

---

## Additional Issues Found

### Issue #4: Monte Carlo Integration (Partial)
- Monte Carlo results ARE being stored in `AppV4.monteCarloResults`
- But we need to verify they're being used in display
- Check if `stat-probability` element is showing Monte Carlo or deterministic value

### Issue #5: Chart Running Out of Memory?
- If data has 60+ years (age 30-90), that's a lot of canvas drawing
- Check if there's a memory or performance issue
- Maybe need to simplify/optimize drawing code

---

## Testing Plan

### Test 1: Legacy Fix
1. Calculate plan (no windfalls)
2. Check legacy - should show final portfolio value
3. Add windfall ($500K at age 50)
4. Recalculate
5. Check legacy - should show higher value (millions)

### Test 2: Chart Fix
1. Open dev console before calculating
2. Calculate plan
3. Check console for canvas width/height logs
4. Scroll to "Portfolio Projection"
5. Verify chart renders or see error message

### Test 3: Scenario Buttons
1. Open dev console
2. Calculate plan
3. Look for "Scenario tabs setup complete" log
4. Click "Retire 5 Years Earlier"
5. Check for "Scenario tab clicked" log
6. Verify stats update

---

## Priority

1. **CRITICAL**: Fix legacy calculation (affects user understanding)
2. **CRITICAL**: Fix chart rendering (core feature broken)
3. **HIGH**: Fix scenario buttons (usability issue)
4. **MEDIUM**: Verify Monte Carlo integration

---

*Status: Investigation complete, fixes being implemented*

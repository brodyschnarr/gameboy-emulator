# CRITICAL BUG FOUND - Chart Drawing Timing Issue
**Date**: 2026-03-02  
**Severity**: CRITICAL - Explains blank chart

## The Smoking Gun

**Execution Order in `_calculate()`:**

```javascript
Line 883: this._displayResults(baseResults, inputs);  // ← Calls _drawChart()
Line 886: this._setupScenarioTabs();
Line 893: document.getElementById('results')?.classList.remove('hidden');  // ← Makes visible
```

**The Problem:**

1. `_displayResults()` is called **line 883**
2. Inside `_displayResults()`, it calls `_drawChart(results.yearByYear, inputs.retirementAge)` **line 1243**
3. Chart tries to draw to canvas **WHILE PARENT IS HIDDEN** (results section still has `class="hidden"`)
4. Results section becomes visible **line 893** - AFTER chart already drew!

## Why This Breaks The Chart

When canvas parent is `display: none`:

```javascript
const container = canvas.parentElement;  // This element is HIDDEN
const containerWidth = Math.max(container.offsetWidth - 40, 300);
// offsetWidth = 0 when display: none!
// So containerWidth = Math.max(-40, 300) = 300
```

**Even with my 300px minimum fix**, the canvas:
- Gets 300px width ✅
- But is drawing to a HIDDEN container ❌
- When container becomes visible, canvas might not re-render
- Depending on browser, this can cause:
  - Blank canvas
  - Distorted rendering
  - Incorrect layout calculations

## The Fix

**Option 1: Make results visible BEFORE _displayResults()**

```javascript
// Show results FIRST
['basic', 'savings', 'contributions', 'retirement', 'healthcare'].forEach(s => {
    document.getElementById(`step-${s}`)?.classList.add('hidden');
});
document.getElementById('results')?.classList.remove('hidden');

// THEN display (chart will draw to visible container)
this._displayResults(baseResults, inputs);
this._setupScenarioTabs();
```

**Option 2: Defer chart drawing until after visibility change**

```javascript
this._displayResults(baseResults, inputs);  // Display stats, but skip charts
this._setupScenarioTabs();

// Show results
document.getElementById('results')?.classList.remove('hidden');

// NOW draw charts (after parent is visible)
this._drawChart(baseResults.yearByYear, inputs.retirementAge);
this._drawYearBreakdown(baseResults.yearByYear, inputs.retirementAge);
```

**Option 3: Use requestAnimationFrame to defer chart drawing**

```javascript
// In _displayResults(), wrap chart calls:
requestAnimationFrame(() => {
    this._drawChart(results.yearByYear, inputs.retirementAge);
    this._drawYearBreakdown(results.yearByYear, inputs.retirementAge);
});
```

## Recommended Solution

**Option 1** (simplest and most reliable):

Move the visibility change BEFORE `_displayResults()`:

```javascript
// Show results FIRST (so charts can measure correctly)
['basic', 'savings', 'contributions', 'retirement', 'healthcare'].forEach(s => {
    document.getElementById(`step-${s}`)?.classList.add('hidden');
});
document.getElementById('results')?.classList.remove('hidden');

// NOW display results (charts will have correct parent dimensions)
this.currentScenario = 'base';
this._displayResults(baseResults, inputs);
this._setupScenarioTabs();

window.scrollTo({ top: 0, behavior: 'smooth' });
```

This ensures:
1. ✅ Results section is visible when chart draws
2. ✅ `container.offsetWidth` returns actual width (not 0)
3. ✅ Canvas renders to visible parent
4. ✅ No timing or layout issues

## Secondary Issue: Scenario Tabs Timing

Currently:
1. `_setupScenarioTabs()` is called **line 886**
2. Results become visible **line 893**

Tabs ARE in the DOM (just hidden), so querySelector should work. But it's still cleaner to set up event handlers AFTER making the section visible.

With Option 1 fix, this is automatically resolved.

---

*This explains the blank chart in screenshots. The chart was drawing to a hidden container.*

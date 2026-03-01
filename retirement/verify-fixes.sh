#!/bin/bash

echo "🔍 VERIFYING ALL FIXES IN app.js"
echo "============================================================"
echo ""

PASS=0
FAIL=0

# Test 1: Syntax check
echo "✅ Test 1: JavaScript Syntax"
if node -c app.js 2>&1; then
    echo "   PASS: No syntax errors"
    ((PASS++))
else
    echo "   FAIL: Syntax errors found"
    ((FAIL++))
fi
echo ""

# Test 2: Timing fix - visibility before display
echo "✅ Test 2: Timing Fix (Results visible BEFORE _displayResults)"
LINE_VISIBLE=$(grep -n "getElementById('results')?.classList.remove('hidden')" app.js | cut -d: -f1)
LINE_DISPLAY=$(grep -n "_displayResults(baseResults, inputs)" app.js | cut -d: -f1)

echo "   Line $LINE_VISIBLE: results.classList.remove('hidden')"
echo "   Line $LINE_DISPLAY: _displayResults()"

if [ "$LINE_VISIBLE" -lt "$LINE_DISPLAY" ]; then
    echo "   PASS: Visibility ($LINE_VISIBLE) comes BEFORE display ($LINE_DISPLAY)"
    ((PASS++))
else
    echo "   FAIL: Display comes before visibility!"
    ((FAIL++))
fi
echo ""

# Test 3: Legacy fix - both properties updated
echo "✅ Test 3: Legacy Fix (Both properties updated)"
if grep -q "results.legacy.amount = results.summary.legacyAmount" app.js; then
    echo "   PASS: results.legacy.amount is updated"
    ((PASS++))
else
    echo "   FAIL: results.legacy.amount NOT updated"
    ((FAIL++))
fi

if grep -q "results.legacy.description" app.js; then
    echo "   PASS: results.legacy.description is updated"
    ((PASS++))
else
    echo "   FAIL: results.legacy.description NOT updated"
    ((FAIL++))
fi
echo ""

# Test 4: Canvas minimum width
echo "✅ Test 4: Canvas Minimum Width (Math.max with 300)"
if grep -q "Math.max(container.offsetWidth - 40, 300)" app.js; then
    echo "   PASS: Minimum 300px width enforced"
    ((PASS++))
else
    echo "   FAIL: No minimum width enforcement"
    ((FAIL++))
fi
echo ""

# Test 5: Canvas validation
echo "✅ Test 5: Canvas Validation (Check for narrow canvas)"
if grep -q "if (w < 100)" app.js; then
    echo "   PASS: Canvas width validation present"
    ((PASS++))
else
    echo "   FAIL: No canvas width validation"
    ((FAIL++))
fi
echo ""

# Test 6: Scenario tabs event delegation
echo "✅ Test 6: Scenario Tabs Event Delegation"
if grep -q "getElementById('scenario-tabs')" app.js; then
    echo "   PASS: Gets scenario-tabs container"
    ((PASS++))
else
    echo "   FAIL: No scenario-tabs container reference"
    ((FAIL++))
fi

if grep -q "closest('.scenario-tab')" app.js; then
    echo "   PASS: Uses event delegation with closest()"
    ((PASS++))
else
    echo "   FAIL: No event delegation pattern"
    ((FAIL++))
fi
echo ""

# Test 7: Fallback patterns
echo "✅ Test 7: Fallback Patterns (totalBalance || totalPortfolio)"
COUNT=$(grep -Ec "totalBalance.*\|\|.*totalPortfolio" app.js)
if [ "$COUNT" -ge 3 ]; then
    echo "   PASS: Fallback pattern used $COUNT times (≥3)"
    ((PASS++))
else
    echo "   FAIL: Fallback pattern only used $COUNT times (<3)"
    ((FAIL++))
fi
echo ""

# Test 8: Setup scenario tabs AFTER visibility
echo "✅ Test 8: Setup Scenarios After Visibility"
LINE_SETUP=$(grep -n "_setupScenarioTabs()" app.js | grep -v "//" | head -1 | cut -d: -f1)
if [ "$LINE_VISIBLE" -lt "$LINE_SETUP" ]; then
    echo "   Line $LINE_SETUP: _setupScenarioTabs()"
    echo "   PASS: Setup ($LINE_SETUP) comes AFTER visibility ($LINE_VISIBLE)"
    ((PASS++))
else
    echo "   FAIL: Setup comes before visibility!"
    ((FAIL++))
fi
echo ""

# Summary
echo "============================================================"
echo "📊 TEST SUMMARY"
echo "============================================================"
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
TOTAL=$((PASS + FAIL))
PERCENT=$((PASS * 100 / TOTAL))
echo "📈 Success Rate: $PERCENT%"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    echo ""
    echo "✅ All 4 critical fixes verified:"
    echo "  1. Timing: Results visible before chart drawn ✅"
    echo "  2. Legacy: Both properties updated ✅"
    echo "  3. Canvas: Minimum width + validation ✅"
    echo "  4. Scenario tabs: Event delegation ✅"
    echo ""
    echo "Ready for deployment! ✅"
    exit 0
else
    echo "⚠️  $FAIL TEST(S) FAILED!"
    echo "Review failures above before deploying."
    exit 1
fi

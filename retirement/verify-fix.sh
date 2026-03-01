#!/bin/bash
echo "🔍 VERIFYING WINDFALL FIX"
echo "================================"
echo ""

echo "✅ Check 1: Portfolio calculation includes 'other' account"
echo "-----------------------------------------------------------"
grep -n "year.other" app.js | grep -E "(totalPortfolio|totalBalance)" | head -5
echo ""

echo "✅ Check 2: Fallback for totalBalance || totalPortfolio"
echo "-----------------------------------------------------------"
grep -n "totalBalance || totalPortfolio" app.js | head -3
echo ""

echo "✅ Check 3: WindfallManager check removed"
echo "-----------------------------------------------------------"
if grep -q "typeof WindfallManager !== 'undefined'" app.js; then
    echo "❌ FAIL: WindfallManager check still exists!"
    grep -n "typeof WindfallManager" app.js
else
    echo "✅ PASS: WindfallManager check removed"
fi
echo ""

echo "✅ Check 4: _applyWindfallsToResults function exists"
echo "-----------------------------------------------------------"
grep -n "_applyWindfallsToResults" app.js | head -3
echo ""

echo "✅ Check 5: Summary recalculation after windfalls"
echo "-----------------------------------------------------------"
grep -A 3 "Recalculate probability" app.js | head -5
echo ""

echo "================================"
echo "✅ VERIFICATION COMPLETE"

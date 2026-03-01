/**
 * DEEP DIAGNOSTIC - Run this in browser console to find ALL bugs
 * Paste this entire script into F12 console after calculating
 */

console.log('🔍 DEEP DIAGNOSTIC STARTING...\n');

// Check if results exist
if (typeof AppV4 === 'undefined') {
    console.error('❌ AppV4 not loaded!');
} else {
    console.log('✅ AppV4 loaded');
    
    // Check if calculation has run
    if (!AppV4.scenarioResults || !AppV4.scenarioResults.base) {
        console.error('❌ No calculation results! Click "Calculate Plan" first.');
    } else {
        console.log('✅ Calculation results exist\n');
        
        const baseScenario = AppV4.scenarioResults.base;
        const results = baseScenario.results;
        const inputs = baseScenario.inputs;
        
        console.log('📊 BASE SCENARIO DATA:');
        console.log('Inputs:', inputs);
        console.log('Results:', results);
        console.log('');
        
        // Check year-by-year data
        console.log('📅 YEAR-BY-YEAR DATA:');
        const yearByYear = results.yearByYear;
        console.log(`Total years: ${yearByYear.length}`);
        console.log('First year:', yearByYear[0]);
        console.log('Last year:', yearByYear[yearByYear.length - 1]);
        console.log('');
        
        // Check for totalBalance vs totalPortfolio
        console.log('🔍 CHECKING totalBalance vs totalPortfolio:');
        const hasTotalBalance = yearByYear.filter(y => y.totalBalance !== undefined).length;
        const hasTotalPortfolio = yearByYear.filter(y => y.totalPortfolio !== undefined).length;
        console.log(`Years with totalBalance: ${hasTotalBalance} / ${yearByYear.length}`);
        console.log(`Years with totalPortfolio: ${hasTotalPortfolio} / ${yearByYear.length}`);
        
        if (hasTotalBalance === 0 && hasTotalPortfolio > 0) {
            console.error('❌ BUG FOUND: No totalBalance, only totalPortfolio!');
            console.log('This will break the chart which expects totalBalance.');
        }
        
        // Check for NaN or undefined values
        console.log('');
        console.log('🔍 CHECKING FOR INVALID VALUES:');
        yearByYear.forEach((year, index) => {
            const balance = year.totalBalance || year.totalPortfolio;
            if (balance === undefined || isNaN(balance)) {
                console.error(`❌ Year ${index} (age ${year.age}): Invalid balance (${balance})`);
            }
        });
        
        // Check legacy amount
        console.log('');
        console.log('💰 LEGACY CALCULATION:');
        const finalYear = yearByYear[yearByYear.length - 1];
        console.log('Final year object:', finalYear);
        console.log(`Final year totalBalance: ${finalYear.totalBalance}`);
        console.log(`Final year totalPortfolio: ${finalYear.totalPortfolio}`);
        console.log(`Results.legacy.amount: ${results.legacy.amount}`);
        console.log(`Results.summary.legacyAmount: ${results.summary.legacyAmount}`);
        
        if (results.legacy.amount === 0 && (finalYear.totalBalance > 0 || finalYear.totalPortfolio > 0)) {
            console.error('❌ BUG FOUND: Legacy shows $0 but final year has money!');
        }
        
        // Check canvas
        console.log('');
        console.log('🎨 CANVAS CHECK:');
        const canvas = document.getElementById('projection-chart');
        if (!canvas) {
            console.error('❌ Canvas element not found!');
        } else {
            console.log(`✅ Canvas found`);
            console.log(`Canvas width: ${canvas.width}`);
            console.log(`Canvas height: ${canvas.height}`);
            console.log(`Canvas offsetWidth: ${canvas.offsetWidth}`);
            console.log(`Canvas offsetHeight: ${canvas.offsetHeight}`);
            console.log(`Parent offsetWidth: ${canvas.parentElement.offsetWidth}`);
            
            if (canvas.width === 0 || canvas.height === 0) {
                console.error('❌ BUG FOUND: Canvas has zero dimensions!');
            }
            
            // Try to detect if anything was drawn
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hasPixels = imageData.data.some(pixel => pixel !== 0);
            console.log(`Canvas has drawn pixels: ${hasPixels}`);
            
            if (!hasPixels) {
                console.error('❌ BUG FOUND: Canvas is blank (nothing drawn)!');
            }
        }
        
        // Check scenario tabs
        console.log('');
        console.log('🔘 SCENARIO TABS CHECK:');
        const tabContainer = document.getElementById('scenario-tabs');
        if (!tabContainer) {
            console.error('❌ Scenario tabs container not found!');
        } else {
            const tabs = tabContainer.querySelectorAll('.scenario-tab');
            console.log(`Found ${tabs.length} scenario tabs`);
            tabs.forEach(tab => {
                console.log(`Tab: ${tab.textContent.trim()} (data-scenario="${tab.dataset.scenario}")`);
            });
            
            // Check if click handler is attached
            if (tabContainer._scenarioClickHandler) {
                console.log('✅ Event delegation handler attached');
            } else {
                console.error('❌ BUG FOUND: No event delegation handler!');
            }
        }
        
        // Check Monte Carlo integration
        console.log('');
        console.log('🎲 MONTE CARLO CHECK:');
        if (AppV4.monteCarloResults) {
            console.log('✅ Monte Carlo results stored in AppV4');
            console.log(`Success rate: ${AppV4.monteCarloResults.successRate}%`);
        } else {
            console.warn('⚠️ Monte Carlo results not stored in AppV4');
        }
        
        if (typeof AppV5Enhanced !== 'undefined') {
            console.log('✅ AppV5Enhanced loaded');
            if (AppV5Enhanced.monteCarloResults) {
                console.log(`AppV5Enhanced success rate: ${AppV5Enhanced.monteCarloResults.successRate}%`);
            }
        } else {
            console.warn('⚠️ AppV5Enhanced not loaded');
        }
        
        // Summary
        console.log('');
        console.log('=' .repeat(60));
        console.log('🎯 DIAGNOSTIC SUMMARY');
        console.log('=' .repeat(60));
        
        const issues = [];
        if (hasTotalBalance === 0 && hasTotalPortfolio > 0) {
            issues.push('Chart expects totalBalance but data has totalPortfolio');
        }
        if (canvas && (canvas.width === 0 || canvas.height === 0)) {
            issues.push('Canvas has zero dimensions');
        }
        if (results.legacy.amount === 0 && finalYear && (finalYear.totalBalance > 0 || finalYear.totalPortfolio > 0)) {
            issues.push('Legacy calculation using wrong property');
        }
        if (!tabContainer || !tabContainer._scenarioClickHandler) {
            issues.push('Scenario tabs event handler not attached');
        }
        
        if (issues.length === 0) {
            console.log('✅ No obvious bugs found!');
        } else {
            console.error(`❌ Found ${issues.length} issues:`);
            issues.forEach((issue, i) => {
                console.error(`${i + 1}. ${issue}`);
            });
        }
    }
}

console.log('\n🔍 DIAGNOSTIC COMPLETE');

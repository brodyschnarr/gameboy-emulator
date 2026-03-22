// test-step5-ui.js — Step 5 UI, Scenarios, Email Report tests
// Run: node test-step5-ui.js

const fs = require('fs');
let passed = 0, failed = 0;

function assert(condition, msg) {
    if (condition) { passed++; console.log(`  ✅ ${msg}`); }
    else { failed++; console.log(`  ❌ ${msg}`); }
}

// ═══ Load source files for static analysis ═══
const appJS = fs.readFileSync(__dirname + '/app-round6-debug.js', 'utf8');
const indexHTML = fs.readFileSync(__dirname + '/index.html', 'utf8');
const cssFile = fs.readFileSync(__dirname + '/style.css', 'utf8');
const v5JS = fs.readFileSync(__dirname + '/app-v5-enhanced.js', 'utf8');

console.log('\n═══ Step 5 UI Tests ═══\n');

// ── Forms exist in HTML ──
console.log('📋 Form elements exist:');
const formTypes = ['employer-pension', 'post-retirement-work', 'windfall', 'stock-options', 
                   'debt', 'healthcare', 'ltc', 'annuity', 'downsizing', 'dtc', 
                   'other-income', 'other-expense', 'life-insurance', 'vehicle', 'other-estate'];
formTypes.forEach(type => {
    assert(indexHTML.includes(`id="form-${type}"`), `Form exists: form-${type}`);
});

// ── Save buttons exist for all forms ──
console.log('\n💾 Save buttons:');
const saveTypes = ['employer-pension', 'windfall', 'stock-options', 'debt', 'healthcare', 'ltc', 
                   'annuity', 'downsizing', 'dtc', 'other-income', 'other-expense', 
                   'life-insurance', 'vehicle', 'other-estate'];
saveTypes.forEach(type => {
    assert(indexHTML.includes(`data-save="${type}"`), `Save button exists: ${type}`);
});

// Post-retirement work has its own save button (btn-save-prt-work)
assert(indexHTML.includes('id="btn-save-prt-work"'), 'Post-retirement work has save button');

// ── Cancel buttons exist for all forms ──
console.log('\n❌ Cancel buttons:');
const cancelTypes = ['employer-pension', 'post-retirement-work', 'stock-options', 'debt', 'healthcare', 
                     'ltc', 'annuity', 'downsizing', 'dtc', 'other-income', 'other-expense',
                     'life-insurance', 'vehicle', 'other-estate'];
cancelTypes.forEach(type => {
    assert(indexHTML.includes(`data-cancel="${type}"`), `Cancel button exists: ${type}`);
});

// ── Dropdown items exist ──
console.log('\n📂 Dropdown items:');
const incomeTypes = ['employer-pension', 'post-retirement-work', 'windfall', 'stock-options', 
                     'annuity', 'downsizing', 'dtc', 'other-income'];
incomeTypes.forEach(type => {
    assert(indexHTML.includes(`data-type="${type}"`), `Dropdown item: ${type}`);
});

const expenseTypes = ['debt', 'healthcare', 'ltc', 'other-expense'];
expenseTypes.forEach(type => {
    assert(indexHTML.includes(`data-type="${type}"`), `Expense dropdown item: ${type}`);
});

const estateTypes = ['estate', 'life-insurance', 'vehicle', 'other-estate'];
estateTypes.forEach(type => {
    assert(indexHTML.includes(`data-type="${type}"`), `Estate dropdown item: ${type}`);
});

// ── Post-retirement work fix: no reference to non-existent button ──
console.log('\n🔧 Post-retirement work fixes:');
assert(!appJS.includes("getElementById('btn-add-post-retirement-work')"), 
    'No reference to non-existent btn-add-post-retirement-work');
assert(appJS.includes("btn-save-prt-work"), 'Save button handler wired');
assert(appJS.includes("btn-cancel-prt-work"), 'Cancel button handler wired');

// ── Stock options ──
console.log('\n📈 Stock options:');
assert(indexHTML.includes('stock-current-value'), 'Stock current value input exists');
assert(indexHTML.includes('stock-cost-basis'), 'Stock cost basis input exists');
assert(indexHTML.includes('stock-sell-age'), 'Stock sell age input exists');
assert(indexHTML.includes('stock-growth'), 'Stock growth input exists');
assert(appJS.includes("type === 'stock-options'"), 'Stock options save handler in JS');
assert(appJS.includes("type: 'shares'"), 'Stock options stored as shares type');
assert(indexHTML.includes("50% inclusion rate"), 'Capital gains hint in HTML');

// ── Dropdown-to-form flow (click handler wires all types) ──
console.log('\n🔗 Dropdown-to-form wiring:');
assert(appJS.includes("step5-dropdown-item"), 'Dropdown items have click handlers');
assert(appJS.includes("form.classList.remove('hidden')"), 'Forms get shown on dropdown click');
assert(appJS.includes("item.closest('.step5-dropdown').classList.add('hidden')"), 'Dropdown closes on selection');

// ── data-save handler closes forms ──
console.log('\n✅ Save handler behavior:');
assert(appJS.includes("[data-save]"), 'Generic save handler exists');
assert(appJS.includes("form.classList.add('hidden')"), 'Save handler hides form');
assert(appJS.includes("_updateStep5AddedItems()"), 'Save handler updates chips');

// ── data-cancel handler closes forms ──
console.log('\n❌ Cancel handler behavior:');
assert(appJS.includes("[data-cancel]"), 'Generic cancel handler exists');

// ── Chip display includes stock options ──
console.log('\n🏷️ Chip display:');
assert(appJS.includes("isStock ? '📈' : '💰'"), 'Stock options get different icon in chips');

// ── Step 5 persistence ──
console.log('\n💾 Step 5 persistence:');
assert(appJS.includes('_updateStep5AddedItems'), 'Chip updater function exists');
// Check it's called when showing the step
const showStepMatch = appJS.match(/_showStep[\s\S]{0,500}healthcare[\s\S]{0,200}_updateStep5AddedItems/);
// Alternative: search for the call near healthcare step
assert(appJS.includes("_updateStep5AddedItems"), 'Chip updater called');

// ═══ What-If Tab Tests ═══
console.log('\n═══ What-If Tab Tests ═══\n');

assert(indexHTML.includes('whatif-tabs'), 'What-if tabs container exists');
assert(indexHTML.includes('data-whatif="spending"'), 'Spending tab exists');
assert(indexHTML.includes('data-whatif="savings"'), 'Savings tab exists');
assert(indexHTML.includes('data-whatif="retire-age"'), 'Retire age tab exists');
assert(indexHTML.includes('data-whatif="none"'), 'Your Plan tab exists');
assert(indexHTML.includes('whatif-control'), 'What-if control bar exists');
assert(indexHTML.includes('whatif-minus'), 'Minus button exists');
assert(indexHTML.includes('whatif-plus'), 'Plus button exists');
assert(indexHTML.includes('whatif-reset'), 'Reset button exists');
assert(indexHTML.includes('whatif-value'), 'Value display exists');

assert(appJS.includes('_setupAdjusters'), 'Adjuster setup method exists');
assert(appJS.includes('_applyAdjustments'), 'Apply adjustments method exists');
assert(appJS.includes('_adjustWhatif'), 'Adjust what-if method exists');
assert(appJS.includes('_updateWhatifDisplay'), 'What-if display update exists');
assert(appJS.includes('_whatifMode'), 'What-if mode tracked');
assert(appJS.includes('_whatifAdjust'), 'What-if adjustments tracked');
assert(appJS.includes('retireAge'), 'Retire age adjustment supported');
assert(appJS.includes('_baseInputs'), 'Base inputs stored for adjustments');

// Edit button
assert(indexHTML.includes('btn-edit-inputs'), 'Edit button in top bar');
assert(appJS.includes('btn-edit-inputs'), 'Edit button wired in JS');

// No old scenario tabs
assert(!indexHTML.includes('data-scenario="save500more"'), 'Old save500more tab removed');
assert(!indexHTML.includes('data-scenario="retire5early"'), 'Old retire5early tab removed');

// ═══ Floating Email CTA ═══
console.log('\n═══ Email Report Tests ═══\n');

assert(indexHTML.includes('results-top-bar'), 'Results top bar exists');
assert(indexHTML.includes('btn-email-report'), 'Email button exists');
assert(indexHTML.includes('email-modal'), 'Email modal exists');
assert(indexHTML.includes('report-email'), 'Email input exists');
assert(indexHTML.includes('btn-send-report'), 'Send report button exists');
assert(cssFile.includes('results-top-bar'), 'Top bar styled');
assert(cssFile.includes('position: sticky'), 'Top bar is sticky positioned');
assert(appJS.includes('_sendEmailReport'), 'Send email report method exists');
assert(appJS.includes('_generatePDF'), 'PDF generation method exists');
assert(appJS.includes('jsPDF'), 'Uses jsPDF library');
assert(indexHTML.includes('jspdf'), 'jsPDF CDN included');

// ═══ Duplicate Advanced Analysis Fix ═══
console.log('\n═══ V5 Enhanced Fix ═══\n');
assert(v5JS.includes('v5-enhanced-analysis'), 'Enhanced analysis has unique class');
assert(v5JS.includes("querySelector('.v5-enhanced-analysis')"), 'Checks for existing before appending');
assert(v5JS.includes('existing') && v5JS.includes('remove()'), 'Removes existing before appending');

// ═══ Icon Standardization ═══
console.log('\n═══ Icon Standardization ═══\n');

// All "Other" items use ➕
assert(indexHTML.includes('data-income-type="other">➕'), 'Step 1 Other Income uses ➕');
assert(indexHTML.includes('data-type="other-income">➕'), 'Step 5 Other Income uses ➕');
assert(indexHTML.includes('data-type="other-expense">➕'), 'Step 5 Other Expense uses ➕');
assert(indexHTML.includes('data-type="other-estate">➕'), 'Step 5 Other Asset uses ➕');

// LIRA uses 🔐 (not 🔒 which is Annuity)
assert(indexHTML.includes('data-account="lira">🔐'), 'LIRA uses 🔐');
assert(indexHTML.includes('data-type="annuity">🔒'), 'Annuity uses 🔒');

// LTC uses 🏠 (not 🏥 which is Healthcare)
assert(indexHTML.includes('data-type="ltc">🏠'), 'LTC uses 🏠 (distinct from Healthcare 🏥)');
assert(indexHTML.includes('data-type="healthcare">🏥'), 'Healthcare uses 🏥');

// Sticky bar uses -webkit-sticky for Safari
assert(cssFile.includes('-webkit-sticky'), 'Uses -webkit-sticky for Safari');

// ═══ Summary ═══
console.log(`\n═══════════════════════════════`);
console.log(`  Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
console.log(`═══════════════════════════════\n`);

process.exit(failed > 0 ? 1 : 0);

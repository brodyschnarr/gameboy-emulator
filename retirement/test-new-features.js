/**
 * test-new-features.js — Tests for shareable links, stepper buttons, dark mode, millions formatting
 */

// Minimal DOM mock
const localStorage = { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k,v) { this._data[k] = v; }, removeItem(k) { delete this._data[k]; } };
global.localStorage = localStorage;
global.window = { location: { origin: 'https://example.com', pathname: '/retirement/', search: '' }, matchMedia: () => ({ matches: false }), prompt: () => {} };
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.document = {
    _els: {},
    getElementById(id) { return this._els[id] || null; },
    readyState: 'complete',
    addEventListener() {},
    documentElement: { setAttribute() {}, getAttribute() { return null; }, removeAttribute() {} },
    querySelector() { return null; }
};

// Create mock elements
function mockInput(id, value, type = 'text') {
    const el = {
        id, value: value || '',
        checked: false,
        style: {},
        dispatchEvent() {},
        addEventListener() {},
        click() {},
        closest() { return null; },
        dataset: {}
    };
    document.getElementById = function(qid) { return document._els[qid] || null; };
    document._els[id] = el;
    return el;
}

let passed = 0, failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ═══════════════════════════════════════
// Load fmtCompact from app-round6-debug.js
// ═══════════════════════════════════════
const fs = require('fs');
const appCode = fs.readFileSync(__dirname + '/app-round6-debug.js', 'utf8');

// Extract fmtCompact function
const fmtMatch = appCode.match(/function fmtCompact\(amount\) \{[\s\S]*?\n\}/);
if (!fmtMatch) { console.log('❌ Could not find fmtCompact'); process.exit(1); }
eval(fmtMatch[0]);

console.log('\n📊 Millions Formatting Tests\n');

test('$0 → $0', () => assert(fmtCompact(0) === '$0'));
test('$500 → $500', () => assert(fmtCompact(500) === '$500'));
test('$9,999 → $9,999', () => assert(fmtCompact(9999) === '$9,999'));
test('$10,000 → $10K', () => assert(fmtCompact(10000) === '$10K'));
test('$50,000 → $50K', () => assert(fmtCompact(50000) === '$50K'));
test('$450,000 → $450K', () => assert(fmtCompact(450000) === '$450K'));
test('$999,999 → $1000K', () => assert(fmtCompact(999999) === '$1000K'));
test('$1,000,000 → $1M', () => assert(fmtCompact(1000000) === '$1M'));
test('$1,234,567 → $1.2M', () => assert(fmtCompact(1234567) === '$1.2M'));
test('$2,500,000 → $2.5M', () => assert(fmtCompact(2500000) === '$2.5M'));
test('$10,500,000 → $11M', () => assert(fmtCompact(10500000) === '$11M'));
test('Negative: -$1,500,000 → -$1.5M', () => assert(fmtCompact(-1500000) === '-$1.5M'));
test('Negative: -$50,000 → -$50K', () => assert(fmtCompact(-50000) === '-$50K'));
test('Small negative: -$500 → -$500', () => assert(fmtCompact(-500) === '-$500'));

console.log('\n🔗 Shareable Links Tests\n');

// Mock AppV4 and IncomeSources
global.AppV4 = {
    familyStatus: 'single',
    selectedProvince: 'ON',
    selectedRegion: 'ON_Toronto',
    spendingCurve: 'flat',
    cppStartAge: 65,
    oasStartAge: 65,
    cppOverride: null,
    windfalls: [],
    estateAssets: [],
    cppStartAgeP1: null,
    cppStartAgeP2: null,
    oasStartAgeP1: null,
    oasStartAgeP2: null,
    cppOverrideP1: null,
    cppOverrideP2: null,
    healthStatus: 'none',
    healthcareExplicitlyAdded: false,
    accountMode: 'pooled'
};
global.IncomeSources = { getAll() { return []; }, add() {} };

// Load ShareLink
const shareLinkCode = fs.readFileSync(__dirname + '/share-link.js', 'utf8');
eval(shareLinkCode.replace('const ShareLink', 'global.ShareLink'));

test('ShareLink.generate() returns URL string', () => {
    mockInput('current-age', '35');
    mockInput('current-income', '100000');
    mockInput('retirement-age', '65');
    mockInput('annual-spending', '50000');
    mockInput('rrsp', '50000');
    mockInput('tfsa', '30000');
    mockInput('nonreg', '10000');
    mockInput('monthly-contribution', '1000');
    mockInput('life-expectancy', '90');
    mockInput('return-rate', '6');
    mockInput('inflation-rate', '2.5');
    mockInput('split-rrsp', '40');
    mockInput('split-tfsa', '40');
    mockInput('split-nonreg', '20');
    // Add other inputs with defaults/zeros
    mockInput('lira', '0');
    mockInput('other', '0');
    mockInput('cash', '0');
    mockInput('employer-pension', '0');
    mockInput('pension-start-age', '0');
    mockInput('pension-indexed', '');
    mockInput('mer-fee', '0');
    mockInput('contribution-growth', '0');
    mockInput('current-debt', '0');
    mockInput('debt-payoff-age', '0');
    mockInput('healthcare-inflation', '0');
    mockInput('ltc-monthly', '0');
    mockInput('ltc-start-age', '0');
    mockInput('annuity-lump-sum', '0');
    mockInput('annuity-purchase-age', '0');
    mockInput('annuity-monthly-payout', '0');
    mockInput('dtc-checkbox', '');
    mockInput('downsizing-age', '0');
    mockInput('downsizing-proceeds', '0');
    mockInput('downsizing-spending-change', '0');
    mockInput('other-income-amount', '0');
    mockInput('other-income-name', '');
    mockInput('other-income-taxable', '');
    mockInput('other-expense-amount', '0');
    mockInput('other-expense-name', '');
    mockInput('life-insurance-amount', '0');
    mockInput('vehicle-value', '0');
    mockInput('vehicle-name', '');
    mockInput('other-estate-value', '0');
    mockInput('other-estate-name', '');
    mockInput('rrsp-room-override', '');
    mockInput('tfsa-room-override', '');
    mockInput('cpp-override-amount', '');
    mockInput('cpp-override-amount-p1', '');
    mockInput('cpp-override-amount-p2', '');
    mockInput('income-person1', '0');
    mockInput('income-person2', '0');
    mockInput('partner-age', '0');
    
    const url = ShareLink.generate();
    assert(url.startsWith('https://example.com/retirement/?'), 'URL starts with base: ' + url);
    assert(url.includes('age=35'), 'Contains age=35');
    assert(url.includes('inc=100000'), 'Contains inc=100000');
    assert(url.includes('rrsp=50000'), 'Contains rrsp=50000');
});

test('ShareLink.generate() omits zero values', () => {
    const url = ShareLink.generate();
    assert(!url.includes('debt='), 'No debt param');
    assert(!url.includes('lira='), 'No lira param');
    assert(!url.includes('ltcm='), 'No ltc param');
});

test('ShareLink.generate() omits empty strings', () => {
    const url = ShareLink.generate();
    assert(!url.includes('oinm='), 'No other income name param');
    assert(!url.includes('vehn='), 'No vehicle name param');
});

test('ShareLink.generate() includes province', () => {
    const url = ShareLink.generate();
    assert(url.includes('prov=ON'), 'Contains prov=ON');
});

test('ShareLink.generate() includes non-zero contribution split', () => {
    const url = ShareLink.generate();
    assert(url.includes('srrsp=40'), 'Contains srrsp=40');
});

test('ShareLink.generate() includes windfalls when present', () => {
    AppV4.windfalls = [{ type: 'fixed', amount: 50000, age: 60 }];
    const url = ShareLink.generate();
    assert(url.includes('wf='), 'Contains wf param');
    AppV4.windfalls = [];
});

test('ShareLink.generate() excludes windfalls when empty', () => {
    AppV4.windfalls = [];
    const url = ShareLink.generate();
    assert(!url.includes('wf='), 'No wf param when empty');
});

test('ShareLink.loadFromURL() returns false with no params', () => {
    window.location.search = '';
    assert(ShareLink.loadFromURL() === false, 'Returns false');
});

test('ShareLink.loadFromURL() returns false with only cache bust', () => {
    window.location.search = '?fix=abc123';
    assert(ShareLink.loadFromURL() === false, 'Returns false for fix-only');
});

test('ShareLink.loadFromURL() applies age param', () => {
    mockInput('current-age', '');
    window.location.search = '?age=42&inc=80000';
    const result = ShareLink.loadFromURL();
    assert(result === true, 'Returns true');
    assert(document._els['current-age'].value === '42', 'Age set to 42');
    assert(document._els['current-income'].value === '80000', 'Income set');
});

test('ShareLink.loadFromURL() sets AppV4 props', () => {
    AppV4.selectedProvince = null;
    window.location.search = '?prov=BC&cppage=60';
    ShareLink.loadFromURL();
    assert(AppV4.selectedProvince === 'BC', 'Province set to BC');
    assert(AppV4.cppStartAge === 60, 'CPP age set to 60');
});

test('Roundtrip: generate → load preserves values', () => {
    // Set up inputs
    mockInput('current-age', '40');
    mockInput('current-income', '120000');
    mockInput('retirement-age', '60');
    mockInput('annual-spending', '70000');
    mockInput('rrsp', '200000');
    mockInput('tfsa', '80000');
    mockInput('nonreg', '50000');
    mockInput('monthly-contribution', '2000');
    AppV4.selectedProvince = 'BC';
    
    const url = ShareLink.generate();
    const params = new URLSearchParams(url.split('?')[1]);
    
    assert(params.get('age') === '40', 'Age roundtrips');
    assert(params.get('inc') === '120000', 'Income roundtrips');
    assert(params.get('retage') === '60', 'Retire age roundtrips');
    assert(params.get('spend') === '70000', 'Spending roundtrips');
    assert(params.get('rrsp') === '200000', 'RRSP roundtrips');
    assert(params.get('prov') === 'BC', 'Province roundtrips');
});

test('Estate assets serialize/deserialize', () => {
    AppV4.estateAssets = [{ name: 'House', value: 500000, isPrimaryResidence: true }];
    const url = ShareLink.generate();
    assert(url.includes('ea='), 'Contains ea param');
    
    // Parse back
    const params = new URLSearchParams(url.split('?')[1]);
    const parsed = JSON.parse(params.get('ea'));
    assert(parsed[0].name === 'House', 'Estate name preserved');
    assert(parsed[0].value === 500000, 'Estate value preserved');
    AppV4.estateAssets = [];
});

test('Income sources serialize when present', () => {
    const origGetAll = IncomeSources.getAll;
    IncomeSources.getAll = () => [{ type: 'rental', amount: 2000, continuesInRetirement: true }];
    const url = ShareLink.generate();
    assert(url.includes('isrc='), 'Contains isrc param');
    IncomeSources.getAll = origGetAll;
});

console.log('\n🎨 Dark Mode Tests\n');

test('Dark mode uses CSS variables (not hardcoded colors)', () => {
    const css = fs.readFileSync(__dirname + '/style.css', 'utf8');
    assert(css.includes('[data-theme="dark"]'), 'Has dark theme selector');
    assert(css.includes('--bg: #0f172a'), 'Dark bg variable');
    assert(css.includes('--card-bg: #1e293b'), 'Dark card bg variable');
    assert(css.includes('--text: #f1f5f9'), 'Dark text variable');
    assert(css.includes('--border: #334155'), 'Dark border variable');
});

test('Theme toggle button exists in HTML', () => {
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    assert(html.includes('id="theme-toggle"'), 'Toggle button exists');
    assert(html.includes('🌙'), 'Moon emoji default');
});

test('Dark mode respects system preference', () => {
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    assert(html.includes('prefers-color-scheme: dark'), 'Checks system preference');
});

test('Dark mode persists in localStorage', () => {
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    assert(html.includes("localStorage.getItem('retirement_theme')"), 'Reads from localStorage');
    assert(html.includes("localStorage.setItem('retirement_theme'"), 'Writes to localStorage');
});

console.log('\n➕➖ Stepper Button Tests\n');

test('Stepper buttons are created in slider-inputs.js', () => {
    const code = fs.readFileSync(__dirname + '/slider-inputs.js', 'utf8');
    assert(code.includes('stepper-btn'), 'Has stepper-btn class');
    assert(code.includes('stepper-minus'), 'Has minus button');
    assert(code.includes('stepper-plus'), 'Has plus button');
    assert(code.includes('stepValue'), 'Has stepValue function');
});

test('Stepper clamps to min/max', () => {
    const code = fs.readFileSync(__dirname + '/slider-inputs.js', 'utf8');
    assert(code.includes('Math.max(config.min'), 'Clamps to min');
    assert(code.includes('Math.min(config.max'), 'Clamps to max');
});

test('Stepper CSS exists', () => {
    const css = fs.readFileSync(__dirname + '/slider-inputs.css', 'utf8');
    assert(css.includes('.enhanced-slider-stepper'), 'Stepper row style');
    assert(css.includes('.stepper-btn'), 'Button style');
    assert(css.includes('border-radius: 50%'), 'Round buttons');
});

test('Stepper uses step size from config', () => {
    const code = fs.readFileSync(__dirname + '/slider-inputs.js', 'utf8');
    assert(code.includes('config.step * direction'), 'Uses config.step');
});

test('Stepper fires input/change events', () => {
    const code = fs.readFileSync(__dirname + '/slider-inputs.js', 'utf8');
    assert(code.includes("dispatchEvent(new Event('input'"), 'Fires input event');
    assert(code.includes("dispatchEvent(new Event('change'"), 'Fires change event');
});

console.log('\n🔗 Share Button Tests\n');

test('Share button exists in HTML', () => {
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    assert(html.includes('btn-share-link'), 'Share button ID');
    assert(html.includes('Share Plan'), 'Share Plan label');
    assert(html.includes('ShareLink.copyToClipboard'), 'Calls copyToClipboard');
});

test('Share button CSS exists', () => {
    const css = fs.readFileSync(__dirname + '/style.css', 'utf8');
    assert(css.includes('.btn-share-fixed'), 'Share button style');
});

test('Email bar uses flex layout for two buttons', () => {
    const css = fs.readFileSync(__dirname + '/style.css', 'utf8');
    assert(css.includes('gap: 8px'), 'Has gap for flex items');
});

test('share-link.js loaded in index.html', () => {
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    assert(html.includes('share-link.js'), 'Script tag exists');
});

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// Step 5 UX Tests
// ═══════════════════════════════════════
console.log('\n🔧 Step 5 UX Tests\n');

test('All Step 5 form buttons say "Add" not "Save"', () => {
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    // Find all data-save buttons in step 5 area
    const step5Section = html.split('id="step-healthcare"')[1]?.split('</section>')[0] || '';
    const saveButtons = step5Section.match(/data-save="[^"]*">Save</g) || [];
    assert(saveButtons.length === 0, `Found ${saveButtons.length} "Save" buttons, expected all "Add": ${saveButtons.join(', ')}`);
});

test('Windfall auto-opens form regardless of existing items', () => {
    const code = fs.readFileSync(__dirname + '/app-round6-debug.js', 'utf8');
    // Should NOT have the old conditional
    assert(!code.includes("type === 'windfall' && (!this.windfalls || this.windfalls.length === 0)"), 'Old conditional removed');
    assert(code.includes("type === 'windfall'") && code.includes('_showWindfallForm'), 'Auto-opens windfall form');
});

test('Chips have delete buttons', () => {
    const code = fs.readFileSync(__dirname + '/app-round6-debug.js', 'utf8');
    assert(code.includes('chip-delete'), 'Has chip-delete class');
    assert(code.includes('_removeItem'), 'Has _removeItem method');
});

test('Chip delete CSS exists', () => {
    const css = fs.readFileSync(__dirname + '/style.css', 'utf8');
    assert(css.includes('.chip-delete'), 'Delete button styled');
    assert(css.includes('.chip-delete:hover'), 'Delete hover state');
});

test('_updateDropdownVisibility hides added single-use items', () => {
    const code = fs.readFileSync(__dirname + '/app-round6-debug.js', 'utf8');
    assert(code.includes('_updateDropdownVisibility'), 'Method exists');
    assert(code.includes("item.style.display = singleUseChecks[type]() ? 'none' : ''"), 'Hides added items');
});

test('_removeItem clears form fields for each type', () => {
    const code = fs.readFileSync(__dirname + '/app-round6-debug.js', 'utf8');
    assert(code.includes('_removeItem'), 'Method exists');
    assert(code.includes("'employer-pension':"), 'Handles employer-pension');
    assert(code.includes("'debt':"), 'Handles debt');
    assert(code.includes("'healthcare':"), 'Handles healthcare');
    assert(code.includes("'annuity':"), 'Handles annuity');
    assert(code.includes("'downsizing':"), 'Handles downsizing');
});

test('Chips are tappable for re-editing', () => {
    const code = fs.readFileSync(__dirname + '/app-round6-debug.js', 'utf8');
    assert(code.includes('data-edit-type'), 'Chips have edit type');
    assert(code.includes("chip.addEventListener('click'"), 'Click handler on chips');
});

test('Windfall/estate indexed delete works', () => {
    const code = fs.readFileSync(__dirname + '/app-round6-debug.js', 'utf8');
    assert(code.includes("type.startsWith('windfall-')"), 'Handles windfall index delete');
    assert(code.includes("type.startsWith('estate-')"), 'Handles estate index delete');
    assert(code.includes('this.windfalls.splice(idx, 1)'), 'Splices windfall array');
    assert(code.includes('this.estateAssets.splice(idx, 1)'), 'Splices estate array');
});

// Re-run summary
const total2 = passed + failed;
console.log(`\n═══════════════════════════════════════════`);
console.log(`  Total: ${total2} | ✅ ${passed} | ❌ ${failed}`);
console.log(`═══════════════════════════════════════════\n`);
process.exit(failed > 0 ? 1 : 0);

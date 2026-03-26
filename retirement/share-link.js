/**
 * share-link.js — Encode/decode retirement inputs in URL for sharing
 * 
 * Usage: ShareLink.generate() → URL string
 *        ShareLink.loadFromURL() → applies params to form (auto-runs on page load)
 */
const ShareLink = {
    // Map of URL param keys → { inputId, type, default }
    // Short keys to keep URLs compact
    PARAM_MAP: {
        // Step 1: Basics
        age:    { id: 'current-age', type: 'int' },
        page:   { id: 'partner-age', type: 'int' },
        fam:    { prop: 'familyStatus', type: 'enum', values: ['single', 'couple'] },
        inc:    { id: 'current-income', type: 'float' },
        inc1:   { id: 'income-person1', type: 'float' },
        inc2:   { id: 'income-person2', type: 'float' },
        prov:   { prop: 'selectedProvince', type: 'string' },
        reg:    { prop: 'selectedRegion', type: 'string' },

        // Step 2: Savings (combined)
        rrsp:   { id: 'rrsp', type: 'float' },
        tfsa:   { id: 'tfsa', type: 'float' },
        nreg:   { id: 'nonreg', type: 'float' },
        lira:   { id: 'lira', type: 'float' },
        othr:   { id: 'other', type: 'float' },
        cash:   { id: 'cash', type: 'float' },

        // Step 2: Savings (separate P1/P2)
        rp1:    { id: 'rrsp-p1', type: 'float' },
        tp1:    { id: 'tfsa-p1', type: 'float' },
        np1:    { id: 'nonreg-p1', type: 'float' },
        lp1:    { id: 'lira-p1', type: 'float' },
        op1:    { id: 'other-p1', type: 'float' },
        cp1:    { id: 'cash-p1', type: 'float' },
        rp2:    { id: 'rrsp-p2', type: 'float' },
        tp2:    { id: 'tfsa-p2', type: 'float' },
        np2:    { id: 'nonreg-p2', type: 'float' },
        lp2:    { id: 'lira-p2', type: 'float' },
        op2:    { id: 'other-p2', type: 'float' },
        cp2:    { id: 'cash-p2', type: 'float' },
        c1pct:  { id: 'contrib-p1-pct', type: 'float' },

        // Employer pension
        epen:   { id: 'employer-pension', type: 'float' },
        psage:  { id: 'pension-start-age', type: 'int' },
        pidx:   { id: 'pension-indexed', type: 'bool' },

        // Home value
        hval:   { id: 'home-value', type: 'float' },

        // Step 3: Contributions
        mcon:   { id: 'monthly-contribution', type: 'float' },
        srrsp:  { id: 'split-rrsp', type: 'float' },
        stfsa:  { id: 'split-tfsa', type: 'float' },
        snreg:  { id: 'split-nonreg', type: 'float' },

        // Step 4: Retirement
        retage: { id: 'retirement-age', type: 'int' },
        life:   { id: 'life-expectancy', type: 'int' },
        spend:  { id: 'annual-spending', type: 'float' },
        curve:  { prop: 'spendingCurve', type: 'enum', values: ['flat', 'frontloaded'] },

        // CPP/OAS (single)
        cppage: { prop: 'cppStartAge', type: 'int' },
        oasage: { prop: 'oasStartAge', type: 'int' },
        cppov:  { prop: 'cppOverride', type: 'float' },

        // CPP/OAS (couple)
        cppa1:  { prop: 'cppStartAgeP1', type: 'int' },
        cppa2:  { prop: 'cppStartAgeP2', type: 'int' },
        oasa1:  { prop: 'oasStartAgeP1', type: 'int' },
        oasa2:  { prop: 'oasStartAgeP2', type: 'int' },
        cppo1:  { prop: 'cppOverrideP1', type: 'float' },
        cppo2:  { prop: 'cppOverrideP2', type: 'float' },

        // Step 5: Debt
        debt:   { id: 'current-debt', type: 'float' },
        dpay:   { id: 'debt-payoff-age', type: 'int' },

        // Healthcare
        hlth:   { prop: 'healthStatus', type: 'string' },
        hexp:   { prop: 'healthcareExplicitlyAdded', type: 'bool' },

        // Advanced assumptions
        ret:    { id: 'return-rate', type: 'float' },
        inf:    { id: 'inflation-rate', type: 'float' },
        mer:    { id: 'mer-fee', type: 'float' },
        cgr:    { id: 'contribution-growth', type: 'float' },

        // Tier 2/3
        hinf:   { id: 'healthcare-inflation', type: 'float' },
        ltcm:   { id: 'ltc-monthly', type: 'float' },
        ltca:   { id: 'ltc-start-age', type: 'int' },
        anls:   { id: 'annuity-lump-sum', type: 'float' },
        anpa:   { id: 'annuity-purchase-age', type: 'int' },
        anmp:   { id: 'annuity-monthly-payout', type: 'float' },
        dtc:    { id: 'dtc-checkbox', type: 'bool' },
        metc:   { id: 'metc-checkbox', type: 'bool' },
        metca:  { id: 'metc-annual', type: 'float' },
        hatc:   { id: 'hatc-checkbox', type: 'bool' },
        care:   { id: 'caregiver-checkbox', type: 'bool' },
        dsage:  { id: 'downsizing-age', type: 'int' },
        dsprc:  { id: 'downsizing-proceeds', type: 'float' },
        dssc:   { id: 'downsizing-spending-change', type: 'float' },

        // Estate
        liins:  { id: 'life-insurance-amount', type: 'float' },
        vehv:   { id: 'vehicle-value', type: 'float' },
        vehn:   { id: 'vehicle-name', type: 'string' },
        oev:    { id: 'other-estate-value', type: 'float' },
        oen:    { id: 'other-estate-name', type: 'string' },

        // Contribution room
        rroom:  { id: 'rrsp-room-override', type: 'float' },
        troom:  { id: 'tfsa-room-override', type: 'float' },
    },

    /**
     * Generate a shareable URL from current form state
     */
    generate() {
        const params = new URLSearchParams();

        // Determine account mode from DOM
        const sepSection = document.getElementById('separate-accounts-section');
        const isSeparate = sepSection && !sepSection.classList.contains('hidden');
        if (isSeparate) params.set('acm', 'sep');

        for (const [key, config] of Object.entries(this.PARAM_MAP)) {
            let value;

            if (config.id) {
                const el = document.getElementById(config.id);
                if (!el) continue;
                if (config.type === 'bool') {
                    value = el.checked ? '1' : '0';
                    if (value === '0') continue; // skip defaults
                } else {
                    value = el.value;
                }
            } else if (config.prop) {
                value = AppV4[config.prop];
                if (value === null || value === undefined) continue;
                if (config.type === 'bool') {
                    value = value ? '1' : '0';
                    if (value === '0') continue;
                }
            }

            // Skip empty/zero/default values to keep URL short
            if (value === '' || value === undefined || value === null) continue;
            if (config.type === 'float' || config.type === 'int') {
                const num = parseFloat(value);
                if (isNaN(num) || num === 0) continue;
            }
            // Skip 'none' and 'average' defaults for string props
            if (config.type === 'string' && (value === 'none' || value === '')) continue;

            params.set(key, String(value));
        }

        // Windfalls (complex objects — JSON encode, compact)
        if (AppV4.windfalls && AppV4.windfalls.length > 0) {
            params.set('wf', JSON.stringify(AppV4.windfalls));
        }

        // Income sources
        if (typeof IncomeSources !== 'undefined') {
            const sources = IncomeSources.getAll();
            if (sources.length > 0) {
                params.set('isrc', JSON.stringify(sources));
            }
        }

        // Estate assets
        if (AppV4.estateAssets && AppV4.estateAssets.length > 0) {
            params.set('ea', JSON.stringify(AppV4.estateAssets));
        }

        // Other income/expense items (multi-add)
        if (AppV4.otherIncomeItems && AppV4.otherIncomeItems.length > 0) {
            params.set('oi', JSON.stringify(AppV4.otherIncomeItems));
        }
        if (AppV4.otherExpenseItems && AppV4.otherExpenseItems.length > 0) {
            params.set('oe', JSON.stringify(AppV4.otherExpenseItems));
        }

        // Post-retirement work items
        if (AppV4.postRetirementWorkItems && AppV4.postRetirementWorkItems.length > 0) {
            params.set('prt', JSON.stringify(AppV4.postRetirementWorkItems));
        }

        const base = window.location.origin + window.location.pathname;
        return base + '?' + params.toString();
    },

    /**
     * Load inputs from URL params on page load
     * Returns true if params were found and applied
     */
    loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        // Skip if only cache-bust params
        const realParams = [...params.keys()].filter(k => k !== 'fix' && k !== 't' && k !== 'v');
        if (realParams.length === 0) return false;

        let applied = false;

        // Account mode (must be set before fields to show proper sections)
        const acm = params.get('acm');

        // Family status (must be set first to show proper UI)
        if (params.has('fam')) {
            const famVal = params.get('fam');
            AppV4.familyStatus = famVal;
            const singleBtn = document.getElementById('family-single');
            const coupleBtn = document.getElementById('family-couple');
            if (famVal === 'couple' && coupleBtn) {
                coupleBtn.classList.add('active');
                singleBtn?.classList.remove('active');
                AppV4.familyStatus = 'couple';
                AppV4._toggleFamilyUI();
            } else if (singleBtn) {
                singleBtn.classList.add('active');
                coupleBtn?.classList.remove('active');
                AppV4.familyStatus = 'single';
                AppV4._toggleFamilyUI();
            }
            applied = true;
        }

        // Separate accounts mode (trigger UI)
        if (acm === 'sep') {
            const sepBtn = document.getElementById('accounts-separate');
            if (sepBtn) {
                sepBtn.click();
            }
            applied = true;
        }

        // Province/region (before other fields)
        if (params.has('prov')) {
            AppV4.selectedProvince = params.get('prov');
            // Try to click the province on the map or set it
            if (typeof AppV4._selectProvince === 'function') {
                AppV4._selectProvince(params.get('prov'));
            }
            applied = true;
        }
        if (params.has('reg')) {
            AppV4.selectedRegion = params.get('reg');
            applied = true;
        }

        // Apply all simple params
        for (const [key, config] of Object.entries(this.PARAM_MAP)) {
            if (key === 'fam' || key === 'prov' || key === 'reg') continue; // already handled
            const raw = params.get(key);
            if (raw === null) continue;

            if (config.id) {
                const el = document.getElementById(config.id);
                if (!el) continue;

                if (config.type === 'bool') {
                    el.checked = raw === '1' || raw === 'true';
                } else {
                    el.value = raw;
                }
                // Fire events so sliders/listeners sync
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                applied = true;
            } else if (config.prop) {
                let val = raw;
                if (config.type === 'int') val = parseInt(raw);
                else if (config.type === 'float') val = parseFloat(raw);
                else if (config.type === 'bool') val = raw === '1' || raw === 'true';
                AppV4[config.prop] = val;
                applied = true;
            }
        }

        // Spending curve buttons
        if (params.has('curve')) {
            AppV4.spendingCurve = params.get('curve');
            document.querySelectorAll('.curve-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.curve === params.get('curve'));
            });
        }

        // Windfalls
        if (params.has('wf')) {
            try { AppV4.windfalls = JSON.parse(params.get('wf')); } catch (e) {}
        }

        // Income sources
        if (params.has('isrc')) {
            try {
                const sources = JSON.parse(params.get('isrc'));
                if (typeof IncomeSources !== 'undefined' && Array.isArray(sources)) {
                    sources.forEach(s => IncomeSources.add(s));
                }
            } catch (e) {}
        }

        // Estate assets
        if (params.has('ea')) {
            try { AppV4.estateAssets = JSON.parse(params.get('ea')); } catch (e) {}
        }
        if (params.has('oi')) {
            try { AppV4.otherIncomeItems = JSON.parse(params.get('oi')); } catch (e) {}
        }
        if (params.has('oe')) {
            try { AppV4.otherExpenseItems = JSON.parse(params.get('oe')); } catch (e) {}
        }
        if (params.has('prt')) {
            try { AppV4.postRetirementWorkItems = JSON.parse(params.get('prt')); } catch (e) {}
        }

        // Update chips display
        if (applied && typeof AppV4._updateStep5AddedItems === 'function') {
            setTimeout(() => AppV4._updateStep5AddedItems(), 300);
        }

        return applied;
    },

    /**
     * Copy shareable link to clipboard and show feedback
     */
    copyToClipboard() {
        const url = this.generate();
        navigator.clipboard.writeText(url).then(() => {
            const btn = document.getElementById('btn-share-link');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '✅ Link copied!';
                btn.style.background = '#10b981';
                setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2500);
            }
        }).catch(() => {
            // Fallback: select text in a temp input
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            const btn = document.getElementById('btn-share-link');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '✅ Link copied!';
                setTimeout(() => { btn.innerHTML = orig; }, 2500);
            }
        });
    }
};

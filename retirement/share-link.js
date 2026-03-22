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

        // Step 2: Savings
        rrsp:   { id: 'rrsp', type: 'float' },
        tfsa:   { id: 'tfsa', type: 'float' },
        nreg:   { id: 'nonreg', type: 'float' },
        lira:   { id: 'lira', type: 'float' },
        othr:   { id: 'other', type: 'float' },
        cash:   { id: 'cash', type: 'float' },
        epen:   { id: 'employer-pension', type: 'float' },
        psage:  { id: 'pension-start-age', type: 'int' },
        pidx:   { id: 'pension-indexed', type: 'bool' },

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

        // CPP/OAS
        cppage: { prop: 'cppStartAge', type: 'int' },
        oasage: { prop: 'oasStartAge', type: 'int' },
        cppov:  { prop: 'cppOverride', type: 'float' },

        // Couple CPP/OAS
        cppa1:  { prop: 'cppStartAgeP1', type: 'int' },
        cppa2:  { prop: 'cppStartAgeP2', type: 'int' },
        oasa1:  { prop: 'oasStartAgeP1', type: 'int' },
        oasa2:  { prop: 'oasStartAgeP2', type: 'int' },
        cppo1:  { prop: 'cppOverrideP1', type: 'float' },
        cppo2:  { prop: 'cppOverrideP2', type: 'float' },

        // Step 5: Debt
        debt:   { id: 'current-debt', type: 'float' },
        dpay:   { id: 'debt-payoff-age', type: 'int' },

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
        dsage:  { id: 'downsizing-age', type: 'int' },
        dsprc:  { id: 'downsizing-proceeds', type: 'float' },
        dssc:   { id: 'downsizing-spending-change', type: 'float' },

        // Other income/expense now uses oi/oe JSON arrays (see generate/loadFromURL)

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
            }

            // Skip empty/zero/default values to keep URL short
            if (value === '' || value === undefined || value === null) continue;
            if (config.type === 'float' || config.type === 'int') {
                const num = parseFloat(value);
                if (isNaN(num) || num === 0) continue;
            }

            params.set(key, String(value));
        }

        // Windfalls (complex objects — JSON encode)
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

        const base = window.location.origin + window.location.pathname;
        return base + '?' + params.toString();
    },

    /**
     * Load inputs from URL params on page load
     * Returns true if params were found and applied
     */
    loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        if (params.size === 0 || (params.size === 1 && params.has('fix'))) return false;

        let applied = false;

        for (const [key, config] of Object.entries(this.PARAM_MAP)) {
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
                AppV4[config.prop] = val;
                applied = true;
            }
        }

        // Family status toggle
        if (params.has('fam')) {
            const famVal = params.get('fam');
            AppV4.familyStatus = famVal;
            const singleBtn = document.getElementById('family-single');
            const coupleBtn = document.getElementById('family-couple');
            if (famVal === 'couple' && coupleBtn) {
                coupleBtn.click();
            } else if (singleBtn) {
                singleBtn.click();
            }
        }

        // Province/region
        if (params.has('prov')) {
            const provEl = document.getElementById('province');
            if (provEl) {
                provEl.value = params.get('prov');
                provEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        if (params.has('reg')) {
            // Slight delay for region dropdown to populate after province change
            setTimeout(() => {
                const regEl = document.getElementById('region');
                if (regEl) {
                    regEl.value = params.get('reg');
                    regEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, 100);
        }

        // Spending curve
        if (params.has('curve')) {
            AppV4.spendingCurve = params.get('curve');
            const curveSelect = document.getElementById('spending-curve');
            if (curveSelect) {
                curveSelect.value = params.get('curve');
                curveSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Windfalls
        if (params.has('wf')) {
            try {
                AppV4.windfalls = JSON.parse(params.get('wf'));
            } catch (e) { /* ignore bad JSON */ }
        }

        // Income sources
        if (params.has('isrc')) {
            try {
                const sources = JSON.parse(params.get('isrc'));
                if (typeof IncomeSources !== 'undefined' && Array.isArray(sources)) {
                    sources.forEach(s => IncomeSources.add(s));
                }
            } catch (e) { /* ignore */ }
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

        // Sync sliders after all values set
        if (applied && typeof window.syncAllSliders === 'function') {
            setTimeout(() => window.syncAllSliders(), 200);
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
                const orig = btn.textContent;
                btn.textContent = '✅ Link copied!';
                setTimeout(() => { btn.textContent = orig; }, 2000);
            }
        }).catch(() => {
            // Fallback: show URL in prompt
            window.prompt('Copy this link:', url);
        });
    }
};

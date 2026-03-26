// ═══════════════════════════════════════════
//  Ads Manager — Retirement Calculator
//  Handles ad slot rendering with AdSense or placeholder fallback
// ═══════════════════════════════════════════

const AdsManager = {
    // ── Configuration ──
    // Set your AdSense publisher ID here to activate real ads.
    // Leave null for placeholder mode (development/testing).
    publisherId: null,  // e.g., 'ca-pub-1234567890123456'
    
    // Ad slot IDs mapped to AdSense ad-slot values
    slotConfig: {
        top:    { slot: null, format: 'horizontal', label: 'Advertisement' },
        mid:    { slot: null, format: 'rectangle',  label: 'Advertisement' },
        bottom: { slot: null, format: 'horizontal', label: 'Advertisement' },
    },

    init() {
        const observer = new MutationObserver(() => {
            const results = document.getElementById('results');
            if (results && !results.classList.contains('hidden')) {
                this._renderAll();
            } else {
                this._hideAll();
            }
        });
        
        const results = document.getElementById('results');
        if (results) {
            observer.observe(results, { attributes: true, attributeFilter: ['class'] });
        }
    },

    _renderAll() {
        document.querySelectorAll('.ad-slot').forEach(el => {
            const position = el.dataset.adSlot;
            if (!position) return;
            
            if (el.dataset.rendered === 'true') {
                el.style.display = '';
                return;
            }

            const config = this.slotConfig[position];
            if (!config) return;

            if (this.publisherId && config.slot) {
                this._renderAdSense(el, config);
            } else {
                this._renderPlaceholder(el, config);
            }
            el.dataset.rendered = 'true';
        });
    },

    _hideAll() {
        document.querySelectorAll('.ad-slot').forEach(el => {
            el.style.display = 'none';
        });
    },

    _renderAdSense(el, config) {
        el.innerHTML = `
            <div class="ad-container">
                <small class="ad-label">${config.label}</small>
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="${this.publisherId}"
                     data-ad-slot="${config.slot}"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
            </div>
        `;
        try {
            (adsbygoogle = window.adsbygoogle || []).push({});
        } catch(e) {
            console.warn('[AdsManager] AdSense push failed:', e.message);
        }
    },

    _renderPlaceholder(el, config) {
        const isRect = config.format === 'rectangle';
        el.innerHTML = `
            <div class="ad-placeholder ${isRect ? 'ad-rectangle' : 'ad-horizontal'}">
                <div class="ad-placeholder-inner">
                    <span class="ad-placeholder-icon">📊</span>
                    <span class="ad-placeholder-text">Ad space — <a href="mailto:brody@example.com" style="color:var(--accent,#3b82f6);text-decoration:none;">advertise here</a></span>
                </div>
            </div>
        `;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AdsManager.init());
} else {
    AdsManager.init();
}

// ═══════════════════════════════════════════
//  Ads Manager — Retirement Calculator
// ═══════════════════════════════════════════

const AdsManager = {
    publisherId: null,  // e.g., 'ca-pub-1234567890123456'
    
    slotConfig: {
        top:    { slot: null, format: 'horizontal' },
        mid:    { slot: null, format: 'rectangle' },
        bottom: { slot: null, format: 'horizontal' },
    },

    init() {
        // Render all ad slots immediately (they're inside #results which is hidden until calc)
        document.querySelectorAll('.ad-slot').forEach(el => {
            const position = el.dataset.adSlot;
            if (!position) return;
            const config = this.slotConfig[position];
            if (!config) return;

            if (this.publisherId && config.slot) {
                this._renderAdSense(el, config);
            } else {
                this._renderPlaceholder(el, config);
            }
        });
    },

    _renderAdSense(el, config) {
        el.innerHTML = `
            <div class="ad-container">
                <small class="ad-label">Advertisement</small>
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="${this.publisherId}"
                     data-ad-slot="${config.slot}"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
            </div>
        `;
        try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
    },

    _renderPlaceholder(el, config) {
        const isRect = config.format === 'rectangle';
        el.innerHTML = `
            <div class="ad-placeholder ${isRect ? 'ad-rectangle' : 'ad-horizontal'}">
                <div class="ad-placeholder-inner">
                    <span class="ad-placeholder-icon">📊</span>
                    <span class="ad-placeholder-text">Ad space available</span>
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

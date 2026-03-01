/**
 * MOBILE CHART DEBUG - Shows on-screen diagnostic overlay
 * Automatically runs after calculation to show what's happening with the chart
 */

const MobileChartDebug = {
    overlay: null,
    
    init() {
        // Create overlay if it doesn't exist
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'mobile-chart-debug';
            this.overlay.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0, 0, 0, 0.95);
                color: #10b981;
                font-family: monospace;
                font-size: 11px;
                padding: 10px;
                max-height: 200px;
                overflow-y: auto;
                z-index: 10000;
                border-top: 2px solid #10b981;
            `;
            document.body.appendChild(this.overlay);
        }
    },
    
    log(message, isError = false) {
        this.init();
        const line = document.createElement('div');
        line.textContent = message;
        if (isError) {
            line.style.color = '#ef4444';
        }
        this.overlay.appendChild(line);
        
        // Auto-scroll to bottom
        this.overlay.scrollTop = this.overlay.scrollHeight;
        
        // Also log to console
        console.log(message);
    },
    
    clear() {
        if (this.overlay) {
            this.overlay.innerHTML = '';
        }
    },
    
    checkChart() {
        this.clear();
        this.log('🔍 CHART DIAGNOSTIC START');
        this.log('─'.repeat(40));
        
        // Check if canvas exists
        const canvas = document.getElementById('projection-chart');
        if (!canvas) {
            this.log('❌ Canvas element NOT FOUND', true);
            return;
        }
        this.log('✅ Canvas element found');
        
        // Check canvas dimensions
        this.log(`Canvas width: ${canvas.width}px`);
        this.log(`Canvas height: ${canvas.height}px`);
        this.log(`Canvas offsetWidth: ${canvas.offsetWidth}px`);
        this.log(`Canvas offsetHeight: ${canvas.offsetHeight}px`);
        
        if (canvas.width === 0 || canvas.height === 0) {
            this.log('❌ Canvas has ZERO dimensions!', true);
        }
        
        // Check parent visibility
        const parent = canvas.parentElement;
        const parentStyle = window.getComputedStyle(parent);
        this.log(`Parent display: ${parentStyle.display}`);
        this.log(`Parent width: ${parent.offsetWidth}px`);
        
        if (parent.offsetWidth === 0) {
            this.log('❌ Parent has ZERO width!', true);
        }
        
        // Check if anything was drawn
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 10), Math.min(canvas.height, 10));
        const hasPixels = imageData.data.some(pixel => pixel !== 0);
        
        if (!hasPixels) {
            this.log('❌ Canvas is BLANK (no pixels drawn)', true);
        } else {
            this.log('✅ Canvas has drawn content');
        }
        
        // Check if results exist
        if (typeof AppV4 !== 'undefined' && AppV4.scenarioResults && AppV4.scenarioResults.base) {
            const results = AppV4.scenarioResults.base.results;
            this.log(`Data points: ${results.yearByYear.length}`);
            
            const balances = results.yearByYear.map(y => y.totalBalance || y.totalPortfolio || 0);
            const maxBalance = Math.max(...balances);
            this.log(`Max balance: $${maxBalance.toLocaleString()}`);
            
            if (maxBalance === 0) {
                this.log('❌ All balances are ZERO!', true);
            }
        } else {
            this.log('❌ No calculation results found!', true);
        }
        
        this.log('─'.repeat(40));
        this.log('Tap screen to dismiss');
    },
    
    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }
};

// Auto-run after calculation if on mobile
if (window.innerWidth < 768) {
    // Give time for chart to draw
    setTimeout(() => {
        MobileChartDebug.checkChart();
        
        // Hide on tap
        document.addEventListener('click', () => {
            MobileChartDebug.hide();
        }, { once: true });
    }, 2000);
}

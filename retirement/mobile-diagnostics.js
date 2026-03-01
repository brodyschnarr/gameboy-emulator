// Mobile Diagnostics - Show current state on screen
const MobileDiagnostics = {
    show() {
        const diagnostics = {
            'Windfalls Saved': AppV4.windfalls?.length || 0,
            'Current Scenario': AppV4.currentScenario || 'none',
            'Scenarios Available': Object.keys(AppV4.scenarioResults || {}).length,
            'WindfallManager Loaded': typeof WindfallManager !== 'undefined' ? 'YES' : 'NO',
            'AppV5Enhanced Loaded': typeof AppV5Enhanced !== 'undefined' ? 'YES' : 'NO'
        };
        
        // Show windfalls details
        let windfallsDetail = '';
        if (AppV4.windfalls && AppV4.windfalls.length > 0) {
            windfallsDetail = '<div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px;">';
            windfallsDetail += '<strong>Windfalls:</strong><br>';
            AppV4.windfalls.forEach((w, i) => {
                windfallsDetail += `${i+1}. ${w.name}: $${w.amount.toLocaleString()} at age ${w.year}, ${w.probability}% likely<br>`;
            });
            windfallsDetail += '</div>';
        }
        
        // Show current results
        let resultsDetail = '';
        if (AppV4.scenarioResults && AppV4.scenarioResults.base) {
            const results = AppV4.scenarioResults.base.results;
            resultsDetail = '<div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px;">';
            resultsDetail += '<strong>Current Results:</strong><br>';
            resultsDetail += `Portfolio at retirement: $${(results.summary?.portfolioAtRetirement || 0).toLocaleString()}<br>`;
            resultsDetail += `Money lasts: Age ${results.summary?.moneyLastsAge || '?'}<br>`;
            resultsDetail += `Success rate: ${results.probability || 0}%<br>`;
            resultsDetail += '</div>';
        }
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 100000;
            max-width: 90%;
            max-height: 80%;
            overflow-y: auto;
            font-family: monospace;
            font-size: 13px;
        `;
        
        let html = '<h3 style="margin: 0 0 15px 0; color: #0ff;">📊 Diagnostics</h3>';
        
        Object.entries(diagnostics).forEach(([key, value]) => {
            const color = (typeof value === 'string' && value === 'NO') ? '#f00' : '#0f0';
            html += `<div style="margin: 5px 0;"><strong>${key}:</strong> <span style="color: ${color};">${value}</span></div>`;
        });
        
        html += windfallsDetail;
        html += resultsDetail;
        
        html += '<button onclick="this.parentElement.remove()" style="margin-top: 15px; padding: 10px 20px; background: #f00; color: white; border: none; border-radius: 5px; font-size: 14px; width: 100%;">Close</button>';
        
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
    }
};

window.MobileDiagnostics = MobileDiagnostics;

// Add diagnostic button to page
window.addEventListener('DOMContentLoaded', () => {
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const btn = document.createElement('button');
        btn.textContent = '🔍 Diagnostics';
        btn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #2563eb;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 9999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        btn.onclick = () => MobileDiagnostics.show();
        document.body.appendChild(btn);
    }
});

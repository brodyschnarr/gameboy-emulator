// Mobile Debug Overlay - Shows console logs on screen
const MobileDebug = {
    logs: [],
    maxLogs: 20,
    overlay: null,
    
    init() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'mobile-debug-overlay';
        this.overlay.innerHTML = `
            <div style="position: fixed; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.95); color: #0f0; font-family: monospace; font-size: 10px; max-height: 120px; overflow-y: auto; z-index: 99999; padding: 8px; border-top: 2px solid #0f0; pointer-events: none;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px; padding-bottom: 3px; border-bottom: 1px solid #0f0;">
                    <strong style="color: #0ff; font-size: 10px;">🐛 Debug</strong>
                    <button onclick="MobileDebug.toggle()" style="background: #f00; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 9px; pointer-events: auto;">Hide</button>
                </div>
                <div id="debug-logs"></div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        
        // Intercept console.log
        const originalLog = console.log;
        console.log = (...args) => {
            originalLog.apply(console, args);
            this.addLog(args.join(' '));
        };
        
        // Intercept console.error
        const originalError = console.error;
        console.error = (...args) => {
            originalError.apply(console, args);
            this.addLog('ERROR: ' + args.join(' '), true);
        };
        
        this.addLog('Debug overlay initialized');
    },
    
    addLog(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        this.logs.push({ time: timestamp, message, isError });
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.render();
    },
    
    render() {
        const logsDiv = document.getElementById('debug-logs');
        if (!logsDiv) return;
        
        logsDiv.innerHTML = this.logs.map(log => `
            <div style="margin: 2px 0; color: ${log.isError ? '#f00' : '#0f0'}; font-size: 10px;">
                <span style="color: #888;">[${log.time}]</span> ${log.message}
            </div>
        `).join('');
        
        // Auto-scroll to bottom
        logsDiv.parentElement.scrollTop = logsDiv.parentElement.scrollHeight;
    },
    
    toggle() {
        if (this.overlay.style.display === 'none') {
            this.overlay.style.display = 'block';
        } else {
            this.overlay.style.display = 'none';
        }
    },
    
    show() {
        if (this.overlay) {
            this.overlay.style.display = 'block';
        }
    }
};

// Auto-init on mobile
if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    window.addEventListener('DOMContentLoaded', () => {
        MobileDebug.init();
        console.log('[MobileDebug] Running on mobile device');
    });
}

// Make available globally
window.MobileDebug = MobileDebug;

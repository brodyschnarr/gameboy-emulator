/**
 * MOBILE ERROR DISPLAY - Shows JavaScript errors on screen
 * No need for F12 console - shows right on the page
 */

(function() {
    // Create error display overlay
    const errorOverlay = document.createElement('div');
    errorOverlay.id = 'mobile-error-display';
    errorOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(239, 68, 68, 0.95);
        color: white;
        font-family: monospace;
        font-size: 11px;
        padding: 10px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 99999;
        display: none;
        border-bottom: 3px solid #991b1b;
    `;
    
    const errorTitle = document.createElement('div');
    errorTitle.style.cssText = 'font-weight: bold; margin-bottom: 5px; font-size: 13px;';
    errorTitle.textContent = '⚠️ JAVASCRIPT ERRORS (tap to dismiss)';
    errorOverlay.appendChild(errorTitle);
    
    const errorContent = document.createElement('div');
    errorContent.id = 'error-content';
    errorOverlay.appendChild(errorContent);
    
    document.body.appendChild(errorOverlay);
    
    // Dismiss on tap
    errorOverlay.addEventListener('click', () => {
        errorOverlay.style.display = 'none';
    });
    
    // Catch all JavaScript errors
    window.addEventListener('error', (event) => {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'margin: 5px 0; padding: 5px; background: rgba(0,0,0,0.3); border-radius: 3px;';
        errorDiv.innerHTML = `
            <div style="color: #fca5a5; font-weight: bold;">ERROR:</div>
            <div>${event.message}</div>
            <div style="color: #d1d5db; font-size: 10px;">at ${event.filename}:${event.lineno}:${event.colno}</div>
        `;
        errorContent.appendChild(errorDiv);
        errorOverlay.style.display = 'block';
    });
    
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'margin: 5px 0; padding: 5px; background: rgba(0,0,0,0.3); border-radius: 3px;';
        errorDiv.innerHTML = `
            <div style="color: #fca5a5; font-weight: bold;">PROMISE ERROR:</div>
            <div>${event.reason}</div>
        `;
        errorContent.appendChild(errorDiv);
        errorOverlay.style.display = 'block';
    });
    
    // Show success message if no errors after 3 seconds
    setTimeout(() => {
        if (errorContent.children.length === 0) {
            const successDiv = document.createElement('div');
            successDiv.style.cssText = 'margin: 5px 0; padding: 10px; background: rgba(16, 185, 129, 0.2); border-radius: 3px; color: #10b981;';
            successDiv.textContent = '✅ No JavaScript errors detected';
            errorContent.appendChild(successDiv);
            errorOverlay.style.background = 'rgba(16, 185, 129, 0.95)';
            errorOverlay.style.display = 'block';
            
            // Auto-hide success message
            setTimeout(() => {
                errorOverlay.style.display = 'none';
            }, 2000);
        }
    }, 3000);
})();

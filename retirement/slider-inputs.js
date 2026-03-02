/**
 * slider-inputs.js — Progressive enhancement for number inputs
 * 
 * HOW TO REVERT: Remove the <script src="slider-inputs.js"> tag from index.html.
 * Original number inputs remain untouched in the DOM and work as before.
 * 
 * Each enhanced input gets a slider + formatted display value.
 * Tap the display value to type a precise number.
 */
(function() {
    'use strict';

    // ═══════════════════════════════════════
    // CONFIG: Which inputs to enhance
    // ═══════════════════════════════════════
    const SLIDER_CONFIG = [
        // Step 1: Income
        { id: 'current-income',   min: 0, max: 300000, step: 5000,  format: 'currency', label: null },
        { id: 'income-person1',   min: 0, max: 300000, step: 5000,  format: 'currency', label: null },
        { id: 'income-person2',   min: 0, max: 300000, step: 5000,  format: 'currency', label: null },

        // Step 2: Savings
        { id: 'rrsp',             min: 0, max: 1000000, step: 5000,  format: 'currency', label: null },
        { id: 'tfsa',             min: 0, max: 1000000, step: 5000,  format: 'currency', label: null },
        { id: 'nonreg',           min: 0, max: 1000000, step: 5000,  format: 'currency', label: null },
        { id: 'other',            min: 0, max: 1000000, step: 5000,  format: 'currency', label: null },

        // Step 3: Contributions
        { id: 'monthly-contribution', min: 0, max: 10000, step: 100, format: 'currency', label: null },

        // Step 4: Retirement
        { id: 'retirement-age',   min: 50, max: 80,  step: 1, format: 'number', label: null },
        { id: 'life-expectancy',  min: 65, max: 110, step: 1, format: 'number', label: null },
        { id: 'annual-spending',  min: 20000, max: 200000, step: 5000, format: 'currency', label: null },

        // Step 5: Debt
        { id: 'current-debt',     min: 0, max: 1000000, step: 5000, format: 'currency', label: null },

        // Contribution growth
        { id: 'contribution-growth', min: 0, max: 10, step: 0.5, format: 'percent', label: null },

        // Advanced
        { id: 'return-rate',      min: 0, max: 15, step: 0.5, format: 'percent', label: null },
        { id: 'inflation-rate',   min: 0, max: 8,  step: 0.5, format: 'percent', label: null },
    ];

    // ═══════════════════════════════════════
    // FORMAT HELPERS
    // ═══════════════════════════════════════
    function formatValue(val, format) {
        const n = parseFloat(val) || 0;
        if (format === 'currency') {
            if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
            return '$' + n;
        }
        if (format === 'percent') return n.toFixed(1) + '%';
        return String(n);
    }

    // ═══════════════════════════════════════
    // ENHANCE A SINGLE INPUT
    // ═══════════════════════════════════════
    function enhanceInput(config) {
        const input = document.getElementById(config.id);
        if (!input) return;

        // Don't double-enhance
        if (input.dataset.sliderEnhanced) return;
        input.dataset.sliderEnhanced = 'true';

        // Find the parent .input-with-prefix or .input-group
        const prefixWrapper = input.closest('.input-with-prefix');
        const inputGroup = input.closest('.input-group');
        if (!inputGroup) return;

        // Get initial value
        const initialVal = parseFloat(input.value) || parseFloat(input.placeholder) || config.min;

        // Create slider wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'enhanced-slider-wrap';

        // Create the display value (tappable to edit)
        const display = document.createElement('div');
        display.className = 'enhanced-slider-value';
        display.textContent = formatValue(initialVal, config.format);
        display.setAttribute('role', 'button');
        display.setAttribute('aria-label', 'Tap to type a value');

        // Create the range slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'enhanced-slider';
        slider.min = config.min;
        slider.max = config.max;
        slider.step = config.step;
        slider.value = input.value || input.placeholder || config.min;

        // Min/max labels
        const labels = document.createElement('div');
        labels.className = 'enhanced-slider-labels';
        labels.innerHTML = `<span>${formatValue(config.min, config.format)}</span><span>${formatValue(config.max, config.format)}</span>`;

        wrapper.appendChild(display);
        wrapper.appendChild(slider);
        wrapper.appendChild(labels);

        // Insert slider after the prefix wrapper (or after input if no prefix wrapper)
        const insertAfter = prefixWrapper || input;
        insertAfter.parentNode.insertBefore(wrapper, insertAfter.nextSibling);

        // Hide the original input (keep in DOM for form data)
        if (prefixWrapper) {
            prefixWrapper.style.display = 'none';
        } else {
            input.style.display = 'none';
        }

        // ── Slider → Input sync ──
        function updateTrackFill() {
            const pct = ((slider.value - config.min) / (config.max - config.min)) * 100;
            slider.style.setProperty('--slider-pct', pct + '%');
        }
        updateTrackFill();

        slider.addEventListener('input', function() {
            const val = parseFloat(this.value);
            input.value = val;
            display.textContent = formatValue(val, config.format);
            updateTrackFill();
            // Trigger change event so the app picks it up
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // ── Tap display to type ──
        display.addEventListener('click', function() {
            // Show original input temporarily
            if (prefixWrapper) {
                prefixWrapper.style.display = '';
            } else {
                input.style.display = '';
            }
            wrapper.style.display = 'none';
            input.focus();
            input.select();
        });

        // ── When original input loses focus, sync back to slider ──
        input.addEventListener('blur', function() {
            const val = parseFloat(input.value) || 0;
            // Clamp to slider range for display, but keep actual value
            slider.value = Math.min(Math.max(val, config.min), config.max);
            display.textContent = formatValue(val, config.format);
            updateTrackFill();
            // Hide input, show slider again
            if (prefixWrapper) {
                prefixWrapper.style.display = 'none';
            } else {
                input.style.display = 'none';
            }
            wrapper.style.display = '';
        });

        // ── If input changes externally (e.g., lifestyle presets), sync slider ──
        const observer = new MutationObserver(function() {
            const val = parseFloat(input.value) || 0;
            slider.value = Math.min(Math.max(val, config.min), config.max);
            display.textContent = formatValue(val, config.format);
        });
        observer.observe(input, { attributes: true, attributeFilter: ['value'] });

        // Also listen for programmatic input events
        input.addEventListener('slider-sync', function() {
            const val = parseFloat(input.value) || 0;
            slider.value = Math.min(Math.max(val, config.min), config.max);
            display.textContent = formatValue(val, config.format);
            updateTrackFill();
        });
    }

    // ═══════════════════════════════════════
    // EXTERNAL SYNC HELPER
    // ═══════════════════════════════════════
    // Call window.syncSlider('annual-spending') after programmatically changing a value
    window.syncSlider = function(inputId) {
        const input = document.getElementById(inputId);
        if (input) input.dispatchEvent(new Event('slider-sync'));
    };

    // Sync all sliders (useful after preset changes)
    window.syncAllSliders = function() {
        SLIDER_CONFIG.forEach(function(c) {
            const input = document.getElementById(c.id);
            if (input) input.dispatchEvent(new Event('slider-sync'));
        });
    };

    // ═══════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════
    function init() {
        SLIDER_CONFIG.forEach(enhanceInput);
    }

    // Run after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

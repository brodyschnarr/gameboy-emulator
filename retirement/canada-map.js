// ═══════════════════════════════════════════
//  Interactive Canada Map - Realistic Paths
//  Source: MapSVG.com (CC BY 4.0), simplified
// ═══════════════════════════════════════════

const CanadaMap = {
    
    selectedProvince: null,
    selectedRegion: null,
    onSelect: null,

    // Simplified province shapes — shared borders, no gaps
    // Based on a schematic tilemap that reads as "Canada" without cartographic detail
    _paths: {
        'BC': `M20,50 L70,20 L100,20 L100,50 L100,180 L80,200 L60,210 L40,205 L25,190 L15,170 L10,140 L12,110 L15,80 L20,50Z`,
        'AB': `M100,20 L150,20 L150,180 L100,180 L100,20Z`,
        'SK': `M150,20 L200,20 L200,180 L150,180 L150,20Z`,
        'MB': `M200,20 L250,20 L255,40 L258,60 L255,90 L250,120 L245,150 L240,180 L200,180 L200,20Z`,
        'ON': `M240,180 L245,150 L250,120 L255,90 L258,60 L265,50 L275,42 L290,38 L300,42 L310,50 L318,65 L322,82 L325,100 L328,120 L330,140 L328,160 L322,175 L315,188 L305,198 L295,208 L285,215 L275,220 L265,218 L255,210 L248,200 L240,180Z`,
        'QC': `M318,65 L325,55 L335,45 L348,38 L362,35 L378,38 L390,45 L398,55 L402,68 L402,85 L398,100 L392,115 L385,128 L375,140 L365,150 L355,158 L345,165 L335,172 L325,178 L318,185 L310,192 L305,198 L295,208 L285,215 L280,210 L285,200 L295,185 L305,170 L315,155 L322,140 L325,120 L325,100 L322,82 L318,65Z`,
        'NB': `M365,150 L375,142 L385,140 L392,145 L395,155 L392,165 L385,172 L378,175 L370,172 L365,165 L362,158 L365,150Z`,
        'NS': `M392,165 L400,158 L410,155 L418,160 L420,170 L416,180 L408,185 L400,182 L395,178 L392,172 L392,165Z`,
        'PE': `M382,132 L392,128 L398,132 L395,140 L385,142 L382,138 L382,132Z`,
        'NL': `M410,35 L420,30 L432,35 L438,48 L438,65 L435,80 L428,92 L420,100 L412,105 L405,108 L398,105 L395,98 L398,85 L402,72 L405,58 L408,45 L410,35Z`
    },

    // Label positions (centered in each province)
    _labels: {
        'BC': [55, 120],
        'AB': [125, 100],
        'SK': [175, 100],
        'MB': [225, 100],
        'ON': [282, 140],
        'QC': [358, 100],
        'NB': [378, 158],
        'NS': [408, 172],
        'PE': [390, 135],
        'NL': [418, 70]
    },

    render(containerId) {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`[CanadaMap] Container #${containerId} not found`);
                return;
            }
            container.innerHTML = this._getMapSVG();
            this._attachListeners();
        } catch (error) {
            console.error('[CanadaMap] Render failed:', error);
        }
    },

    _getMapSVG() {
        const pathEls = Object.entries(this._paths).map(([prov, d]) =>
            `<path data-province="${prov}" class="province-path" d="${d}"/>`
        ).join('\n');

        const smallProvs = new Set(['NB', 'NS', 'PE']);
        const labelEls = Object.entries(this._labels).map(([prov, [x, y]]) => {
            const cls = smallProvs.has(prov) ? 'province-label small' : 'province-label';
            return `<text x="${x}" y="${y}" class="${cls}">${prov}</text>`;
        }).join('\n');

        return `
            <svg viewBox="0 10 450 230" class="canada-map" xmlns="http://www.w3.org/2000/svg"
                 style="width:100%;max-width:500px;height:auto;margin:0 auto;display:block"
                <defs>
                    <style>
                        .province-path {
                            fill: #e8edf3;
                            stroke: #fff;
                            stroke-width: 1;
                            stroke-linejoin: round;
                            cursor: pointer;
                            transition: fill 0.2s;
                            paint-order: stroke;
                        }
                        .province-path:hover {
                            fill: #cbd5e1;
                        }
                        .province-path.selected {
                            fill: #3b82f6;
                            stroke: #1e40af;
                            stroke-width: 1.5;
                        }
                        .province-path.selected { fill: #3b82f6 !important; }
                        .province-label {
                            fill: #334155;
                            font-size: 14px;
                            font-weight: 700;
                            pointer-events: none;
                            text-anchor: middle;
                            dominant-baseline: middle;
                            font-family: system-ui, -apple-system, sans-serif;
                        }
                        .province-label.small {
                            font-size: 10px;
                        }
                        .province-path.selected + text,
                        .province-label.selected-label {
                            fill: #fff;
                        }
                        /* indicators moved to region buttons */
                    </style>
                </defs>
                ${pathEls}
                ${labelEls}
            </svg>
        `;
    },

    _attachListeners() {
        const paths = document.querySelectorAll('.province-path');
        paths.forEach(path => {
            path.addEventListener('click', (e) => {
                const province = e.target.getAttribute('data-province');
                this._handleProvinceClick(province);
            });
        });
    },

    _handleProvinceClick(province) {
        // Update visual selection
        document.querySelectorAll('.province-path').forEach(p => {
            p.classList.remove('selected');
        });
        document.querySelectorAll('.province-label').forEach(l => {
            l.classList.remove('selected-label');
        });
        document.querySelector(`[data-province="${province}"]`)?.classList.add('selected');
        
        this.selectedProvince = province;
        
        // Show region picker if province has regions
        const regions = RegionalDataV2.getRegionsByProvince(province);
        
        if (regions && regions.length > 0) {
            this._showRegionPicker(province, regions);
            const displayEl = document.getElementById('region-display');
            const nameEl = document.getElementById('region-name');
            if (displayEl && nameEl) {
                nameEl.textContent = `${province} - Select a region below`;
                displayEl.classList.remove('hidden');
            }
        } else {
            this.selectedRegion = province;
            this._showLocationDisplay(province, province);
            if (this.onSelect) {
                this.onSelect(province, province);
            }
        }
    },

    _showRegionPicker(province, regions) {
        const container = document.getElementById('region-picker-container');
        if (!container) return;
        
        container.classList.remove('hidden');
        
        let html = `
            <div class="region-picker">
                <h3>Select a region in ${province}:</h3>
                <div class="region-buttons">
        `;
        
        regions.forEach(region => {
            const selected = this.selectedRegion === region.id ? 'active' : '';
            // Get cost of living for this region
            const regionData = RegionalDataV2[region.code] || RegionalDataV2.getRegion(region.code);
            const col = regionData?.costOfLivingIndex || 100;
            let affordClass = 'afford-avg';
            let affordLabel = '';
            if (col >= 115) { affordClass = 'afford-expensive'; affordLabel = '💰 Expensive'; }
            else if (col >= 105) { affordClass = 'afford-above'; affordLabel = '↑ Above avg'; }
            else if (col <= 90) { affordClass = 'afford-cheap'; affordLabel = '✓ Affordable'; }
            else if (col <= 95) { affordClass = 'afford-below'; affordLabel = '↓ Below avg'; }
            
            html += `
                <button class="region-btn ${selected} ${affordClass}" data-region="${region.id}">
                    ${region.name}
                    ${affordLabel ? `<span class="region-cost-tag">${affordLabel}</span>` : ''}
                </button>
            `;
        });
        
        html += `</div></div>`;
        container.innerHTML = html;
        
        container.querySelectorAll('.region-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const regionId = e.target.getAttribute('data-region');
                this._handleRegionClick(province, regionId);
            });
        });
    },

    _handleRegionClick(province, regionId) {
        document.querySelectorAll('.region-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-region="${regionId}"]`)?.classList.add('active');
        
        this.selectedRegion = regionId;
        this._showLocationDisplay(province, regionId);
        this._trackLocationSelection(province, regionId);
        
        if (this.onSelect) {
            this.onSelect(province, regionId);
        }
    },

    _showLocationDisplay(province, regionId) {
        const displayEl = document.getElementById('region-display');
        const nameEl = document.getElementById('region-name');
        
        if (!displayEl || !nameEl) return;
        
        const region = RegionalDataV2.getRegion(province, regionId);
        const displayName = region ? region.name : regionId;
        
        nameEl.textContent = displayName;
        displayEl.classList.remove('hidden');
    },

    // Retirement affordability by province (cost of living index, lower = more affordable)
    _provinceAffordability: {
        'BC': { col: 120, label: '$$', tier: 'low' },    // Expensive
        'AB': { col: 100, label: '$', tier: 'mid' },
        'SK': { col: 88, label: '✓', tier: 'high' },     // Affordable
        'MB': { col: 90, label: '✓', tier: 'high' },
        'ON': { col: 115, label: '$$', tier: 'low' },
        'QC': { col: 95, label: '$', tier: 'mid' },
        'NB': { col: 85, label: '✓', tier: 'high' },
        'NS': { col: 90, label: '$', tier: 'mid' },
        'PE': { col: 82, label: '✓', tier: 'high' },
        'NL': { col: 88, label: '✓', tier: 'high' }
    },

    _getAffordabilityIndicators() {
        const indicators = [];
        for (const [prov, data] of Object.entries(this._provinceAffordability)) {
            const [lx, ly] = this._labels[prov] || [0, 0];
            if (lx === 0) continue;
            indicators.push(`<text x="${lx}" y="${ly + 16}" class="province-indicator">${data.label}</text>`);
        }
        return indicators.join('\n');
    },

    _applyAffordabilityColors() {
        for (const [prov, data] of Object.entries(this._provinceAffordability)) {
            const path = document.querySelector(`[data-province="${prov}"]`);
            if (path && !path.classList.contains('selected')) {
                path.classList.add('afford-' + data.tier);
            }
        }
    },

    // Track user location selection for analytics
    _trackLocationSelection(province, region) {
        try {
            const data = {
                province,
                region,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent?.substring(0, 100)
            };
            // Store locally
            const existing = JSON.parse(localStorage.getItem('rc_location_events') || '[]');
            existing.push(data);
            // Keep last 50
            if (existing.length > 50) existing.splice(0, existing.length - 50);
            localStorage.setItem('rc_location_events', JSON.stringify(existing));
            
            // Beacon to analytics endpoint if configured
            if (window._rcAnalyticsEndpoint) {
                navigator.sendBeacon?.(window._rcAnalyticsEndpoint, JSON.stringify(data));
            }
        } catch (e) { /* silent */ }
    },

    setSelection(province, region) {
        this.selectedProvince = province;
        this.selectedRegion = region;
        
        document.querySelectorAll('.province-path').forEach(p => {
            p.classList.remove('selected');
        });
        document.querySelector(`[data-province="${province}"]`)?.classList.add('selected');
        
        const regions = RegionalDataV2.getRegionsByProvince(province);
        if (regions && regions.length > 0) {
            this._showRegionPicker(province, regions);
            setTimeout(() => {
                document.querySelectorAll('.region-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelector(`[data-region="${region}"]`)?.classList.add('active');
                this._showLocationDisplay(province, region);
            }, 50);
        } else {
            this._showLocationDisplay(province, region);
        }
    }
};

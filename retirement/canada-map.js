// ═══════════════════════════════════════════
//  Interactive Canada Map Component
// ═══════════════════════════════════════════

const CanadaMap = {
    
    selectedProvince: null,
    selectedRegion: null,
    onSelect: null,

    /**
     * Render the map into a container
     */
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = this._getMapSVG();
        this._attachListeners();
    },

    /**
     * Get the SVG map markup
     */
    _getMapSVG() {
        return `
            <svg viewBox="0 0 800 600" class="canada-map">
                <defs>
                    <style>
                        .province-path {
                            fill: #e5e7eb;
                            stroke: #94a3b8;
                            stroke-width: 1.5;
                            cursor: pointer;
                            transition: all 0.2s;
                        }
                        .province-path:hover {
                            fill: #cbd5e1;
                        }
                        .province-path.selected {
                            fill: #2563eb;
                            stroke: #1e40af;
                            stroke-width: 2.5;
                        }
                        .province-label {
                            fill: #475569;
                            font-size: 14px;
                            font-weight: 600;
                            pointer-events: none;
                            text-anchor: middle;
                        }
                    </style>
                </defs>
                
                <!-- BC -->
                <path data-province="BC" class="province-path" d="M 80,200 L 90,150 L 120,130 L 140,140 L 150,180 L 130,220 L 100,230 Z"/>
                <text x="115" y="190" class="province-label">BC</text>
                
                <!-- AB -->
                <path data-province="AB" class="province-path" d="M 150,180 L 170,140 L 210,140 L 220,200 L 200,230 L 180,220 Z"/>
                <text x="190" y="190" class="province-label">AB</text>
                
                <!-- SK -->
                <path data-province="SK" class="province-path" d="M 220,200 L 230,150 L 270,150 L 280,220 L 260,240 L 240,230 Z"/>
                <text x="250" y="200" class="province-label">SK</text>
                
                <!-- MB -->
                <path data-province="MB" class="province-path" d="M 280,220 L 290,160 L 320,140 L 350,160 L 360,200 L 340,240 L 310,250 Z"/>
                <text x="320" y="200" class="province-label">MB</text>
                
                <!-- ON -->
                <path data-province="ON" class="province-path" d="M 360,200 L 380,140 L 420,130 L 480,150 L 520,180 L 530,220 L 500,260 L 460,270 L 420,250 L 380,240 Z"/>
                <text x="450" y="210" class="province-label">ON</text>
                
                <!-- QC -->
                <path data-province="QC" class="province-path" d="M 520,180 L 540,140 L 580,130 L 620,150 L 650,180 L 660,220 L 640,260 L 600,270 L 560,250 L 530,220 Z"/>
                <text x="590" y="210" class="province-label">QC</text>
                
                <!-- NB -->
                <path data-province="NB" class="province-path" d="M 660,220 L 670,200 L 690,200 L 700,220 L 690,240 L 670,240 Z"/>
                <text x="680" y="225" class="province-label" style="font-size: 11px;">NB</text>
                
                <!-- NS -->
                <path data-province="NS" class="province-path" d="M 690,240 L 700,240 L 720,250 L 720,270 L 700,270 L 690,260 Z"/>
                <text x="705" y="260" class="province-label" style="font-size: 11px;">NS</text>
                
                <!-- PE -->
                <path data-province="PE" class="province-path" d="M 700,220 L 710,215 L 720,220 L 720,230 L 710,235 L 700,230 Z"/>
                <text x="710" y="227" class="province-label" style="font-size: 10px;">PE</text>
                
                <!-- NL -->
                <path data-province="NL" class="province-path" d="M 720,160 L 740,150 L 760,160 L 770,190 L 760,220 L 740,230 L 720,220 L 710,190 Z"/>
                <text x="740" y="195" class="province-label" style="font-size: 11px;">NL</text>
            </svg>
        `;
    },

    /**
     * Attach click listeners to provinces
     */
    _attachListeners() {
        document.querySelectorAll('.province-path').forEach(path => {
            path.addEventListener('click', (e) => {
                const province = e.target.dataset.province;
                this._selectProvince(province);
            });
        });
    },

    /**
     * Select a province and show region picker if applicable
     */
    _selectProvince(province) {
        // Update UI
        document.querySelectorAll('.province-path').forEach(p => p.classList.remove('selected'));
        document.querySelector(`[data-province="${province}"]`)?.classList.add('selected');
        
        this.selectedProvince = province;
        
        // Check if province has regions
        const regions = RegionalDataV2.getProvincialRegions(province);
        
        if (regions.length > 1) {
            // Show region picker
            this._showRegionPicker(province, regions);
        } else {
            // No regions, just select province
            this.selectedRegion = regions[0].code;
            if (this.onSelect) {
                this.onSelect(province, this.selectedRegion);
            }
        }
    },

    /**
     * Show region picker for provinces with multiple regions
     */
    _showRegionPicker(province, regions) {
        const container = document.getElementById('region-picker-container');
        if (!container) return;

        const html = `
            <div class="region-picker">
                <h4>Select a region in ${RegionalDataV2.getRegion(province)?.name || province}:</h4>
                <div class="region-buttons">
                    ${regions.map(r => `
                        <button type="button" class="region-btn" data-region="${r.code}">
                            ${r.name}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
        container.classList.remove('hidden');

        // Attach region click listeners
        document.querySelectorAll('.region-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const regionCode = e.target.dataset.region;
                this.selectedRegion = regionCode;
                
                // Highlight selected
                document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                if (this.onSelect) {
                    this.onSelect(this.selectedProvince, regionCode);
                }
            });
        });
    },

    /**
     * Set selection programmatically
     */
    setSelection(province, regionCode = null) {
        this._selectProvince(province);
        if (regionCode) {
            this.selectedRegion = regionCode;
            const regionBtn = document.querySelector(`[data-region="${regionCode}"]`);
            if (regionBtn) regionBtn.click();
        }
    }
};

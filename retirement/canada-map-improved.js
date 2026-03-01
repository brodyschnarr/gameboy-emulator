// ═══════════════════════════════════════════
//  Interactive Canada Map Component - IMPROVED
// ═══════════════════════════════════════════

const CanadaMap = {
    
    selectedProvince: null,
    selectedRegion: null,
    onSelect: null,

    render(containerId) {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`CanadaMap: Container #${containerId} not found`);
                return;
            }

            console.log('CanadaMap: Rendering improved map...');
            container.innerHTML = this._getMapSVG();
            this._attachListeners();
            console.log('CanadaMap: Render complete');
        } catch (error) {
            console.error('CanadaMap: Render failed:', error);
        }
    },

    _getMapSVG() {
        return `
            <svg viewBox="0 0 1000 600" class="canada-map" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <style>
                        .province-path {
                            fill: #e5e7eb;
                            stroke: #94a3b8;
                            stroke-width: 2;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        }
                        .province-path:hover {
                            fill: #cbd5e1;
                            stroke: #64748b;
                            stroke-width: 3;
                        }
                        .province-path.selected {
                            fill: #3b82f6;
                            stroke: #1e40af;
                            stroke-width: 3;
                        }
                        .province-label {
                            fill: #1e293b;
                            font-size: 18px;
                            font-weight: 700;
                            pointer-events: none;
                            text-anchor: middle;
                            font-family: system-ui, -apple-system, sans-serif;
                        }
                        .province-label.small {
                            font-size: 14px;
                        }
                    </style>
                </defs>
                
                <!-- BC - Left coast, tall and narrow -->
                <path data-province="BC" class="province-path" 
                      d="M 50,180 L 60,120 L 80,90 L 100,80 L 120,75 L 140,90 L 155,120 L 165,160 L 170,200 L 165,240 L 155,280 L 145,320 L 135,350 L 125,370 L 110,360 L 95,340 L 85,310 L 75,270 L 65,230 Z"/>
                <text x="120" y="220" class="province-label">BC</text>
                
                <!-- AB - Rectangle next to BC -->
                <path data-province="AB" class="province-path"
                      d="M 170,120 L 260,120 L 260,350 L 170,350 L 165,280 L 155,200 L 165,160 Z"/>
                <text x="215" y="235" class="province-label">AB</text>
                
                <!-- SK - Rectangle next to AB -->
                <path data-province="SK" class="province-path"
                      d="M 260,120 L 360,120 L 360,350 L 260,350 Z"/>
                <text x="310" y="235" class="province-label">SK</text>
                
                <!-- MB - Irregular shape, narrower at top -->
                <path data-province="MB" class="province-path"
                      d="M 360,140 L 380,130 L 400,125 L 420,130 L 450,145 L 470,160 L 480,180 L 485,210 L 485,250 L 480,290 L 470,330 L 450,350 L 360,350 L 360,250 Z"/>
                <text x="420" y="240" class="province-label">MB</text>
                
                <!-- ON - Large irregular shape -->
                <path data-province="ON" class="province-path"
                      d="M 485,180 L 510,160 L 540,150 L 570,145 L 600,150 L 630,160 L 660,175 L 685,195 L 705,220 L 720,250 L 725,280 L 720,310 L 705,335 L 685,355 L 660,370 L 630,380 L 600,385 L 570,380 L 540,370 L 515,355 L 495,335 L 485,310 L 480,280 L 485,250 L 485,210 Z"/>
                <text x="605" y="265" class="province-label">ON</text>
                
                <!-- QC - Large, extends north and east -->
                <path data-province="QC" class="province-path"
                      d="M 720,100 L 750,90 L 780,85 L 810,90 L 835,100 L 855,115 L 870,135 L 880,160 L 885,190 L 885,220 L 880,250 L 870,280 L 855,310 L 835,335 L 810,355 L 780,370 L 750,380 L 720,385 L 705,370 L 695,350 L 690,325 L 690,295 L 695,265 L 705,235 L 715,205 L 720,175 L 720,140 Z"/>
                <text x="785" y="240" class="province-label">QC</text>
                
                <!-- NB - Small, below QC -->
                <path data-province="NB" class="province-path"
                      d="M 870,330 L 895,325 L 915,330 L 925,345 L 920,365 L 905,380 L 885,385 L 870,375 L 865,355 Z"/>
                <text x="895" y="360" class="province-label small">NB</text>
                
                <!-- NS - Small peninsula -->
                <path data-province="NS" class="province-path"
                      d="M 900,380 L 925,378 L 945,382 L 960,390 L 965,405 L 955,420 L 935,425 L 915,423 L 900,415 L 890,400 Z"/>
                <text x="930" y="408" class="province-label small">NS</text>
                
                <!-- PE - Tiny island -->
                <path data-province="PE" class="province-path"
                      d="M 915,315 L 930,312 L 943,315 L 948,325 L 943,335 L 930,338 L 918,335 L 913,325 Z"/>
                <text x="930" y="328" class="province-label small">PE</text>
                
                <!-- NL - Island east of QC -->
                <path data-province="NL" class="province-path"
                      d="M 920,150 L 950,140 L 975,145 L 990,160 L 995,185 L 990,215 L 980,245 L 960,265 L 935,275 L 910,270 L 895,255 L 890,230 L 895,200 L 905,175 Z"/>
                <text x="940" y="215" class="province-label small">NL</text>
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
        console.log('[CanadaMap] Province clicked:', province);
        
        // Update visual selection
        document.querySelectorAll('.province-path').forEach(p => {
            p.classList.remove('selected');
        });
        document.querySelector(`[data-province="${province}"]`)?.classList.add('selected');
        
        this.selectedProvince = province;
        
        // Show region picker if province has regions
        const regions = RegionalDataV2.getRegionsByProvince(province);
        if (regions && regions.length > 0) {
            this._showRegionPicker(province, regions);
        } else {
            // Province has no sub-regions, select it directly
            this.selectedRegion = province;
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
            html += `
                <button class="region-btn ${selected}" data-region="${region.id}">
                    ${region.name}
                </button>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Attach listeners to region buttons
        container.querySelectorAll('.region-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const regionId = e.target.getAttribute('data-region');
                this._handleRegionClick(province, regionId);
            });
        });
    },

    _handleRegionClick(province, regionId) {
        console.log('[CanadaMap] Region clicked:', regionId);
        
        // Update button states
        document.querySelectorAll('.region-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-region="${regionId}"]`)?.classList.add('active');
        
        this.selectedRegion = regionId;
        
        // Show selected region name
        const displayEl = document.getElementById('region-display');
        const nameEl = document.getElementById('region-name');
        if (displayEl && nameEl) {
            const region = RegionalDataV2.getRegion(province, regionId);
            nameEl.textContent = region ? region.name : regionId;
            displayEl.classList.remove('hidden');
        }
        
        // Call callback
        if (this.onSelect) {
            this.onSelect(province, regionId);
        }
    },

    setSelection(province, region) {
        this.selectedProvince = province;
        this.selectedRegion = region;
        
        // Update visual state
        document.querySelectorAll('.province-path').forEach(p => {
            p.classList.remove('selected');
        });
        document.querySelector(`[data-province="${province}"]`)?.classList.add('selected');
        
        // Show region picker if applicable
        const regions = RegionalDataV2.getRegionsByProvince(province);
        if (regions && regions.length > 0) {
            this._showRegionPicker(province, regions);
            
            // Select the region button
            setTimeout(() => {
                document.querySelectorAll('.region-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelector(`[data-region="${region}"]`)?.classList.add('active');
                
                // Show region display
                const displayEl = document.getElementById('region-display');
                const nameEl = document.getElementById('region-name');
                if (displayEl && nameEl) {
                    const regionData = RegionalDataV2.getRegion(province, region);
                    nameEl.textContent = regionData ? regionData.name : region;
                    displayEl.classList.remove('hidden');
                }
            }, 50);
        }
    }
};

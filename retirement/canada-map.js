// ═══════════════════════════════════════════
//  Interactive Canada Map - Realistic Paths
//  Source: MapSVG.com (CC BY 4.0), simplified
// ═══════════════════════════════════════════

const CanadaMap = {
    
    selectedProvince: null,
    selectedRegion: null,
    onSelect: null,

    // Simplified real province outlines
    _paths: {
            'BC': `M154,767L186,767L186,870L194,877L196,889L209,907L220,916L225,932L142,932L140,925L132,925L134,917L132,921L126,918L126,904L123,911L114,911L120,909L115,910L115,905L108,906L105,900L115,896L108,896L107,900L106,889L111,885L117,890L116,877L107,891L108,875L99,865L103,862L112,868L106,859L100,868L93,862L98,855L90,854L97,837L94,843L94,827L77,817L47,761L30,775L15,756L159,756L154,767ZM124,915L138,919L159,946L146,942L147,933L142,937L139,931L135,932L139,930L126,924L131,919L124,921L122,917L133,921L124,915ZM75,863L78,868L82,860L77,875L70,860L75,863ZM112,882L111,893L107,878L112,882ZM83,878L88,892L75,880L83,878Z`,
            'AB': `M278,938L240,938L235,922L224,913L211,895L209,884L202,880L201,774L297,774L297,941L278,938Z`,
            'SK': `M356,938L275,938L275,766L339,766L339,929L356,938Z`,
            'MB': `M467,821L415,885L415,938L357,938L357,769L421,769L424,798L427,791L436,792L442,814L437,823L453,818L468,825L467,821Z`,
            'ON': `M551,911L551,955L557,967L578,979L593,977L597,983L582,994L569,995L574,997L555,997L550,1004L556,1007L535,1007L528,1016L525,1011L539,999L540,975L553,982L554,968L524,966L525,958L522,953L514,953L511,944L495,942L496,948L486,951L449,941L445,933L445,885L497,821L511,835L524,840L530,851L543,848L558,853L559,884L575,906L571,912L577,909L582,914L551,911ZM523,978L526,979L521,984L510,982L523,978Z`,
            'QC': `M685,762L683,783L695,784L686,792L691,796L687,821L695,835L691,846L673,845L664,836L664,845L658,840L656,854L662,861L661,872L665,869L664,881L673,879L680,886L685,863L687,868L680,870L682,877L747,877L747,885L732,887L717,901L659,902L630,930L618,927L631,931L618,949L593,967L596,969L589,964L574,966L554,955L547,942L547,889L550,895L551,878L548,854L541,846L558,838L570,820L569,798L554,782L561,763L564,765L562,744L557,744L563,730L557,725L556,714L568,710L588,718L597,711L615,732L626,733L627,737L632,733L630,752L621,754L630,755L632,772L627,772L643,771L643,782L637,787L647,777L649,784L659,771L663,777L663,769L668,766L666,760L670,762L665,759L669,745L685,762ZM666,951L653,951L649,958L643,958L631,986L596,988L607,983L619,968L633,963L646,947L673,936L690,939L691,946L685,951L666,951ZM710,937L694,933L686,926L696,927L710,937Z`,
            'NB': `M690,977L664,985L660,983L660,967L650,965L658,956L687,958L691,960L684,969L689,968L692,979L698,979L690,977Z`,
            'NS': `M687,979L708,978L715,983L686,990L671,1005L667,998L670,991L667,993L682,981L685,985L693,980L679,981L683,975L687,979ZM716,978L720,979L723,973L728,978L713,982L723,964L723,976L716,978Z`,
            'PE': `M692,972L704,972L696,977L679,967L682,963L683,969L692,972Z`,
            'NL': `M752,904L752,896L687,896L685,889L692,887L690,882L685,905L678,898L669,900L670,888L666,891L667,880L661,873L663,859L669,864L669,855L678,864L696,865L700,854L692,840L696,815L691,811L700,803L688,802L688,782L698,794L700,801L695,803L702,802L704,806L698,813L708,811L702,819L712,819L715,826L710,828L721,832L724,840L714,837L724,842L723,847L733,848L730,860L739,856L743,858L740,864L748,858L751,864L759,863L764,868L738,881L738,886L759,873L756,872L764,873L764,883L769,879L776,881L777,894L773,895L779,895L779,901L772,908L767,911L752,904ZM766,903L755,917L754,929L759,923L765,926L759,932L766,934L765,940L774,933L782,937L778,949L788,945L781,951L782,957L790,951L788,959L791,955L785,970L785,963L780,967L781,952L772,963L767,963L777,952L736,950L746,940L739,940L747,933L752,916L759,908L769,907L766,903Z`
    },

    // Label positions (centered in each province)
    _labels: {
        'BC': [120, 851],
        'AB': [249, 858],
        'SK': [316, 852],
        'MB': [412, 854],
        'ON': [521, 918],
        'QC': [644, 849],
        'NB': [674, 970],
        'NS': [698, 984],
        'PE': [692, 970],
        'NL': [726, 876]
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
            <svg viewBox="0 700 800 330" class="canada-map" xmlns="http://www.w3.org/2000/svg"
                 style="width:100%;max-width:800px;height:auto">
                <defs>
                    <style>
                        .province-path {
                            fill: #e8edf3;
                            stroke: #94a3b8;
                            stroke-width: 1.5;
                            stroke-linejoin: round;
                            cursor: pointer;
                            transition: fill 0.2s, stroke 0.2s;
                        }
                        .province-path:hover {
                            fill: #cbd5e1;
                            stroke: #64748b;
                            stroke-width: 2;
                        }
                        .province-path.selected {
                            fill: #3b82f6;
                            stroke: #1e40af;
                            stroke-width: 2;
                        }
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
            html += `
                <button class="region-btn ${selected}" data-region="${region.id}">
                    ${region.name}
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

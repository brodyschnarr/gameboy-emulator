// ═══════════════════════════════════════════
//  Interactive Canada Map - Geographic Paths
//  Derived from public domain GeoJSON data
// ═══════════════════════════════════════════

const CanadaMap = {
    
    selectedProvince: null,
    selectedRegion: null,
    onSelect: null,

    // Real geographic province outlines (simplified from GeoJSON, Mercator projected)
    _paths: {
        'YT': `M154.5,220.4 L18.5,220.4 L17.4,213.8 L0,214.7 L0,9.5 L16.7,13 L21.6,20.1 L41.2,28.8 L43.5,75.3 L64.4,75.3 L66.3,99 L77.8,98.8 L75.3,124.3 L82.5,133.9 L88.6,132.9 L97.8,145.9 L105.2,179.4 L111.9,180 L124.6,192.8 L127.4,206.3 L147.6,202.6 L154.5,220.4Z`,
        'NT': `M350.5,220.3 L154.5,220.4 L147.6,202.6 L127.4,206.3 L124.6,192.8 L111.9,180 L105.2,179.4 L97.8,145.9 L88.6,132.9 L82.5,133.9 L75.8,125.5 L77.8,98.8 L66.3,99 L64.4,75.3 L43.5,75.3 L41.2,28.8 L52.5,35 L48.3,29.2 L55.3,28.1 L60.9,34.1 L57.3,26 L61.5,19.6 L86.2,1.1 L88.2,4.7 L90.9,-2.7 L99.8,-2.1 L101.8,-7.2 L103.4,-0.6 L73.4,20.6 L67.6,30.1 L72.6,34.1 L68.5,30.2 L76.5,31.3 L73.1,24.5 L81.2,15.7 L85.2,17.7 L87.7,13.3 L86.2,18.6 L89,10.4 L90.6,22.8 L95.6,8.2 L108.8,0.8 L108.6,8.3 L113.8,-3.2 L121.2,-6 L115.1,-10.5 L116.9,-16.1 L132.5,12.6 L140,18.2 L140.5,8.3 L145.4,7.6 L141.3,5.1 L147.1,0.6 L142.1,-0.2 L148.9,-1 L146.7,-4 L148.3,7.3 L152.5,8.6 L148.8,16.8 L158.4,15.6 L162.2,4.5 L175.8,6.3 L182.8,11.9 L182.8,51.3 L256.2,109.4 L272.8,109.6 L284.2,124.3 L350.7,137.4 L350.5,220.3Z`,
        'NU': `M716.6,84.3 L708.4,84 L714.1,90.8 L702.1,90.8 L710.5,98.1 L700.6,95.7 L706.9,100.5 L702.3,100.4 L704.3,107.7 L696.7,99.8 L696.2,123 L693.9,116.6 L691,119.6 L688.7,116.6 L690,111.1 L687.3,118.4 L684,113.1 L688.4,110.1 L681.9,111.2 L685.8,106.2 L680.4,106.7 L685,104.6 L678.7,104.3 L688.9,90.4 L674.9,99.5 L678.9,89.6 L672.9,95.4 L664.6,83.7 L664.2,87.3 L658.5,85.3 L662.6,92.1 L656.2,86.9 L663.4,100.4 L656.9,100.7 L651.5,91.6 L648.7,94.2 L655.9,96.7 L655.9,110 L662.2,106 L667.9,125.7 L668,119.7 L672.2,127.4 L674,123.8 L675.9,128.5 L676.6,123.9 L676.6,131.4 L682.4,131.9 L677.2,135.5 L686.1,141.2 L683.3,145.8 L687.8,156.8 L680.5,145.8 L686.5,164.5 L680.7,162.5 L681.8,171.2 L680.2,164 L670.6,162.6 L668.3,154.9 L668,162 L656.9,146.9 L658.7,155.1 L647.2,147 L674.8,178.4 L674.6,184.6 L651.3,177.5 L643.6,167.3 L627.8,162.8 L630,159 L625.5,161.4 L618.9,153.4 L627.1,150.1 L621.1,145.9 L617.4,148.7 L619.4,143.9 L615.5,146.3 L607.8,136.2 L608.5,127.9 L607.1,131.3 L602.9,129.1 L601.4,135 L601.7,126.3 L598.8,129.8 L596.5,122.7 L593.4,125 L596.1,134.1 L585.7,129 L586.7,134.2 L578.2,138 L567.4,134 L563.6,126.9 L572.3,116.7 L571.5,110.4 L586.2,115.7 L589.7,126.7 L591.6,118.3 L584.7,113.6 L606.9,110.7 L598.1,95 L618.5,68.9 L611.3,45.5 L603.7,43 L604.5,34.3 L600.6,33.3 L600.5,38.7 L597.3,30.6 L593.4,31.1 L595.2,24.3 L578.3,33.9 L578.6,25.8 L584.3,26.2 L587.9,20.5 L578.5,12.1 L582.6,8.9 L573.6,9.6 L575.5,1.7 L569.7,6.9 L569.2,-4.9 L562.7,-5.7 L557.2,-18.6 L552,-10.8 L558,-8.1 L559.1,3.3 L532.8,-3.6 L539.6,7.6 L521.4,-8.2 L532.9,1.8 L529,5.8 L520.7,-0.3 L497.4,-2.8 L501.2,0.3 L496.8,0.3 L489.4,-6.4 L490.9,-14.2 L488.6,-8.7 L485.8,-12.7 L485.5,-7.6 L477.6,-6.5 L468.4,-14.4 L462.4,-30.1 L485.4,-27.4 L477.9,-35 L461.5,-36.3 L458.4,-40.5 L460.6,-74.8 L475.7,-107.2 L489.5,-114.5 L504.8,-110.9 L487.7,-78.6 L492.2,-69.2 L490.6,-56.9 L504.9,-35.5 L487,-27.2 L502.3,-32.6 L505.6,-27.2 L506.9,-46.2 L500.9,-46.7 L493.9,-56.8 L498.8,-58.5 L499.1,-64.4 L510.9,-57.1 L504,-65 L508.4,-68 L498.6,-70.7 L497.2,-83.7 L500.8,-86 L512.8,-79.2 L498.6,-87.8 L499.7,-91.4 L515.6,-86.5 L502.2,-96.8 L505.3,-99.4 L509.2,-94.1 L506.5,-99.5 L510.8,-102.2 L515.9,-96.5 L512.3,-103.3 L522.8,-110.6 L534.2,-110.2 L546.1,-78.7 L535.9,-63.7 L543.7,-71.7 L539.8,-53 L546,-65.4 L551.2,-60.3 L546.8,-66.3 L549.8,-71.5 L550.6,-63 L554.3,-68.4 L557.8,-64.7 L555.2,-55.8 L561.7,-52.8 L558.6,-61.7 L568.5,-49.1 L558.6,-63.5 L560.9,-67.3 L562.6,-61.5 L562.6,-66.3 L569.4,-59.3 L575.3,-60.3 L561.3,-69.7 L569.8,-79.3 L577.5,-78.4 L583.3,-70.8 L584.9,-74.1 L591.2,-71.6 L593.7,-64 L580.6,-52.3 L586.1,-59.6 L591.2,-59 L585.3,-47.7 L592.9,-60.3 L600.1,-58.7 L600.2,-51.3 L589.8,-47.1 L593.9,-46.6 L589.6,-42.2 L596.6,-46.1 L591.9,-40.9 L596,-38.7 L592.7,-32.7 L597.5,-46.6 L601.3,-48.7 L600.8,-42.8 L604.9,-49.9 L599.4,-39.2 L600.1,-33.2 L606.2,-43.3 L603.2,-29.2 L608.1,-37.4 L607.8,-27 L615.2,-46.5 L628.1,-35.3 L613.3,-22.4 L618.8,-22.9 L614.6,-17.1 L632.7,-29.3 L631.5,-20.4 L620.6,-11.4 L621.7,-7.8 L624.7,-15.7 L627.7,-14.5 L624.4,-0.5 L629.2,-17.1 L639.2,-24.3 L633.9,-12.9 L643.1,-21.7 L653.6,-13.6 L636.5,-0.8 L639.9,0.4 L634.7,4.4 L641.1,-3.8 L650.4,-4 L638.4,10.2 L650.4,1.6 L654.8,-8.5 L663,1.1 L664.1,7.3 L637.9,12.3 L662.8,14.1 L667.3,23 L647.3,17 L644.9,19.3 L655.5,20.6 L647.5,20.5 L651.7,21.1 L646.9,27 L654.6,22.5 L658.8,25.8 L651.8,29.1 L658.2,31.8 L643.7,30.9 L655.7,34.4 L648.1,36.3 L656.9,37.7 L656.6,41.5 L659.1,37.4 L659.7,41.9 L668.2,40.6 L657.4,44.9 L665,43.5 L659.8,47.3 L665.1,44 L667.6,51.8 L671.4,48.2 L667.4,54.4 L670.7,56.9 L674.9,47.4 L674.1,60.4 L675.8,52.1 L679.2,51.5 L679.9,61.2 L679.5,53.2 L685.7,51.8 L681.3,60 L687,55.7 L693,68 L685,66.9 L690,68.4 L685.1,70.9 L692.5,68.9 L685.9,75.3 L696.1,69.7 L694.2,76.3 L700.1,67.5 L699,76.2 L693.7,79.7 L697.2,77.5 L697.3,82.4 L702.5,76.2 L702,83.8 L703.4,76.7 L707.3,81.7 L709.6,74.2 L716.6,84.3Z`,
        'BC': `M215.5,395.8 L161.5,395.8 L160.4,385.9 L157,390.4 L152.2,386.8 L157,385.9 L153.4,385 L154.4,379.4 L150.4,385.3 L146.1,382.2 L149.7,374.4 L143.1,377 L145.2,368.1 L142.3,375.7 L138.7,375 L139.9,371.3 L137.5,375.5 L132.4,374.3 L137.5,371.9 L138.1,365.8 L135.4,371.8 L129.9,369.6 L133.3,368.1 L130.2,366.1 L125.6,369.8 L121,367.2 L128.4,367.2 L128.9,364.3 L118.7,364.7 L124.8,361.4 L118.8,361.9 L129.4,356.7 L122,357.4 L122.7,354.4 L120.1,360.4 L118.1,353.9 L124.3,347.7 L128.8,352.6 L128.2,346.7 L124.2,346.7 L125.2,339.1 L120.3,348 L116.3,346.5 L117.9,343.7 L113.3,348 L116.6,338.6 L112.9,340 L108.1,328.8 L118,333.6 L109.5,327.7 L111.4,321.4 L105.1,331.5 L98,322.7 L103.6,318.1 L97.8,319.4 L94.6,316.1 L95.1,311.9 L99.2,316.7 L95.6,311.3 L99.9,312.2 L97.3,308.5 L102.3,306.1 L98.9,305.7 L103.6,298.4 L100.6,295.9 L97.9,306.1 L98.1,287.9 L82.5,279.9 L68,248 L49.7,224 L41.9,227.6 L39.7,235.5 L31.8,240.1 L18.5,220.4 L188.9,220.6 L189.6,329.3 L199.9,335.4 L204.7,346.9 L212.9,349.7 L233.6,373.3 L236.1,387.2 L242.4,395.3 L215.5,395.8Z`,
        'AB': `M242.2,395.8 L236.1,387.2 L233.6,373.3 L212.9,349.7 L204.7,346.9 L199.9,335.4 L189.6,329.3 L188.9,220.6 L278.6,220.4 L278.6,395.8 L242.2,395.8Z`,
        'SK': `M350.5,220.3 L356.2,395.8 L278.6,395.8 L278.6,220.4 L350.5,220.3Z`,
        'MB': `M350.5,220.3 L415.3,220.4 L416.6,232.2 L413.5,237.5 L420.6,241.9 L419.2,252.2 L420.9,242.5 L430.1,243.1 L436.7,267.4 L432.6,274.7 L449.4,268.7 L465.8,275.4 L412.1,340 L412.1,395.8 L356.2,395.8 L350.5,220.3Z`,
        'ON': `M552.5,367.8 L552.1,417.3 L557.7,429.8 L581.2,443.8 L598.7,442.3 L599.3,447.1 L584.5,457.7 L570.3,461 L576.7,461.1 L574.1,464.4 L556.5,464.8 L550.3,471.2 L556.6,471.9 L558,476.4 L546.5,477.9 L544.3,480.1 L547.3,481 L536.3,479.6 L525.8,488.8 L520.2,486.9 L526.5,483.3 L526.1,476.5 L532.6,470.9 L536.9,454.7 L533.1,446.3 L539.8,450.2 L539.8,454.9 L547.5,456.6 L547.4,452 L551.4,452.9 L547.8,444.7 L541.6,437.6 L507.7,430.2 L504.8,410.3 L495.6,409.8 L490.5,398.9 L474.1,395.9 L474.6,401.3 L471.4,403.7 L472.1,397.8 L469.8,404.5 L469.6,401.6 L466.2,403 L459.3,409.7 L450.7,406.1 L444.3,409 L431.9,401 L417.3,399.8 L412.1,390.5 L412.1,340 L468.5,275.5 L479.9,289.8 L502.2,300.5 L499.6,306.2 L503.4,301.3 L527.3,303.4 L527.6,337.9 L535,347.9 L531.4,349.6 L542.9,356.7 L544.5,361.8 L539.2,366.8 L544.8,362.2 L552.5,367.8Z`,
        'QC': `M754.1,361.1 L740.4,363.1 L726.9,378.7 L670.2,377.8 L661.7,391.2 L652.2,393.1 L641,407.7 L628.6,403.6 L640.6,408.1 L626.5,426.7 L648.8,404.6 L668.4,394.1 L683.7,392.8 L690.7,401 L680.7,409.5 L675.1,406.6 L661.9,411.8 L652.8,410.7 L652.8,415.7 L645.1,417.1 L638.3,427.4 L632.5,444.6 L624.7,449.5 L595.6,449.8 L598.7,442.3 L581.2,443.8 L570.3,434.6 L560,432.1 L552.1,417.3 L552.3,359 L555.1,357.8 L558.7,364.8 L557,355.7 L562.6,348.8 L557.5,336.9 L556.9,319 L550.5,311.5 L568.4,301.4 L579.6,283.1 L574,255.6 L561.2,245.3 L561.2,239.1 L569.1,231.4 L568.3,225.7 L572.5,228.3 L571.4,221.9 L577.4,217.4 L569.6,219.1 L571.6,210.3 L567.8,208.5 L570.7,204.8 L564.6,205.7 L571,191.3 L566.2,187.6 L566.1,174.7 L571.5,170.8 L587.5,176.7 L585.2,179.3 L590.4,176.3 L597.2,180.4 L595.7,177.6 L605.1,172.9 L614.6,180.2 L613.1,185.6 L618.4,185.1 L617.5,190.8 L624.1,190.1 L621.2,193.5 L624,198.7 L636.9,200.1 L638.9,205.3 L642.6,200.4 L641.6,219.1 L628.9,219.2 L642.1,222.8 L640.4,232.7 L645.1,234.2 L642.3,241.9 L639.4,237.5 L640,241.5 L636,242.5 L639.9,245.7 L646,240.2 L653,242.5 L653.1,253.8 L643.9,260.1 L652.5,255.4 L656.1,246 L655,254.8 L658.6,248 L658.8,257.4 L671,241.2 L673.6,250.5 L674.2,240.2 L680.3,237.7 L676.7,235.8 L678,231.7 L679.9,233.5 L678.3,229.6 L683.3,231.7 L678.3,225.2 L683.3,224.7 L683.5,215.6 L687.3,214.8 L684.5,215.5 L684.7,228.9 L689.1,229.5 L689.5,238.2 L684.2,239.7 L696.8,242.9 L691.7,244.2 L693.8,247.8 L688.3,254.5 L695.8,260.6 L690.9,284.8 L697.1,289.4 L694.7,292.1 L700.3,300.4 L695.1,312.2 L676.9,310.6 L667.2,300.6 L667.9,310.1 L661.3,304.9 L664.8,312.1 L659.8,312.9 L658.1,320.9 L666,332.1 L664.3,341.4 L671.1,337.7 L670.2,349.4 L682.2,349.8 L686.9,359 L690.6,339.6 L694.9,335.6 L697.7,342.6 L691.4,345.3 L694.4,352.4 L754.1,352.4 L754.1,361.1Z`,
        'NB': `M646.8,419.2 L655.1,409.6 L661.9,411.8 L671,408.6 L677.4,414.8 L684.7,412.2 L679.8,422.1 L685,422.2 L687.1,433.7 L694.1,435 L687.3,440.3 L685.4,435.4 L686.4,440.3 L676.5,446.5 L674.1,443.7 L670.2,448.8 L662.1,448.1 L657.9,440.8 L658.1,422.4 L654.1,418.5 L646.8,419.2Z`,
        'NS': `M691.8,436.7 L703.4,441.7 L710.9,438.1 L719.4,446.2 L695.2,453.4 L695.5,457 L693.1,453.7 L689.4,455.4 L685.1,464.3 L676.6,468.9 L672.6,464.3 L673.2,456.2 L687.7,445.3 L690.7,450 L697.9,445 L683.7,445.4 L691.8,436.7Z`,
        'PE': `M692.2,431.4 L688.4,427.5 L692.1,422.4 L692.7,430.3 L710.4,430.5 L703.4,437.3 L701.5,432.3 L698.8,434.8 L692.2,431.4Z`,
        'NL': `M687.3,214.8 L684.7,220.6 L690.6,219.8 L691,229.1 L694.6,229.2 L691.6,231.6 L697.7,233.4 L691.7,238.1 L697.8,236.6 L702,242.2 L695.8,250.8 L705.1,247.7 L702,252.4 L704.9,252.3 L698.1,256.4 L706,253 L704.1,257.3 L709,256.6 L711.2,262.3 L705.2,264.6 L715.9,271.7 L711,276.6 L712.9,279.6 L704.8,276.6 L712.7,280.3 L708.9,282.5 L713.8,285.1 L709.4,285.1 L715.9,286.1 L714.6,289.7 L722.7,292.8 L722,296.9 L725,293.3 L723.8,300.4 L726.3,299.2 L721.9,306.1 L730.1,300.7 L728.4,304.3 L733.2,303.8 L728.6,310 L735.6,302.2 L733.6,306.5 L736.9,303.5 L737.8,308.4 L751.9,312.7 L731.9,321.1 L742.7,318.2 L726.9,325.3 L726.9,329.2 L719.8,326.4 L727.7,329.7 L724.4,331.7 L727.1,333.2 L738.5,322.7 L748,320.8 L743.1,320.5 L744.5,318.1 L753.8,322.9 L751.7,330.7 L759.9,325.3 L757.5,326.9 L765.8,332.1 L762.5,336.9 L765.8,339.8 L762.6,340.4 L766.4,342.7 L759.6,343.5 L766.3,345 L762.3,345.9 L767.5,349.2 L755.6,360.9 L754.1,352.4 L694.4,352.4 L691.4,345.3 L697.7,342.6 L694.9,335.6 L690.6,339.6 L686.9,359 L682.2,349.8 L670.2,349.4 L671.1,337.7 L664.3,341.4 L666,332.1 L658.1,320.9 L659.8,312.9 L664.8,312.1 L661.3,304.9 L667.9,310.1 L667.2,300.6 L676.9,310.6 L695.1,312.2 L700.3,300.4 L694.7,292.1 L697.1,289.4 L690.9,284.8 L695.8,260.6 L688.3,254.5 L693.8,247.8 L691.7,244.2 L696.8,242.9 L684.2,239.7 L689.5,238.2 L689.1,229.5 L684.7,228.9 L684.5,215.5 L687.3,214.8Z`
    },

    // Distinct colors per province/territory (matching political map style)
    _colors: {
        'YT': '#a8d5e2',   // light blue
        'NT': '#95c8d8',   // medium blue  
        'NU': '#b8d4e3',   // pale blue
        'BC': '#e8524a',   // red
        'AB': '#f5d76e',   // yellow
        'SK': '#7ec870',   // green
        'MB': '#f5e6b8',   // cream/light yellow
        'ON': '#f0a830',   // orange
        'QC': '#7ec870',   // green
        'NB': '#f0a830',   // orange
        'NS': '#f5d76e',   // yellow
        'PE': '#7ec870',   // green
        'NL': '#e8a0bf'    // pink
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
            `<path data-province="${prov}" class="province-path" d="${d}" fill="${this._colors[prov] || '#e8edf3'}"/>`
        ).join('\n');

        return `
            <svg viewBox="-10 -120 790 620" class="canada-map" xmlns="http://www.w3.org/2000/svg"
                 style="width:100%;max-width:500px;height:auto;margin:0 auto;display:block">
                <defs>
                    <style>
                        .province-path {
                            stroke: #fff;
                            stroke-width: 1.5;
                            stroke-linejoin: round;
                            cursor: pointer;
                            transition: opacity 0.2s;
                            paint-order: stroke;
                        }
                        .province-path:hover {
                            opacity: 0.8;
                        }
                        .province-path.selected {
                            stroke: #1e40af;
                            stroke-width: 2.5;
                            opacity: 0.9;
                            filter: brightness(0.85);
                        }
                    </style>
                </defs>
                ${pathEls}
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

    // Track user location selection for analytics
    _trackLocationSelection(province, region) {
        try {
            const data = {
                province,
                region,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent?.substring(0, 100)
            };
            const existing = JSON.parse(localStorage.getItem('rc_location_events') || '[]');
            existing.push(data);
            if (existing.length > 50) existing.splice(0, existing.length - 50);
            localStorage.setItem('rc_location_events', JSON.stringify(existing));
            
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

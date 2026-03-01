// ═══════════════════════════════════════════
//  Advanced Chart Visualizations
//  Monte Carlo distributions, confidence bands, heatmaps
// ═══════════════════════════════════════════

const AdvancedCharts = {
    
    /**
     * Draw portfolio projection with confidence bands (10th-90th percentile)
     * @param {string} canvasId - Canvas element ID
     * @param {Object} monteCarloResults - Results from MonteCarloSimulator
     */
    drawConfidenceBands(canvasId, monteCarloResults) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth - 40;
        canvas.height = 400;
        
        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;
        
        ctx.clearRect(0, 0, w, h);
        
        const { percentiles } = monteCarloResults;
        const p10Projection = percentiles.p10.projection;
        const p50Projection = percentiles.p50.projection;
        const p90Projection = percentiles.p90.projection;
        
        if (!p50Projection || p50Projection.length === 0) return;
        
        const minAge = p50Projection[0].age;
        const maxAge = p50Projection[p50Projection.length - 1].age;
        
        // Find max balance across all percentiles
        const maxBalance = Math.max(
            ...p90Projection.map(y => y.totalBalance),
            ...p50Projection.map(y => y.totalBalance)
        );
        
        // Helper functions
        const scaleX = (age) => padding + ((age - minAge) / (maxAge - minAge)) * (w - 2 * padding);
        const scaleY = (balance) => h - padding - (balance / maxBalance) * (h - 2 * padding);
        
        // Draw 10th-90th percentile band (light blue fill)
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.beginPath();
        
        // Top edge (90th percentile)
        p90Projection.forEach((year, i) => {
            const x = scaleX(year.age);
            const y = scaleY(year.totalBalance);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        // Bottom edge (10th percentile, reversed)
        for (let i = p10Projection.length - 1; i >= 0; i--) {
            const year = p10Projection[i];
            const x = scaleX(year.age);
            const y = scaleY(year.totalBalance);
            ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        ctx.fill();
        
        // Draw median line (50th percentile)
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.beginPath();
        p50Projection.forEach((year, i) => {
            const x = scaleX(year.age);
            const y = scaleY(year.totalBalance);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Draw 10th percentile line (dashed)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        p10Projection.forEach((year, i) => {
            const x = scaleX(year.age);
            const y = scaleY(year.totalBalance);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Draw 90th percentile line (dashed)
        ctx.strokeStyle = '#22c55e';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        p90Projection.forEach((year, i) => {
            const x = scaleX(year.age);
            const y = scaleY(year.totalBalance);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, h - padding);
        ctx.lineTo(w - padding, h - padding);
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h - padding);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#374151';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        
        // X-axis labels (ages)
        for (let age = minAge; age <= maxAge; age += 10) {
            const x = scaleX(age);
            ctx.fillText(age.toString(), x, h - padding + 20);
        }
        
        // Y-axis labels (balance)
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const balance = (maxBalance / 4) * i;
            const y = scaleY(balance);
            ctx.fillText('$' + (balance / 1000).toFixed(0) + 'K', padding - 10, y + 5);
        }
        
        // Legend
        ctx.textAlign = 'left';
        ctx.font = 'bold 14px system-ui';
        ctx.fillStyle = '#2563eb';
        ctx.fillText('━━━ Median (50th percentile)', w - 260, 30);
        ctx.fillStyle = '#22c55e';
        ctx.fillText('- - - Best Case (90th percentile)', w - 260, 50);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('- - - Worst Case (10th percentile)', w - 260, 70);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.fillText('■ Confidence Band (80%)', w - 260, 90);
    },
    
    /**
     * Draw success probability heatmap (retirement age vs portfolio size)
     */
    drawSuccessHeatmap(canvasId, baseInputs) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 400;
        
        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;
        
        ctx.clearRect(0, 0, w, h);
        
        // Grid dimensions
        const retirementAges = [55, 60, 65, 70];
        const portfolioMultipliers = [0.7, 0.85, 1.0, 1.15, 1.3]; // Relative to current
        
        const cellWidth = (w - 2 * padding) / retirementAges.length;
        const cellHeight = (h - 2 * padding) / portfolioMultipliers.length;
        
        // Calculate success rate for each cell
        const heatmapData = [];
        
        portfolioMultipliers.forEach((multiplier, row) => {
            const rowData = [];
            retirementAges.forEach((age, col) => {
                const testInputs = {
                    ...baseInputs,
                    retirementAge: age,
                    rrsp: (baseInputs.rrsp || 0) * multiplier,
                    tfsa: (baseInputs.tfsa || 0) * multiplier,
                    nonReg: (baseInputs.nonReg || 0) * multiplier
                };
                
                const result = RetirementCalcV4.calculate(testInputs);
                const successRate = result.probability;
                
                rowData.push({
                    age,
                    multiplier,
                    successRate,
                    x: padding + col * cellWidth,
                    y: padding + row * cellHeight
                });
            });
            heatmapData.push(rowData);
        });
        
        // Draw cells
        heatmapData.forEach(row => {
            row.forEach(cell => {
                // Color based on success rate
                const color = this._getHeatmapColor(cell.successRate);
                ctx.fillStyle = color;
                ctx.fillRect(cell.x, cell.y, cellWidth, cellHeight);
                
                // Border
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(cell.x, cell.y, cellWidth, cellHeight);
                
                // Text
                ctx.fillStyle = cell.successRate >= 50 ? '#ffffff' : '#000000';
                ctx.font = 'bold 16px system-ui';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    cell.successRate + '%',
                    cell.x + cellWidth / 2,
                    cell.y + cellHeight / 2
                );
            });
        });
        
        // Axis labels
        ctx.fillStyle = '#374151';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        
        // X-axis (retirement ages)
        retirementAges.forEach((age, i) => {
            const x = padding + (i + 0.5) * cellWidth;
            ctx.fillText(`Age ${age}`, x, h - padding + 20);
        });
        
        // Y-axis (portfolio sizes)
        ctx.textAlign = 'right';
        portfolioMultipliers.forEach((mult, i) => {
            const y = padding + (i + 0.5) * cellHeight;
            const pct = Math.round((mult - 1) * 100);
            const label = pct > 0 ? `+${pct}%` : `${pct}%`;
            ctx.fillText(label, padding - 10, y);
        });
        
        // Axis titles
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Retirement Age', w / 2, h - 10);
        
        ctx.save();
        ctx.translate(15, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Portfolio Size', 0, 0);
        ctx.restore();
        
        // Legend
        ctx.textAlign = 'left';
        ctx.font = '12px system-ui';
        ctx.fillText('Success Rate:', w - 140, 30);
        
        const legendData = [
            { rate: 95, label: '95%+', color: this._getHeatmapColor(95) },
            { rate: 85, label: '85-94%', color: this._getHeatmapColor(89) },
            { rate: 70, label: '70-84%', color: this._getHeatmapColor(77) },
            { rate: 50, label: '50-69%', color: this._getHeatmapColor(60) },
            { rate: 30, label: '<50%', color: this._getHeatmapColor(40) }
        ];
        
        legendData.forEach((item, i) => {
            const y = 50 + i * 20;
            ctx.fillStyle = item.color;
            ctx.fillRect(w - 140, y, 20, 15);
            ctx.fillStyle = '#374151';
            ctx.fillText(item.label, w - 115, y + 11);
        });
    },
    
    /**
     * Get heatmap color based on success rate
     */
    _getHeatmapColor(successRate) {
        if (successRate >= 95) return '#22c55e'; // Green
        if (successRate >= 85) return '#84cc16'; // Light green
        if (successRate >= 70) return '#facc15'; // Yellow
        if (successRate >= 50) return '#f97316'; // Orange
        return '#ef4444'; // Red
    },
    
    /**
     * Draw probability distribution histogram
     */
    drawProbabilityDistribution(canvasId, monteCarloResults) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = 500;
        canvas.height = 300;
        
        const w = canvas.width;
        const h = canvas.height;
        const padding = 50;
        
        ctx.clearRect(0, 0, w, h);
        
        const { allResults } = monteCarloResults;
        if (!allResults || allResults.length === 0) return;
        
        // Create bins for final balance distribution
        const finalBalances = allResults.map(r => r.finalBalance).sort((a, b) => a - b);
        const minBalance = Math.min(...finalBalances);
        const maxBalance = Math.max(...finalBalances);
        
        const binCount = 20;
        const binWidth = (maxBalance - minBalance) / binCount;
        const bins = new Array(binCount).fill(0);
        
        // Count results in each bin
        finalBalances.forEach(balance => {
            const binIndex = Math.min(
                Math.floor((balance - minBalance) / binWidth),
                binCount - 1
            );
            bins[binIndex]++;
        });
        
        const maxCount = Math.max(...bins);
        
        // Draw bars
        const barWidth = (w - 2 * padding) / binCount;
        bins.forEach((count, i) => {
            const barHeight = (count / maxCount) * (h - 2 * padding);
            const x = padding + i * barWidth;
            const y = h - padding - barHeight;
            
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(x, y, barWidth - 2, barHeight);
        });
        
        // Draw axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, h - padding);
        ctx.lineTo(w - padding, h - padding);
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h - padding);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#374151';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        
        // X-axis (balance ranges)
        for (let i = 0; i <= 4; i++) {
            const balance = minBalance + (maxBalance - minBalance) * (i / 4);
            const x = padding + ((w - 2 * padding) * i / 4);
            ctx.fillText('$' + (balance / 1000).toFixed(0) + 'K', x, h - padding + 20);
        }
        
        // Y-axis (frequency)
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const count = (maxCount / 4) * i;
            const y = h - padding - ((h - 2 * padding) * i / 4);
            ctx.fillText(Math.round(count).toString(), padding - 10, y + 5);
        }
        
        // Title
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px system-ui';
        ctx.fillText('Distribution of Final Portfolio Values', w / 2, 20);
        
        // Summary stats
        ctx.textAlign = 'left';
        ctx.font = '12px system-ui';
        const median = finalBalances[Math.floor(finalBalances.length / 2)];
        const p10 = finalBalances[Math.floor(finalBalances.length * 0.1)];
        const p90 = finalBalances[Math.floor(finalBalances.length * 0.9)];
        
        ctx.fillText(`10th: $${(p10 / 1000).toFixed(0)}K`, 20, h - 10);
        ctx.fillText(`Median: $${(median / 1000).toFixed(0)}K`, w / 2 - 80, h - 10);
        ctx.fillText(`90th: $${(p90 / 1000).toFixed(0)}K`, w - 120, h - 10);
    },
    
    /**
     * Draw withdrawal strategy comparison (stacked area chart)
     */
    drawWithdrawalComparison(canvasId, taxOptimization) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 350;
        
        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;
        
        ctx.clearRect(0, 0, w, h);
        
        const { optimalStrategy } = taxOptimization;
        if (!optimalStrategy || !optimalStrategy.yearByYear) return;
        
        const years = optimalStrategy.yearByYear;
        const minAge = years[0].age;
        const maxAge = years[years.length - 1].age;
        
        // Find max total withdrawal
        const maxWithdrawal = Math.max(...years.map(y => 
            (y.rrspWithdrawal || 0) + (y.tfsaWithdrawal || 0) + (y.nonRegWithdrawal || 0)
        ));
        
        const scaleX = (age) => padding + ((age - minAge) / (maxAge - minAge)) * (w - 2 * padding);
        const scaleY = (amount) => h - padding - (amount / maxWithdrawal) * (h - 2 * padding);
        
        // Draw stacked areas (RRSP, TFSA, Non-Reg)
        // Non-Reg (bottom)
        ctx.fillStyle = 'rgba(99, 102, 241, 0.6)'; // Indigo
        ctx.beginPath();
        ctx.moveTo(padding, h - padding);
        years.forEach(year => {
            const x = scaleX(year.age);
            const y = scaleY(year.nonRegWithdrawal || 0);
            ctx.lineTo(x, y);
        });
        ctx.lineTo(scaleX(maxAge), h - padding);
        ctx.closePath();
        ctx.fill();
        
        // TFSA (middle)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.6)'; // Green
        ctx.beginPath();
        ctx.moveTo(padding, h - padding);
        years.forEach(year => {
            const nonReg = year.nonRegWithdrawal || 0;
            const tfsa = year.tfsaWithdrawal || 0;
            const x = scaleX(year.age);
            const y = scaleY(nonReg + tfsa);
            ctx.lineTo(x, y);
        });
        for (let i = years.length - 1; i >= 0; i--) {
            const year = years[i];
            const x = scaleX(year.age);
            const y = scaleY(year.nonRegWithdrawal || 0);
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        // RRSP (top)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)'; // Red
        ctx.beginPath();
        years.forEach((year, i) => {
            const nonReg = year.nonRegWithdrawal || 0;
            const tfsa = year.tfsaWithdrawal || 0;
            const x = scaleX(year.age);
            const y = scaleY(nonReg + tfsa);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        for (let i = years.length - 1; i >= 0; i--) {
            const year = years[i];
            const nonReg = year.nonRegWithdrawal || 0;
            const tfsa = year.tfsaWithdrawal || 0;
            const rrsp = year.rrspWithdrawal || 0;
            const x = scaleX(year.age);
            const y = scaleY(nonReg + tfsa + rrsp);
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, h - padding);
        ctx.lineTo(w - padding, h - padding);
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h - padding);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#374151';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        
        for (let age = minAge; age <= maxAge; age += 10) {
            const x = scaleX(age);
            ctx.fillText(age.toString(), x, h - padding + 20);
        }
        
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const amount = (maxWithdrawal / 4) * i;
            const y = scaleY(amount);
            ctx.fillText('$' + (amount / 1000).toFixed(0) + 'K', padding - 10, y + 5);
        }
        
        // Legend
        ctx.textAlign = 'left';
        ctx.font = '12px system-ui';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.fillText('■ RRSP (taxable)', w - 200, 30);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.fillText('■ TFSA (tax-free)', w - 200, 50);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
        ctx.fillText('■ Non-Reg (capital gains)', w - 200, 70);
        
        // Title
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Optimal Withdrawal Strategy Over Time', w / 2, 20);
    }
};

console.log('[AdvancedCharts] Module loaded');

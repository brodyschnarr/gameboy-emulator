// CLEAN chart drawing function - no debugging clutter

_drawChart(yearByYear, retirementAge) {
    const canvas = document.getElementById('projection-chart');
    if (!canvas) {
        console.error('[Chart] Canvas #projection-chart not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('[Chart] Cannot get 2D context');
        return;
    }

    // Set dimensions
    const parent = canvas.parentElement;
    const width = Math.max(parent.offsetWidth - 40, 300);
    canvas.width = width;
    canvas.height = 400;

    const w = canvas.width;
    const h = canvas.height;
    const pad = 60;

    console.log(`[Chart] Drawing ${w}x${h} with ${yearByYear.length} data points`);

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Get data range
    const balances = yearByYear.map(y => y.totalBalance || y.totalPortfolio || 0);
    const maxBalance = Math.max(...balances);
    
    if (maxBalance === 0 || isNaN(maxBalance)) {
        ctx.fillStyle = '#ef4444';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data to display', w / 2, h / 2);
        console.error('[Chart] No valid data');
        return;
    }

    const minAge = yearByYear[0].age;
    const maxAge = yearByYear[yearByYear.length - 1].age;

    // Draw axes
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();

    // Draw retirement line
    const retireX = pad + ((retirementAge - minAge) / (maxAge - minAge)) * (w - 2 * pad);
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(retireX, pad);
    ctx.lineTo(retireX, h - pad);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw balance line
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();

    yearByYear.forEach((point, i) => {
        const x = pad + ((point.age - minAge) / (maxAge - minAge)) * (w - 2 * pad);
        const balance = point.totalBalance || point.totalPortfolio || 0;
        const y = h - pad - (balance / maxBalance) * (h - 2 * pad);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // Add labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Age ${minAge}`, pad, h - pad + 20);
    ctx.textAlign = 'right';
    ctx.fillText(`Age ${maxAge}`, w - pad, h - pad + 20);
    ctx.textAlign = 'left';
    ctx.fillText(`$${(maxBalance / 1000).toFixed(0)}K`, 5, pad);

    console.log('[Chart] Drawing complete');
}

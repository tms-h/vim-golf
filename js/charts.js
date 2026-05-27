export class ChartRenderer {
  constructor() {
    this._tooltip = null;
    this._layers = { dots: true, movingAvg: true, trendLine: true };
    this._modeFilter = null; // null = all modes
  }

  // Creates and returns a container div with the canvas, toggles, and summary
  // sessions = array of { date, mode, avgEfficiency (0-1), avgTime (ms), problemsCompleted, optimalCount }
  render(sessions) {
    if (sessions.length < 2) return this._noData();

    const container = document.createElement('div');
    container.style.cssText = 'position:relative;';

    // Filter controls
    const controls = this._createControls(sessions);
    container.appendChild(controls);

    // Canvas — measure container width after it's in the DOM
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:200px;display:block;';
    container.appendChild(canvas);

    // Tooltip div (absolute positioned, hidden by default)
    const tooltip = document.createElement('div');
    tooltip.style.cssText = 'position:absolute;display:none;background:#1f1f38;border:1px solid #6e6a86;padding:8px 12px;font-family:"JetBrains Mono",monospace;font-size:11px;color:#e0def4;pointer-events:none;z-index:10;white-space:nowrap;';
    container.appendChild(tooltip);
    this._tooltip = tooltip;

    // Draw
    const filtered = this._modeFilter
      ? sessions.filter(s => s.mode === this._modeFilter)
      : sessions;

    if (filtered.length < 2) {
      container.appendChild(this._noData());
      return container;
    }

    // Summary stat
    const summary = this._createSummary(filtered);
    container.appendChild(summary);

    this._container = container;
    this._canvas = canvas;
    this._sessions = sessions;

    // Defer drawing until canvas is in the DOM and has layout
    requestAnimationFrame(() => {
      const width = canvas.offsetWidth || 520;
      const height = 200;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      this._draw(canvas, filtered, tooltip, width, height);
      this._setupHover(canvas, filtered, tooltip, width, height);
    });

    return container;
  }

  _noData() {
    const div = document.createElement('div');
    div.style.cssText = 'color:#6e6a86;font-style:italic;font-size:13px;padding:20px 0;';
    div.textContent = 'Complete more sessions to see trends';
    return div;
  }

  _createControls(sessions) {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center;';

    // Layer toggles
    const layers = [
      { key: 'dots', label: 'Data' },
      { key: 'movingAvg', label: 'Avg' },
      { key: 'trendLine', label: 'Trend' }
    ];

    for (const l of layers) {
      const btn = document.createElement('button');
      btn.textContent = l.label;
      btn.style.cssText = `background:none;border:1px solid ${this._layers[l.key] ? '#c4a7e7' : '#6e6a86'};color:${this._layers[l.key] ? '#c4a7e7' : '#6e6a86'};font-family:'Crimson Pro',serif;font-size:12px;padding:2px 10px;cursor:pointer;transition:all .15s;`;
      btn.addEventListener('click', () => {
        this._layers[l.key] = !this._layers[l.key];
        this._redraw();
      });
      bar.appendChild(btn);
    }

    // Mode filter
    const modes = [...new Set(sessions.map(s => s.mode))];
    if (modes.length > 1) {
      const sep = document.createElement('span');
      sep.style.cssText = 'width:1px;height:16px;background:#3e3a56;margin:0 4px;';
      bar.appendChild(sep);

      const allBtn = document.createElement('button');
      allBtn.textContent = 'All';
      allBtn.style.cssText = `background:none;border:1px solid ${!this._modeFilter ? '#c4a7e7' : '#6e6a86'};color:${!this._modeFilter ? '#c4a7e7' : '#6e6a86'};font-family:'Crimson Pro',serif;font-size:12px;padding:2px 10px;cursor:pointer;`;
      allBtn.addEventListener('click', () => { this._modeFilter = null; this._redraw(); });
      bar.appendChild(allBtn);

      for (const mode of modes) {
        const btn = document.createElement('button');
        btn.textContent = mode;
        btn.style.cssText = `background:none;border:1px solid ${this._modeFilter === mode ? '#c4a7e7' : '#6e6a86'};color:${this._modeFilter === mode ? '#c4a7e7' : '#6e6a86'};font-family:'Crimson Pro',serif;font-size:11px;padding:2px 8px;cursor:pointer;`;
        btn.addEventListener('click', () => { this._modeFilter = mode; this._redraw(); });
        bar.appendChild(btn);
      }
    }

    return bar;
  }

  _redraw() {
    if (!this._container || !this._sessions) return;
    const parent = this._container.parentNode;
    if (!parent) return;
    const newContainer = this.render(this._sessions);
    parent.replaceChild(newContainer, this._container);
  }

  _draw(canvas, sessions, tooltip, w, h) {
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const pad = { top: 15, right: 15, bottom: 30, left: 45 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const data = sessions.map(s => (s.avgEfficiency || 0) * 100);
    const minY = 0, maxY = 100;

    const toX = i => pad.left + (i / Math.max(1, data.length - 1)) * plotW;
    const toY = v => pad.top + ((maxY - v) / (maxY - minY)) * plotH;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(62, 58, 86, 0.5)';
    ctx.lineWidth = 0.5;
    for (let pct = 0; pct <= 100; pct += 25) {
      const y = toY(pct);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      // Y axis labels
      ctx.fillStyle = '#6e6a86';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(pct + '%', pad.left - 6, y + 3);
    }

    // X axis labels (show a few session numbers)
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(data.length / 6));
    for (let i = 0; i < data.length; i += step) {
      ctx.fillText(String(i + 1), toX(i), h - pad.bottom + 16);
    }
    if (data.length > 1) {
      ctx.fillText(String(data.length), toX(data.length - 1), h - pad.bottom + 16);
    }

    // Store point positions for hover detection
    this._points = data.map((v, i) => ({ x: toX(i), y: toY(v), i, v }));

    // Scatter dots
    if (this._layers.dots) {
      ctx.fillStyle = 'rgba(196, 167, 231, 0.4)';
      for (const p of this._points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Moving average line (window of 10)
    if (this._layers.movingAvg && data.length >= 3) {
      const windowSize = Math.min(10, Math.floor(data.length / 2));
      const avgData = [];
      for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const slice = data.slice(start, i + 1);
        avgData.push(slice.reduce((a, b) => a + b, 0) / slice.length);
      }

      ctx.strokeStyle = '#c4a7e7';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < avgData.length; i++) {
        const x = toX(i), y = toY(avgData[i]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Linear regression trend line
    if (this._layers.trendLine && data.length >= 3) {
      const n = data.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i; sumY += data[i]; sumXY += i * data[i]; sumXX += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      ctx.strokeStyle = '#9ccfd8';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(intercept));
      ctx.lineTo(toX(n - 1), toY(slope * (n - 1) + intercept));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _setupHover(canvas, sessions, tooltip, width, height) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (!this._points) return;

      let closest = null, minDist = 20; // 20px detection radius
      for (const p of this._points) {
        const dist = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2);
        if (dist < minDist) { minDist = dist; closest = p; }
      }

      if (closest) {
        const s = sessions[closest.i];
        const date = new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' });
        const eff = Math.round((s.avgEfficiency || 0) * 100);
        const time = ((s.avgTime || 0) / 1000).toFixed(1);
        const opt = Math.round((s.optimalCount / Math.max(1, s.problemsCompleted)) * 100);

        tooltip.innerHTML = `<div style="color:#c4a7e7;margin-bottom:3px;">${date} · ${s.mode}</div>`
          + `<div>Efficiency: <span style="color:#9ccfd8">${eff}%</span></div>`
          + `<div>Avg time: <span style="color:#9ccfd8">${time}s</span></div>`
          + `<div>Solved: <span style="color:#9ccfd8">${s.problemsCompleted}</span></div>`
          + `<div>Optimal: <span style="color:#9ccfd8">${opt}%</span></div>`;

        tooltip.style.display = 'block';
        // Position tooltip near the point but keep within bounds
        let tx = closest.x + 12;
        let ty = closest.y - 10;
        if (tx + 160 > width) tx = closest.x - 170;
        if (ty < 0) ty = 10;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
      } else {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }

  _createSummary(sessions) {
    const div = document.createElement('div');
    div.style.cssText = 'font-family:"JetBrains Mono",monospace;font-size:11px;color:#908caa;margin-top:6px;';

    if (sessions.length < 10) {
      div.textContent = 'Need 10+ sessions for trend analysis';
      return div;
    }

    const data = sessions.map(s => (s.avgEfficiency || 0) * 100);
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i; sumY += data[i]; sumXY += i * data[i]; sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const changePer10 = slope * 10;
    const sign = changePer10 >= 0 ? '+' : '';
    const color = changePer10 >= 0 ? '#9ccfd8' : '#eb6f92';

    div.innerHTML = `Efficiency change per 10 sessions: <span style="color:${color}">${sign}${changePer10.toFixed(1)}%</span>`;
    return div;
  }
}

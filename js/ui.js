import { ChartRenderer } from './charts.js';

export const VIM_TIPS = [
  'ci" changes text inside quotes instantly',
  'da( deletes around parentheses including them',
  '% jumps between matching brackets',
  'f{char} finds the next occurrence on the line',
  '. repeats your last change — the most powerful vim command',
  'Ctrl-v enters visual block mode for column editing',
  'J joins lines — no need to navigate to the end',
  '* searches for the word under the cursor',
  'qa records a macro to register a, q stops, @a replays',
  'diw deletes a word without the space, daw includes it',
  ':s/old/new/g replaces all occurrences on a line',
  'cc changes an entire line, preserving indent',
  '0 goes to column 0, ^ goes to first non-blank',
  'Ctrl-a and Ctrl-x increment/decrement numbers',
  '~ toggles the case of the character under the cursor',
  'gcc toggles comment on a line, gc{motion} comments a range',
  ':%s/old/new/g replaces all occurrences in the file',
];

export class UIRenderer {
  constructor() {
    this.screens = {};
    for (const id of ['start','game','results','stats']) this.screens[id] = document.getElementById('screen-' + id);
    this.el = id => document.getElementById(id);
  }

  showScreen(name) { for (const k in this.screens) this.screens[k].classList.toggle('active', k === name); }

  // ── Start Screen ────────────────────────────────────────
  renderStartMenu(submenu, practiceCategories) {
    const menu = this.el('term-menu');
    if (!submenu) {
      menu.innerHTML = `
        <div class="term-item" data-action="timed"><span class="term-key">[t]</span> timed</div>
        <div class="term-item" data-action="count"><span class="term-key">[c]</span> count</div>
        <div class="term-item" data-action="practice"><span class="term-key">[p]</span> practice</div>
        <div class="term-item" data-action="stats"><span class="term-key">[s]</span> stats</div>
        <div class="term-item" data-action="help"><span class="term-key">[?]</span> help</div>`;
    } else if (submenu === 'timed') {
      menu.innerHTML = `
        <div class="term-label">timed</div>
        <div class="term-item term-sub" data-action="timed-30"><span class="term-key">[1]</span> 30 seconds</div>
        <div class="term-item term-sub" data-action="timed-60"><span class="term-key">[2]</span> 60 seconds</div>
        <div class="term-item term-sub" data-action="timed-120"><span class="term-key">[3]</span> 120 seconds</div>
        <div class="term-back">Esc &larr; back</div>`;
    } else if (submenu === 'count') {
      menu.innerHTML = `
        <div class="term-label">count</div>
        <div class="term-item term-sub" data-action="count-10"><span class="term-key">[1]</span> 10 problems</div>
        <div class="term-item term-sub" data-action="count-25"><span class="term-key">[2]</span> 25 problems</div>
        <div class="term-item term-sub" data-action="count-50"><span class="term-key">[3]</span> 50 problems</div>
        <div class="term-back">Esc &larr; back</div>`;
    } else if (submenu === 'practice') {
      const cats = practiceCategories || [];
      const keys = ['d','c','i','n','y','v','o','m','/','k','r'];
      let html = '<div class="term-label">practice</div>';
      cats.forEach((cat, idx) => {
        const k = keys[idx] || String(idx + 1);
        html += `<div class="term-item term-sub" data-action="practice-${cat}"><span class="term-key">[${k}]</span> ${cat}</div>`;
      });
      html += '<div class="term-back">Esc &larr; back</div>';
      menu.innerHTML = html;
    } else if (submenu.startsWith('practice-diff:')) {
      const cat = submenu.split(':')[1];
      menu.innerHTML = `
        <div class="term-label">${cat}</div>
        <div class="term-item term-sub" data-action="pdiff-${cat}-1"><span class="term-key">[1]</span> beginner (d1-2)</div>
        <div class="term-item term-sub" data-action="pdiff-${cat}-2"><span class="term-key">[2]</span> intermediate (d3)</div>
        <div class="term-item term-sub" data-action="pdiff-${cat}-3"><span class="term-key">[3]</span> advanced (d4-5)</div>
        <div class="term-item term-sub" data-action="pdiff-${cat}-0"><span class="term-key">[4]</span> all difficulties</div>
        <div class="term-back">Esc &larr; back</div>`;
    }
    this.el('term-tip').textContent = '// tip: ' + VIM_TIPS[Math.floor(Math.random() * VIM_TIPS.length)];
  }

  renderHelp(visible) {
    const overlay = this.el('help-overlay');
    if (!visible) { overlay.classList.add('hidden'); return; }
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<div class="help-box">
      <div class="help-title">Keybindings</div>
      <div class="help-section">
        <div class="help-heading">Start Screen</div>
        <div class="help-row"><span class="hk">t</span> timed mode</div>
        <div class="help-row"><span class="hk">c</span> count mode</div>
        <div class="help-row"><span class="hk">p</span> practice mode</div>
        <div class="help-row"><span class="hk">s</span> statistics</div>
        <div class="help-row"><span class="hk">1 2 3</span> select sub-option</div>
        <div class="help-row"><span class="hk">Esc</span> back from submenu</div>
        <div class="help-row"><span class="hk">?</span> toggle this help</div>
      </div>
      <div class="help-section">
        <div class="help-heading">Game</div>
        <div class="help-row"><span class="hk">Tab</span> skip problem</div>
        <div class="help-row"><span class="hk">Ctrl-g</span> show solution replay</div>
        <div class="help-row"><span class="hk">:q</span> end session</div>
      </div>
      <div class="help-section">
        <div class="help-heading">Solution Replay</div>
        <div class="help-row"><span class="hk">Enter</span> step through</div>
        <div class="help-row"><span class="hk">Space</span> auto-play</div>
        <div class="help-row"><span class="hk">Esc</span> exit replay</div>
      </div>
      <div class="help-section">
        <div class="help-heading">Results</div>
        <div class="help-row"><span class="hk">Enter / r</span> play again</div>
        <div class="help-row"><span class="hk">s</span> statistics</div>
        <div class="help-row"><span class="hk">Esc</span> home</div>
      </div>
      <div class="help-section">
        <div class="help-heading">Stats</div>
        <div class="help-row"><span class="hk">Esc / q</span> back</div>
        <div class="help-row"><span class="hk">e</span> export data</div>
        <div class="help-row"><span class="hk">i</span> import data</div>
      </div>
      <div class="help-close">press ? or Esc to close</div>
    </div>`;
  }

  // ── Game Screen ─────────────────────────────────────────
  renderGame(engine, problem, keystrokes, timerText, counterText, modeLabel) {
    this.el('game-mode-label').textContent = modeLabel;
    this.el('game-timer').textContent = timerText;
    this.el('game-counter').textContent = counterText;
    this.el('problem-desc').textContent = problem.description;
    const d = problem.difficulty || 1;
    this.el('game-difficulty').innerHTML = Array.from({length: 5}, (_, i) => `<span class="${i < d ? 'd-active' : ''}">★</span>`).join('');

    const searchHL = this._getSearchHighlights(engine);
    this._renderBuffer(this.el('editor'), engine.buffer, engine.cursor, engine.getVisualSelection(), null, null, searchHL);
    this._renderBuffer(this.el('target-editor'), problem.targetBuffer, null, null, problem.targetCursorPos, engine.buffer, null);

    const mode = engine.mode;
    const mi = this.el('mode-indicator');
    mi.className = '';
    if (mode === 'VISUAL_BLOCK') { mi.textContent = 'V-BLOCK'; mi.classList.add('visual'); }
    else {
      mi.textContent = mode;
      if (mode === 'INSERT' || mode === 'REPLACE') mi.classList.add('insert');
      else if (mode === 'VISUAL' || mode === 'VISUAL_LINE') mi.classList.add('visual');
      else if (mode === 'COMMAND') mi.classList.add('command');
    }

    this.el('keystroke-bar').innerHTML = keystrokes.map(k => `<span class="key-chip">${this._esc(this._kd(k))}</span>`).join('');

    const co = this.el('command-overlay');
    if (mode === 'COMMAND') {
      co.classList.remove('hidden');
      co.querySelector('.cmd-prefix').textContent = engine._searchMode ? (engine._searchForward !== false ? '/' : '?') : ':';
      this.el('command-text').textContent = engine.commandBuffer;
    } else co.classList.add('hidden');

    const rec = engine.macroRecording ? ` recording @${engine.macroRecording}` : '';
    const hints = {
      NORMAL: `Tab→skip  :q→quit  Ctrl-g→solution  i a o  d c y  w b e f  / * n  q @  m '  gcc${rec}`,
      INSERT: 'type to insert · Esc or jk → normal · Alt-j/k move lines',
      VISUAL: 'd c y > <  motions extend · Esc → normal',
      VISUAL_LINE: 'd c y > <  j k extend · Esc → normal',
      VISUAL_BLOCK: 'd c y  I A  motions extend · Esc → normal',
      REPLACE: 'type to overwrite · Esc → normal',
      COMMAND: 'type command · Enter execute · Esc cancel'
    };
    this.el('mode-hints').textContent = hints[mode] || '';
  }

  _renderBuffer(container, buffer, cursor, visualRange, targetCursor, diffAgainst, searchHL) {
    let html = '';
    const matchSet = new Set();
    const subInserts = {};
    if (searchHL?.matches) {
      for (const m of searchHL.matches) {
        for (let c = m.col; c < m.col + m.len; c++) matchSet.add(m.row * 1e6 + c);
        if (searchHL.isSub && searchHL.replacement !== null) {
          const repText = searchHL.replacement.replace(/\\([/])/g, '$1');
          if (!subInserts[m.row]) subInserts[m.row] = [];
          subInserts[m.row].push({ afterCol: m.col + m.len - 1, text: repText });
        }
      }
    }
    for (let row = 0; row < buffer.length; row++) {
      const line = buffer[row], ln = `<span class="line-num">${String(row + 1).padStart(2)}</span>`;
      const hl = this._syntaxHL(line);
      let chars = '';
      const maxCol = cursor ? line.length : line.length - 1;
      let lineCls = 'editor-line';
      if (diffAgainst) {
        if (row >= diffAgainst.length) lineCls += ' target-line-added';
        else if (diffAgainst[row] !== line) lineCls += ' target-line-diff';
      }
      const rowInserts = subInserts[row] || [];
      for (let col = 0; col <= maxCol; col++) {
        const ch = col < line.length ? this._esc(line[col]) : ' ';
        const cls = [];
        if (cursor && row === cursor.row && col === cursor.col) cls.push('char-cursor');
        if (targetCursor && row === targetCursor.row && col === targetCursor.col) cls.push('char-target-cursor');
        if (visualRange) {
          if (visualRange.blockwise) {
            if (row >= visualRange.startRow && row <= visualRange.endRow && col >= visualRange.startCol && col <= visualRange.endCol && col < line.length) cls.push('char-visual');
          } else if (this._inVis(row, col, visualRange) && col < line.length) cls.push('char-visual');
        }
        const isMatch = matchSet.has(row * 1e6 + col);
        if (isMatch && searchHL.isSub && searchHL.replacement !== null) cls.push('sub-old');
        else if (isMatch) cls.push('search-match');
        if (cls.length) chars += `<span class="${cls.join(' ')}">${ch}</span>`;
        else if (col < line.length) chars += hl[col] || ch;
        else if (cursor && row === cursor.row && col === cursor.col) chars += `<span class="char-cursor"> </span>`;
        for (const ins of rowInserts) {
          if (ins.afterCol === col) chars += `<span class="sub-new">${this._esc(ins.text)}</span>`;
        }
      }
      html += `<span class="${lineCls}">${ln}${chars}</span>\n`;
    }
    container.innerHTML = html;
  }

  _syntaxHL(line) {
    const r = {}, rules = [
      { re: /\/\/.*/g, c: 'syn-comment' },
      { re: /#\s*(?:include|define|ifdef|ifndef|endif|pragma|if|elif|else|undef)\b.*/g, c: 'syn-preproc' },
      { re: /(["'`])(?:(?!\1|\\).|\\.)*\1/g, c: 'syn-str' },
      { re: /<[a-zA-Z0-9_/.]+>/g, c: 'syn-str' },
      { re: /\b(true|false|nullptr|NULL|None|nil)\b/g, c: 'syn-bool' },
      { re: /\b(std|cout|cin|cerr|endl|string|vector|map|set|pair|array|list|queue|stack|deque|unordered_map|unordered_set|unique_ptr|shared_ptr|make_unique|make_shared|optional|variant|tuple|move|forward|begin|end|size|push_back|emplace_back|insert|erase|find|sort|swap|min|max|abs|pow|sqrt|printf|scanf|malloc|free|sizeof|static_cast|dynamic_cast|reinterpret_cast|const_cast)\b/g, c: 'syn-ns' },
      { re: /\b(int|float|double|char|bool|void|long|short|unsigned|signed|size_t|auto|string|std::string|wchar_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|ptrdiff_t|ssize_t)\b/g, c: 'syn-type' },
      { re: /\b(function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|class|struct|enum|union|namespace|using|typedef|typename|template|public|private|protected|virtual|override|final|static|inline|constexpr|consteval|constinit|extern|mutable|volatile|explicit|friend|operator|throw|try|catch|noexcept|delete|new|import|export|def|fn|pub|async|await|self|this|super|yield|lambda|co_await|co_return|co_yield|concept|requires|module)\b/g, c: 'syn-kw' },
      { re: /\b[a-zA-Z_]\w*(?=\s*\()/g, c: 'syn-func' },
      { re: /\b\d+\.?\d*[fFuUlL]?\b/g, c: 'syn-num' },
      { re: /0x[0-9a-fA-F]+/g, c: 'syn-num' },
      { re: /#\w+/g, c: 'syn-preproc' },
    ];
    const used = new Set();
    for (const rule of rules) { let m; rule.re.lastIndex = 0; while ((m = rule.re.exec(line)) !== null) { let skip = false; for (let i = m.index; i < m.index + m[0].length; i++) if (used.has(i)) { skip = true; break; } if (skip) continue; for (let i = m.index; i < m.index + m[0].length; i++) { used.add(i); r[i] = `<span class="${rule.c}">${this._esc(line[i])}</span>`; } } }
    return r;
  }

  _inVis(row, col, range) {
    if (!range) return false;
    if (range.linewise) return row >= range.start.row && row <= range.end.row;
    const p = row * 1e5 + col; return p >= range.start.row * 1e5 + range.start.col && p <= range.end.row * 1e5 + range.end.col;
  }

  _getSearchHighlights(engine) {
    let pattern = '', replacement = null, isGlobal = false, isSub = false;
    let startR = 0, endR = engine.buffer.length - 1;

    if (engine.mode === 'COMMAND') {
      if (engine._searchMode) {
        pattern = engine.commandBuffer;
      } else {
        const m = engine.commandBuffer.match(/^(%)?s\/((?:[^\\\/]|\\.)*)(?:\/((?:[^\\\/]|\\.)*)(?:\/(g?))?)?$/);
        if (m) {
          if (m[1] === '%') { startR = 0; endR = engine.buffer.length - 1; }
          else { startR = engine.cursor.row; endR = engine.cursor.row; }
          pattern = m[2]; replacement = m[3] ?? null; isGlobal = m[4] === 'g'; isSub = true;
        }
      }
    } else if (engine.searchPattern) {
      pattern = engine.searchPattern;
    }
    if (!pattern) return null;
    let re;
    try { re = new RegExp(pattern, 'g'); } catch { try { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); } catch { return null; } }
    const matches = [];
    const sr = isSub ? startR : 0, er = isSub ? endR : engine.buffer.length - 1;
    for (let r = sr; r <= er; r++) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(engine.buffer[r])) !== null) {
        matches.push({ row: r, col: m.index, len: m[0].length, text: m[0] });
        if (!isGlobal && isSub) break;
        if (m[0].length === 0) { re.lastIndex++; if (re.lastIndex > engine.buffer[r].length) break; }
      }
    }
    return { matches, replacement, isSub };
  }

  _esc(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }
  _kd(k) { return k === 'Escape' ? 'Esc' : k === 'Enter' ? 'Ret' : k === 'Backspace' ? 'Bksp' : k === ' ' ? 'Spc' : k === 'Tab' ? 'Tab' : k.startsWith('Alt-') ? `A-${k.slice(4)}` : k.startsWith('Ctrl-') ? `C-${k.slice(5)}` : k; }

  showInlineFeedback(problem, userKeys, timeMs) {
    const opt = problem.optimalKeystrokes, uc = userKeys.length, oc = opt.length;
    const eff = Math.round((oc / Math.max(1, uc)) * 100);
    let bc, bt;
    if (uc <= oc) { bc = 'optimal'; bt = 'Optimal'; } else if (uc <= oc + 2) { bc = 'close'; bt = 'Close'; } else { bc = 'inefficient'; bt = 'Inefficient'; }
    const el = this.el('inline-feedback');
    el.innerHTML = `
      <div class="feed-badge ${bc}">${bt}</div>
      <div class="feed-stats">
        <div><span class="feed-stat-val">${uc}</span> yours</div>
        <div><span class="feed-stat-val">${oc}</span> optimal</div>
        <div><span class="feed-stat-val">${eff}%</span> eff</div>
        <div><span class="feed-stat-val">${(timeMs/1000).toFixed(1)}s</span></div>
      </div>
      <div class="feed-keys">
        <div class="feed-keys-col"><div class="feed-keys-label">You</div><div class="feed-keys-row">${userKeys.map(k => `<span class="key-chip">${this._esc(this._kd(k))}</span>`).join('')}</div></div>
        <div class="feed-keys-col"><div class="feed-keys-label">Optimal</div><div class="feed-keys-row">${opt.map(k => `<span class="key-chip" style="color:var(--correct)">${this._esc(this._kd(k))}</span>`).join('')}</div></div>
      </div>
      <div class="feed-auto">auto-advancing...</div>`;
    el.classList.remove('hidden');
  }

  hideInlineFeedback() { this.el('inline-feedback').classList.add('hidden'); }

  // ── Results Screen ──────────────────────────────────────
  renderResults(session) {
    const ae = Math.round(session.avgEfficiency * 100), at = (session.avgTime / 1000).toFixed(1);
    const op = Math.round((session.optimalCount / Math.max(1, session.problemsCompleted)) * 100);
    let catHtml = '';
    if (session.categoryBreakdown) for (const [cat, s] of Object.entries(session.categoryBreakdown)) {
      const eff = Math.round((s.totalOptimal / Math.max(1, s.totalKeystrokes)) * 100);
      catHtml += `<div class="results-cat-row"><span class="results-cat-name">${cat}</span><div class="results-cat-bar-bg"><div class="results-cat-bar-fill" style="width:${eff}%"></div></div><span class="results-cat-pct">${eff}%</span></div>`;
    }
    const worst = session.worstCategory ? `<div class="results-worst">Weakest: <strong>${session.worstCategory}</strong></div>` : '';
    this.screens.results.innerHTML = `<div class="fade-in" style="display:flex;flex-direction:column;align-items:center;gap:24px;">
      <div class="results-title">Session Complete</div>
      <div class="results-grid">
        <div><div class="results-stat-val">${session.problemsCompleted}</div><div class="results-stat-label">Problems</div></div>
        <div><div class="results-stat-val">${ae}%</div><div class="results-stat-label">Efficiency</div></div>
        <div><div class="results-stat-val">${at}s</div><div class="results-stat-label">Avg Time</div></div>
        <div><div class="results-stat-val">${op}%</div><div class="results-stat-label">Optimal</div></div>
        <div><div class="results-stat-val">${session.totalKeystrokes}</div><div class="results-stat-label">Keystrokes</div></div>
        <div><div class="results-stat-val">${session.streak}</div><div class="results-stat-label">Streak</div></div>
      </div>
      ${catHtml ? `<div class="results-categories"><div class="results-cat-title">Category Breakdown</div>${catHtml}</div>` : ''}
      ${worst}
      <div class="results-actions">
        <button class="btn-primary" id="btn-play-again">Play Again (r)</button>
        <button class="btn-primary" id="btn-home">Home (Esc)</button>
        <button class="btn-primary" id="btn-copy-results">Copy Results</button>
      </div>
      <div class="results-hints">Enter or r &rarr; play again &nbsp; s &rarr; stats &nbsp; Esc &rarr; home</div>
    </div>`;
    document.getElementById('btn-play-again').addEventListener('click', () => this._onResultsAction?.('again'));
    document.getElementById('btn-home').addEventListener('click', () => this._onResultsAction?.('home'));
    document.getElementById('btn-copy-results').addEventListener('click', () => {
      const text = `Vim Golf | ${session.mode}\nProblems: ${session.problemsCompleted} | Efficiency: ${ae}% | Optimal: ${op}%\nAvg time: ${at}s | Keystrokes: ${session.totalKeystrokes}${session.worstCategory ? '\nWeakest: ' + session.worstCategory : ''}`;
      navigator.clipboard?.writeText(text).then(() => { document.getElementById('btn-copy-results').textContent = 'Copied!'; setTimeout(() => document.getElementById('btn-copy-results').textContent = 'Copy Results', 2000); });
    });
  }

  // ── Stats Screen ────────────────────────────────────────
  renderStats(o) {
    const fmtTime = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
    const compRate = o.testsStarted > 0 ? Math.round((o.testsCompleted / o.testsStarted) * 100) : 0;
    const optRate = o.totalProblems > 0 ? Math.round((o.totalOptimal / o.totalProblems) * 100) : 0;

    let html = `<div class="fade-in" style="display:flex;flex-direction:column;gap:16px;">
      <div class="stats-header"><div class="stats-title">Statistics</div><div class="stats-hints">Esc or q &rarr; back &nbsp; e &rarr; export &nbsp; i &rarr; import</div></div>

      <div class="stats-section">
        <div class="stats-section-title">Overview</div>
        <div class="stats-grid-4">
          <div class="stat-block"><div class="stat-val">${o.testsStarted}</div><div class="stat-label">Started</div></div>
          <div class="stat-block"><div class="stat-val">${o.testsCompleted}</div><div class="stat-label">Completed</div></div>
          <div class="stat-block"><div class="stat-val">${compRate}%</div><div class="stat-label">Comp. Rate</div></div>
          <div class="stat-block"><div class="stat-val">${fmtTime(o.totalTypingTime)}</div><div class="stat-label">Time Spent</div></div>
        </div>
        <div class="stats-grid-4" style="margin-top:8px;">
          <div class="stat-block"><div class="stat-val">${o.streak.current}</div><div class="stat-label">Streak</div></div>
          <div class="stat-block"><div class="stat-val">${o.streak.best}</div><div class="stat-label">Best Streak</div></div>
          <div class="stat-block"><div class="stat-val">${o.totalProblems}</div><div class="stat-label">Solved</div></div>
          <div class="stat-block"><div class="stat-val">${optRate}%</div><div class="stat-label">Optimal Rate</div></div>
        </div>
      </div>

      <div class="stats-section">
        <div class="stats-section-title">Performance</div>
        <div class="stats-grid-4">
          <div class="stat-block"><div class="stat-val-sm">${Math.round(o.bestEff * 100)}%</div><div class="stat-label">Best Eff.</div></div>
          <div class="stat-block"><div class="stat-val-sm">${Math.round(o.avgEffAll * 100)}%</div><div class="stat-label">Avg Eff.</div></div>
          <div class="stat-block"><div class="stat-val-sm">${Math.round(o.avgEff10 * 100)}%</div><div class="stat-label">Avg Eff. L10</div></div>
          <div class="stat-block"><div class="stat-val-sm">${(o.bestAvgTime / 1000).toFixed(1)}s</div><div class="stat-label">Best Avg Time</div></div>
        </div>
        <div class="stats-grid-4" style="margin-top:6px;">
          <div class="stat-block"><div class="stat-val-sm">${(o.avgTimeAll / 1000).toFixed(1)}s</div><div class="stat-label">Avg Time</div></div>
          <div class="stat-block"><div class="stat-val-sm">${(o.avgTime10 / 1000).toFixed(1)}s</div><div class="stat-label">Avg Time L10</div></div>
          <div class="stat-block"><div class="stat-val-sm">${o.totalKeystrokesAllTime}</div><div class="stat-label">Total Keys</div></div>
          <div class="stat-block"><div class="stat-val-sm">${Math.round(o.avgKeystrokesPerProblem)}</div><div class="stat-label">Keys/Problem</div></div>
        </div>
      </div>`;

    // Personal Bests
    const modes = ['timed-30','timed-60','timed-120','count-10','count-25','count-50'];
    html += `<div class="stats-section"><div class="stats-section-title">Personal Bests</div><div class="stats-bests-grid">`;
    for (const mode of modes) {
      const b = o.bests[mode];
      if (b) {
        const d = new Date(b.date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
        html += `<div class="stats-best-cell"><div class="sbc-mode">${mode}</div><div class="sbc-val">${Math.round(b.avgEfficiency * 100)}%</div><div class="sbc-date">${b.problemsCompleted} solved &middot; ${d}</div></div>`;
      } else {
        html += `<div class="stats-best-cell empty"><div class="sbc-mode">${mode}</div><div class="sbc-val">&mdash;</div><div class="sbc-date">untested</div></div>`;
      }
    }
    html += `</div></div>`;

    // Efficiency Chart (Canvas-based)
    const recent = o.recentSessions;
    html += `<div class="stats-section"><div class="stats-section-title">Efficiency Trend (last ${recent.length} sessions)</div><div id="chart-efficiency-container"></div></div>`;

    // We'll mount the canvas chart after innerHTML is set
    this._pendingCharts = { efficiency: recent };

    // Activity Heatmap
    html += `<div class="stats-section"><div class="stats-section-title">Activity (last 12 weeks)</div><div class="stats-heatmap">`;
    const cal = o.activityCalendar || {};
    const cellSize = 11, gap = 2, labelW = 16;
    const today = new Date(); today.setHours(0,0,0,0);
    const todayDay = today.getDay();
    const daysBack = 12 * 7 - 1 + todayDay;
    const dayLabels = ['','M','','W','','F',''];
    let cells = dayLabels.map((l, i) => l ? `<text x="0" y="${i * (cellSize + gap) + cellSize - 1}" fill="var(--faint)" font-size="7" font-family="var(--font-mono)">${l}</text>` : '').join('');
    for (let i = daysBack; i >= 0; i--) {
      const date = new Date(today); date.setDate(date.getDate() - i);
      const ds = date.toISOString().slice(0, 10);
      const cnt = cal[ds] || 0;
      const daysSinceStart = daysBack - i;
      const col = Math.floor(daysSinceStart / 7), row = daysSinceStart % 7;
      const x = labelW + col * (cellSize + gap), y = row * (cellSize + gap);
      const fill = cnt === 0 ? 'var(--surface)' : cnt <= 5 ? 'rgba(196,167,231,0.25)' : cnt <= 15 ? 'rgba(196,167,231,0.5)' : cnt <= 30 ? 'rgba(196,167,231,0.75)' : 'var(--accent)';
      cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fill}"><title>${ds}: ${cnt} problems</title></rect>`;
    }
    const hmW = labelW + 13 * (cellSize + gap), hmH = 7 * (cellSize + gap);
    html += `<svg viewBox="0 0 ${hmW} ${hmH}" style="width:100%;max-width:${hmW}px;height:auto;">${cells}</svg>`;
    html += `</div></div>`;

    // Category Mastery
    const allCats = ['deletion','change','insert','navigation','yank','visual','compound','macro','search','marks','registers'];
    const catEntries = allCats.map(cat => {
      const s = o.categoryStats[cat];
      const optPct = s ? Math.round((s.optimalCount / Math.max(1, s.attempts)) * 100) : 0;
      const avgKs = s ? Math.round(s.totalKeystrokes / Math.max(1, s.attempts)) : 0;
      const avgOpt = s ? Math.round(s.totalOptimal / Math.max(1, s.attempts)) : 0;
      return { cat, s, optPct, avgKs, avgOpt };
    }).sort((a, b) => a.optPct - b.optPct);

    html += `<div class="stats-section"><div class="stats-section-title">Category Mastery (sorted by weakness)</div>`;
    for (const { cat, s, optPct, avgKs, avgOpt } of catEntries) {
      html += `<div class="stats-cat-row"><span class="stats-cat-name">${cat}</span><div class="stats-cat-bar"><div class="stats-cat-fill" style="width:${optPct}%"></div></div><span class="stats-cat-pct">${s ? optPct + '%' : '&mdash;'}</span><span class="stats-cat-meta">${s ? `${s.attempts} att &middot; ${avgKs}/${avgOpt} k` : ''}</span></div>`;
    }
    html += `</div>`;

    // Command Frequency
    const cmdFreq = o.commandFrequency || {};
    const topCmds = Object.entries(cmdFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);
    if (topCmds.length > 0) {
      const maxFreq = topCmds[0][1];
      html += `<div class="stats-section"><div class="stats-section-title">Most Used Commands</div><div style="display:flex;flex-wrap:wrap;gap:6px;">`;
      for (const [cmd, count] of topCmds) {
        const pct = Math.round((count / maxFreq) * 100);
        const esc = cmd.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        html += `<div style="background:rgba(196,167,231,${Math.max(0.15, pct / 100)});padding:3px 8px;border-radius:4px;font-family:var(--font);font-size:12px;"><span style="color:var(--accent);font-weight:bold;">${esc}</span> <span style="color:var(--faint);">${count}</span></div>`;
      }
      html += `</div></div>`;
    }

    // Session History
    const histSessions = [...recent].reverse().slice(0, 30);
    if (histSessions.length > 0) {
      html += `<div class="stats-section"><div class="stats-section-title">Session History</div><div class="stats-sessions-table">`;
      html += `<div class="st-header"><span class="st-cell">date</span><span class="st-cell">mode</span><span class="st-cell">eff%</span><span class="st-cell">avg time</span><span class="st-cell">solved</span><span class="st-cell">optimal%</span></div>`;
      for (const s of histSessions) {
        const d = new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
        const eff = Math.round((s.avgEfficiency || 0) * 100);
        const at = (s.avgTime / 1000).toFixed(1);
        const op = Math.round((s.optimalCount / Math.max(1, s.problemsCompleted)) * 100);
        html += `<div class="st-row"><span class="st-cell">${d}</span><span class="st-cell">${s.mode}</span><span class="st-cell">${eff}%</span><span class="st-cell">${at}s</span><span class="st-cell">${s.problemsCompleted}</span><span class="st-cell">${op}%</span></div>`;
      }
      html += `</div></div>`;
    }

    html += `</div>`;
    this.screens.stats.innerHTML = html;

    // Mount canvas charts
    if (this._pendingCharts && recent.length >= 2) {
      if (!this._chartRenderer) this._chartRenderer = new ChartRenderer();
      const effContainer = this.screens.stats.querySelector('#chart-efficiency-container');
      if (effContainer) {
        effContainer.appendChild(this._chartRenderer.render(recent));
      }
    }
  }

  renderStreak(s) { this.el('streak-display').textContent = s.current > 0 ? `${s.current} day streak` : ''; }

  renderMuteButton(muted) {
    return `<button class="mute-toggle" title="${muted ? 'Unmute' : 'Mute'}" aria-label="${muted ? 'Unmute sounds' : 'Mute sounds'}">${muted ? '🔇' : '🔊'}</button>`;
  }
}

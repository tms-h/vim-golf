import { VimEngine } from './engine.js';
import { ProblemGenerator } from './problems.js';
import { StatsManager } from './stats.js';
import { UIRenderer } from './ui.js';
import { AudioManager } from './audio.js';

export class App {
  constructor() {
    this.engine = new VimEngine();
    this.generator = new ProblemGenerator();
    this.renderer = new UIRenderer();
    this.stats = new StatsManager();
    this.audio = new AudioManager();
    this.state = 'START';
    this.startSubmenu = null;
    this.helpVisible = false;
    this.sessionMode = null; this.sessionVal = null;
    this.currentProblem = null; this.userKeystrokes = [];
    this.problemStartTime = 0; this.sessionProblems = [];
    this.timerInterval = null; this.timeRemaining = 0;
    this.problemsRemaining = 0; this.optimalStreak = 0;
    this._feedbackTimer = null;
    this.currentDifficulty = 1;
    this.practiceCategories = ['deletion','change','insert','navigation','yank','visual','compound','macro','search','marks','registers'];
    this.practiceKeys = { d:'deletion', c:'change', i:'insert', n:'navigation', y:'yank', v:'visual', o:'compound', m:'macro', '/':'search', k:'marks', r:'registers' };

    document.addEventListener('keydown', e => this._onKeyDown(e));
    document.getElementById('btn-quit').addEventListener('click', () => { if (this.state === 'PLAYING' || this.state === 'FEEDBACK') this._endSession(); });

    this.renderer._onResultsAction = (action) => {
      if (action === 'again') this._startSession(this.sessionMode, this.sessionVal);
      if (action === 'home') { this.state = 'START'; this.startSubmenu = null; this.renderer.renderStartMenu(null, this.practiceCategories); this.renderer.showScreen('start'); }
    };

    this._fontSize = parseInt(localStorage.getItem('vim-golf:font-size') || '16', 10);
    document.documentElement.style.fontSize = this._fontSize + 'px';
    document.getElementById('btn-font-up').addEventListener('click', () => this._changeFontSize(1));
    document.getElementById('btn-font-down').addEventListener('click', () => this._changeFontSize(-1));

    this._renderMuteBtn();

    this.renderer.renderStreak(this.stats.data.streak);
    this.renderer.renderStartMenu(null, this.practiceCategories);
    this._attachMenuClickHandlers();
    this.renderer.showScreen('start');
  }

  _changeFontSize(delta) {
    this._fontSize = Math.max(10, Math.min(24, this._fontSize + delta));
    document.documentElement.style.fontSize = this._fontSize + 'px';
    localStorage.setItem('vim-golf:font-size', String(this._fontSize));
  }

  _renderMuteBtn() {
    let btn = document.getElementById('btn-mute');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-mute';
      btn.className = 'font-size-btn';
      btn.style.cssText = 'font-size:14px;';
      document.querySelector('.font-size-controls').appendChild(btn);
    }
    btn.textContent = this.audio.muted ? '\u{1F507}' : '\u{1F50A}';
    btn.title = this.audio.muted ? 'Unmute' : 'Mute';
    btn.onclick = () => { this.audio.toggle(); this._renderMuteBtn(); };
  }

  _attachMenuClickHandlers() {
    const menu = document.getElementById('term-menu');
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.term-item');
      if (!item) return;
      const action = item.dataset.action;
      if (!action) return;
      if (action === 'timed') { this.startSubmenu = 'timed'; this.renderer.renderStartMenu('timed', this.practiceCategories); }
      else if (action === 'count') { this.startSubmenu = 'count'; this.renderer.renderStartMenu('count', this.practiceCategories); }
      else if (action === 'practice') { this.startSubmenu = 'practice'; this.renderer.renderStartMenu('practice', this.practiceCategories); }
      else if (action === 'stats') { this.state = 'STATS'; this.renderer.renderStats(this.stats.getOverview()); this.renderer.showScreen('stats'); }
      else if (action === 'help') { this.helpVisible = true; this.renderer.renderHelp(true); }
      else if (action.startsWith('timed-')) { this._startSession('timed', action.split('-')[1]); }
      else if (action.startsWith('count-')) { this._startSession('count', action.split('-')[1]); }
      else if (action.startsWith('pdiff-')) { const parts = action.split('-'); const cat = parts.slice(1, -1).join('-'); const dl = parseInt(parts[parts.length - 1]); const ranges = { 1: [1, 2], 2: [3], 3: [4, 5], 0: null }; this._startSession('practice', cat, ranges[dl]); }
      else if (action.startsWith('practice-')) { const cat = action.replace('practice-', ''); this.startSubmenu = 'practice-diff:' + cat; this._practiceDiffCat = cat; this.renderer.renderStartMenu('practice-diff:' + cat, this.practiceCategories); }
    });
  }

  _startSession(mode, val, diffRange) {
    this.sessionMode = mode; this.sessionVal = val; this.practiceDiffRange = diffRange || null;
    this.sessionProblems = []; this.optimalStreak = 0; this.state = 'PLAYING';
    this.startSubmenu = null;
    this.currentDifficulty = 1;
    this.stats.recordSessionStart();
    if (mode === 'timed') { this.timeRemaining = parseInt(val, 10); this.problemsRemaining = Infinity; this._startTimer(); }
    else if (mode === 'count') { this.problemsRemaining = parseInt(val, 10); this.timeRemaining = Infinity; }
    else { this.problemsRemaining = Infinity; this.timeRemaining = Infinity; }
    this._nextProblem(); this.renderer.showScreen('game');
  }

  _startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.state === 'PLAYING') this._renderGame();
      if (this.timeRemaining <= 0) { clearInterval(this.timerInterval); this.timerInterval = null; this._endSession(); }
    }, 1000);
  }

  _nextProblem() {
    this.renderer.hideInlineFeedback();
    let difficulty;
    if (this.sessionMode === 'practice') {
      if (this.practiceDiffRange) {
        const range = this.practiceDiffRange;
        difficulty = range[Math.floor(Math.random() * range.length)];
      } else {
        difficulty = null;
      }
    } else {
      difficulty = this.stats.getAdaptiveDifficulty(this.sessionProblems, this.currentDifficulty);
    }
    const problem = this.sessionMode === 'practice' ? this.generator.generate(this.sessionVal, difficulty) : this.generator.generateWeighted(this.stats.getWeakCategories(), difficulty);
    this.currentProblem = problem; this.userKeystrokes = []; this.problemStartTime = Date.now();
    this.engine.loadBuffer(problem.initialBuffer.map(l => l), { ...problem.cursorPos });
    this._renderGame();
  }

  _onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); this._changeFontSize(1); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); this._changeFontSize(-1); return; }
    switch (this.state) {
      case 'START': this._handleStartKey(e); return;
      case 'STATS': this._handleStatsKey(e); return;
      case 'RESULTS': this._handleResultsKey(e); return;
      case 'PLAYING': this._handlePlayingKey(e); return;
      case 'REPLAY': this._handleReplayKey(e); return;
      case 'FEEDBACK': e.preventDefault(); this._dismissFeedback(); return;
    }
  }

  _handleStartKey(e) {
    const key = e.key;
    if (this.helpVisible) {
      if (key === '?' || key === 'Escape') { this.helpVisible = false; this.renderer.renderHelp(false); }
      e.preventDefault(); return;
    }
    if (!this.startSubmenu) {
      if (key === 't') { e.preventDefault(); this.startSubmenu = 'timed'; this.renderer.renderStartMenu('timed', this.practiceCategories); return; }
      if (key === 'c') { e.preventDefault(); this.startSubmenu = 'count'; this.renderer.renderStartMenu('count', this.practiceCategories); return; }
      if (key === 'p') { e.preventDefault(); this.startSubmenu = 'practice'; this.renderer.renderStartMenu('practice', this.practiceCategories); return; }
      if (key === 's') { e.preventDefault(); this.state = 'STATS'; this.renderer.renderStats(this.stats.getOverview()); this.renderer.showScreen('stats'); return; }
      if (key === '?') { e.preventDefault(); this.helpVisible = true; this.renderer.renderHelp(true); return; }
    } else {
      e.preventDefault();
      if (key === 'Escape') {
        if (this.startSubmenu && this.startSubmenu.startsWith('practice-diff:')) { this.startSubmenu = 'practice'; this.renderer.renderStartMenu('practice', this.practiceCategories); return; }
        this.startSubmenu = null; this.renderer.renderStartMenu(null, this.practiceCategories); return;
      }
      if (this.startSubmenu === 'timed') {
        if (key === '1') { this._startSession('timed', '30'); return; }
        if (key === '2') { this._startSession('timed', '60'); return; }
        if (key === '3') { this._startSession('timed', '120'); return; }
      }
      if (this.startSubmenu === 'count') {
        if (key === '1') { this._startSession('count', '10'); return; }
        if (key === '2') { this._startSession('count', '25'); return; }
        if (key === '3') { this._startSession('count', '50'); return; }
      }
      if (this.startSubmenu === 'practice') {
        const cat = this.practiceKeys[key];
        if (cat) { this.startSubmenu = 'practice-diff:' + cat; this._practiceDiffCat = cat; this.renderer.renderStartMenu('practice-diff:' + cat, this.practiceCategories); return; }
      }
      if (this.startSubmenu && this.startSubmenu.startsWith('practice-diff:')) {
        const cat = this._practiceDiffCat;
        if (key === '1') { this._startSession('practice', cat, [1, 2]); return; }
        if (key === '2') { this._startSession('practice', cat, [3]); return; }
        if (key === '3') { this._startSession('practice', cat, [4, 5]); return; }
        if (key === '4') { this._startSession('practice', cat, null); return; }
      }
    }
  }

  _handleStatsKey(e) {
    if (e.key === 'Escape' || e.key === 'q') {
      e.preventDefault();
      this.state = 'START';
      this.startSubmenu = null;
      this.renderer.renderStartMenu(null, this.practiceCategories);
      this.renderer.showScreen('start');
    }
    if (e.key === 'e') {
      e.preventDefault();
      const json = this.stats.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vim-golf-stats.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
    if (e.key === 'i') {
      e.preventDefault();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            this.stats.importData(reader.result);
            this.renderer.renderStats(this.stats.getOverview());
          } catch (err) { console.error('Import failed:', err); }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  }

  _handleResultsKey(e) {
    e.preventDefault();
    if (e.key === 'Enter' || e.key === 'r') { this._startSession(this.sessionMode, this.sessionVal); return; }
    if (e.key === 's') { this.state = 'STATS'; this.renderer.renderStats(this.stats.getOverview()); this.renderer.showScreen('stats'); return; }
    if (e.key === 'Escape') { this.state = 'START'; this.startSubmenu = null; this.renderer.renderStartMenu(null, this.practiceCategories); this.renderer.showScreen('start'); return; }
  }

  _handlePlayingKey(e) {
    e.preventDefault();
    const key = this._normalizeKey(e);
    if (!key) return;

    if (key === 'Tab' && this.engine.mode === 'NORMAL' && !this.engine.pending.operator && !this.engine.pending.awaitingChar) {
      this._nextProblem(); return;
    }

    if (key === 'Escape' && this.engine.mode === 'NORMAL' && !this.engine.pending.operator && !this.engine.pending.g && !this.engine.pending.awaitingChar) {
      return;
    }

    if (key === 'Ctrl-g' && this.engine.mode === 'NORMAL' && !this.engine.pending.operator && !this.engine.pending.awaitingChar) {
      this._showSolutionReplay(); return;
    }

    this.userKeystrokes.push(key);
    this.stats.recordCommand(key);
    this.engine.processKey(key);
    this.audio.keystroke();
    if (this.engine._quitRequested) { this.engine._quitRequested = false; this._endSession(); return; }
    if (this.engine._saveRequested) {
      this.engine._saveRequested = false;
      // Show a brief "already saved" hint in the mode hints
      const hints = document.getElementById('mode-hints');
      if (hints) { hints.textContent = '"already saved" — this is vim golf!'; setTimeout(() => this._renderGame(), 1500); }
    }
    this._renderGame();
    this._checkCompletion();
  }

  _normalizeKey(e) {
    if (e.ctrlKey && e.key === 'a') return 'Ctrl-a';
    if (e.ctrlKey && e.key === 'x') return 'Ctrl-x';
    if (e.ctrlKey && e.key === 'v') return 'Ctrl-v';
    if (e.ctrlKey && e.key === 'r') return 'Ctrl-r';
    if (e.ctrlKey && e.key === 'd') return 'Ctrl-d';
    if (e.ctrlKey && e.key === 'u') return 'Ctrl-u';
    if (e.ctrlKey && e.key === 'o') return 'Ctrl-o';
    if (e.ctrlKey && e.key === 'g') return 'Ctrl-g';
    if (e.ctrlKey && e.key === 'w') return 'Ctrl-w';
    if (e.ctrlKey && e.key === 'h') return 'Ctrl-h';
    if (e.ctrlKey && e.key === 'j') return 'Ctrl-j';
    if (e.ctrlKey && e.key === 'k') return 'Ctrl-k';
    if (e.key === 'Escape') return 'Escape';
    if (e.key === 'Enter') return 'Enter';
    if (e.key === 'Backspace') return 'Backspace';
    if (e.key === 'Tab') return 'Tab';
    if (e.key === ' ') return ' ';
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) return e.key;
    return null;
  }

  _checkCompletion() {
    const target = this.currentProblem.targetBuffer, current = this.engine.buffer;
    const bm = current.length === target.length && current.every((l, i) => l === target[i]);
    if (this.currentProblem.targetCursorPos) {
      if (!bm || this.engine.cursor.row !== this.currentProblem.targetCursorPos.row || this.engine.cursor.col !== this.currentProblem.targetCursorPos.col) return;
    } else if (!bm) return;
    if (this.engine.mode !== 'NORMAL') return;

    const timeMs = Date.now() - this.problemStartTime;
    const optimal = this.currentProblem.optimalKeystrokes;
    const isOptimal = this.userKeystrokes.length <= optimal.length;
    if (isOptimal) this.optimalStreak++; else { this.optimalStreak = 0; this.currentDifficulty = Math.max(1, this.currentDifficulty - 1); }

    if (isOptimal) {
      this.audio.optimalSolve();
    } else {
      this.audio.inefficientSolve();
    }

    const result = { category: this.currentProblem.category, difficulty: this.currentProblem.difficulty, keystrokes: this.userKeystrokes.length, optimal: optimal.length, time: timeMs, isOptimal };
    this.sessionProblems.push(result);
    this.stats.recordProblem(result);
    if (this.sessionMode === 'count') this.problemsRemaining--;

    if (this.sessionMode === 'timed') {
      this._nextProblem();
    } else {
      this.state = 'FEEDBACK';
      this.renderer.showInlineFeedback(this.currentProblem, this.userKeystrokes, timeMs);
      this._feedbackTimer = setTimeout(() => {
        this._feedbackTimer = null;
        this.renderer.hideInlineFeedback();
        if (this.problemsRemaining <= 0) { this._endSession(); return; }
        this.state = 'PLAYING';
        this._nextProblem();
      }, 2000);
    }
  }

  _showSolutionReplay() {
    this.state = 'REPLAY';
    const problem = this.currentProblem;
    const keys = problem.optimalKeystrokes;
    this._replayEngine = new VimEngine();
    this._replayEngine.loadBuffer(problem.initialBuffer.map(l => l), { ...problem.cursorPos });
    this._replayStep = 0;
    this._replayKeys = keys;
    this._replayKeysShown = [];
    this._renderReplay();
  }

  _renderReplay() {
    const shown = this._replayKeysShown;
    const total = this._replayKeys.length;
    const step = this._replayStep;
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const keyDisplay = shown.map((k, i) => `<span class="${i === shown.length - 1 ? 'replay-key-current' : 'replay-key'}">${esc(k)}</span>`).join(' ');
    const info = `<div class="replay-bar">Solution: ${keyDisplay} <span class="replay-counter">${step}/${total}</span></div><div class="replay-hint">Enter &rarr; step &nbsp; Space &rarr; play all &nbsp; Esc &rarr; skip</div>`;
    const eng = this._replayEngine;
    const timer = this.sessionMode === 'timed' ? `${this.timeRemaining}s` : '';
    const counter = `#${this.sessionProblems.length + 1}`;
    const label = this.sessionMode === 'practice' ? `Practice: ${this.sessionVal}` : `${this.sessionMode} ${this.sessionVal}`;
    this.renderer.renderGame(eng, this.currentProblem, shown, timer, counter, label);
    document.querySelector('.replay-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'replay-overlay';
    overlay.innerHTML = info;
    document.getElementById('screen-game').appendChild(overlay);
  }

  _handleReplayKey(e) {
    e.preventDefault();
    if (e.key === 'Escape') {
      if (this._replayAutoTimer) { clearInterval(this._replayAutoTimer); this._replayAutoTimer = null; }
      document.querySelector('.replay-overlay')?.remove();
      this.state = 'PLAYING';
      this._nextProblem();
      return;
    }
    if (e.key === 'Enter') {
      if (this._replayStep < this._replayKeys.length) {
        const k = this._replayKeys[this._replayStep];
        this._replayEngine.processKey(k);
        this._replayKeysShown.push(k);
        this._replayStep++;
        this._renderReplay();
      }
      return;
    }
    if (e.key === ' ') {
      if (this._replayAutoTimer) return;
      this._replayAutoTimer = setInterval(() => {
        if (this._replayStep >= this._replayKeys.length) {
          clearInterval(this._replayAutoTimer); this._replayAutoTimer = null; return;
        }
        const k = this._replayKeys[this._replayStep];
        this._replayEngine.processKey(k);
        this._replayKeysShown.push(k);
        this._replayStep++;
        this._renderReplay();
      }, 300);
      return;
    }
  }

  _dismissFeedback() {
    if (this._feedbackTimer) { clearTimeout(this._feedbackTimer); this._feedbackTimer = null; }
    this.renderer.hideInlineFeedback();
    if (this.problemsRemaining <= 0) { this._endSession(); return; }
    this.state = 'PLAYING';
    this._nextProblem();
  }

  _endSession() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    if (this._feedbackTimer) { clearTimeout(this._feedbackTimer); this._feedbackTimer = null; }
    this.renderer.hideInlineFeedback();
    this.state = 'RESULTS';

    const problems = this.sessionProblems;
    const totalKeystrokes = problems.reduce((s, p) => s + p.keystrokes, 0);
    const totalOptimal = problems.reduce((s, p) => s + p.optimal, 0);
    const avgEfficiency = totalOptimal / Math.max(1, totalKeystrokes);
    const totalTime = problems.reduce((s, p) => s + p.time, 0);
    const avgTime = problems.length ? totalTime / problems.length : 0;
    const optimalCount = problems.filter(p => p.isOptimal).length;

    const catBreakdown = {};
    for (const p of problems) { const cb = catBreakdown[p.category] ??= { totalKeystrokes: 0, totalOptimal: 0, count: 0 }; cb.totalKeystrokes += p.keystrokes; cb.totalOptimal += p.optimal; cb.count++; }

    let worstCat = null, worstEff = Infinity;
    for (const [cat, s] of Object.entries(catBreakdown)) { const eff = s.totalOptimal / Math.max(1, s.totalKeystrokes); if (eff < worstEff) { worstEff = eff; worstCat = cat; } }

    const session = { date: new Date().toISOString(), mode: `${this.sessionMode}-${this.sessionVal}`, problemsCompleted: problems.length, totalKeystrokes, totalOptimal, avgEfficiency, avgTime, totalTime, optimalCount, streak: this.optimalStreak, categoryBreakdown: catBreakdown, worstCategory: worstCat };
    this.stats.endSession(session);
    this.renderer.renderResults(session);
    this.renderer.showScreen('results');
  }

  _renderGame() {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      if (this.state !== 'PLAYING' && this.state !== 'REPLAY') return;
      const timer = this.sessionMode === 'timed' ? `${this.timeRemaining}s` : '';
      const counter = this.sessionMode === 'count' ? `${this.sessionProblems.length + 1}/${this.sessionProblems.length + this.problemsRemaining}` : `#${this.sessionProblems.length + 1}`;
      const label = this.sessionMode === 'practice' ? `Practice: ${this.sessionVal}` : `${this.sessionMode} ${this.sessionVal}${this.sessionMode === 'timed' ? 's' : ''}`;
      const eng = this.state === 'REPLAY' ? this._replayEngine : this.engine;
      this.renderer.renderGame(eng, this.currentProblem, this.state === 'REPLAY' ? this._replayKeysShown : this.userKeystrokes, timer, counter, label);
    });
  }
}

// ── Boot ──────────────────────────────────────────────────
const app = new App();

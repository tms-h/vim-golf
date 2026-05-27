export class StatsManager {
  constructor() { this.data = this._load(); }

  _load() {
    try {
      const d = JSON.parse(localStorage.getItem('vim-golf:data'));
      if (d?.version >= 1) {
        if (!d.testsStarted) d.testsStarted = d.sessions?.length || 0;
        if (!d.testsCompleted) d.testsCompleted = d.sessions?.length || 0;
        if (!d.totalTypingTime) d.totalTypingTime = 0;
        if (!d.totalKeystrokesAllTime) d.totalKeystrokesAllTime = 0;
        if (!d.activityCalendar) d.activityCalendar = {};
        d.version = 2;
        return d;
      }
    } catch {}
    return { version: 2, sessions: [], categoryStats: {}, streak: { current: 0, best: 0, lastDate: null }, bests: {}, testsStarted: 0, testsCompleted: 0, totalTypingTime: 0, totalKeystrokesAllTime: 0, activityCalendar: {} };
  }

  save() { try { localStorage.setItem('vim-golf:data', JSON.stringify(this.data)); } catch {} }

  recordSessionStart() {
    this.data.testsStarted++;
    this.save();
  }

  recordProblem(r) {
    const cs = this.data.categoryStats[r.category] ??= { attempts: 0, optimalCount: 0, totalKeystrokes: 0, totalOptimal: 0, totalTime: 0 };
    cs.attempts++; cs.totalKeystrokes += r.keystrokes; cs.totalOptimal += r.optimal;
    cs.totalTime = (cs.totalTime || 0) + (r.time || 0);
    if (r.keystrokes <= r.optimal) cs.optimalCount++;
  }

  recordCommand(key) {
    if (!this.data.commandFrequency) this.data.commandFrequency = {};
    this.data.commandFrequency[key] = (this.data.commandFrequency[key] || 0) + 1;
  }

  exportData() { return JSON.stringify(this.data, null, 2); }

  importData(json) {
    try {
      const d = JSON.parse(json);
      if (d?.version) { this.data = d; this.save(); return true; }
    } catch {}
    return false;
  }

  resetData() {
    this.data = { version: 2, sessions: [], categoryStats: {}, streak: { current: 0, best: 0, lastDate: null }, bests: {}, testsStarted: 0, testsCompleted: 0, totalTypingTime: 0, totalKeystrokesAllTime: 0, activityCalendar: {}, commandFrequency: {} };
    this.save();
  }

  endSession(session) {
    this.data.testsCompleted++;
    this.data.sessions.push(session);
    if (this.data.sessions.length > 200) this.data.sessions = this.data.sessions.slice(-200);

    this.data.totalTypingTime += session.totalTime || 0;
    this.data.totalKeystrokesAllTime += session.totalKeystrokes || 0;

    const today = new Date().toISOString().slice(0, 10);
    this.data.activityCalendar[today] = (this.data.activityCalendar[today] || 0) + session.problemsCompleted;

    const last = this.data.streak.lastDate;
    if (last !== today) {
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      this.data.streak.current = last === yesterday ? this.data.streak.current + 1 : 1;
      this.data.streak.lastDate = today;
      this.data.streak.best = Math.max(this.data.streak.best, this.data.streak.current);
    }
    const key = session.mode;
    const prev = this.data.bests[key];
    if (!prev || session.avgEfficiency > prev.avgEfficiency) this.data.bests[key] = { avgEfficiency: session.avgEfficiency, problemsCompleted: session.problemsCompleted, date: session.date };
    this.save();
  }

  getCategoryWeights() {
    const w = {};
    for (const cat of ['deletion','change','insert','navigation','yank','visual','compound','macro','search','marks','registers']) {
      const cs = this.data.categoryStats[cat];
      w[cat] = (!cs || cs.attempts === 0) ? 1.5 : 1 / ((cs.totalOptimal / Math.max(1, cs.totalKeystrokes)) + .1);
    }
    return w;
  }

  getOverview() {
    const cs = this.data.categoryStats;
    let tp = 0, to = 0, tk = 0, topt = 0;
    for (const cat in cs) { tp += cs[cat].attempts; to += cs[cat].optimalCount; tk += cs[cat].totalKeystrokes; topt += cs[cat].totalOptimal; }
    const recent = this.data.sessions.slice(-50);
    const recent10 = this.data.sessions.slice(-10);
    const avgEffAll = tk > 0 ? topt / tk : 0;
    const avgEff10 = recent10.length ? recent10.reduce((s, x) => s + (x.avgEfficiency || 0), 0) / recent10.length : 0;
    let weightedTimeSum = 0;
    for (const s of this.data.sessions) weightedTimeSum += (s.avgTime || 0) * (s.problemsCompleted || 0);
    const avgTimeAll = tp > 0 ? weightedTimeSum / tp : 0;
    const avgTime10 = recent10.length ? recent10.reduce((s, x) => s + (x.avgTime || 0), 0) / recent10.length : 0;
    let bestEff = 0, bestAvgTime = Infinity;
    for (const s of this.data.sessions) {
      if ((s.avgEfficiency || 0) > bestEff) bestEff = s.avgEfficiency;
      if (s.avgTime > 0 && s.avgTime < bestAvgTime) bestAvgTime = s.avgTime;
    }
    if (bestAvgTime === Infinity) bestAvgTime = 0;
    return {
      totalProblems: tp, totalOptimal: to, streak: this.data.streak,
      recentSessions: recent, categoryStats: cs, bests: this.data.bests,
      testsStarted: this.data.testsStarted, testsCompleted: this.data.testsCompleted,
      totalTypingTime: this.data.totalTypingTime, totalKeystrokesAllTime: this.data.totalKeystrokesAllTime,
      avgEffAll, avgEff10, avgTimeAll, avgTime10, bestEff, bestAvgTime,
      avgKeystrokesPerProblem: tp > 0 ? tk / tp : 0,
      activityCalendar: this.data.activityCalendar,
      commandFrequency: this.data.commandFrequency || {}
    };
  }

  getAdaptiveDifficulty(recentProblems, currentDifficulty) {
    if (recentProblems.length < 5) return currentDifficulty;

    // Calculate rolling average efficiency over last N problems
    const window = Math.min(10, recentProblems.length);
    const recent = recentProblems.slice(-window);
    const avgEff = recent.reduce((s, p) => s + (p.optimal / Math.max(1, p.keystrokes)), 0) / window;

    // Adjust difficulty based on rolling efficiency
    if (avgEff >= 0.9) return Math.min(5, currentDifficulty + 1);
    if (avgEff >= 0.7) return currentDifficulty;
    if (avgEff >= 0.5) return Math.max(1, currentDifficulty - 1);
    return Math.max(1, currentDifficulty - 2);
  }

  getWeakCategories() {
    // Returns categories sorted by weakness (least practiced or lowest efficiency)
    const cats = ['deletion','change','insert','navigation','yank','visual','compound','macro','search','marks','registers'];
    const now = Date.now();
    const weights = {};

    for (const cat of cats) {
      const cs = this.data.categoryStats[cat];
      if (!cs || cs.attempts === 0) {
        weights[cat] = 3.0; // never practiced = highest weight
        continue;
      }
      const eff = cs.totalOptimal / Math.max(1, cs.totalKeystrokes);
      // Lower efficiency = higher weight
      const effWeight = 1 / (eff + 0.1);
      // Less recently practiced = higher weight (check last session with this category)
      const recency = this._getRecencyWeight(cat);
      weights[cat] = effWeight * recency;
    }

    return weights;
  }

  _getRecencyWeight(cat) {
    // Check how recently this category was practiced
    const sessions = this.data.sessions;
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].categoryBreakdown && sessions[i].categoryBreakdown[cat]) {
        const ago = sessions.length - 1 - i;
        return 1 + (ago / sessions.length) * 0.5; // slight boost for less recent
      }
    }
    return 1.5; // never seen in sessions
  }
}

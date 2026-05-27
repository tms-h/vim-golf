export class VimEngine {
  constructor() { this._init(); }

  _init() {
    this.buffer = [''];
    this.cursor = { row: 0, col: 0 };
    this.mode = 'NORMAL';
    this.register = '';
    this.registerLinewise = false;
    this.pending = { count: '', operator: null, textObjType: null, awaitingChar: null, g: false, namedReg: null };
    this.visualAnchor = null;
    this.lastFind = null;
    this.commandBuffer = '';
    this._dotKeys = [];
    this._lastDot = [];
    this._dotActive = false;
    this._dotDirty = false;
    this._replayDepth = 0;
    this._insertJPending = false;
    this._undoStack = [];
    this._redoStack = [];
    this._undoCheckpoint = null;
    this.macroRecording = null;
    this.macroBuffer = [];
    this.macroRegisters = {};
    this.lastMacroReg = null;
    this.searchPattern = '';
    this.searchDirection = 1;
    this._searchMode = false;
    this.marks = {};
    this.namedRegisters = {};
    this._vbPending = null;
  }

  loadBuffer(lines, cursor) {
    this._init();
    this.buffer = lines.map(l => l);
    this.cursor = { row: cursor.row, col: cursor.col };
    this._clampCursor();
  }

  processKey(key) {
    if (this.macroRecording && this._replayDepth === 0) {
      this.macroBuffer.push(key);
    }

    if (this._replayDepth === 0) {
      if (this.mode === 'NORMAL' && !this._dotActive &&
          this.pending.count === '' && !this.pending.operator &&
          !this.pending.awaitingChar && !this.pending.g && !this.pending.textObjType) {
        this._dotKeys = [];
        this._dotActive = true;
        this._dotDirty = false;
        this._undoCheckpoint = { buffer: this.buffer.map(l => l), cursor: { ...this.cursor } };
      }
      if (this._dotActive) this._dotKeys.push(key);
    }

    switch (this.mode) {
      case 'NORMAL': this._handleNormal(key); break;
      case 'INSERT': this._handleInsert(key); break;
      case 'REPLACE': this._handleReplace(key); break;
      case 'VISUAL': case 'VISUAL_LINE': case 'VISUAL_BLOCK': this._handleVisual(key); break;
      case 'COMMAND': this._handleCommand(key); break;
    }

    if (this._replayDepth === 0 && this._dotActive && this.mode === 'NORMAL' &&
        this.pending.count === '' && !this.pending.operator &&
        !this.pending.awaitingChar && !this.pending.g && !this.pending.textObjType) {
      if (this._dotDirty) this._lastDot = [...this._dotKeys];
      this._dotActive = false;
      this._undoCheckpoint = null;
    }

    if (this._insertOneShotArmed && this.mode === 'NORMAL') {
      this._insertOneShotArmed = false;
      this._insertOneShot = true;
    } else if (this._insertOneShot && this.mode === 'NORMAL' &&
        this.pending.count === '' && !this.pending.operator &&
        !this.pending.awaitingChar && !this.pending.g) {
      this._insertOneShot = false;
      this.mode = 'INSERT';
    }
  }

  _markDirty() {
    this._dotDirty = true;
    this._redoStack = [];
    if (this._undoCheckpoint) {
      this._undoStack.push(this._undoCheckpoint);
      this._undoCheckpoint = null;
      if (this._undoStack.length > 100) this._undoStack.shift();
    }
  }

  _undo() {
    if (this._undoStack.length === 0) return;
    this._redoStack.push({ buffer: this.buffer.map(l => l), cursor: { ...this.cursor } });
    const s = this._undoStack.pop();
    this.buffer = s.buffer;
    this.cursor = s.cursor;
    this._clampCursor();
  }

  _redo() {
    if (this._redoStack.length === 0) return;
    this._undoStack.push({ buffer: this.buffer.map(l => l), cursor: { ...this.cursor } });
    const s = this._redoStack.pop();
    this.buffer = s.buffer;
    this.cursor = s.cursor;
    this._clampCursor();
  }

  _charClass(ch) {
    if (!ch || /\s/.test(ch)) return 'space';
    if (/[a-zA-Z0-9_]/.test(ch)) return 'word';
    return 'punct';
  }

  _firstNonBlank(row) {
    const m = (this.buffer[row] || '').match(/\S/);
    return m ? (this.buffer[row] || '').indexOf(m[0]) : 0;
  }

  _clampCursor() {
    this.cursor.row = Math.max(0, Math.min(this.cursor.row, this.buffer.length - 1));
    const len = this.buffer[this.cursor.row].length;
    this.cursor.col = this.mode === 'INSERT'
      ? Math.max(0, Math.min(this.cursor.col, len))
      : Math.max(0, Math.min(this.cursor.col, Math.max(0, len - 1)));
  }

  _getCount() {
    const c = parseInt(this.pending.count, 10);
    return (isNaN(c) || c < 1) ? 1 : c;
  }

  _clearPending() {
    this.pending = { count: '', operator: null, textObjType: null, awaitingChar: null, g: false, namedReg: null };
  }

  // ── Normal Mode ─────────────────────────────────────────
  _handleNormal(key) {
    if (this.pending.awaitingChar) { this._resolveAwaitingChar(key); return; }
    if (this.pending.textObjType) { this._resolveTextObject(key); return; }

    if (this.macroRecording && key === 'q' && !this.pending.operator && !this.pending.g && !this.pending.textObjType) {
      this.macroRegisters[this.macroRecording] = this.macroBuffer.slice(0, -1);
      this.macroRecording = null;
      this.macroBuffer = [];
      this._clearPending();
      return;
    }

    if (this.pending.g) {
      this.pending.g = false;
      if (key === 'g') {
        const count = this._getCount();
        this.cursor.row = this.pending.count !== '' ? Math.min(count - 1, this.buffer.length - 1) : 0;
        this.cursor.col = this._firstNonBlank(this.cursor.row);
        this._clampCursor(); this._clearPending(); return;
      }
      if (key === '~') {
        const line = this.buffer[this.cursor.row];
        let swapped = '';
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          swapped += ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
        }
        this.buffer[this.cursor.row] = swapped;
        this._markDirty(); this._clearPending(); return;
      }
      if (key === 'U' || key === 'u') {
        this.pending.operator = key === 'U' ? 'gU' : 'gu';
        return;
      }
      if (key === 'c') {
        this.pending.operator = 'gc';
        return;
      }
      this._clearPending(); return;
    }

    if ((key >= '1' && key <= '9') || (key === '0' && this.pending.count.length > 0)) {
      this.pending.count += key; return;
    }

    if (this.pending.operator === 'gc' && key === 'c') {
      this._toggleCommentLines(this.cursor.row, this.cursor.row + this._getCount() - 1);
      this._clearPending(); return;
    }

    if ('dcy><'.includes(key)) {
      if (this.pending.operator === key) {
        this._operateOnLines(key, this._getCount()); this._clearPending(); return;
      }
      if (this.pending.operator) { this._clearPending(); return; }
      this.pending.operator = key; return;
    }

    if (this.pending.operator && (key === 'i' || key === 'a')) {
      this.pending.textObjType = key; return;
    }
    if ('fFtT'.includes(key)) { this.pending.awaitingChar = key; return; }
    if (key === 'r') { this.pending.awaitingChar = 'r'; return; }
    if (key === 'g') { this.pending.g = true; return; }
    if (key === 'q') { this.pending.awaitingChar = 'q_rec'; return; }
    if (key === '@') { this.pending.awaitingChar = '@_play'; return; }
    if (key === 'm') { this.pending.awaitingChar = 'm_set'; return; }
    if (key === "'") { this.pending.awaitingChar = "'_jump"; return; }
    if (key === '`') { this.pending.awaitingChar = '`_jump'; return; }
    if (key === '"') { this.pending.awaitingChar = '"_reg'; return; }
    if (key === '/') { this.mode = 'COMMAND'; this.commandBuffer = ''; this._searchMode = true; this._searchForward = true; return; }
    if (key === '?') { this.mode = 'COMMAND'; this.commandBuffer = ''; this._searchMode = true; this._searchForward = false; return; }

    let motion = this._tryMotion(key);
    if (motion && this.pending.operator === 'c' && (key === 'w' || key === 'W')) {
      motion = this._tryMotion(key === 'w' ? 'e' : 'E');
    }
    if (motion) {
      if (this.pending.operator) {
        this._applyOperator(this.pending.operator, this._motionToRange(motion));
        if (this.pending.namedReg && (this.pending.operator === 'd' || this.pending.operator === 'c' || this.pending.operator === 'y')) {
          this.namedRegisters[this.pending.namedReg] = { text: this.register, linewise: this.registerLinewise };
        }
      } else {
        this.cursor = { row: motion.row, col: motion.col };
        this._clampCursor();
      }
      this._clearPending(); return;
    }
    this._handleSimpleCommand(key);
    this._clearPending();
  }

  // ── Insert Mode ─────────────────────────────────────────
  _handleInsert(key) {
    if (key === 'Escape') { this._exitInsert(); return; }
    if (key === 'Ctrl-o') { this._insertOneShotArmed = true; this.mode = 'NORMAL'; return; }

    if (this._insertJPending) {
      this._insertJPending = false;
      if (key === 'k') {
        const line = this.buffer[this.cursor.row];
        this.buffer[this.cursor.row] = line.slice(0, this.cursor.col - 1) + line.slice(this.cursor.col);
        this.cursor.col--;
        if (this._vbPending && this._vbPending.text.length > 0) {
          this._vbPending.text = this._vbPending.text.slice(0, -1);
        }
        this._exitInsert(); return;
      }
    }

    if (key === 'Ctrl-j') { this._moveLineDown(); this._markDirty(); return; }
    if (key === 'Ctrl-k') { this._moveLineUp(); this._markDirty(); return; }

    // Ctrl-h: alias for Backspace
    if (key === 'Ctrl-h') {
      if (this.cursor.col > 0) {
        const l = this.buffer[this.cursor.row];
        this.buffer[this.cursor.row] = l.slice(0, this.cursor.col - 1) + l.slice(this.cursor.col);
        this.cursor.col--; this._markDirty();
        if (this._vbPending && this._vbPending.text.length > 0) {
          this._vbPending.text = this._vbPending.text.slice(0, -1);
        }
      } else if (this.cursor.row > 0) {
        const prev = this.buffer[this.cursor.row - 1].length;
        this.buffer[this.cursor.row - 1] += this.buffer[this.cursor.row];
        this.buffer.splice(this.cursor.row, 1);
        this.cursor.row--; this.cursor.col = prev; this._markDirty();
      }
      return;
    }

    // Ctrl-w: delete word backward
    if (key === 'Ctrl-w') {
      const line = this.buffer[this.cursor.row];
      if (this.cursor.col > 0) {
        let c = this.cursor.col;
        // Skip trailing whitespace
        while (c > 0 && /\s/.test(line[c - 1])) c--;
        // Delete back through word characters of the same class
        if (c > 0) {
          const cls = this._charClass(line[c - 1]);
          while (c > 0 && this._charClass(line[c - 1]) === cls) c--;
        }
        this.buffer[this.cursor.row] = line.slice(0, c) + line.slice(this.cursor.col);
        this.cursor.col = c;
        this._markDirty();
      }
      return;
    }

    if (key === 'Backspace') {
      if (this.cursor.col > 0) {
        const l = this.buffer[this.cursor.row];
        this.buffer[this.cursor.row] = l.slice(0, this.cursor.col - 1) + l.slice(this.cursor.col);
        this.cursor.col--; this._markDirty();
        if (this._vbPending && this._vbPending.text.length > 0) {
          this._vbPending.text = this._vbPending.text.slice(0, -1);
        }
      } else if (this.cursor.row > 0) {
        const prev = this.buffer[this.cursor.row - 1].length;
        this.buffer[this.cursor.row - 1] += this.buffer[this.cursor.row];
        this.buffer.splice(this.cursor.row, 1);
        this.cursor.row--; this.cursor.col = prev; this._markDirty();
      }
      return;
    }

    if (key === 'Enter') {
      const l = this.buffer[this.cursor.row];
      this.buffer[this.cursor.row] = l.slice(0, this.cursor.col);
      this.buffer.splice(this.cursor.row + 1, 0, l.slice(this.cursor.col));
      this.cursor.row++; this.cursor.col = 0; this._markDirty(); return;
    }

    if (key === 'Tab') {
      const l = this.buffer[this.cursor.row];
      this.buffer[this.cursor.row] = l.slice(0, this.cursor.col) + '  ' + l.slice(this.cursor.col);
      this.cursor.col += 2; this._markDirty(); return;
    }

    if (key.length === 1) {
      const l = this.buffer[this.cursor.row];
      this.buffer[this.cursor.row] = l.slice(0, this.cursor.col) + key + l.slice(this.cursor.col);
      this.cursor.col++; this._markDirty();
      if (key === 'j') this._insertJPending = true;
      if (this._vbPending) this._vbPending.text += key;
    }
  }

  _exitInsert() {
    this.mode = 'NORMAL'; this._insertJPending = false;
    if (this._vbPending) {
      const vb = this._vbPending;
      this._vbPending = null;
      if (vb.text) {
        for (let r = vb.startRow + 1; r <= Math.min(vb.endRow, this.buffer.length - 1); r++) {
          const line = this.buffer[r];
          if (vb.type === 'I') {
            const col = Math.min(vb.startCol, line.length);
            this.buffer[r] = line.slice(0, col) + vb.text + line.slice(col);
          } else {
            this.buffer[r] = line + vb.text;
          }
        }
      }
      this._markDirty();
    }
    if (this.cursor.col > 0) this.cursor.col--;
    this._clampCursor();
  }

  // ── Replace Mode ────────────────────────────────────────
  _handleReplace(key) {
    if (key === 'Escape') { this.mode = 'NORMAL'; if (this.cursor.col > 0) this.cursor.col--; this._clampCursor(); return; }
    if (key === 'Backspace') { if (this.cursor.col > 0) this.cursor.col--; return; }
    if (key.length === 1) {
      const l = this.buffer[this.cursor.row];
      if (this.cursor.col < l.length) {
        this.buffer[this.cursor.row] = l.slice(0, this.cursor.col) + key + l.slice(this.cursor.col + 1);
      } else {
        this.buffer[this.cursor.row] = l + key;
      }
      this.cursor.col++;
      this._markDirty();
    }
  }

  // ── Visual Mode ─────────────────────────────────────────
  _handleVisual(key) {
    if (key === 'Escape' || (key === 'v' && this.mode === 'VISUAL') || (key === 'V' && this.mode === 'VISUAL_LINE') || (key === 'Ctrl-v' && this.mode === 'VISUAL_BLOCK')) {
      this.mode = 'NORMAL'; this.visualAnchor = null; this._clearPending(); return;
    }
    if (key === 'v') { this.mode = 'VISUAL'; return; }
    if (key === 'V') { this.mode = 'VISUAL_LINE'; return; }
    if (key === 'Ctrl-v') { this.mode = 'VISUAL_BLOCK'; return; }

    if (this.mode === 'VISUAL_BLOCK' && (key === 'I' || key === 'A')) {
      const range = this._getVisualBlockRange();
      if (range) {
        this._vbPending = { type: key, startRow: range.startRow, endRow: range.endRow, startCol: range.startCol, endCol: range.endCol, text: '' };
        if (key === 'I') {
          this.cursor = { row: range.startRow, col: range.startCol };
        } else {
          this.cursor = { row: range.startRow, col: this.buffer[range.startRow].length };
        }
        this._clampCursor();
        this.mode = 'INSERT';
        this.visualAnchor = null;
        this._markDirty();
      }
      return;
    }

    if (key === 'U' || key === 'u') {
      const range = this.mode === 'VISUAL_BLOCK' ? this._getVisualBlockRange() : this._getVisualRange();
      if (range) this._caseRange(range, key === 'U');
      this.mode = 'NORMAL'; this.visualAnchor = null; this._clearPending(); return;
    }

    if (this.pending.g) {
      this.pending.g = false;
      if (key === 'c') {
        const range = this.mode === 'VISUAL_BLOCK' ? this._getVisualBlockRange() : this._getVisualRange();
        if (range) this._toggleCommentLines(range.start?.row ?? range.startRow, range.end?.row ?? range.endRow);
        this.mode = 'NORMAL'; this.visualAnchor = null; this._clearPending(); return;
      }
      this._clearPending(); return;
    }
    if (key === 'g') { this.pending.g = true; return; }

    if ('dcy><'.includes(key)) {
      if (this.mode === 'VISUAL_BLOCK') {
        const range = this._getVisualBlockRange();
        if (range) this._applyBlockOperator(key, range);
      } else {
        const range = this._getVisualRange();
        if (range) this._applyOperator(key, range);
      }
      if (key === '>' || key === '<') return;
      if (key !== 'c') { this.mode = 'NORMAL'; this.visualAnchor = null; }
      this._clearPending(); return;
    }

    if (key === 'o' && this.visualAnchor) {
      const tmp = { ...this.cursor }; this.cursor = { ...this.visualAnchor }; this.visualAnchor = tmp; return;
    }
    if (key === 'Ctrl-j') { this._moveLineDown(); this._markDirty(); return; }
    if (key === 'Ctrl-k') { this._moveLineUp(); this._markDirty(); return; }

    const motion = this._tryMotion(key);
    if (motion) { this.cursor = { row: motion.row, col: motion.col }; this._clampCursor(); }
  }

  _getVisualRange() {
    if (!this.visualAnchor) return null;
    const a = this.visualAnchor, c = this.cursor;
    if (this.mode === 'VISUAL_LINE') {
      const s = Math.min(a.row, c.row), e = Math.max(a.row, c.row);
      return { start: { row: s, col: 0 }, end: { row: e, col: this.buffer[e].length }, linewise: true, inclusive: true };
    }
    const [start, end] = (a.row < c.row || (a.row === c.row && a.col <= c.col)) ? [{ ...a }, { ...c }] : [{ ...c }, { ...a }];
    return { start, end, linewise: false, inclusive: true };
  }

  _getVisualBlockRange() {
    if (!this.visualAnchor) return null;
    const a = this.visualAnchor, c = this.cursor;
    return { startRow: Math.min(a.row, c.row), endRow: Math.max(a.row, c.row), startCol: Math.min(a.col, c.col), endCol: Math.max(a.col, c.col), blockwise: true };
  }

  getVisualSelection() {
    if (this.mode === 'VISUAL_BLOCK') return this._getVisualBlockRange();
    if (this.mode !== 'VISUAL' && this.mode !== 'VISUAL_LINE') return null;
    return this._getVisualRange();
  }

  // ── Command Mode ────────────────────────────────────────
  _handleCommand(key) {
    if (key === 'Escape') { this.mode = 'NORMAL'; this.commandBuffer = ''; this._searchMode = false; return; }
    if (key === 'Enter') {
      if (this._searchMode) this._executeSearch(this.commandBuffer);
      else this._executeCommand(this.commandBuffer);
      this.mode = 'NORMAL'; this.commandBuffer = ''; this._searchMode = false; return;
    }
    if (key === 'Backspace') {
      if (this.commandBuffer.length > 0) this.commandBuffer = this.commandBuffer.slice(0, -1);
      else { this.mode = 'NORMAL'; this._searchMode = false; }
      return;
    }
    if (key.length === 1) this.commandBuffer += key;
  }

  _executeCommand(cmd) {
    // :w / :write / :w! / :write! — set save-requested flag
    if (/^w(?:rite)?!?$/.test(cmd.trim())) {
      this._saveRequested = true;
      return;
    }

    const rangeM = cmd.match(/^(%|(\d+),(\d+))s\/((?:[^\\\/]|\\.)*)\\?\/((?:[^\\\/]|\\.)*)(?:\/(g?))?$/);
    if (rangeM) {
      const search = rangeM[4], replace = rangeM[5], global = rangeM[6] === 'g';
      let startR, endR;
      if (rangeM[1] === '%') { startR = 0; endR = this.buffer.length - 1; }
      else { startR = Math.max(0, parseInt(rangeM[2], 10) - 1); endR = Math.min(this.buffer.length - 1, parseInt(rangeM[3], 10) - 1); }
      for (let r = startR; r <= endR; r++) this.buffer[r] = this._subLine(this.buffer[r], search, replace, global);
      this._markDirty(); this._clampCursor(); return;
    }
    const m = cmd.match(/^s\/((?:[^\\\/]|\\.)*)\\?\/((?:[^\\\/]|\\.)*)(?:\/(g?))?$/);
    if (m) {
      this.buffer[this.cursor.row] = this._subLine(this.buffer[this.cursor.row], m[1], m[2], m[3] === 'g');
      this._markDirty();
    } else if (/^(q|quit|qa|q!)$/.test(cmd.trim())) {
      this._quitRequested = true;
    } else {
      const lineNum = parseInt(cmd, 10);
      if (!isNaN(lineNum)) {
        this.cursor.row = Math.max(0, Math.min(lineNum - 1, this.buffer.length - 1));
        this.cursor.col = this._firstNonBlank(this.cursor.row);
      }
    }
    this._clampCursor();
  }

  _subLine(line, search, replace, global) {
    const sr = search.replace(/\\([/])/g, '$1'), rp = replace.replace(/\\([/])/g, '$1');
    try {
      const re = new RegExp(sr, global ? 'g' : '');
      return line.replace(re, rp);
    } catch {
      if (global) return line.split(sr).join(rp);
      const idx = line.indexOf(sr);
      if (idx !== -1) return line.slice(0, idx) + rp + line.slice(idx + sr.length);
      return line;
    }
  }

  _executeSearch(pattern) {
    if (!pattern) return;
    this.searchPattern = pattern;
    this.searchDirection = this._searchForward !== false ? 1 : -1;
    this._jumpToNextMatch(1);
  }

  _getSearchMatches() {
    if (!this.searchPattern) return [];
    let re;
    try { re = new RegExp(this.searchPattern, 'g'); } catch { try { re = new RegExp(this.searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); } catch { return []; } }
    const matches = [];
    for (let r = 0; r < this.buffer.length; r++) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(this.buffer[r])) !== null) {
        matches.push({ row: r, col: m.index });
        if (m[0].length === 0) { re.lastIndex++; if (re.lastIndex > this.buffer[r].length) break; }
      }
    }
    return matches;
  }

  _motionSearch(dir) {
    const matches = this._getSearchMatches();
    if (!matches.length) return null;
    const d = dir * this.searchDirection;
    const curPos = this.cursor.row * 100000 + this.cursor.col;
    if (d > 0) {
      const m = matches.find(m => m.row * 100000 + m.col > curPos);
      const t = m || matches[0];
      return { row: t.row, col: t.col, linewise: false, inclusive: false };
    }
    const rev = [...matches].reverse();
    const m = rev.find(m => m.row * 100000 + m.col < curPos);
    const t = m || matches[matches.length - 1];
    return { row: t.row, col: t.col, linewise: false, inclusive: false };
  }

  _jumpToNextMatch(dir) {
    const m = this._motionSearch(dir);
    if (m) { this.cursor = { row: m.row, col: m.col }; this._clampCursor(); }
    return m;
  }

  // ── Motions ─────────────────────────────────────────────
  _tryMotion(key) {
    const n = this._getCount();
    switch (key) {
      case 'h': return { row: this.cursor.row, col: Math.max(0, this.cursor.col - n), linewise: false, inclusive: false };
      case 'l': return { row: this.cursor.row, col: Math.min(Math.max(0, this.buffer[this.cursor.row].length - 1), this.cursor.col + n), linewise: false, inclusive: false };
      case 'j': return { row: Math.min(this.buffer.length - 1, this.cursor.row + n), col: this.cursor.col, linewise: true, inclusive: false };
      case 'k': return { row: Math.max(0, this.cursor.row - n), col: this.cursor.col, linewise: true, inclusive: false };
      case 'w': return this._motionW(n);
      case 'b': return this._motionB(n);
      case 'e': return this._motionE(n);
      case 'W': return this._motionBigW(n);
      case 'B': return this._motionBigB(n);
      case 'E': return this._motionBigE(n);
      case '0': return { row: this.cursor.row, col: 0, linewise: false, inclusive: false };
      case '^': return { row: this.cursor.row, col: this._firstNonBlank(this.cursor.row), linewise: false, inclusive: false };
      case '_': { const r = Math.min(this.buffer.length - 1, this.cursor.row + n - 1); return { row: r, col: this._firstNonBlank(r), linewise: true, inclusive: false }; }
      case '+': case 'Enter': { const r = Math.min(this.buffer.length - 1, this.cursor.row + n); return { row: r, col: this._firstNonBlank(r), linewise: true, inclusive: false }; }
      case '-': { const r = Math.max(0, this.cursor.row - n); return { row: r, col: this._firstNonBlank(r), linewise: true, inclusive: false }; }
      case '$': { const r = Math.min(this.buffer.length - 1, this.cursor.row + n - 1); return { row: r, col: Math.max(0, this.buffer[r].length - 1), linewise: false, inclusive: true }; }
      case '{': return this._motionPara(-1, n);
      case '}': return this._motionPara(1, n);
      case 'G': return this._motionG(n);
      case '%': return this._motionPercent();
      case 'H': return { row: 0, col: this._firstNonBlank(0), linewise: true, inclusive: false };
      case 'M': { const mid = Math.floor((this.buffer.length - 1) / 2); return { row: mid, col: this._firstNonBlank(mid), linewise: true, inclusive: false }; }
      case 'L': { const last = this.buffer.length - 1; return { row: last, col: this._firstNonBlank(last), linewise: true, inclusive: false }; }
      case ',': return this._repeatFind(true);
      case 'n': return this._motionSearch(1);
      case 'N': return this._motionSearch(-1);
    }
    return null;
  }

  _motionW(n) {
    let row = this.cursor.row, col = this.cursor.col;
    for (let i = 0; i < n; i++) {
      let line = this.buffer[row];
      if (col < line.length) { const cls = this._charClass(line[col]); if (cls !== 'space') while (col < line.length && this._charClass(line[col]) === cls) col++; }
      while (true) { line = this.buffer[row]; while (col < line.length && this._charClass(line[col]) === 'space') col++; if (col < line.length || row >= this.buffer.length - 1) break; row++; col = 0; }
    }
    return { row, col, linewise: false, inclusive: false };
  }

  _motionB(n) {
    let row = this.cursor.row, col = this.cursor.col;
    for (let i = 0; i < n; i++) {
      col--;
      while (true) { if (col < 0) { if (row <= 0) { col = 0; break; } row--; col = this.buffer[row].length - 1; continue; } if (this._charClass(this.buffer[row][col]) !== 'space') break; col--; }
      if (col >= 0) { const cls = this._charClass(this.buffer[row][col]); while (col > 0 && this._charClass(this.buffer[row][col - 1]) === cls) col--; }
      col = Math.max(0, col);
    }
    return { row, col, linewise: false, inclusive: false };
  }

  _motionE(n) {
    let row = this.cursor.row, col = this.cursor.col;
    for (let i = 0; i < n; i++) {
      col++;
      while (true) { const line = this.buffer[row]; if (col >= line.length) { if (row >= this.buffer.length - 1) { col = Math.max(0, line.length - 1); break; } row++; col = 0; continue; } if (this._charClass(line[col]) !== 'space') break; col++; }
      const line = this.buffer[row]; if (col < line.length) { const cls = this._charClass(line[col]); while (col < line.length - 1 && this._charClass(line[col + 1]) === cls) col++; }
    }
    return { row, col, linewise: false, inclusive: true };
  }

  _motionBigW(n) {
    let row = this.cursor.row, col = this.cursor.col;
    for (let i = 0; i < n; i++) {
      let line = this.buffer[row]; while (col < line.length && this._charClass(line[col]) !== 'space') col++;
      while (true) { line = this.buffer[row]; while (col < line.length && this._charClass(line[col]) === 'space') col++; if (col < line.length || row >= this.buffer.length - 1) break; row++; col = 0; }
    }
    return { row, col, linewise: false, inclusive: false };
  }

  _motionBigB(n) {
    let row = this.cursor.row, col = this.cursor.col;
    for (let i = 0; i < n; i++) {
      col--;
      while (true) { if (col < 0) { if (row <= 0) { col = 0; break; } row--; col = this.buffer[row].length - 1; continue; } if (this._charClass(this.buffer[row][col]) !== 'space') break; col--; }
      if (col >= 0) while (col > 0 && this._charClass(this.buffer[row][col - 1]) !== 'space') col--;
      col = Math.max(0, col);
    }
    return { row, col, linewise: false, inclusive: false };
  }

  _motionBigE(n) {
    let row = this.cursor.row, col = this.cursor.col;
    for (let i = 0; i < n; i++) {
      col++;
      while (true) { const line = this.buffer[row]; if (col >= line.length) { if (row >= this.buffer.length - 1) { col = Math.max(0, line.length - 1); break; } row++; col = 0; continue; } if (this._charClass(line[col]) !== 'space') break; col++; }
      const line = this.buffer[row]; if (col < line.length) while (col < line.length - 1 && this._charClass(line[col + 1]) !== 'space') col++;
    }
    return { row, col, linewise: false, inclusive: true };
  }

  _motionG(n) {
    if (this.pending.count !== '') { const r = Math.max(0, Math.min(n - 1, this.buffer.length - 1)); return { row: r, col: this._firstNonBlank(r), linewise: true, inclusive: false }; }
    const last = this.buffer.length - 1; return { row: last, col: this._firstNonBlank(last), linewise: true, inclusive: false };
  }

  _motionPara(dir, n) {
    let row = this.cursor.row;
    for (let i = 0; i < n; i++) { row += dir; while (row > 0 && row < this.buffer.length - 1 && this.buffer[row].trim() !== '') row += dir; }
    row = Math.max(0, Math.min(row, this.buffer.length - 1));
    return { row, col: 0, linewise: true, inclusive: false };
  }

  _motionPercent() {
    const line = this.buffer[this.cursor.row];
    const pairs = { '(': ')', ')': '(', '{': '}', '}': '{', '[': ']', ']': '[' };
    let ch = line[this.cursor.col], col = this.cursor.col;
    if (!pairs[ch]) { for (let c = col; c < line.length; c++) if (pairs[line[c]]) { ch = line[c]; col = c; break; } }
    if (!pairs[ch]) return null;
    const open = '({['.includes(ch), match = pairs[ch];
    let depth = 1, row = this.cursor.row, c = col;
    if (open) { c++; while (row < this.buffer.length) { const l = this.buffer[row]; while (c < l.length) { if (l[c] === ch) depth++; else if (l[c] === match) depth--; if (depth === 0) return { row, col: c, linewise: false, inclusive: true }; c++; } row++; c = 0; } }
    else { c--; while (row >= 0) { const l = this.buffer[row]; while (c >= 0) { if (l[c] === ch) depth++; else if (l[c] === match) depth--; if (depth === 0) return { row, col: c, linewise: false, inclusive: true }; c--; } row--; if (row >= 0) c = this.buffer[row].length - 1; } }
    return null;
  }

  _resolveAwaitingChar(key) {
    const type = this.pending.awaitingChar; this.pending.awaitingChar = null;
    if (type === 'r') { this._replaceChar(key); this._clearPending(); return; }
    if (type === 'q_rec') { if (/[a-z]/.test(key)) { this.macroRecording = key; this.macroBuffer = []; } this._clearPending(); return; }
    if (type === '@_play') {
      const n = this._getCount();
      const reg = key === '@' ? this.lastMacroReg : key;
      this._clearPending();
      if (reg && this.macroRegisters[reg]) { for (let i = 0; i < n; i++) this._playMacro(reg); }
      return;
    }
    if (type === 'm_set') { if (/[a-z]/.test(key)) this.marks[key] = { row: this.cursor.row, col: this.cursor.col }; this._clearPending(); return; }
    if (type === "'_jump") {
      if (this.marks[key]) {
        const m = { row: this.marks[key].row, col: this._firstNonBlank(this.marks[key].row), linewise: true, inclusive: false };
        if (this.pending.operator) this._applyOperator(this.pending.operator, this._motionToRange(m));
        else { this.cursor = { row: m.row, col: m.col }; this._clampCursor(); }
      }
      this._clearPending(); return;
    }
    if (type === '`_jump') {
      if (this.marks[key]) {
        const m = { row: this.marks[key].row, col: this.marks[key].col, linewise: false, inclusive: false };
        if (this.pending.operator) this._applyOperator(this.pending.operator, this._motionToRange(m));
        else { this.cursor = { row: m.row, col: m.col }; this._clampCursor(); }
      }
      this._clearPending(); return;
    }
    if (type === '"_reg') {
      if (/[a-z]/.test(key)) this.pending.namedReg = key;
      return;
    }
    const n = this._getCount(), result = this._findChar(type, key, n);
    if (result) { this.lastFind = { type, char: key }; if (this.pending.operator) this._applyOperator(this.pending.operator, this._motionToRange(result)); else this.cursor = { row: result.row, col: result.col }; }
    this._clearPending();
  }

  _findChar(type, ch, n) {
    const line = this.buffer[this.cursor.row]; let col = this.cursor.col, found = 0;
    if (type === 'f' || type === 't') { for (let c = col + 1; c < line.length; c++) if (line[c] === ch && ++found === n) return { row: this.cursor.row, col: type === 't' ? c - 1 : c, linewise: false, inclusive: true }; }
    else { for (let c = col - 1; c >= 0; c--) if (line[c] === ch && ++found === n) return { row: this.cursor.row, col: type === 'T' ? c + 1 : c, linewise: false, inclusive: false }; }
    return null;
  }

  _repeatFind(reverse) {
    if (!this.lastFind) return null;
    let t = this.lastFind.type;
    if (reverse) t = t === 'f' ? 'F' : t === 'F' ? 'f' : t === 't' ? 'T' : 't';
    return this._findChar(t, this.lastFind.char, 1);
  }

  // ── Text Objects ────────────────────────────────────────
  _resolveTextObject(key) {
    const type = this.pending.textObjType; this.pending.textObjType = null;
    const range = this._getTextObjRange(type, key);
    if (range && this.pending.operator) {
      this._applyOperator(this.pending.operator, range);
      if (this.pending.namedReg && (this.pending.operator === 'd' || this.pending.operator === 'c' || this.pending.operator === 'y')) {
        this.namedRegisters[this.pending.namedReg] = { text: this.register, linewise: this.registerLinewise };
      }
    }
    this._clearPending();
  }

  _getTextObjRange(type, key) {
    const a = type === 'a';
    switch (key) {
      case 'w': return this._textObjWord(a);
      case '"': return this._textObjQuote('"', a);
      case "'": return this._textObjQuote("'", a);
      case '`': return this._textObjQuote('`', a);
      case '(': case ')': case 'b': return this._textObjBracket('(', ')', a);
      case '{': case '}': case 'B': return this._textObjBracket('{', '}', a);
      case '[': case ']': return this._textObjBracket('[', ']', a);
      case 't': return this._textObjTag(a);
    }
    return null;
  }

  _textObjWord(around) {
    const line = this.buffer[this.cursor.row], col = this.cursor.col;
    if (!line.length) return null;
    const cls = this._charClass(line[col]);
    let start = col, end = col;
    if (cls === 'space') { while (start > 0 && this._charClass(line[start - 1]) === 'space') start--; while (end < line.length - 1 && this._charClass(line[end + 1]) === 'space') end++; }
    else {
      while (start > 0 && this._charClass(line[start - 1]) === cls) start--;
      while (end < line.length - 1 && this._charClass(line[end + 1]) === cls) end++;
      if (around) {
        if (end < line.length - 1 && this._charClass(line[end + 1]) === 'space') { while (end < line.length - 1 && this._charClass(line[end + 1]) === 'space') end++; }
        else if (start > 0 && this._charClass(line[start - 1]) === 'space') { while (start > 0 && this._charClass(line[start - 1]) === 'space') start--; }
      }
    }
    return { start: { row: this.cursor.row, col: start }, end: { row: this.cursor.row, col: end }, linewise: false, inclusive: true };
  }

  _textObjQuote(q, around) {
    const line = this.buffer[this.cursor.row];
    const positions = [];
    for (let i = 0; i < line.length; i++) if (line[i] === q && (i === 0 || line[i - 1] !== '\\')) positions.push(i);
    let oi = -1, ci = -1;
    for (let i = 0; i < positions.length - 1; i += 2) {
      if (positions[i] <= this.cursor.col && positions[i + 1] >= this.cursor.col) { oi = positions[i]; ci = positions[i + 1]; break; }
    }
    if (oi === -1) { for (let i = 0; i < positions.length - 1; i += 2) if (positions[i] > this.cursor.col) { oi = positions[i]; ci = positions[i + 1]; break; } }
    if (oi === -1) return null;
    const sc = around ? oi : oi + 1, ec = around ? ci : ci - 1;
    if (sc > ec && !around) return { start: { row: this.cursor.row, col: oi + 1 }, end: { row: this.cursor.row, col: oi }, linewise: false, inclusive: true, empty: true };
    return { start: { row: this.cursor.row, col: sc }, end: { row: this.cursor.row, col: ec }, linewise: false, inclusive: true };
  }

  _textObjBracket(open, close, around) {
    let foundOpen = false, sr = this.cursor.row, sc = this.cursor.col;
    if (this.buffer[sr][sc] === open) foundOpen = true;
    else {
      let depth = 0;
      outer: for (let r = sr; r >= 0; r--) {
        const line = this.buffer[r]; const startC = r === sr ? sc : line.length - 1;
        for (let i = startC; i >= 0; i--) {
          if (line[i] === close) depth++;
          if (line[i] === open) { if (depth === 0) { sr = r; sc = i; foundOpen = true; break outer; } depth--; }
        }
      }
    }
    if (!foundOpen) return null;
    let er = sr, ec = sc, depth = 0, foundClose = false;
    for (let r = sr; r < this.buffer.length; r++) {
      const line = this.buffer[r]; const startC = r === sr ? sc : 0;
      for (let i = startC; i < line.length; i++) {
        if (line[i] === open) depth++; if (line[i] === close) { depth--; if (depth === 0) { er = r; ec = i; foundClose = true; break; } }
      }
      if (foundClose) break;
    }
    if (!foundClose) return null;
    if (around) return { start: { row: sr, col: sc }, end: { row: er, col: ec }, linewise: false, inclusive: true };
    let sRow = sr, sCol = sc + 1, eRow = er, eCol = ec - 1;
    if (sCol >= this.buffer[sRow].length && sRow < eRow) { sRow++; sCol = 0; }
    if (eCol < 0 && eRow > sRow) { eRow--; eCol = Math.max(0, this.buffer[eRow].length - 1); }
    if (sRow > eRow || (sRow === eRow && sCol > eCol)) return { start: { row: sr, col: sc + 1 }, end: { row: sr, col: sc }, linewise: false, inclusive: true, empty: true };
    return { start: { row: sRow, col: sCol }, end: { row: eRow, col: eCol }, linewise: false, inclusive: true };
  }

  // ── Tag Text Object (cit/dit/cat/dat) ──────────────────
  _textObjTag(around) {
    const flatText = this.buffer.join('\n');
    const flatPos = this.buffer.slice(0, this.cursor.row).reduce((s, l) => s + l.length + 1, 0) + this.cursor.col;

    // Convert a flat index back to {row, col}
    const toRC = (pos) => {
      let p = 0;
      for (let r = 0; r < this.buffer.length; r++) {
        if (p + this.buffer[r].length >= pos) return { row: r, col: pos - p };
        p += this.buffer[r].length + 1;
      }
      return { row: this.buffer.length - 1, col: this.buffer[this.buffer.length - 1].length };
    };

    // Collect all opening tags that start at or before cursor
    const openRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    const opens = [];
    let m;
    while ((m = openRe.exec(flatText)) !== null) {
      if (m.index <= flatPos) {
        opens.push({ tag: m[1], index: m.index, end: m.index + m[0].length });
      }
    }

    // Try each open tag from nearest to farthest
    for (let i = opens.length - 1; i >= 0; i--) {
      const open = opens[i];
      const tagName = open.tag;

      // Find the matching close tag, accounting for nesting of same-name tags
      const searchRe = new RegExp(`<(/?)(${tagName})\\b[^>]*>`, 'g');
      searchRe.lastIndex = open.end;
      let depth = 1;
      while ((m = searchRe.exec(flatText)) !== null) {
        if (m[1] === '' && m[2] === tagName) {
          // Another opening tag of the same name
          depth++;
        } else if (m[1] === '/' && m[2] === tagName) {
          // Closing tag
          depth--;
          if (depth === 0) {
            const closeStart = m.index;
            const closeEnd = m.index + m[0].length;
            // The close tag must extend past the cursor position
            if (closeEnd > flatPos) {
              if (around) {
                return { start: toRC(open.index), end: toRC(closeEnd - 1), linewise: false, inclusive: true };
              } else {
                // Inner: content between open tag end and close tag start
                if (open.end >= closeStart) {
                  // Empty tag content
                  return { start: toRC(open.end), end: toRC(open.end - 1), linewise: false, inclusive: true, empty: true };
                }
                return { start: toRC(open.end), end: toRC(closeStart - 1), linewise: false, inclusive: true };
              }
            }
            break;
          }
        }
      }
    }
    return null;
  }

  // ── Operators ───────────────────────────────────────────
  _motionToRange(motion) {
    if (motion.linewise) {
      const s = Math.min(this.cursor.row, motion.row), e = Math.max(this.cursor.row, motion.row);
      return { start: { row: s, col: 0 }, end: { row: e, col: this.buffer[e].length }, linewise: true, inclusive: true };
    }
    const cp = this.cursor.row * 1e5 + this.cursor.col, mp = motion.row * 1e5 + motion.col;
    const [start, end] = cp <= mp ? [{ ...this.cursor }, { row: motion.row, col: motion.col }] : [{ row: motion.row, col: motion.col }, { ...this.cursor }];
    return { start, end, linewise: false, inclusive: !!motion.inclusive };
  }

  _applyOperator(op, range) {
    switch (op) {
      case 'd': this._deleteRange(range); break;
      case 'c': this._deleteRange(range); this.mode = 'INSERT'; break;
      case 'y': this._yankRange(range); break;
      case '>': this._indentRange(range, 1); break;
      case '<': this._indentRange(range, -1); break;
      case 'gU': case 'gu': this._caseRange(range, op === 'gU'); break;
      case 'gc': this._toggleCommentLines(range.start.row, range.end.row); break;
    }
  }

  _toggleCommentLines(sr, er) {
    sr = Math.max(0, sr); er = Math.min(this.buffer.length - 1, er);
    const allCommented = this.buffer.slice(sr, er + 1).every(l => /^\s*\/\//.test(l));
    for (let r = sr; r <= er; r++) {
      if (allCommented) {
        this.buffer[r] = this.buffer[r].replace(/^(\s*)\/\/\s?/, '$1');
      } else {
        const indent = this.buffer[r].match(/^(\s*)/)[1];
        this.buffer[r] = indent + '// ' + this.buffer[r].slice(indent.length);
      }
    }
    this._markDirty();
  }

  _caseRange(range, upper) {
    const fn = upper ? s => s.toUpperCase() : s => s.toLowerCase();
    if (range.linewise) {
      for (let r = range.start.row; r <= range.end.row; r++) this.buffer[r] = fn(this.buffer[r]);
    } else {
      const sr = range.start.row, sc = range.start.col, er = range.end.row;
      const ec = range.inclusive ? range.end.col + 1 : range.end.col;
      if (sr === er) { const l = this.buffer[sr]; this.buffer[sr] = l.slice(0, sc) + fn(l.slice(sc, ec)) + l.slice(ec); }
      else { this.buffer[sr] = this.buffer[sr].slice(0, sc) + fn(this.buffer[sr].slice(sc)); for (let r = sr + 1; r < er; r++) this.buffer[r] = fn(this.buffer[r]); this.buffer[er] = fn(this.buffer[er].slice(0, ec)) + this.buffer[er].slice(ec); }
    }
    this._markDirty();
  }

  _applyBlockOperator(op, range) {
    if (op === 'd' || op === 'c') {
      let deleted = '';
      for (let r = range.startRow; r <= Math.min(range.endRow, this.buffer.length - 1); r++) {
        const line = this.buffer[r];
        const sc = Math.min(range.startCol, line.length), ec = Math.min(range.endCol + 1, line.length);
        if (r > range.startRow) deleted += '\n';
        deleted += line.slice(sc, ec);
        this.buffer[r] = line.slice(0, sc) + line.slice(ec);
      }
      this.register = deleted; this.registerLinewise = false;
      this.cursor = { row: range.startRow, col: range.startCol };
      this._clampCursor(); this._markDirty();
      if (op === 'c') this.mode = 'INSERT';
    } else if (op === 'y') {
      let yanked = '';
      for (let r = range.startRow; r <= Math.min(range.endRow, this.buffer.length - 1); r++) {
        const line = this.buffer[r];
        const sc = Math.min(range.startCol, line.length), ec = Math.min(range.endCol + 1, line.length);
        if (r > range.startRow) yanked += '\n';
        yanked += line.slice(sc, ec);
      }
      this.register = yanked; this.registerLinewise = false;
    } else if (op === '>' || op === '<') {
      this._indentRange({ start: { row: range.startRow }, end: { row: range.endRow } }, op === '>' ? 1 : -1);
    }
  }

  _deleteRange(range) {
    if (range.empty) { this.register = ''; this.registerLinewise = false; this.cursor = { ...range.start }; this._clampCursor(); this._markDirty(); return; }
    if (range.linewise) {
      const s = range.start.row, cnt = range.end.row - s + 1;
      const deleted = this.buffer.splice(s, cnt);
      this.register = deleted.join('\n'); this.registerLinewise = true;
      if (!this.buffer.length) this.buffer = [''];
      this.cursor.row = Math.min(s, this.buffer.length - 1);
      this.cursor.col = this._firstNonBlank(this.cursor.row);
    } else {
      const sr = range.start.row, sc = range.start.col, er = range.end.row;
      const ec = range.inclusive ? range.end.col + 1 : range.end.col;
      if (sr === er) {
        const l = this.buffer[sr]; this.register = l.slice(sc, ec); this.registerLinewise = false;
        this.buffer[sr] = l.slice(0, sc) + l.slice(ec);
      } else {
        const sLine = this.buffer[sr], eLine = this.buffer[er];
        let del = sLine.slice(sc); for (let r = sr + 1; r < er; r++) del += '\n' + this.buffer[r]; del += '\n' + eLine.slice(0, ec);
        this.register = del; this.registerLinewise = false;
        this.buffer[sr] = sLine.slice(0, sc) + eLine.slice(ec);
        this.buffer.splice(sr + 1, er - sr);
      }
      this.cursor = { row: sr, col: sc };
    }
    this._clampCursor(); this._markDirty();
  }

  _yankRange(range) {
    if (range.empty) { this.register = ''; this.registerLinewise = false; return; }
    if (range.linewise) {
      const lines = []; for (let r = range.start.row; r <= range.end.row; r++) lines.push(this.buffer[r]);
      this.register = lines.join('\n'); this.registerLinewise = true;
    } else {
      const sr = range.start.row, sc = range.start.col, er = range.end.row;
      const ec = range.inclusive ? range.end.col + 1 : range.end.col;
      if (sr === er) this.register = this.buffer[sr].slice(sc, ec);
      else { let t = this.buffer[sr].slice(sc); for (let r = sr + 1; r < er; r++) t += '\n' + this.buffer[r]; t += '\n' + this.buffer[er].slice(0, ec); this.register = t; }
      this.registerLinewise = false;
    }
  }

  _indentRange(range, dir) {
    const s = Math.min(range.start.row, range.end.row), e = Math.max(range.start.row, range.end.row);
    for (let r = s; r <= e; r++) this.buffer[r] = dir > 0 ? '  ' + this.buffer[r] : this.buffer[r].replace(/^  /, '');
    this.cursor.col = this._firstNonBlank(this.cursor.row); this._clampCursor(); this._markDirty();
  }

  _operateOnLines(op, count) {
    const s = this.cursor.row, e = Math.min(s + count - 1, this.buffer.length - 1);
    if (op === 'c') {
      const indent = this.buffer[s].match(/^(\s*)/)[1];
      const deleted = this.buffer.splice(s, e - s + 1, indent);
      this.register = deleted.join('\n'); this.registerLinewise = true;
      if (this.pending.namedReg) this.namedRegisters[this.pending.namedReg] = { text: this.register, linewise: true };
      this.cursor = { row: s, col: indent.length }; this.mode = 'INSERT'; this._markDirty(); return;
    }
    this._applyOperator(op, { start: { row: s, col: 0 }, end: { row: e, col: this.buffer[e].length }, linewise: true, inclusive: true });
    if (this.pending.namedReg && (op === 'd' || op === 'y')) {
      this.namedRegisters[this.pending.namedReg] = { text: this.register, linewise: this.registerLinewise };
    }
  }

  // ── Simple Commands ─────────────────────────────────────
  _handleSimpleCommand(key) {
    const count = this._getCount();
    switch (key) {
      case 'x': for (let i = 0; i < count; i++) { const l = this.buffer[this.cursor.row]; if (l.length && this.cursor.col < l.length) { this.register = l[this.cursor.col]; this.registerLinewise = false; this.buffer[this.cursor.row] = l.slice(0, this.cursor.col) + l.slice(this.cursor.col + 1); this._markDirty(); } } this._clampCursor(); return;
      case 'D': { const l = this.buffer[this.cursor.row]; this.register = l.slice(this.cursor.col); this.registerLinewise = false; this.buffer[this.cursor.row] = l.slice(0, this.cursor.col); this._clampCursor(); this._markDirty(); return; }
      case 'C': { const l = this.buffer[this.cursor.row]; this.register = l.slice(this.cursor.col); this.registerLinewise = false; this.buffer[this.cursor.row] = l.slice(0, this.cursor.col); this.mode = 'INSERT'; this._markDirty(); return; }
      case 'J': for (let i = 0; i < count; i++) { if (this.cursor.row < this.buffer.length - 1) { const cur = this.buffer[this.cursor.row], nxt = this.buffer[this.cursor.row + 1].trimStart(); const jc = cur.length; this.buffer[this.cursor.row] = cur + (nxt ? ' ' + nxt : ''); this.buffer.splice(this.cursor.row + 1, 1); this.cursor.col = jc; this._markDirty(); } } return;
      case 'i': this.mode = 'INSERT'; return;
      case 'a': this.mode = 'INSERT'; if (this.buffer[this.cursor.row].length > 0) this.cursor.col++; return;
      case 'A': this.mode = 'INSERT'; this.cursor.col = this.buffer[this.cursor.row].length; return;
      case 'I': this.mode = 'INSERT'; this.cursor.col = this._firstNonBlank(this.cursor.row); return;
      case 'o': this.buffer.splice(this.cursor.row + 1, 0, ''); this.cursor.row++; this.cursor.col = 0; this.mode = 'INSERT'; this._markDirty(); return;
      case 'O': this.buffer.splice(this.cursor.row, 0, ''); this.cursor.col = 0; this.mode = 'INSERT'; this._markDirty(); return;
      case 'p': this._pasteAfter(); return;
      case 'P': this._pasteBefore(); return;
      case 'v': this.mode = 'VISUAL'; this.visualAnchor = { ...this.cursor }; return;
      case 'V': this.mode = 'VISUAL_LINE'; this.visualAnchor = { ...this.cursor }; return;
      case 'Ctrl-v': this.mode = 'VISUAL_BLOCK'; this.visualAnchor = { ...this.cursor }; return;
      case '.': this._dotRepeat(); return;
      case 'u': this._undo(); return;
      case 'Ctrl-r': this._redo(); return;
      case 'R': this.mode = 'REPLACE'; this._markDirty(); return;
      case ';': case ':': this.mode = 'COMMAND'; this.commandBuffer = ''; this._searchMode = false; return;
      case 's': { const l = this.buffer[this.cursor.row]; if (l.length && this.cursor.col < l.length) { this.register = l[this.cursor.col]; this.registerLinewise = false; this.buffer[this.cursor.row] = l.slice(0, this.cursor.col) + l.slice(this.cursor.col + 1); this._markDirty(); } this.mode = 'INSERT'; return; }
      case 'S': { const indent = this.buffer[this.cursor.row].match(/^(\s*)/)[1]; this.register = this.buffer[this.cursor.row]; this.registerLinewise = true; this.buffer[this.cursor.row] = indent; this.cursor.col = indent.length; this.mode = 'INSERT'; this._markDirty(); return; }
      case '~': { const l = this.buffer[this.cursor.row]; if (this.cursor.col < l.length) { const ch = l[this.cursor.col]; const t = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase(); this.buffer[this.cursor.row] = l.slice(0, this.cursor.col) + t + l.slice(this.cursor.col + 1); this.cursor.col = Math.min(this.cursor.col + 1, Math.max(0, this.buffer[this.cursor.row].length - 1)); this._markDirty(); } return; }
      case 'X': for (let i = 0; i < count; i++) { if (this.cursor.col > 0) { const l = this.buffer[this.cursor.row]; this.register = l[this.cursor.col - 1]; this.registerLinewise = false; this.buffer[this.cursor.row] = l.slice(0, this.cursor.col - 1) + l.slice(this.cursor.col); this.cursor.col--; this._markDirty(); } } return;
      case 'Y': { this.register = this.buffer.slice(this.cursor.row, this.cursor.row + count).join('\n'); this.registerLinewise = true; return; }
      case '#': this._searchWordUnderCursorBack(); return;
      case 'Ctrl-d': { const half = Math.max(1, Math.floor(this.buffer.length / 2)); this.cursor.row = Math.min(this.buffer.length - 1, this.cursor.row + half); this.cursor.col = this._firstNonBlank(this.cursor.row); return; }
      case 'Ctrl-u': { const half = Math.max(1, Math.floor(this.buffer.length / 2)); this.cursor.row = Math.max(0, this.cursor.row - half); this.cursor.col = this._firstNonBlank(this.cursor.row); return; }
      case 'Ctrl-a': this._incrementNumber(count); return;
      case 'Ctrl-x': this._incrementNumber(-count); return;
      case '*': this._searchWordUnderCursor(); return;
      case 'Ctrl-j': for (let i = 0; i < count; i++) this._moveLineDown(); this._markDirty(); return;
      case 'Ctrl-k': for (let i = 0; i < count; i++) this._moveLineUp(); this._markDirty(); return;
    }
  }

  _replaceChar(ch) {
    const l = this.buffer[this.cursor.row], n = this._getCount();
    if (this.cursor.col < l.length) {
      let s = l; for (let i = 0; i < n && this.cursor.col + i < s.length; i++) s = s.slice(0, this.cursor.col + i) + ch + s.slice(this.cursor.col + i + 1);
      this.buffer[this.cursor.row] = s;
      this.cursor.col = Math.min(this.cursor.col + n - 1, s.length - 1);
      this._markDirty();
    }
  }

  _pasteAfter() {
    let text = this.register, lw = this.registerLinewise;
    if (this.pending.namedReg) {
      const nr = this.namedRegisters[this.pending.namedReg];
      if (nr) { text = nr.text; lw = nr.linewise; }
    }
    if (!text) return;
    if (lw) {
      this.buffer.splice(this.cursor.row + 1, 0, ...text.split('\n'));
      this.cursor.row++; this.cursor.col = this._firstNonBlank(this.cursor.row);
    } else {
      const l = this.buffer[this.cursor.row], c = this.cursor.col + 1;
      this.buffer[this.cursor.row] = l.slice(0, c) + text + l.slice(c);
      this.cursor.col = c + text.length - 1;
    }
    this._clampCursor(); this._markDirty();
  }

  _pasteBefore() {
    let text = this.register, lw = this.registerLinewise;
    if (this.pending.namedReg) {
      const nr = this.namedRegisters[this.pending.namedReg];
      if (nr) { text = nr.text; lw = nr.linewise; }
    }
    if (!text) return;
    if (lw) {
      this.buffer.splice(this.cursor.row, 0, ...text.split('\n'));
      this.cursor.col = this._firstNonBlank(this.cursor.row);
    } else {
      const l = this.buffer[this.cursor.row], c = this.cursor.col;
      this.buffer[this.cursor.row] = l.slice(0, c) + text + l.slice(c);
      this.cursor.col = c + text.length - 1;
    }
    this._clampCursor(); this._markDirty();
  }

  _moveLineDown() { if (this.cursor.row < this.buffer.length - 1) { [this.buffer[this.cursor.row], this.buffer[this.cursor.row + 1]] = [this.buffer[this.cursor.row + 1], this.buffer[this.cursor.row]]; this.cursor.row++; } }
  _moveLineUp() { if (this.cursor.row > 0) { [this.buffer[this.cursor.row], this.buffer[this.cursor.row - 1]] = [this.buffer[this.cursor.row - 1], this.buffer[this.cursor.row]]; this.cursor.row--; } }

  _incrementNumber(delta) {
    const line = this.buffer[this.cursor.row];
    const re = /-?\d+/g;
    let match;
    while ((match = re.exec(line)) !== null) {
      if (match.index + match[0].length > this.cursor.col) {
        const num = parseInt(match[0], 10) + delta;
        const numStr = String(num);
        this.buffer[this.cursor.row] = line.slice(0, match.index) + numStr + line.slice(match.index + match[0].length);
        this.cursor.col = match.index + numStr.length - 1;
        this._markDirty();
        return;
      }
    }
  }

  _searchWordUnderCursor() {
    const line = this.buffer[this.cursor.row];
    let s = this.cursor.col, e = this.cursor.col;
    if (!/[a-zA-Z0-9_]/.test(line[s] || '')) return;
    while (s > 0 && /[a-zA-Z0-9_]/.test(line[s - 1])) s--;
    while (e < line.length - 1 && /[a-zA-Z0-9_]/.test(line[e + 1])) e++;
    this.searchPattern = '\\b' + line.slice(s, e + 1) + '\\b';
    this.searchDirection = 1;
    this._jumpToNextMatch(1);
  }

  _searchWordUnderCursorBack() {
    const line = this.buffer[this.cursor.row];
    let s = this.cursor.col, e = this.cursor.col;
    if (!/[a-zA-Z0-9_]/.test(line[s] || '')) return;
    while (s > 0 && /[a-zA-Z0-9_]/.test(line[s - 1])) s--;
    while (e < line.length - 1 && /[a-zA-Z0-9_]/.test(line[e + 1])) e++;
    this.searchPattern = '\\b' + line.slice(s, e + 1) + '\\b';
    this.searchDirection = -1;
    this._jumpToNextMatch(-1);
  }

  _playMacro(reg) {
    const keys = this.macroRegisters[reg];
    if (!keys || !keys.length) return;
    this.lastMacroReg = reg;
    this._replayDepth++;
    for (const k of keys) this.processKey(k);
    this._replayDepth--;
  }

  _dotRepeat() {
    if (!this._lastDot.length) return;
    this._replayDepth++;
    for (const k of this._lastDot) this.processKey(k);
    this._replayDepth--;
  }
}

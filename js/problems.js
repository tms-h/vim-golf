import { VimEngine } from './engine.js';

export class ProblemGenerator {
  constructor() {
    this.varNames = ['count','total','result','index','value','buffer','output','config','handler','parser','data','items','response','request','options','element','node','target','source','limit'];
    this.funcNames = ['getData','processItem','handleEvent','renderView','parseInput','validateForm','fetchData','updateState','transformData','calculateTotal','formatOutput','initModule','createNode','deleteItem','sortList'];
    this.strLiterals = ['hello','world','test','example','active','primary','default','success','loading','enabled','visible','complete','pending','ready','error'];
    this.categories = ['deletion','change','insert','navigation','yank','visual','compound','macro','search','marks','registers'];
  }
  _pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  _pickN(a, n) { return [...a].sort(() => Math.random() - .5).slice(0, n); }
  _ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  generate(category, difficulty) {
    if (!category) category = this._pick(this.categories);
    if (!difficulty) difficulty = this._ri(1, 3);
    difficulty = Math.max(1, Math.min(5, difficulty));
    for (let i = 0; i < 8; i++) {
      try {
        const p = this['_gen_' + category]?.(difficulty) || this._gen_deletion(difficulty);
        if (p && this._verify(p)) return p;
      } catch {}
    }
    return this._fallback(category);
  }

  generateWeighted(weights, difficulty) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [cat, w] of entries) { r -= w; if (r <= 0) return this.generate(cat, difficulty); }
    return this.generate(entries[entries.length - 1][0], difficulty);
  }

  _verify(p) {
    const e = new VimEngine();
    e.loadBuffer(p.initialBuffer.map(l => l), { ...p.cursorPos });
    for (const k of p.optimalKeystrokes) e.processKey(k);
    const bm = e.buffer.length === p.targetBuffer.length && e.buffer.every((l, i) => l === p.targetBuffer[i]);
    if (p.targetCursorPos) return bm && e.cursor.row === p.targetCursorPos.row && e.cursor.col === p.targetCursorPos.col;
    return bm;
  }

  _simpleLines() {
    const [v1, v2, v3] = this._pickN(this.varNames, 3), [s1, s2] = this._pickN(this.strLiterals, 2);
    const types = ['int','std::string','auto','double','bool'];
    if (Math.random() < 0.6) return [`${this._pick(types)} ${v1} = "${s1}";`, `${this._pick(types)} ${v2} = ${this._ri(1, 50)};`, `${this._pick(types)} ${v3} = "${s2}";`];
    return [`const ${v1} = "${s1}";`, `let ${v2} = ${this._ri(1, 50)};`, `const ${v3} = "${s2}";`];
  }

  _jsSnippet() {
    const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2), [v1, v2] = this._pickN(this.varNames, 2), s = this._pick(this.strLiterals);
    return [`function ${fn}(${p1}, ${p2}) {`, `  const ${v1} = ${p1}.filter(x => x.${s});`, `  let ${v2} = ${v1}.length;`, `  return ${v2} > 0 ? ${v1} : null;`, `}`];
  }

  _pySnippet() {
    const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2), [v1, v2] = this._pickN(this.varNames, 2), s = this._pick(this.strLiterals);
    return [`def ${fn}(${p1}, ${p2}):`, `    ${v1} = [x for x in ${p1} if x.${s}]`, `    ${v2} = len(${v1})`, `    return "${s}" if ${v2} > 0 else None`];
  }

  _cppSnippet() {
    const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2), [v1, v2] = this._pickN(this.varNames, 2), s = this._pick(this.strLiterals);
    const types = ['int','std::string','bool','double','size_t','float','char','long'];
    const t1 = this._pick(types), t2 = this._pick(types), rt = this._pick(types);
    return [`${rt} ${fn}(${t1} ${p1}, ${t2} ${p2}) {`, `  auto ${v1} = ${p1};`, `  ${this._pick(types)} ${v2} = static_cast<${this._pick(types)}>(${v1});`, `  return ${v2};`, `}`];
  }

  _cppClassSnippet() {
    const cls = this._pick(['Vector','Matrix','Parser','Handler','Factory','Builder','Buffer','Iterator','Allocator']);
    const [m1, m2] = this._pickN(this.varNames, 2);
    const types = ['int','std::string','bool','double','size_t'];
    return [`class ${cls} {`, `public:`, `  ${cls}() = default;`, `  ~${cls}() = default;`, `  ${this._pick(types)} ${m1}() const { return m_${m1}; }`, `  void set_${m2}(${this._pick(types)} val) { m_${m2} = val; }`, `private:`, `  ${this._pick(types)} m_${m1};`, `  ${this._pick(types)} m_${m2};`, `};`];
  }

  _cppTemplateSnippet() {
    const fn = this._pick(this.funcNames), v = this._pick(this.varNames);
    return [`template<typename T>`, `T ${fn}(const std::vector<T>& ${v}) {`, `  if (${v}.empty()) {`, `    throw std::runtime_error("empty");`, `  }`, `  return ${v}.front();`, `}`];
  }

  _cppHeaderSnippet() {
    const cls = this._pick(['Config','Logger','Network','Database','Cache','Queue','Stack']);
    const [m1, m2, m3] = this._pickN(this.varNames, 3);
    const types = ['int','std::string','bool','double'];
    return [`#pragma once`, `#include <string>`, `#include <vector>`, ``, `namespace ${this._pick(this.varNames)} {`, `  struct ${cls} {`, `    ${this._pick(types)} ${m1};`, `    ${this._pick(types)} ${m2};`, `    ${this._pick(types)} ${m3};`, `  };`, `}`];
  }

  _getSnippet() { return this._pick([() => this._cppSnippet(), () => this._cppClassSnippet(), () => this._cppTemplateSnippet(), () => this._jsSnippet(), () => this._pySnippet()])(); }
  _firstNonBlankOf(line) { const m = line.match(/\S/); return m ? line.indexOf(m[0]) : 0; }

  // ── Generators ──────────────────────────────────────────

  _gen_deletion(d) {
    if (d <= 1) {
      const v = this._ri(0, 4);
      if (v === 0) { const lines = this._getSnippet(), row = this._ri(0, lines.length - 1), target = lines.filter((_, i) => i !== row); if (!target.length) return null; return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Delete the entire line', optimalKeystrokes: ['d', 'd'], category: 'deletion', difficulty: 1 }; }
      if (v === 1) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const eng = new VimEngine(); eng.loadBuffer(lines.map(l => l), { row, col: 0 }); const word = lines[row].match(/[a-zA-Z_]\w*/)?.[0]; if (!word) return null; eng.processKey('d'); eng.processKey('a'); eng.processKey('w'); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: eng.buffer, description: `Delete the word "${word}"`, optimalKeystrokes: ['d', 'a', 'w'], category: 'deletion', difficulty: 1 }; }
      if (v === 2) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1), col = this._ri(1, Math.max(1, Math.floor(lines[row].length / 2))); const target = [...lines]; target[row] = lines[row].slice(0, col); return { initialBuffer: lines, cursorPos: { row, col }, targetBuffer: target, description: 'Delete from cursor to end of line', optimalKeystrokes: ['D'], category: 'deletion', difficulty: 1 }; }
      if (v === 3) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1), col = this._ri(0, Math.max(0, lines[row].length - 1)); const target = [...lines]; target[row] = lines[row].slice(0, col) + lines[row].slice(col + 1); return { initialBuffer: lines, cursorPos: { row, col }, targetBuffer: target, description: 'Delete the character under the cursor', optimalKeystrokes: ['x'], category: 'deletion', difficulty: 1 }; }
      { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1), m = lines[row].match(/[a-zA-Z_]\w*/); if (!m) return null; const eng = new VimEngine(); eng.loadBuffer(lines.map(l => l), { row, col: m.index }); eng.processKey('d'); eng.processKey('w'); return { initialBuffer: lines, cursorPos: { row, col: m.index }, targetBuffer: eng.buffer, description: 'Delete forward to next word', optimalKeystrokes: ['d', 'w'], category: 'deletion', difficulty: 1 }; }
    }
    if (d === 2) {
      const v = this._ri(0, 3);
      if (v === 0) { const vn = this._pick(this.varNames), s = this._pick(this.strLiterals), line = `const ${vn} = "${s}";`, qi = line.indexOf('"'); const target = [line.slice(0, qi + 1) + line.slice(line.lastIndexOf('"'))]; return { initialBuffer: [line], cursorPos: { row: 0, col: qi + 1 }, targetBuffer: target, description: 'Delete inside the double quotes', optimalKeystrokes: ['d', 'i', '"'], category: 'deletion', difficulty: 2 }; }
      if (v === 1) { const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2), line = `${fn}(${p1}, ${p2})`; return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf('(') + 1 }, targetBuffer: [`${fn}()`], description: 'Delete inside the parentheses', optimalKeystrokes: ['d', 'i', '('], category: 'deletion', difficulty: 2 }; }
      if (v === 2) { const lines = this._getSnippet(); if (lines.length < 3) return null; const cnt = this._ri(2, Math.min(3, lines.length)), row = this._ri(0, lines.length - cnt); const target = [...lines.slice(0, row), ...lines.slice(row + cnt)]; if (!target.length) return null; const ks = cnt === 1 ? ['d', 'd'] : [...String(cnt).split(''), 'd', 'd']; return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: `Delete ${cnt} lines`, optimalKeystrokes: ks, category: 'deletion', difficulty: 2 }; }
      { const vn = this._pick(this.varNames), s = this._pick(this.strLiterals); const line = `let ${vn} = '${s}';`; const qi = line.indexOf("'"); const target = [line.slice(0, qi + 1) + line.slice(line.lastIndexOf("'"))]; return { initialBuffer: [line], cursorPos: { row: 0, col: qi + 1 }, targetBuffer: target, description: "Delete inside the single quotes", optimalKeystrokes: ['d', 'i', "'"], category: 'deletion', difficulty: 2 }; }
    }
    if (d === 3) {
      const v = this._ri(0, 2);
      if (v === 0) { const fn = this._pick(this.funcNames), [k1, k2] = this._pickN(this.varNames, 2), s = this._pick(this.strLiterals); const line = `${fn}({${k1}: "${s}", ${k2}: true});`; const ob = line.indexOf('{'), cb = line.indexOf('}'); return { initialBuffer: [line], cursorPos: { row: 0, col: ob + 1 }, targetBuffer: [line.slice(0, ob + 1) + line.slice(cb)], description: 'Delete inside the curly braces', optimalKeystrokes: ['d', 'i', '{'], category: 'deletion', difficulty: 3 }; }
      if (v === 1) {
        const lines = this._getSnippet(); if (lines.length < 5) return null;
        const row = this._ri(1, lines.length - 2);
        const target = [...lines.slice(0, row), ...lines.slice(row + 1)];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l => l), { row: 0, col: 0 });
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Delete line ${row + 1} (navigate then delete)`, optimalKeystrokes: [...String(row + 1).split(''), 'G', 'd', 'd'], category: 'deletion', difficulty: 3 };
      }
      { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const m = lines[row].match(/= (.+);/); if (!m) return null; const eqIdx = lines[row].indexOf('= ') + 2; const target = [...lines]; target[row] = lines[row].slice(0, eqIdx) + ';'; return { initialBuffer: lines, cursorPos: { row, col: eqIdx }, targetBuffer: target, description: 'Delete from cursor to the semicolon', optimalKeystrokes: ['d', 't', ';'], category: 'deletion', difficulty: 3 }; }
    }
    if (d === 4) {
      const v = this._ri(0, 2);
      if (v === 0) { const lines = this._jsSnippet(); if (lines.length < 4) return null; const target = [lines[0], lines[lines.length - 1]]; const cnt = lines.length - 2; return { initialBuffer: lines, cursorPos: { row: 1, col: 0 }, targetBuffer: target, description: `Delete ${cnt} lines inside the function body`, optimalKeystrokes: [...String(cnt).split(''), 'd', 'd'], category: 'deletion', difficulty: 4 }; }
      if (v === 1) {
        const fn = this._pick(this.funcNames), [p1, p2, p3] = this._pickN(this.varNames, 3);
        const line = `${fn}(${p1}, ${p2}, ${p3})`;
        const c1 = line.indexOf(p2), c2 = line.indexOf(p3) + p3.length;
        const target = [`${fn}(${p1})`];
        const eng = new VimEngine(); eng.loadBuffer([line], { row: 0, col: line.indexOf(',') });
        ['d', 'i', '('].forEach(k => eng.processKey(k));
        return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf('(') + 1 }, targetBuffer: [`${fn}()`], description: 'Delete all function arguments', optimalKeystrokes: ['d', 'i', '('], category: 'deletion', difficulty: 4 };
      }
      {
        const lines = this._getSnippet(); if (lines.length < 6) return null;
        const sr = this._ri(1, 2), er = this._ri(lines.length - 3, lines.length - 2);
        const target = [...lines.slice(0, sr), ...lines.slice(er + 1)];
        if (!target.length) return null;
        const cnt = er - sr + 1;
        return { initialBuffer: lines, cursorPos: { row: sr, col: 0 }, targetBuffer: target, description: `Delete ${cnt} lines from line ${sr + 1}`, optimalKeystrokes: [...String(cnt).split(''), 'd', 'd'], category: 'deletion', difficulty: 4 };
      }
    }
    {
      const v = this._ri(0, 3);
      if (v === 0) {
        // Delete function body (2 lines) AND delete the string inside quotes on line 1
        const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2);
        const s = this._pick(this.strLiterals);
        const lines = [`const ${p1} = "${s}";`, `function ${fn}() {`, `  return ${p1};`, `  // end`, `}`];
        const target = [`const ${p1} = "";`, `function ${fn}() {`, `}`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['f', '"', 'd', 'i', '"', 'j', 'j', '2', 'd', 'd'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: 'Delete string contents on line 1 and delete 2 lines inside function', optimalKeystrokes: ['f', '"', 'd', 'i', '"', 'j', 'j', '2', 'd', 'd'], category: 'deletion', difficulty: 5 };
      }
      if (v === 1) {
        // Delete a specific line using search, then delete the last line
        const [v1, v2, v3, v4] = this._pickN(this.varNames, 4);
        const lines = [`let ${v1} = 0;`, `let ${v2} = 1;`, `let ${v3} = 2;`, `let ${v4} = 3;`];
        const target = [`let ${v1} = 0;`, `let ${v3} = 2;`];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Search for "${v2}", delete that line, then delete last line`, optimalKeystrokes: ['/', ...v2.split(''), 'Enter', 'd', 'd', 'G', 'd', 'd'], category: 'deletion', difficulty: 5 };
      }
      if (v === 2) {
        // Navigate to a line, delete word inside quotes, go to another line and delete it
        const [v1, v2, v3] = this._pickN(this.varNames, 3);
        const s1 = this._pick(this.strLiterals), s2 = this._pick(this.strLiterals);
        const lines = [`let ${v1} = "${s1}";`, `let ${v2} = "${s2}";`, `return ${v3};`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['f', '"', 'd', 'i', '"', 'G', 'd', 'd'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: 'Delete inside quotes on line 1, then delete last line', optimalKeystrokes: ['f', '"', 'd', 'i', '"', 'G', 'd', 'd'], category: 'deletion', difficulty: 5 };
      }
      {
        // Delete from line 3 to end, then delete inside parens on line 1
        const fn = this._pick(this.funcNames), [v1, v2, v3] = this._pickN(this.varNames, 3);
        const lines = [`${fn}(${v1}, ${v2})`, `let ${v3} = 0;`, `return ${v3};`, `// end`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['3', 'G', '2', 'd', 'd', 'g', 'g', 'f', '(', 'd', 'i', '('].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: 'Delete last 2 lines, then delete inside parens on line 1', optimalKeystrokes: ['3', 'G', '2', 'd', 'd', 'g', 'g', 'f', '(', 'd', 'i', '('], category: 'deletion', difficulty: 5 };
      }
    }
  }

  _gen_change(d) {
    if (d <= 1) {
      const v = this._ri(0, 2);
      if (v === 0) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1), words = lines[row].match(/[a-zA-Z_]\w*/g); if (!words?.length) return null; const word = this._pick(words), col = lines[row].indexOf(word), nw = this._pick(this.varNames.filter(x => x !== word)); const eng = new VimEngine(); eng.loadBuffer(lines.map(l => l), { row, col }); ['c','w', ...nw.split(''), 'Escape'].forEach(k => eng.processKey(k)); return { initialBuffer: lines, cursorPos: { row, col }, targetBuffer: eng.buffer, description: `Change "${word}" to "${nw}"`, optimalKeystrokes: ['c','w', ...nw.split(''), 'Escape'], category: 'change', difficulty: 1 }; }
      if (v === 1) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1), col = this._ri(1, Math.max(1, Math.floor(lines[row].length / 2))), nt = this._pick(this.strLiterals); const target = [...lines]; target[row] = lines[row].slice(0, col) + nt; return { initialBuffer: lines, cursorPos: { row, col }, targetBuffer: target, description: `Change from cursor to end of line to "${nt}"`, optimalKeystrokes: ['C', ...nt.split(''), 'Escape'], category: 'change', difficulty: 1 }; }
      { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const eng = new VimEngine(); eng.loadBuffer(lines.map(l => l), { row, col: 0 }); const w = lines[row].match(/[a-zA-Z_]\w*/)?.[0]; if (!w) return null; const nw = this._pick(this.varNames.filter(x => x !== w)); ['c', 'w', ...nw.split(''), 'Escape'].forEach(k => eng.processKey(k)); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: eng.buffer, description: `Change word forward to "${nw}"`, optimalKeystrokes: ['c','w', ...nw.split(''), 'Escape'], category: 'change', difficulty: 1 }; }
    }
    if (d === 2) {
      const v = this._ri(0, 2);
      if (v === 0) { const vn = this._pick(this.varNames), os = this._pick(this.strLiterals), ns = this._pick(this.strLiterals.filter(x => x !== os)); const line = `const ${vn} = "${os}";`; return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf(os) }, targetBuffer: [`const ${vn} = "${ns}";`], description: `Change "${os}" to "${ns}" inside quotes`, optimalKeystrokes: ['c','i','"', ...ns.split(''), 'Escape'], category: 'change', difficulty: 2 }; }
      if (v === 1) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const eng = new VimEngine(); eng.loadBuffer(lines.map(l => l), { row, col: 0 }); const m = lines[row].match(/[a-zA-Z_]\w*/g); if (!m || m.length < 2) return null; const nw = this._pick(this.varNames.filter(x => !m.includes(x))); ['2', 'c', 'w', ...nw.split(''), ' ', 'Escape'].forEach(k => eng.processKey(k)); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: eng.buffer, description: `Change 2 words forward`, optimalKeystrokes: ['2','c','w', ...nw.split(''), ' ', 'Escape'], category: 'change', difficulty: 2 }; }
      { const vn = this._pick(this.varNames), os = this._pick(this.strLiterals), ns = this._pick(this.strLiterals.filter(x => x !== os)); const line = `let ${vn} = '${os}';`; return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf(os) }, targetBuffer: [`let ${vn} = '${ns}';`], description: `Change '${os}' to '${ns}' inside single quotes`, optimalKeystrokes: ['c','i',"'", ...ns.split(''), 'Escape'], category: 'change', difficulty: 2 }; }
    }
    if (d === 3) {
      const v = this._ri(0, 2);
      if (v === 0) { const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2), [np1, np2] = this._pickN(this.varNames.filter(x => x !== p1 && x !== p2), 2); const line = `${fn}(${p1}, ${p2})`; return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf('(') + 1 }, targetBuffer: [`${fn}(${np1}, ${np2})`], description: 'Change inside the parentheses', optimalKeystrokes: ['c','i','(', ...`${np1}, ${np2}`.split(''), 'Escape'], category: 'change', difficulty: 3 }; }
      if (v === 1) {
        const vn = this._pick(this.varNames), s = this._pick(this.strLiterals);
        const line = `const ${vn} = "${s}";`;
        const nv = this._pick(this.varNames.filter(x => x !== vn));
        const ns = this._pick(this.strLiterals.filter(x => x !== s));
        const eng = new VimEngine(); eng.loadBuffer([line], { row: 0, col: 0 });
        ['c', 'w', ...nv.split(''), 'Escape'].forEach(k => eng.processKey(k));
        const afterWord = eng.buffer[0];
        eng.processKey('f'); eng.processKey('"');
        ['c', 'i', '"', ...ns.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf(vn) }, targetBuffer: eng.buffer, description: `Change variable name and string value`, optimalKeystrokes: ['c','w', ...nv.split(''), 'Escape', 'f', '"', 'c','i','"', ...ns.split(''), 'Escape'], category: 'change', difficulty: 3 };
      }
      { const fn = this._pick(this.funcNames), [k1, k2] = this._pickN(this.varNames, 2); const line = `${fn}({${k1}: 0, ${k2}: 1})`; const nb = this._pick(this.varNames); return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf('{') + 1 }, targetBuffer: [`${fn}({${nb}})`], description: 'Change inside the curly braces', optimalKeystrokes: ['c','i','{', ...nb.split(''), 'Escape'], category: 'change', difficulty: 3 }; }
    }
    if (d === 4) {
      const v = this._ri(0, 2);
      if (v === 0) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const newLine = `// ${this._pick(this.strLiterals)}`; const target = [...lines]; target[row] = newLine; return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: `Replace entire line content`, optimalKeystrokes: ['S', ...newLine.split(''), 'Escape'], category: 'change', difficulty: 4 }; }
      if (v === 1) {
        const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2);
        const line = `function ${fn}(${p1}, ${p2}) {`;
        const nfn = this._pick(this.funcNames.filter(x => x !== fn));
        const eng = new VimEngine(); eng.loadBuffer([line], { row: 0, col: line.indexOf(fn) });
        ['c', 'w', ...nfn.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf(fn) }, targetBuffer: eng.buffer, description: `Rename function "${fn}" to "${nfn}"`, optimalKeystrokes: ['c','w', ...nfn.split(''), 'Escape'], category: 'change', difficulty: 4 };
      }
      {
        const lines = this._simpleLines(), row = this._ri(0, lines.length - 1);
        const semi = lines[row].indexOf(';');
        if (semi < 0) return null;
        const newEnd = ` + ${this._ri(1, 50)};`;
        const target = [...lines]; target[row] = lines[row].slice(0, semi) + newEnd;
        return { initialBuffer: lines, cursorPos: { row, col: semi }, targetBuffer: target, description: 'Change from semicolon to end of line', optimalKeystrokes: ['C', ...newEnd.split(''), 'Escape'], category: 'change', difficulty: 4 };
      }
    }
    {
      const v = this._ri(0, 3);
      if (v === 0) {
        // Change function name AND both string values across two lines
        const fn = this._pick(this.funcNames), nfn = this._pick(this.funcNames.filter(x => x !== fn));
        const [v1, v2] = this._pickN(this.varNames, 2);
        const s1 = this._pick(this.strLiterals), s2 = this._pick(this.strLiterals.filter(x => x !== s1));
        const ns1 = this._pick(this.strLiterals.filter(x => x !== s1 && x !== s2));
        const ns2 = this._pick(this.strLiterals.filter(x => x !== s1 && x !== s2 && x !== ns1));
        const lines = [`function ${fn}(${v1}) {`, `  return "${s1}";`, `}`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['w', 'c', 'w', ...nfn.split(''), 'Escape', 'j', 'f', '"', 'c', 'i', '"', ...ns1.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: `Rename function to "${nfn}" and change string to "${ns1}"`, optimalKeystrokes: ['w', 'c', 'w', ...nfn.split(''), 'Escape', 'j', 'f', '"', 'c', 'i', '"', ...ns1.split(''), 'Escape'], category: 'change', difficulty: 5 };
      }
      if (v === 1) {
        // Change two variable names on different lines using * and dot repeat
        const vn = this._pick(this.varNames), nv = this._pick(this.varNames.filter(x => x !== vn));
        const other = this._pick(this.varNames.filter(x => x !== vn && x !== nv));
        const lines = [`let ${vn} = 0;`, `let ${other} = ${vn};`, `return ${vn};`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['w', 'c', 'w', ...nv.split(''), 'Escape'].forEach(k => eng.processKey(k));
        const target = [...lines]; target[0] = `let ${nv} = 0;`;
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Change the first "${vn}" to "${nv}" (first word after let)`, optimalKeystrokes: ['w', 'c', 'w', ...nv.split(''), 'Escape'], category: 'change', difficulty: 5 };
      }
      if (v === 2) {
        // Replace entire line content and add new line below
        const [v1, v2] = this._pickN(this.varNames, 2);
        const s = this._pick(this.strLiterals), ns = this._pick(this.strLiterals.filter(x => x !== s));
        const newLine = `const ${v2} = "${ns}";`;
        const lines = [`let ${v1} = "${s}";`, `return ${v1};`];
        const target = [newLine, `return ${v1};`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['S', ...newLine.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: `Replace entire first line with new declaration`, optimalKeystrokes: ['S', ...newLine.split(''), 'Escape'], category: 'change', difficulty: 5 };
      }
      {
        // Change all params inside parens AND the string on next line
        const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2);
        const [np1, np2] = this._pickN(this.varNames.filter(x => x !== p1 && x !== p2), 2);
        const s = this._pick(this.strLiterals), ns = this._pick(this.strLiterals.filter(x => x !== s));
        const lines = [`function ${fn}(${p1}, ${p2}) {`, `  return "${s}";`, `}`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['f', '(', 'c', 'i', '(', ...`${np1}, ${np2}`.split(''), 'Escape', 'j', 'f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: `Change params to (${np1}, ${np2}) and string to "${ns}"`, optimalKeystrokes: ['f', '(', 'c', 'i', '(', ...`${np1}, ${np2}`.split(''), 'Escape', 'j', 'f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape'], category: 'change', difficulty: 5 };
      }
    }
  }

  _gen_insert(d) {
    if (d <= 1) {
      const v = this._ri(0, 3);
      if (v === 0) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1), app = ' // ' + this._pick(this.strLiterals); const target = [...lines]; target[row] += app; return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: `Append "${app.trim()}" at end of line`, optimalKeystrokes: ['A', ...app.split(''), 'Escape'], category: 'insert', difficulty: 1 }; }
      if (v === 1) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const nl = `const ${this._pick(this.varNames)} = ${this._ri(1, 100)};`; const target = [...lines]; target.splice(row + 1, 0, nl); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Add a new line below', optimalKeystrokes: ['o', ...nl.split(''), 'Escape'], category: 'insert', difficulty: 1 }; }
      if (v === 2) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const nl = `// ${this._pick(this.strLiterals)}`; const target = [...lines]; target.splice(row, 0, nl); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Add a new line above', optimalKeystrokes: ['O', ...nl.split(''), 'Escape'], category: 'insert', difficulty: 1 }; }
      { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1), pre = '// ' + this._pick(this.strLiterals) + ' '; const target = [...lines]; target[row] = pre + lines[row]; return { initialBuffer: lines, cursorPos: { row, col: lines[row].length - 1 }, targetBuffer: target, description: `Insert "${pre.trim()}" at start of line`, optimalKeystrokes: ['I', ...pre.split(''), 'Escape'], category: 'insert', difficulty: 1 }; }
    }
    if (d <= 3) {
      const lines = this._simpleLines(); const row = 0;
      const text = `  ${this._pick(this.varNames)} = true;`;
      const target = [...lines]; target.splice(row + 1, 0, text);
      return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Insert a new line below with content', optimalKeystrokes: ['o', ...text.split(''), 'Escape'], category: 'insert', difficulty: d };
    }
    if (d === 4) {
      const n = this._ri(3, 4);
      const words = this._pickN(this.varNames, n);
      const lines = words.map(w => `${w} = true`);
      const target = lines.map(l => '// ' + l);
      return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Add "// " prefix to each line using visual block', optimalKeystrokes: ['Ctrl-v', ...Array(n - 1).fill('j'), 'I', '/', '/', ' ', 'Escape'], category: 'insert', difficulty: 4 };
    }
    {
      const v = this._ri(0, 1);
      if (v === 0) {
        // Insert a header comment and a footer comment around existing code
        const lines = this._simpleLines();
        const header = `// --- ${this._pick(this.strLiterals)} ---`;
        const footer = `// --- end ---`;
        const target = [header, ...lines, footer];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Add header comment above and footer comment below all lines', optimalKeystrokes: ['O', ...header.split(''), 'Escape', 'G', 'o', ...footer.split(''), 'Escape'], category: 'insert', difficulty: 5 };
      }
      {
        // Insert "let " prefix on each line AND add a new line at the end
        const n = this._ri(3, 4);
        const words = this._pickN(this.varNames, n);
        const lines = words.map(w => `${w} = 0;`);
        const newLine = `// ${this._pick(this.strLiterals)}`;
        const target = [...lines.map(l => `let ${l}`), newLine];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Add "let " prefix to ${n} lines and add a comment at end`, optimalKeystrokes: ['Ctrl-v', ...Array(n - 1).fill('j'), 'I', 'l', 'e', 't', ' ', 'Escape', 'G', 'o', ...newLine.split(''), 'Escape'], category: 'insert', difficulty: 5 };
      }
    }
  }

  _gen_navigation(d) {
    if (d <= 1) {
      const v = this._ri(0, 1);
      if (v === 0) { const lines = this._getSnippet(), row = this._ri(0, lines.length - 1), col = this._ri(1, Math.max(1, lines[row].length - 1)); return { initialBuffer: lines, cursorPos: { row, col }, targetBuffer: lines, targetCursorPos: { row, col: 0 }, description: 'Move to the beginning of the line', optimalKeystrokes: ['0'], category: 'navigation', difficulty: 1 }; }
      { const lines = this._getSnippet(), row = this._ri(0, lines.length - 1); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: lines, targetCursorPos: { row, col: Math.max(0, lines[row].length - 1) }, description: 'Move to the end of the line', optimalKeystrokes: ['$'], category: 'navigation', difficulty: 1 }; }
    }
    if (d === 2) {
      const lines = this._getSnippet(); if (lines.length < 3) return null;
      const last = lines.length - 1, fnb = this._firstNonBlankOf(lines[last]);
      return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: lines, targetCursorPos: { row: last, col: fnb }, description: 'Move to the last line', optimalKeystrokes: ['G'], category: 'navigation', difficulty: 2 };
    }
    if (d === 3) {
      const lines = this._getSnippet(); if (lines.length < 4) return null; const tr = this._ri(2, lines.length - 1), fnb = this._firstNonBlankOf(lines[tr]); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: lines, targetCursorPos: { row: tr, col: fnb }, description: `Jump to line ${tr + 1}`, optimalKeystrokes: [...String(tr + 1).split(''), 'G'], category: 'navigation', difficulty: 3 };
    }
    if (d === 4) {
      const lines = this._getSnippet(); if (lines.length < 4) return null;
      const openBrace = lines.findIndex(l => l.includes('{'));
      if (openBrace < 0) return null;
      const col = lines[openBrace].indexOf('{');
      const eng = new VimEngine(); eng.loadBuffer(lines.map(l => l), { row: openBrace, col }); eng.processKey('%');
      return { initialBuffer: lines, cursorPos: { row: openBrace, col }, targetBuffer: lines, targetCursorPos: { row: eng.cursor.row, col: eng.cursor.col }, description: 'Jump to the matching brace', optimalKeystrokes: ['%'], category: 'navigation', difficulty: 4 };
    }
    {
      const v = this._ri(0, 2);
      if (v === 0) {
        // Search for a word, then use n to skip to the second occurrence
        const word = this._pick(this.varNames);
        const [o1, o2, o3] = this._pickN(this.varNames.filter(x => x !== word), 3);
        const lines = [`let ${word} = 0;`, `let ${o1} = ${word};`, `let ${o2} = ${word};`, `return ${o3};`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['/', ...word.split(''), 'Enter', 'n', 'n'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: lines, targetCursorPos: { row: eng.cursor.row, col: eng.cursor.col }, description: `Search for "${word}" and jump to the 3rd occurrence`, optimalKeystrokes: ['/', ...word.split(''), 'Enter', 'n', 'n'], category: 'navigation', difficulty: 5 };
      }
      if (v === 1) {
        // Jump to a line, find character, then move to matching bracket
        const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2);
        const lines = [`// header`, `function ${fn}(${p1}, ${p2}) {`, `  return ${p1};`, `}`, `// footer`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['2', 'G', 'f', '{', '%'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: lines, targetCursorPos: { row: eng.cursor.row, col: eng.cursor.col }, description: `Jump to line 2, find "{", then jump to matching "}"`, optimalKeystrokes: ['2', 'G', 'f', '{', '%'], category: 'navigation', difficulty: 5 };
      }
      {
        // Navigate to last line, search backward for a word, go to first non-blank
        const [v1, v2, v3] = this._pickN(this.varNames, 3);
        const s = this._pick(this.strLiterals);
        const lines = [`let ${v1} = "${s}";`, `const ${v2} = ${v1};`, `let ${v3} = 0;`, `return ${v3};`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['G', '?', ...v2.split(''), 'Enter'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: lines, targetCursorPos: { row: eng.cursor.row, col: eng.cursor.col }, description: `Go to last line, search backward for "${v2}"`, optimalKeystrokes: ['G', '?', ...v2.split(''), 'Enter'], category: 'navigation', difficulty: 5 };
      }
    }
  }

  _gen_yank(d) {
    if (d <= 1) {
      const v = this._ri(0, 2);
      if (v === 0) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const target = [...lines]; target.splice(row + 1, 0, lines[row]); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Duplicate the current line below', optimalKeystrokes: ['y','y','p'], category: 'yank', difficulty: 1 }; }
      if (v === 1) { const lines = this._simpleLines(); if (lines.length < 2) return null; const row = this._ri(0, lines.length - 2); const target = [...lines]; [target[row], target[row + 1]] = [target[row + 1], target[row]]; return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Move this line down one', optimalKeystrokes: ['Ctrl-j'], category: 'yank', difficulty: 1 }; }
      { const lines = this._simpleLines(); if (lines.length < 2) return null; const row = this._ri(1, lines.length - 1); const target = [...lines]; [target[row], target[row - 1]] = [target[row - 1], target[row]]; return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Move this line up one', optimalKeystrokes: ['Ctrl-k'], category: 'yank', difficulty: 1 }; }
    }
    if (d <= 3) {
      const lines = this._simpleLines(); if (lines.length < 2) return null;
      const row = this._ri(0, lines.length - 2);
      const target = [...lines]; [target[row], target[row + 1]] = [target[row + 1], target[row]];
      return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Swap with line below using dd+P', optimalKeystrokes: ['d','d','p'], category: 'yank', difficulty: d };
    }
    {
      const v = this._ri(0, 2);
      if (v === 0) {
        // Duplicate first line to both top and bottom
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const target = [lines[0], ...lines, lines[0]];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Duplicate first line above and below all lines', optimalKeystrokes: ['y','y','P','G','p'], category: 'yank', difficulty: d };
      }
      if (v === 1) {
        // Yank 2 lines, delete the originals, paste them at end
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const target = [lines[2], lines[0], lines[1]];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Move first 2 lines to the end of file', optimalKeystrokes: ['2','d','d','G','p'], category: 'yank', difficulty: d };
      }
      {
        // Duplicate last line, move it to top, keeping original
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const last = lines[lines.length - 1];
        const target = [last, ...lines];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Copy last line and paste it above line 1', optimalKeystrokes: ['G','Y','g','g','P'], category: 'yank', difficulty: d };
      }
    }
  }

  _gen_visual(d) {
    if (d <= 1) {
      const v = this._ri(0, 1);
      if (v === 0) { const lines = this._getSnippet(), row = this._ri(0, lines.length - 1); const target = [...lines]; target[row] = '  ' + lines[row]; return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Indent the current line', optimalKeystrokes: ['>','>'], category: 'visual', difficulty: 1 }; }
      { const lines = this._getSnippet(), row = this._ri(0, lines.length - 1); if (!lines[row].startsWith('  ')) return null; const target = [...lines]; target[row] = lines[row].slice(2); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Dedent the current line', optimalKeystrokes: ['<','<'], category: 'visual', difficulty: 1 }; }
    }
    if (d === 2) {
      const v = this._ri(0, 2);
      if (v === 0) { const lines = this._getSnippet(); if (lines.length < 3) return null; const sr = this._ri(0, lines.length - 2), cnt = this._ri(1, Math.min(2, lines.length - 1 - sr)); const target = [...lines]; for (let r = sr; r <= sr + cnt; r++) target[r] = '  ' + lines[r]; return { initialBuffer: lines, cursorPos: { row: sr, col: 0 }, targetBuffer: target, description: `Indent ${cnt + 1} lines`, optimalKeystrokes: cnt === 1 ? ['>','j'] : ['>', String(cnt), 'j'], category: 'visual', difficulty: 2 }; }
      if (v === 1) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const target = [...lines]; target[row] = lines[row].toUpperCase(); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Uppercase the entire line using visual mode', optimalKeystrokes: ['V', 'U'], category: 'visual', difficulty: 2 }; }
      { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const w = lines[row].match(/[a-zA-Z_]\w*/)?.[0]; if (!w) return null; const col = lines[row].indexOf(w); const target = [...lines]; target[row] = lines[row].slice(0, col) + w.toUpperCase() + lines[row].slice(col + w.length); return { initialBuffer: lines, cursorPos: { row, col }, targetBuffer: target, description: `Uppercase "${w}" using visual + U`, optimalKeystrokes: ['v', 'e', 'U'], category: 'visual', difficulty: 2 }; }
    }
    if (d === 3) {
      const v = this._ri(0, 2);
      if (v === 0) { const lines = this._getSnippet(); if (lines.length < 4) return null; const sr = this._ri(0, lines.length - 3); const target = lines.filter((_, i) => i < sr || i > sr + 1); if (!target.length) return null; return { initialBuffer: lines, cursorPos: { row: sr, col: 0 }, targetBuffer: target, description: 'Delete these 2 lines using visual line mode', optimalKeystrokes: ['V', 'j', 'd'], category: 'visual', difficulty: 3 }; }
      if (v === 1) {
        const lines = this._getSnippet(); if (lines.length < 4) return null;
        const sr = this._ri(0, lines.length - 3), cnt = 2;
        const target = [...lines]; const yanked = lines.slice(sr, sr + cnt + 1);
        target.splice(lines.length, 0, ...yanked);
        return { initialBuffer: lines, cursorPos: { row: sr, col: 0 }, targetBuffer: target, description: `Yank ${cnt + 1} lines and paste at the end`, optimalKeystrokes: ['V', ...Array(cnt).fill('j'), 'y', 'G', 'p'], category: 'visual', difficulty: 3 };
      }
      { const n = this._ri(3, 4); const words = this._pickN(this.varNames, n); const lines = words.map(w => `  let ${w} = 0;`); const target = lines.map(l => l.slice(2)); const jKeys = Array(n - 1).fill('j'); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Dedent ${n} lines using visual line mode`, optimalKeystrokes: ['V', ...jKeys, '<'], category: 'visual', difficulty: 3 }; }
    }
    if (d === 4) {
      const v = this._ri(0, 2);
      if (v === 0) { const n = this._ri(3, 4); const words = this._pickN(this.varNames, n); const lines = words.map(w => `let ${w} = 0;`); const target = lines.map(l => '  ' + l); const jKeys = Array(n - 1).fill('j'); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Indent ${n} lines using visual line`, optimalKeystrokes: ['V', ...jKeys, '>'], category: 'visual', difficulty: 4 }; }
      if (v === 1) {
        const n = this._ri(3, 5); const words = this._pickN(this.varNames, n);
        const lines = words.map(w => `${w} = true;`);
        const target = lines.map(l => `let ${l}`);
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Prepend "let " to each line using visual block`, optimalKeystrokes: ['Ctrl-v', ...Array(n - 1).fill('j'), 'I', 'l', 'e', 't', ' ', 'Escape'], category: 'visual', difficulty: 4 };
      }
      {
        const n = this._ri(3, 4); const words = this._pickN(this.varNames, n);
        const lines = words.map(w => `let ${w} = 0;`);
        const target = lines.map(l => l.toUpperCase());
        const jKeys = Array(n - 1).fill('j');
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Uppercase all ${n} lines`, optimalKeystrokes: ['V', ...jKeys, 'U'], category: 'visual', difficulty: 4 };
      }
    }
    {
      const v = this._ri(0, 3);
      if (v === 0) {
        // Visual block: prepend "// " AND append ";" to each line (two operations)
        const n = this._ri(4, 5); const words = this._pickN(this.varNames, n);
        const lines = words.map(w => `${w} = true`);
        const target = lines.map(l => `// ${l};`);
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Comment out ${n} lines AND append ";" using visual block`, optimalKeystrokes: ['Ctrl-v', ...Array(n - 1).fill('j'), 'I', '/', '/', ' ', 'Escape', 'Ctrl-v', ...Array(n - 1).fill('j'), '$', 'A', ';', 'Escape'], category: 'visual', difficulty: 5 };
      }
      if (v === 1) {
        // Visual line: select middle lines, delete them, then paste at top
        const lines = this._getSnippet(); if (lines.length < 5) return null;
        const sr = 1, cnt = 2;
        const selected = lines.slice(sr, sr + cnt);
        const rest = [...lines.slice(0, sr), ...lines.slice(sr + cnt)];
        const target = [...selected, ...rest];
        const jKeys = Array(cnt - 1).fill('j');
        return { initialBuffer: lines, cursorPos: { row: sr, col: 0 }, targetBuffer: target, description: `Move lines ${sr+1}-${sr+cnt} above line 1`, optimalKeystrokes: ['V', ...jKeys, 'd', 'g', 'g', 'P'], category: 'visual', difficulty: 5 };
      }
      if (v === 2) {
        // Visual block prepend "self." (5 chars) - longer than "let "
        const n = this._ri(4, 5); const words = this._pickN(this.varNames, n);
        const lines = words.map(w => `${w} = 0;`);
        const target = lines.map(l => `self.${l}`);
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Prepend "self." to ${n} lines using visual block`, optimalKeystrokes: ['Ctrl-v', ...Array(n - 1).fill('j'), 'I', 's', 'e', 'l', 'f', '.', 'Escape'], category: 'visual', difficulty: 5 };
      }
      {
        // Visual line: select 3 lines, delete, paste at end of remaining
        const lines = this._getSnippet(); if (lines.length < 6) return null;
        const sr = this._ri(1, 2), cnt = 3;
        const selected = lines.slice(sr, sr + cnt);
        const rest = [...lines.slice(0, sr), ...lines.slice(sr + cnt)];
        const target = [...rest, ...selected];
        const jKeys = Array(cnt - 1).fill('j');
        return { initialBuffer: lines, cursorPos: { row: sr, col: 0 }, targetBuffer: target, description: `Move ${cnt} lines to end of file using visual line`, optimalKeystrokes: ['V', ...jKeys, 'd', 'G', 'p'], category: 'visual', difficulty: 5 };
      }
    }
  }

  _gen_compound(d) {
    if (d <= 1) {
      const v = this._ri(0, 3);
      if (v === 0) { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1), col = this._ri(0, Math.max(0, lines[row].length - 1)); const ch = 'abcdefghijlmnopqrstuvwxyz0123456789'[this._ri(0, 35)]; const target = [...lines]; target[row] = lines[row].slice(0, col) + ch + lines[row].slice(col + 1); return { initialBuffer: lines, cursorPos: { row, col }, targetBuffer: target, description: `Replace character with "${ch}"`, optimalKeystrokes: ['r', ch], category: 'compound', difficulty: 1 }; }
      if (v === 1) { const lines = this._simpleLines(); if (lines.length < 2) return null; const row = this._ri(0, lines.length - 2); const target = [...lines]; const cur = target[row], nxt = target[row + 1].trimStart(); target[row] = cur + (nxt ? ' ' + nxt : ''); target.splice(row + 1, 1); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Join with the line below', optimalKeystrokes: ['J'], category: 'compound', difficulty: 1 }; }
      if (v === 2) { const vn = this._pick(this.varNames), val = this._ri(1, 50); const line = `let ${vn} = ${val};`; const target = [line, line]; return { initialBuffer: [line], cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Duplicate this line below', optimalKeystrokes: ['y','y','p'], category: 'compound', difficulty: 1 }; }
      { const lines = this._simpleLines(), row = this._ri(0, lines.length - 1); const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row, col: 0}); eng.processKey('d'); eng.processKey('d'); const target = eng.buffer.slice(); return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Delete this line', optimalKeystrokes: ['d','d'], category: 'compound', difficulty: 1 }; }
    }
    if (d === 2) {
      const v = this._ri(0, 4);
      if (v === 0) { const vn = this._pick(this.varNames), ow = this._pick(this.strLiterals), nw = this._pick(this.strLiterals.filter(x => x !== ow)); const line = `const ${vn} = "${ow}" + "${ow}";`; return { initialBuffer: [line], cursorPos: { row: 0, col: 0 }, targetBuffer: [line.split(ow).join(nw)], description: `Replace all "${ow}" with "${nw}" on this line`, optimalKeystrokes: [';', ...'s/'.split(''), ...ow.split(''), '/', ...nw.split(''), '/','g','Enter'], category: 'compound', difficulty: 2 }; }
      if (v === 1) { const lines = this._simpleLines(); if (lines.length < 2) return null; return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: lines.slice(2), description: 'Delete two lines using dd and dot repeat', optimalKeystrokes: ['d','d','.'], category: 'compound', difficulty: 2 }; }
      if (v === 2) { const line = `let ${this._pick(this.varNames)} = ${this._ri(1, 99)};`; const target = [`// ${line}`]; return { initialBuffer: [line], cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Comment out this line using gcc', optimalKeystrokes: ['g','c','c'], category: 'compound', difficulty: 2 }; }
      if (v === 3) {
        const vn = this._pick(this.varNames), s = this._pick(this.strLiterals);
        const line = `const ${vn} = "${s}";`;
        const target = [`const ${vn} = "${s}";`, `const ${vn} = "${s}";`];
        return { initialBuffer: [line], cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Duplicate line and keep cursor on original', optimalKeystrokes: ['y','y','p'], category: 'compound', difficulty: 2 };
      }
      {
        const lines = this._simpleLines(); if (lines.length < 2) return null;
        const row = this._ri(0, lines.length - 2);
        const target = [...lines]; [target[row], target[row+1]] = [target[row+1], target[row]];
        return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Swap this line with the one below', optimalKeystrokes: ['d','d','p'], category: 'compound', difficulty: 2 };
      }
    }
    if (d === 3) {
      const v = this._ri(0, 4);
      if (v === 0) { const vn = this._pick(this.varNames), val = this._ri(1, 99); const line = `let ${vn} = ${val};`; const target = [`let ${vn} = ${val + 1};`]; return { initialBuffer: [line], cursorPos: { row: 0, col: line.indexOf(String(val)) }, targetBuffer: target, description: 'Increment the number', optimalKeystrokes: ['Ctrl-a'], category: 'compound', difficulty: 3 }; }
      if (v === 1) { const n = this._ri(3, 4); const words = this._pickN(this.varNames, n); const lines = words.map(w => `// let ${w} = 0;`); const target = words.map(w => `let ${w} = 0;`); const jc = n - 1; return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Uncomment ${n} lines using gc`, optimalKeystrokes: ['g','c', ...String(jc).split(''), 'j'], category: 'compound', difficulty: 3 }; }
      if (v === 2) {
        const fn = this._pick(this.funcNames), vn = this._pick(this.varNames), s = this._pick(this.strLiterals);
        const line = `${fn}("${s}")`;
        const ns = this._pick(this.strLiterals.filter(x => x !== s));
        const eng = new VimEngine(); eng.loadBuffer([line], {row: 0, col: 0});
        ['f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: [line], cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: `Navigate to string and change "${s}" to "${ns}"`, optimalKeystrokes: ['f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape'], category: 'compound', difficulty: 3 };
      }
      if (v === 3) {
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const target = [...lines]; target.splice(lines.length, 0, lines[0]);
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Copy first line to end of file', optimalKeystrokes: ['y','y','G','p'], category: 'compound', difficulty: 3 };
      }
      {
        const vn = this._pick(this.varNames), s = this._pick(this.strLiterals);
        const line = `let ${vn} = "${s}";`;
        const target = [`const ${vn} = "${s}";`];
        const eng = new VimEngine(); eng.loadBuffer([line], {row: 0, col: 0});
        ['c', 'w', 'c', 'o', 'n', 's', 't', ' ', 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: [line], cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: 'Change "let" to "const"', optimalKeystrokes: ['c', 'w', 'c', 'o', 'n', 's', 't', ' ', 'Escape'], category: 'compound', difficulty: 3 };
      }
    }
    if (d === 4) {
      const v = this._ri(0, 4);
      if (v === 0) { const vn = this._pick(this.varNames); const line = `const ${vn} = "Hello World";`; const ch = vn[0]; const upper = ch.toUpperCase(); const target = [line.slice(0, 6) + upper + line.slice(7)]; return { initialBuffer: [line], cursorPos: { row: 0, col: 6 }, targetBuffer: target, description: 'Toggle case of character under cursor', optimalKeystrokes: ['~'], category: 'compound', difficulty: 4 }; }
      if (v === 1) { const n = 3; const words = this._pickN(this.varNames, n); const lines = words.map(w => `let ${w} = 0;`); const target = lines.map(l => `// ${l}`); const jc = n - 1; return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Comment out ${n} lines using gc${jc}j`, optimalKeystrokes: ['g','c', ...String(jc).split(''), 'j'], category: 'compound', difficulty: 4 }; }
      if (v === 2) {
        const fn = this._pick(this.funcNames), [p1, p2] = this._pickN(this.varNames, 2), s = this._pick(this.strLiterals);
        const lines = [`function ${fn}(${p1}) {`, `  return "${s}";`, `}`];
        const ns = this._pick(this.strLiterals.filter(x => x !== s));
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row: 0, col: 0});
        ['j', 'f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: `Go to next line, find string, change to "${ns}"`, optimalKeystrokes: ['j', 'f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape'], category: 'compound', difficulty: 4 };
      }
      if (v === 3) {
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const target = [lines[0], lines[2]];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Delete the middle line', optimalKeystrokes: ['j', 'd', 'd'], category: 'compound', difficulty: 4 };
      }
      {
        const [v1, v2] = this._pickN(this.varNames, 2);
        const line = `let ${v1} = "${this._pick(this.strLiterals)}";`;
        const target = [`let ${v1} = "${this._pick(this.strLiterals)}";`, `let ${v2} = 0;`];
        const newLine = `let ${v2} = 0;`;
        return { initialBuffer: [line], cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Add a new variable declaration below', optimalKeystrokes: ['o', ...newLine.split(''), 'Escape'], category: 'compound', difficulty: 4 };
      }
    }
    {
      const v = this._ri(0, 4);
      if (v === 0) {
        // Reverse 3 lines: requires multiple moves
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: [...lines].reverse(), description: 'Reverse the order of all 3 lines', optimalKeystrokes: ['d','d','p','G','d','d','g','g','P'], category: 'compound', difficulty: 5 };
      }
      if (v === 1) {
        // Comment out function body + change function name
        const fn = this._pick(this.funcNames), nfn = this._pick(this.funcNames.filter(x => x !== fn));
        const n = this._ri(2, 3); const words = this._pickN(this.varNames, n);
        const lines = [`function ${fn}() {`, ...words.map(w => `  let ${w} = 0;`), `}`];
        const jc = n - 1;
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['w', 'c', 'w', ...nfn.split(''), 'Escape', 'j', 'g', 'c', ...String(jc).split(''), 'j'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: `Rename function to "${nfn}" and comment out body`, optimalKeystrokes: ['w', 'c', 'w', ...nfn.split(''), 'Escape', 'j', 'g', 'c', ...String(jc).split(''), 'j'], category: 'compound', difficulty: 5 };
      }
      if (v === 2) {
        // Delete middle line, change string on remaining line, add comment at top
        const [v1, v2] = this._pickN(this.varNames, 2);
        const s = this._pick(this.strLiterals), ns = this._pick(this.strLiterals.filter(x => x !== s));
        const comment = `// ${this._pick(this.strLiterals.filter(x => x !== s && x !== ns))}`;
        const lines = [`let ${v1} = "${s}";`, `let ${v2} = 0;`, `return ${v1};`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape', 'j', 'd', 'd'].forEach(k => eng.processKey(k));
        const target = [...eng.buffer];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Change string to "${ns}" and delete the middle line`, optimalKeystrokes: ['f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape', 'j', 'd', 'd'], category: 'compound', difficulty: 5 };
      }
      if (v === 3) {
        // Move last line to top then change its keyword
        const [v1, v2, v3] = this._pickN(this.varNames, 3);
        const nk = this._pick(this.varNames.filter(x => x !== v3));
        const lines = [`let ${v1} = 0;`, `let ${v2} = 1;`, `const ${v3} = 2;`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['G', 'd', 'd', 'g', 'g', 'P', 'w', 'c', 'w', ...nk.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: `Move last line to top, then rename "${v3}" to "${nk}"`, optimalKeystrokes: ['G', 'd', 'd', 'g', 'g', 'P', 'w', 'c', 'w', ...nk.split(''), 'Escape'], category: 'compound', difficulty: 5 };
      }
      {
        // Duplicate first line below, then change string on original, then delete last line
        const [v1, v2] = this._pickN(this.varNames, 2);
        const s = this._pick(this.strLiterals), ns = this._pick(this.strLiterals.filter(x => x !== s));
        const lines = [`const ${v1} = "${s}";`, `let ${v2} = 0;`, `return ${v1};`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['y', 'y', 'p', 'k', 'f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape', 'G', 'd', 'd'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: `Duplicate line 1, change original string to "${ns}", delete last line`, optimalKeystrokes: ['y', 'y', 'p', 'k', 'f', '"', 'c', 'i', '"', ...ns.split(''), 'Escape', 'G', 'd', 'd'], category: 'compound', difficulty: 5 };
      }
    }
  }

  _gen_macro(d) {
    if (d <= 1) {
      const n = 3;
      const words = this._pickN(this.varNames, n);
      const lines = words.map(w => `let ${w} = ${this._ri(1, 99)}`);
      const target = lines.map(l => l + ';');
      const optKeys = ['q', 'a', 'A', ';', 'Escape', 'j', 'q'];
      const repeat = n - 1;
      if (repeat > 1) optKeys.push(...String(repeat).split(''));
      optKeys.push('@', 'a');
      return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Append semicolon to each line using a macro', optimalKeystrokes: optKeys, category: 'macro', difficulty: d };
    }
    if (d === 2) {
      const v = this._ri(0, 1);
      if (v === 0) { const n = this._ri(4, 5); const words = this._pickN(this.varNames, n); const lines = words.map(w => `let ${w} = ${this._ri(1, 99)}`); const target = lines.map(l => l + ';'); const optKeys = ['q', 'a', 'A', ';', 'Escape', 'j', 'q']; const repeat = n - 1; if (repeat > 1) optKeys.push(...String(repeat).split('')); optKeys.push('@', 'a'); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Append semicolon to each line using a macro', optimalKeystrokes: optKeys, category: 'macro', difficulty: 2 }; }
      { const n = this._ri(3, 4); const words = this._pickN(this.varNames, n); const lines = words.map(w => `  ${w}`); const target = words.map(w => w); const optKeys = ['q', 'a', '0', '2', 'x', 'j', 'q']; const repeat = n - 1; if (repeat > 1) optKeys.push(...String(repeat).split('')); optKeys.push('@', 'a'); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Remove leading 2 spaces from each line', optimalKeystrokes: optKeys, category: 'macro', difficulty: 2 }; }
    }
    if (d === 3) {
      const v = this._ri(0, 1);
      if (v === 0) { const n = 4; const words = this._pickN(this.varNames, n); const lines = words.map(w => `- ${w}`); const target = words.map(w => w); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Remove "- " prefix from each line', optimalKeystrokes: ['q', 'a', '0', '2', 'x', 'j', 'q', '3', '@', 'a'], category: 'macro', difficulty: 3 }; }
      { const n = 4; const words = this._pickN(this.varNames, n); const lines = words.map(w => `${w} = true`); const target = words.map(w => `let ${w} = true;`); const optKeys = ['q', 'a', 'I', 'l', 'e', 't', ' ', 'Escape', 'A', ';', 'Escape', 'j', 'q']; const repeat = n - 1; if (repeat > 1) optKeys.push(...String(repeat).split('')); optKeys.push('@', 'a'); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Add "let " prefix and ";" suffix to each line', optimalKeystrokes: optKeys, category: 'macro', difficulty: 3 }; }
    }
    if (d === 4) {
      const v = this._ri(0, 1);
      if (v === 0) { const n = this._ri(3, 5); const words = this._pickN(this.varNames, n); const lines = words.map(w => `  ${w} = ${this._ri(1, 99)};`); const target = lines.map(l => '//' + l); const optKeys = ['q', 'a', '0', 'i', '/', '/', 'Escape', 'j', 'q']; const repeat = n - 1; if (repeat > 1) optKeys.push(...String(repeat).split('')); optKeys.push('@', 'a'); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Comment out each line using a macro', optimalKeystrokes: optKeys, category: 'macro', difficulty: 4 }; }
      { const n = this._ri(3, 4); const words = this._pickN(this.varNames, n); const vals = words.map(() => this._ri(1, 99)); const lines = words.map((w, i) => `let ${w} = ${vals[i]};`); const target = words.map((w, i) => `const ${w} = ${vals[i]};`); const optKeys = ['q', 'a', '0', 'c', 'w', 'c', 'o', 'n', 's', 't', ' ', 'Escape', 'j', 'q']; const repeat = n - 1; if (repeat > 1) optKeys.push(...String(repeat).split('')); optKeys.push('@', 'a'); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Change "let" to "const" on each line using a macro', optimalKeystrokes: optKeys, category: 'macro', difficulty: 4 }; }
    }
    {
      const v = this._ri(0, 2);
      if (v === 0) {
        // Macro: add "self." prefix, ";" suffix, and change "=" to ":"
        const n = this._ri(4, 6); const words = this._pickN(this.varNames, n);
        const vals = words.map(() => this._ri(1, 99));
        const lines = words.map((w, i) => `${w} = ${vals[i]}`);
        const target = words.map((w, i) => `self.${w} = ${vals[i]};`);
        const optKeys = ['q', 'a', 'I', 's', 'e', 'l', 'f', '.', 'Escape', 'A', ';', 'Escape', 'j', 'q'];
        const repeat = n - 1;
        if (repeat > 1) optKeys.push(...String(repeat).split(''));
        optKeys.push('@', 'a');
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Add "self." prefix and ";" suffix to ${n} lines using a macro`, optimalKeystrokes: optKeys, category: 'macro', difficulty: 5 };
      }
      if (v === 1) {
        // Macro: wrap each line in console.log()
        const n = this._ri(4, 5); const words = this._pickN(this.varNames, n);
        const lines = words.map(w => `${w};`);
        const target = words.map(w => `console.log(${w});`);
        const optKeys = ['q', 'a', 'I', 'c', 'o', 'n', 's', 'o', 'l', 'e', '.', 'l', 'o', 'g', '(', 'Escape', 'f', ';', 'i', ')', 'Escape', 'j', 'q'];
        const repeat = n - 1;
        if (repeat > 1) optKeys.push(...String(repeat).split(''));
        optKeys.push('@', 'a');
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Wrap ${n} lines in console.log() using a macro`, optimalKeystrokes: optKeys, category: 'macro', difficulty: 5 };
      }
      {
        // Macro: change "let" to "const", delete value, add "null"
        const n = this._ri(4, 5); const words = this._pickN(this.varNames, n);
        const vals = words.map(() => this._ri(1, 99));
        const lines = words.map((w, i) => `let ${w} = ${vals[i]};`);
        const target = words.map(w => `const ${w} = null;`);
        const optKeys = ['q', 'a', '0', 'c', 'w', 'c', 'o', 'n', 's', 't', ' ', 'Escape', 'f', '=', 'l', 'l', 'c', 't', ';', 'n', 'u', 'l', 'l', 'Escape', 'j', 'q'];
        const repeat = n - 1;
        if (repeat > 1) optKeys.push(...String(repeat).split(''));
        optKeys.push('@', 'a');
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Change "let" to "const" and value to "null" on ${n} lines using a macro`, optimalKeystrokes: optKeys, category: 'macro', difficulty: 5 };
      }
    }
  }

  _gen_search(d) {
    if (d <= 1) {
      const v = this._ri(0, 1);
      if (v === 0) { const word = this._pick(this.varNames); const other1 = this._pick(this.varNames.filter(x => x !== word)); const other2 = this._pick(this.varNames.filter(x => x !== word && x !== other1)); const lines = [`const ${word} = [];`, `let ${other1} = ${word};`, `return ${other2};`]; const col = lines[0].indexOf(word); const targetCol = lines[1].indexOf(word); return { initialBuffer: lines, cursorPos: { row: 0, col }, targetBuffer: lines, targetCursorPos: { row: 1, col: targetCol }, description: `Jump to next occurrence of "${word}"`, optimalKeystrokes: ['*'], category: 'search', difficulty: 1 }; }
      { const word = this._pick(this.strLiterals); const lines = [`let x = "${word}";`, `// ${this._pick(this.strLiterals)}`, `let y = "${word}";`]; const col = lines[0].indexOf(word); return { initialBuffer: lines, cursorPos: { row: 0, col }, targetBuffer: lines, targetCursorPos: { row: 2, col: lines[2].indexOf(word) }, description: `Jump to next "${word}" using *`, optimalKeystrokes: ['*'], category: 'search', difficulty: 1 }; }
    }
    if (d === 2) {
      const v = this._ri(0, 1);
      if (v === 0) { const lines = this._jsSnippet(); const keyword = 'return'; let targetRow = -1, targetCol = -1; for (let r = 0; r < lines.length; r++) { const idx = lines[r].indexOf(keyword); if (idx >= 0) { targetRow = r; targetCol = idx; break; } } if (targetRow <= 0) return null; return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: lines, targetCursorPos: { row: targetRow, col: targetCol }, description: `Navigate to "${keyword}" using search`, optimalKeystrokes: ['/', ...keyword.split(''), 'Enter'], category: 'search', difficulty: 2 }; }
      { const word = this._pick(this.varNames); const lines = [`let ${word} = 0;`, `${word} += 1;`, `// use ${word}`]; const col = lines[2].indexOf(word); return { initialBuffer: lines, cursorPos: { row: 2, col }, targetBuffer: lines, targetCursorPos: { row: 0, col: lines[0].indexOf(word) }, description: `Search backward for "${word}"`, optimalKeystrokes: ['#'], category: 'search', difficulty: 2 }; }
    }
    if (d === 3) {
      const v = this._ri(0, 2);
      if (v === 0) { const word = this._pick(this.varNames); const lines = [`let ${word} = 0;`, `${word} += 1;`, `console.log(${word});`]; const col = lines[0].indexOf(word); return { initialBuffer: lines, cursorPos: { row: 0, col }, targetBuffer: lines, targetCursorPos: { row: 2, col: lines[2].indexOf(word) }, description: `Jump to the last occurrence of "${word}"`, optimalKeystrokes: ['*', 'n'], category: 'search', difficulty: 3 }; }
      if (v === 1) {
        const word = this._pick(this.varNames);
        const lines = [`let ${word} = 0;`, `${word} += 1;`, `return ${word};`];
        const col = lines[0].indexOf(word);
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col});
        ['*', 'c', 'w', ...'x'.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col }, targetBuffer: eng.buffer, description: `Search for "${word}" and change the next occurrence`, optimalKeystrokes: ['*', 'c', 'w', 'x', 'Escape'], category: 'search', difficulty: 3 };
      }
      { const kw = this._pick(['const','let','return','function']); const lines = this._jsSnippet(); let tr = -1, tc = -1; for (let r = 1; r < lines.length; r++) { const idx = lines[r].indexOf(kw); if (idx >= 0) { tr = r; tc = idx; break; } } if (tr < 0) return null; return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: lines, targetCursorPos: { row: tr, col: tc }, description: `Search forward for "${kw}"`, optimalKeystrokes: ['/', ...kw.split(''), 'Enter'], category: 'search', difficulty: 3 }; }
    }
    if (d === 4) {
      const v = this._ri(0, 1);
      if (v === 0) {
        const word = this._pick(this.varNames), nw = this._pick(this.varNames.filter(x => x !== word));
        const lines = [`let ${word} = 0;`, `${word} += 1;`, `return ${word};`];
        const target = [`let ${word} = 0;`, `${nw} += 1;`, `return ${word};`];
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col: lines[0].indexOf(word)});
        ['*', 'c', 'w', ...nw.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: lines[0].indexOf(word) }, targetBuffer: eng.buffer, description: `Jump to next "${word}" and replace with "${nw}"`, optimalKeystrokes: ['*', 'c', 'w', ...nw.split(''), 'Escape'], category: 'search', difficulty: 4 };
      }
      {
        const word = this._pick(this.varNames);
        const lines = [`let ${word} = [];`, `${word}.push(1);`, `${word}.push(2);`, `return ${word};`];
        const target = lines.filter((_, i) => i !== 2);
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Search to line 3 and delete it`, optimalKeystrokes: ['/', ...`${word}.push(2)`.split(''), 'Enter', 'd', 'd'], category: 'search', difficulty: 4 };
      }
    }
    {
      const v = this._ri(0, 2);
      if (v === 0) {
        // Global substitute across many lines
        const word = this._pick(this.varNames), nw = this._pick(this.varNames.filter(x => x !== word));
        const [o1, o2] = this._pickN(this.varNames.filter(x => x !== word && x !== nw), 2);
        const lines = [`let ${word} = 0;`, `${word} += 1;`, `log(${word});`, `return ${word};`];
        const target = lines.map(l => l.split(word).join(nw));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Replace all "${word}" with "${nw}" using substitute`, optimalKeystrokes: [':', ...'%s/'.split(''), ...word.split(''), '/', ...nw.split(''), '/','g','Enter'], category: 'search', difficulty: 5 };
      }
      if (v === 1) {
        // Search + delete: find a pattern and delete 2 lines
        const [v1, v2, v3, v4] = this._pickN(this.varNames, 4);
        const s = this._pick(this.strLiterals);
        const lines = [`let ${v1} = 0;`, `let ${v2} = "${s}";`, `let ${v3} = true;`, `return ${v4};`];
        const target = [`let ${v1} = 0;`, `return ${v4};`];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Search for "${v2}" and delete that line and the next`, optimalKeystrokes: ['/', ...v2.split(''), 'Enter', '2', 'd', 'd'], category: 'search', difficulty: 5 };
      }
      {
        // Rename variable everywhere using substitute
        const word = this._pick(this.varNames), nw = this._pick(this.varNames.filter(x => x !== word));
        const [o1, o2] = this._pickN(this.varNames.filter(x => x !== word && x !== nw), 2);
        const lines = [`let ${word} = 0;`, `let ${o1} = 1;`, `${word} += ${o1};`, `let ${o2} = ${word};`];
        const target = [`let ${nw} = 0;`, `let ${o1} = 1;`, `${nw} += ${o1};`, `let ${o2} = ${nw};`];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: `Rename "${word}" to "${nw}" everywhere`, optimalKeystrokes: [':', ...'%s/'.split(''), ...word.split(''), '/', ...nw.split(''), '/','g','Enter'], category: 'search', difficulty: 5 };
      }
    }
  }

  _gen_marks(d) {
    if (d <= 1) {
      const lines = this._simpleLines(); if (lines.length < 3) return null;
      const comment = '// marked';
      const target = [...lines]; target.splice(0, 0, comment);
      return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Mark position, go to top, insert a comment line, return to mark', optimalKeystrokes: ['m', 'a', 'O', ...comment.split(''), 'Escape', "'", 'a'], category: 'marks', difficulty: 1 };
    }
    if (d === 2) {
      const v = this._ri(0, 1);
      if (v === 0) { const lines = this._simpleLines(); if (lines.length < 3) return null; const comment = '// end'; const target = [...lines]; target.push(comment); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Mark position, go to end, add a line, return to mark', optimalKeystrokes: ['m', 'a', 'G', 'o', ...comment.split(''), 'Escape', "'", 'a'], category: 'marks', difficulty: 2 }; }
      { const lines = this._simpleLines(); if (lines.length < 3) return null; const target = [...lines]; target.splice(lines.length, 0, lines[0]); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Mark line 1, yank it, go to end, paste', optimalKeystrokes: ['m', 'a', 'y', 'y', 'G', 'p'], category: 'marks', difficulty: 2 }; }
    }
    if (d === 3) {
      const v = this._ri(0, 1);
      if (v === 0) {
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const comment = '// end';
        const target = [...lines]; target[0] = '// start'; target.push(comment);
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Mark, go to end and add line, return and change line', optimalKeystrokes: ['m', 'a', 'G', 'o', ...comment.split(''), 'Escape', "'", 'a', 'S', ...('// start').split(''), 'Escape'], category: 'marks', difficulty: 3 };
      }
      {
        const lines = this._getSnippet(); if (lines.length < 5) return null;
        const mr = this._ri(0, 1), tr = lines.length - 1;
        const target = [...lines]; target.splice(tr + 1, 0, lines[mr]);
        return { initialBuffer: lines, cursorPos: { row: mr, col: 0 }, targetBuffer: target, description: 'Mark position, copy line, paste at end, return to mark', optimalKeystrokes: ['m', 'a', 'y', 'y', 'G', 'p', "'", 'a'], category: 'marks', difficulty: 3 };
      }
    }
    if (d === 4) {
      const lines = this._getSnippet(); if (lines.length < 5) return null;
      const mr = 0, delRow = this._ri(2, lines.length - 2);
      const target = lines.filter((_, i) => i !== delRow);
      return { initialBuffer: lines, cursorPos: { row: mr, col: 0 }, targetBuffer: target, description: `Mark line 1, delete line ${delRow + 1}, return to mark`, optimalKeystrokes: ['m', 'a', ...String(delRow + 1).split(''), 'G', 'd', 'd', "'", 'a'], category: 'marks', difficulty: 4 };
    }
    {
      const v = this._ri(0, 2);
      if (v === 0) {
        // Mark position, jump to end, change a line, jump back, delete current line
        const lines = this._getSnippet(); if (lines.length < 6) return null;
        const mr = 1, tr = lines.length - 2;
        const nw = `// ${this._pick(this.strLiterals)}`;
        const target = [...lines]; target[tr] = nw;
        return { initialBuffer: lines, cursorPos: { row: mr, col: 0 }, targetBuffer: target, description: `Mark position, jump to line ${tr + 1}, change it, return`, optimalKeystrokes: ['m', 'a', ...String(tr + 1).split(''), 'G', 'S', ...nw.split(''), 'Escape', "'", 'a'], category: 'marks', difficulty: 5 };
      }
      if (v === 1) {
        // Mark, go to end, add a line, return to mark, change the current line
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const comment = '// end';
        const newFirst = `// ${this._pick(this.strLiterals)}`;
        const target = [...lines]; target[0] = newFirst; target.push(comment);
        const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col:0});
        ['m', 'a', 'G', 'o', ...comment.split(''), 'Escape', "'", 'a', 'S', ...newFirst.split(''), 'Escape'].forEach(k => eng.processKey(k));
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: eng.buffer, description: 'Mark line 1, add comment at end, return and replace line 1', optimalKeystrokes: ['m', 'a', 'G', 'o', ...comment.split(''), 'Escape', "'", 'a', 'S', ...newFirst.split(''), 'Escape'], category: 'marks', difficulty: 5 };
      }
      {
        // Mark two positions, delete line at second mark
        const lines = this._getSnippet(); if (lines.length < 6) return null;
        const mr = 0, delRow = this._ri(3, lines.length - 2);
        const nw = `// ${this._pick(this.strLiterals)}`;
        const target = [...lines]; target[delRow] = nw;
        return { initialBuffer: lines, cursorPos: { row: mr, col: 0 }, targetBuffer: target, description: `Mark position, jump to line ${delRow + 1}, replace it, return`, optimalKeystrokes: ['m', 'a', ...String(delRow + 1).split(''), 'G', 'S', ...nw.split(''), 'Escape', "'", 'a'], category: 'marks', difficulty: 5 };
      }
    }
  }

  _gen_registers(d) {
    if (d <= 1) {
      const lines = this._simpleLines(), row = 0;
      const target = [...lines]; target.splice(row + 1, 0, lines[row]);
      return { initialBuffer: lines, cursorPos: { row, col: 0 }, targetBuffer: target, description: 'Yank line into register "a" and paste', optimalKeystrokes: ['"', 'a', 'y', 'y', '"', 'a', 'p'], category: 'registers', difficulty: d };
    }
    if (d === 2) {
      const v = this._ri(0, 1);
      if (v === 0) { const lines = this._simpleLines(); const target = [...lines]; target.splice(1, 0, lines[0]); return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Yank line into register "a" and paste below', optimalKeystrokes: ['"', 'a', 'y', 'y', '"', 'a', 'p'], category: 'registers', difficulty: 2 }; }
      { const lines = this._simpleLines(); if (lines.length < 3) return null; const w = lines[0].match(/[a-zA-Z_]\w*/)?.[0]; if (!w) return null; const col = lines[0].indexOf(w); const target = [...lines]; const last = target.length - 1; const m2 = target[last].match(/[a-zA-Z_]\w*/); if (!m2) return null; target[last] = target[last].slice(0, target[last].indexOf(m2[0])) + w + target[last].slice(target[last].indexOf(m2[0]) + m2[0].length); const eng = new VimEngine(); eng.loadBuffer(lines.map(l=>l), {row:0, col}); ['"','a','y','i','w','G'].forEach(k => eng.processKey(k)); const m3 = lines[last].match(/[a-zA-Z_]\w*/); const tc = lines[last].indexOf(m3[0]); eng.cursor.col = tc; ['c','w'].forEach(k => eng.processKey(k)); eng.processKey('Ctrl-r'); eng.processKey('a'); eng.processKey('Escape'); return { initialBuffer: lines, cursorPos: { row: 0, col }, targetBuffer: eng.buffer, description: `Yank word to register, paste it on last line`, optimalKeystrokes: ['"','a','y','i','w','G', ...String(tc + 1).split(''), '|', 'c','w','Ctrl-r','a','Escape'], category: 'registers', difficulty: 2 }; }
    }
    if (d === 3) {
      const v = this._ri(0, 1);
      if (v === 0) { const lines = this._simpleLines(); if (lines.length < 3) return null; const target = [lines[0], lines[2], lines[0]]; return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Yank line 1 to "a", delete line 2, paste "a" at end', optimalKeystrokes: ['"', 'a', 'y', 'y', 'j', 'd', 'd', 'G', '"', 'a', 'p'], category: 'registers', difficulty: 3 }; }
      { const lines = this._simpleLines(); if (lines.length < 3) return null; const target = [lines[0], lines[1], lines[2], lines[0], lines[2]]; return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Yank line 1 to "a", line 3 to "b", paste both at end', optimalKeystrokes: ['"','a','y','y','2','j','"','b','y','y','G','"','a','p','"','b','p'], category: 'registers', difficulty: 3 }; }
    }
    if (d === 4) {
      const lines = this._simpleLines(); if (lines.length < 3) return null;
      const target = [lines[2], lines[1], lines[0]];
      return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Reverse 3 lines using named registers', optimalKeystrokes: ['"','a','d','d','"','b','d','d','p','"','a','p','"','b','P'], category: 'registers', difficulty: 4 };
    }
    {
      const v = this._ri(0, 2);
      if (v === 0) {
        // Yank line 1 to "a", change it, paste original at end
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const target = [lines[0], lines[1], lines[2], lines[0]];
        const nw = `// ${this._pick(this.strLiterals)}`;
        target[0] = nw;
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Yank line 1 to "a", change it, paste original at end', optimalKeystrokes: ['"','a','y','y','S', ...nw.split(''), 'Escape', 'G', '"', 'a', 'p'], category: 'registers', difficulty: 5 };
      }
      if (v === 1) {
        // Use two registers: yank line 1 to "a", line 3 to "b", delete line 2, paste both at end
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const target = [lines[0], lines[2], lines[0], lines[2]];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Yank line 1 to "a", line 3 to "b", delete middle, paste both at end', optimalKeystrokes: ['"','a','y','y','2','G','"','b','y','y','k','d','d','G','"','a','p','"','b','p'], category: 'registers', difficulty: 5 };
      }
      {
        // Reverse 3 lines using named registers
        const lines = this._simpleLines(); if (lines.length < 3) return null;
        const target = [lines[2], lines[1], lines[0]];
        return { initialBuffer: lines, cursorPos: { row: 0, col: 0 }, targetBuffer: target, description: 'Reverse 3 lines using named registers', optimalKeystrokes: ['"','a','d','d','"','b','d','d','p','"','a','p','"','b','P'], category: 'registers', difficulty: 5 };
      }
    }
  }

  _fallback(cat) { return { initialBuffer: ['const value = "hello";'], cursorPos: { row: 0, col: 6 }, targetBuffer: ['const  = "hello";'], description: 'Delete the word "value"', optimalKeystrokes: ['d','i','w'], category: cat || 'deletion', difficulty: 1 }; }
}

// Jednorázový převod: české texty v JSX → t('…') (src/i18n). Vypíše použité klíče do scripts/i18n-keys.json.
//   node scripts/i18n-codemod.mjs [--dry]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import ts from 'typescript';

const DRY = process.argv.includes('--dry');
const SRC = 'src';
const FILES = [
  ...readdirSync(join(SRC, 'components')).filter((f) => f.endsWith('.tsx')).map((f) => join(SRC, 'components', f)),
  join(SRC, 'App.tsx'),
];
const ATTRS = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label', 'hint', 'empty', 'text']);
const CALLS = new Set(['showToast', 'confirm', 'alert', 'setError']);
const LETTER = /[A-Za-zÁ-žÀ-ÿ]/;
const CZ = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

const keys = new Set();
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

/** Má smysl překládat? (aspoň písmeno; u řetězců mimo JSX text jen „lidský“ text) */
const human = (s) => LETTER.test(s) && (CZ.test(s) || /\s/.test(s.trim()) || /^[A-ZÁ-Ž][a-zá-ž]+/.test(s.trim()));

for (const file of FILES) {
  const code = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];

  const tplToCall = (node) => {
    // `a ${x} b` → t('a {0} b', x)
    let key = node.head.text;
    const args = [];
    node.templateSpans.forEach((sp, i) => {
      key += `{${i}}` + sp.literal.text;
      args.push(sp.expression.getText(sf));
    });
    keys.add(key);
    return `t(${q(key)}${args.map((a) => `, ${a}`).join('')})`;
  };
  const strToCall = (node) => {
    keys.add(node.text);
    return `t(${q(node.text)})`;
  };
  const wrapExpr = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!human(node.text)) return;
      edits.push([node.getStart(sf), node.getEnd(), strToCall(node)]);
    } else if (ts.isTemplateExpression(node)) {
      const txt = node.head.text + node.templateSpans.map((s) => s.literal.text).join('');
      if (!LETTER.test(txt) || !human(txt)) return;
      edits.push([node.getStart(sf), node.getEnd(), tplToCall(node)]);
    } else if (ts.isConditionalExpression(node)) {
      wrapExpr(node.whenTrue);
      wrapExpr(node.whenFalse);
    } else if (ts.isParenthesizedExpression(node)) {
      wrapExpr(node.expression);
    } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) {
      wrapExpr(node.right);
      if (node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) wrapExpr(node.left);
    }
  };

  const visit = (node) => {
    // JSX text
    if (ts.isJsxText(node)) {
      const raw = node.getFullText(sf);
      const core = raw.trim();
      if (core && LETTER.test(core)) {
        const startOff = raw.indexOf(core);
        let text = core.replace(/\s*\n\s*/g, ' ');
        for (const [e, c] of Object.entries(ENTITIES)) text = text.split(e).join(c);
        keys.add(text);
        const s = node.getFullStart() + startOff;
        edits.push([s, s + core.length, `{t(${q(text)})}`]);
      }
      return;
    }
    // atributy s textem
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (ATTRS.has(name)) {
        if (ts.isStringLiteral(node.initializer)) {
          if (human(node.initializer.text) || LETTER.test(node.initializer.text)) {
            keys.add(node.initializer.text);
            edits.push([node.initializer.getStart(sf), node.initializer.getEnd(), `{${strToCall(node.initializer)}}`]);
          }
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) wrapExpr(node.initializer.expression);
      }
      if (name === 'className' || name === 'key' || name === 'href' || name === 'src') return;
      ts.forEachChild(node, visit);
      return;
    }
    // {výraz} v JSX
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      wrapExpr(node.expression);
    }
    // showToast('…'), confirm('…') …
    if (ts.isCallExpression(node) && CALLS.has(node.expression.getText(sf)) && node.arguments[0]) wrapExpr(node.arguments[0]);
    // setMsg({ kind, text: '…' })
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'text') wrapExpr(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!edits.length) continue;
  // odzadu, bez překryvů
  edits.sort((a, b) => b[0] - a[0]);
  let out = code;
  let lastStart = Infinity;
  for (const [s, e, txt] of edits) {
    if (e > lastStart) continue;
    out = out.slice(0, s) + txt + out.slice(e);
    lastStart = s;
  }
  if (!/from '(\.\.?\/)+i18n'/.test(out)) {
    const rel = relative(dirname(file), join(SRC, 'i18n')).replace(/\\/g, '/');
    const imp = `import { t } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
    const lastImport = [...out.matchAll(/^import .*?;\s*$/gms)].at(-1);
    const at = lastImport ? lastImport.index + lastImport[0].length : 0;
    out = out.slice(0, at) + (at ? '\n' : '') + imp + out.slice(at).replace(/^\n/, '');
  }
  console.log(`${file}: ${edits.length} textů`);
  if (!DRY) writeFileSync(file, out);
}
writeFileSync('scripts/i18n-keys.json', JSON.stringify([...keys].sort(), null, 1));
console.log(`klíčů: ${keys.size}`);

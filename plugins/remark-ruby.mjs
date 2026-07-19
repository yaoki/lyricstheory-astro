/**
 * [base|reading] を <ruby>base<rt>reading</rt></ruby> に変換する remark プラグイン。
 * base 側に | や ] を含めたい場合は \| \] でエスケープする。
 */
import { visit } from 'unist-util-visit';

const RUBY_RE = /\[((?:\\.|[^\]\\|])+)\|((?:\\.|[^\]\\])+)\]/g;

function unescape(s) {
  return s.replace(/\\(.)/g, '$1');
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function remarkRuby() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return;
      const value = node.value;
      if (!value.includes('[')) return;

      const parts = [];
      let last = 0;
      let match;
      RUBY_RE.lastIndex = 0;
      while ((match = RUBY_RE.exec(value)) !== null) {
        if (match.index > last) {
          parts.push({ type: 'text', value: value.slice(last, match.index) });
        }
        const base = unescape(match[1]);
        const rt = unescape(match[2]);
        parts.push({
          type: 'html',
          value: `<ruby>${escapeHtml(base)}<rt>${escapeHtml(rt)}</rt></ruby>`,
        });
        last = match.index + match[0].length;
      }
      if (parts.length === 0) return;
      if (last < value.length) {
        parts.push({ type: 'text', value: value.slice(last) });
      }
      parent.children.splice(index, 1, ...parts);
      return index + parts.length;
    });
  };
}

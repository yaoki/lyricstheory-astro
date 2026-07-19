/**
 * h2 と h3 の見出しから TOC を抽出し frontmatter に注入する remark プラグイン。
 * Astro 側では `render(post)` の返り値 `remarkPluginFrontmatter.toc` として読める。
 *
 * 見出しの ID は rehype-slug が付ける想定（そのため slug は同ルールで生成）。
 * TOC は [{ depth: 2|3, text, slug }, ...] の配列で提供する。
 */
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';

export default function remarkTocExtract() {
  return (tree, file) => {
    const slugger = new GithubSlugger();
    const toc = [];
    visit(tree, 'heading', (node) => {
      if (node.depth !== 2 && node.depth !== 3) return;
      const text = toString(node);
      const slug = slugger.slug(text);
      toc.push({ depth: node.depth, text, slug });
    });
    file.data.astro = file.data.astro || {};
    file.data.astro.frontmatter = file.data.astro.frontmatter || {};
    file.data.astro.frontmatter.toc = toc;
  };
}

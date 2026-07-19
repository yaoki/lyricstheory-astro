/**
 * 記事の最初の画像 URL を frontmatter に注入する remark プラグイン。
 * Astro 側では `render(post)` の返り値 `remarkPluginFrontmatter.firstImage` として読める。
 * OGP/schema.org Article の image に使う。
 */
import { visit } from 'unist-util-visit';

export default function remarkFirstImage() {
  return (tree, file) => {
    let firstImage = null;
    visit(tree, 'image', (node) => {
      if (firstImage) return false;
      firstImage = node.url;
      return false;
    });
    file.data.astro = file.data.astro || {};
    file.data.astro.frontmatter = file.data.astro.frontmatter || {};
    file.data.astro.frontmatter.firstImage = firstImage;
  };
}

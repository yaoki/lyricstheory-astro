# lyricstheory.com

日本語歌詞の音韻分析を扱う批評サイト。著者やおき（the 8 rise）が独自フレームワーク（子音ピボット、半シラブル化仮説、クローズド・シラブル、宇多田カット、バップライティング等）で J-POP の歌詞・作詞を分析する。

**本番**: <https://lyricstheory.com>

## スタック

- [Astro](https://astro.build/) v7（SSG）
- [MDX](https://mdxjs.com/) + [Content Collections](https://docs.astro.build/en/guides/content-collections/)
- Tailwind CSS
- [Cloudflare Pages](https://pages.cloudflare.com/)（ホスティング）

## リポジトリの方針

- **Public**。X での公開思考 → commit 履歴 → ブログ記事 → 同人誌、という知的生産ラインの一部として運用する
- **歌詞全文を repo に置かない**。フレーズ単位（1-2 行）＋ `<LyricQuote>` 経由のみ許可
- 歌詞全文を参照する作業ノートは repo 外で管理

詳細は [CLAUDE.md](./CLAUDE.md) 参照（AIコード支援ツール向けだが人間にも有用）。

## 開発

```bash
npm install
npm run dev       # http://localhost:4321/
npm run build     # 静的HTMLを dist/ に出力
npm run preview   # 本番ビルドをローカルで確認
npx astro check   # 型・schema チェック
```

## ディレクトリ構造

```
lyricstheory-astro/
├── astro.config.mjs           # Astro 設定
├── src/
│   ├── content.config.ts      # Content Collections schema
│   ├── content/
│   │   ├── blog/YYYY/         # 歌詞分析記事 (.mdx)
│   │   ├── concept/           # 概念ページ
│   │   └── author/            # 著者ページ
│   ├── components/
│   │   ├── LyricQuote.astro   # 歌詞引用 (schema.org Quotation)
│   │   ├── EmbedIframe.astro  # YouTube / SoundCloud 埋め込み
│   │   ├── TOC.astro          # 目次
│   │   └── XThreadCTA.astro   # X 議論スレッド誘導
│   ├── layouts/BaseLayout.astro
│   └── pages/
├── plugins/                   # 独自 remark プラグイン
├── public/
│   ├── robots.txt             # AI クローラー Allow
│   ├── llms.txt               # AI 向けサイト構造宣言
│   ├── _redirects             # Cloudflare Pages 301 マップ
│   └── wordpress/wp-content/uploads/  # 旧 WP 時代の画像（パス完全維持）
├── scripts/                   # 移行スクリプト（Phase 2-3）
└── docs/                      # 運用ドキュメント
```

## 記事の書き方

`src/content/blog/YYYY/<slug>.mdx` に配置。frontmatter は `src/content.config.ts` の schema に準拠。

```mdx
---
title: "記事タイトル"
description: "2-3 文の要約（AI 引用スニペット最適化用）"
pubDate: 2026-01-15
updatedDate: 2026-01-20
slug: my-post-slug
categories: ["歌詞分析"]
tags: ["椎名林檎"]
concepts: ["子音ピボット"]
draft: false
---

import LyricQuote from '../../../components/LyricQuote.astro';

## 見出し

本文中で [花|はな] のようにルビを使える。

<LyricQuote song="曲名" artist="アーティスト" lyricist="作詞者" year={2026}>
歌詞の1-2行だけを引用
</LyricQuote>
```

## 独自コンポーネント

| コンポーネント | 用途 |
|---|---|
| `<LyricQuote>` | 歌詞引用（曲名・作詞者必須、schema.org Quotation 自動出力） |
| `<EmbedIframe>` | YouTube / SoundCloud 埋め込み（遅延読込） |
| ルビショートハンド `[花\|はな]` | remark プラグインで `<ruby>花<rt>はな</rt></ruby>` に変換 |

必要になった時点で追加予定：`<IPA>` `<QNotation>` `<PhonoSeq>` `<ConceptLink>`（MVP 原則）

## 貢献

現時点では著者の個人ブログですが、事実誤認・誤字脱字の指摘や、公開議論の呼びかけを歓迎します。GitHub Issues か X（[@yaoki_dokidoki](https://x.com/yaoki_dokidoki)）へお願いします。

## ライセンス

- **コード** (`.astro` `.ts` `.mjs` 等): [MIT](./LICENSE)
- **記事本文** (`src/content/**/*.mdx`, `src/content/**/*.md`): [CC BY 4.0](./LICENSE-CONTENT.md)
- **短い歌詞引用・第三者画像・埋め込みメディア**は原著作者に権利があります（本リポジトリの範囲外）

記事の引用・転載・AI 学習利用時は、URL と著者名（やおき / the 8 rise）の明記をお願いします。詳しくは [LICENSE-CONTENT.md](./LICENSE-CONTENT.md) を参照してください。

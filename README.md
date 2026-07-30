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

## OG 画像（音韻の図）

elements カード 1 枚につき、X のサムネイル用の PNG（1200×630）が**ビルド時に自動生成される**。手で画像を作る必要はない。

図は「何が繰り返されているか」を一目で示すことを狙っている。枠に音を並べ、呼応する音を強調し、そのあいだを弧で結ぶ。

### 図を起こす

フレーズを渡すだけで起こせる。呼応する音を `「」` で囲む。

```bash
npm run figure -- 'おと「し」て「し」まう'
```

frontmatter に貼る YAML が出て、プレビュー PNG が開く。

```yaml
figure:
  kind: symmetry
  units: ["お", "と", "し", "て", "し", "ま", "う"]
  highlight: [2, 4]
```

- `「」` で囲んだ音が強調され、囲みどうしが弧で結ばれる
- 前後の文脈もそのまま枠に並ぶ（対称がフレーズのどこで起きているかを図に残すため）
- `units` の上限は 8 音。**著作権上のガードレール**で、超えたぶんは呼応する範囲を残したまま外側から落とされる
- `figure` を書かなければ、タイトルとサイト名だけの絵になる（書き忘れても壊れない）

同じフレーズに呼応が二組あるときは、二組目を `〈〉`、三組目を `〔〕` で囲む。組ごとに色が変わり、別々の弧で結ばれる。

```bash
npm run figure -- 'なく「し」〈た〉あ〈た〉「し」は'
```

```yaml
figure:
  kind: symmetry
  units: ["な", "く", "し", "た", "あ", "た", "し", "は"]
  highlight: [[2, 6], [3, 5]]   # 外側の「し…し」と内側の「た…た」
```

入れ子になっている弧は段違いに描かれるので、どちらがどちらを包んでいるかが読める。

### 母音の図

子音は動いていて母音だけが留まっている、という形には `--vowel` を使う。音節を上段に並べ、母音だけを下段に抜き出して塗る。

```bash
npm run figure -- --vowel 'たちど「ま」っ「た」「ま」「ま」'
```

母音は表記から自動で導かれるので、書き手が打ち込む必要はない。「ん」「っ」は母音を持たないので下段が空き、長音「ー」は直前の母音を引き継ぐ。

導出は**表記ベース**で、助詞の「は」は /a/ として扱う（発音の /wa/ には寄せない）。合わないときだけ `vowels:` を書いて明示する。

### 他のサイトへ持っていく

生成部分はこのサイト固有の作りにほとんど依存していない。歌詞分析のブログを作る方は以下で移植できる（コードは MIT）。

1. `npm i @resvg/resvg-js` を入れ、日本語の **ttf/otf** を `fonts/` に置く（Noto Sans JP など。OFL なら同梱してよい。woff/woff2 は読めない）
2. `src/lib/og/` をまるごとコピーする。5 ファイルとも Astro にも本サイトにも依存しない関数で、タイトルと音の列を渡すと SVG 文字列が返るだけ
3. `src/lib/og/layout.ts` の `SITE_NAME` と `COLORS` を自分のサイトのものに変える
4. `src/pages/og/[slug].png.ts` をコピーし、`getCollection('elements')` を自分のコレクション名に変える
5. コレクションの schema に `figure` を足す（`src/content.config.ts` の `figureSchema` をコピー）
6. `<head>` に `og:image`（**絶対 URL**）と `twitter:card: summary_large_image` を出す。相対パスは X に無視される

Astro 以外（Next.js / Eleventy 等）でも、4 の 20 行ほどを書き直せば動く。1〜3 と 5 はそのまま使える。

**注意**: `loadSystemFonts: false` を明示してフォントを同梱すること。システムフォント任せにすると、日本語フォントの無いビルド環境で豆腐（□□□）になる。

## 貢献

現時点では著者の個人ブログですが、事実誤認・誤字脱字の指摘や、公開議論の呼びかけを歓迎します。GitHub Issues か X（[@yaoki_dokidoki](https://x.com/yaoki_dokidoki)）へお願いします。

## ライセンス

- **コード** (`.astro` `.ts` `.mjs` 等): [MIT](./LICENSE)
- **記事本文** (`src/content/**/*.mdx`, `src/content/**/*.md`): [CC BY 4.0](./LICENSE-CONTENT.md)
- **短い歌詞引用・第三者画像・埋め込みメディア**は原著作者に権利があります（本リポジトリの範囲外）

記事の引用・転載・AI 学習利用時は、URL と著者名（やおき / the 8 rise）の明記をお願いします。詳しくは [LICENSE-CONTENT.md](./LICENSE-CONTENT.md) を参照してください。

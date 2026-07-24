# lyricstheory.com — Astro プロジェクト

日本語歌詞の音韻分析サイト。WordPress からの移行プロジェクト。上位仕様は `../tasks/lyricstheory-astro-migration-spec.md` を必ず参照。

## 執筆規約

- 記事は `src/content/blog/YYYY/<slug>.mdx` 形式で作成
- frontmatter は `src/content.config.ts` の schema に厳密準拠（欠落フィールドはビルドエラー）
- 歌詞引用は必ず `<LyricQuote song="..." artist="..." lyricist="...">` を経由。生の歌詞ブロックは書かない
- ルビは `[花|はな]` ショートハンドを使用（remark プラグインで自動変換）
- IPA・Q notation・音韻的ゼクエンツは、それを含む記事に初めて遭遇したときにコンポーネント（`<IPA>` `<QNotation>` `<PhonoSeq>`）を作成する（MVP原則）

## URL 構造

- 本番ホスト名: `lyricstheory.com`
- permalink: `/{slug}/`（投稿名のみ、末尾スラッシュ付き）
- 既存 slug は変更しない（SEO 資産の維持）
- `astro.config.mjs` で `trailingSlash: 'always'`, `build.format: 'directory'` 設定済み
- **画像パス**: `/wordpress/wp-content/uploads/YYYY/MM/xxx.ext`（WPがサブディレクトリインストールだった歴史的経緯）。`public/wordpress/wp-content/uploads/` に配置し、記事本文の src はこの絶対パスを維持する

## リポジトリ公開ポリシー（Public 運用）

- リポジトリは Public 前提
- **歌詞全文を repo に置かない**。フレーズ単位（1-2 行）＋ `<LyricQuote>` 経由のみ許可
- 歌詞全文を参照する作業ノートは repo 外（Obsidian / iPhone メモ）で管理
- 自律セッション中でも歌詞全文・長尺引用をファイルへ書き込まない

## モデル使用指針

- ドラフト生成・分析: Opus 4.8（ultracode）
- ルーチン変換・機械的チェック: Sonnet 5 / Haiku 4.5
- オーバーナイト移行バッチ: Sonnet 5 with 明示的 stopping criteria

## elements コレクション

上位仕様: `../tasks/lyricstheory-digital-garden-spec.md`（v0.2）。詳細な設計意図はそちらを参照。

### 二層構造

- **essays**（`src/content/blog/`）= 結晶層。既存の完成記事。permalink `/{slug}/` は変更しない。
- **elements**（`src/content/elements/`）= 庭層。分析の最小単位を1件1ファイル（MDX）で持つ新設コレクション。子音ピボットの個別事例、音韻的ゼクエンツの型、押韻パターンなど。公開後も編集し続ける常緑運用。URL は `/elements/{slug}/`。

### 成熟度（maturity）

- `seed`: 観察メモ。断片で良い。
- `budding`: 他カードとの関連（`related`）が1本以上張られた状態。
- `evergreen`: 定義・事例・反例が揃い、essay から安心して参照できる状態。

### type（推奨語彙）

`type` は enum ではなく `z.string()`。カードが10〜20枚溜まってから enum 化を検討する。当面の推奨7語彙:

`pivot | sequenz | rhyme | syllable | prosody | pattern | other`

- **pattern**: 反復パターンの上位型。距離のバリエーション（連続反復・1音おき反復・2音おき反復・倒置反復 等）を含む。サブカテゴリの細分化は該当カードが5枚以上溜まってから判断する。

### phoneme romaji 正規化ルール（重要・厳守）

`tags.phoneme` は romaji 小文字で表記する。表記が揺れるとコリジョン照合（将来実装）が壊れるため、以下を必ず守る:

1. 撥音「ん」は `n`
2. 促音「っ」は次の子音を重複させず、独立した `q` として表記する
3. 長音は母音を重複させず単独表記する（例: 「カー」は `ka`、長音記号は捨てる）
4. ローマ字化はヘボン式を採用する（訓令式ではない）。例: `shi`（し）, `chi`（ち）, `tsu`（つ）, `fu`（ふ）, `ji`（じ）
5. 拗音は2文字で表記する（例: `kya`, `sha`, `cho`）
6. 母音単独は `a i u e o`

### 引用ルール

1カードあたりの歌詞引用は、分析に必要な最小フレーズ（1〜2行以内）に限定する。既存の Public repo ガードレール（上記「リポジトリ公開ポリシー（Public 運用）」、上位仕様 10.5 相当）は elements 配下にも同様に適用する。

### seed と作業ノートの分離（重要）

- **seed（種）** = 「粗いけれど公開する」観察。カード本文に書く。maturity=seed の段階では未成熟でよい。
- **作業ノート** = 「そもそも公開しない」裏方メモ。流通歌詞との突き合わせ確認、メタデータの裏取り、リマインダー等が該当。**repo に置かない**（Obsidian / iPhone メモに退避）。

seed と作業ノートの違いは成熟度ではなく「公開ルートに乗せるかどうか」。カード生成時に「照合メモ」「裏取り」「確認済み」のような節を作らない。書誌情報は `sources` frontmatter に置く（本文で重複させない）。

### カードテンプレート

`src/content/elements/_template.mdx.txt` を参照。拡張子を `.mdx.txt` にすることで content collection の glob（`**/*.{md,mdx}`）にマッチしないようにしてある。新規カード作成時はこの内容をコピーして `.mdx` 拡張子で保存する。

## Phase 進行

- **Phase 1**: 足場作り（現在）
- **Phase 2**: WXR/wpress エクスポート、13 記事の棚卸し、変換パイプライン
- **Phase 3**: 一括移行 + 独自表現コンポーネントの必要時作成
- **Phase 4**: AI 検索対策（schema.org, llms.txt, robots.txt, sitemap）
- **Phase 5**: Cloudflare Pages デプロイ・DNS 切替
- **Phase 6**: Coreserver 解約

## 開発コマンド

```
npm run dev       # ローカル開発サーバー
npm run build     # 本番ビルド
npm run preview   # ビルド結果のプレビュー
npx astro check   # 型・schema チェック
```

## MDX で使えるコンポーネント（現時点）

- `<LyricQuote song artist lyricist [year] [cite]>` — 歌詞引用（schema.org Quotation 出力）
- ルビショートハンド `[漢字|かんじ]` — remark プラグインで自動変換

必要になった時点で追加するコンポーネント：`<IPA>` `<QNotation>` `<PhonoSeq>` `<ConceptLink>`

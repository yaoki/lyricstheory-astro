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

### 理論用語

想起・短期反復・回帰反復、四操作、同音／類音、隠蔽、ぷよぷよ（仮称）の定義は `docs/theory-glossary.md` にある。**定義の参照先はそこ一箇所**とし、カードやスキルに写しを置かない。

Chat からは `https://raw.githubusercontent.com/yaoki/lyricstheory-astro/main/docs/theory-glossary.md` で読める。

### 反復の類型（`tags.repetition`）

COMITIA156 本で確定した三類型をそのまま使う。定義は `../comitia156/full_manuscript_v1.6_integrated_20260531.md` の用語集。

| 値 | 意味 |
|---|---|
| `c` | C反復。子音のみが一致する |
| `v` | V反復。母音のみが一致する |
| `cv` | CV反復。子音と母音の両方が一致する |

**この三つは類型であって単位ではない。** 単位は譜割シラブルと、その内部の C・V である。「基礎単位が CV だ」という言い方をしないこと（本文が明示的に退けている）。

一致が同音か類音かは**別の軸**であり、この値には含めない。たとえば `tadashii-machi-aba-voicing`（ひ・と・び／だ・し・た）は母音が完全一致し子音が清濁の類音なので `cv` である。類音であることは本文に書く。

2026-07-26 に全14枚へ付与済み（c 5枚 / v 3枚 / cv 6枚）。

### phoneme romaji 正規化ルール（重要・厳守）

`tags.phoneme` は romaji 小文字で表記する。表記が揺れるとコリジョン照合（将来実装）が壊れるため、以下を必ず守る:

1. 撥音「ん」は `n`
2. 促音「っ」は次の子音を重複させず、独立した `q` として表記する
3. 長音は母音を重複させず単独表記する（例: 「カー」は `ka`、長音記号は捨てる）
4. ローマ字化はヘボン式を採用する（訓令式ではない）。例: `shi`（し）, `chi`（ち）, `tsu`（つ）, `fu`（ふ）, `ji`（じ）
5. 拗音は2文字で表記する（例: `kya`, `sha`, `cho`）
6. 母音単独は `a i u e o`

### artist 表記の正規化ルール（重要・厳守）

`tags.artist` および slug 中のアーティスト名は、**本人が使う公式英語表記**に準拠する。機械的なヘボン式ローマ字化を優先しない。

- 椎名林檎 → `sheena-ringo`（**`shiina-ringo` ではない**。本人の公式英語表記が "Sheena Ringo"）
- SOUL'd OUT → `souldout`
- 公式英語表記が存在しない場合のみヘボン式（例: 関ゆみ子 → `seki-yumiko`）

理由は二つ。

1. **essays 側の slug が既にこの規約で運用されている**（`sheena-ringo-repeated-consonance`）。essays の slug は WordPress 時代からの SEO 資産で変更できないため、elements 側を合わせる
2. コリジョン・インデックス（上位仕様 §3、`phoneme × artist` の共起集計）は artist の文字列一致で組む。表記が割れると**同一アーティストが二人に分裂したまま集計される**

2026-07-25 に elements 11枚を `shiina-ringo` から `sheena-ringo` へ統一済み。

### slug 命名規約（essays に準拠）

「既存規約」とは、WordPress 移植前から続く **essays の slug の規則性**を指す。elements もこれに従う。

- **内容語は英語**で書く（`repeated-consonance` / `closed-syllable-consonant` / `how-to-place`）。日本語のローマ字化を使わない
- **固有名詞のみ romaji**（`utada-hikaru` / `sekai-no-owari` / `dragon-night` / `tadashii-machi`）。アーティスト名は上記の artist 正規化ルールに従う
- 音韻要素は綴りで表す（`where-to-place-ii-` / `where-to-place-nn-` / `i-dan-`）
- elements の全体形は `<曲slug>-<観察slug>`（例: `tadashii-machi-t-pivot`）

**注意**: この slug 規約は、上記「phoneme romaji 正規化ルール」とは**適用対象が異なる**。phoneme タグは促音を `q`・長音を単独表記とするが、slug は曲名の流通する読みをそのまま綴る（`yumeippai` / `tadashii`）。混同しないこと。

2026-07-25 に未適合だった3枚を英語へ統一済み。

| 旧 | 新 | 語の出所 |
|---|---|---|
| `wekapipo-boin-kotei` | `wekapipo-fixed-vowel-a` | 対象の音を末尾に綴る（essays の `where-to-place-ii-` に倣う） |
| `tadashii-machi-kaiki-hanpuku` | `tadashii-machi-return-repetition` | 「回帰」は沼野雄司『ファンダメンタルな楽曲分析入門』からの借用概念。主題が間に別素材を挟んで再び現れる現象。西洋形式論では return |
| `tadashii-machi-aba-seidaku` | `tadashii-machi-aba-voicing` | 清濁＝voicing。言語学の一般語 |

**注意**: `return` は**確定訳ではない**。「回帰」の出典である沼野雄司『ファンダメンタルな楽曲分析入門』が英語を併記しているかは未確認である（日本語文献）。現状は西洋形式論の慣用に基づく採用にとどまる。確定させるには沼野の当該箇所を確認すること。

**2026-07-27 訂正**: 上記の出典を、それ以前の記録は石桁真礼生『楽式論』としていたが誤り。正しくは沼野雄司『ファンダメンタルな楽曲分析入門』。`tasks/blog-comitia156-announcement.md:325` にやおき自身が「回帰という語は沼野雄司『ファンダメンタルな楽曲分析入門』に由来する借用です」と書いている。

### タイトル規約（重要）

カード title は「**アーティスト『曲名』：観察名**」の順で記す。目的はカード単体で「誰の・何の曲の・何の観察か」が伝わることを担保すること。一覧ページや X 経由の初見読者に対して、タイトルだけで文脈が復元できる状態にする。

- 例: `SOUL'd OUT『ウェカピポ』：ア母音固定による子音運動の可観測化`
- 例: `椎名林檎『シドと白昼夢』：一音を挟む対称形（ABA）`
- アーティスト名は本人が使う表記（英語表記なら英語、日本語なら日本語）
- 曲名は流通表記（『』で囲む）
- 観察名は yaoki が確定した呼称。形式ラベル（ABA、AABBAB 等）があれば括弧で末尾に

`sources` frontmatter や `tags.artist` は機械可読側の情報。タイトルは人間可読側として、これらと重複しても独立に十分な情報を持たせる。

### 引用ルール

1カードあたりの歌詞引用は、分析に必要な最小フレーズ（1〜2行以内）に限定する。既存の Public repo ガードレール（上記「リポジトリ公開ポリシー（Public 運用）」、上位仕様 10.5 相当）は elements 配下にも同様に適用する。

### seed と作業ノートの分離（重要）

- **seed（種）** = 「粗いけれど公開する」観察。カード本文に書く。maturity=seed の段階では未成熟でよい。
- **作業ノート** = 「そもそも公開しない」裏方メモ。流通歌詞との突き合わせ確認、メタデータの裏取り、リマインダー等が該当。**repo に置かない**（Obsidian / iPhone メモに退避）。

seed と作業ノートの違いは成熟度ではなく「公開ルートに乗せるかどうか」。カード生成時に「照合メモ」「裏取り」「確認済み」のような節を作らない。書誌情報は `sources` frontmatter に置く（本文で重複させない）。

### カードテンプレート

`src/content/elements/_template.mdx.txt` を参照。拡張子を `.mdx.txt` にすることで content collection の glob（`**/*.{md,mdx}`）にマッチしないようにしてある。新規カード作成時はこの内容をコピーして `.mdx` 拡張子で保存する。

### 新規 element カードのデプロイ workflow

Chat 側（lyric-analysis-memo スキル）で生成された MDX を受け取ってから、以下の順で lyricstheory.com に公開する。単独で「デプロイして」と依頼された場合の標準手順。

1. **配置**: `src/content/elements/{slug}.mdx` にファイル作成。slug は既存規約に従う（上記「ファイル名規則」）
2. **schema 検証**: `npx astro check` を実行。0 errors / 0 warnings を確認
3. **タイトル規約チェック**: `title` が「アーティスト『曲名』：観察名」の形式になっているか確認。抜けていれば整える
4. **本文の裏取り除去**: 「照合メモ」「裏取り」「確認済み」等の節を含んでいたら削除（seed と作業ノートの分離ルール）
5. **related の双方向更新**: `related` に他カード slug を書くなら、相手側カードの `related` にも今回の slug を追加。相手側の `updated` も本日に更新（現状 related は宣言側のみに表示されるため、双方向にしたければ両方書く）。**`maturity` の昇格は Claude の判断に委ねる**（yaoki は seed / budding / evergreen の遷移にこだわりを持たない、2026-07-25 確認）。定義どおり、related が1本入った側は両方とも budding に上げてよい
6. **staging**: `git add src/content/elements/` — 相手側カード更新や CLAUDE.md 変更があればそれも含める。**posfie-*.md 等の別作業由来の未コミット差分は絶対に一緒に staging しない**。今回スコープの変更のみ選択的に `git add`
7. **commit**: 日本語 commit message で「何を」「なぜ」を書く。末尾に以下の署名を付ける。**モデル名は実際に作業したモデルを書く**（下記は記法の例であり、バージョンを固定値として扱わない。誤ったモデルへの帰属を残さないため）:
   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
   ```
8. **push**: `git push origin main` → Cloudflare Pages が自動でビルド・デプロイ（1-3分）
9. **到達確認**: 数分後、`curl -sI https://lyricstheory.com/elements/{slug}/` で HTTP 200 を確認

### `src/pages/404.astro` を削除しないこと（重要）

Cloudflare Pages は、ビルド出力のトップに `404.html` が無いとサイトを SPA とみなし、**未知のパスへ `index.html` を HTTP 200 で返す**。この状態では、

- 存在しない URL が「有効なページ」として扱われる（検索エンジンにはソフト 404）
- 上記の到達確認（HTTP 200 判定）が**検証として機能しない**。タイポしたスラッグでも 200 が返るため

2026-07-25 に `src/pages/404.astro` を追加して解消済み。このページは見た目のためではなく、**`dist/404.html` を生成させるために存在する**。

MDX が渡されず「デプロイ」だけ言われた場合は、まず対象 MDX の場所（貼付を待つ、既にディレクトリ内にあるなら明示）を確認してから実行する。推測で進めない。

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

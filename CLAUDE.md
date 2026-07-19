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

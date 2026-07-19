# Posfie（旧 Togetter）記事をブログに集約する TODO（将来対応）

やおきさんの Posfie アカウント: https://posfie.com/@yaoki_dokidoki

X（Twitter）ツイートをキュレーションしてまとめた記事群を、lyricstheory.com に集約する（別セッションで対応）。

## 目的

- X 上での公開思考 → Posfie でのまとめ → ブログ→ 同人誌、という知的生産ラインの一部（仕様書 10.5 のコミュニティ寄与シナジー方針）
- Posfie に散在させておくと後年アクセスできなくなるリスク（サービス終了・仕様変更）
- ブログに集約することで、AI Answer Engine への引用資産にもなる

## Phase 3-4 で確立した資産（そのまま流用可能）

- Content Collections `blog` schema（`src/content.config.ts`）— 音韻分析以外のエッセイ的記事も受け入れられる汎用スキーマ
- 変換パイプライン（`scripts/convert.mjs`）— 逐語保存・テキストdiff検証の仕組み
- `<LyricQuote>` `<EmbedIframe>` などの MDX コンポーネント
- schema.org Article / OGP / TOC 自動生成

## 想定される作業

1. **Posfie 記事の棚卸し**: プロフィールから記事一覧をスクレイピング（`https://posfie.com/@yaoki_dokidoki` の一覧をリンク抽出）
2. **カテゴリ設計**: 「歌詞分析」「作詞課題」「エッセイ」の既存カテゴリで受け入れられるか、新カテゴリが必要か検討
3. **X ツイート引用の扱い**: Posfie の埋め込みツイート → 本文への静的引用に変換（X 側で削除されても本文が残るように、text + author + URL の3点セットを保存）
4. **タイムライン整理**: 既存のブログ記事（2014-2015）と Posfie 記事の時系列関係
5. **URL 設計**: `/posfie/xxx/` サブディレクトリにするか、既存の `/{slug}/` フラット構造に統合するか（後者を推奨: SEO 資産を分散させない）

## 注意点

- 各 Posfie 記事の元 URL は Phase 5 の `_redirects` 対象になる可能性がある（Posfie 側 URL からブログ URL へ 301 リダイレクトの誘導は Posfie が許可しない可能性が高いので、両立させる方針が現実的）
- X ツイート引用のライセンス配慮: 本人ツイートは無問題、他人ツイートは公開範囲の確認
- 記事本文の逐語保存原則は Posfie 記事にも適用する（Phase 3 の教訓）

## タイミング

- 既存13記事の Phase 5 デプロイ完了後、可能なら手書き abstract（案C）と並行、または直後
- 一括ではなくバッチで（例: 10記事ずつ）目視レビューしながら進める

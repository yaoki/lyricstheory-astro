# 記事 abstract の手書き化 TODO（案C、別セッションで対応）

アドバイザー助言（2026-07-19）を反映して、13記事の `description` frontmatter を「本文冒頭の自動抽出」から「2026年の視点で書いた独自 abstract」に置き換える。

## 背景

- AI Answer Engine（ChatGPT / Perplexity / Google AI Overviews / Claude / Gemini）は `<meta description>` ではなく**レンダリングされた本文冒頭**を引用する
- 現状（Phase 3 移行完了時点）は `firstParagraphAsDescription()` で本文の第一意味段落を切り出しているだけ
- Phase 3 の 2026-07-19 時点で、記事ページ冒頭に italic の要約段落が本文と重複する問題があったため、**暫定で italic 段落を非表示にした**（`src/pages/[slug]/index.astro`）
- 案C を実施した時点で、記事ページ冒頭に abstract を **再度表示** することを検討する（本文冒頭にAI引用しやすい要約を置く GEO の原則）

## 完成条件（Definition of Done）

- 全13記事の `description` を手書きに置き換え
- 本文中の独自用語（例: 子音ピボット、半シラブル化、クローズド・シラブル、宇多田カット、バップライティング等）を **一字一句そのまま** abstract に含める（エンティティ紐付け）
- abstract は 2-3 文、200文字以内目安
- 2026年の視点で「なぜこの記事が今も価値があるか」を1文で示す（例: 「子音ピボットという独自概念を最初に提案した記事」）
- 手書き済みフラグを frontmatter に追加（例: `descriptionAuto: false`）
- 記事ページ冒頭の italic 段落を再度表示する
- 冒頭 abstract と本文の内容重複がないことを目視で確認

## 対象13記事（優先順位: 独自概念が濃い順）

1. `sheena-ringo-repeated-consonance`（**子音ピボット**）
2. `sekai-no-owari-dragon-night-closed-syllable-consonant`（クローズド・シラブル、モーラ、シラブル）
3. `utada-hikaru-like-mora-syllable-articulation`（**半シラブル化**）
4. `how-to-accent-consonances-like-utada-hikaru`（**宇多田カット**、子音強調）
5. `how-to-write-lyrics-bop-writing`（**バップライティング**）
6. `how-to-write-like-an-asian-kung-fu-generation`（歌詞詰め込み6ヶ条）
7. `how-to-start-writing-lyrics`（作詞のはじめかた、ソングフォーム）
8. `i-dan-consonance-exercises`（い段子音課題）
9. `where-to-place-nn-consonances-like-utada-hikaru`（1拍目3拍目の「ん」配置）
10. `where-to-place-ii-like-utada-hikaru`（1拍目3拍目の「い」音強調）
11. `essay-on-art-of-utada-hikarus-alliteration-and-rhyme`（頭韻、ライム）
12. `essay-on-glay-like-repetition-and-little-rhyme`（GLAY たたみかけ）
13. `public-memo`（メモ記事、簡素な abstract で十分）

## 進め方の選択肢（別セッション時）

- **C-1（Claude ドラフト → 目視修正）**: ワーカーに全13記事分の abstract 案を出させ、やおきさんが目視レビューで確定
- **C-2（手書き）**: やおきさん自身が13記事の abstract を書く（用語の質は最高）

いずれの場合も、本文の逐語保存（テキストdiff検証）は壊さない。

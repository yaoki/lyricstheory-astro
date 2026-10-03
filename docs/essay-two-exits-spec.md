# lyricstheory エッセイ「一つの原稿・複数の出口」仕様書

- 版：v1.1
- 作成：2026-10-03（v0.1 下書き → 同日 v1.0 確定 → 同日 v1.1：現状確認による差異を反映）
- 対象リポジトリ：lyricstheory-astro（Public）
- 実装担当：Claude Code

Chat からは以下で読める。

```
https://raw.githubusercontent.com/yaoki/lyricstheory-astro/main/docs/essay-two-exits-spec.md
```

---

## 改訂記録（v1.0 からの差分）

v1.0 は Chat 側で書かれ、リポジトリの現状を見ずに設計されている。実装前に Claude Code が現状を確認し、差異をやおきさんに一つずつ諮って決めた。**決まったものだけをここに書く。**本文中の該当箇所も書き換えてある。

| No. | 日付 | 差異（事実） | 決定 |
|---|---|---|---|
| 差異1 | 2026-10-03 | エッセイの置き場所は既にある。`CLAUDE.md` に「essays（`src/content/blog/`）= 結晶層」とあり、`blog` コレクションは `.md` も読み（`**/*.{md,mdx}`）、`title` `slug` `pubDate` `xThreadUrl` を既に持つ。URL も同じ `/{slug}/` | **A：新コレクション `essays` は作らない。既存の `blog` を原稿の正本にする。**`src/content/blog/YYYY/<slug>.md` に置き、Vivliostyle の `entry` からそこを参照する。置き場所が二つになり、同じ `/{slug}/` を二つのコレクションが取り合うのを避けるため |
| 差異2 | — | ルビは既に `[花\|はな]` 記法が `plugins/remark-ruby.mjs` で動いている（`.md` `.mdx` 共通） | 未決 |
| 差異3 | — | 紙の出口は既に一つある。`scripts/make-book.py`（Chrome headless で elements の冊子を組む） | 未決 |
| 差異4 | — | 作業ツリーに別作業の未コミット差分がある（elements 3枚・`[...gate].astro`・`make-book.py`） | 未決 |
| 差異5 | — | 正規 URL は `https://lyricstheory.com`（www なし）。Astro 7.1.1。ローカル Node v25.9.0、CI は Node 22 | 報告のみ |

---

## 0. 目的

lyricstheory のエッセイを Markdown（.md）で一度だけ書き、次の二つの出口から同じ原稿を使えるようにする。

1. **Web**：既存の Astro → GitHub → Cloudflare Pages の更新経路で公開する
2. **紙**：Vivliostyle CLI で組版し、入稿用 PDF（PDF/X-1a）を GitHub Actions で自動生成する

第三の出口として InDesign（Pandoc → ICML）を想定するが、本仕様の実装範囲には含めない（§7）。

---

## 1. 決定事項

| No. | 決定 |
|---|---|
| 決定1 | 新しく書くエッセイは `.md` で書く。既存の `.mdx` 記事とガーデンカード（elements）は `.mdx` のまま変更しない。フロントマターは Astro と Vivliostyle で共用する |
| 決定2 | ルビは `{親字\|ルビ}` 記法（でんでんマークダウン／VFM 共通）で書く。非常口として `<ruby>親字<rt>ルビ</rt></ruby>` の直書きも許容する（※差異2が未決。既存の `[花\|はな]` 記法との関係を決める） |
| 決定3 | 独自記法はルビのみ。それ以外は Astro・Vivliostyle・Pandoc のすべてで通る標準 Markdown（CommonMark＋GFM）で書く |
| 決定4 | **原稿の正本は既存の `src/content/blog/`（v1.1 で変更。v1.0 では新設の `src/content/essays/`）。**本は `print/book-XX/` ごとに設定ファイルを持ち、`entry` で正本を参照して並べる。本にしかないページ（まえがき・奥付など）は本のフォルダに置く。原稿のコピーは作らない |
| 決定5 | Xスレッド誘導（`xThreadUrl`）はフロントマターのまま（紙には出ない）。本文リンクは `https://` から始まる完全な URL で書き、印刷用 CSS で URL を書き出す（初版は括弧書き）。埋め込み（X・YouTube 等）はエッセイでは使わない |

---

## 2. 目標とするフォルダ構成

```
lyricstheory-astro/
├─ src/
│  ├─ content.config.ts        ← blog に lang を追加、_ 始まりを除外
│  └─ content/
│     ├─ blog/                 ← 既存：エッセイ原稿の正本（.md / .mdx）
│     │  ├─ YYYY/<slug>.md     ← 新しく書くエッセイ
│     │  ├─ _sample/all-features.md   ← 試験用見本（§5）
│     │  └─ images/
│     └─ elements/             ← 既存のガーデンカード（変更しない）
├─ print/
│  └─ book-01/
│     ├─ vivliostyle.config.js
│     ├─ maegaki.md
│     ├─ okuduke.md
│     ├─ style.css
│     └─ fonts/
│        ├─ README.md
│        ├─ shippori-mincho/   （Regular・Bold・OFL.txt）
│        └─ noto-serif-jp/     （Regular・Bold・OFL.txt）
└─ .github/workflows/
   ├─ ci.yml                   ← 既存
   ├─ build-book.yml           ← 校正刷り（push 時）
   └─ release-book.yml         ← 刊行（タグ時）
```

---

## 3. 実装手順

### 手順1：blog コレクションを原稿の正本として整える（Web 側）（v1.1 で変更）

- 新しいコレクションは作らない。既存の `blog` を使う
- `_` 始まりのファイル・フォルダはサイトに出さない（試験用）。glob の除外で実現する
- スキーマに `lang`（任意、既定 `ja`）を足す。他の項目（`title` `slug` `pubDate` `xThreadUrl` 等）は既存のまま
- 記事ページの生成・X スレッド誘導の表示は既存の仕組みをそのまま使う

### 手順2：ルビ記法を Astro で読めるようにする

（差異2の決定待ち）

- `{親字|ルビ}` → `<ruby>親字<rp>(</rp><rt>ルビ</rt><rp>)</rp></ruby>`
- この記法は `.md` 専用とする。`.mdx` では `{}` が式として解釈されるため使わない。既存の `.mdx` 記事とガーデンカードのビルドが壊れないことを必ず確認する

### 手順3：本の組版環境を作る（紙側）

- `print/book-01/vivliostyle.config.js` を作成する。必要 Node.js は v22.12.0 以上
- 設定内容：
  - `entry`：`maegaki.md` → `../../src/content/blog/` 配下の原稿 → `okuduke.md` の順
  - `theme`：`./style.css`
  - `size`：`A5`（確定。手製本の合本体系と判型をそろえるため）
  - `output`：`pdfPostprocess.preflight: 'press-ready'`、`preflightOption: ['enforce-outline']`（旧形式の `preflight` 直書きは非推奨のため使わない）
- `style.css`：
  - 本文書体は**しっぽり明朝**（Regular / Bold）。`@font-face` で独自名 `BookMincho` として定義する
  - 字の欠け対策として **Noto Serif JP**（Regular / Bold）を独自名 `BookSerif` で定義し、代役として重ねる：`font-family: "BookMincho", "BookSerif", serif;`
  - 見出しにも同じ指定を使う（見出し用の別書体は初版では使わない）
  - リンクの URL 書き出し：`a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.8em; }`
  - ルビ・脚注の基本スタイル
- 両フォントとも SIL Open Font License 1.1 のため Public リポジトリに同梱してよい。書体ごとの `OFL.txt` を必ず同梱する。Noto は容量を抑えるため日本語 Subset 版を使う
- しっぽり明朝は FONTDASU の配布元（OTF 版）または公式 GitHub から取得し、取得元と版を `fonts/README.md` に記録する

### 手順4：GitHub Actions（校正刷り）

`.github/workflows/build-book.yml`

- トリガー：`src/content/blog/**` または `print/**` に変更がある push
- 処理：checkout → setup-node（22）→ `print/book-01` で `npx @vivliostyle/cli build` → PDF を `actions/upload-artifact` で保存（`retention-days: 30`）
- フォントは同梱分を使う（apt での日本語フォント導入に頼らない）

### 手順5：GitHub Actions（刊行）

`.github/workflows/release-book.yml`

- トリガー：`book-*` 形式のタグ push。`book-01-ed1-p1` ＝ book-01 初版第1刷（`ed` は版、`p` は刷）
- 処理：タグ名から本のフォルダと版・刷を判定 → 組版 → `book-01-ed1-p1.pdf` を `gh release create <tag> <pdf> --generate-notes`
- 形式に合わないタグでは失敗させ、理由をログに出す
- 任意機能：奥付の `{{EDITION_PRINTING}}` に「初版第2刷」（校正刷りでは「校正刷り」）を、組版直前の一時コピーで差し込む。正本の `okuduke.md` は書き換えない
- `permissions: contents: write` を明記する
- `book-02` を追加しても、ワークフローを書き換えずに動く作りにする

### 手順6：既存の更新経路への影響確認

- Cloudflare Pages のビルドが `print/` の追加で失敗しないこと、所要時間が大きく変わらないことを確認する

---

## 4. 執筆ルール（エッセイ原稿）

- ファイル形式は `.md`。置き場所は `src/content/blog/YYYY/<slug>.md`。フロントマターは `blog` のスキーマに従う
- ルビは `{親字|ルビ}`（差異2の決定待ち）。本文で `{` `|` `}` を文字として使う場合はインラインコードで書く
- サイト内リンクも `https://lyricstheory.com/...`（正規 URL）から始まる完全な URL で書く。リンク文字は行き先がわかる言葉にする
- 埋め込み表示は使わない
- 脚注は GFM の `[^1]` 記法
- 画像は `src/content/blog/images/` に置き、相対パスで参照する
- 既存の Public 運用ガードレール（歌詞全文を置かない、長い引用は pre-commit でブロック）はエッセイにも適用する

---

## 5. 試験用見本エッセイ

`src/content/blog/_sample/all-features.md` を作成する。以下をすべて含める。

- フロントマター（`xThreadUrl` を含む）
- 見出し（h2・h3）
- ルビ（漢字＋かな、かな＋ローマ字表記の両方）
- 本文中の外部リンク・サイト内リンク
- 脚注 2 つ以上
- 画像 1 点（相対パス）
- 短い引用（blockquote）
- しっぽり明朝に収録されていない可能性のある珍しい漢字を数語

`_` 始まりなので Web には出ない。Web 側の確認は開発サーバーで行う。

---

## 6. 受け入れ条件

- [ ] 見本エッセイが Astro の開発サーバーで表示され、ルビが `<ruby>` で表示される
- [ ] 見本エッセイが `print/book-01` の組版に含まれ、PDF でもルビが正しく表示される
- [ ] `entry` の `../../src/content/blog/...` 参照で組版できる（できない場合は原稿のコピーを作らない代替策を提案する）
- [ ] 画像が Web・PDF の両方で表示される
- [ ] 脚注が Web・PDF の両方で機能する
- [ ] PDF で外部リンクの後ろに URL が括弧書きで出る
- [ ] PDF の日本語が豆腐にならない（GitHub Actions 上で生成したもので確認）
- [ ] 本文がしっぽり明朝で組まれ、欠けた字は Noto Serif JP で表示される。代役の字面の差を PDF で確認できる
- [ ] `xThreadUrl` の値が PDF の本文に出ない
- [ ] 見本エッセイ（`_` 始まり）がサイトのビルド結果・sitemap・RSS に出ない
- [ ] 既存の `.mdx` 記事とガーデンカードのビルドと表示が従来どおり
- [ ] push で校正刷り PDF が Actions の成果物として取得できる
- [ ] `book-01-ed0-p1` などの試験タグで Release が作成され、PDF が添付される（確認後、試験用の Release とタグは削除してよい）
- [ ] （任意機能を実装した場合）奥付に版・刷が正しく差し込まれ、正本の `okuduke.md` は変更されていない
- [ ] Cloudflare Pages のデプロイが成功する

---

## 7. 範囲外・将来課題

- **InDesign 出口**：Pandoc → ICML。ルビ非対応のため前処理スクリプトとテンプレートが要る。必要になった時点で別仕様とする
- **リンクの傍注化**：括弧書きの URL を欄外の番号つき傍注、または脚注に移す
- **塗り足し・トンボ**：入稿先の規定に合わせて決める
- **書体の吟味**：見出し用の別書体、Zen オールド明朝など他の OFL 書体との比較

---

## 8. 未確認事項（実装時に確かめること）

1. ルビ記法の扱い（差異2で決める。`remark-denden-ruby` は使わず既存の `plugins/remark-ruby.mjs` を拡張する案がある）
2. Vivliostyle の `entry` で親階層をたどる相対パスが使えるか
3. 画像の相対パスが Web・PDF の両方で同じ書き方で通るか
4. Astro の標準 Markdown 処理と VFM で、脚注の記法・出力に差異がないか
5. `press-ready` の後処理が GitHub Actions の Ubuntu ランナー上（Docker）で問題なく動くか
6. しっぽり明朝の漢字収録範囲と、Noto Serif JP が代役に入ったときの字面の差
7. Astro の glob loader が `_` 始まりを既定で除外するか（推測では除外するが未確認）

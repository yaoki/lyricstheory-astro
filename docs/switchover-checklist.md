# 切替当日チェックリスト

WordPress (Coreserver) → Astro (Cloudflare Pages) の実本番切替手順。事前の [Cloudflare デプロイ手順](./deploy-cloudflare.md) が完了していることが前提。

## 事前準備（切替の1-3日前）

- [ ] Cloudflare Pages のプレビュー環境で全13記事を目視確認
- [ ] Rich Results Test（<https://search.google.com/test/rich-results>）で代表記事の schema.org Article バリデーション
- [ ] `<project>.pages.dev` で `/robots.txt` `/llms.txt` `/sitemap-index.xml` `/feed/` が到達可能
- [ ] Google Search Console で `www.lyricstheory.com` プロパティを準備（既存プロパティの確認）
- [ ] Bing Webmaster Tools で `www.lyricstheory.com` プロパティを準備

## 切替当日

### 1. WordPress を読み取り専用モード化

Coreserver コントロールパネル → WordPress インストール先を確認 → 以下いずれかで **書き込みを止める**:

- **推奨**: `wp-config.php` に `define('DISALLOW_FILE_MODS', true);` `define('AUTOMATIC_UPDATER_DISABLED', true);` を追記して自動更新も止める
- 管理者アカウントを Editor 権限に降格させ、投稿新規作成を防ぐ
- 念のためデータベースのバックアップも別途取っておく（既存 wpress バックアップに加え）

### 2. DNS 切替

[deploy-cloudflare.md](./deploy-cloudflare.md) の手順4に従って DNS を Cloudflare へ委譲。

**反映確認**:

```bash
# ネームサーバーが Cloudflare を指しているか
dig NS lyricstheory.com

# www.lyricstheory.com が Cloudflare Pages を指しているか
dig www.lyricstheory.com

# apex → www リダイレクトが機能しているか
curl -I https://lyricstheory.com/  # Location: https://www.lyricstheory.com/ になるはず

# 実記事に到達可能か
curl -I https://www.lyricstheory.com/sheena-ringo-repeated-consonance/
```

### 3. Google Search Console

<https://search.google.com/search-console/>

- [ ] `www.lyricstheory.com` プロパティが緑（所有権確認済み）であること
- [ ] **Sitemaps** → 旧 sitemap を削除、新 `https://www.lyricstheory.com/sitemap-index.xml` を追加
- [ ] **URL 検査** で代表記事1本を手動リクエスト（インデックス再登録の後押し）
- [ ] **リンク → 内部リンク** で `/wp-content/uploads/` を含む古いパス依存リンクがないか目視

### 4. Bing Webmaster Tools

<https://www.bing.com/webmasters/>

- [ ] `www.lyricstheory.com` プロパティ確認
- [ ] Sitemap 再送信: `https://www.lyricstheory.com/sitemap-index.xml`

### 5. AI クローラーへの通知

明示的な API はないが、以下は間接的に効く:

- [ ] llms.txt が到達可能（`curl https://www.lyricstheory.com/llms.txt`）
- [ ] robots.txt で AI クローラー Allow していること（`curl https://www.lyricstheory.com/robots.txt`）
- [ ] X（Twitter）で切替完了を告知 → 各種クローラーが URL を辿るきっかけ

### 6. 動作確認スモークテスト

- [ ] 代表記事5本を実ブラウザで表示、画像・埋め込み・TOCが機能
- [ ] スマホでも同上
- [ ] View Source → JSON-LD が出力されている
- [ ] `<meta name="description">` が期待通り
- [ ] `/feed/` が RSS フィードを返す
- [ ] 旧画像URL（例: `/wordpress/wp-content/uploads/2015/03/xxx.png`）が 200 OK

## 切替後1週間

- [ ] Search Console のインデックス数を毎日確認、順調に増えているか
- [ ] AI Answer Engine で自サイトの記事について質問し、引用されるかテスト（Perplexity, ChatGPT search, Claude 等）
- [ ] Cloudflare Analytics でアクセスパターンを確認
- [ ] エラーが出ていないか Cloudflare の Real User Monitoring で確認

## 切替後 2-4 週間

- 検索順位変動は正常な揺らぎとして許容（仕様書 11 の "Definition of Done" 参照）
- 初週の数字で成否を判定しない

## 別セッションで対応する残 TODO（Phase 5-6 と並行または直後）

- [ ] `docs/abstract-handwrite-todo.md` — 13記事の手書き abstract
- [ ] `docs/dead-links-todo.md` — 歌詞タイム閉鎖リンク差し替え、YouTube 削除動画3本の対応
- [ ] `docs/posfie-migration-todo.md` — Posfie 記事のブログ集約

## Phase 6: Coreserver 解約

Cloudflare 上で全サイトの安定稼働を 1 週間確認できたら、Coreserver 契約を解約する。他の静的サイトも Cloudflare Pages に移動済みであること。

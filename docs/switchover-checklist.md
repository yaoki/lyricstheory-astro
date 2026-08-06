# 切替当日チェックリスト

WordPress (Coreserver) → Astro (Cloudflare Pages) の実本番切替手順。事前の [Cloudflare デプロイ手順](./deploy-cloudflare.md) が完了していることが前提。

## 事前準備（切替の1-3日前）

- [ ] Cloudflare Pages のプレビュー環境で全13記事を目視確認
- [ ] Rich Results Test（<https://search.google.com/test/rich-results>）で代表記事の schema.org Article バリデーション
- [ ] `<project>.pages.dev` で `/robots.txt` `/llms.txt` `/sitemap-index.xml` `/feed/` が到達可能
- [ ] Google Search Console で `lyricstheory.com` プロパティを準備（既存プロパティの確認）
- [ ] Bing Webmaster Tools で `lyricstheory.com` プロパティを準備

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

# lyricstheory.com が Cloudflare Pages を指しているか
dig lyricstheory.com

# www → apex リダイレクトが機能しているか
curl -I https://www.lyricstheory.com/  # Location: https://lyricstheory.com/ になるはず

# 実記事に到達可能か
curl -I https://lyricstheory.com/sheena-ringo-repeated-consonance/
```

### 3. Google Search Console

<https://search.google.com/search-console/>

- [ ] `lyricstheory.com` プロパティが緑（所有権確認済み）であること
- [ ] **Sitemaps** → 旧 sitemap を削除、新 `https://lyricstheory.com/sitemap-index.xml` を追加
- [ ] **URL 検査** で代表記事1本を手動リクエスト（インデックス再登録の後押し）
- [ ] **リンク → 内部リンク** で `/wp-content/uploads/` を含む古いパス依存リンクがないか目視

### 4. Bing Webmaster Tools

<https://www.bing.com/webmasters/>

- [ ] `lyricstheory.com` プロパティ確認
- [ ] Sitemap 再送信: `https://lyricstheory.com/sitemap-index.xml`

### 5. AI クローラーへの通知

明示的な API はないが、以下は間接的に効く:

- [ ] llms.txt が到達可能（`curl https://lyricstheory.com/llms.txt`）
- [ ] robots.txt で AI クローラー Allow していること（`curl https://lyricstheory.com/robots.txt`）
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

## 切替成功後の DNS 掃除（Cloudflare 管理画面で）〔完了・2026-08-06 実測確認〕

Coreserver 時代の DNS レコードが Cloudflare にインポートされていたので、不要なものを削除し、代わりに「メールを送らないドメイン」であることを明示するレコードを置いた。**下は 2026-08-06 に `dig` で実際に引いて確かめた結果**である。

- [x] `A *.lyricstheory.com` (163.44.177.18) — 削除済み（`dig +short A <存在しないサブドメイン>.lyricstheory.com` が空）
- [x] `AAAA *.lyricstheory.com` (IPv6) — 同上
- [x] `MX lyricstheory.com` — 削除済み（`dig +short MX` が空）
- [x] `TXT _dmarc.lyricstheory.com` (`v=DMARC1; p=none;`) — 下の推奨値に置き換え済み
- [x] `TXT lyricstheory.com` SPF (`v=spf1 ... include:mxr.valueserver.jp ~all`) — 下の推奨値に置き換え済み

**代わりに設定するもの**（スパム対策としてメール未使用の証明）：
- [x] `TXT lyricstheory.com` SPF: `v=spf1 -all` — 設定済み（`dig +short TXT lyricstheory.com` で確認）
- [x] `TXT _dmarc.lyricstheory.com` DMARC: `v=DMARC1; p=reject; adkim=s; aspf=s;` — 設定済み

なお `TXT lyricstheory.com` には Google Search Console の所有権確認レコード（`google-site-verification=...`）も入っている。これは必要なものなので消さない。

## Phase 6: Coreserver 解約〔完了〕

- [x] Coreserver 契約の解約（2026-08-06、やおき確認）

**このファイルは 2026-08-06 まで、上の2項目が未完了のまま残っていた。**実態と2段階ずれていたため、残作業を数えるときに誤って計上した。以後、済んだ項目はその場でチェックを入れること。

# Cloudflare Pages デプロイ手順

このドキュメントは、Astro プロジェクト `lyricstheory-astro/` を Cloudflare Pages に本番デプロイする手順を示す。

## 前提

- Cloudflare アカウント（無料プランで可、支払情報も不要）
- GitHub アカウント（Public リポジトリを作成する）
- ドメイン `lyricstheory.com` の DNS 管理権限（バリュードメイン等の登録業者側でネームサーバーを変更する必要）

## 1. GitHub リポジトリ作成 & 初回プッシュ

```bash
# 1. GitHub 側で "lyricstheory-astro" という Public リポジトリを作成
#    (テンプレートは None、READMEは付けない、.gitignoreも付けない)

# 2. リモート追加 & プッシュ
git remote add origin https://github.com/<username>/lyricstheory-astro.git
git push -u origin main
```

## 2. Cloudflare Pages プロジェクト作成

1. Cloudflare ダッシュボード → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. GitHub 認可 → `lyricstheory-astro` リポジトリを選択
3. ビルド設定:
   - **Framework preset**: Astro（自動検出のはず）
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory (Advanced)**: 空欄（リポジトリルート）
   - **Environment variables**: 現状不要
4. **Save and Deploy** → 初回ビルド開始

初回ビルドが緑になれば `<project-name>.pages.dev` サブドメインでアクセス可能に。

## 3. 独自ドメイン設定

Cloudflare Pages プロジェクト → **Custom domains** → **Set up a custom domain**

- `lyricstheory.com`（apex, これが本番の canonical）を追加
- `www.lyricstheory.com`（過去のURL変遷対策として apex への 301 転送用に追加）

Cloudflare が DNS レコードの案内を出す。次項でネームサーバー移管を行う。

## 4. DNS を Cloudflare へ委譲

### 4.1 Cloudflare 側でゾーンを追加

1. Cloudflare ダッシュボード → **Add site** → `lyricstheory.com` を入力（www なし、apex ドメイン）
2. Free プランを選択
3. Cloudflare が現在の DNS レコードをスキャンしてインポート（既存の Coreserver 設定を保存）
4. **Cloudflare のネームサーバー2つ**が表示される（例: `xxx.ns.cloudflare.com` と `yyy.ns.cloudflare.com`）

### 4.2 レジストラ（バリュードメイン）側でネームサーバー変更

1. バリュードメインにログイン
2. `lyricstheory.com` のドメイン管理 → **ネームサーバー変更**
3. 上記で得た Cloudflare のネームサーバー2つを設定
4. 反映まで数分〜48時間（実際は多くの場合数十分）

### 4.3 Cloudflare 側で反映確認

- Cloudflare ダッシュボードに戻ると "Great news!" と反映確認メッセージが出る
- SSL/TLS モード: **Full** または **Full (Strict)** を推奨

### 4.4 DNS レコード確認・追加

**本番の canonical URL は apex (`lyricstheory.com`)**。理由: 過去10年のはてブ被リンク・SEO 資産がすべて apex URL で登録されているため（Phase 5 実データ調査で確定）。`www.lyricstheory.com` は canonical へリダイレクトさせるための予備扱い。

Cloudflare DNS 管理画面で以下を確認・設定:

| Type | Name | Content | Proxy status |
|---|---|---|---|
| CNAME | @ (apex) | `<project>.pages.dev` | Proxied（オレンジ雲、CNAME flattening で解決） |
| CNAME | www | `<project>.pages.dev` | Proxied（www→apex の 301 用） |

www → apex の 301 リダイレクトは Cloudflare **Redirect Rules** で設定:

- **Rules** → **Redirect Rules** → **Create rule**
- Rule name: `www to apex`
- If: `Hostname equals www.lyricstheory.com`
- Then: `Dynamic` → `concat("https://lyricstheory.com", http.request.uri.path)`
- Status: `301`

## 5. PR プレビュー動作確認

任意のブランチを push → GitHub 側で PR を作成
→ Cloudflare Pages が自動でプレビューURL（`<hash>.<project>.pages.dev`）を発行し、PR 本体にコメントを付ける

## 6. 常時 HTTPS と Always Use HTTPS

Cloudflare → **SSL/TLS** → **Edge Certificates**:

- **Always Use HTTPS**: ON
- **Automatic HTTPS Rewrites**: ON

## 7. トラブルシュート

### 画像 404
`public/wordpress/wp-content/uploads/` がリポジトリに含まれているか確認。GitHub 側のリポジトリサイズ制限（100MB / file）に抵触しないよう、画像はビルド時にサイズ確認する。

### ビルド失敗
Cloudflare Pages のビルドログを確認。ローカルで `npm run build` が通ることを事前確認。

### DNS 反映されない
- `dig NS lyricstheory.com` で Cloudflare のネームサーバーが返るか確認
- レジストラ側で TTL の反映を待つ（48時間まで）

## 参考リンク

- [Cloudflare Pages ドキュメント](https://developers.cloudflare.com/pages/)
- [Astro on Cloudflare Pages](https://docs.astro.build/en/guides/deploy/cloudflare/)
- [Cloudflare Fundamentals - Onboard a domain](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/)

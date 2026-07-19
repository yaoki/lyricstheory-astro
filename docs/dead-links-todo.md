# 記事本文中の外部リンクで、10年経過により死んでいる可能性のあるものの追跡

移行元記事は2014-12〜2015-03のもの。10年経過で外部リンクが失効している可能性があるため、Phase 4/5前後で棚卸しし、リンクを差し替える。

## 確認済み: 差し替えが必要なもの

### 歌詞タイム（kasi-time.com） — 2020年に閉鎖
参照元:
- `src/content/blog/2015/sekai-no-owari-dragon-night-closed-syllable-consonant.mdx:29`

死亡ニュース: https://www.j-cast.com/2020/03/24382832.html?p=all

**差し替え候補**: Uta-Net (uta-net.com) / utaten.com / J-Lyric.net のいずれか。記事本文中で既に J-Lyric.net にも言及があるため、統一する場合は J-Lyric.net 推奨。

## 確認済み: YouTube埋め込みで再生不可の動画（3件、2026-07-19確認）

| video_id | 状態 | 記事 |
|---|---|---|
| `8UGcSwE1fkk` | 403（埋め込み不可、動画は存在の可能性） | how-to-start-writing-lyrics |
| `L_QVB4Qdh6o` | 404（削除） | how-to-accent-consonances-like-utada-hikaru |
| `qC0JP_cJJKE` | 403（埋め込み不可） | sheena-ringo-repeated-consonance |

403 の2件は動画自体は存在する可能性があるので、YouTube を直接ブラウザで開けば見られるかもしれない。**代替案**: 埋め込みではなくテキストリンク "YouTube で見る" として置換する、もしくは代替動画（別のアップロード）に差し替える。

## 未確認・要棚卸し
- Twitter/X リンク: `twitter.com/xxx/status/...`（`public-memo` で多数）— アカウント凍結・ツイート削除の可能性
- ブログリンク（`j-wave.co.jp/blog/fmkameda/2012/05/post_14.html` 等）: サイト自体が消失・URL構造変更の可能性
- iTunes Store リンク: サービス側で削除・変更されている可能性

## 検査スクリプト（未実装、Phase 4/5 で必要になった時に）

```bash
# lychee 等のリンクチェッカーで全リンク疎通確認
lychee --exclude-mail --accept 200,301,302 src/content/blog/**/*.mdx
```

## 差し替え方針

- 記事本文の推敲は Phase 3 の逐語保存とは別の判断（編集）が要る。まず記事オーナー（やおき）に判断を仰ぐ
- リンクだけを差し替え、周辺文脈は原文のまま維持する（例: 「歌詞タイム」の名前が本文にあるならその名も更新するかは要判断）
- 差し替え履歴は commit message で追える

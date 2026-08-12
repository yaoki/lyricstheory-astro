import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().min(20).max(400),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    song: z
      .object({
        title: z.string(),
        artist: z.string(),
        lyricist: z.string(),
        composer: z.string(),
        releaseYear: z.number().int(),
      })
      .optional(),
    tags: z.array(z.string()).default([]),
    categories: z.array(z.string()).default([]),
    concepts: z.array(z.string()).default([]),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug は英小文字・数字・ハイフンのみ'),
    xThreadUrl: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

const concept = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/concept' }),
  schema: z.object({
    title: z.string(),
    description: z.string().min(20).max(400),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    aliases: z.array(z.string()).default([]),
    references: z
      .array(
        z.object({
          citation: z.string(),
          url: z.string().url().optional(),
        }),
      )
      .default([]),
    relatedConcepts: z.array(z.string()).default([]),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

const author = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/author' }),
  schema: z.object({
    name: z.string(),
    alternateName: z.array(z.string()).default([]),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    url: z.string().url(),
    sameAs: z.array(z.string().url()).default([]),
    jobTitle: z.string().optional(),
    affiliation: z.array(z.string()).default([]),
    frameworks: z.array(z.string()).default([]),
    description: z.string(),
  }),
});

// OG 画像（/og/{slug}.png）に描く図の指定。任意。
// figure を持たないカードは図なしのフォールバックで生成される。
// 仕様: ../tasks/lyricstheory-og-symmetry-spec.md
// 型の対応先: src/lib/og/templates/single.ts の SingleFigure
// 行数＝図に載せる箇所の数。1 箇所なら single、離れた 2 箇所の対比なら pair。
// 図の形が表すのは「何箇所載るか」であって、何を見ているか（フレーム）ではない。
// フレームは tags.repetition が決め、左上のバッジと色で示す。
// 3 つ目の形を足す前に、この規則で説明がつくかを必ず判定すること。
const singleFigure = z
  .object({
    kind: z.literal('single'),
    // units の上限 8 は著作権上のガードレール（長い連続は歌詞の再現に近づく）。緩めないこと
    units: z.array(z.string().min(1).max(4)).min(2).max(8),
    // 1 組なら [2, 4]、同じフレーズに複数の呼応があるなら [[2, 4], [5, 7]]
    highlight: z
      .union([
        z.array(z.number().int().nonnegative()),
        z.array(z.array(z.number().int().nonnegative()).min(1)),
      ])
      .default([]),
    // 語のまとまり。[from, to]（両端を含む）を 2 つ以上。
    // 指定すると弧は highlight の組ではなく phrases のあいだに張られ、括りも phrases に付く。
    // 音ごとの色分けと、語どうしの呼応を別々に描くために要る（2026-08-09 追加）
    phrases: z
      .array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]))
      .min(2)
      .optional(),
  })
  .superRefine((figure, ctx) => {
    const groups: number[][] =
      figure.highlight.length === 0
        ? []
        : typeof figure.highlight[0] === 'number'
          ? [figure.highlight as number[]]
          : (figure.highlight as number[][]);
    for (const index of groups.flat()) {
      if (index >= figure.units.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['highlight'],
          message: `highlight の ${index} は units（${figure.units.length} 要素）の範囲外です`,
        });
      }
    }
    for (const [from, to] of figure.phrases ?? []) {
      if (to >= figure.units.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phrases'],
          message: `phrases の ${to} は units（${figure.units.length} 要素）の範囲外です`,
        });
      }
      if (from > to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phrases'],
          message: `phrases の [${from}, ${to}] は from が to より後ろです`,
        });
      }
    }
  });

// 離れた 2 箇所の対比（回帰反復）。カード本文が既に両方を引用している範囲に留めること。
// 縛りは音数ではなく行数（1 カードあたり 1〜2 行以内、CLAUDE.md の引用ルール）。
const pairFigure = z
  .object({
    kind: z.literal('pair'),
    rows: z.tuple([
      z.array(z.string().min(1).max(4)).min(2),
      z.array(z.string().min(1).max(4)).min(2),
    ]),
    // 回帰反復では構造的対応を担う要素。省略できない
    labels: z.tuple([z.string().min(1).max(8), z.string().min(1).max(8)]),
    // aligned = 同位置の対比。expansion = 展開の対比（一方が伸びていること自体が観察）
    mode: z.enum(['aligned', 'expansion']).default('aligned'),
    // 上下の対応を手で指定する。省略すると順序保存的な共通ブロックを自動で取る。
    // 類音どうしの対応や、順序が交差する対応は自動では拾えないため。
    //
    // 1 組は [上の位置, 下の位置] だが、**行内の複数の音を 1 組にまとめたいときは
    // [[上の位置...], [下の位置...]] と書く**（2026-08-10 追加）。組ごとに色が変わる仕様なので、
    // 1 点ずつ書くと点の数だけ色が増え、ABA のように「両端が同じ音」であることが図から消える。
    // まとめて書けば両端が同色になり、行内の配置と行をまたぐ対応を 1 枚で出せる
    correspondences: z
      .array(
        z.union([
          z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
          z.tuple([
            z.array(z.number().int().nonnegative()).min(1),
            z.array(z.number().int().nonnegative()).min(1),
          ]),
        ]),
      )
      .optional(),
    // 各行を折り返す位置。長い展開をメロディの切れ目で割り、音数を減らさずに字を大きくする。
    // aligned では列の突き合わせが成り立たなくなるので使えない
    wraps: z.tuple([z.array(z.number().int().positive()), z.array(z.number().int().positive())]).optional(),
  })
  .superRefine((figure, ctx) => {
    // 列を揃えることは「同じ位置」という主張。音数が違うまま並べると
    // 韻律の対応（対応の三要素の③）を断定したことになる。③は保留中なので止める。
    //
    // ただし展開の観察では、揃えるほうが嘘になる。一方が伸びていることが観察の本体で、
    // 揃う範囲まで切り詰めると、展開が同位置の差し替えに見える。mode で切り分ける
    // aligned は列の突き合わせで一致を判定する。折り返すと列が段ごとに振り出しに戻るため、
    // 「同じ位置」という主張が成り立たなくなる
    if (figure.mode === 'aligned' && figure.wraps?.some((cuts) => cuts.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wraps'],
        message:
          'aligned では wraps を使えません。列を揃えることが「同じ位置」の主張なので、' +
          '折り返すとその主張が成り立ちません',
      });
    }
    if (figure.mode === 'aligned' && figure.rows[0].length !== figure.rows[1].length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message:
          `2行の音数が違います（${figure.rows[0].length} と ${figure.rows[1].length}）。` +
          '列が揃わない対比は、位置の対応を主張したことになるため描けません。' +
          '展開を見せたいなら mode: expansion を指定してください',
      });
    }
  });

// 子音ピボット。single の**表示のバリエーション**であって 3 つ目の形ではない。
// 箇所の数は 1（rows が 2 要素になるのは、観察が改行をまたいで途切れず続く場合。
// 離れた 2 箇所の対比＝pair とは別物）。
//
// 呼応しない音は文字を出さず伏せる。**点の数は制限しない**（2026-08-02、やおき指摘）。
// single の上限 8 は「連続した音が並ぶと歌詞の再現に近づく」ことによる制約で、
// 伏せ字を挟んで散在する点は何個あっても歌詞にならない。
//
// 効く制限は 2 つだけ。総枠数 24（著作権ではなくレイアウト上の都合。24 枠で 1 枠約 32px、
// カードページでは明瞭に読めるが SNS で 1/3 に縮むと苦しい。16 枠までが快適圏）と、
// 1 枠 4 文字（連なりを 1 枠に畳むと歌詞の断片がそのまま出るため）。
const pivotFigure = z
  .object({
    kind: z.literal('pivot'),
    // 上部に掲げる軸のラベル。「カ行子音」など。tags.phoneme から機械生成しないのは、
    // 清濁をまたぐ軸（/t/ に「だ」「で」を含める等）の但し書きが自動では書けないため
    axis: z.string().min(1).max(12),
    rows: z
      .array(
        z.object({
          length: z.number().int().min(2).max(24),
          // 伏せた枠が歌詞のどこを指しているかを、行の上に小さく添える（2026-08-06 追加）。
          // 出すのはカード本文が既に <LyricQuote> で引用している範囲と同じものなので、
          // 引用の総量は増えない（consonant と同じ考え方）。
          // **可能な限り全文**を出し、行に収まらない長さのときだけ頭と末尾を残して
          // 「…」で畳む（やおき指示）。畳む閾値は phrase.ts の HINT_MAX_EM
          text: z.string().max(64).optional(),
          // 行を割った結果、軸の音を持たない行が出るのは構わない
          pivots: z.array(
            z.object({
              at: z.number().int().nonnegative(),
              unit: z.string().min(1).max(4),
            }),
          ),
        }),
      )
      .min(1)
      .max(4),
  })
  .superRefine((figure, ctx) => {
    figure.rows.forEach((row, rowIndex) => {
      const seen = new Set<number>();
      for (const { at } of row.pivots) {
        if (at >= row.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rows', rowIndex, 'pivots'],
            message: `at の ${at} は length（${row.length}）の範囲外です`,
          });
        }
        if (seen.has(at)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rows', rowIndex, 'pivots'],
            message: `at の ${at} が重複しています。1 つの位置に置ける音は 1 つです`,
          });
        }
        seen.add(at);
      }
    });
  });

// 子音の並びを、歌詞の上に振って見せる。2 つ以上の子音が交替し続ける範囲を見るとき、
// 単位は個々の音節ではなく子音の並びになる。
//
// 記号だけを並べた版は「誰にもわからない」ので採らない（2026-08-02、やおき指摘）。
// 図はブログを読みに行かなくても単体で伝わる強度を持たなければならず、
// 抽象（記号）と実音（歌詞）の対応こそが図の本体になる。
//
// 歌詞はカード本文が既に <LyricQuote> で引用している範囲と同じものを出すので、
// 引用の総量は増えない。行の長さの上限 24 はレイアウト上の都合。
const consonantFigure = z
  .object({
    kind: z.literal('consonant'),
    rows: z
      .array(
        z.object({
          units: z.array(z.string().min(1).max(4)).min(2).max(24),
          marks: z.array(
            z.object({
              at: z.number().int().nonnegative(),
              symbol: z.string().min(1).max(4),
              // 下の段。保たれるものを上、動くものを下に置くときに使う
              sub: z.string().min(1).max(4).optional(),
            }),
          ),
        }),
      )
      .min(1)
      .max(4),
  })
  .superRefine((figure, ctx) => {
    figure.rows.forEach((row, rowIndex) => {
      for (const { at } of row.marks) {
        if (at >= row.units.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rows', rowIndex, 'marks'],
            message: `at の ${at} は units（${row.units.length} 要素）の範囲外です`,
          });
        }
      }
    });
  });

const figureSchema = z.union([singleFigure, pairFigure, pivotFigure, consonantFigure]);

const elements = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/elements' }),
  schema: z.object({
    title: z.string(),
    // 2026-08-13 に enum 化（93枚時点）。使用中の6語に term を足した7語で固めた。
    // 未使用だった rhyme / prosody は入れていない。**使われていない語彙が残ると、分類が
    // 語彙の側に引きずられる**（あるから使う）。押韻・韻律のカードを書く番になったら
    // ここへ1行足せばよく、先に確保しておく利得は無い
    type: z.enum(['pivot', 'sequenz', 'syllable', 'pattern', 'principle', 'term', 'other']),
    // どの曲についてのカードか。**曲でカードを束ねられる唯一の機械可読な場所**である。
    // 曲名は title（「アーティスト『曲名』：観察名」）と <LyricQuote song=> にも出るが、
    // 前者は人間可読の題、後者は引用ブロックの属性で、どちらもカードの主題を表す欄ではない。
    //
    // 書誌の完全形（発売年・作詞者・作曲者）は従来どおり sources が持つ。ここへ寄せないのは
    // 二重化を避けるため。どちらが正本か決まらないまま両方が残ると、片方が古いまま残る。
    // 楽曲を対象としないカード（type: principle / term）は持たない
    song: z
      .object({
        title: z.string(),
        // 流通表記（「Mr.Children」「椎名林檎」）。slug 表記の tags.artist とは別物で、
        // 正規化ルール（CLAUDE.md「artist 表記の正規化」）が掛かるのは tags.artist の側
        artist: z.string(),
      })
      .optional(),
    maturity: z.enum(['seed', 'budding', 'evergreen']).default('seed'),
    tags: z
      .object({
        phoneme: z.array(z.string()).default([]),
        // 反復の類型（既刊の三類型）。c=子音のみ / v=母音のみ / cv=両方が反復に参与
        // 類型であって単位ではない。単位は譜割シラブルとその内部の C・V
        repetition: z.enum(['cv', 'v', 'c']).optional(),
        artist: z.array(z.string()).default([]),
        era: z.string().optional(),
        lang: z.string().default('ja'),
      })
      .default({ phoneme: [], artist: [], lang: 'ja' }),
    related: z.array(z.string()).default([]),
    // このカードが使っている理論用語のカード（type: term）の id。
    //
    // related と分けてあるのは、**逆引きの意味が違う**ため。用語カードから見た被参照は
    // 「この用語を使っている楽曲カード」＝実例リストであって、対等な関連ではない。
    // related に混ぜると子音ピボット22枚・母音連続16枚がそのまま流れ込み、用語カードの
    // 関連が20本を超えて「関連する別の用語」が埋もれる（2026-08-13、やおき裁定）
    terms: z.array(z.string()).default([]),
    // 外部文献への参照。books / webrefs をコレクションごとに分けてあるのは、Astro の
    // getEntry がコレクション名を型で要求するため（1 つの配列にまとめると解決側が分岐を持つ）。
    //
    // 値を書き始めるのは段階4から。いま張れる先は公開済みの2冊しかない
    // （books 12冊中10冊が draft: true）。フィールドだけ先に置くのは、後から足しても
    // 既存カードを触らずに済む一方、名前を段階4で決め直すと移行が二度になるため
    books: z.array(z.string()).default([]),
    webrefs: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    // 裏どりの取れていない外部事実（発売年・作詞者・過去記事の題など）をここに書き出す。
    // 1 項目でも残っているとビルドが落ちる（`scripts/check-cards.mjs` 検査1）。
    //
    // 2026-08-11 の `0f49dec` は「未確認。push 前に確認する」を **commit 本文にだけ**書き、
    // ファイルは断定形のまま 14 枚を公開まで進めた。印がファイルに無ければ誰も止められない。
    // sources は任意項目なので「確認が取れないなら書かない」は常に合格する。断定して出すか、
    // 黙って省くか、この 2 つのうち後者を最小コストにするための欄である。
    unverified: z.array(z.string()).default([]),
    // `figure` が歌詞以外（曲名など）から作られているときに、その出所を書く。
    // この欄が空のカードは figure を歌詞から取ったとみなし、`<LyricQuote>` による
    // 引用の裏づけを必須にする（`scripts/check-cards.mjs` 検査4）。
    //
    // 2026-08-12 まで、引用を持たないカードは検査2・3の両方から外れていた。図に歌詞を
    // 描きながら、その歌詞を機械が一度も検算していないカードが11枚あった。理由を書かせる
    // 欄にしてあるのは、除外が安易に増えるのを防ぐため。
    figureSource: z.string().optional(),
    figure: figureSchema.optional(),
    created: z.coerce.date(),
    updated: z.coerce.date(),
  }),
});

// 推薦図書。Zotero の蔵書から選書したものを 1 冊 1 ファイルで持つ。
// 本文はやおき自身が書くレビュー。Claude は代筆しない（書誌情報だけから書けば
// 印象批評か幻覚になる。金銭を伴う以上、誤帰属の損害が普段と違う）。
//
// アフィリエイトの URL は frontmatter に持たせず、asin とトラッキング ID から
// ページ側で組み立てる。ID を変えるとき 1 箇所で済ませるため。
const books = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    publisher: z.string().optional(),
    year: z.string().optional(),
    isbn13: z.string().regex(/^97[89]\d{10}$/, 'ISBN-13 をハイフン無しで書く'),
    // ISBN-10 と一致する。978 始まりなら計算で出せるが、実在は必ず別途検証すること
    // （ISBN が正しくても amazon.co.jp にその版が無いことがある。2026-08-06 実測）
    asin: z.string().regex(/^[0-9]{9}[0-9X]$/),
    // 読者層の仮説。A=知的好奇心（理論の知識なし） / B=批評の方法論 / C=制作
    // どの本が売れたかで層を逆算するので、層が分離できない選書は計測器にならない
    layer: z.enum(['A', 'B', 'C']),
    priceJPY: z.number().int().positive().optional(),
    // 「この本を拙著◯章で使った」の内部リンク。書棚から本文へ張ると被引用性が立つ
    usedIn: z
      .array(z.object({ label: z.string(), href: z.string() }))
      .default([]),
    created: z.coerce.date(),
    updated: z.coerce.date(),
    // レビュー本文が書かれるまでは公開しない。スタブが並ぶと信用を損なうため既定は true
    draft: z.boolean().default(true),
  }),
});

// 推薦 Web 文献。書籍（books）とは役割が違う。
//
// books は計測器で、どの本が売れたかから読者層を逆算する。webrefs は収益にならない。
// 代わりに持つのは**自分の領域の境界を示す機能**で、隣接領域の書き手を挙げることで
// 「あちらは和声、こちらは歌詞の音」という線が読者に見える。
//
// Web は消える。書籍と違って URL が死ぬので lastChecked を持たせ、定期的に検証する。
const webrefs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/webrefs' }),
  schema: z.object({
    // 連載名・チャンネル名。人ではなく「その媒体」の名前
    title: z.string(),
    author: z.string(),
    url: z.string().url(),
    kind: z.enum(['youtube', 'note', 'blog', 'site', 'podcast', 'x']),
    // 同じ書き手の別媒体（YouTube の人が note も書いている、など）
    also: z
      .array(z.object({ kind: z.string(), url: z.string().url() }))
      .default([]),
    // リンクが生きていることを最後に確認した日
    lastChecked: z.coerce.date(),
    created: z.coerce.date(),
    updated: z.coerce.date(),
    // 「なぜ薦めるか」が書かれるまで公開しない。リンク集だけ並べても境界は示せない
    draft: z.boolean().default(true),
  }),
});

export const collections = { blog, concept, author, elements, books, webrefs };

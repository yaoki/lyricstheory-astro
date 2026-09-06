// @ts-check
/**
 * elements カードを公開前に検査する。
 *
 * **この検査が保証するのは「貼付されたテキストが、カードの中で変異していないこと」だけである。**
 * 貼付そのものが誤っていれば、3つの検査すべてを素通りする。合格を「歌詞が正しい」証明として
 * 扱わないこと。
 *
 * 源泉の正しさを見るのは、この検査ではなく歌詞サイトとの照合（CLAUDE.md「歌詞の扱い」）である。
 * 段が違う。照合が貼付そのものを検算し、この検査が照合を通った貼付の変異を見る。
 *
 * 止めるもの:
 *   検査1  未検証の外部事実（`unverified` が残ったまま公開へ進むこと）
 *   検査2  同じ曲の同じ行が、カードによって違う字で書かれていること
 *   検査3  図の文字列が、同じカードの引用に無い字を含んでいること
 *   検査4  図に歌詞があるのに、引用の裏づけも figureSource も無いこと
 *   検査5  related / terms の参照先が実在しないこと（表示側が黙って捨てるため）
 *   検査6  books / webrefs の参照先が無い、または draft のままであること
 *   検査7  card id が、将来のファセット URL のための予約語と衝突すること
 *   検査8  title の曲名と song が食い違っていること
 *   検査9  no が欠落している・正の整数でない・重複していること
 *
 * 検査5〜8 は 2026-08-13 追加（段階1）。1〜4 が「貼付されたテキストの変異」を見るのに対し、
 * 5〜8 は**参照とメタデータの整合**を見る。前者は歌詞の写し崩れ、後者はリンク切れと
 * 分類の割れを止める。
 *
 * 検査9 は通し番号（`E42` 表記）の導入にともない追加。created 順の連番・追記のみ・
 * 改番禁止・欠番許容という方針（`scripts/assign-numbers.mjs`）が壊れていないかを見る。
 *
 * 検査2 は 2026-08-11 の事故（`ad1a478`、夏の魔物 1-A の「の」脱落。2枚のカードが同じ行を
 * 図にしていて片方だけ字が落ちていた）を、事故当時のツリーで誤検出ゼロのまま検出できる。
 * 検査3 は同じ commit が語る根本原因（「貼付が正で、1行に伸ばしたときの再入力が誤り」）を、
 * カード1枚の中で塞ぐ。
 *
 * 使い方:
 *   npm run check:cards         単体で走らせる
 *   npm run build               astro build の前に自動で走る（astro.config.mjs の integration）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 図の枠上限（`units` の 8）で末尾が落ちるため、図が引用より短いのは正常。 */
const MIN_COMPARABLE_LENGTH = 6;

/** 類似と見なす下限。これ以上似ていて、なお一致しない行を「写し崩れの疑い」とする。 */
const SIMILARITY_THRESHOLD = 0.85;

/** 別の箇所の引用を「似ている」と誤認しないための長さ差の上限。 */
const MAX_LENGTH_GAP = 3;

/**
 * カードの id に使えない語。2 種類ある。
 *
 * - `artist` / `song` / `type` / `phoneme` / `era` / `tag`
 *   将来 `/elements/song/<slug>/` のようなファセットを切るときの 1 セグメント目の候補。
 *   URL はまだ切らない（切った瞬間に slug が SEO 資産になり、改名に 301 が要る）。
 *   2026-08-13 時点で衝突は 0 件なので、いま予約しておけば無償で済む。
 * - `sounds` / `atlas` / `book` / `e`
 *   **既に実在する、または将来実在させる静的ページ**。Astro は静的ルートを動的ルートより
 *   優先するので、これらの id でカードを書くとビルドは通ったままカードのページだけが
 *   **黙って消える**。検査5 が related のタイポで塞いだのと同じ「静かに消える」経路なので、
 *   id 側で止める。
 *   - `sounds`: `src/pages/elements/sounds/index.astro`（音で引く入口）
 *   - `atlas` / `book`: `/elements/atlas/` `/elements/book/` の静的ページ
 *   - `e`: `/e/<no>/` の短縮 URL（`astro.config.mjs` の `shortUrls` integration）
 */
const RESERVED_SLUGS = ['artist', 'song', 'type', 'phoneme', 'era', 'tag', 'sounds', 'atlas', 'book', 'e'];

/**
 * 比較用に正規化する。呼応の鉤括弧・強調・空白は表記の都合なので落とし、
 * 音そのものだけを残す。行頭の位置ラベル（「1-サビ　」等）も落とす。
 * @param {string} raw
 * @returns {string}
 */
function normalizeLyricLine(raw) {
  let s = raw.replace(/\*\*/g, '');
  for (const bracket of ['「', '」', '〈', '〉', '〔', '〕']) {
    s = s.split(bracket).join('');
  }
  // 行頭ラベル: 全角空白の前にひらがな以外が混じっていれば、そこまでを落とす
  const labelled = s.match(/^([^　]*)　(.*)$/);
  if (labelled && /[^ぁ-ゟー]/.test(labelled[1])) s = labelled[2];
  return s.replace(/[\s　]/g, '').trim();
}

/**
 * 正規化後に、ひらがなと長音だけで出来ているか。
 * そうでない行は歌詞以外の記述が混じっているとみなし、検査から外す（誤検出を避けるため）。
 * @param {string} normalized
 */
function isPureKana(normalized) {
  return normalized.length > 0 && /^[ぁ-ゟー]+$/.test(normalized);
}

/**
 * レーベンシュタイン距離。
 * @param {string} a
 * @param {string} b
 */
function editDistance(a, b) {
  /** @type {number[]} */
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * 0〜1 の類似度。
 * @param {string} a
 * @param {string} b
 */
function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

/**
 * frontmatter ブロック（先頭の `---` 〜次の `---`）を返す。
 * @param {string} content
 */
function frontmatterOf(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : '';
}

/**
 * 1枚のカードから、検査に要る材料を取り出す。
 * @param {string} filePath
 */
function readCard(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontmatter = frontmatterOf(content);

  /** @type {{ song: string, line: string, raw: string }[]} */
  const quotes = [];
  /** @type {string[]} */
  const skipped = [];
  for (const block of content.matchAll(/<LyricQuote([^>]*)>([\s\S]*?)<\/LyricQuote>/g)) {
    const song = (block[1].match(/song="([^"]*)"/) ?? [, '(曲名なし)'])[1];
    for (const rawLine of block[2].trim().split('\n')) {
      // 「／」は同じ行に複数箇所を並べる区切りなので、別々の引用として扱う
      for (const piece of rawLine.split('／')) {
        if (!piece.trim()) continue;
        const line = normalizeLyricLine(piece);
        if (!line) continue;
        if (isPureKana(line)) quotes.push({ song, line, raw: piece.trim() });
        else skipped.push(piece.trim());
      }
    }
  }

  // 図に出る文字列。
  //
  // キー名では拾わない。`figure:` ブロックの中の**最も内側の配列リテラル**を全部取る。
  // units（single / consonant）も rows（pair）も同じ形で拾え、インライン記法
  // （`rows: [["そ",…], ["そ",…]]`）と複数行リスト記法の両方に効く。行ごとに別々の
  // 配列として取れるので、2行を連結した偽の文字列も作らない。
  // labels（["1-A"]）や highlight（[2, 7]）のような歌詞でない配列は、下の isPureKana で落ちる。
  //
  // キー名で拾っていた 2026-08-12 以前は、インライン記法の pair 2枚が検査3から漏れていた。
  /** @type {string[]} */
  const figures = [];
  const figureBlock = frontmatter.match(/^figure:\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  if (figureBlock) {
    for (const m of figureBlock[1].matchAll(/\[([^[\]]*)\]/g)) {
      const joined = [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]).join('');
      if (joined) figures.push(joined);
    }
    for (const m of figureBlock[1].matchAll(/text:[ \t]*"([^"]*)"/g)) {
      figures.push(m[1]);
    }
  }

  // 参照と未検証項目（`unverified` / `related` / `terms` / `books` / `webrefs`）
  const unverified = readListField(frontmatter, 'unverified');
  const related = readListField(frontmatter, 'related');
  const terms = readListField(frontmatter, 'terms');
  const books = readListField(frontmatter, 'books');
  const webrefs = readListField(frontmatter, 'webrefs');

  // figure が歌詞以外（曲名など）から作られていることの明示
  const figureSourceMatch = frontmatter.match(/^figureSource:[ \t]*(.+)$/m);
  const figureSource = figureSourceMatch
    ? figureSourceMatch[1].trim().replace(/^["']|["']$/g, '')
    : '';

  const title = (frontmatter.match(/^title:[ \t]*"(.*)"[ \t]*$/m) ?? [, ''])[1];
  const type = (frontmatter.match(/^type:[ \t]*"?([a-z]+)"?[ \t]*$/m) ?? [, ''])[1];
  // 通し番号（E42 表記）。検査9 が欠落・非正の整数・重複を見る。
  // まず行の有無を見てから正の整数かを判定する（`no: 0` や `no: -1` を
  // 「欠落」ではなく「正の整数でない」として区別するため）
  const noLineMatch = frontmatter.match(/^no:[ \t]*(.+?)[ \t]*$/m);
  const noRaw = noLineMatch ? noLineMatch[1] : undefined;
  const no = noRaw !== undefined && /^\d+$/.test(noRaw) ? Number(noRaw) : undefined;
  const noPresent = noRaw !== undefined;
  const noValid = no !== undefined && Number.isInteger(no) && no > 0;

  // frontmatter の song。キーの順序に依らないよう、ブロックを取ってから個別に拾う
  const songBlock = frontmatter.match(/^song:\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  const song = songBlock
    ? {
        title: (songBlock[1].match(/title:[ \t]*"([^"]*)"/) ?? [, ''])[1],
        artist: (songBlock[1].match(/artist:[ \t]*"([^"]*)"/) ?? [, ''])[1],
      }
    : null;

  // title「アーティスト『曲名』：観察名」から読める曲。song の照合相手になる
  const titleSongMatch = title.match(/^(.+?)『(.+?)』/);
  const titleSong = titleSongMatch
    ? { artist: titleSongMatch[1], title: titleSongMatch[2] }
    : null;

  return {
    slug: path.basename(filePath).replace(/\.mdx?$/, ''),
    title,
    no,
    noPresent,
    noValid,
    type,
    song,
    titleSong,
    related,
    terms,
    books,
    webrefs,
    quotes,
    figures: figures.map(normalizeLyricLine).filter(isPureKana),
    unverified,
    figureSource,
    skipped,
  };
}

/**
 * frontmatter の配列フィールドを読む。インライン記法（`terms: [a, b]`）と
 * 複数行リスト記法の両方に効く。キーが無い・空配列なら空配列を返す。
 *
 * `\s*` を使わないのは、改行を食って次の行まで inline 値として拾ってしまうため。
 * 水平の空白だけを許す。
 * @param {string} frontmatter
 * @param {string} key
 * @returns {string[]}
 */
function readListField(frontmatter, key) {
  const block = frontmatter.match(
    new RegExp(`^${key}:[ \\t]*(.*)$((?:\\r?\\n[ \\t]+-[ \\t].*)*)`, 'm'),
  );
  if (!block) return [];
  /** @type {string[]} */
  const items = [];
  const inline = block[1].trim();
  if (inline && inline !== '[]') {
    for (const item of inline.replace(/^\[|\]$/g, '').split(',')) {
      const cleaned = item.trim().replace(/^["']|["']$/g, '');
      if (cleaned) items.push(cleaned);
    }
  }
  for (const item of (block[2] ?? '').matchAll(/^[ \t]+-[ \t]*(.+)$/gm)) {
    items.push(item[1].trim().replace(/^["']|["']$/g, ''));
  }
  return items;
}

/**
 * ディレクトリ配下の .md / .mdx を再帰的に集める。blog は年ごとの下位ディレクトリに入る。
 * @param {string} dir
 * @returns {string[]}
 */
function collectMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectMarkdownFiles(full));
    else if (/\.mdx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * elements カード全体を検査する。
 * @param {string} rootDir リポジトリのルート
 * @returns {{ errors: string[], skipped: string[], cardCount: number }}
 */
export function runCardChecks(rootDir) {
  const dir = path.join(rootDir, 'src/content/elements');
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => path.join(dir, f));
  const cards = files.map(readCard);

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const skipped = [];

  // 検査1: 未検証の外部事実が残ったまま公開へ進むのを止める
  for (const card of cards) {
    if (card.unverified.length === 0) continue;
    errors.push(
      `[未検証] ${card.slug}\n` +
        card.unverified.map((item) => `    ・${item}`).join('\n') +
        `\n    → 出所を確かめて値を確定するか、その項目自体を書かずに出すか、どちらかにしてください。` +
        `\n      sources は任意項目なので「書かない」は常にビルドを通ります。`,
    );
  }

  // 検査2: 同じ曲の同じ行が、カードによって違う字で書かれていないか
  /** @type {Map<string, { slug: string, line: string, raw: string }[]>} */
  const bySong = new Map();
  for (const card of cards) {
    for (const q of card.quotes) {
      if (q.line.length < MIN_COMPARABLE_LENGTH) continue;
      const bucket = bySong.get(q.song) ?? [];
      bucket.push({ slug: card.slug, line: q.line, raw: q.raw });
      bySong.set(q.song, bucket);
    }
    skipped.push(...card.skipped.map((s) => `${card.slug}: ${s}`));
  }
  for (const [song, items] of bySong) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        // 同じカードの中の2行は比べない。回帰反復や対句のカードは「一音だけ違う2行」を
        // 意図して並べる（`tadashii-machi-return-repetition` の「を」→「も」など）。
        // 検査2が見たいのは、別々のカードが同じ行を違う字で書いていることである。
        if (a.slug === b.slug) continue;
        if (a.line === b.line) continue;
        if (Math.abs(a.line.length - b.line.length) > MAX_LENGTH_GAP) continue;
        if (similarity(a.line, b.line) < SIMILARITY_THRESHOLD) continue;
        errors.push(
          `[写し崩れの疑い] 「${song}」の同じ行が、カードによって違う字で書かれています\n` +
            `    ${a.slug}: ${a.raw}\n` +
            `    ${b.slug}: ${b.raw}\n` +
            `    → 貼付されたテキストに戻って、どちらが正しいかを確かめてください。`,
        );
      }
    }
  }

  // 検査4: 図に歌詞があるのに、引用の裏づけが無い
  //
  // 検査2は `<LyricQuote song="...">` の song 属性で曲を同定し、検査3は同じカードの引用と
  // 突き合わせる。どちらも引用が起点なので、引用を持たないカードは 2 つとも素通りする。
  // 2026-08-12 の実測でそれが11枚あった（pretender 3 / tadashii-machi 7 / shido 1）。
  for (const card of cards) {
    if (card.figures.length === 0) continue;
    if (card.quotes.length > 0) continue;
    if (card.figureSource) continue; // 歌詞以外が出所だと明示されている
    errors.push(
      `[引用の裏づけが無い図] ${card.slug}\n` +
        `    図: ${card.figures.join(' ／ ')}\n` +
        `    → このカードは <LyricQuote> を持たないため、検査2（写し崩れ）と検査3（図と引用の\n` +
        `      不一致）の両方から外れています。図の歌詞を誰も検算していません。\n` +
        `      歌詞から取った図なら <LyricQuote> で引用を示してください（作詞者と年が読者に出ます）。\n` +
        `      曲名など歌詞以外から作った図なら、frontmatter の figureSource にその出所を書いてください。`,
    );
  }

  // 検査3: 図の文字列が、同じカードの引用に含まれているか
  for (const card of cards) {
    if (card.quotes.length === 0) continue;
    const haystack = card.quotes.map((q) => q.line).join('／');
    for (const figure of card.figures) {
      if (figure.length < 4) continue;
      if (haystack.includes(figure)) continue;
      errors.push(
        `[図と引用の不一致] ${card.slug}\n` +
          `    図　: ${figure}\n` +
          `    引用: ${haystack}\n` +
          `    → 図は引用の範囲から切り出します。前後を落とすのは正常ですが、` +
          `途中の音が変わっている・落ちているのは写し崩れです。`,
      );
    }
  }

  // 検査5: related / terms の参照先が実在するか
  //
  // `src/pages/elements/[slug]/index.astro` は解決できない id を**黙って捨てる**。
  // タイポしてもビルドは通り、リンクだけが静かに消える。逆引き（`src/lib/backlinks.ts`）を
  // 入れて片側だけ書けば済むようにしたぶん、書き間違いに気づく機会がさらに減った
  const elementIds = new Set(cards.map((card) => card.slug));
  const blogSlugs = collectBlogSlugs(rootDir);
  const termIds = new Set(cards.filter((card) => card.type === 'term').map((card) => card.slug));
  for (const card of cards) {
    for (const id of card.related) {
      if (elementIds.has(id) || blogSlugs.has(id)) continue;
      errors.push(
        `[参照先が無い] ${card.slug} の related: ${id}\n` +
          `    → elements の id か、blog の slug を書きます。解決できない参照は表示側で` +
          `黙って捨てられるため、\n      ビルドが通ってもリンクは出ません。`,
      );
    }
    for (const id of card.terms) {
      if (!elementIds.has(id)) {
        errors.push(
          `[参照先が無い] ${card.slug} の terms: ${id}\n` +
            `    → 用語カード（type: term）の id を書きます。`,
        );
        continue;
      }
      if (!termIds.has(id)) {
        errors.push(
          `[用語カードでない] ${card.slug} の terms: ${id}\n` +
            `    → terms が指せるのは type: term のカードだけです。対等な関連は related に書きます。`,
        );
      }
    }
  }

  // 検査6: books / webrefs が実在し、公開されているか
  //
  // draft のカードへ張ると、リンク先のページがビルドされずリンク切れになる。
  // books は 12 冊中 10 冊が draft（レビュー本文が書かれるまで公開しない方針）なので、
  // 段階4 で張り始めたときに最も踏みやすい
  const externals = {
    books: readExternalDrafts(rootDir, 'books'),
    webrefs: readExternalDrafts(rootDir, 'webrefs'),
  };
  for (const card of cards) {
    for (const field of /** @type {const} */ (['books', 'webrefs'])) {
      for (const id of card[field]) {
        const drafts = externals[field];
        if (!drafts.has(id)) {
          errors.push(`[参照先が無い] ${card.slug} の ${field}: ${id}\n    → src/content/${field}/ に該当のファイルがありません。`);
          continue;
        }
        if (drafts.get(id)) {
          errors.push(
            `[未公開への参照] ${card.slug} の ${field}: ${id}\n` +
              `    → 参照先が draft: true です。本文が書かれて公開されるまで、このリンクは切れます。`,
          );
        }
      }
    }
  }

  // 検査7: card id が予約語と衝突していないか
  //
  // 将来 `/elements/song/<slug>/` のようなファセットを切るなら、その 1 セグメントは
  // カードに使えない。**2026-08-13 時点で衝突は 0 件**なので、いま予約しておけば無償で済む。
  // URL 自体はまだ切らない（切った瞬間に artist slug が SEO 資産になり、改名に 301 が要る）
  for (const card of cards) {
    if (!RESERVED_SLUGS.includes(card.slug)) continue;
    errors.push(
      `[予約語との衝突] ${card.slug}\n` +
        `    → ${RESERVED_SLUGS.join(' / ')} は将来のファセット URL のために空けてあります。` +
        `別の id を付けてください。`,
    );
  }

  // 検査8: title の曲名と song が食い違っていないか
  //
  // song は曲でカードを束ねられる唯一の機械可読な場所で、title は人間可読の題である。
  // 同じ曲を指しているはずの 2 つがずれると、一覧で曲が 2 つに割れる（`sheena` / `shiina`
  // 分裂と同型の事故）。楽曲を対象としないカード（type: principle / term）は両方とも持たない
  for (const card of cards) {
    if (!card.titleSong && !card.song) continue;
    if (card.titleSong && !card.song) {
      errors.push(
        `[song が無い] ${card.slug}\n` +
          `    title: ${card.title}\n` +
          `    → title が曲を掲げているのに song がありません。` +
          `song: { title, artist } を書いてください。`,
      );
      continue;
    }
    if (!card.titleSong && card.song) {
      errors.push(
        `[title に曲が無い] ${card.slug}\n` +
          `    song: ${card.song.artist}『${card.song.title}』\n` +
          `    → song を持つカードの title は「アーティスト『曲名』：観察名」の形にします` +
          `（CLAUDE.md「タイトル規約」）。`,
      );
      continue;
    }
    if (!card.titleSong || !card.song) continue;
    if (card.titleSong.title !== card.song.title || card.titleSong.artist !== card.song.artist) {
      errors.push(
        `[title と song の不一致] ${card.slug}\n` +
          `    title: ${card.titleSong.artist}『${card.titleSong.title}』\n` +
          `    song : ${card.song.artist}『${card.song.title}』\n` +
          `    → 同じ曲を指す 2 つがずれると、一覧で曲が 2 つに割れます。`,
      );
    }
  }

  // 検査9: no が欠落している・正の整数でない・重複していること
  //
  // no は created 順の連番（追記のみ・改番禁止・欠番許容）。手で振ると連番が
  // 崩れるので、欠けているカードは scripts/assign-numbers.mjs で振り直す。
  /** @type {Map<number, string[]>} */
  const byNo = new Map();
  for (const card of cards) {
    if (!card.noPresent) {
      errors.push(
        `[no が無い] ${card.slug}\n` +
          `    → node scripts/assign-numbers.mjs で振ってください。手で番号を決めない・改番しない。`,
      );
      continue;
    }
    if (!card.noValid) {
      errors.push(
        `[no が不正] ${card.slug}\n` +
          `    → no は正の整数にしてください。手で書いた値が壊れている可能性があります。` +
          `node scripts/assign-numbers.mjs で振り直してください。`,
      );
      continue;
    }
    const no = /** @type {number} */ (card.no);
    const bucket = byNo.get(no) ?? [];
    bucket.push(card.slug);
    byNo.set(no, bucket);
  }
  for (const [no, slugs] of byNo) {
    if (slugs.length <= 1) continue;
    errors.push(
      `[no が重複] E${no} が ${slugs.length} 枚のカードに振られています\n` +
        slugs.map((s) => `    ・${s}`).join('\n') +
        `\n    → 改番せず、後から追加した側の no 行を削除してから` +
        ` node scripts/assign-numbers.mjs で振り直してください（既存の番号は動かさない）。`,
    );
  }

  return { errors, skipped, cardCount: cards.length };
}

/**
 * blog の slug を集める。related は elements の id だけでなく essay も指せる。
 * @param {string} rootDir
 * @returns {Set<string>}
 */
function collectBlogSlugs(rootDir) {
  const slugs = new Set();
  for (const file of collectMarkdownFiles(path.join(rootDir, 'src/content/blog'))) {
    const frontmatter = frontmatterOf(fs.readFileSync(file, 'utf-8'));
    const slug = (frontmatter.match(/^slug:[ \t]*["']?([a-z0-9-]+)["']?[ \t]*$/m) ?? [, ''])[1];
    if (slug) slugs.add(slug);
  }
  return slugs;
}

/**
 * books / webrefs の id と draft 状態を集める。
 * **キーが無ければ draft: true**（schema の既定。本文が書かれるまで公開しない）。
 * @param {string} rootDir
 * @param {'books' | 'webrefs'} collection
 * @returns {Map<string, boolean>}
 */
function readExternalDrafts(rootDir, collection) {
  /** @type {Map<string, boolean>} */
  const drafts = new Map();
  for (const file of collectMarkdownFiles(path.join(rootDir, `src/content/${collection}`))) {
    const frontmatter = frontmatterOf(fs.readFileSync(file, 'utf-8'));
    const value = (frontmatter.match(/^draft:[ \t]*(true|false)/m) ?? [, 'true'])[1];
    drafts.set(path.basename(file).replace(/\.mdx?$/, ''), value === 'true');
  }
  return drafts;
}

const __filename = fileURLToPath(import.meta.url);

/** CLI として直に叩かれたときの入口。 */
function main() {
  const rootDir = path.resolve(path.dirname(__filename), '..');
  const { errors, skipped, cardCount } = runCardChecks(rootDir);

  if (skipped.length > 0) {
    console.log(`[check-cards] 歌詞以外の記述が混じるため検査から外した行: ${skipped.length} 件`);
    for (const s of skipped) console.log(`    ${s}`);
  }

  if (errors.length === 0) {
    console.log(`[check-cards] カード ${cardCount} 枚、指摘なし。`);
    console.log(
      '[check-cards] ただしこれは「貼付後に変異していない」ことの確認であって、' +
        '歌詞そのものが正しいことの確認ではありません（源泉は歌詞サイト照合が見ます）。',
    );
    return;
  }

  console.error(`[check-cards] カード ${cardCount} 枚に ${errors.length} 件の指摘があります。\n`);
  for (const e of errors) console.error(`  ${e}\n`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();

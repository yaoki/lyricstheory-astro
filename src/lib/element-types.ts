// elements の type（推奨語彙）→ 人間可読なラベル。推奨語彙は CLAUDE.md「type（推奨語彙）」に準拠。
// type は enum ではなく z.string() なので、未知の値は 'other' 相当にフォールバックする。
//
// llms.txt（AI 向けの案内）と RSS の両方が参照する。同じラベルを2箇所で持つと片方が古くなるため、
// ここ一箇所に置く（写しを置かない原則。2026-08-04）。
// なお、これは type の「表示名」であって定義ではない。定義の正本は docs/theory-glossary.md。

export const TYPE_LABELS: Record<string, string> = {
  // principle は楽曲を対象としない記述方針そのもののカードなので、個別事例より先に置く
  principle: '記述方針',
  pivot: '子音ピボット',
  pattern: '反復パターン',
  sequenz: '音韻的ゼクエンツ',
  syllable: '音節構造',
  rhyme: '押韻',
  prosody: '韻律',
  other: '音韻分析',
};

// 案内での並び順
export const TYPE_ORDER = Object.keys(TYPE_LABELS);

export const typeLabel = (type: string): string => TYPE_LABELS[type] ?? TYPE_LABELS.other;

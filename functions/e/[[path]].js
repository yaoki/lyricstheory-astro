// /e/<no>/ → /elements/<slug>/ の 301。通し番号（E42）を永続リンクとして通用させる。
//
// 当初は astro:build:done で dist/_redirects に 1 行ずつ追記していたが、Cloudflare Pages は
// _redirects を **合計 100 行で打ち切る**ことが 2026-09-06 の本番で分かった（手書き 21 行 ＋
// 番号 135 行のうち、/e/79/ までが効き /e/80/ から 404。公称の上限 2,000 とは別の実測値）。
// 打ち切りは末尾から起きるので、手書きの改名転送を後から足すと**そちらが黙って落ちる**。
// 番号は増え続けるので、静的な行ではなく関数で引く。
//
// 実体は従来どおり /elements/<slug>/ にしかない。番号→slug の表は
// /elements/e-map.json（src/pages/elements/e-map.json.ts がビルド時に生成）を
// 同じデプロイの静的アセットから読む。この関数が動くのは /e/* だけ（public/_routes.json）。
export async function onRequest({ params, request, env }) {
  const url = new URL(request.url);
  const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const no = Number(segments[0] ?? '');

  const notFound = async () => {
    const page = await env.ASSETS.fetch(new URL('/404.html', url.origin));
    return new Response(page.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  };

  if (segments.length !== 1 || !Number.isInteger(no) || no <= 0) return notFound();

  const res = await env.ASSETS.fetch(new URL('/elements/e-map.json', url.origin));
  if (!res.ok) return notFound();
  const map = await res.json();
  const slug = map[String(no)];
  if (!slug) return notFound();

  return Response.redirect(`${url.origin}/elements/${slug}/`, 301);
}

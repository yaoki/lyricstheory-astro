#!/usr/bin/env python3
"""database.sql から wp_posts (post_status=publish, post_type=post) を抽出し、
   カテゴリ・タグを wp_term_relationships / wp_term_taxonomy / wp_terms から結合して JSON 出力。

Usage:
  python3 scripts/extract_posts.py <database.sql> <output.json>
"""
import json
import re
import sys
from pathlib import Path

# WordPress の wp_posts 標準 23 カラム
POSTS_COLS = [
    'ID', 'post_author', 'post_date', 'post_date_gmt', 'post_content',
    'post_title', 'post_excerpt', 'post_status', 'comment_status', 'ping_status',
    'post_password', 'post_name', 'to_ping', 'pinged', 'post_modified',
    'post_modified_gmt', 'post_content_filtered', 'post_parent', 'guid', 'menu_order',
    'post_type', 'post_mime_type', 'comment_count',
]

# wp_terms: term_id, name, slug, term_group
TERMS_COLS = ['term_id', 'name', 'slug', 'term_group']
# wp_term_taxonomy: term_taxonomy_id, term_id, taxonomy, description, parent, count
TT_COLS = ['term_taxonomy_id', 'term_id', 'taxonomy', 'description', 'parent', 'count']
# wp_term_relationships: object_id, term_taxonomy_id, term_order
TR_COLS = ['object_id', 'term_taxonomy_id', 'term_order']

INSERT_RE = re.compile(r"^INSERT INTO `([^`]+)` VALUES \((.*)\);\s*$")


def parse_values_tuple(s):
    vals = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c == ' ' or c == ',':
            i += 1
            continue
        if c == "'":
            i += 1
            buf = []
            while i < n:
                ch = s[i]
                if ch == '\\':
                    nxt = s[i + 1] if i + 1 < n else ''
                    mapping = {'n': '\n', 'r': '\r', 't': '\t', '0': '\0',
                               "'": "'", '"': '"', '\\': '\\', 'Z': '\x1a'}
                    buf.append(mapping.get(nxt, nxt))
                    i += 2
                elif ch == "'":
                    if i + 1 < n and s[i + 1] == "'":
                        buf.append("'")
                        i += 2
                    else:
                        i += 1
                        break
                else:
                    buf.append(ch)
                    i += 1
            vals.append(''.join(buf))
        elif c == ')':
            break
        else:
            j = i
            while j < n and s[j] not in ',)':
                j += 1
            token = s[i:j].strip()
            if token.upper() == 'NULL':
                vals.append(None)
            else:
                try:
                    vals.append(int(token) if '.' not in token else float(token))
                except ValueError:
                    vals.append(token)
            i = j
    return vals


def iter_rows(sql_path, table_name):
    target = f"INSERT INTO `{table_name}` VALUES ("
    with open(sql_path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if not line.startswith(target):
                continue
            m = INSERT_RE.match(line)
            if not m:
                continue
            yield parse_values_tuple(m.group(2))


def load_rows(sql_path, table_name, cols):
    result = []
    for vals in iter_rows(sql_path, table_name):
        row = dict(zip(cols, vals))
        result.append(row)
    return result


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <database.sql> <output.json>", file=sys.stderr)
        sys.exit(2)
    sql_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])

    # SERVMASK_PREFIX_ プレフィックスを使用
    prefix = 'SERVMASK_PREFIX_'

    posts = load_rows(sql_path, f'{prefix}posts', POSTS_COLS)
    terms = load_rows(sql_path, f'{prefix}terms', TERMS_COLS)
    tts = load_rows(sql_path, f'{prefix}term_taxonomy', TT_COLS)
    trs = load_rows(sql_path, f'{prefix}term_relationships', TR_COLS)

    # 索引
    term_by_id = {t['term_id']: t for t in terms}
    tt_by_id = {tt['term_taxonomy_id']: tt for tt in tts}

    # object_id -> [(taxonomy, term_name, term_slug), ...]
    obj_terms = {}
    for tr in trs:
        tt = tt_by_id.get(tr['term_taxonomy_id'])
        if not tt:
            continue
        term = term_by_id.get(tt['term_id'])
        if not term:
            continue
        obj_terms.setdefault(tr['object_id'], []).append({
            'taxonomy': tt['taxonomy'],
            'name': term['name'],
            'slug': term['slug'],
        })

    # publish + post のみに絞って軽量化
    published = [p for p in posts if p['post_status'] == 'publish' and p['post_type'] == 'post']
    published.sort(key=lambda p: p['post_date'])

    output = []
    for p in published:
        obj_id = p['ID']
        associated = obj_terms.get(obj_id, [])
        categories = [t['name'] for t in associated if t['taxonomy'] == 'category']
        tags = [t['name'] for t in associated if t['taxonomy'] == 'post_tag']
        output.append({
            'id': obj_id,
            'slug': p['post_name'],
            'title': p['post_title'],
            'excerpt': p['post_excerpt'] or '',
            'content_html': p['post_content'],
            'post_date': str(p['post_date']),
            'post_modified': str(p['post_modified']),
            'categories': categories,
            'tags': tags,
        })

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"抽出 {len(output)} 記事 → {out_path}", file=sys.stderr)


if __name__ == '__main__':
    main()

#!/bin/sh
set -eu

database="${DATABASE_URL:?set DATABASE_URL to a database that holds the catalog}"
target="$(dirname "$0")/../internal/inspection/name_characters.txt"

psql "$database" -Atq -v ON_ERROR_STOP=1 > "$target" <<'SQL'
select string_agg(ch, '' order by uses desc, ch collate "C")
from (
  select ch, count(*) as uses
  from games,
    regexp_split_to_table(concat_ws('', title_jp, title_zh, title_en, array_to_string(aliases, '')), '') as ch
  where ascii(ch) > 127
  group by ch
  order by uses desc, ch collate "C"
  limit 3000
) ranked;
SQL

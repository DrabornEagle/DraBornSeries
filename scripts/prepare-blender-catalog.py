"""Reproduce the full-film catalog migration from verified media, without fixed IDs."""
import json
import sys
from pathlib import Path

films = json.loads(Path('docs/blender-film-catalog.json').read_text())
quote = lambda text: "'" + str(text).replace("'", "''") + "'"

def value(item):
    if isinstance(item, bool): return 'true' if item else 'false'
    if isinstance(item, int): return str(item)
    if isinstance(item, list): return 'array[' + ','.join(quote(x) for x in item) + ']::text[]'
    if isinstance(item, dict): return quote(json.dumps(item, ensure_ascii=False)) + '::jsonb'
    return quote(item)

sql = '-- v0.5 full Blender films; existing app content, IDs and playback UIDs survive.\n'
for i, film in enumerate(films):
    credit = {key: film[key] for key in ['creator','license','license_url','modifications','preview_allowed']}
    credit['source_url'] = film['source']
    row = dict(slug=film['slug'], title=film['title'], short_description=film['summary'], description=film['summary'],
               poster_url=film['poster_url'], banner_url=film['poster_url'], genres=film['genres'],
               tags=['Blender','Açık Film','Tam Film'], director=film['director'], production_year=film['year'], country='NL',
               age_rating=film['age_rating'], language='en', status='published', is_demo=True, featured_order=i+5,
               total_seasons=1, total_episodes=1, average_duration=film['duration'], license=film['license'], source_credit=credit)
    columns = ','.join(row)
    sql += 'insert into drabornseries.dbs_series(' + columns + ') values(' + ','.join(value(v) for v in row.values()) + ')\n'
    sql += 'on conflict(slug) do update set ' + ','.join(c+'=excluded.'+c for c in row if c not in ['slug','is_demo']) + ' where dbs_series.is_demo;\n'
    match = 's.slug=' + quote(film['slug']) + ' and s.is_demo'
    sql += "insert into drabornseries.dbs_seasons(series_id,number,title) select s.id,1,'Tam film' from drabornseries.dbs_series s where " + match + ' on conflict(series_id,number) do nothing;\n'
    episode = dict(number=1,title=film['title'],description=film['summary'],duration_seconds=film['duration'],thumbnail_url=film['poster_url'],orientation='landscape',access_type='free',status='published')
    sql += 'insert into drabornseries.dbs_episodes(series_id,season_id,' + ','.join(episode) + ') select s.id,se.id,' + ','.join(value(v) for v in episode.values()) + ' from drabornseries.dbs_series s join drabornseries.dbs_seasons se on se.series_id=s.id and se.number=1 where ' + match + '\n'
    sql += 'on conflict(series_id,number) do update set ' + ','.join(c+'=excluded.'+c for c in episode if c!='number') + ';\n'
    renditions = quote(json.dumps(film['renditions'],ensure_ascii=False)) + '::jsonb'
    sql += "insert into drabornseries.dbs_video_assets(episode_id,provider,demo_url,ready,renditions) select e.id,'demo'," + quote(film['video_url']) + ',true,' + renditions + ' from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id where ' + match + ' and e.number=1\n'
    sql += "on conflict(episode_id) do update set demo_url=excluded.demo_url,ready=true,renditions=excluded.renditions where dbs_video_assets.provider='demo';\n"
for genre in sorted(set(g for f in films for g in f['genres'])):
    sql += 'insert into drabornseries.dbs_genres(id,name) values(' + quote(genre) + ',' + quote(genre) + ') on conflict do nothing;\n'
if len(sys.argv) != 2: raise SystemExit('Pass the migration path generated with npm run db:new.')
destination = Path(sys.argv[1])
if destination.parent != Path('supabase/migrations'): raise SystemExit('Expected a supabase/migrations path.')
destination.write_text(sql)
print(f'Prepared {len(films)} complete films from verified media.')

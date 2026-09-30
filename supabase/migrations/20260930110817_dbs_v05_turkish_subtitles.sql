-- Default new videos to portrait; existing explicit directions are preserved.
alter table drabornseries.dbs_episodes alter column orientation set default 'portrait';

-- Repeated Studio saves must keep one subtitle per language and episode.
create unique index if not exists dbs_subtitles_episode_language_idx
  on drabornseries.dbs_subtitles(episode_id, language);

-- Only curated demo films receive the licensed Turkish sidecars.
-- Resolve real episode IDs from natural keys; do not replace manually managed tracks.
insert into drabornseries.dbs_subtitles(episode_id, language, label, asset_key)
select e.id, t.language, t.label, t.url
from (values
  ('sintel', 1, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/sintel-1-tr.vtt'),
  ('elephants-dream', 1, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/elephants-dream-1-tr.vtt'),
  ('cosmos-laundromat', 1, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/cosmos-laundromat-1-tr.vtt'),
  ('sprite-fright', 1, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/sprite-fright-1-tr.vtt'),
  ('tears-of-steel', 1, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/tears-of-steel-1-tr.vtt'),
  ('tears-of-steel', 2, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/tears-of-steel-2-tr.vtt'),
  ('tears-of-steel', 3, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/tears-of-steel-3-tr.vtt'),
  ('tears-of-steel', 4, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/tears-of-steel-4-tr.vtt'),
  ('tears-of-steel', 5, 'tr', 'Türkçe', 'https://www.draborneagle.com/DraBornSeries/media/subtitles/tears-of-steel-5-tr.vtt')
) as t(slug, number, language, label, url)
join drabornseries.dbs_series s on s.slug=t.slug and s.is_demo and s.status='published'
join drabornseries.dbs_episodes e on e.series_id=s.id and e.number=t.number and e.status='published'
on conflict(episode_id, language) do update
set label=excluded.label, asset_key=excluded.asset_key
where dbs_subtitles.asset_key like 'https://www.draborneagle.com/DraBornSeries/media/subtitles/%';

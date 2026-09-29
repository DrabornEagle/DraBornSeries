-- Old Google sample bucket denies public access. Use verified public test sources.
update drabornseries.dbs_video_assets a set demo_url=case when s.slug='sintel' then 'https://media.w3.org/2010/05/sintel/trailer.mp4' else 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' end
from drabornseries.dbs_episodes e join drabornseries.dbs_series s on s.id=e.series_id
where a.episode_id=e.id and s.is_demo and s.slug in ('sintel','big-buck-bunny') and a.provider='demo';
update drabornseries.dbs_episodes e set title='Sintel · Resmî fragman',duration_seconds=52 from drabornseries.dbs_series s where e.series_id=s.id and s.slug='sintel' and s.is_demo;
update drabornseries.dbs_series set description='Blender Foundation açık filminin 52 saniyelik resmî fragmanı. © Blender Foundation / sintel.org — Creative Commons Attribution 3.0.' where slug='sintel' and is_demo;

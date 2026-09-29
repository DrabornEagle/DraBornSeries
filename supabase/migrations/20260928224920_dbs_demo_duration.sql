-- Duration verified from the HLS media playlist: 634.584 seconds.
update drabornseries.dbs_episodes e set duration_seconds=635 from drabornseries.dbs_series s where e.series_id=s.id and s.slug='big-buck-bunny' and s.is_demo;

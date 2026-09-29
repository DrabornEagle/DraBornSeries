from pathlib import Path
import json
base='https://www.draborneagle.com/DraBornSeries/media/'
rows=[
 dict(slug='gece-hatti',title='Gece Hattı',title_en='Night Line',short_description='Bir telefon. İki yabancı. Sabaha kadar saklanamayacak bir sır.',description='Gece yarısı gelen bir arama, yolları asla kesişmemesi gereken iki insanı aynı sahil yolunda buluşturur. Şehrin ışıkları sönerken gerçeğe giden tek yol birbirlerine güvenmektir. DraBornSeries için geliştirilmekte olan özgün dizi konsepti; bölümleri henüz yayınlanmadı.',genres=['Gerilim','Dram'],accent='#f547a5',poster_url=base+'gece-hatti.png',banner_url=base+'gece-hatti.png',featured_order=1),
 dict(slug='son-yaz',title='Son Yazdan Kalan',short_description='Bazı vedalar, yeni bir hikâyenin ilk cümlesidir.',description='Yıllar sonra sahil kasabasına dönen Deniz, çocukluğundan kalan bir mektubun izini sürer. Özgün romantik dram konsepti; yakında.',genres=['Romantik','Dram'],accent='#fc915f',poster_url='https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=720&q=85',featured_order=2),
 dict(slug='sifir-noktasi',title='Sıfır Noktası',short_description='Dünya durduğunda, zaman sana ne anlatır?',description='Her gece tam 03.17’de şehirdeki tüm saatler durur. Bunu hatırlayan tek kişi genç bir saat ustasıdır. Özgün bilimkurgu konsepti; yakında.',genres=['Bilimkurgu','Gizem'],accent='#9b7cfa',poster_url='https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=720&q=85',is_vip=True),
 dict(slug='kiyi',title='Kıyı',short_description='Denizin sakladığını hiçbir şehir unutamaz.',description='Kaybolan bir tekne, terk edilmiş bir otel ve birbiriyle kesişen üç hayat. Özgün gizem konsepti; yakında.',genres=['Gizem','Dram'],accent='#40cec3',poster_url='https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=720&q=85'),
 dict(slug='neon-kalp',title='Neon Kalp',short_description='Bu şehirde herkesin bir ritmi var.',description='İlk konserine hazırlanan bir müzisyen, komşusuyla kaydettiği bir şarkıyla beklenmedik bir yolculuğa çıkar. Özgün romantik müzik konsepti; yakında.',genres=['Romantik','Müzik'],accent='#eb568b',poster_url='https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=720&q=85'),
 dict(slug='yuksek-sezon',title='Yüksek Sezon',short_description='Küçük bir otel. Çok büyük meseleler.',description='Bir aile otelinin yeni çalışanları, sezonun ilk gününde kendilerini komik bir yanlış anlaşılmanın içinde bulur. Özgün komedi konsepti; yakında.',genres=['Komedi'],accent='#e4b45c',poster_url='https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=720&q=85'),

]
quote=lambda value: "'"+str(value).replace("'","''")+"'"
def value(v):
 if isinstance(v,bool): return 'true' if v else 'false'
 if isinstance(v,int):return str(v)
 if isinstance(v,list):return 'array['+','.join(map(quote,v))+']::text[]'
 return quote(v)
sql='-- Development catalog: original concepts are not presented as released shows.\n'
for row in rows:
 row={'status':'coming_soon','country':'TR','production_year':2026,'age_rating':'13+','total_episodes':0,**row}
 sql+='insert into drabornseries.dbs_series('+','.join(row)+') values('+','.join(value(v) for v in row.values())+') on conflict(slug) do nothing;\n'
sql+="insert into drabornseries.dbs_seasons(series_id,number,title) select id,1,'Sezon 1' from drabornseries.dbs_series on conflict do nothing;\n"
for number in [50,100,250,500,1000,2500]:
 sql+=f"insert into drabornseries.dbs_google_play_products(id,kind,coins,active) values('dbs_coins_{number}','coins',{number},false) on conflict do nothing;\ninsert into drabornseries.dbs_borncoins_products values('dbs_coins_{number}',{number},0,{number}) on conflict do nothing;\n"
sql+="insert into drabornseries.dbs_google_play_products(id,kind,coins,active) values('dbs_vip_monthly','vip',0,false) on conflict do nothing;\n"
for genre in sorted(set(g for r in rows for g in r['genres'])):
 sql+=f"insert into drabornseries.dbs_genres(id,name) values({quote(genre)},{quote(genre)}) on conflict do nothing;\n"
for key,data in {'release':{'version':'0.4.0','versionCode':1,'stage':'expo_go_test'},'integrations':{'billing':False,'ads':False,'cloudflare':False,'push':False},'daily_rewards':[2,3,5,5,7,10,20]}.items():
 sql+=f"insert into drabornseries.dbs_app_settings values({quote(key)},{quote(json.dumps(data))}::jsonb,true) on conflict do nothing;\n"
sql+="insert into drabornseries.dbs_promo_codes(code,coins,max_uses,expires_at) values('DBS2026',30,10000,now()+interval '90 days') on conflict do nothing;\n"
for number,(name,desc) in enumerate([('İlk Bölüm','İlk bölümünü tamamla'),('Maratoncu','10 bölüm tamamla'),('Series Hunter','10 farklı dizi izle'),('Collector','20 diziyi listene ekle'),('7 Day Streak','7 gün günlük ödül al')]):
 sql+=f"insert into drabornseries.dbs_achievements(id,name,description) values('achievement-{number}',{quote(name)},{quote(desc)}) on conflict do nothing;\n"
sql+=Path('supabase/seed/vertical.sql').read_text()
Path('supabase/seed/catalog.sql').write_text(sql)
Path('packages/shared/catalog-fallback.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('Catalog prepared: 6 upcoming concepts, 4 vertical demo collections, 8 scenes')

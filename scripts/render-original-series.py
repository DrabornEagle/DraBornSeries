"""Original portrait animated micro-series. All artwork, stories and music are procedural.
No downloaded stock footage. Usage: python render-original-series.py OUTPUT [slug episode].
Requires Pillow, NumPy and ffmpeg. Videos are uploaded separately; never commit media binaries.
"""
import json, math, os, random, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DURATION = 540, 960, 24, 24
SERIES = {
    "neon-postasi": {
        "title": "Neon Postası", "accent": "#ff5aa8", "tagline": "Bir teslimat. Bir şehir. Yeniden yanan bir ışık.",
        "episodes": [
            ("Son Teslimat", ["Neon şehir uyurken, Zip'in son teslimatı geldi.", "Adres: yıllardır karanlık olan deniz feneri.", "Paketin içinden küçük bir ışık sızıyordu.", "ZIP: Seni eve götüreceğim.", "Uzakta bir sinyal belirdi. Yolculuk başladı.", "Devamı: Kayıp Sinyal"]),
            ("Kayıp Sinyal", ["Köprünün ortasında bütün işaretler kayboldu.", "Zip durdu. Paketin ışığı yolu gösteriyordu.", "Dalgaların üzerinde aynı ritim yanıp söndü.", "ZIP: Demek beni sen çağırdın.", "Fenerin koordinatları yeniden ekrana düştü.", "Devamı: Fırtınanın İçinden"]),
            ("Fırtınanın İçinden", ["Fırtına yolu kapattı. Zip'in pili azalıyordu.", "Bir yıldız kuşu yağmurun içinde mahsur kalmıştı.", "Zip küçük ışığını kuşla paylaştı.", "ZIP: Birlikte gidersek yol daha kısa.", "Kuş havalandı ve fenerin yolunu çizdi.", "Devamı: Işığın Sırrı"]),
            ("Işığın Sırrı", ["Fenerin kapısı, paketin ritmiyle açıldı.", "Zip içeri girdi. Şehir burada unutulmuştu.", "Paket bir pil değildi. Şehrin ilk anısıydı.", "ZIP: Bütün ışıklar bir yerden başlar.", "Küçük kuş anıyı fenerin kalbine taşıdı.", "Devamı: Yeni Bir Şafak"]),
            ("Yeni Bir Şafak", ["Zip ve kuş son ışığı yerine bıraktı.", "Deniz feneri yıllar sonra yeniden parladı.", "Şehirde birer birer bütün pencereler yandı.", "ZIP: Teslimat tamamlandı. Artık evdeyiz.", "Güneş doğarken iki dost yeni yola çıktı.", "NEON POSTASI · Sezon sonu"]),
        ],
    },
    "yildiz-tohumu": {
        "title": "Yıldız Tohumu", "accent": "#7ee9ca", "tagline": "Küçük bir tohum, karanlık bir gökyüzünü değiştirebilir.",
        "episodes": [
            ("Gökyüzünden Gelen Çağrı", ["Luna her gece gökyüzündeki yıldızları sayardı.", "Bir gece son yıldız da söndü.", "Tam o anda avucuna bir yıldız tohumu düştü.", "LUNA: Seni yeniden parlatacağım.", "Tohum, sessiz bir gezegene doğru yol gösterdi.", "Devamı: Karanlık Bahçe"]),
            ("Karanlık Bahçe", ["Luna, gölgelerin arasındaki bahçeye ulaştı.", "Bütün çiçekler uyuyordu. Tohum da sönüyordu.", "Luna onu saklamak yerine toprağa bıraktı.", "LUNA: Işık paylaşınca çoğalır.", "İlk filiz yükseldi. Gölgeler geri çekildi.", "Devamı: Birlikte Parlıyoruz"]),
            ("Birlikte Parlıyoruz", ["Filiz bir ağaca, ağaç bin yıldız çiçeğine dönüştü.", "Luna her çiçeği gökyüzüne gönderdi.", "Yıldızlar yeniden yandı. Gece renklerine kavuştu.", "LUNA: En küçük ışık bile bir başlangıçtır.", "Son tohum avucunda kaldı. Yeni bir dost için.", "YILDIZ TOHUMU · Sezon sonu"]),
        ],
    },
}

def font(size, bold=False):
    roots = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype"]
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for root in roots:
        for path in Path(root).rglob(name):
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()

FONTS = {s: font(s, s >= 28) for s in [15, 18, 20, 24, 28, 32, 38, 44]}
def text_lines(draw, text, width, size):
    lines, line = [], ""
    for word in text.split():
        candidate = (line + " " + word).strip()
        if draw.textlength(candidate, font=FONTS[size]) > width and line:
            lines.append(line); line = word
        else: line = candidate
    return lines + [line]

def caption(draw, text, y, size=24, color="#fff3fa"):
    lines = text_lines(draw, text, W - 78, size)
    height = len(lines) * (size + 10) + 28
    draw.rounded_rectangle((22, y-12, W-22, y+height), radius=20, fill=(7, 8, 24, 205), outline=(212, 148, 235, 50), width=1)
    for i, line in enumerate(lines):
        tw = draw.textlength(line, font=FONTS[size])
        draw.text(((W-tw)/2, y+8+i*(size+10)), line, font=FONTS[size], fill=color)

def background(slug, episode):
    night = slug == "neon-postasi"
    dawn = night and episode == 5
    top = np.array([25, 13, 51] if not dawn else [77, 45, 111])
    bottom = np.array([118, 33, 92] if night else [24, 109, 104])
    rows = top + (bottom-top) * np.linspace(0, 1, H)[:, None]
    pixels = np.tile(rows[:, None, :], (1, W, 1)).astype(np.uint8)
    im = Image.fromarray(pixels).convert("RGBA")
    d = ImageDraw.Draw(im)
    rng = random.Random(47 + episode)
    for _ in range(130):
        x, y, r = rng.randrange(W), rng.randrange(30, 600), rng.choice([1, 1, 2])
        d.ellipse((x-r, y-r, x+r, y+r), fill=(202, 225, 255, rng.randrange(90, 240)))
    # A sunset disc and stylized water. Portrait composition is authored at 9:16.
    d.ellipse((135, 242, 405, 512), fill=(255, 132 if dawn else 95, 134 if night else 210, 150))
    for y in range(262, 500, 23): d.rectangle((125, y, 414, y+6), fill=(50, 20, 73, 150))
    d.rectangle((0, 535, W, H), fill=(9, 15, 37, 255))
    for y in range(550, 830, 18):
        d.line((180-(y-550)*.42, y, 350+(y-550)*.35, y), fill=(191, 54, 138, 80), width=2)
    if night:
        for row, base in [(0, 500), (1, 555)]:
            x = -20
            while x < W:
                bw, bh = rng.randrange(25, 65), rng.randrange(45, 165)
                d.rectangle((x, base-bh, x+bw, base), fill=(14+row*8, 15, 36+row*9))
                for wx in range(x+6, x+bw-4, 10):
                    for wy in range(base-bh+12, base-8, 17):
                        if rng.random() > .48: d.rectangle((wx, wy, wx+3, wy+6), fill=(237, 114, 166, 170))
                d.line((x, base-bh, x+bw, base-bh), fill=(114, 53, 146, 200), width=2)
                x += bw + 4
        # A distant lighthouse links every episode of the same story.
        d.polygon([(410, 350), (435, 350), (445, 553), (395, 553)], fill="#353054")
        d.rounded_rectangle((399, 326, 447, 358), radius=7, fill="#60516c", outline="#ee9ac9", width=2)
        d.polygon([(396, 326), (425, 298), (450, 326)], fill="#ed84ae")
    else:
        d.ellipse((-180, 572, 700, 1390), fill="#132d40", outline="#53b6a3", width=3)
        for x in range(-60, W+40, 75):
            d.arc((x, 597, x+180, 860), 175, 335, fill="#2e6270", width=2)
    return im

def robot(d, x, y, t, slug, episode):
    # Zip and Luna have distinct silhouettes, recurring costume and expression.
    luna = slug == "yildiz-tohumu"
    bob = math.sin(t*3.1)*7
    y += bob
    body = "#a989ce" if luna else "#eaacbf"
    edge = "#d6f7e4" if luna else "#ffdeed"
    d.ellipse((x-59, y+115, x+59, y+139), fill=(0, 0, 0, 110))
    if luna:
        d.polygon([(x-49,y-44),(x-68,y-107),(x-8,y-73)],fill=body,outline=edge,width=2)
        d.polygon([(x+49,y-44),(x+68,y-107),(x+8,y-73)],fill=body,outline=edge,width=2)
    else:
        d.line((x,y-67,x,y-102),fill=edge,width=4)
        d.ellipse((x-8,y-111,x+8,y-95),fill="#77f2d7")
    d.rounded_rectangle((x-43, y+10, x+43, y+92), radius=24, fill=body, outline=edge, width=3)
    # Arms sway, feet step; this is animated artwork rather than a still slideshow.
    a = math.sin(t*5)*9
    d.line((x-42,y+35,x-65,y+69+a),fill=body,width=18)
    d.line((x+42,y+35,x+66,y+60-a),fill=body,width=18)
    d.line((x-20,y+83,x-24-a,y+117),fill=body,width=18)
    d.line((x+20,y+83,x+24+a,y+117),fill=body,width=18)
    d.rounded_rectangle((x-58,y-68,x+58,y+20),radius=30,fill=body,outline=edge,width=3)
    d.rounded_rectangle((x-45,y-48,x+45,y+1),radius=19,fill="#211d37",outline="#633f75",width=2)
    blink = t % 5.1 > 4.9
    for ex in [x-20,x+20]:
        d.rounded_rectangle((ex-7,y-32,ex+7,y-29 if blink else y-16),radius=5,fill="#7ee9ca")
    d.arc((x-10,y-20,x+10,y-5),0,180,fill="#ffd4e9",width=2)
    d.rounded_rectangle((x-18,y+30,x+18,y+70),radius=9,fill="#3d2b50",outline="#efacd8",width=2)
    pulse = 7+2*math.sin(t*4)
    d.ellipse((x-pulse,y+49-pulse,x+pulse,y+49+pulse),fill="#80f0cf" if luna else "#ffc68a")

def frame(slug, episode, t, base):
    im = base.copy(); d = ImageDraw.Draw(im)
    show = SERIES[slug]; night = slug == "neon-postasi"
    phase = t / DURATION
    # Slow cinematic movement across a complete small story arc.
    x = 190 + 85*math.sin(phase*math.pi*1.25-.6)
    y = 613 if night else 645
    glow = Image.new("RGBA", (W,H)); gd = ImageDraw.Draw(glow)
    orb_x = x+83+16*math.sin(t*1.3); orb_y = y-50+20*math.cos(t*1.2)
    if (night and episode >= 3) or not night:
        gd.ellipse((orb_x-40,orb_y-40,orb_x+40,orb_y+40),fill=(80,240,211,150))
        im = Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(19))); d = ImageDraw.Draw(im)
        d.ellipse((orb_x-12,orb_y-12,orb_x+12,orb_y+12),fill="#c9ffe7")
        if night:
            d.polygon([(orb_x-6,orb_y),(orb_x-26,orb_y-12*math.sin(t*7)),(orb_x-11,orb_y+5)],fill="#8bdddd")
            d.polygon([(orb_x+6,orb_y),(orb_x+26,orb_y-12*math.sin(t*7)),(orb_x+11,orb_y+5)],fill="#8bdddd")
    robot(d,x,y,t,slug,episode)
    if night and episode == 3:
        for i in range(48):
            rx=(i*73-t*60)%W; ry=(i*117+t*240)%H
            d.line((rx,ry,rx-5,ry+17),fill=(125,185,230,100),width=1)
    if night and episode >= 4:
        beam = int(105+70*math.sin(t*.7))
        overlay=Image.new("RGBA",(W,H)); od=ImageDraw.Draw(overlay)
        od.polygon([(423,341),(0,beam),(0,beam+185)],fill=(255,214,169,30+int(25*phase)))
        im=Image.alpha_composite(im,overlay);d=ImageDraw.Draw(im)
    if not night and episode >= 2:
        grow = min(1,phase*1.7) if episode==2 else 1
        for i in range(7):
            bx=55+i*69; by=687+int(30*math.sin(i))
            d.line((bx,by,bx,by-92*grow),fill="#75cba8",width=5)
            for side in [-1,1]:
                d.ellipse((bx+(12*side)-15,by-50*grow,bx+(12*side)+15,by-50*grow+18),fill="#42988d")
            d.ellipse((bx-10,by-92*grow-10,bx+10,by-92*grow+10),fill="#c2efd2")
        if episode==3:
            for i in range(25):
                sx=(i*107+t*12)%W;sy=(i*113-t*35)%570
                d.ellipse((sx-3,sy-3,sx+3,sy+3),fill="#c9ffe7")
    # Typography and integrated Turkish dialogue stay within portrait safe areas.
    d.rounded_rectangle((22,25,247,58),radius=10,fill="#16102acf")
    d.text((33,33),"DRABORNSERIES ORIGINAL",font=FONTS[15],fill="#ffb5da")
    d.text((25,84),show["title"],font=FONTS[44],fill="#fff5f9")
    d.text((27,142),f"BÖLÜM {episode:02d} / {len(show['episodes']):02d}",font=FONTS[18],fill="#9cf3d5")
    d.text((27,176),show["episodes"][episode-1][0],font=FONTS[24],fill="#eee2f7")
    line=show["episodes"][episode-1][1][min(5,int(t/4))]
    caption(d,line,805)
    d.rounded_rectangle((24,939,W-24,943),radius=2,fill="#5f465d")
    d.rounded_rectangle((24,939,24+(W-48)*phase,943),radius=2,fill=show["accent"])
    return im.convert("RGB")

def soundtrack(path, episode, star=False):
    rate=44100;t=np.arange(rate*DURATION)/rate
    signal=np.zeros_like(t)
    chords=[[146.83,174.61,220],[130.81,164.81,196],[110,130.81,164.81],[130.81,146.83,196]]
    for beat in range(DURATION//3):
        start=beat*3;mask=(t>=start)&(t<start+3);local=t[mask]-start
        env=np.minimum(1,local/.6)*np.minimum(1,(3-local)/.8)
        for frequency in chords[(beat+episode)%4]:
            signal[mask]+=.06*env*(np.sin(2*np.pi*frequency*local)+.25*np.sin(2*np.pi*frequency*2*local))
        signal[mask]+=.035*np.sin(2*np.pi*(660 if star else 440)*local)*np.exp(-local*2)
    signal*=np.minimum(1,t)*np.minimum(1,(DURATION-t)/2)
    with wave.open(str(path),'w') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
        w.writeframes((np.clip(signal,-1,1)*32767).astype(np.int16).tobytes())

def render(out, slug, episode):
    base=background(slug,episode);stem=f"{slug}-{episode:02d}"
    music=out/(stem+'.wav');video=out/(stem+'.mp4')
    soundtrack(music,episode,slug=='yildiz-tohumu')
    frame(slug,episode,9,base).save(out/(stem+'.jpg'),quality=92)
    command=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(music),'-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-shortest',str(video)]
    process=subprocess.Popen(command,stdin=subprocess.PIPE)
    for number in range(FPS*DURATION): process.stdin.write(frame(slug,episode,number/FPS,base).tobytes())
    process.stdin.close()
    if process.wait()!=0:raise RuntimeError('ffmpeg failed')
    music.unlink();print(json.dumps({'file':str(video),'width':W,'height':H,'duration':DURATION,'bytes':video.stat().st_size}),flush=True)

if __name__=='__main__':
    out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
    for slug, show in SERIES.items():
        for episode in range(1,len(show['episodes'])+1):
            if len(sys.argv)>2 and (slug!=sys.argv[2] or episode!=int(sys.argv[3])):continue
            render(out,slug,episode)

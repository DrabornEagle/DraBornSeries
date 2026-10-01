import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../packages/api/client";
import { Button, Empty, Loading, colors, styles } from "../../packages/ui/theme";
type Metrics = {
  users: number; vip_users: number; dau: number; wau: number; mau: number;
  daily: number; weekly: number; monthly: number; average_seconds: number | null;
  completion_pct: number | null; coin_earned: number; coin_spent: number;
  coin_buyers: number; ad_unlocks: number; all_unlocks: number;
  top_series: { title: string; viewers: number }[];
  top_episodes: { series: string; title: string; viewers: number }[];
  abandoned: { series: string; title: string; viewers: number }[];
};
const percent = (part: number, all: number) => all ? Math.round(part / all * 1000) / 10 + "%" : "Veri yok";
function Metric({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return <View style={[styles.card, { width: "47%", minWidth: 155, flexGrow: 1, padding: 17, borderColor: "#5b3558" }]}>
    <Text style={styles.body}>{title}</Text>
    <Text style={{ color: colors.text, fontSize: 27, fontWeight: "900" }}>{value}</Text>
    {!!hint && <Text style={[styles.body, { fontSize: 11 }]}>{hint}</Text>}
  </View>;
}
function Ranking({ title, rows }: { title: string; rows: { title: string; series?: string; viewers: number }[] }) {
  return <View style={[styles.card, { flex: 1, minWidth: 235 }]}>
    <Text style={styles.h3}>{title}</Text>
    {rows.length ? rows.map((row, i) => <View key={row.series + row.title + i}
      style={[styles.row, { justifyContent: "space-between", borderTopWidth: 1, borderColor: colors.line, paddingTop: 10 }]}>
      <Text style={[styles.body, { flex: 1 }]}>{i + 1}. {row.series ? row.series + " · " : ""}{row.title}</Text>
      <Text style={{ color: colors.pink, fontWeight: "800" }}>{row.viewers}</Text>
    </View>) : <Text style={styles.body}>Henüz izleme ilerlemesi yok.</Text>}
  </View>;
}
export default function StudioMetrics({ run }: { run: (fn: () => Promise<unknown>, success?: string) => Promise<void> }) {
  const [data, setData] = useState<Metrics | null>(null);
  const load = async () => {
    const result = await api<{ metrics: Metrics }>("admin-metrics");
    setData(result.metrics);
  };
  useEffect(() => { run(load); }, [run]);
  if (!data) return <Loading />;
  return <View style={{ gap: 18 }}>
    <View style={[styles.row, { justifyContent: "space-between" }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h2}>İçerik istatistikleri</Text>
        <Text style={styles.body}>Canlı hesap ve izleme ilerlemesi kayıtlarına göre.</Text>
      </View>
      <Button small secondary icon="refresh" onPress={() => run(load)}>Yenile</Button>
    </View>
    <View style={styles.wrap}>
      <Metric title="Günlük aktif kullanıcı" value={data.dau} hint="Son 24 saat" />
      <Metric title="Haftalık aktif kullanıcı" value={data.wau} hint="Son 7 gün" />
      <Metric title="Aylık aktif kullanıcı" value={data.mau} hint="Son 30 gün" />
      <Metric title="Toplam hesap" value={data.users} />
      <Metric title="Günlük izleme" value={data.daily} hint="Son ilerleme kaydı; toplam oynatma sayısı değil" />
      <Metric title="Haftalık izleme" value={data.weekly} hint="Son ilerleme kaydı" />
      <Metric title="Aylık izleme" value={data.monthly} hint="Son ilerleme kaydı" />
      <Metric title="Ort. son izleme konumu" value={data.average_seconds == null ? "Veri yok" : Math.round(Number(data.average_seconds) / 60) + " dk"} hint="Kullanıcı-bölüm başına; toplam izleme süresi değil" />
      <Metric title="Bölüm tamamlama" value={data.completion_pct == null ? "Veri yok" : data.completion_pct + "%"} />
      <Metric title="VIP dönüşüm" value={percent(data.vip_users, data.users)} hint={data.vip_users + " etkin VIP"} />
      <Metric title="BornCoins alıcı oranı" value={percent(data.coin_buyers, data.users)} hint="Doğrulanmış satın alma" />
      <Metric title="BornCoins harcama oranı" value={percent(data.coin_spent, data.coin_earned)} hint={data.coin_spent + " harcanan / " + data.coin_earned + " kazanılan"} />
      <Metric title="Reklam → bölüm açma" value={percent(data.ad_unlocks, data.all_unlocks)} hint={data.ad_unlocks + " reklam kilidi / " + data.all_unlocks + " açma"} />
    </View>
    <View style={styles.wrap}>
      <Ranking title="En çok izlenen diziler" rows={data.top_series || []} />
      <Ranking title="En çok izlenen bölümler" rows={data.top_episodes || []} />
      <Ranking title="En çok tamamlanmamış bölümler" rows={data.abandoned || []} />
    </View>
    <Empty title="Henüz ölçülemeyen metrikler"
      detail="Retention ve en yüksek gerçek gelirli dizi için oturum/oynatma olay geçmişi ile Google Play'den doğrulanmış fiyat ve bölüm atfı gerekiyor. Henüz rakam üretilmiyor."
      icon="analytics-outline" />
    <Text style={[styles.body, { fontSize: 12 }]}>
      İzleme sayıları tekil kullanıcı-bölüm ilerleme kayıtlarıdır; aynı bölümü tekrar oynatma ayrı olay olarak sayılmaz. Günlük, haftalık ve aylık aktif kullanıcı sayıları, son cihaz oturumu veya izleme güncellemesine göre hesaplanır.
    </Text>
  </View>;
}

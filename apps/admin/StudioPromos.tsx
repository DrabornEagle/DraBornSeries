import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../packages/api/client";
import { Button, Chip, Empty, Field, Icon, Loading, colors, styles } from "../../packages/ui/theme";

type Promo = { id?: string; code: string; coins: number; vip_days: number; max_uses: number; uses: number; expires_at: string; active: boolean };
const blank = (): Promo => ({ code: "", coins: 0, vip_days: 0, max_uses: 100, uses: 0, expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), active: true });
const reward = (row: Promo) => [row.coins > 0 ? row.coins + " BornCoins" : "", row.vip_days > 0 ? row.vip_days + " gün VIP" : ""].filter(Boolean).join(" + ");
export default function StudioPromos({ role, run }: {
  role: string; run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<Promo[]>([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Promo | null>(null), [coinsOn, setCoinsOn] = useState(true), [vipOn, setVipOn] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [query, setQuery] = useState(""), [saving, setSaving] = useState(false);
  const editable = role === "owner" || role === "editor";
  const load = useCallback(async (offset = 0) => {
    setLoading(true); setClock(Date.now());
    try {
      const result = await api<{ rows: Promo[]; total: number }>("admin-list", { table: "dbs_promo_codes", search: query, limit: 25, offset });
      setRows((old) => offset ? [...old, ...result.rows] : result.rows); setTotal(result.total);
    } finally { setLoading(false); }
  }, [query]);
  useEffect(() => { const timer = setTimeout(() => void run(() => load()), 250); return () => clearTimeout(timer); }, [load, run]);
  const open = (row: Promo) => { setForm({ ...row }); setCoinsOn(!row.id || row.coins > 0); setVipOn(row.vip_days > 0); };
  const update = (key: keyof Promo, value: string | boolean | number) => setForm((old) => old ? { ...old, [key]: value } : old);
  const save = () => run(async () => {
    if (!form || saving) return;
    setSaving(true);
    try {
      await api("admin-save", { table: "dbs_promo_codes", row: { ...form, code: form.code.trim().toUpperCase(),
        coins: coinsOn ? Number(form.coins) : 0, vip_days: vipOn ? Number(form.vip_days) : 0, max_uses: Number(form.max_uses) } });
      setForm(null); await load();
    } finally { setSaving(false); }
  }, "Promosyon kodu kaydedildi.");
  return <View style={{ gap: 18 }}>
    <LinearGradient colors={["#49304d", "#222038", "#181624"]} style={[styles.card, { gap: 15 }]}>
      <Icon name="gift-outline" color={colors.mint} size={34} />
      <Text style={styles.h2}>İzleyicilerine bir hediye ver.</Text>
      <Text style={styles.body}>Bir kod oluştur; BornCoins miktarını, VIP gününü veya ikisini birlikte belirle. Kodu kullanan kişinin ödülleri hesabına otomatik eklenir.</Text>
      <Text style={{ color: colors.mint }}>Her kod, her kullanıcı için bir kez kullanılabilir.</Text>
    </LinearGradient>
    {!form ? <>
      <Field value={query} onChangeText={setQuery} placeholder="Promosyon kodlarında ara…" autoCapitalize="characters" />
      <View style={styles.wrap}><Button secondary small icon="refresh" disabled={loading} onPress={() => run(() => load())}>Yenile</Button>
        {editable && <Button small icon="add" onPress={() => open(blank())}>Yeni promosyon kodu</Button>}</View>
      <Text style={styles.body}>{rows.length} / {total} kod</Text>
      {loading && !rows.length ? <Loading /> : rows.map((row) => <Pressable key={row.id} accessibilityRole="button"
        onPress={() => open(row)} style={[styles.card, { gap: 9, borderColor: row.active ? "#82539b" : colors.line }]}>
        <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={styles.h3}>{row.code}</Text>
          <Chip label={!row.active ? "Kapalı" : new Date(row.expires_at).getTime() <= clock ? "Süresi doldu" : row.uses >= row.max_uses ? "Limit doldu" : "Aktif"} active={row.active} /></View>
        <Text style={{ color: colors.mint, fontSize: 17, fontWeight: "700" }}>{reward(row)}</Text>
        <Text style={styles.body}>{row.uses} / {row.max_uses} kullanım · Son tarih {new Date(row.expires_at).toLocaleString("tr-TR")}</Text>
      </Pressable>)}
      {!loading && !rows.length && <Empty title="Promosyon kodu bulunamadı" detail="Yeni bir kod oluşturabilir veya aramanı değiştirebilirsin." icon="gift-outline" />}
      {rows.length < total && <Button secondary disabled={loading} onPress={() => run(() => load(rows.length))}>Daha fazla kod</Button>}
    </> : <View style={styles.card}>
      <Text style={styles.h2}>{form.id ? "Promosyonu düzenle" : "Yeni promosyon kodu"}</Text>
      <Field label="Promosyon kodu" placeholder="Örn. HIKAYE2026" value={form.code} onChangeText={(value) => update("code", value)} autoCapitalize="characters" editable={editable && !form.uses} />
      <Text style={styles.label}>Kodun ödülleri</Text>
      <View style={styles.wrap}><Chip label="BornCoins" active={coinsOn} onPress={editable && !form.uses ? () => setCoinsOn(!coinsOn) : undefined} />
        <Chip label="VIP süresi" active={vipOn} onPress={editable && !form.uses ? () => setVipOn(!vipOn) : undefined} /></View>
      {coinsOn && <Field label="BornCoins miktarı" value={String(form.coins)} onChangeText={(value) => update("coins", value)} keyboardType="number-pad" editable={editable && !form.uses} />}
      {vipOn && <Field label="VIP süresi · gün" value={String(form.vip_days)} onChangeText={(value) => update("vip_days", value)} keyboardType="number-pad" editable={editable && !form.uses} />}
      <Text style={styles.body}>VIP günleri mevcut geçerli VIP süresinin sonuna eklenir. Kod, ücretli abonelik veya otomatik yenileme başlatmaz.</Text>
      <Field label="Toplam kullanım sınırı" value={String(form.max_uses)} onChangeText={(value) => update("max_uses", value)} keyboardType="number-pad" editable={editable} />
      <Field label="Son kullanım tarihi" value={form.expires_at} onChangeText={(value) => update("expires_at", value)} placeholder="2026-12-31T23:59:00+03:00" autoCapitalize="none" editable={editable} />
      <Text style={styles.body}>Tarih örneği: 2026-12-31T23:59:00+03:00 · Türkiye saati</Text>
      <View style={styles.wrap}><Chip label="Aktif" active={form.active} onPress={editable ? () => update("active", true) : undefined} />
        <Chip label="Kapalı" active={!form.active} onPress={editable ? () => update("active", false) : undefined} /></View>
      {form.uses > 0 && <Text style={styles.body}>Bu kod kullanıldığı için adı ve ödülleri korunur. Farklı bir ödül için yeni kod oluşturabilirsin.</Text>}
      {editable && <Button icon="save-outline" disabled={saving || (!coinsOn && !vipOn)} onPress={save}>{saving ? "Kaydediliyor…" : "Promosyon kodunu kaydet"}</Button>}
      <Button secondary onPress={() => setForm(null)}>Listeye dön</Button>
    </View>}
  </View>;
}

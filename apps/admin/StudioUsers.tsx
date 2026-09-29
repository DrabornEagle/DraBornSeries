import React, { useCallback, useEffect, useState } from "react";
import { Image, Text, View, Pressable } from "react-native";
import { api } from "../../packages/api/client";
import { Button, Chip, Empty, Field, Loading, Icon, colors, styles } from "../../packages/ui/theme";
import { statusLabel } from "./StudioForms";

type UserRow = {
  user_id: string; username: string; full_name?: string; avatar_url?: string;
  status: string; balance: number; vip_until?: string | null; created_at: string;
};
type Detail = {
  profile: UserRow; email?: string; wallet?: { balance: number };
  vip: any[]; transactions: any[]; purchases: any[]; unlocks: any[]; reports: any[];
};
const date = (value?: string | null) => value ? new Date(value).toLocaleString("tr-TR") : "Yok";
function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Idempotency label only; not an authentication secret. Also works in Expo Go.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (mark) => {
    const number = Math.floor(Math.random() * 16);
    return (mark === "x" ? number : (number & 3) | 8).toString(16);
  });
}
export default function StudioUsers({ role, run }: {
  role: string; run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [section, setSection] = useState("transactions");
  const [pending, setPending] = useState<string | null>(null);
  const [coins, setCoins] = useState("");
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ rows: UserRow[]; total: number }>("admin-users", { search: applied, page });
      setRows(result.rows); setTotal(result.total);
    } finally { setLoading(false); }
  }, [applied, page]);
  useEffect(() => { run(load); }, [load, run]);
  const open = async (id: string) => {
    setSelected(await api<Detail>("admin-user", { user_id: id }));
    setPending(null); setCoins(""); setReason(""); setSection("transactions");
  };
  const refresh = async (id: string) => { await open(id); await load(); };
  const owner = role === "owner";
  const history = selected ? (selected as any)[section] as any[] : [];
  return <View style={{ gap: 18 }}>
    <View style={{ gap: 5 }}>
      <Text style={styles.h2}>Kullanıcı yönetimi</Text>
      <Text style={styles.body}>Kişiyi bul, hesabını aç ve tüm işlemleri aynı ekranda incele. Yetki gerektiren değişiklikler kayda alınır.</Text>
    </View>
    {!selected && <><View style={styles.wrap}>
      <View style={{ flex: 1, minWidth: 190 }}>
        <Field label="Kullanıcı ara" placeholder="Kullanıcı adı, ad veya UUID" value={search} onChangeText={setSearch} onSubmitEditing={() => { setPage(0); setApplied(search.trim()); }} />
      </View>
      <Button icon="search" onPress={() => { setPage(0); setApplied(search.trim()); }}>Ara</Button>
      <Button secondary icon="refresh" onPress={() => run(load)}>Yenile</Button>
    </View>
    {loading ? <Loading /> : <Text style={styles.body}>{total} hesap · Sayfa {page + 1} · Sayfada 25 kullanıcı</Text>}
    <View style={{ gap: 9 }}>{rows.map((user) => <Pressable key={user.user_id} accessibilityRole="button"
      accessibilityLabel={user.username + " kullanıcısını aç"}
      onPress={() => run(() => open(user.user_id))}
      style={[styles.card, { padding: 17, borderColor: colors.line }]}>
      <View style={[styles.row, { alignItems: "center" }]}>
        {user.avatar_url ? <Image source={{ uri: user.avatar_url }} style={{ width: 43, height: 43, borderRadius: 15 }} />
          : <View style={{ width: 43, height: 43, borderRadius: 15, backgroundColor: "#432141", alignItems: "center", justifyContent: "center" }}>
            <Icon name="person" color={colors.pink} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.h3}>{user.full_name || user.username}</Text>
          <Text style={styles.body}>@{user.username} · {statusLabel(user.status)}</Text>
        </View>
        <Icon name="chevron-forward" color={colors.purple} />
      </View>
      <View style={styles.wrap}>
        <Chip label={String(user.balance) + " BornCoins"} />
        <Chip label={user.vip_until ? "VIP · " + date(user.vip_until) : "Standart"} color={user.vip_until ? colors.orange : colors.muted} />
      </View>
    </Pressable>)}</View>
    {!loading && rows.length === 0 && <Empty title="Kullanıcı bulunamadı" detail="Aramayı değiştir veya son kayıtları yenile." icon="people-outline" />}
    <View style={styles.wrap}>
      {page > 0 && <Button secondary onPress={() => setPage(page - 1)}>Önceki 25</Button>}
      {(page + 1) * 25 < total && <Button secondary onPress={() => setPage(page + 1)}>Sonraki 25</Button>}
    </View></>}
    {selected && <View style={[styles.card, { borderColor: "#804376", gap: 19 }]}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>HESAP DETAYI</Text>
          <Text style={styles.h2}>{selected.profile.full_name || selected.profile.username}</Text>
          <Text style={styles.body}>{selected.email || "E-posta görünmüyor"} · Katılım: {date(selected.profile.created_at)}</Text>
        </View>
        <Button secondary small onPress={() => setSelected(null)}>Kapat</Button>
      </View>
      <View style={styles.wrap}>
        <Chip label={"Durum: " + statusLabel(selected.profile.status)} active />
        <Chip label={"BornCoins: " + (selected.wallet?.balance || 0)} />
        <Chip label={selected.vip.some((v) => ["active", "grace"].includes(v.status) && new Date(v.expires_at) > new Date())
          ? "VIP bitiş: " + date(selected.vip[0]?.expires_at) : "VIP yok"} />
      </View>
      {owner && <View style={{ gap: 11, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line }}>
        <Text style={styles.h3}>Hesap erişimi</Text>
        <Text style={styles.body}>Askıya alma ve engelleme oturumu kontrol eden sunucu kurallarıyla uygulanır.</Text>
        <View style={styles.wrap}>{[["active", "Aktifleştir"], ["suspended", "Askıya al"], ["blocked", "Engelle"]].map(([value, label]) =>
          <Chip key={value} label={label} active={selected.profile.status === value}
            onPress={() => setPending(value === selected.profile.status ? null : value)} />)}</View>
        {pending && <View style={{ gap: 10 }}>
          <Text style={{ color: colors.orange }}>Bu hesabın durumu “{statusLabel(pending)}” olacak. İşlem yönetici kaydına yazılır.</Text>
          <View style={styles.wrap}>
            <Button icon="checkmark" onPress={() => run(async () => {
              await api("admin-save", { table: "dbs_profiles", row: { user_id: selected.profile.user_id, status: pending } });
              await refresh(selected.profile.user_id);
            }, "Kullanıcı durumu güncellendi.")}>Durumu onayla</Button>
            <Button secondary onPress={() => setPending(null)}>Vazgeç</Button>
          </View>
        </View>}
      </View>}
      {owner && <View style={{ gap: 11, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line }}>
        <Text style={styles.h3}>Hesaba hak tanımla</Text>
        <Field label="İşlem gerekçesi" placeholder="Örnek: destek telafisi" value={reason} onChangeText={setReason} />
        <Field label="BornCoins miktarı" value={coins} onChangeText={setCoins} keyboardType="numeric" placeholder="1–100.000" />
        <Button icon="logo-bitcoin" onPress={() => run(async () => {
          if (!Number.isInteger(Number(coins)) || Number(coins) < 1 || reason.trim().length < 5) throw Error("Miktar ve en az 5 karakterlik gerekçe gir.");
          await api("admin-grant", { user_id: selected.profile.user_id, coins: Number(coins), reason: reason.trim(), request_id: requestId() });
          await refresh(selected.profile.user_id); setCoins(""); setReason("");
        }, "BornCoins tanımlandı ve deftere işlendi.")}>BornCoins tanımla</Button>
        <Text style={styles.label}>VIP süresi</Text>
        <View style={styles.wrap}>{[[7, "7 gün"], [30, "30 gün"], [365, "365 gün"]].map(([value, label]) =>
          <Chip key={value} label={String(label)} active={days === value} onPress={() => setDays(Number(value))} />)}</View>
        <Button secondary icon="diamond" onPress={() => run(async () => {
          if (reason.trim().length < 5) throw Error("VIP tanımı için en az 5 karakterlik gerekçe gir.");
          await api("admin-vip-grant", { user_id: selected.profile.user_id, days, reason: reason.trim(), request_id: requestId() });
          await refresh(selected.profile.user_id); setReason("");
        }, "VIP hakkı tanımlandı ve işlem kaydedildi.")}>VIP tanımla</Button>
      </View>}
      <View style={{ gap: 12, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line }}>
        <Text style={styles.h3}>Hesap geçmişi</Text>
        <View style={styles.wrap}>{[
          ["transactions", "Coin hareketleri"], ["purchases", "Satın almalar"],
          ["unlocks", "Açılan bölümler"], ["vip", "VIP geçmişi"], ["reports", "Raporlar"],
        ].map(([key, title]) => <Chip key={key} label={title} active={section === key} onPress={() => setSection(key)} />)}</View>
        {history.length === 0 ? <Text style={styles.body}>Bu alanda kayıt yok.</Text> : history.map((row, index) =>
          <View key={row.id || index} style={{ borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 10, gap: 3 }}>
            <Text style={styles.label}>{section === "transactions" ? (Number(row.amount) > 0 ? "+" : "") + row.amount + " BornCoins · " + row.kind
              : section === "purchases" ? row.product_id + " · " + row.status
              : section === "unlocks" ? "Bölüm açıldı · " + row.source
              : section === "vip" ? row.product_id + " · " + statusLabel(row.status)
              : row.kind + " · " + row.status}</Text>
            <Text style={styles.body}>{row.description || row.body || (section === "vip" ? "Bitiş: " + date(row.expires_at) : "")}</Text>
            <Text style={[styles.body, { fontSize: 11 }]}>{date(row.created_at || row.starts_at)}</Text>
          </View>)}
        {history.length >= 30 && <Text style={styles.body}>Son 30 kayıt gösteriliyor.</Text>}
      </View>
    </View>}
  </View>;
}

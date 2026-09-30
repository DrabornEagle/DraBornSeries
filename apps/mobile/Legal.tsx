import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { api, db } from "../../packages/api/client";
import type { Store } from "../../packages/api/store";
import type { Page } from "../../packages/types";
import { legalDocuments, legalContact, deletionMailto, type LegalPage } from "../../packages/shared/legal";
import { Button, Field, Icon, styles, colors } from "../../packages/ui/theme";
export default function Legal({ page, store, go, run }: {
  page: LegalPage; store: Store; go: (page: Page) => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const document = legalDocuments[page];
  return <View style={{ gap: 20, maxWidth: 960 }}>
    <LinearGradient colors={["#302044", "#16131f"]} style={[styles.card, { borderColor: "#a58aff50", padding: 26 }]}>
      <Icon name={page === "delete-account" ? "person-remove-outline" : "shield-checkmark-outline"} color={colors.mint} size={32} />
      <Text style={styles.eyebrow}>DRABORNSERIES · DRABORNEAGLE</Text>
      <Text style={styles.h1}>{document.title}</Text>
      <Text style={styles.body}>{document.intro}</Text>
      <Text style={[styles.body, { fontSize: 12 }]}>Güncelleme: {legalContact.updated}</Text>
    </LinearGradient>
    {page === "delete-account" && <View style={[styles.card, { borderColor: "#f143a150" }]}>
      <Text style={styles.h3}>{store.session ? "Hesabını buradan silebilirsin" : "Silme talebini e-posta ile ilet"}</Text>
      {store.session && <>
        <Text style={styles.body}>{store.session.user.email} · DraBornSeries verileri kalıcı olarak temizlenecek.</Text>
        <Field label="Onaylamak için SİL yaz" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" />
        <Button disabled={confirmation.trim().toLocaleUpperCase("tr-TR") !== "SİL" || deleting} icon="trash-outline" onPress={() => {
          setDeleting(true);
          void run(async () => {
            try {
              const userId = store.session!.user.id;
              await api("delete-account", { confirm: "DELETE" });
              await AsyncStorage.multiRemove([`dbs-progress-${userId}`, "dbs-pending-profile-photo"]);
              await db.auth.signOut({ scope: "local" });
              go("home");
            } finally { setDeleting(false); }
          }, "DraBornSeries hesabın silindi.");
        }}>{deleting ? "Siliniyor…" : "Hesabı kalıcı sil"}</Button>
      </>}
      <Button secondary icon="mail-outline" onPress={() => { void Linking.openURL(deletionMailto()); }}>E-posta ile silme talebi</Button>
      <Text selectable style={styles.body}>{legalContact.email}</Text>
    </View>}
    {document.sections.map((section) => <View key={section.title} style={styles.card}>
      <Text style={styles.h3}>{section.title}</Text>
      {section.paragraphs.map((paragraph) => <Text selectable key={paragraph} style={[styles.body, { color: "#ccc2d4" }]}>{paragraph}</Text>)}
    </View>)}
    <View style={styles.wrap}>
      {(["privacy", "terms", "delete-account"] as const).filter((target) => target !== page).map((target) =>
        <Button secondary small key={target} onPress={() => go(target)}>{legalDocuments[target].title}</Button>)}
      <Button secondary small icon="mail-outline" onPress={() => { void Linking.openURL(`mailto:${legalContact.email}?subject=DraBornSeries`); }}>Destek</Button>
    </View>
  </View>;
}

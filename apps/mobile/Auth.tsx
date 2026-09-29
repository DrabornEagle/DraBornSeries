import React, { useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { db, deviceId, rpc, requireData } from "../../packages/api/client";
import { config } from "../../packages/shared/config";
import { Button, Field, colors, styles } from "../../packages/ui/theme";
import type { Store } from "../../packages/api/store";
import ProfilePhotoPicker from "../../packages/ui/ProfilePhotoPicker";
import { pickProfilePhoto, stageProfilePhoto, type ProfilePhoto } from "../../packages/api/avatar";
import { translations } from "../../packages/shared/i18n";
WebBrowser.maybeCompleteAuthSession();
export default function Auth({
  store,
  run,
}: {
  store: Store;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
      Platform.OS === "web" &&
        typeof window !== "undefined" &&
        window.location.search.includes("reset")
        ? "reset"
        : "login",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [username, setUsername] = useState(""),
    [photo, setPhoto] = useState<ProfilePhoto | null>(null);
  const t = translations(store.language);
  async function submit() {
    if (mode === "reset") {
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      setMode("login");
      return;
    }
    if (!email.includes("@")) throw Error("Geçerli bir e-posta adresi yaz.");
    if (mode !== "forgot" && password.length < 8)
      throw Error("Şifren en az 8 karakter olmalı.");
    if (mode === "forgot") {
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: config.webUrl + "?reset=1",
      });
      if (error) throw error;
      return;
    }
    if (mode === "register") {
      await stageProfilePhoto(email, photo);
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: config.webUrl },
      });
      if (error) throw error;
      if (data.session && username.trim()) {
        await rpc("dbs_bootstrap", {
          device: await deviceId(),
          label: Platform.OS,
          platform: Platform.OS,
        });
        await requireData(
          db
            .from("dbs_profiles")
            .update({ username: username.trim() })
            .eq("user_id", data.session.user.id),
        );
      }
      return;
    }
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async function google() {
    const settings = await fetch(config.supabaseUrl + "/auth/v1/settings", {
      headers: { apikey: config.publishableKey },
    }).then((r) => r.json());
    if (!settings.external?.google)
      throw Error(
        "Google ile giriş sağlayıcısı henüz etkinleştirilmedi. E-posta ile giriş yapabilirsin.",
      );
    const redirectTo =
      Platform.OS === "web" ? config.webUrl : Linking.createURL("/");
    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web" },
    });
    if (error) throw error;
    if (Platform.OS !== "web" && data.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type === "success") {
        const code = new URL(result.url).searchParams.get("code");
        if (code) {
          const { error: exchangeError } =
            await db.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
      }
    }
  }
  return (
    <View style={{ alignItems: "center", paddingVertical: 25 }}>
      <View
        style={[
          styles.card,
          {
            maxWidth: 480,
            width: "100%",
            padding: 24,
            gap: 23,
            backgroundColor: "#160f20",
            borderRadius: 27,
            overflow: "hidden",
          },
        ]}
      >
        <View
          style={{
            height: 250,
            marginHorizontal: -24,
            marginTop: -24,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              transform: [{ rotate: "-12deg" }],
              marginTop: -30,
              marginHorizontal: -25,
            }}
          >
            {store.series
              .filter((s) => s.poster_url)
              .slice(0, 4)
              .map((s, i) => (
                <Image
                  key={s.id}
                  source={{ uri: s.poster_url! }}
                  style={{
                    width: 125,
                    height: 225,
                    borderRadius: 13,
                    marginTop: i % 2 ? 40 : 0,
                  }}
                />
              ))}
          </View>
          <LinearGradient
            colors={["#160f2010", "#160f20"]}
            style={{ position: "absolute", inset: 0 }}
          />
          <View style={{ position: "absolute", bottom: 18, left: 24, gap: 12 }}>
            <Image
              source={require("../../assets/icons/icon.png")}
              style={{ width: 62, height: 62, borderRadius: 19 }}
            />
            <Text
              style={{
                color: "#fff",
                fontSize: 29,
                fontWeight: "900",
                letterSpacing: -1,
              }}
            >
              DraBorn<Text style={{ color: colors.pink }}>Series</Text>
            </Text>
            <Text style={{ color: "#e1b8d7", fontSize: 11, letterSpacing: 2 }}>
              HİKÂYEN BURADA BAŞLASIN
            </Text>
          </View>
        </View>
        <Text style={styles.h1}>
          {mode === "register"
            ? t.register
            : mode === "forgot"
              ? t.forgot
              : mode === "reset"
                ? "Yeni şifre"
                : t.login}
        </Text>
        <Text style={styles.body}>{t.synced}</Text>
        {mode === "register" && (
          <Field
            label="Kullanıcı adı"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        )}
        {mode === "register" && <ProfilePhotoPicker optional uri={photo?.uri}
          onPick={() => run(async () => { const selected = await pickProfilePhoto(); if (selected) setPhoto(selected); })}
          onRemove={() => setPhoto(null)} />}
        {mode !== "reset" && (
          <Field
            label={t.email}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
          />
        )}
        {mode !== "forgot" && (
          <Field
            label={t.password}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
          />
        )}
        <Button
          onPress={() =>
            run(
              submit,
              mode === "register"
                ? "Kayıt işlemi tamamlandı."
                : mode === "forgot"
                  ? "Şifre sıfırlama bağlantısı gönderildi."
                  : "Tamamlandı.",
            )
          }
          icon="arrow-forward"
        >
          {mode === "register"
            ? t.register
            : mode === "forgot"
              ? "Bağlantı gönder"
              : mode === "reset"
                ? t.save
                : t.login}
        </Button>
        <Button secondary onPress={() => run(google)} icon="logo-google">
          Google
        </Button>
        <View style={styles.wrap}>
          <Button
            small
            secondary
            onPress={() => setMode(mode === "register" ? "login" : "register")}
          >
            {mode === "register" ? t.login : t.register}
          </Button>
          <Button small secondary onPress={() => setMode("forgot")}>
            {t.forgot}
          </Button>
          {store.session && (
            <Button small secondary onPress={() => setMode("reset")}>
              Yeni şifre belirle
            </Button>
          )}
        </View>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>
          Hesap bilgilerin Supabase Auth ile korunur. Google girişi,
          sağlayıcının etkin olduğu ve dönüş adresinin izinli olduğu ortamda
          kullanılabilir.
        </Text>
      </View>
    </View>
  );
}

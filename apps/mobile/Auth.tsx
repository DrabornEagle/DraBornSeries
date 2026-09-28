import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { db, deviceId, rpc, requireData } from "../../packages/api/client";
import { config } from "../../packages/shared/config";
import { Button, Field, Icon, colors, styles } from "../../packages/ui/theme";
import type { Store } from "../../packages/api/store";
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
    [username, setUsername] = useState("");
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
          { maxWidth: 480, width: "100%", padding: 30, gap: 23 },
        ]}
      >
        <View style={styles.row}>
          <Icon name="play-circle" color={colors.pink} size={37} />
          <Text style={styles.h2}>DraBornSeries</Text>
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

import React, { useEffect, useId, useMemo, useRef } from "react";
import { Platform, StyleSheet } from "react-native";
import { useVideoPlayer } from "expo-video";
import { WebView } from "react-native-webview";
import { browserVideoDocument, isBrowserR2Source } from "../shared/browser-video";
import { nativeVideoSource } from "../shared/native-video-source";
import { BrowserPlayer, type Engine } from "../shared/browser-player";


export function usePlaybackEngine(url: string, loop = false, muted = false, interval = 0.5) {
  const browser = useMemo(() => Platform.OS === "android" && isBrowserR2Source(url) ? new BrowserPlayer(url, false, false) : null, [url]);
  useEffect(() => { if (browser) { browser.loop = loop; browser.muted = muted; } }, [browser, loop, muted]);
  const native = useVideoPlayer(browser ? null : nativeVideoSource(url), (player) => {
    player.loop = loop; player.muted = muted; player.timeUpdateEventInterval = interval;
    player.bufferOptions = { preferredForwardBufferDuration: 10, minBufferForPlayback: 0.75 };
  });
  const player: Engine = browser || native;
  return { player, native, browser };
}

export function BrowserVideoView({ player, fit = "cover", onFirstFrameRender }: { player: BrowserPlayer; fit?: "cover" | "contain"; onFirstFrameRender: () => void }) {
  const view = useRef<WebView<Record<never, never>>>(null);
  const id = useId();
  const document = useMemo(() => {
    return { id, html: browserVideoDocument({ id, url: player.url, time: player.currentTime, muted: player.muted, loop: player.loop, playing: player.wanted, fit }) };
    // A fit change updates the element without reloading the video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, id]);
  useEffect(() => {
    player.attach(document.id, (script) => view.current?.injectJavaScript(script));
    return () => player.detach(document.id);
  }, [player, document.id]);
  useEffect(() => { player.command({ type: "fit", fit }); }, [player, fit]);
  return <WebView<Record<never, never>> ref={view} source={{ html: document.html, baseUrl: "https://www.draborneagle.com/" }}
    originWhitelist={["*"]} onShouldStartLoadWithRequest={(request) => request.isTopFrame === false || request.url === "about:blank" || request.url === "https://www.draborneagle.com/"}
    onMessage={(event) => player.message(event.nativeEvent.data, onFirstFrameRender)}
    onError={() => player.fail("WEBVIEW")}
    javaScriptEnabled domStorageEnabled={false} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
    allowsFullscreenVideo={false} mixedContentMode="never" allowFileAccess={false} thirdPartyCookiesEnabled={false}
    sharedCookiesEnabled={false} setSupportMultipleWindows={false} scrollEnabled={false} overScrollMode="never"
    style={styles.video} containerStyle={styles.video} />;
}
const styles = StyleSheet.create({ video: { width: "100%", height: "100%", backgroundColor: "#05020a" } });

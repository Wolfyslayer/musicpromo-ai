import { useEffect, useRef, useState } from "react";
import { createElement } from "react";
import { Platform, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { loadEngineHtml } from "@/components/DeviceEngine";

export function EnginePreview({ input, playing }: { input: Record<string, unknown>; playing: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const webview = useRef<WebView>(null);
  const ready = useRef(false);

  useEffect(() => {
    let active = true;
    loadEngineHtml()
      .then((value) => {
        if (active) setHtml(value);
      })
      .catch(() => {
        if (active) setHtml(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const push = () => {
    const script = `window.__musicpromoPreview && window.__musicpromoPreview(${JSON.stringify({ ...input, playing })}); true;`;
    if (Platform.OS === "web") {
      frame.current?.contentWindow?.postMessage({ type: "musicpromo-eval", script }, "*");
      return;
    }
    webview.current?.injectJavaScript(script);
  };

  useEffect(() => {
    if (ready.current) push();
  }, [html, input, playing]);

  const onMessage = (data: string) => {
    try {
      const message = JSON.parse(data);
      if (message.type === "ready") {
        ready.current = true;
        push();
      }
    } catch {
      /* ignore preview chatter */
    }
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      if (frame.current && event.source !== frame.current.contentWindow) return;
      onMessage(event.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [input, playing]);

  if (!html) return null;

  return (
    <View className="mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-3xl bg-black">
      {Platform.OS === "web" ? (
        createElement("iframe", {
          ref: frame,
          srcDoc: html,
          style: { width: "100%", height: "100%", border: 0, background: "#000" },
        })
      ) : (
        <WebView
          ref={webview}
          source={{ html, baseUrl: "https://musicpromo.local" }}
          onMessage={(event: WebViewMessageEvent) => onMessage(event.nativeEvent.data)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          style={{ flex: 1, backgroundColor: "#000" }}
        />
      )}
    </View>
  );
}

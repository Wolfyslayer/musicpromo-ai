import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { registerRenderBridge, type BridgeProgress } from '@/lib/renderBridge';
import { supabase } from '@/lib/supabaseClient';

const KEEP_AWAKE_TAG = 'render-host';
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000;
const READY_TIMEOUT_MS = 30 * 1000;

type Pending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  onProgress?: (info: BridgeProgress) => void;
  timer: ReturnType<typeof setTimeout>;
};

function hostUrl() {
  const base = String(process.env.EXPO_PUBLIC_WEB_APP_URL || '').trim().replace(/\/+$/, '');
  return base ? `${base}/?mobile-render=1` : '';
}

/**
 * Hidden WebView that loads the web app's headless render page and runs video renders and lyric sync
 * on the device. It is mounted once at the app root and only loads its page on first use.
 */
export default function RenderHost() {
  const webRef = useRef<WebView>(null);
  const pending = useRef(new Map<string, Pending>());
  const counter = useRef(0);
  const readyWaiters = useRef<(() => void)[]>([]);
  const isReady = useRef(false);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const url = hostUrl();

  const activate = useCallback(() => {
    if (!activeRef.current) {
      activeRef.current = true;
      setActive(true);
    }
  }, []);

  const waitUntilReady = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        if (isReady.current) {
          resolve();
          return;
        }
        const timer = setTimeout(() => reject(new Error('The render engine did not load. Check your connection and EXPO_PUBLIC_WEB_APP_URL.')), READY_TIMEOUT_MS);
        readyWaiters.current.push(() => {
          clearTimeout(timer);
          resolve();
        });
      }),
    []
  );

  const send = useCallback((payload: Record<string, unknown>) => {
    const script = `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(payload))} })); true;`;
    webRef.current?.injectJavaScript(script);
  }, []);

  const request = useCallback(
    async (type: string, payload: Record<string, unknown>, onProgress?: (info: BridgeProgress) => void) => {
      if (!url) {
        throw new Error('Video rendering needs EXPO_PUBLIC_WEB_APP_URL (the URL where the web app is deployed).');
      }
      activate();
      await waitUntilReady();
      const id = String(++counter.current);
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current.delete(id);
          reject(new Error('Rendering took too long and was stopped.'));
        }, REQUEST_TIMEOUT_MS);
        pending.current.set(id, { resolve, reject, onProgress, timer });
        send({ type, id, ...payload });
      }).finally(() => {
        if (pending.current.size === 0) deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      });
    },
    [activate, send, url, waitUntilReady]
  );

  useEffect(() => {
    registerRenderBridge({
      async render(project, options) {
        const { data } = (await supabase?.auth.getSession()) || { data: { session: null } };
        const session = data.session;
        if (!session) throw new Error('Sign in to render a video.');
        return request(
          'render',
          { project, audioUrl: options.audioUrl, accessToken: session.access_token, refreshToken: session.refresh_token },
          options.onProgress
        );
      },
      transcribe(options) {
        return request('transcribe', { audioUrl: options.audioUrl, durationSec: options.durationSec }, options.onProgress);
      },
    });
    return () => registerRenderBridge(null);
  }, [request]);

  const settle = (id: string, fn: (entry: Pending) => void) => {
    const entry = pending.current.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.current.delete(id);
    fn(entry);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let message: any;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === 'ready') {
      isReady.current = true;
      readyWaiters.current.splice(0).forEach((fn) => fn());
    } else if (message.type === 'progress') {
      pending.current.get(message.id)?.onProgress?.(message);
    } else if (message.type === 'result') {
      settle(message.id, (entry) => entry.resolve(message.result));
    } else if (message.type === 'error') {
      settle(message.id, (entry) => entry.reject(new Error(message.message || 'Render failed.')));
    }
  };

  const failAll = (reason: string) => {
    isReady.current = false;
    for (const id of Array.from(pending.current.keys())) {
      settle(id, (entry) => entry.reject(new Error(reason)));
    }
  };

  if (!active || !url) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 270, height: 480, left: 0, top: 0, opacity: 0.01, zIndex: -1 }}>
      <WebView
        ref={webRef}
        source={{ uri: url }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        originWhitelist={['https://*']}
        onError={() => failAll('The render engine failed to load.')}
        onHttpError={() => failAll('The render engine could not be reached.')}
        onContentProcessDidTerminate={() => {
          failAll('The render engine ran out of memory. Close other apps and try again.');
          webRef.current?.reload();
        }}
        onRenderProcessGone={() => {
          failAll('The render engine ran out of memory. Close other apps and try again.');
          webRef.current?.reload();
        }}
      />
    </View>
  );
}

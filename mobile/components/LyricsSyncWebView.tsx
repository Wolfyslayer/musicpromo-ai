import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { supabase } from '@/lib/supabaseClient';
import { getWebAppBaseUrl } from '@/lib/webApp';

type Cue = { text: string; start?: number; end?: number; timeSeconds?: number };

type Props = {
  visible: boolean;
  audioUrl: string;
  durationSec: number;
  onClose: () => void;
  onComplete: (cues: Cue[]) => void;
  onProgress?: (info: { progress?: number; message?: string }) => void;
};

export function LyricsSyncWebView({
  visible,
  audioUrl,
  durationSec,
  onClose,
  onComplete,
  onProgress,
}: Props) {
  const ref = useRef<WebView>(null);
  const [status, setStatus] = useState('Starting free sync (on-device Whisper)…');
  const webBase = getWebAppBaseUrl();

  const sendSessionAndSync = useCallback(async () => {
    if (!supabase || !ref.current || !audioUrl) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      setStatus('Sign in to sync lyrics.');
      return;
    }
    ref.current.postMessage(
      JSON.stringify({
        type: 'setSession',
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }),
    );
    ref.current.postMessage(
      JSON.stringify({
        type: 'sync',
        audioUrl,
        durationSec,
      }),
    );
  }, [audioUrl, durationSec]);

  useEffect(() => {
    if (visible) setStatus('Starting free sync (on-device Whisper)…');
  }, [visible]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') sendSessionAndSync();
      if (data.type === 'session_ok') setStatus('Listening and syncing lyrics…');
      if (data.type === 'progress') {
        onProgress?.({ progress: data.progress, message: data.message });
        if (data.message) setStatus(String(data.message));
      }
      if (data.type === 'complete') {
        if (data.ok && Array.isArray(data.cues)) {
          onComplete(data.cues as Cue[]);
        } else {
          setStatus(data.error || 'Sync failed');
        }
        onClose();
      }
    } catch {
      /* ignore */
    }
  };

  if (!webBase) return null;

  const uri = `${webBase}/mobile-lyrics-sync-bridge`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background pt-12">
        <View className="flex-row items-center justify-between border-b border-border px-4 pb-3">
          <Text className="text-base font-semibold text-foreground">Lyrics sync</Text>
          <Pressable onPress={onClose} className="rounded-lg px-3 py-2">
            <Text className="text-primary">Close</Text>
          </Pressable>
        </View>
        <Text className="px-4 py-2 text-xs text-muted-foreground">{status}</Text>
        {/* @ts-expect-error react-native-webview generic props */}
        <WebView
          ref={ref}
          source={{ uri }}
          onMessage={onMessage}
          onLoadEnd={() => sendSessionAndSync()}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          startInLoadingState
          renderLoading={() => (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" />
            </View>
          )}
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
}

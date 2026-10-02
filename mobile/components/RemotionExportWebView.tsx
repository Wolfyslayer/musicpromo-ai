import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { supabase } from '@/lib/supabaseClient';

type ExportResult = {
  status?: string;
  downloadUrl?: string | null;
  message?: string;
  project?: Record<string, unknown>;
};

type Props = {
  visible: boolean;
  projectId: string;
  onClose: () => void;
  onComplete: (result: ExportResult) => void;
  onProgress?: (info: { progress?: number; message?: string }) => void;
};

export function RemotionExportWebView({ visible, projectId, onClose, onComplete, onProgress }: Props) {
  const ref = useRef<WebView>(null);
  const [status, setStatus] = useState('Opening web renderer…');
  const webBase = (process.env.EXPO_PUBLIC_WEB_APP_URL || '').replace(/\/$/, '');

  const sendSession = useCallback(async () => {
    if (!supabase || !ref.current) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      setStatus('Sign in required for web render.');
      return;
    }
    ref.current.postMessage(
      JSON.stringify({
        type: 'setSession',
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }),
    );
    ref.current.postMessage(JSON.stringify({ type: 'export', projectId }));
  }, [projectId]);

  useEffect(() => {
    if (visible) setStatus('Opening web renderer…');
  }, [visible]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        sendSession();
      }
      if (data.type === 'session_ok') {
        setStatus('Rendering promo video…');
      }
      if (data.type === 'progress') {
        onProgress?.({ progress: data.progress, message: data.message });
        if (data.message) setStatus(String(data.message));
      }
      if (data.type === 'complete') {
        onComplete(data as ExportResult);
        onClose();
      }
    } catch {
      /* ignore */
    }
  };

  if (!webBase) {
    return null;
  }

  const uri = `${webBase}/mobile-export-bridge?projectId=${encodeURIComponent(projectId)}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background pt-12">
        <View className="flex-row items-center justify-between border-b border-border px-4 pb-3">
          <Text className="text-base font-semibold text-foreground">Remotion export</Text>
          <Pressable onPress={onClose} className="rounded-lg px-3 py-2">
            <Text className="text-primary">Close</Text>
          </Pressable>
        </View>
        <Text className="px-4 py-2 text-xs text-muted-foreground">{status}</Text>
        {/* WebView typings vary by RN version; runtime props are valid. */}
        {/* @ts-expect-error react-native-webview generic props */}
        <WebView
          ref={ref}
          source={{ uri }}
          onMessage={onMessage}
          onLoadEnd={() => sendSession()}
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

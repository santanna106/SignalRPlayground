import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { openAppSettings, startBackgroundLocationUpdates } from './backgroundLocation';

export default function App() {
  const [message, setMessage] = useState('Solicitando permissoes de localizacao...');
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const result = await startBackgroundLocationUpdates();
        if (cancelled) {
          return;
        }

        setMessage(result.message);
        setCanOpenSettings(!result.ok && Boolean(result.canOpenSettings));
      } catch (error) {
        if (cancelled) {
          return;
        }

        const fallbackMessage = error instanceof Error ? error.message : 'Falha ao iniciar a localizacao em segundo plano.';
        setMessage(fallbackMessage);
        setCanOpenSettings(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator size="large" color="#0f766e" /> : null}
      <Text style={styles.title}>Rastreamento de localizacao</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.endpoint}>Envio para `http://localhost:5122/locationHub`</Text>
      {canOpenSettings ? (
        <Pressable style={styles.button} onPress={openAppSettings}>
          <Text style={styles.buttonText}>Abrir configuracoes</Text>
        </Pressable>
      ) : null}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 24,
  },
  endpoint: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

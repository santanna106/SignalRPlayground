import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getHubUrl,
  LocationMode,
  openAppSettings,
  startLocationStreaming,
  stopLocationStreaming,
} from './backgroundLocation';

export default function App() {
  const [message, setMessage] = useState('Escolha entre rota fake para testes ou GPS real.');
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const [activeMode, setActiveMode] = useState<LocationMode | null>(null);

  async function handleStart(mode: LocationMode) {
    const result = await startLocationStreaming(mode);
    setMessage(result.message);
    setCanOpenSettings(!result.ok && Boolean(result.canOpenSettings));
    setActiveMode(result.ok ? mode : null);
  }

  async function handleStop() {
    await stopLocationStreaming();
    setActiveMode(null);
    setCanOpenSettings(false);
    setMessage('Envio interrompido.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SignalR Location Test</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.endpoint}>{getHubUrl()}</Text>
      <View style={styles.buttonRow}>
        <Pressable style={styles.primaryButton} onPress={() => void handleStart('fake')}>
          <Text style={styles.buttonText}>Enviar rota fake</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void handleStart('gps')}>
          <Text style={styles.secondaryButtonText}>Usar GPS real</Text>
        </Pressable>
      </View>
      <Pressable style={styles.stopButton} onPress={() => void handleStop()}>
        <Text style={styles.buttonText}>Parar envio</Text>
      </Pressable>
      {canOpenSettings ? (
        <Pressable style={styles.linkButton} onPress={() => void openAppSettings()}>
          <Text style={styles.linkButtonText}>Abrir configuracoes</Text>
        </Pressable>
      ) : null}
      <Text style={styles.modeLabel}>
        Modo atual: {activeMode === null ? 'nenhum' : activeMode === 'fake' ? 'rota fake' : 'gps real'}
      </Text>
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
  buttonRow: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#b91c1c',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    minWidth: 180,
  },
  linkButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  linkButtonText: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '600',
  },
  modeLabel: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
});

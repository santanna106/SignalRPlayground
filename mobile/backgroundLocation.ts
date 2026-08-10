import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Linking, Platform } from 'react-native';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
const SIGNALR_HUB_URL = 'http://10.0.2.2:5122/locationHub';

export type BackgroundLocationStartResult =
  | { ok: true; message: string }
  | { ok: false; message: string; canOpenSettings?: boolean };

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Erro na tarefa de localizacao em segundo plano:', error);
    return;
  }

  if (!data) {
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] }).locations;
  if (!locations?.length) {
    return;
  }

  const location = locations[0];
  if (!location?.coords) {
    return;
  }

  const payload = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    altitude: location.coords.altitude,
    heading: location.coords.heading,
    speed: location.coords.speed,
    timestamp: location.timestamp,
  };

  try {
    await sendLocation(payload);
  } catch (taskError) {
    console.error('Falha ao enviar localizacao em background:', taskError);
  }
});

export async function startBackgroundLocationUpdates(): Promise<BackgroundLocationStartResult> {
  try {

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      return {
        ok: false,
        message: 'Permissao de localizacao em primeiro plano negada.',
        canOpenSettings: !foreground.canAskAgain,
      };
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== Location.PermissionStatus.GRANTED) {
      return {
        ok: false,
        message: getBackgroundPermissionDeniedMessage(),
        canOpenSettings: true,
      };
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      return {
        ok: true,
        message: 'A localizacao em segundo plano ja estava ativa.',
      };
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 5000,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Localizacao em segundo plano',
        notificationBody: 'O app esta enviando sua localizacao para a API',
        notificationColor: '#0000FF',
      },
    });

    return {
      ok: true,
      message: 'Localizacao em segundo plano ativada com sucesso.',
    };

  } catch (error) {
    console.log(error)
    return {
      ok: false,
      message: 'Localizacao em segundo plano não ativada.',
    };
  }



}

export async function openAppSettings() {
  await Linking.openSettings();
}

function getBackgroundPermissionDeniedMessage() {
  if (Platform.OS === 'ios') {
    return 'Permissao de localizacao em segundo plano negada. No iPhone, permita "Sempre" para localizacao nas configuracoes do app.';
  }

  return 'Permissao de localizacao em segundo plano negada. No Android, permita "o tempo todo" para localizacao nas configuracoes do app.';
}

async function sendLocation(payload: Record<string, unknown>) {
  const connection = new HubConnectionBuilder()
    .withUrl(SIGNALR_HUB_URL)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();

  try {
    console.log('SIGNALR_HUB_URL: ',SIGNALR_HUB_URL);
    console.log('mobile-location', JSON.stringify(payload, null, 2));
    await connection.start();
    await connection.invoke('SendLocationData', 'mobile-location', JSON.stringify(payload, null, 2));

  } finally {
    if (connection.state !== 'Disconnected') {
      await connection.stop();
    }
  }
}

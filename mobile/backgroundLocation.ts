import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Linking, Platform } from 'react-native';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
const SIGNALR_HUB_URL = 'http://10.0.2.2:5122/locationHub';
const SIGNALR_METHOD_NAME = 'SendLocationData';
const DEVICE_ID = 'mobile-location';
const FAKE_INTERVAL_MS = 3000;

type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationMode = 'fake' | 'gps';

export type LocationStreamResult =
  | { ok: true; message: string }
  | { ok: false; message: string; canOpenSettings?: boolean };

let connection: HubConnection | null = null;
let fakeInterval: ReturnType<typeof setInterval> | null = null;
let fakeRouteIndex = 0;

const fakeRoute = buildFakeRoute();

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Erro na tarefa de localizacao em segundo plano:', error);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations;
  const location = locations?.[0];

  if (!location?.coords) {
    return;
  }

  await sendLocation({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    altitude: location.coords.altitude,
    heading: location.coords.heading,
    speed: location.coords.speed,
    timestamp: location.timestamp,
    mode: 'fake',
  });
});

export async function startLocationStreaming(mode: LocationMode): Promise<LocationStreamResult> {
  await stopLocationStreaming();

  if (mode === 'fake') {
    await ensureConnection();
    fakeRouteIndex = 0;
    fakeInterval = setInterval(() => {
      void sendNextFakeLocation();
    }, FAKE_INTERVAL_MS);

    await sendNextFakeLocation();

    return {
      ok: true,
      message: 'Enviando rota fake entre o Colegio Salesiano de Nazare e o Forum Rui Barbosa.',
    };
  }

  return startGpsLocationUpdates();
}

export async function stopLocationStreaming() {
  if (fakeInterval) {
    clearInterval(fakeInterval);
    fakeInterval = null;
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  if (connection && connection.state !== HubConnectionState.Disconnected) {
    await connection.stop();
  }

  connection = null;
}

export async function openAppSettings() {
  await Linking.openSettings();
}

export function getHubUrl() {
  return SIGNALR_HUB_URL;
}

async function startGpsLocationUpdates(): Promise<LocationStreamResult> {
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

  await ensureConnection();

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Highest,
    timeInterval: 5000,
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Localizacao em segundo plano',
      notificationBody: 'O app esta enviando sua localizacao real para a API',
      notificationColor: '#0000FF',
    },
  });

  return {
    ok: true,
    message: 'Enviando localizacao real do GPS.',
  };
}

async function sendNextFakeLocation() {
  const point = fakeRoute[fakeRouteIndex];
  fakeRouteIndex = (fakeRouteIndex + 1) % fakeRoute.length;

  await sendLocation({
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: 5,
    altitude: 12,
    heading: 120,
    speed: 8,
    timestamp: Date.now(),
    mode: 'fake',
  });
}

async function sendLocation(payload: Record<string, unknown>) {
  const activeConnection = await ensureConnection();
  console.log('SIGNALR_HUB_URL:', SIGNALR_HUB_URL);
  console.log('mobile-location', JSON.stringify(payload, null, 2));
  await activeConnection.invoke(SIGNALR_METHOD_NAME, DEVICE_ID, JSON.stringify(payload, null, 2));
}

async function ensureConnection() {
  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl(SIGNALR_HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
  }

  if (connection.state === HubConnectionState.Disconnected) {
    await connection.start();
  }

  return connection;
}

function getBackgroundPermissionDeniedMessage() {
  if (Platform.OS === 'ios') {
    return 'Permissao de localizacao em segundo plano negada. No iPhone, permita "Sempre" para localizacao nas configuracoes do app.';
  }

  return 'Permissao de localizacao em segundo plano negada. No Android, permita "o tempo todo" para localizacao nas configuracoes do app.';
}

function buildFakeRoute(): Coordinates[] {
  const start = { latitude: -12.97707, longitude: -38.50626 };
  const end = { latitude: -12.97472, longitude: -38.51202 };
  const steps = 14;
  const route: Coordinates[] = [];

  for (let index = 0; index < steps; index += 1) {
    const progress = index / (steps - 1);
    route.push({
      latitude: interpolate(start.latitude, end.latitude, progress) + curveOffset(progress, 0.00022),
      longitude: interpolate(start.longitude, end.longitude, progress) - curveOffset(progress, 0.00018),
    });
  }

  return route;
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function curveOffset(progress: number, intensity: number) {
  return Math.sin(progress * Math.PI) * intensity;
}

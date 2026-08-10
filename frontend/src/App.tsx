import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import type { LatLngExpression, LatLngTuple } from 'leaflet'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import './App.css'

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

type LocationPoint = {
  lat: number
  lng: number
  recordedAt: string
}

type MobileLocation = {
  latitude?: unknown
  longitude?: unknown
  timestamp?: unknown
}

const HUB_URL = 'http://localhost:5122/locationHub'
const HUB_METHODS = [
  'ReceiveLocation',
]
const DEFAULT_CENTER: LatLngTuple = [-14.235, -51.9253]

const currentLocationIcon = L.divIcon({
  className: 'device-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function isValidCoordinate(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
}

function asCoordinate(value: unknown): number | null {
  if (isValidCoordinate(value)) {
    return value as number
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')

    if (normalized.length === 0) {
      return null
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseLocationObject(value: string): MobileLocation | null {
  const normalized = value.trim()

  if (!normalized.startsWith('{')) {
    return null
  }

  try {
    return JSON.parse(normalized) as MobileLocation
  } catch {
    return null
  }
}

function buildPointFromLocationObject(locationObj: MobileLocation): LocationPoint | null {
  const lat = asCoordinate(locationObj.latitude)
  const lng = asCoordinate(locationObj.longitude)
  const rawTimestamp = locationObj.timestamp

  if (lat === null || lng === null) {
    return null
  }

  const recordedAt =
    typeof rawTimestamp === 'number'
      ? new Date(rawTimestamp).toISOString()
      : typeof rawTimestamp === 'string'
        ? rawTimestamp
        : new Date().toISOString()

  return { lat, lng, recordedAt }
}

function formatTimestamp(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'sem horario'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date)
}

function MapViewportSync({ points }: { points: LocationPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) {
      return
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16)
      return
    }

    map.fitBounds(
      points.map((point) => [point.lat, point.lng] as LatLngTuple),
      { padding: [48, 48] },
    )
  }, [map, points])

  return null
}

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [points, setPoints] = useState<LocationPoint[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<string>('')
  const connectionRef = useRef<HubConnection | null>(null)

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build()

    connectionRef.current = connection

    const handlePayload = (...args: unknown[]) => {
      const locationTag = typeof args[0] === 'string' ? args[0] : null
      const locationObj = typeof args[1] === 'string' ? parseLocationObject(args[1]) : null

      setLastPayload(
        JSON.stringify(
          {
            tag: locationTag,
            location: locationObj,
          },
          null,
          2,
        ),
      )

      if (!locationObj) {
        setErrorMessage('Payload recebido, mas sem coordenadas reconhecidas.')
        return
      }

      const point = buildPointFromLocationObject(locationObj)

      if (!point) {
        setErrorMessage('Payload recebido, mas sem coordenadas reconhecidas.')
        return
      }

      setErrorMessage(null)
      setPoints((current) => {
        const lastPoint = current.at(-1)

        if (lastPoint && lastPoint.lat === point.lat && lastPoint.lng === point.lng) {
          return current
        }

        return [...current, point]
      })
    }

    HUB_METHODS.forEach((method) => {
      connection.on(method, (...args) => {
        handlePayload(...args)
      })
    })

    connection.onclose((error) => {
      setStatus('disconnected')
      if (error) {
        setErrorMessage(error.message)
      }
    })

    connection.onreconnecting((error) => {
      setStatus('reconnecting')
      if (error) {
        setErrorMessage(error.message)
      }
    })

    connection.onreconnected(() => {
      setStatus('connected')
      setErrorMessage(null)
    })

    async function startConnection() {
      setStatus('connecting')
      setErrorMessage(null)

      try {
        await connection.start()

        if (connection.state === HubConnectionState.Connected) {
          setStatus('connected')
        }
      } catch (error) {
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Falha ao conectar no hub.')
      }
    }

    void startConnection()

    return () => {
      HUB_METHODS.forEach((method) => {
        connection.off(method)
      })

      void connection.stop()
      connectionRef.current = null
    }
  }, [])

  const latestPoint = points.at(-1) ?? null
  const polylinePositions = useMemo<LatLngExpression[]>(
    () => points.map((point) => [point.lat, point.lng] as LatLngTuple),
    [points],
  )

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">SignalR + React Leaflet</p>
          <h1>Deslocamento do aparelho em tempo real</h1>
          <p className="hero-copy">
            O frontend se conecta ao hub <code>{HUB_URL}</code> e plota no mapa cada
            coordenada recebida para formar a trilha do dispositivo.
          </p>
        </div>

        <div className={`status-card status-${status}`}>
          <span className="status-dot" />
          <div>
            <strong>{status}</strong>
            <p>Eventos escutados: {HUB_METHODS.join(', ')}</p>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <aside className="sidebar">
          <article className="panel">
            <h2>Ultima localizacao</h2>
            {latestPoint ? (
              <>
                <dl className="stats-grid">
                  <div>
                    <dt>Latitude</dt>
                    <dd>{latestPoint.lat.toFixed(6)}</dd>
                  </div>
                  <div>
                    <dt>Longitude</dt>
                    <dd>{latestPoint.lng.toFixed(6)}</dd>
                  </div>
                  <div>
                    <dt>Recebido em</dt>
                    <dd>{formatTimestamp(latestPoint.recordedAt)}</dd>
                  </div>
                  <div>
                    <dt>Pontos</dt>
                    <dd>{points.length}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="muted">
                Aguardando coordenadas do hub. Assim que a primeira chegar, o mapa vai
                centralizar automaticamente.
              </p>
            )}
          </article>

          <article className="panel">
            <h2>Diagnostico</h2>
            <p className="muted">
              Se o aplicativo publicar outro nome de metodo no hub, ajuste a constante
              <code>HUB_METHODS</code> em <code>src/App.tsx</code>.
            </p>
            {errorMessage ? <p className="error-box">{errorMessage}</p> : null}
          </article>

          <article className="panel">
            <h2>Ultimo payload</h2>
            <pre>{lastPayload || 'Nenhuma mensagem recebida ainda.'}</pre>
          </article>
        </aside>

        <section className="map-panel">
          <MapContainer center={DEFAULT_CENTER} zoom={4} scrollWheelZoom className="map-view">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapViewportSync points={points} />

            {polylinePositions.length > 1 ? (
              <Polyline positions={polylinePositions} pathOptions={{ color: '#ff6b35', weight: 5 }} />
            ) : null}

            {latestPoint ? (
              <Marker position={[latestPoint.lat, latestPoint.lng]} icon={currentLocationIcon}>
                <Popup>
                  <strong>Posicao atual</strong>
                  <br />
                  {latestPoint.lat.toFixed(6)}, {latestPoint.lng.toFixed(6)}
                </Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </section>
      </section>
    </main>
  )
}

export default App

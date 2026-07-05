import type { Route, RouteOptimizeRequest, RouteStop } from "@/types";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// ─── Google Directions API ────────────────────────────────────────────────────

interface DirectionsLeg {
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
}

interface DirectionsRoute {
  legs: DirectionsLeg[];
  overview_polyline: { points: string };
}

interface DirectionsResponse {
  status: string;
  routes: DirectionsRoute[];
}

/**
 * Google Directions API kullanarak iki nokta arasında rota hesaplar.
 * Waypoints ile çoklu durak desteği vardır.
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints: { lat: number; lng: number }[] = [],
  optimize = true
): Promise<DirectionsResponse | null> {
  const originStr = `${origin.lat},${origin.lng}`;
  const destStr = `${destination.lat},${destination.lng}`;

  const waypointStr =
    waypoints.length > 0
      ? `&waypoints=${optimize ? "optimize:true|" : ""}${waypoints
          .map((w) => `${w.lat},${w.lng}`)
          .join("|")}`
      : "";

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${originStr}&destination=${destStr}${waypointStr}` +
    `&mode=driving&language=tr&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: DirectionsResponse = await res.json();
    if (data.status !== "OK") return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Verilen marketler listesini en kısa rotaya göre optimize eder.
 * Google Directions API'nin waypoint optimizasyonunu kullanır.
 */
export async function optimizeRoute(
  request: RouteOptimizeRequest
): Promise<Partial<Route> | null> {
  if (request.market_ids.length === 0) return null;

  // Market koordinatlarını almak için normalde backend'den gelir.
  // Burada mock koordinat kullanıyoruz — gerçek entegrasyonda API'den çekilir.
  // market_ids → koordinat eşlemesi backend /markets endpoint'inden gelecek.
  return null; // Backend entegrasyonu bekleniyor
}

/**
 * Rota adımlarını hesaplar ve RouteStop dizisine dönüştürür.
 */
export function buildRouteStops(
  directionsRoute: DirectionsRoute,
  marketIds: string[]
): Partial<RouteStop>[] {
  return directionsRoute.legs.map((leg, i) => ({
    market_id: marketIds[i] ?? "",
    order_index: i,
    distance_from_prev: leg.distance.value,
    duration_from_prev: leg.duration.value,
    status: "pending" as const,
  }));
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const MOCK_REPS = [
  {
    user_id: "u1",
    name: "Ahmet Yılmaz",
    lat: 36.8845,
    lng: 30.7056,
    timestamp: new Date().toISOString(),
  },
  {
    user_id: "u2",
    name: "Fatma Kaya",
    lat: 36.862,
    lng: 30.731,
    timestamp: new Date().toISOString(),
  },
  {
    user_id: "u3",
    name: "Mehmet Demir",
    lat: 36.872,
    lng: 30.699,
    timestamp: new Date().toISOString(),
  },
];

export const MOCK_ROUTES: Route[] = [
  {
    id: "r1",
    user_id: "u1",
    user: { id: "u1", name: "Ahmet Yılmaz", email: "ahmet@firma.com", role: "field_rep", created_at: "" },
    date: new Date().toISOString().split("T")[0],
    status: "active",
    total_distance: 12400,
    total_duration: 2700,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stops: [
      {
        id: "s1",
        market_id: "1",
        order_index: 0,
        status: "visited",
        distance_from_prev: 0,
        duration_from_prev: 0,
        market: { id: "1", name: "Migros Konyaaltı", type: "market", address: "Konyaaltı Cad. No:15", latitude: 36.884, longitude: 30.695, is_verified: true, is_corporate: false, source: "api", created_at: "" },
      },
      {
        id: "s2",
        market_id: "3",
        order_index: 1,
        status: "visited",
        distance_from_prev: 3200,
        duration_from_prev: 480,
        market: { id: "3", name: "BİM Muratpaşa", type: "market", address: "Muratpaşa Mah. No:5", latitude: 36.879, longitude: 30.712, is_verified: true, is_corporate: false, source: "api", created_at: "" },
      },
      {
        id: "s3",
        market_id: "5",
        order_index: 2,
        status: "pending",
        distance_from_prev: 4100,
        duration_from_prev: 600,
        market: { id: "5", name: "CarrefourSA Lara", type: "market", address: "Lara Cad. No:88", latitude: 36.858, longitude: 30.724, is_verified: true, is_corporate: false, source: "api", created_at: "" },
      },
    ],
  },
  {
    id: "r2",
    user_id: "u2",
    user: { id: "u2", name: "Fatma Kaya", email: "fatma@firma.com", role: "field_rep", created_at: "" },
    date: new Date().toISOString().split("T")[0],
    status: "active",
    total_distance: 8900,
    total_duration: 1980,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stops: [
      {
        id: "s4",
        market_id: "2",
        order_index: 0,
        status: "visited",
        distance_from_prev: 0,
        duration_from_prev: 0,
        market: { id: "2", name: "ŞokMarket Lara", type: "market", address: "Lara Cad. No:42", latitude: 36.862, longitude: 30.731, is_verified: true, is_corporate: false, source: "api", created_at: "" },
      },
      {
        id: "s5",
        market_id: "4",
        order_index: 1,
        status: "pending",
        distance_from_prev: 5600,
        duration_from_prev: 720,
        market: { id: "4", name: "A101 Kepez", type: "market", address: "Kepez Mah. No:12", latitude: 36.872, longitude: 30.699, is_verified: true, is_corporate: false, source: "api", created_at: "" },
      },
    ],
  },
];

export const MOCK_MARKETS_FOR_ROUTE = [
  { id: "1", name: "Migros Konyaaltı", address: "Konyaaltı Cad. No:15", latitude: 36.884, longitude: 30.695 },
  { id: "2", name: "ŞokMarket Lara", address: "Lara Cad. No:42", latitude: 36.862, longitude: 30.731 },
  { id: "3", name: "BİM Muratpaşa", address: "Muratpaşa Mah. No:5", latitude: 36.879, longitude: 30.712 },
  { id: "4", name: "A101 Kepez", address: "Kepez Mah. No:12", latitude: 36.872, longitude: 30.699 },
  { id: "5", name: "CarrefourSA Lara", address: "Lara Cad. No:88", latitude: 36.858, longitude: 30.724 },
  { id: "6", name: "Teknosa Muratpaşa", address: "Muratpaşa Mah. No:22", latitude: 36.875, longitude: 30.708 },
];

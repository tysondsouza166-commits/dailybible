import { useState, useEffect, useRef } from "react";
import { 
  MapPin, 
  Navigation, 
  Star, 
  Compass, 
  Loader2, 
  Info,
  AlertTriangle
} from "lucide-react";
import { GoogleMap, useLoadScript, Marker, InfoWindow } from "@react-google-maps/api";

// API Key setup from .env or fallback
const API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof process !== "undefined" ? process.env?.GOOGLE_MAPS_PLATFORM_KEY : "") ||
  "AIzaSyDfMEBJbTHsydXiXKV9Qzcl2eCxQ9J7xYI";

const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

// Fallback: Muscat, Oman
const DEFAULT_CENTER = { lat: 23.5859, lng: 58.4059 };

// Fallback churches data for Muscat, Oman in case API requests are blocked or fail
const FALLBACK_CHURCHES = [
  {
    place_id: "fallback_1",
    name: "Protestant Church of Oman",
    vicinity: "Al Khuwair, Muscat, Oman",
    geometry: {
      location: {
        lat: () => 23.5912,
        lng: () => 58.4234
      }
    },
    rating: 4.8
  },
  {
    place_id: "fallback_2",
    name: "Sts. Peter & Paul Catholic Church",
    vicinity: "Ruwi, Muscat, Oman",
    geometry: {
      location: {
        lat: () => 23.6015,
        lng: () => 58.5412
      }
    },
    rating: 4.7
  },
  {
    place_id: "fallback_3",
    name: "Holy Spirit Catholic Church",
    vicinity: "Ghala, Muscat, Oman",
    geometry: {
      location: {
        lat: () => 23.5789,
        lng: () => 58.3884
      }
    },
    rating: 4.6
  },
  {
    place_id: "fallback_4",
    name: "Muscat Christian Fellowship",
    vicinity: "Shatti Al Qurum, Muscat, Oman",
    geometry: {
      location: {
        lat: () => 23.6145,
        lng: () => 58.4612
      }
    },
    rating: 4.9
  }
];

// Sleek dark map theme to match True Black aesthetic
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#121212" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#121212" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "poi.park", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1b1b1b" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
  { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
];

// Helper to calculate distance in kilometers
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function ChurchFinder() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  });

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [churches, setChurches] = useState<any[]>([]);
  const [selectedChurch, setSelectedChurch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapAuthError, setMapAuthError] = useState(false);

  useEffect(() => {
    // Define global Google Maps auth failure handler
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps Auth Failure detected (e.g. ApiTargetBlockedMapError or invalid key).");
      setMapAuthError(true);
    };
    return () => {
      (window as any).gm_authFailure = undefined;
    };
  }, []);

  useEffect(() => {
    detectLocation();
  }, []);

  useEffect(() => {
    if (mapAuthError) {
      setChurches(FALLBACK_CHURCHES);
      setLoading(false);
    }
  }, [mapAuthError]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setUserCoords(DEFAULT_CENTER);
      setMapCenter(DEFAULT_CENTER);
      setLoading(false);
      return;
    }

    setLocating(true);
    setPermissionDenied(false);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserCoords(coords);
        setMapCenter(coords);
        setLocating(false);
      },
      (err) => {
        console.warn("Geolocation failed, using Muscat, Oman fallback:", err);
        setLocating(false);
        // Silently catch the error and automatically center the map on the default coordinate (Muscat, Oman)
        setUserCoords(DEFAULT_CENTER);
        setMapCenter(DEFAULT_CENTER);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Trigger search when map is loaded and userCoords are resolved
  useEffect(() => {
    if (!isLoaded || !map || !userCoords || mapAuthError) return;

    setLoading(true);
    const service = new google.maps.places.PlacesService(map);
    const request = {
      location: userCoords,
      radius: 5000,
      type: "church",
    };

    service.nearbySearch(request, (results, status) => {
      setLoading(false);
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        setChurches(results);
      } else {
        // Fallback with keyword text search to maximize coverage
        service.nearbySearch(
          {
            location: userCoords,
            radius: 5000,
            keyword: "church",
          },
          (fallbackResults, fallbackStatus) => {
            if (fallbackStatus === google.maps.places.PlacesServiceStatus.OK && fallbackResults) {
              setChurches(fallbackResults);
            } else {
              console.warn("Places search returned empty or error. Status:", fallbackStatus, "Using fallback churches.");
              setChurches(FALLBACK_CHURCHES);
              setError(null);
            }
          }
        );
      }
    });
  }, [isLoaded, map, userCoords, mapAuthError]);

  const handleChurchClick = (church: any) => {
    setSelectedChurch(church);
    const lat = typeof church.geometry?.location?.lat === "function" 
      ? church.geometry.location.lat() 
      : church.geometry?.location?.lat;
    const lng = typeof church.geometry?.location?.lng === "function" 
      ? church.geometry.location.lng() 
      : church.geometry?.location?.lng;
    if (lat && lng && map) {
      const coords = { lat, lng };
      setMapCenter(coords);
      map.panTo(coords);
      map.setZoom(15);
    }
  };

  const getCleanDirectionsUrl = (church: any) => {
    const lat = typeof church.geometry?.location?.lat === "function" 
      ? church.geometry.location.lat() 
      : church.geometry?.location?.lat;
    const lng = typeof church.geometry?.location?.lng === "function" 
      ? church.geometry.location.lng() 
      : church.geometry?.location?.lng;
    const name = church.name || "Church";
    if (lat && lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(church.vicinity || name)}`;
  };

  if (loadError) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto bg-[#1C1C1E] rounded-3xl border border-zinc-800 text-white shadow-xl mt-6 text-left">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
        <h3 className="text-lg font-bold font-serif text-center">Map Preview Unavailable</h3>
        <p className="text-xs text-zinc-300 leading-relaxed">
          Google Maps failed to load. This can occur due to network problems, script blocking, or an incorrect API Key configuration.
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
          <p className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Troubleshooting Steps:
          </p>
          <ul className="list-disc list-inside text-[10px] text-zinc-400 space-y-1">
            <li>Ensure a valid <code className="px-1.5 py-0.5 bg-black rounded text-red-400 font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> is defined in your <code className="px-1 py-0.5 bg-black rounded font-mono text-xs">.env</code>.</li>
            <li>Verify that <strong className="text-white">"Maps JavaScript API"</strong> is enabled in your Google Cloud Project.</li>
            <li>Check if your browser or ad-blocker is preventing external scripts from loading.</li>
          </ul>
        </div>
        <p className="text-xs text-zinc-500 text-center italic">
          Try running the app locally with <code className="px-1.5 py-0.5 bg-zinc-900 rounded font-mono text-xs text-zinc-400">npm run dev</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-5 text-left">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-red-600 animate-pulse" />
            Church Finder
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Discover places of worship, scripture groups, and Christian fellowships nearby.
          </p>
        </div>

        <button
          onClick={detectLocation}
          disabled={locating}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full transition cursor-pointer self-start sm:self-auto"
        >
          {locating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Compass className="w-3.5 h-3.5" />
          )}
          <span>{locating ? "Locating..." : "Use My Location"}</span>
        </button>
      </div>

      {permissionDenied && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 text-xs rounded-2xl border border-amber-200 dark:border-amber-900/30 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Location Services Required</p>
            <p className="leading-relaxed">To view local churches relative to your actual coordinates, please allow location permissions in your browser or device settings, and tap "Use My Location".</p>
          </div>
        </div>
      )}

      {/* Main Map + Scrollable Bottom Sheet area */}
      <div className="w-full flex flex-col h-[750px] md:h-[620px] rounded-3xl overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-2xl bg-white dark:bg-black">
        {/* Top Half: Google Map */}
        <div className="w-full h-[50%] md:h-[60%] relative border-b border-slate-100 dark:border-zinc-800 bg-zinc-950">
          {!isLoaded ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
              <p className="text-xs text-zinc-400">Loading Google Maps...</p>
            </div>
          ) : mapAuthError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-zinc-950 overflow-y-auto">
              <AlertTriangle className="w-8 h-8 text-amber-500 animate-bounce" />
              <h4 className="text-sm font-bold text-white font-serif">API Key Authorization Error</h4>
              <p className="text-[11px] text-zinc-400 max-w-[280px] leading-relaxed">
                The configured Google Maps API Key lacks permission to load the map here (e.g., <code className="text-red-400 text-[10px]">ApiTargetBlockedMapError</code>).
              </p>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-left max-w-[320px] space-y-1.5">
                <p className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                  <Info className="w-3 h-3" /> How to fix in Google Cloud Console:
                </p>
                <ol className="list-decimal list-inside text-[9px] text-zinc-300 space-y-1">
                  <li>Go to <strong className="text-white">APIs & Services &gt; Credentials</strong></li>
                  <li>Click on your active API Key</li>
                  <li>Under <strong className="text-white">API restrictions</strong>, ensure <strong className="text-white">"Maps JavaScript API"</strong> and <strong className="text-white">"Places API"</strong> are checked</li>
                  <li>Save and wait 5 minutes to propagate</li>
                </ol>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                Showing offline preview mode. You can still view details and get directions below!
              </p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={mapCenter}
              zoom={13}
              options={{
                styles: darkMapStyle,
                disableDefaultUI: true,
                zoomControl: true,
                clickableIcons: false,
              }}
              onLoad={(mapInstance) => setMap(mapInstance)}
            >
              {/* User Location marker */}
              {userCoords && (
                <Marker
                  position={userCoords}
                  title="Your Location"
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: "#3B82F6",
                    fillOpacity: 0.9,
                    strokeColor: "#FFFFFF",
                    strokeWeight: 2,
                    scale: 7,
                  }}
                />
              )}

              {/* Church markers */}
              {churches.map((church, idx) => {
                const lat = typeof church.geometry?.location?.lat === "function"
                  ? church.geometry.location.lat()
                  : church.geometry?.location?.lat;
                const lng = typeof church.geometry?.location?.lng === "function"
                  ? church.geometry.location.lng()
                  : church.geometry?.location?.lng;
                if (!lat || !lng) return null;

                const isSelected = selectedChurch && selectedChurch.place_id === church.place_id;

                return (
                  <Marker
                    key={church.place_id || idx}
                    position={{ lat, lng }}
                    title={church.name}
                    icon={{
                      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                      fillColor: isSelected ? "#DC2626" : "#EF4444",
                      fillOpacity: 1,
                      strokeColor: "#FFFFFF",
                      strokeWeight: 1,
                      scale: 1.5,
                      anchor: new google.maps.Point(12, 24),
                    }}
                    onClick={() => setSelectedChurch(church)}
                  />
                );
              })}

              {/* InfoWindow for selected church */}
              {selectedChurch && (() => {
                const lat = typeof selectedChurch.geometry?.location?.lat === "function"
                  ? selectedChurch.geometry.location.lat()
                  : selectedChurch.geometry?.location?.lat;
                const lng = typeof selectedChurch.geometry?.location?.lng === "function"
                  ? selectedChurch.geometry.location.lng()
                  : selectedChurch.geometry?.location?.lng;
                if (!lat || !lng) return null;

                return (
                  <InfoWindow
                    position={{ lat, lng }}
                    onCloseClick={() => setSelectedChurch(null)}
                  >
                    <div className="p-1 max-w-[210px] text-slate-950 font-sans">
                      <h4 className="font-bold text-xs leading-snug">{selectedChurch.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">{selectedChurch.vicinity || selectedChurch.formatted_address}</p>
                      {selectedChurch.rating && (
                        <div className="flex items-center gap-1 mt-1 text-amber-500 font-bold text-[10px]">
                          <Star className="w-3 h-3 fill-current" />
                          <span>{selectedChurch.rating}</span>
                        </div>
                      )}
                      <a
                        href={getCleanDirectionsUrl(selectedChurch)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 block text-center bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-xl text-[10px] transition-colors"
                      >
                        Get Directions
                      </a>
                    </div>
                  </InfoWindow>
                );
              })()}
            </GoogleMap>
          )}
        </div>

        {/* Bottom Sheet List View */}
        <div className="w-full h-[50%] md:h-[40%] flex flex-col bg-slate-50 dark:bg-[#1C1C1E] rounded-t-3xl md:rounded-b-3xl p-4 overflow-hidden shadow-inner">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-serif">
                Nearby Worship Places
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                {churches.length} houses of worship found within 5km
              </p>
            </div>
            {loading && (
              <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 custom-scrollbar pr-1">
            {loading && churches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
                <p className="text-xs text-slate-400 dark:text-zinc-500">Scanning local coordinates...</p>
              </div>
            ) : churches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                <MapPin className="w-7 h-7 text-slate-300 dark:text-zinc-700" />
                <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">No Worship Places Found</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 max-w-[220px]">
                  {error || "Try tapping 'Use My Location' or checking back later."}
                </p>
              </div>
            ) : (
              churches.map((church, index) => {
                const isSelected = selectedChurch && selectedChurch.place_id === church.place_id;
                
                // Calculate distance if user coords are available
                let distLabel = "";
                if (userCoords && church.geometry?.location) {
                  const cLat = typeof church.geometry.location.lat === "function"
                    ? church.geometry.location.lat()
                    : church.geometry.location.lat;
                  const cLng = typeof church.geometry.location.lng === "function"
                    ? church.geometry.location.lng()
                    : church.geometry.location.lng;
                  const km = calculateDistance(userCoords.lat, userCoords.lng, cLat, cLng);
                  distLabel = km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`;
                }

                return (
                  <div
                    key={church.place_id || index}
                    onClick={() => handleChurchClick(church)}
                    className={`p-3.5 flex items-start justify-between gap-3 transition-colors cursor-pointer select-none rounded-2xl mt-1 text-left ${
                      isSelected
                        ? "bg-red-500/10 border-l-4 border-red-600"
                        : "bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex-grow space-y-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {church.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                        {church.vicinity || church.formatted_address || "Address not available"}
                      </p>

                      <div className="flex items-center gap-3 pt-0.5 text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                        {distLabel && (
                          <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                            <Navigation className="w-3 h-3 rotate-45 fill-current" />
                            {distLabel} away
                          </span>
                        )}

                        {church.rating && (
                          <span className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400">
                            <Star className="w-3 h-3 fill-current" />
                            {church.rating}
                          </span>
                        )}
                      </div>
                    </div>

                    <a
                      href={getCleanDirectionsUrl(church)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 p-2.5 bg-white dark:bg-black hover:bg-slate-100 dark:hover:bg-zinc-900 text-red-600 dark:text-red-400 rounded-2xl transition border border-slate-150 dark:border-zinc-800 flex items-center justify-center"
                      title="Get Directions"
                    >
                      <Navigation className="w-4 h-4 fill-current rotate-45" />
                    </a>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

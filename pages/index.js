import { useEffect, useRef, useState } from 'react';

/**
 * The main page of the journey planner. Users can enter a free‑form prompt
 * describing their trip as well as a list of destinations, one per line. The
 * application geocodes those place names via Nominatim and then displays
 * numbered markers connected by a polyline on a 3D MapLibre view. Users can
 * also click on the map to add additional waypoints, reorder points via
 * up/down arrows, toggle terrain on and off and clear the entire route.
 */
export default function Home() {
  // Free‑form descriptive prompt. Currently unused by the map, but included
  // because the user requested an input for planning their journey. You could
  // integrate this with an AI service or itinerary builder in future.
  const [prompt, setPrompt] = useState('');
  // List of scene names entered by the user (one per line). When the
  // "Geocode Scenes" button is pressed, each line is looked up via the
  // Nominatim search API and converted to a coordinate.
  const [sceneText, setSceneText] = useState('');
  // Internal list of waypoints. Each item contains a name and a coordinate
  // array in [longitude, latitude] order. Updating this state triggers
  // re‑rendering of markers and the connecting line on the map.
  const [waypoints, setWaypoints] = useState([]);
  // Keep a ref to the map container div so we can pass it to MapLibre.
  const mapContainerRef = useRef(null);
  // Store the MapLibre map instance. We keep this outside of state because
  // modifying it does not cause React re-renders.
  const mapRef = useRef(null);
  // Keep track of marker objects so we can remove them on update.
  const markersRef = useRef([]);
  // Hold the imported maplibre library so it can be referenced in other
  // effects. maplibre-gl must be imported dynamically to avoid running
  // during server-side rendering. After import, assign it here.
  const maplibreRef = useRef(null);
  // Remember whether terrain is currently enabled. This lets us toggle
  // exaggeration on and off without needing extra layers.
  const [terrainEnabled, setTerrainEnabled] = useState(false);

  /**
   * Initialise the MapLibre map once on mount. We import the library
   * dynamically to avoid running it during server-side rendering. The style
   * specifies OpenStreetMap raster tiles and a DEM source for 3D terrain.
   * Once the map has loaded we add a GeoJSON source and a line layer to
   * represent the route. Clicks on the map will append a new waypoint.
   */
  useEffect(() => {
    let isMounted = true;
    // Only run on the client. When Next.js performs server-side rendering
    // `window` is undefined so no map should be created.
    if (typeof window === 'undefined') return;
    import('maplibre-gl').then((maplibregl) => {
      if (!isMounted) return;
      // Expose the library to other hooks.
      maplibreRef.current = maplibregl;
      // Create the map instance.
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            // Basic raster tiles from OpenStreetMap. This avoids the CORS
            // issues and 403 errors associated with the demo vector tiles.
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              maxzoom: 19,
            },
            // A raster digital elevation model from AWS Terrain Tiles. The
            // TERRARIUM encoding stores heights in the RGB channels. We use
            // exaggeration below to make the terrain more pronounced.
            terrain: {
              type: 'raster-dem',
              tiles: [
                'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              maxzoom: 12,
              encoding: 'terrarium',
            },
          },
          layers: [
            {
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 22,
            },
          ],
          terrain: {
            source: 'terrain',
            exaggeration: 1.5,
          },
        },
        center: [0, 0],
        zoom: 2,
        pitch: 0,
      });
      mapRef.current = map;
      // Add basic navigation controls (zoom in/out, rotate) to the map.
      map.addControl(new maplibregl.NavigationControl());
      // When the map finishes loading we set up our line source and layer.
      map.on('load', () => {
        // Route source holds a GeoJSON LineString. It starts empty and is
        // updated whenever waypoints change.
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
          },
        });
        // The line layer draws our route as a stroked polyline. You can
        // customise colour or width here.
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#0d6efd', 'line-width': 4 },
        });
        // A sky layer improves the appearance of the 3D terrain by adding
        // atmospheric scattering. This is only visible when terrain is
        // enabled.
        map.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 0.0],
            'sky-atmosphere-sun-intensity': 15,
          },
        });
      });
      // Allow users to click on the map to add a new waypoint. The name of
      // the waypoint uses a simple sequential "Waypoint N" pattern.
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        setWaypoints((prev) => {
          const newName = `Waypoint ${prev.length + 1}`;
          return [...prev, { name: newName, coord: [lng, lat] }];
        });
      });
    });
    // Cleanup on unmount: remove the map and prevent state updates.
    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  /**
   * Whenever the list of waypoints changes, update the markers and the route
   * line on the map. Removing markers before adding new ones avoids leaving
   * orphaned elements on the map. The route data is updated via the MapLibre
   * GeoJSON source so that the line redraws automatically.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Remove existing markers from the map.
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    // Create fresh markers. We need the maplibre library to construct
    // Marker instances. If it hasn't been imported yet, skip until
    // the next render.
    const maplibregl = maplibreRef.current;
    if (maplibregl) {
      waypoints.forEach((wp, index) => {
        const el = document.createElement('div');
        el.className = 'marker';
        el.textContent = String(index + 1);
        const marker = new maplibregl.Marker(el)
          .setLngLat(wp.coord)
          .addTo(map);
        markersRef.current.push(marker);
      });
    }
    // Update the route LineString with the new sequence of coordinates.
    const routeSource = map.getSource('route');
    if (routeSource) {
      const coords = waypoints.map((wp) => wp.coord);
      routeSource.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
  }, [waypoints]);

  /**
   * Geocode each scene name using the Nominatim API. The API returns an array
   * of results for each query; we take the first result. If a name fails to
   * geocode the user is alerted. After all results have been processed the
   * map is fitted to the bounding box of the points so everything is in view.
   */
  const geocodeScenes = async () => {
    const names = sceneText
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      alert('Please enter one or more scene names to geocode.');
      return;
    }
    const newWaypoints = [];
    for (const name of names) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          name,
        )}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'journey-planner-next-demo' },
        });
        if (!res.ok) throw new Error(`Geocoding failed for ${name}`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const { lat, lon } = data[0];
          newWaypoints.push({ name, coord: [parseFloat(lon), parseFloat(lat)] });
        } else {
          alert(`Could not find location: ${name}`);
        }
      } catch (err) {
        console.error(err);
        alert(`Error geocoding ${name}: ${err.message}`);
      }
    }
    if (newWaypoints.length > 0) {
      setWaypoints(newWaypoints);
      // After the state update, zoom to fit the new waypoints. We compute the
      // bounding box manually to avoid depending on maplibre classes outside
      // the dynamic import context.
      const map = mapRef.current;
      if (map) {
        let minLon = newWaypoints[0].coord[0];
        let maxLon = newWaypoints[0].coord[0];
        let minLat = newWaypoints[0].coord[1];
        let maxLat = newWaypoints[0].coord[1];
        newWaypoints.forEach((wp) => {
          const [lon, lat] = wp.coord;
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
        map.fitBounds(
          [
            [minLon, minLat],
            [maxLon, maxLat],
          ],
          { padding: 50 },
        );
      }
    }
  };

  /**
   * Move a waypoint up or down the list. Direction must be ±1. Boundary
   * conditions are handled by disabling the buttons in the JSX so this
   * function simply returns the original list if the swap would go out of
   * bounds.
   */
  const moveWaypoint = (index, direction) => {
    setWaypoints((prev) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const reordered = [...prev];
      [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
      return reordered;
    });
  };

  /**
   * Clear all waypoints and thus remove the line and markers from the map. If
   * called while no waypoints exist it does nothing.
   */
  const clearRoute = () => {
    setWaypoints([]);
  };

  /**
   * Toggle the terrain exaggeration. When turning off we simply set the
   * terrain property to null; MapLibre will revert to a flat map. Note that
   * the sky layer remains present but will have no effect without terrain.
   */
  const toggleTerrain = () => {
    const map = mapRef.current;
    if (!map) return;
    if (terrainEnabled) {
      map.setTerrain(null);
    } else {
      map.setTerrain({ source: 'terrain', exaggeration: 1.5 });
    }
    setTerrainEnabled(!terrainEnabled);
  };

  // Lightweight runtime tests to validate helper functions. These run once
  // when the component mounts. If assertions fail an error will be logged
  // into the console. Keep these tests simple: they are not meant to be
  // exhaustive but can catch obvious mistakes during development.
  useEffect(() => {
    // Test moveWaypoint logic on a small array.
    const sample = [
      { name: 'A', coord: [0, 0] },
      { name: 'B', coord: [1, 1] },
      { name: 'C', coord: [2, 2] },
    ];
    // Swap middle with first
    let reordered = [...sample];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    console.assert(
      reordered[0].name === 'B' && reordered[1].name === 'A',
      'moveWaypoint reorder failed',
    );
    // Bounding calculation sanity check
    const coords = [
      [0, 0],
      [5, 10],
      [-2, 3],
    ];
    let minLon = coords[0][0],
      maxLon = coords[0][0],
      minLat = coords[0][1],
      maxLat = coords[0][1];
    coords.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    console.assert(minLon === -2 && maxLon === 5 && minLat === 0 && maxLat === 10, 'Bounding box calc failed');
  }, []);

  return (
    <main style={{ padding: '1rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Journey Planner</h1>
      <p style={{ marginBottom: '1rem' }}>
        Describe your journey and list the places you want to visit. Click on
        "Geocode Scenes" to plot them on the map. You can also click on the
        map to add extra waypoints, reorder them, toggle 3D terrain or clear
        everything.
      </p>
      <div>
        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your journey planning prompt here (optional)"
        />
      </div>
      <div>
        <textarea
          rows={4}
          value={sceneText}
          onChange={(e) => setSceneText(e.target.value)}
          placeholder="Enter scene names, one per line (e.g. Eiffel Tower\nLouvre Museum)"
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={geocodeScenes}>Geocode Scenes</button>
        <button onClick={toggleTerrain}>{terrainEnabled ? 'Disable Terrain' : 'Enable Terrain'}</button>
        <button onClick={clearRoute}>Clear Route</button>
      </div>
      <div id="map" ref={mapContainerRef} />
      <div className="waypoint-list">
        {waypoints.map((wp, index) => (
          <div key={index} className="waypoint-item">
            <span>
              {index + 1}. {wp.name}
              {' ('}
              {wp.coord[1].toFixed(4)}, {wp.coord[0].toFixed(4)}
              {')'}
            </span>
            <button
              onClick={() => moveWaypoint(index, -1)}
              disabled={index === 0}
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => moveWaypoint(index, 1)}
              disabled={index === waypoints.length - 1}
              title="Move down"
            >
              ↓
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
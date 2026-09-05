/* =========================================================
   MAUR STRASSENDIENST
   KOMPLETTER APP.JS
   ---------------------------------------------------------
   Funktionen:
   - MapLibre + PMTiles
   - Normale Karte
   - Satellit
   - Hybrid
   - Ortschaftsgrenzen
   - GPS Live-Position
   - Suche
   - Ziel auswählen
   - Navigation
   - Route auf Karte
   - automatische Neuberechnung bei Abweichung
   - Restdistanz
   - Restzeit
   - Sprachansagen
   - Navigation folgen
   - Eigene Punkte
   - Offline/Online Anzeige
   ========================================================= */


/* =========================================================
   GRUNDLEGENDE EINSTELLUNGEN
   ========================================================= */

const PMTILES_URL = "./maur.pmtiles";

const DEFAULT_CENTER = [
    8.667,
    47.337
];

const DEFAULT_ZOOM = 13;


/* =========================================================
   GLOBALE VARIABLEN
   ========================================================= */

let map = null;

let gpsWatchId = null;

let gpsMarker = null;

let destinationMarker = null;

let currentPosition = null;

let currentDestination = null;

let navigationActive = false;

let navigationFollow = true;

let voiceEnabled = true;

let routeCoordinates = [];

let routeSteps = [];

let routeDistance = 0;

let routeDuration = 0;

let lastRerouteTime = 0;

let lastAnnouncedStep = -1;

let arrivedAnnounced = false;

let ownPoints = [];

let searchTimeout = null;


/* =========================================================
   MAPLIBRE / PMTILES
   ========================================================= */

const protocol =
    new pmtiles.Protocol();

maplibregl.addProtocol(
    "pmtiles",
    protocol.tile
);


/* =========================================================
   KARTE ERSTELLEN
   ========================================================= */

map = new maplibregl.Map({

    container: "map",

    center: DEFAULT_CENTER,

    zoom: DEFAULT_ZOOM,

    attributionControl: true,

    style: {

        version: 8,

        sources: {

            maur: {

                type: "vector",

                url:
                    "pmtiles://" +
                    PMTILES_URL

            },


            satellite: {

                type: "raster",

                tiles: [

                    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

                ],

                tileSize: 256,

                attribution:
                    "Esri"

            }

        },


        layers: [

            {
                id: "background",

                type: "background",

                paint: {

                    "background-color":
                        "#e5e7eb"

                }

            },


            {
                id: "satellite",

                type: "raster",

                source: "satellite",

                layout: {

                    visibility: "none"

                }

            },


            {
                id: "land",

                type: "fill",

                source: "maur",

                "source-layer": "land",

                paint: {

                    "fill-color":
                        "#e5e7eb"

                }

            },


            {
                id: "water",

                type: "fill",

                source: "maur",

                "source-layer": "water",

                paint: {

                    "fill-color":
                        "#a5d8ff"

                }

            },


            {
                id: "water-lines",

                type: "line",

                source: "maur",

                "source-layer": "water",

                paint: {

                    "line-color":
                        "#60a5fa",

                    "line-width": 1

                }

            },


            {
                id: "buildings",

                type: "fill",

                source: "maur",

                "source-layer": "buildings",

                paint: {

                    "fill-color":
                        "#d1d5db",

                    "fill-outline-color":
                        "#9ca3af"

                }

            },


            {
                id: "roads",

                type: "line",

                source: "maur",

                "source-layer": "roads",

                paint: {

                    "line-color":
                        "#ffffff",

                    "line-width": [

                        "interpolate",

                        ["linear"],

                        ["zoom"],

                        10,
                        0.5,

                        14,
                        2,

                        18,
                        6

                    ]

                }

            },


            {
                id: "street-labels",

                type: "symbol",

                source: "maur",

                "source-layer":
                    "street-labels",

                layout: {

                    "text-field":
                        ["get", "name"],

                    "text-size": 12

                },

                paint: {

                    "text-color":
                        "#374151",

                    "text-halo-color":
                        "#ffffff",

                    "text-halo-width": 1.5

                }

            },


            {
                id: "addresses",

                type: "symbol",

                source: "maur",

                "source-layer":
                    "addresses",

                layout: {

                    "text-field":
                        ["get", "name"],

                    "text-size": 10

                }

            }

        ]

    }

});


/* =========================================================
   MAP READY
   ========================================================= */

map.on("load", async () => {

    console.log(
        "Maur Strassendienst Karte geladen"
    );


    createNavigationRouteLayers();

    createOrtschaftsgrenzenLayers();

    await loadOrtschaftsgrenzen();

    loadSavedSettings();

    loadOwnPoints();

    updateOwnPointsList();

    registerServiceWorker();

});


/* =========================================================
   MAP BEWEGEN
   ========================================================= */

map.on("dragstart", () => {

    if (navigationActive) {

        navigationFollow = false;

        const checkbox =
            document.getElementById(
                "followNavigation"
            );

        if (checkbox) {

            checkbox.checked = false;

        }

    }

});


/* =========================================================
   NAVIGATION ROUTE LAYER
   ========================================================= */

function createNavigationRouteLayers() {

    if (!map.getSource("navigation-route")) {

        map.addSource(
            "navigation-route",
            {

                type: "geojson",

                data: {

                    type: "Feature",

                    properties: {},

                    geometry: {

                        type: "LineString",

                        coordinates: []

                    }

                }

            }

        );

    }


    if (!map.getLayer(
        "navigation-route-outline"
    )) {

        map.addLayer({

            id:
                "navigation-route-outline",

            type: "line",

            source:
                "navigation-route",

            layout: {

                "line-cap": "round",

                "line-join": "round"

            },

            paint: {

                "line-color":
                    "#ffffff",

                "line-width": 9,

                "line-opacity": 0.9

            }

        });

    }


    if (!map.getLayer(
        "navigation-route-line"
    )) {

        map.addLayer({

            id:
                "navigation-route-line",

            type: "line",

            source:
                "navigation-route",

            layout: {

                "line-cap": "round",

                "line-join": "round"

            },

            paint: {

                "line-color":
                    "#2563eb",

                "line-width": 6,

                "line-opacity": 0.95

            }

        });

    }

}


/* =========================================================
   ROUTE ANZEIGEN
   ========================================================= */

function showRoute(
    coordinates
) {

    routeCoordinates =
        coordinates || [];


    const source =
        map.getSource(
            "navigation-route"
        );


    if (!source) {
        return;
    }


    source.setData({

        type: "Feature",

        properties: {},

        geometry: {

            type: "LineString",

            coordinates:
                routeCoordinates

        }

    });

}


/* =========================================================
   ROUTE LÖSCHEN
   ========================================================= */

function clearRoute() {

    routeCoordinates = [];

    routeSteps = [];

    routeDistance = 0;

    routeDuration = 0;

    lastAnnouncedStep = -1;


    const source =
        map.getSource(
            "navigation-route"
        );


    if (source) {

        source.setData({

            type: "Feature",

            properties: {},

            geometry: {

                type: "LineString",

                coordinates: []

            }

        });

    }

}


/* =========================================================
   ORTSCHAFTSGRENZEN
   ========================================================= */

function createOrtschaftsgrenzenLayers() {

    if (!map.getSource(
        "ortsgrenzen-source"
    )) {

        map.addSource(
            "ortsgrenzen-source",
            {

                type: "geojson",

                data: {

                    type: "FeatureCollection",

                    features: []

                }

            }

        );

    }


    if (!map.getLayer(
        "ortsgrenzen-fill"
    )) {

        map.addLayer({

            id:
                "ortsgrenzen-fill",

            type: "fill",

            source:
                "ortsgrenzen-source",

            paint: {

                "fill-color":
                    "#ef4444",

                "fill-opacity":
                    0.03

            }

        });

    }


    if (!map.getLayer(
        "ortsgrenzen-line"
    )) {

        map.addLayer({

            id:
                "ortsgrenzen-line",

            type: "line",

            source:
                "ortsgrenzen-source",

            paint: {

                "line-color":
                    "#dc2626",

                "line-width": 2.5,

                "line-opacity": 0.95

            }

        });

    }

}


/* =========================================================
   OFFIZIELLE ORTSCHAFTSGRENZEN LADEN
   ========================================================= */

async function loadOrtschaftsgrenzen() {

    const bbox =
        "8.55,47.25,8.75,47.42";


    const typeNames = [

        "ms:ogd-0268_arv_basis_av_plz_ortschaften_f",

        "av_plz_ortschaften_f"

    ];


    let data = null;


    for (
        const typeName
        of typeNames
    ) {

        try {

            const url =
                "https://maps.zh.ch/wfs/OGDZHWFS" +
                "?service=WFS" +
                "&version=2.0.0" +
                "&request=GetFeature" +
                "&typeNames=" +
                encodeURIComponent(typeName) +
                "&outputFormat=application/json" +
                "&srsName=EPSG:4326" +
                "&bbox=" +
                bbox +
                ",EPSG:4326";


            const response =
                await fetch(url);


            if (!response.ok) {

                continue;

            }


            const json =
                await response.json();


            if (
                json &&
                json.features
            ) {

                data = json;

                break;

            }

        }

        catch (error) {

            console.warn(
                "WFS Versuch fehlgeschlagen",
                error
            );

        }

    }


    if (!data) {

        console.warn(
            "Ortschaftsgrenzen konnten nicht geladen werden."
        );

        return;

    }


    const wanted = [

        "BINZ",

        "MAUR",

        "AESCH",

        "FORCH",

        "UESSIKON"

    ];


    const filtered =
        data.features.filter(
            feature => {

                const properties =
                    feature.properties || {};


                const name =
                    properties.ortschaftsname ||
                    properties.ORTSCHAFTSNAME ||
                    properties.Ortschaftsname ||
                    properties.name ||
                    properties.NAME ||
                    "";


                return wanted.includes(
                    String(name)
                        .trim()
                        .toUpperCase()
                );

            }
        );


    const source =
        map.getSource(
            "ortsgrenzen-source"
        );


    if (source) {

        source.setData({

            type:
                "FeatureCollection",

            features:
                filtered

        });

    }


    const checkbox =
        document.getElementById(
            "ortsgrenzen"
        );


    if (checkbox) {

        checkbox.checked =
            localStorage.getItem(
                "maurOrtsgrenzen"
            ) !== "false";

    }


    updateOrtsgrenzenVisibility();

}


/* =========================================================
   ORTSCHAFTSGRENZEN EIN/AUS
   ========================================================= */

function toggleOrtsgrenzen(
    visible
) {

    localStorage.setItem(
        "maurOrtsgrenzen",
        visible
    );


    updateOrtsgrenzenVisibility();

}


function updateOrtsgrenzenVisibility() {

    const visible =
        localStorage.getItem(
            "maurOrtsgrenzen"
        ) !== "false";


    if (
        map.getLayer(
            "ortsgrenzen-line"
        )
    ) {

        map.setLayoutProperty(

            "ortsgrenzen-line",

            "visibility",

            visible
                ? "visible"
                : "none"

        );

    }


    if (
        map.getLayer(
            "ortsgrenzen-fill"
        )
    ) {

        map.setLayoutProperty(

            "ortsgrenzen-fill",

            "visibility",

            visible
                ? "visible"
                : "none"

        );

    }

}


/* =========================================================
   KARTENANSICHT
   ========================================================= */

function changeView(
    view
) {

    if (!map) {
        return;
    }


    localStorage.setItem(
        "maurMapView",
        view
    );


    const satellite =
        map.getLayer(
            "satellite"
        );


    if (satellite) {

        map.setLayoutProperty(

            "satellite",

            "visibility",

            view === "normal"
                ? "none"
                : "visible"

        );

    }


    const vectorLayers = [

        "background",

        "land",

        "water",

        "water-lines",

        "buildings"

    ];


    vectorLayers.forEach(
        id => {

            if (!map.getLayer(id)) {
                return;
            }


            map.setLayoutProperty(

                id,

                "visibility",

                view === "satellite"
                    ? "none"
                    : "visible"

            );

        }
    );


    if (
        map.getLayer(
            "roads"
        )
    ) {

        map.setLayoutProperty(

            "roads",

            "visibility",

            view === "satellite"
                ? "visible"
                : "visible"

        );


        map.setPaintProperty(

            "roads",

            "line-color",

            view === "satellite"
                ? "#ffffff"
                : "#ffffff"

        );

    }


    if (
        map.getLayer(
            "street-labels"
        )
    ) {

        map.setLayoutProperty(

            "street-labels",

            "visibility",

            view === "satellite"
                ? "visible"
                : "visible"

        );

    }

}


/* =========================================================
   LAYER EIN/AUS
   ========================================================= */

function toggleLayer(
    layerId,
    visible
) {

    if (!map) {
        return;
    }


    if (!map.getLayer(layerId)) {

        console.warn(
            "Layer nicht gefunden:",
            layerId
        );

        return;

    }


    map.setLayoutProperty(

        layerId,

        "visibility",

        visible
            ? "visible"
            : "none"

    );


    localStorage.setItem(

        "layer_" + layerId,

        visible

    );

}


/* =========================================================
   EINSTELLUNGEN LADEN
   ========================================================= */

function loadSavedSettings() {

    const view =
        localStorage.getItem(
            "maurMapView"
        ) || "normal";


    changeView(view);


    const layerSettings = [

        "buildings",

        "roads",

        "street-labels"

    ];


    layerSettings.forEach(
        layerId => {

            const saved =
                localStorage.getItem(
                    "layer_" + layerId
                );


            if (saved !== null) {

                toggleLayer(
                    layerId,
                    saved === "true"
                );


                const checkbox =
                    document.getElementById(
                        layerId ===
                        "street-labels"
                            ? "streetLabels"
                            : layerId
                    );


                if (checkbox) {

                    checkbox.checked =
                        saved === "true";

                }

            }

        }
    );


    updateOrtschaftsgrenzenVisibility();

}


/* =========================================================
   GPS STARTEN
   ========================================================= */

function startGpsTracking() {

    if (!navigator.geolocation) {

        showToast(
            "GPS wird von diesem Gerät nicht unterstützt."
        );

        return;

    }


    if (
        gpsWatchId !== null
    ) {

        return;

    }


    gpsWatchId =
        navigator.geolocation.watchPosition(

            handlePosition,

            handleGpsError,

            {

                enableHighAccuracy: true,

                maximumAge: 3000,

                timeout: 15000

            }

        );


    updateGpsStatus(
        "GPS wird gesucht..."
    );

}


/* =========================================================
   GPS POSITION
   ========================================================= */

function handlePosition(
    position
) {

    const coords =
        position.coords;


    currentPosition = {

        lng:
            coords.longitude,

        lat:
            coords.latitude,

        accuracy:
            coords.accuracy

    };


    updateGpsMarker();

    updateGpsInterface();


    if (navigationActive) {

        updateNavigationPosition();

    }

}


/* =========================================================
   GPS MARKER
   ========================================================= */

function updateGpsMarker() {

    if (!currentPosition) {
        return;
    }


    if (!gpsMarker) {

        const element =
            document.createElement(
                "div"
            );


        element.className =
            "gps-marker";


        gpsMarker =
            new maplibregl.Marker({
                element: element
            })
                .setLngLat([

                    currentPosition.lng,

                    currentPosition.lat

                ])
                .addTo(map);

    }

    else {

        gpsMarker.setLngLat([

            currentPosition.lng,

            currentPosition.lat

        ]);

    }

}


/* =========================================================
   GPS FEHLER
   ========================================================= */

function handleGpsError(
    error
) {

    console.warn(
        "GPS Fehler:",
        error
    );


    let message =
        "GPS konnte nicht ermittelt werden.";


    if (
        error.code === 1
    ) {

        message =
            "GPS-Berechtigung wurde verweigert.";

    }


    if (
        error.code === 2
    ) {

        message =
            "GPS-Position momentan nicht verfügbar.";

    }


    if (
        error.code === 3
    ) {

        message =
            "GPS-Zeitüberschreitung.";

    }


    updateGpsStatus(
        message
    );

}


/* =========================================================
   GPS BUTTON
   ========================================================= */

function goToLocation() {

    startGpsTracking();


    if (!currentPosition) {

        showToast(
            "GPS wird gesucht..."
        );

        return;

    }


    map.flyTo({

        center: [

            currentPosition.lng,

            currentPosition.lat

        ],

        zoom: 17,

        speed: 1.2

    });

}


/* =========================================================
   NAVIGATION STARTEN
   ========================================================= */

async function startNavigation() {

    if (!currentDestination) {

        showToast(
            "Bitte zuerst ein Ziel suchen."
        );

        openNavigationPanel();

        return;

    }


    startGpsTracking();


    if (!currentPosition) {

        showToast(
            "GPS wird gesucht. Bitte kurz warten."
        );

        return;

    }


    navigationActive = true;

    navigationFollow = true;

    arrivedAnnounced = false;

    lastAnnouncedStep = -1;


    const followCheckbox =
        document.getElementById(
            "followNavigation"
        );


    if (followCheckbox) {

        followCheckbox.checked =
            true;

    }


    showNavigationInfo(true);


    updateGpsStatus(
        "Navigation aktiv"
    );


    await calculateRoute();

}


/* =========================================================
   ROUTE BERECHNEN
   ========================================================= */

async function calculateRoute() {

    if (
        !currentPosition ||
        !currentDestination
    ) {

        return;

    }


    const start =
        currentPosition;


    const destination =
        currentDestination;


    const url =

        "https://router.project-osrm.org/route/v1/driving/" +

        start.lng +
        "," +
        start.lat +

        ";" +

        destination.lng +
        "," +
        destination.lat +

        "?overview=full" +

        "&geometries=geojson" +

        "&steps=true";


    updateNavigationInstruction(
        "Route wird berechnet..."
    );


    try {

        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                "Routing-Server nicht erreichbar"
            );

        }


        const data =
            await response.json();


        if (
            data.code !== "Ok" ||
            !data.routes ||
            !data.routes.length
        ) {

            throw new Error(
                "Keine Route gefunden"
            );

        }


        const route =
            data.routes[0];


        routeDistance =
            route.distance;


        routeDuration =
            route.duration;


        routeCoordinates =
            route.geometry.coordinates;


        routeSteps =
            route.legs &&
            route.legs[0] &&
            route.legs[0].steps
                ? route.legs[0].steps
                : [];


        lastAnnouncedStep = -1;

        arrivedAnnounced = false;


        showRoute(
            routeCoordinates
        );


        updateNavigationStats();


        updateNavigationInstruction(
            getFirstInstruction()
        );


        if (voiceEnabled) {

            speak(
                getFirstInstruction()
            );

        }


        fitNavigationRoute();


        showToast(
            "Route berechnet"
        );

    }

    catch (error) {

        console.error(
            "Routing Fehler:",
            error
        );


        updateNavigationInstruction(
            "Route konnte nicht berechnet werden."
        );


        showToast(
            "Keine Route gefunden."
        );

    }

}


/* =========================================================
   ERSTE NAVI-ANWEISUNG
   ========================================================= */

function getFirstInstruction() {

    if (!routeSteps.length) {

        return "Folgen Sie der Route zum Ziel.";

    }


    for (
        let i = 0;
        i < routeSteps.length;
        i++
    ) {

        const step =
            routeSteps[i];


        if (
            step.maneuver &&
            step.maneuver.type !== "depart"
        ) {

            return formatInstruction(
                step,
                step.distance
            );

        }

    }


    return "Navigation gestartet.";

}


/* =========================================================
   NAVIGATION POSITION AKTUALISIEREN
   ========================================================= */

function updateNavigationPosition() {

    if (
        !navigationActive ||
        !currentPosition ||
        !currentDestination
    ) {

        return;

    }


    const remaining =
        calculateRemainingRouteDistance(
            currentPosition.lng,
            currentPosition.lat
        );


    updateNavigationStats(
        remaining
    );


    checkOffRoute();


    updateTurnInstruction();


    if (navigationFollow) {

        map.easeTo({

            center: [

                currentPosition.lng,

                currentPosition.lat

            ],

            duration: 700,

            essential: true

        });

    }

}


/* =========================================================
   RESTDISTANZ BERECHNEN
   ========================================================= */

function calculateRemainingRouteDistance(
    lng,
    lat
) {

    if (
        routeCoordinates.length < 2
    ) {

        return routeDistance;

    }


    let bestDistance =
        Infinity;

    let bestIndex = 0;

    let bestT = 0;


    for (
        let i = 0;
        i <
        routeCoordinates.length - 1;
        i++
    ) {

        const a =
            routeCoordinates[i];

        const b =
            routeCoordinates[i + 1];


        const projection =
            projectPointOnSegment(

                lng,
                lat,

                a[0],
                a[1],

                b[0],
                b[1]

            );


        if (
            projection.distance <
            bestDistance
        ) {

            bestDistance =
                projection.distance;

            bestIndex =
                i;

            bestT =
                projection.t;

        }

    }


    let remaining = 0;


    const firstA =
        routeCoordinates[
            bestIndex
        ];

    const firstB =
        routeCoordinates[
            bestIndex + 1
        ];


    const segmentDistance =
        haversine(

            firstA[1],
            firstA[0],

            firstB[1],
            firstB[0]

        );


    remaining +=
        segmentDistance *
        (1 - bestT);


    for (
        let i =
            bestIndex + 1;

        i <
            routeCoordinates.length - 1;

        i++
    ) {

        remaining +=
            haversine(

                routeCoordinates[i][1],
                routeCoordinates[i][0],

                routeCoordinates[i + 1][1],
                routeCoordinates[i + 1][0]

            );

    }


    return Math.max(
        0,
        remaining
    );

}


/* =========================================================
   PUNKT AUF SEGMENT
   ========================================================= */

function projectPointOnSegment(
    px,
    py,
    ax,
    ay,
    bx,
    by
) {

    const lat =
        py *
        Math.PI /
        180;


    const cosLat =
        Math.cos(lat);


    const scaleX =
        111320 *
        cosLat;


    const scaleY =
        110540;


    const x =
        (px - ax) *
        scaleX;


    const y =
        (py - ay) *
        scaleY;


    const bxLocal =
        (bx - ax) *
        scaleX;


    const byLocal =
        (by - ay) *
        scaleY;


    const lengthSquared =
        bxLocal * bxLocal +
        byLocal * byLocal;


    let t = 0;


    if (
        lengthSquared > 0
    ) {

        t =
            (
                x * bxLocal +
                y * byLocal
            ) /
            lengthSquared;

    }


    t =
        Math.max(
            0,
            Math.min(
                1,
                t
            )
        );


    const closestX =
        ax +
        (bx - ax) *
        t;


    const closestY =
        ay +
        (by - ay) *
        t;


    const distance =
        haversine(

            py,
            px,

            closestY,
            closestX

        );


    return {

        distance: distance,

        t: t

    };

}


/* =========================================================
   HAVERSINE
   ========================================================= */

function haversine(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R =
        6371000;


    const dLat =
        (
            lat2 -
            lat1
        ) *
        Math.PI /
        180;


    const dLon =
        (
            lon2 -
            lon1
        ) *
        Math.PI /
        180;


    const a =

        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)

        +

        Math.cos(
            lat1 *
            Math.PI /
            180
        )

        *

        Math.cos(
            lat2 *
            Math.PI /
            180
        )

        *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);


    return (

        2 *
        R *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        )

    );

}


/* =========================================================
   ABWEICHUNG VON ROUTE PRÜFEN
   ========================================================= */

function checkOffRoute() {

    if (
        !navigationActive ||
        !currentPosition ||
        routeCoordinates.length < 2
    ) {

        return;

    }


    let closest =
        Infinity;


    for (
        let i = 0;
        i <
        routeCoordinates.length - 1;
        i++
    ) {

        const a =
            routeCoordinates[i];

        const b =
            routeCoordinates[i + 1];


        const projection =
            projectPointOnSegment(

                currentPosition.lng,
                currentPosition.lat,

                a[0],
                a[1],

                b[0],
                b[1]

            );


        closest =
            Math.min(
                closest,
                projection.distance
            );

    }


    const gpsAccuracy =
        currentPosition.accuracy || 10;


    const threshold =
        Math.max(
            50,
            gpsAccuracy * 1.5
        );


    if (
        closest > threshold
    ) {

        const now =
            Date.now();


        if (
            now -
            lastRerouteTime
            >
            10000
        ) {

            lastRerouteTime =
                now;


            updateNavigationInstruction(
                "Route verlassen – neue Route wird gesucht..."
            );


            if (voiceEnabled) {

                speak(
                    "Sie haben die Route verlassen. Ich suche eine neue Route."
                );

            }


            calculateRoute();

        }

    }

}


/* =========================================================
   NÄCHSTE ABBIEGEANWEISUNG
   ========================================================= */

function updateTurnInstruction() {

    if (
        !routeSteps.length ||
        !currentPosition
    ) {

        return;

    }


    for (
        let i =
            Math.max(
                0,
                lastAnnouncedStep + 1
            );

        i <
            routeSteps.length;

        i++
    ) {

        const step =
            routeSteps[i];


        if (
            !step.maneuver ||
            !step.maneuver.location
        ) {

            continue;

        }


        const location =
            step.maneuver.location;


        const distance =
            haversine(

                currentPosition.lat,
                currentPosition.lng,

                location[1],
                location[0]

            );


        if (
            distance < 100
        ) {

            const instruction =
                formatInstruction(
                    step,
                    distance
                );


            updateNavigationInstruction(
                instruction
            );


            if (
                voiceEnabled &&
                i !== lastAnnouncedStep
            ) {

                speak(
                    instruction
                );

            }


            lastAnnouncedStep =
                i;


            break;

        }

    }


    const remaining =
        calculateRemainingRouteDistance(

            currentPosition.lng,
            currentPosition.lat

        );


    if (
        remaining < 25 &&
        !arrivedAnnounced
    ) {

        arrivedAnnounced = true;


        updateNavigationInstruction(
            "🏁 Sie haben Ihr Ziel erreicht."
        );


        if (voiceEnabled) {

            speak(
                "Sie haben Ihr Ziel erreicht."
            );

        }


        showToast(
            "🏁 Ziel erreicht"
        );

    }

}


/* =========================================================
   ANWEISUNG FORMATIEREN
   ========================================================= */

function formatInstruction(
    step,
    distance
) {

    const maneuver =
        step.maneuver || {};


    const type =
        maneuver.type || "";


    const modifier =
        maneuver.modifier || "";


    const name =
        step.name ||
        "der Strasse";


    const distanceText =
        formatDistance(
            distance
        );


    if (
        type === "arrive"
    ) {

        return "Sie haben Ihr Ziel erreicht.";

    }


    if (
        type === "depart"
    ) {

        return (
            "Start. Folgen Sie " +
            name +
            "."
        );

    }


    if (
        type === "roundabout" ||
        type === "rotary"
    ) {

        const exit =
            maneuver.exit
                ? " Ausfahrt " +
                  maneuver.exit +
                  "."
                : "";


        return (

            "In " +
            distanceText +
            " in den Kreisverkehr einfahren." +
            exit +
            " Richtung " +
            name +
            "."

        );

    }


    if (
        modifier === "right"
    ) {

        return (

            "In " +
            distanceText +
            " rechts abbiegen auf " +
            name +
            "."

        );

    }


    if (
        modifier === "left"
    ) {

        return (

            "In " +
            distanceText +
            " links abbiegen auf " +
            name +
            "."

        );

    }


    if (
        modifier === "slight right"
    ) {

        return (

            "In " +
            distanceText +
            " leicht rechts halten Richtung " +
            name +
            "."

        );

    }


    if (
        modifier === "slight left"
    ) {

        return (

            "In " +
            distanceText +
            " leicht links halten Richtung " +
            name +
            "."

        );

    }


    if (
        type === "merge"
    ) {

        return (

            "In " +
            distanceText +
            " einfädeln Richtung " +
            name +
            "."

        );

    }


    return (

        "In " +
        distanceText +
        " geradeaus Richtung " +
        name +
        "."

    );

}


/* =========================================================
   ROUTE FITTEN
   ========================================================= */

function fitNavigationRoute() {

    if (
        routeCoordinates.length < 2
    ) {

        return;

    }


    const bounds =
        new maplibregl.LngLatBounds();


    routeCoordinates.forEach(
        coordinate => {

            bounds.extend(
                coordinate
            );

        }
    );


    map.fitBounds(
        bounds,
        {

            padding: {

                top: 180,

                bottom: 120,

                left: 40,

                right: 40

            },

            duration: 1000

        }
    );

}


/* =========================================================
   NAVIGATION STATS
   ========================================================= */

function updateNavigationStats(
    remainingOverride
) {

    let remaining =
        remainingOverride;


    if (
        remaining === undefined
    ) {

        remaining =
            routeDistance;

    }


    const remainingDistance =
        document.getElementById(
            "remainingDistance"
        );


    const remainingTime =
        document.getElementById(
            "remainingTime"
        );


    if (remainingDistance) {

        remainingDistance.textContent =
            formatDistance(
                remaining
            );

    }


    if (remainingTime) {

        let seconds =
            routeDuration;


        if (
            routeDistance > 0
        ) {

            seconds =
                routeDuration *
                (
                    remaining /
                    routeDistance
                );

        }


        remainingTime.textContent =
            formatTime(
                seconds
            );

    }

}


/* =========================================================
   DISTANZ FORMATIEREN
   ========================================================= */

function formatDistance(
    meters
) {

    if (
        meters === undefined ||
        meters === null ||
        !isFinite(meters)
    ) {

        return "–";

    }


    if (
        meters < 1000
    ) {

        return (
            Math.round(meters / 10) *
            10 +
            " m"
        );

    }


    return (
        (meters / 1000)
            .toFixed(1)
            .replace(".", ",") +
        " km"
    );

}


/* =========================================================
   ZEIT FORMATIEREN
   ========================================================= */

function formatTime(
    seconds
) {

    if (
        !isFinite(seconds) ||
        seconds < 0
    ) {

        return "–";

    }


    const minutes =
        Math.round(
            seconds / 60
        );


    if (
        minutes < 60
    ) {

        return (
            minutes +
            " min"
        );

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    const rest =
        minutes % 60;


    if (
        rest === 0
    ) {

        return (
            hours +
            " h"
        );

    }


    return (

        hours +
        " h " +
        rest +
        " min"

    );

}


/* =========================================================
   NAVIGATION STOPPEN
   ========================================================= */

function stopNavigation() {

    navigationActive =
        false;


    arrivedAnnounced =
        false;


    lastAnnouncedStep =
        -1;


    clearRoute();


    showNavigationInfo(
        false
    );


    updateNavigationInstruction(
        ""
    );


    if (voiceEnabled) {

        window.speechSynthesis.cancel();

    }


    showToast(
        "Navigation beendet"
    );

}


/* =========================================================
   NAVIGATION FOLGEN
   ========================================================= */

function toggleNavigationFollow(
    enabled
) {

    navigationFollow =
        enabled;


    if (enabled) {

        recenterNavigation();

    }

}


/* =========================================================
   NAVIGATION ZENTRIEREN
   ========================================================= */

function recenterNavigation() {

    if (!currentPosition) {

        startGpsTracking();


        showToast(
            "GPS wird gesucht..."
        );

        return;

    }


    navigationFollow =
        true;


    const checkbox =
        document.getElementById(
            "followNavigation"
        );


    if (checkbox) {

        checkbox.checked =
            true;

    }


    map.flyTo({

        center: [

            currentPosition.lng,

            currentPosition.lat

        ],

        zoom: 17,

        speed: 1.2

    });

}


/* =========================================================
   SPRACHNAVIGATION
   ========================================================= */

function toggleVoice(
    enabled
) {

    voiceEnabled =
        enabled;


    localStorage.setItem(
        "maurVoiceNavigation",
        enabled
    );


    if (!enabled) {

        window.speechSynthesis.cancel();

        showToast(
            "Sprachansagen ausgeschaltet"
        );

    }

    else {

        showToast(
            "Sprachansagen eingeschaltet"
        );


        if (navigationActive) {

            speak(
                "Sprachansagen sind eingeschaltet."
            );

        }

    }

}


/* =========================================================
   SPRACHANSAGE
   ========================================================= */

function speak(
    text
) {

    if (
        !voiceEnabled ||
        !("speechSynthesis" in window)
    ) {

        return;

    }


    window.speechSynthesis.cancel();


    const utterance =
        new SpeechSynthesisUtterance(
            text
        );


    utterance.lang =
        "de-CH";


    utterance.rate =
        0.95;


    utterance.pitch =
        1;


    utterance.volume =
        1;


    window.speechSynthesis.speak(
        utterance
    );

}


/* =========================================================
   NAVIGATION INFO ANZEIGEN
   ========================================================= */

function showNavigationInfo(
    visible
) {

    const element =
        document.getElementById(
            "navigationInfo"
        );


    if (!element) {
        return;
    }


    if (visible) {

        element.classList.add(
            "active"
        );

    }

    else {

        element.classList.remove(
            "active"
        );

    }

}


/* =========================================================
   NAVIGATION ANWEISUNG
   ========================================================= */

function updateNavigationInstruction(
    text
) {

    const element =
        document.getElementById(
            "navigationInstruction"
        );


    if (element) {

        element.textContent =
            text || "";

    }

}


/* =========================================================
   NAVIGATION PANEL
   ========================================================= */

function openNavigationPanel() {

    openPanel(
        "navigationPanel"
    );

}


/* =========================================================
   PANEL ÖFFNEN
   ========================================================= */

function openPanel(
    id
) {

    const panel =
        document.getElementById(id);


    if (!panel) {
        return;
    }


    panel.classList.remove(
        "hidden"
    );

}


/* =========================================================
   PANEL SCHLIESSEN
   ========================================================= */

function closePanel(
    id
) {

    const panel =
        document.getElementById(id);


    if (!panel) {
        return;
    }


    panel.classList.add(
        "hidden"
    );

}


/* =========================================================
   SUCHE
   ========================================================= */

const searchInput =
    document.getElementById(
        "searchInput"
    );


if (searchInput) {

    searchInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                searchLocation();

            }

        }
    );


    searchInput.addEventListener(
        "input",
        () => {

            clearTimeout(
                searchTimeout
            );


            const value =
                searchInput.value.trim();


            if (
                value.length < 3
            ) {

                hideSearchResults();

                return;

            }


            searchTimeout =
                setTimeout(
                    () => {

                        searchLocation();

                    },
                    500
                );

        }
    );

}


/* =========================================================
   ORT SUCHEN
   ========================================================= */

async function searchLocation() {

    const input =
        document.getElementById(
            "searchInput"
        );


    if (!input) {
        return;
    }


    const query =
        input.value.trim();


    if (
        query.length < 2
    ) {

        return;

    }


    const results =
        document.getElementById(
            "searchResults"
        );


    if (results) {

        results.style.display =
            "block";

        results.innerHTML =
            "<div class='result'>🔎 Suche läuft...</div>";

    }


    try {

        const url =

            "https://nominatim.openstreetmap.org/search" +

            "?format=json" +

            "&q=" +
            encodeURIComponent(query) +

            "&limit=8" +

            "&countrycodes=ch" +

            "&addressdetails=1";


        const response =
            await fetch(url, {

                headers: {

                    "Accept":
                        "application/json"

                }

            });


        if (!response.ok) {

            throw new Error(
                "Suche fehlgeschlagen"
            );

        }


        const data =
            await response.json();


        displaySearchResults(
            data
        );

    }

    catch (error) {

        console.error(
            error
        );


        if (results) {

            results.innerHTML =
                "<div class='result'>❌ Suche fehlgeschlagen.</div>";

        }

    }

}


/* =========================================================
   SUCHERGEBNISSE
   ========================================================= */

function displaySearchResults(
    data
) {

    const results =
        document.getElementById(
            "searchResults"
        );


    if (!results) {
        return;
    }


    if (
        !data ||
        !data.length
    ) {

        results.innerHTML =
            "<div class='result'>Keine Ergebnisse gefunden.</div>";

        results.style.display =
            "block";

        return;

    }


    results.innerHTML =
        "";


    data.forEach(
        item => {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "result";


            const name =
                item.display_name ||
                "Unbekannter Ort";


            div.innerHTML =

                "<strong>" +
                escapeHtml(
                    name.split(",")[0]
                ) +
                "</strong>" +

                "<small>" +
                escapeHtml(
                    name
                ) +
                "</small>";


            div.addEventListener(
                "click",
                () => {

                    selectSearchResult(
                        item
                    );

                }
            );


            results.appendChild(
                div
            );

        }
    );


    results.style.display =
        "block";

}


/* =========================================================
   SUCHERGEBNIS AUSWÄHLEN
   ========================================================= */

function selectSearchResult(
    item
) {

    const lng =
        Number(
            item.lon
        );


    const lat =
        Number(
            item.lat
        );


    if (
        !isFinite(lng) ||
        !isFinite(lat)
    ) {

        return;

    }


    currentDestination = {

        lng: lng,

        lat: lat,

        name:
            item.display_name ||
            "Ziel"

    };


    if (destinationMarker) {

        destinationMarker.remove();

    }


    const element =
        document.createElement(
            "div"
        );


    element.className =
        "destination-marker";


    element.textContent =
        "🏁";


    destinationMarker =
        new maplibregl.Marker({
            element: element
        })
            .setLngLat([
                lng,
                lat
            ])
            .addTo(map);


    map.flyTo({

        center: [
            lng,
            lat
        ],

        zoom: 16,

        speed: 1.1

    });


    const destinationText =
        document.getElementById(
            "navigationDestination"
        );


    if (destinationText) {

        destinationText.textContent =
            currentDestination.name;

    }


    hideSearchResults();


    openNavigationPanel();


    showToast(
        "Ziel ausgewählt"
    );

}


/* =========================================================
   SUCHE SCHLIESSEN
   ========================================================= */

function hideSearchResults() {

    const results =
        document.getElementById(
            "searchResults"
        );


    if (results) {

        results.style.display =
            "none";

    }

}


/* =========================================================
   HTML SICHER MACHEN
   ========================================================= */

function escapeHtml(
    text
) {

    return String(text)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   EIGENE PUNKTE
   ========================================================= */

function loadOwnPoints() {

    try {

        const saved =
            localStorage.getItem(
                "maurOwnPoints"
            );


        if (saved) {

            ownPoints =
                JSON.parse(
                    saved
                );

        }

    }

    catch (error) {

        ownPoints = [];

    }


    ownPoints.forEach(
        point => {

            createOwnPointMarker(
                point
            );

        }
    );

}


/* =========================================================
   EIGENEN PUNKT SPEICHERN
   ========================================================= */

function addOwnPoint() {

    startGpsTracking();


    if (!currentPosition) {

        showToast(
            "GPS wird gesucht..."
        );

        return;

    }


    const name =
        prompt(
            "Name für den Punkt:"
        );


    if (!name) {
        return;
    }


    const point = {

        id:
            Date.now(),

        name:
            name,

        lng:
            currentPosition.lng,

        lat:
            currentPosition.lat

    };


    ownPoints.push(
        point
    );


    saveOwnPoints();


    createOwnPointMarker(
        point
    );


    updateOwnPointsList();


    showToast(
        "Punkt gespeichert"
    );

}


/* =========================================================
   EIGENEN PUNKT MARKER
   ========================================================= */

function createOwnPointMarker(
    point
) {

    const element =
        document.createElement(
            "div"
        );


    element.style.width =
        "28px";


    element.style.height =
        "28px";


    element.style.borderRadius =
        "50%";


    element.style.background =
        "#111827";


    element.style.border =
        "3px solid white";


    element.style.display =
        "flex";


    element.style.alignItems =
        "center";


    element.style.justifyContent =
        "center";


    element.style.color =
        "white";


    element.style.fontSize =
        "13px";


    element.style.boxShadow =
        "0 2px 8px rgba(0,0,0,.4)";


    element.textContent =
        "📌";


    const marker =
        new maplibregl.Marker({
            element: element
        })
            .setLngLat([

                point.lng,

                point.lat

            ])
            .setPopup(

                new maplibregl.Popup({
                    offset: 20
                }).setText(
                    point.name
                )

            )
            .addTo(map);


    point._marker =
        marker;

}


/* =========================================================
   EIGENE PUNKTE SPEICHERN
   ========================================================= */

function saveOwnPoints() {

    const clean =
        ownPoints.map(
            point => ({

                id:
                    point.id,

                name:
                    point.name,

                lng:
                    point.lng,

                lat:
                    point.lat

            })
        );


    localStorage.setItem(

        "maurOwnPoints",

        JSON.stringify(
            clean
        )

    );

}


/* =========================================================
   EIGENE PUNKTE LISTE
   ========================================================= */

function updateOwnPointsList() {

    const list =
        document.getElementById(
            "ownPointsList"
        );


    if (!list) {
        return;
    }


    if (!ownPoints.length) {

        list.innerHTML =
            "<p>Noch keine eigenen Punkte gespeichert.</p>";

        return;

    }


    list.innerHTML =
        "";


    ownPoints.forEach(
        point => {

            const div =
                document.createElement(
                    "div"
                );


            div.style.padding =
                "10px 0";


            div.style.borderBottom =
                "1px solid #eee";


            div.innerHTML =

                "<strong>" +
                escapeHtml(
                    point.name
                ) +
                "</strong>" +

                "<br>" +

                "<small>" +

                point.lat.toFixed(5) +

                ", " +

                point.lng.toFixed(5) +

                "</small>";


            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "mainButton";


            button.textContent =
                "🧭 Navigation hierhin";


            button.addEventListener(
                "click",
                () => {

                    currentDestination = {

                        lng:
                            point.lng,

                        lat:
                            point.lat,

                        name:
                            point.name

                    };


                    if (destinationMarker) {

                        destinationMarker.remove();

                    }


                    const element =
                        document.createElement(
                            "div"
                        );


                    element.className =
                        "destination-marker";


                    element.textContent =
                        "🏁";


                    destinationMarker =
                        new maplibregl.Marker({
                            element: element
                        })
                            .setLngLat([

                                point.lng,

                                point.lat

                            ])
                            .addTo(map);


                    const destinationText =
                        document.getElementById(
                            "navigationDestination"
                        );


                    if (destinationText) {

                        destinationText.textContent =
                            point.name;

                    }


                    openNavigationPanel();

                }
            );


            div.appendChild(
                button
            );


            list.appendChild(
                div
            );

        }
    );

}


/* =========================================================
   GPS / NAVIGATION INTERFACE
   ========================================================= */

function updateGpsInterface() {

    if (!currentPosition) {
        return;
    }


    const accuracy =
        document.getElementById(
            "gpsAccuracy"
        );


    if (accuracy) {

        accuracy.textContent =
            Math.round(
                currentPosition.accuracy
            ) +
            " m";

    }


    updateGpsStatus(

        navigationActive

            ? "Navigation aktiv – GPS " +
              Math.round(
                  currentPosition.accuracy
              ) +
              " m"

            : "GPS aktiv – Genauigkeit " +
              Math.round(
                  currentPosition.accuracy
              ) +
              " m"

    );

}


/* =========================================================
   GPS STATUS
   ========================================================= */

function updateGpsStatus(
    text
) {

    const element =
        document.getElementById(
            "gpsStatus"
        );


    if (element) {

        element.textContent =
            text;

    }

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
    text
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {
        return;
    }


    toast.textContent =
        text;


    toast.style.display =
        "block";


    clearTimeout(
        showToast.timeout
    );


    showToast.timeout =
        setTimeout(
            () => {

                toast.style.display =
                    "none";

            },
            3000
        );

}


/* =========================================================
   ONLINE / OFFLINE
   ========================================================= */

function updateConnectionStatus() {

    const element =
        document.getElementById(
            "connectionStatus"
        );


    if (!element) {
        return;
    }


    if (navigator.onLine) {

        element.textContent =
            "Online";

    }

    else {

        element.textContent =
            "Offline";

    }

}


window.addEventListener(
    "online",
    updateConnectionStatus
);


window.addEventListener(
    "offline",
    updateConnectionStatus
);


updateConnectionStatus();


/* =========================================================
   SERVICE WORKER
   ========================================================= */

function registerServiceWorker() {

    if (
        !("serviceWorker" in navigator)
    ) {

        return;

    }


    navigator.serviceWorker
        .register("./sw.js")

        .then(
            registration => {

                console.log(
                    "Service Worker aktiv:",
                    registration.scope
                );

            }
        )

        .catch(
            error => {

                console.warn(
                    "Service Worker Fehler:",
                    error
                );

            }
        );

}


/* =========================================================
   GESPEICHERTE NAVIGATIONSEINSTELLUNGEN
   ========================================================= */

function loadNavigationSettings() {

    const savedVoice =
        localStorage.getItem(
            "maurVoiceNavigation"
        );


    if (
        savedVoice !== null
    ) {

        voiceEnabled =
            savedVoice === "true";

    }


    const checkbox =
        document.getElementById(
            "voiceNavigation"
        );


    if (checkbox) {

        checkbox.checked =
            voiceEnabled;

    }

}


loadNavigationSettings();


/* =========================================================
   KLICK AUF KARTE
   ========================================================= */

map.on(
    "click",
    event => {

        /*
           Kein automatisches Ziel setzen,
           damit normale Kartenbedienung
           weiterhin funktioniert.
        */

        if (
            navigationActive
        ) {

            return;

        }

    }
);


/* =========================================================
   DOPPELKLICK NICHT ALS ZIEL
   ========================================================= */

map.doubleClickZoom.enable();


/* =========================================================
   ESC = PANELS SCHLIESSEN
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Escape"
        ) {

            return;

        }


        document
            .querySelectorAll(
                ".panel"
            )
            .forEach(
                panel => {

                    panel.classList.add(
                        "hidden"
                    );

                }
            );


        hideSearchResults();

    }
);


/* =========================================================
   APP START
   ========================================================= */

console.log(
    "Maur Strassendienst App gestartet."
);
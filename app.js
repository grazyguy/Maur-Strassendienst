/* =========================================================
   MAUR STRASSENDIENST
   KOMPLETTER APP.JS
   ========================================================= */


/* =========================================================
   EINSTELLUNGEN
   ========================================================= */

const PMTILES_URL = "./maur.pmtiles";

const DEFAULT_CENTER = [8.667, 47.337];

const DEFAULT_ZOOM = 13;

const OSRM_URL =
    "https://router.project-osrm.org/route/v1/driving/";

const ORTSCHAFTEN = [
    "FORCH",
    "AESCH",
    "BINZ",
    "MAUR",
    "UESSIKON"
];


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
   PMTILES
   ========================================================= */

const protocol =
    new pmtiles.Protocol({
        metadata: true
    });

maplibregl.addProtocol(
    "pmtiles",
    protocol.tile
);


/* =========================================================
   KARTE
   ========================================================= */

map = new maplibregl.Map({

    container: "map",

    center: DEFAULT_CENTER,

    zoom: DEFAULT_ZOOM,

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
   KARTE GELADEN
   ========================================================= */

map.on("load", async () => {

    console.log(
        "Maur Strassendienst gestartet"
    );


    createNavigationLayers();

    createOrtschaftsgrenzenLayers();

    await loadOrtschaftsgrenzen();

    loadMapSettings();

    loadNavigationSettings();

    loadOwnPoints();

    updateOwnPointsList();

    updateConnectionStatus();

    registerServiceWorker();

});


/* =========================================================
   NAVIGATION LAYER
   ========================================================= */

function createNavigationLayers() {

    if (!map.getSource(
        "navigation-route"
    )) {

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

                "line-opacity": 1

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

                    type:
                        "FeatureCollection",

                    features: []

                }

            }

        );

    }


    /* FÄRBUNG INNERHALB */

    if (!map.getLayer(
        "ortsgrenzen-fill"
    )) {

        map.addLayer({

            id:
                "ortsgrenzen-fill",

            type:
                "fill",

            source:
                "ortsgrenzen-source",

            paint: {

                "fill-color":
                    "#ef4444",

                "fill-opacity":
                    0.025

            }

        });

    }


    /* ROTE GRENZE */

    if (!map.getLayer(
        "ortsgrenzen-line"
    )) {

        map.addLayer({

            id:
                "ortsgrenzen-line",

            type:
                "line",

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


    /* NAMEN */

    if (!map.getLayer(
        "ortsgrenzen-labels"
    )) {

        map.addLayer({

            id:
                "ortsgrenzen-labels",

            type:
                "symbol",

            source:
                "ortsgrenzen-source",

            layout: {

                "text-field": [

                    "coalesce",

                    [
                        "get",
                        "ortschaftsname"
                    ],

                    [
                        "get",
                        "ORTSCHAFTSNAME"
                    ],

                    [
                        "get",
                        "Ortschaftsname"
                    ],

                    [
                        "get",
                        "name"
                    ],

                    [
                        "get",
                        "NAME"
                    ],

                    ""

                ],

                "text-size": [

                    "interpolate",

                    ["linear"],

                    ["zoom"],

                    10,
                    11,

                    13,
                    15,

                    16,
                    20

                ],

                "text-font": [
                    "Open Sans Bold"
                ],

                "text-letter-spacing":
                    0.05,

                "text-allow-overlap":
                    false,

                "text-ignore-placement":
                    false

            },

            paint: {

                "text-color":
                    "#b91c1c",

                "text-halo-color":
                    "#ffffff",

                "text-halo-width":
                    2.5

            }

        });

    }

}


/* =========================================================
   ORTSCHAFTSGRENZEN LADEN
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
                encodeURIComponent(
                    typeName
                ) +

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
                "Grenzen konnten nicht geladen werden:",
                error
            );

        }

    }


    if (!data) {

        console.warn(
            "Keine Ortschaftsgrenzen verfügbar."
        );

        return;

    }


    const features =
        data.features.filter(
            feature => {

                const p =
                    feature.properties ||
                    {};


                const name =

                    p.ortschaftsname ||

                    p.ORTSCHAFTSNAME ||

                    p.Ortschaftsname ||

                    p.name ||

                    p.NAME ||

                    "";


                return ORTSCHAFTEN.includes(

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
                features

        });

    }


    console.log(
        "Ortschaften geladen:",
        features.length
    );


    updateOrtschaftsgrenzenVisibility();

}


/* =========================================================
   ORTSCHAFTSGRENZEN SICHTBARKEIT
   ========================================================= */

function toggleOrtsgrenzen(
    visible
) {

    localStorage.setItem(

        "maurOrtsgrenzen",

        visible

    );


    updateOrtschaftsgrenzenVisibility();

}


function updateOrtschaftsgrenzenVisibility() {

    const visible =
        localStorage.getItem(
            "maurOrtsgrenzen"
        ) !== "false";


    const visibility =
        visible
            ? "visible"
            : "none";


    [

        "ortsgrenzen-fill",

        "ortsgrenzen-line",

        "ortsgrenzen-labels"

    ].forEach(
        layerId => {

            if (
                map.getLayer(layerId)
            ) {

                map.setLayoutProperty(

                    layerId,

                    "visibility",

                    visibility

                );

            }

        }
    );


    const checkbox =
        document.getElementById(
            "ortsgrenzen"
        );


    if (checkbox) {

        checkbox.checked =
            visible;

    }

}


/* =========================================================
   KARTENANSICHT
   ========================================================= */

function changeView(
    view
) {

    localStorage.setItem(
        "maurMapView",
        view
    );


    if (!map) {
        return;
    }


    const satelliteVisible =
        view !== "normal";


    if (
        map.getLayer("satellite")
    ) {

        map.setLayoutProperty(

            "satellite",

            "visibility",

            satelliteVisible
                ? "visible"
                : "none"

        );

    }


    const normalLayers = [

        "background",

        "land",

        "water",

        "water-lines",

        "buildings"

    ];


    normalLayers.forEach(
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

            "visible"

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

            "visible"

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

    if (
        !map ||
        !map.getLayer(layerId)
    ) {

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

        "layer_" +
        layerId,

        visible

    );

}


/* =========================================================
   MAP SETTINGS LADEN
   ========================================================= */

function loadMapSettings() {

    const view =
        localStorage.getItem(
            "maurMapView"
        ) ||
        "normal";


    changeView(view);


    const settings = [

        {
            layer:
                "buildings",

            checkbox:
                "buildings"
        },

        {
            layer:
                "roads",

            checkbox:
                "roads"
        },

        {
            layer:
                "street-labels",

            checkbox:
                "streetLabels"
        }

    ];


    settings.forEach(
        setting => {

            const saved =
                localStorage.getItem(

                    "layer_" +
                    setting.layer

                );


            if (
                saved === null
            ) {

                return;

            }


            const visible =
                saved === "true";


            toggleLayer(

                setting.layer,

                visible

            );


            const checkbox =
                document.getElementById(
                    setting.checkbox
                );


            if (checkbox) {

                checkbox.checked =
                    visible;

            }

        }
    );


    updateOrtschaftsgrenzenVisibility();

}


/* =========================================================
   GPS
   ========================================================= */

function startGpsTracking() {

    if (
        !navigator.geolocation
    ) {

        showToast(
            "GPS wird nicht unterstützt."
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

            handleGpsPosition,

            handleGpsError,

            {

                enableHighAccuracy:
                    true,

                maximumAge:
                    3000,

                timeout:
                    15000

            }

        );


    updateGpsStatus(
        "GPS wird gesucht..."
    );

}


/* =========================================================
   GPS POSITION
   ========================================================= */

function handleGpsPosition(
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


    if (
        navigationActive
    ) {

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

                element:
                    element

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
            "GPS-Berechtigung verweigert.";

    }


    if (
        error.code === 2
    ) {

        message =
            "GPS-Position nicht verfügbar.";

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
   NAVIGATION START
   ========================================================= */

async function startNavigation() {

    if (
        !currentDestination
    ) {

        showToast(
            "Bitte zuerst ein Ziel auswählen."
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


    navigationActive =
        true;


    navigationFollow =
        true;


    arrivedAnnounced =
        false;


    lastAnnouncedStep =
        -1;


    const follow =
        document.getElementById(
            "followNavigation"
        );


    if (follow) {

        follow.checked =
            true;

    }


    showNavigationInfo(
        true
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

        OSRM_URL +

        start.lng +
        "," +
        start.lat +

        ";" +

        destination.lng +
        "," +
        destination.lat +

        "?overview=full" +

        "&geometries=geojson" +

        "&steps=true" +

        "&alternatives=true";


    updateNavigationInstruction(
        "Route wird berechnet..."
    );


    try {

        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                "Routing nicht erreichbar"
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


        lastAnnouncedStep =
            -1;


        showRoute(
            routeCoordinates
        );


        updateNavigationStats();


        updateTurnInstruction();


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
   NAVIGATION POSITION
   ========================================================= */

function updateNavigationPosition() {

    if (
        !navigationActive ||
        !currentPosition
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


    if (
        navigationFollow
    ) {

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
   RESTDISTANZ
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


    let closestDistance =
        Infinity;


    let closestIndex =
        0;


    let closestT =
        0;


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
            closestDistance
        ) {

            closestDistance =
                projection.distance;

            closestIndex =
                i;

            closestT =
                projection.t;

        }

    }


    let remaining =
        0;


    const a =
        routeCoordinates[
            closestIndex
        ];


    const b =
        routeCoordinates[
            closestIndex + 1
        ];


    remaining +=

        haversine(

            a[1],
            a[0],

            b[1],
            b[0]

        ) *

        (1 - closestT);


    for (
        let i =
            closestIndex + 1;

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


    const scaleX =
        111320 *
        Math.cos(lat);


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

        distance:
            distance,

        t:
            t

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

        Math.sin(
            dLat / 2
        ) ** 2

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

        Math.sin(
            dLon / 2
        ) ** 2;


    return (

        2 *
        R *
        Math.atan2(

            Math.sqrt(a),

            Math.sqrt(
                1 - a
            )

        )

    );

}


/* =========================================================
   ROUTE VERLASSEN?
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


    const accuracy =
        currentPosition.accuracy ||
        10;


    const threshold =
        Math.max(
            50,
            accuracy * 1.5
        );


    if (
        closest <= threshold
    ) {

        return;

    }


    const now =
        Date.now();


    if (
        now -
        lastRerouteTime <
        10000
    ) {

        return;

    }


    lastRerouteTime =
        now;


    updateNavigationInstruction(
        "Route verlassen – neue Route wird gesucht..."
    );


    if (voiceEnabled) {

        speak(
            "Sie haben die Route verlassen. Ich berechne eine neue Route."
        );

    }


    calculateRoute();

}


/* =========================================================
   ABBIEGEANWEISUNG
   ========================================================= */

function updateTurnInstruction() {

    if (
        !routeSteps.length ||
        !currentPosition
    ) {

        return;

    }


    let bestStep =
        null;


    let bestDistance =
        Infinity;


    let bestIndex =
        -1;


    for (
        let i = 0;

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
            distance < bestDistance
        ) {

            bestDistance =
                distance;

            bestStep =
                step;

            bestIndex =
                i;

        }

    }


    if (
        !bestStep
    ) {

        return;

    }


    const instruction =
        formatInstruction(

            bestStep,

            bestDistance

        );


    updateNavigationInstruction(
        instruction
    );


    if (
        voiceEnabled &&
        bestIndex !==
        lastAnnouncedStep &&
        bestDistance < 120
    ) {

        speak(
            instruction
        );


        lastAnnouncedStep =
            bestIndex;

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
        step.maneuver ||
        {};


    const type =
        maneuver.type ||
        "";


    const modifier =
        maneuver.modifier ||
        "";


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

        let text =
            "In " +
            distanceText +
            " in den Kreisverkehr einfahren.";


        if (
            maneuver.exit
        ) {

            text +=

                " Ausfahrt " +
                maneuver.exit +
                ".";

        }


        return text;

    }


    if (
        modifier === "right"
    ) {

        return (

            "In " +
            distanceText +
            " rechts abbiegen" +

            (
                name !==
                "der Strasse"

                    ? " auf " +
                      name

                    : ""

            ) +

            "."

        );

    }


    if (
        modifier === "left"
    ) {

        return (

            "In " +
            distanceText +
            " links abbiegen" +

            (
                name !==
                "der Strasse"

                    ? " auf " +
                      name

                    : ""

            ) +

            "."

        );

    }


    if (
        modifier ===
        "slight right"
    ) {

        return (

            "In " +
            distanceText +
            " leicht rechts halten."

        );

    }


    if (
        modifier ===
        "slight left"
    ) {

        return (

            "In " +
            distanceText +
            " leicht links halten."

        );

    }


    if (
        type === "merge"
    ) {

        return (

            "In " +
            distanceText +
            " einfädeln."

        );

    }


    return (

        "In " +
        distanceText +
        " geradeaus."

    );

}


/* =========================================================
   ROUTE ANZEIGE
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

                top: 190,

                bottom: 120,

                left: 40,

                right: 40

            },

            duration: 1000

        }

    );

}


/* =========================================================
   NAVIGATION STATISTIK
   ========================================================= */

function updateNavigationStats(
    remaining
) {

    if (
        remaining === undefined
    ) {

        remaining =
            routeDistance;

    }


    const distanceElement =
        document.getElementById(
            "remainingDistance"
        );


    const timeElement =
        document.getElementById(
            "remainingTime"
        );


    if (
        distanceElement
    ) {

        distanceElement.textContent =
            formatDistance(
                remaining
            );

    }


    if (
        timeElement
    ) {

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


        timeElement.textContent =
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

            Math.round(
                meters / 10
            ) *
            10 +

            " m"

        );

    }


    return (

        (
            meters /
            1000
        )

            .toFixed(1)

            .replace(
                ".",
                ","
            )

        +

        " km"

    );

}


/* =========================================================
   ZEIT
   ========================================================= */

function formatTime(
    seconds
) {

    if (
        !isFinite(seconds)
    ) {

        return "–";

    }


    const minutes =
        Math.max(
            0,
            Math.round(
                seconds / 60
            )
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
        minutes %
        60;


    return (

        hours +
        " h " +

        (
            rest > 0
                ? rest + " min"
                : ""

        )

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


    clearRoute();


    showNavigationInfo(
        false
    );


    if (
        "speechSynthesis"
        in window
    ) {

        speechSynthesis.cancel();

    }


    updateNavigationInstruction(
        ""
    );


    showToast(
        "Navigation beendet"
    );

}


/* =========================================================
   FOLLOW
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
   ZENTRIEREN
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
   SPRACHE EIN/AUS
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

        if (
            "speechSynthesis"
            in window
        ) {

            speechSynthesis.cancel();

        }


        showToast(
            "Sprachansagen ausgeschaltet"
        );

    }

    else {

        showToast(
            "Sprachansagen eingeschaltet"
        );

    }

}


/* =========================================================
   SPRACHE
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


    speechSynthesis.cancel();


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


    speechSynthesis.speak(
        utterance
    );

}


/* =========================================================
   NAVIGATION INFO
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
   PANEL
   ========================================================= */

function openPanel(
    id
) {

    const panel =
        document.getElementById(
            id
        );


    if (!panel) {
        return;
    }


    panel.classList.remove(
        "hidden"
    );

}


function closePanel(
    id
) {

    const panel =
        document.getElementById(
            id
        );


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

                    searchLocation,

                    500

                );

        }

    );

}


/* =========================================================
   SUCHEN
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

            "<div class='result'>" +
            "🔎 Suche läuft..." +
            "</div>";

    }


    try {

        const url =

            "https://nominatim.openstreetmap.org/search" +

            "?format=json" +

            "&q=" +
            encodeURIComponent(
                query
            ) +

            "&limit=8" +

            "&countrycodes=ch" +

            "&addressdetails=1";


        const response =
            await fetch(url);


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

                "<div class='result'>" +
                "❌ Suche fehlgeschlagen." +
                "</div>";

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

            "<div class='result'>" +
            "Keine Ergebnisse gefunden." +
            "</div>";

        results.style.display =
            "block";

        return;

    }


    results.innerHTML =
        "";


    data.forEach(
        item => {

            const result =
                document.createElement(
                    "div"
                );


            result.className =
                "result";


            const fullName =
                item.display_name ||
                "Unbekannter Ort";


            result.innerHTML =

                "<strong>" +

                escapeHtml(

                    fullName
                        .split(",")[0]

                ) +

                "</strong>" +

                "<small>" +

                escapeHtml(
                    fullName
                ) +

                "</small>";


            result.addEventListener(

                "click",

                () => {

                    selectSearchResult(
                        item
                    );

                }

            );


            results.appendChild(
                result
            );

        }
    );


    results.style.display =
        "block";

}


/* =========================================================
   ZIEL AUS SUCHERGEBNIS
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

        lng:
            lng,

        lat:
            lat,

        name:
            item.display_name ||
            "Ziel"

    };


    setDestinationMarker();


    const destination =
        document.getElementById(
            "navigationDestination"
        );


    if (destination) {

        destination.textContent =
            currentDestination.name;

    }


    hideSearchResults();


    map.flyTo({

        center: [

            lng,

            lat

        ],

        zoom: 16,

        speed: 1.1

    });


    openNavigationPanel();


    showToast(
        "Ziel ausgewählt"
    );

}


/* =========================================================
   ZIEL MARKER
   ========================================================= */

function setDestinationMarker() {

    if (!currentDestination) {
        return;
    }


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

            element:
                element

        })

            .setLngLat([

                currentDestination.lng,

                currentDestination.lat

            ])

            .addTo(map);

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
   HTML SICHERN
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
   EIGENE PUNKTE LADEN
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
   EIGENER PUNKT MARKER
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


    element.style.fontSize =
        "13px";


    element.style.boxShadow =
        "0 2px 8px rgba(0,0,0,.4)";


    element.textContent =
        "📌";


    const marker =
        new maplibregl.Marker({

            element:
                element

        })

            .setLngLat([

                point.lng,

                point.lat

            ])

            .setPopup(

                new maplibregl.Popup({
                    offset: 20
                })

                    .setText(
                        point.name
                    )

            )

            .addTo(map);


    point._marker =
        marker;

}


/* =========================================================
   PUNKTE SPEICHERN
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
   PUNKTE LISTE
   ========================================================= */

function updateOwnPointsList() {

    const list =
        document.getElementById(
            "ownPointsList"
        );


    if (!list) {
        return;
    }


    if (
        !ownPoints.length
    ) {

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


            const title =
                document.createElement(
                    "strong"
                );


            title.textContent =
                point.name;


            div.appendChild(
                title
            );


            div.appendChild(
                document.createElement(
                    "br"
                )
            );


            const coordinates =
                document.createElement(
                    "small"
                );


            coordinates.textContent =

                point.lat.toFixed(5) +
                ", " +
                point.lng.toFixed(5);


            div.appendChild(
                coordinates
            );


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


                    setDestinationMarker();


                    const destination =
                        document.getElementById(
                            "navigationDestination"
                        );


                    if (destination) {

                        destination.textContent =
                            point.name;

                    }


                    map.flyTo({

                        center: [

                            point.lng,

                            point.lat

                        ],

                        zoom: 16

                    });


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
   GPS INTERFACE
   ========================================================= */

function updateGpsInterface() {

    if (!currentPosition) {
        return;
    }


    const accuracy =
        Math.round(
            currentPosition.accuracy
        );


    const gpsAccuracy =
        document.getElementById(
            "gpsAccuracy"
        );


    if (gpsAccuracy) {

        gpsAccuracy.textContent =
            accuracy +
            " m";

    }


    updateGpsStatus(

        navigationActive

            ? "Navigation aktiv – GPS " +
              accuracy +
              " m"

            : "GPS aktiv – Genauigkeit " +
              accuracy +
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


    element.textContent =
        navigator.onLine
            ? "Online"
            : "Offline";

}


window.addEventListener(
    "online",
    updateConnectionStatus
);


window.addEventListener(
    "offline",
    updateConnectionStatus
);


/* =========================================================
   NAVIGATION SETTINGS LADEN
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
   ENDE
   ========================================================= */

console.log(
    "MAUR STRASSENDIENST APP.JS VOLLSTÄNDIG GELADEN"
);
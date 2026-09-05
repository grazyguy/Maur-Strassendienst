/* =========================================================
   MAUR STRASSENDIENST – APP.JS
   ========================================================= */

/* =========================================================
   GRUNDEINSTELLUNGEN
   ========================================================= */

const PMTILES_URL = "./maur.pmtiles";

const ORTSCHAFTEN = [
    "Binz",
    "Maur",
    "Aesch",
    "Forch",
    "Uessikon"
];

const ORTSGRENZEN_SOURCE = "ortsgrenzen";
const ORTSGRENZEN_FILL = "ortsgrenzen-fill";
const ORTSGRENZEN_LINE = "ortsgrenzen-line";

let map = null;
let currentView = "normal";
let currentDestination = null;
let userMarker = null;

let ownPoints = [];
let ownPointMarkers = [];

const OWN_POINTS_KEY = "maurOwnPoints";
const MAP_VIEW_KEY = "maurMapView";


/* =========================================================
   HILFSFUNKTIONEN
   ========================================================= */

function showToast(message) {

    const toast = document.getElementById("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;
    toast.classList.remove("hidden");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
        toast.classList.add("hidden");
    }, 2500);
}


function closeAllPanels() {

    document
        .querySelectorAll(".panel")
        .forEach(panel => {

            panel.classList.add("hidden");

        });

}


function hideElement(id) {

    const element = document.getElementById(id);

    if (element) {
        element.classList.add("hidden");
    }

}


function showElement(id) {

    const element = document.getElementById(id);

    if (element) {
        element.classList.remove("hidden");
    }

}


/* =========================================================
   PMTILES
   ========================================================= */

const protocol = new pmtiles.Protocol();

maplibregl.addProtocol(
    "pmtiles",
    protocol.tile
);


/* =========================================================
   KARTE INITIALISIEREN
   ========================================================= */

async function initializeMap() {

    let center = [
        8.667,
        47.337
    ];

    let zoom = 13;

    try {

        const archive =
            new pmtiles.PMTiles(PMTILES_URL);

        protocol.add(archive);

        const header =
            await archive.getHeader();

        if (
            header &&
            Number.isFinite(header.centerLon) &&
            Number.isFinite(header.centerLat)
        ) {

            center = [
                header.centerLon,
                header.centerLat
            ];

            if (
                Number.isFinite(header.centerZoom)
            ) {

                zoom = Math.max(
                    8,
                    Math.min(
                        19,
                        header.centerZoom
                    )
                );

            }

        }

    } catch (error) {

        console.warn(
            "PMTiles konnte nicht gelesen werden:",
            error
        );

    }


    map = new maplibregl.Map({

        container: "map",

        center: center,

        zoom: zoom,

        minZoom: 8,

        maxZoom: 19,

        attributionControl: true,

        style: {

            version: 8,

            glyphs:
                "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",

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

                    maxzoom: 19

                }

            },

            layers: [

                {
                    id: "background",

                    type: "background",

                    paint: {

                        "background-color":
                            "#e8edf2"

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
                            "#e9eef2",

                        "fill-opacity": 1

                    }

                },

                {
                    id: "water",

                    type: "fill",

                    source: "maur",

                    "source-layer": "water",

                    paint: {

                        "fill-color":
                            "#9ed8f0"

                    }

                },

                {
                    id: "water-lines",

                    type: "line",

                    source: "maur",

                    "source-layer": "water-lines",

                    paint: {

                        "line-color":
                            "#6bb8dd",

                        "line-width": 1.5

                    }

                },

                {
                    id: "buildings",

                    type: "fill",

                    source: "maur",

                    "source-layer": "buildings",

                    paint: {

                        "fill-color":
                            "#d5d5d5",

                        "fill-opacity":
                            0.75

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

                            [
                                "linear"
                            ],

                            [
                                "zoom"
                            ],

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
                            [
                                "get",
                                "name"
                            ],

                        "text-size":
                            12,

                        "text-font":
                            [
                                "Noto Sans Regular"
                            ]

                    },

                    paint: {

                        "text-color":
                            "#333333",

                        "text-halo-color":
                            "#ffffff",

                        "text-halo-width":
                            1.5

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
                            [
                                "get",
                                "addr:housenumber"
                            ],

                        "text-size":
                            10

                    },

                    paint: {

                        "text-color":
                            "#555555",

                        "text-halo-color":
                            "#ffffff",

                        "text-halo-width":
                            1

                    }

                }

            ]

        }

    });


    map.addControl(
        new maplibregl.NavigationControl(),
        "top-right"
    );


    map.on(
        "load",
        async () => {

            restoreMapView();

            await loadOrtschaftsgrenzen();

            restoreOwnPoints();

            updateConnectionStatus();

        }
    );


    map.on(
        "moveend",
        saveMapView
    );


    window.addEventListener(
        "online",
        updateConnectionStatus
    );

    window.addEventListener(
        "offline",
        updateConnectionStatus
    );

}


/* =========================================================
   ORTSGRENZEN
   ========================================================= */

async function loadOrtschaftsgrenzen() {

    if (!map) {
        return;
    }


    try {

        /*
         * Offizieller WFS des Kantons Zürich.
         *
         * Der Datensatz enthält die postalischen
         * Ortschaften des Kantons Zürich.
         */

        const wfsUrl =
            "https://maps.zh.ch/wfs/OGDZHWFS" +
            "?service=WFS" +
            "&version=2.0.0" +
            "&request=GetFeature" +
            "&typeNames=av_plz_ortschaften_f" +
            "&outputFormat=application/json" +
            "&srsName=EPSG:4326";


        const response =
            await fetch(wfsUrl);


        if (!response.ok) {

            throw new Error(
                "WFS HTTP " +
                response.status
            );

        }


        const geojson =
            await response.json();


        /*
         * Nur Binz, Maur, Aesch, Forch und Uessikon
         */

        const features =
            geojson.features.filter(
                feature => {

                    const properties =
                        feature.properties || {};

                    const name =
                        properties.ortschaftsname ||
                        properties.ORTSCHAFTSNAME ||
                        properties.Ortschaftsname ||
                        properties.name ||
                        "";

                    return ORTSCHAFTEN.some(
                        ortschaft =>
                            String(name)
                                .toLowerCase()
                                ===
                                ortschaft.toLowerCase()
                    );

                }
            );


        if (features.length === 0) {

            console.warn(
                "Keine passenden Ortsgrenzen im WFS gefunden."
            );

            showToast(
                "Ortsgrenzen konnten nicht geladen werden"
            );

            return;

        }


        const filteredGeoJSON = {

            type: "FeatureCollection",

            features: features

        };


        /*
         * Falls die Ebene schon existiert,
         * zuerst entfernen.
         */

        removeOrtschaftsgrenzen();


        map.addSource(
            ORTSGRENZEN_SOURCE,
            {

                type: "geojson",

                data: filteredGeoJSON

            }
        );


        /*
         * Keine farbige Fläche.
         * Nur transparente Fläche für
         * eine saubere Geometrie.
         */

        map.addLayer({

            id: ORTSGRENZEN_FILL,

            type: "fill",

            source: ORTSGRENZEN_SOURCE,

            paint: {

                "fill-color":
                    "#ff0000",

                "fill-opacity":
                    0

            }

        });


        /*
         * ROTE LINIE
         */

        map.addLayer({

            id: ORTSGRENZEN_LINE,

            type: "line",

            source: ORTSGRENZEN_SOURCE,

            paint: {

                "line-color":
                    "#ff0000",

                "line-width": [

                    "interpolate",

                    [
                        "linear"
                    ],

                    [
                        "zoom"
                    ],

                    8,
                    2,

                    12,
                    3,

                    16,
                    4,

                    19,
                    5

                ],

                "line-opacity":
                    1

            }

        });


        /*
         * Die Ortsgrenzen sollen immer
         * über Karte, Satellit und Hybrid
         * liegen.
         */

        map.moveLayer(
            ORTSGRENZEN_LINE
        );


        map.moveLayer(
            ORTSGRENZEN_FILL
        );


        /*
         * Zustand des Schalters wiederherstellen.
         */

        const saved =
            localStorage.getItem(
                "maurOrtsgrenzen"
            );


        const visible =
            saved !== "false";


        setOrtsgrenzenVisibility(
            visible
        );


        updateOrtsgrenzenCheckbox(
            visible
        );


        console.log(
            "Ortsgrenzen geladen:",
            features.length
        );

        showToast(
            "Ortsgrenzen geladen"
        );

    } catch (error) {

        console.error(
            "Fehler beim Laden der Ortsgrenzen:",
            error
        );

        showToast(
            "Ortsgrenzen konnten nicht geladen werden"
        );

    }

}


/* =========================================================
   ORTSGRENZEN ENTFERNEN
   ========================================================= */

function removeOrtschaftsgrenzen() {

    if (!map) {
        return;
    }


    if (
        map.getLayer(
            ORTSGRENZEN_LINE
        )
    ) {

        map.removeLayer(
            ORTSGRENZEN_LINE
        );

    }


    if (
        map.getLayer(
            ORTSGRENZEN_FILL
        )
    ) {

        map.removeLayer(
            ORTSGRENZEN_FILL
        );

    }


    if (
        map.getSource(
            ORTSGRENZEN_SOURCE
        )
    ) {

        map.removeSource(
            ORTSGRENZEN_SOURCE
        );

    }

}


/* =========================================================
   ORTSGRENZEN EIN/AUS
   ========================================================= */

function setOrtsgrenzenVisibility(
    visible
) {

    if (!map) {
        return;
    }


    const visibility =
        visible
            ? "visible"
            : "none";


    if (
        map.getLayer(
            ORTSGRENZEN_LINE
        )
    ) {

        map.setLayoutProperty(
            ORTSGRENZEN_LINE,
            "visibility",
            visibility
        );

    }


    if (
        map.getLayer(
            ORTSGRENZEN_FILL
        )
    ) {

        map.setLayoutProperty(
            ORTSGRENZEN_FILL,
            "visibility",
            visibility
        );

    }


    localStorage.setItem(
        "maurOrtsgrenzen",
        visible
    );


    updateOrtsgrenzenCheckbox(
        visible
    );

}


function toggleOrtsgrenzen(
    checked
) {

    setOrtsgrenzenVisibility(
        checked
    );

}


function updateOrtsgrenzenCheckbox(
    checked
) {

    const checkbox =
        document.getElementById(
            "ortsg renzen"
        );


    const alternative =
        document.getElementById(
            "ortsgrenzen"
        );


    if (checkbox) {
        checkbox.checked = checked;
    }


    if (alternative) {
        alternative.checked = checked;
    }

}


/* =========================================================
   ANSICHT
   ========================================================= */

function changeView(view) {

    if (!map) {
        return;
    }


    currentView = view;

    localStorage.setItem(
        MAP_VIEW_KEY,
        view
    );


    const satellite =
        map.getLayer("satellite");


    const land =
        map.getLayer("land");


    const water =
        map.getLayer("water");


    const buildings =
        map.getLayer("buildings");


    const roads =
        map.getLayer("roads");


    const labels =
        map.getLayer("street-labels");


    const addresses =
        map.getLayer("addresses");


    if (view === "normal") {

        if (satellite) {

            map.setLayoutProperty(
                "satellite",
                "visibility",
                "none"
            );

        }


        if (land) {

            map.setLayoutProperty(
                "land",
                "visibility",
                "visible"
            );

        }


        if (water) {

            map.setLayoutProperty(
                "water",
                "visibility",
                "visible"
            );

        }


        if (buildings) {

            map.setLayoutProperty(
                "buildings",
                "visibility",
                "visible"
            );

        }


        if (roads) {

            map.setLayoutProperty(
                "roads",
                "visibility",
                "visible"
            );

        }


        if (labels) {

            map.setLayoutProperty(
                "street-labels",
                "visibility",
                "visible"
            );

        }


        if (addresses) {

            map.setLayoutProperty(
                "addresses",
                "visibility",
                "visible"
            );

        }

    }


    if (view === "satellite") {

        if (satellite) {

            map.setLayoutProperty(
                "satellite",
                "visibility",
                "visible"
            );

        }


        if (land) {

            map.setLayoutProperty(
                "land",
                "visibility",
                "none"
            );

        }


        if (water) {

            map.setLayoutProperty(
                "water",
                "visibility",
                "none"
            );

        }


        if (buildings) {

            map.setLayoutProperty(
                "buildings",
                "visibility",
                "none"
            );

        }


        if (roads) {

            map.setLayoutProperty(
                "roads",
                "visibility",
                "none"
            );

        }


        if (labels) {

            map.setLayoutProperty(
                "street-labels",
                "visibility",
                "none"
            );

        }


        if (addresses) {

            map.setLayoutProperty(
                "addresses",
                "visibility",
                "none"
            );

        }

    }


    if (view === "hybrid") {

        if (satellite) {

            map.setLayoutProperty(
                "satellite",
                "visibility",
                "visible"
            );

        }


        if (land) {

            map.setLayoutProperty(
                "land",
                "visibility",
                "none"
            );

        }


        if (water) {

            map.setLayoutProperty(
                "water",
                "visibility",
                "none"
            );

        }


        if (buildings) {

            map.setLayoutProperty(
                "buildings",
                "visibility",
                "none"
            );

        }


        /*
         * Strassen und Beschriftungen
         * bleiben über dem Satellitenbild.
         */

        if (roads) {

            map.setLayoutProperty(
                "roads",
                "visibility",
                "visible"
            );

        }


        if (labels) {

            map.setLayoutProperty(
                "street-labels",
                "visibility",
                "visible"
            );

        }


        if (addresses) {

            map.setLayoutProperty(
                "addresses",
                "visibility",
                "visible"
            );

        }

    }


    /*
     * Ortsgrenzen nach dem Wechsel
     * der Ansicht wieder ganz oben.
     */

    if (
        map.getLayer(
            ORTSGRENZEN_LINE
        )
    ) {

        map.moveLayer(
            ORTSGRENZEN_LINE
        );

    }

}


function restoreMapView() {

    const saved =
        localStorage.getItem(
            MAP_VIEW_KEY
        );


    if (
        saved === "normal" ||
        saved === "satellite" ||
        saved === "hybrid"
    ) {

        changeView(saved);

    } else {

        changeView("normal");

    }

}


/* =========================================================
   EBENEN
   ========================================================= */

function toggleLayer(
    layer,
    visible
) {

    if (!map) {
        return;
    }


    if (!map.getLayer(layer)) {

        /*
         * Falls eine andere Layer-ID verwendet
         * wird, versuchen wir Alternativen.
         */

        const alternatives = {

            roads: [
                "roads"
            ],

            buildings: [
                "buildings"
            ],

            land: [
                "land"
            ],

            water: [
                "water"
            ]

        };


        const list =
            alternatives[layer] || [];


        for (
            const id of list
        ) {

            if (map.getLayer(id)) {

                map.setLayoutProperty(
                    id,
                    "visibility",
                    visible
                        ? "visible"
                        : "none"
                );

            }

        }


        return;

    }


    map.setLayoutProperty(
        layer,
        "visibility",
        visible
            ? "visible"
            : "none"
    );

}


/* =========================================================
   GPS / STANDORT
   ========================================================= */

function goToLocation() {

    if (
        !navigator.geolocation
    ) {

        showToast(
            "GPS wird nicht unterstützt"
        );

        return;

    }


    showToast(
        "Standort wird gesucht..."
    );


    navigator.geolocation.getCurrentPosition(

        position => {

            const lng =
                position.coords.longitude;

            const lat =
                position.coords.latitude;


            if (!map) {
                return;
            }


            map.flyTo({

                center: [
                    lng,
                    lat
                ],

                zoom: 17,

                duration: 1200

            });


            if (userMarker) {

                userMarker.remove();

            }


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "gps-marker";


            userMarker =
                new maplibregl.Marker({
                    element
                })
                    .setLngLat([
                        lng,
                        lat
                    ])
                    .addTo(map);


            showToast(
                "Standort gefunden"
            );

        },

        error => {

            console.error(
                "GPS Fehler:",
                error
            );


            showToast(
                "Standort konnte nicht ermittelt werden"
            );

        },

        {

            enableHighAccuracy: true,

            timeout: 10000,

            maximumAge: 10000

        }

    );

}


/* =========================================================
   SUCHE
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


    if (!query) {
        return;
    }


    showToast(
        "Suche..."
    );


    try {

        const url =
            "https://nominatim.openstreetmap.org/search" +
            "?format=json" +
            "&limit=8" +
            "&countrycodes=ch" +
            "&q=" +
            encodeURIComponent(query);


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


        const results =
            await response.json();


        displaySearchResults(
            results
        );

    } catch (error) {

        console.error(
            error
        );

        showToast(
            "Fehler bei der Suche"
        );

    }

}


function displaySearchResults(
    results
) {

    const container =
        document.getElementById(
            "searchResults"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        !results ||
        results.length === 0
    ) {

        container.innerHTML =
            "<div class='result'>Keine Treffer gefunden</div>";

        container.style.display =
            "block";

        return;

    }


    results.forEach(
        result => {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "result";


            div.textContent =
                result.display_name;


            div.addEventListener(
                "click",
                () => {

                    if (map) {

                        map.flyTo({

                            center: [

                                Number(
                                    result.lon
                                ),

                                Number(
                                    result.lat
                                )

                            ],

                            zoom: 17,

                            duration: 1000

                        });

                    }


                    container.style.display =
                        "none";

                }
            );


            container.appendChild(
                div
            );

        }
    );


    container.style.display =
        "block";

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function openNavigation() {

    closeAllPanels();

    showElement(
        "navigationPanel"
    );

}


function setDestination(
    lng,
    lat,
    name
) {

    currentDestination = {

        lng: lng,

        lat: lat,

        name: name

    };

}


function useCurrentLocationAsStart() {

    if (
        !currentDestination
    ) {

        showToast(
            "Bitte zuerst ein Ziel auswählen"
        );

        return;

    }


    if (
        !navigator.geolocation
    ) {

        showToast(
            "GPS wird nicht unterstützt"
        );

        return;

    }


    navigator.geolocation.getCurrentPosition(

        position => {

            const startLat =
                position.coords.latitude;

            const startLng =
                position.coords.longitude;


            openGoogleMaps(
                startLat,
                startLng
            );

        },

        () => {

            showToast(
                "Standort konnte nicht ermittelt werden"
            );

        }

    );

}


function openGoogleMaps(
    startLat,
    startLng
) {

    if (
        !currentDestination
    ) {

        showToast(
            "Kein Ziel ausgewählt"
        );

        return;

    }


    const destination =
        currentDestination.lat +
        "," +
        currentDestination.lng;


    const origin =
        startLat +
        "," +
        startLng;


    const url =
        "https://www.google.com/maps/dir/?api=1" +
        "&origin=" +
        encodeURIComponent(origin) +
        "&destination=" +
        encodeURIComponent(destination);


    window.open(
        url,
        "_blank"
    );

}


/* =========================================================
   EIGENE PUNKTE
   ========================================================= */

function openPointPanel() {

    closeAllPanels();

    showElement(
        "pointPanel"
    );

}


function saveOwnPoint() {

    const nameInput =
        document.getElementById(
            "pointName"
        );


    if (!map) {
        return;
    }


    const center =
        map.getCenter();


    const name =
        nameInput
            ? nameInput.value.trim()
            : "Eigener Punkt";


    const point = {

        id:
            Date.now(),

        name:
            name || "Eigener Punkt",

        lng:
            center.lng,

        lat:
            center.lat

    };


    ownPoints.push(
        point
    );


    localStorage.setItem(
        OWN_POINTS_KEY,
        JSON.stringify(
            ownPoints
        )
    );


    addOwnPointMarker(
        point
    );


    if (nameInput) {
        nameInput.value = "";
    }


    showToast(
        "Punkt gespeichert"
    );

}


function addOwnPointMarker(
    point
) {

    if (!map) {
        return;
    }


    const element =
        document.createElement(
            "div"
        );


    element.className =
        "own-marker";


    element.title =
        point.name;


    const marker =
        new maplibregl.Marker({
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


    ownPointMarkers.push(
        marker
    );

}


function restoreOwnPoints() {

    try {

        const saved =
            localStorage.getItem(
                OWN_POINTS_KEY
            );


        if (!saved) {
            return;
        }


        ownPoints =
            JSON.parse(saved);


        ownPoints.forEach(
            point => {

                addOwnPointMarker(
                    point
                );

            }
        );

    } catch (error) {

        console.error(
            "Eigene Punkte konnten nicht geladen werden:",
            error
        );

        ownPoints = [];

    }

}


function toggleOwnPoints(
    visible
) {

    ownPointMarkers.forEach(
        marker => {

            const element =
                marker.getElement();


            if (element) {

                element.style.display =
                    visible
                        ? ""
                        : "none";

            }

        }
    );

}


/* =========================================================
   PANELS
   ========================================================= */

function openLayers() {

    closeAllPanels();

    showElement(
        "layersPanel"
    );

}


function openViewPanel() {

    closeAllPanels();

    showElement(
        "viewPanel"
    );

}


function closePanel(
    id
) {

    hideElement(id);

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

        element.classList.remove(
            "offline"
        );

    } else {

        element.textContent =
            "Offline";

        element.classList.add(
            "offline"
        );

    }

}


/* =========================================================
   TASTATUR – ENTER BEI SUCHE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

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

        }

    }
);


/* =========================================================
   SERVICE WORKER
   ========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register("./sw.js")

                .then(
                    registration => {

                        console.log(
                            "Service Worker aktiv"
                        );

                        registration.update();

                    }
                )

                .catch(
                    error => {

                        console.error(
                            "Service Worker Fehler:",
                            error
                        );

                    }
                );

        }
    );

}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeMap();

    }
);
// ==========================================
// MAUR STRASSENDIENST
// KOMPLETTE JAVASCRIPT-DATEI
// ==========================================

// ------------------------------------------
// 1. KARTE MAUR
// ------------------------------------------

const MAUR_CENTER = [47.337, 8.667];

const MAUR_BOUNDS = L.latLngBounds(
    [47.285, 8.595],
    [47.375, 8.735]
);


// ------------------------------------------
// 2. KARTE ERSTELLEN
// ------------------------------------------

const map = L.map("map", {
    zoomControl: true,
    minZoom: 11,
    maxZoom: 19,
    maxBounds: MAUR_BOUNDS,
    maxBoundsViscosity: 1.0
}).setView(MAUR_CENTER, 14);


// ------------------------------------------
// 3. ONLINE OSM KARTE
// ------------------------------------------

const onlineLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }
);

onlineLayer.addTo(map);


// ------------------------------------------
// 4. VARIABLEN
// ------------------------------------------

let userMarker = null;
let userAccuracy = null;
let userPosition = null;

let navigationLine = null;
let selectedDestination = null;

let searchMarkers = [];


// ------------------------------------------
// 5. GPS / MEIN STANDORT
// ------------------------------------------

function showMyLocation() {

    if (!navigator.geolocation) {

        alert(
            "GPS wird von diesem Gerät nicht unterstützt."
        );

        return;
    }


    navigator.geolocation.getCurrentPosition(

        position => {

            const lat =
                position.coords.latitude;

            const lng =
                position.coords.longitude;

            const accuracy =
                position.coords.accuracy;


            userPosition = [lat, lng];


            // Standortmarker

            if (userMarker) {

                userMarker.setLatLng(
                    userPosition
                );

            } else {

                userMarker =
                    L.marker(userPosition)
                    .addTo(map)
                    .bindPopup(
                        "📍 Mein Standort"
                    );
            }


            // Genauigkeitskreis

            if (userAccuracy) {

                userAccuracy.setLatLng(
                    userPosition
                );

                userAccuracy.setRadius(
                    accuracy
                );

            } else {

                userAccuracy =
                    L.circle(
                        userPosition,
                        {
                            radius: accuracy
                        }
                    ).addTo(map);
            }


            map.setView(
                userPosition,
                17
            );


            if (userMarker) {

                userMarker
                    .bindPopup(
                        "📍 Mein Standort<br>" +
                        "Genauigkeit: ca. " +
                        Math.round(accuracy) +
                        " m"
                    )
                    .openPopup();
            }
        },


        error => {

            console.error(error);

            alert(
                "GPS konnte nicht ermittelt werden.\n\n" +
                "Bitte erlaube Safari den Zugriff auf deinen Standort."
            );
        },


        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000
        }
    );
}


const gpsButton =
    document.getElementById("gpsButton");


if (gpsButton) {

    gpsButton.addEventListener(
        "click",
        showMyLocation
    );
}


// ------------------------------------------
// 6. ADRESS- UND STRASSENSUCHE
// ------------------------------------------

async function searchLocation() {

    const input =
        document
        .getElementById("searchInput")
        .value
        .trim();


    if (!input) {

        return;
    }


    const query =
        encodeURIComponent(
            input +
            ", Maur, Zürich, Schweiz"
        );


    const container =
        document.getElementById(
            "searchResults"
        );


    container.innerHTML =
        `
        <div class="result">
            🔎 Suche läuft...
        </div>
        `;


    container.style.display =
        "block";


    try {

        const response =
            await fetch(
                "https://nominatim.openstreetmap.org/search" +
                "?format=json" +
                "&limit=8" +
                "&countrycodes=ch" +
                "&q=" +
                query
            );


        if (!response.ok) {

            throw new Error(
                "Nominatim Fehler"
            );
        }


        const results =
            await response.json();


        displaySearchResults(
            results
        );


    } catch (error) {

        console.error(error);


        container.innerHTML =
            `
            <div class="result">
                ❌ Suche nicht möglich.<br>
                <small>
                    Bitte Internetverbindung prüfen.
                </small>
            </div>
            `;


        container.style.display =
            "block";
    }
}


// ------------------------------------------
// 7. SUCHERGEBNISSE
// ------------------------------------------

function displaySearchResults(
    results
) {

    const container =
        document.getElementById(
            "searchResults"
        );


    container.innerHTML = "";


    if (!results.length) {

        container.innerHTML =
            `
            <div class="result">
                ❌ Keine Treffer gefunden.
            </div>
            `;

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


            const title =
                result.display_name
                .split(",")[0];


            div.innerHTML =
                `
                <strong>
                    ${title}
                </strong>
                <br>
                <small>
                    ${result.display_name}
                </small>
                `;


            div.onclick = () => {

                const position = [

                    parseFloat(
                        result.lat
                    ),

                    parseFloat(
                        result.lon
                    )

                ];


                selectedDestination =
                    position;


                map.setView(
                    position,
                    18
                );


                const marker =
                    L.marker(
                        position
                    )
                    .addTo(map)
                    .bindPopup(
                        result.display_name
                    );


                marker.openPopup();


                searchMarkers.push(
                    marker
                );


                container.style.display =
                    "none";
            };


            container.appendChild(
                div
            );
        }
    );


    container.style.display =
        "block";
}


// ------------------------------------------
// 8. SUCHEN
// ------------------------------------------

const searchButton =
    document.getElementById(
        "searchButton"
    );


if (searchButton) {

    searchButton.addEventListener(
        "click",
        searchLocation
    );
}


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


// ------------------------------------------
// 9. EBENEN
// ------------------------------------------

function toggleLayers() {

    const panel =
        document.getElementById(
            "layerPanel"
        );


    if (!panel) {

        return;
    }


    panel.classList.toggle(
        "hidden"
    );
}


// ------------------------------------------
// 10. STRASSENEBENE
// ------------------------------------------

const roadsLayer =
    L.layerGroup();


// ------------------------------------------
// 11. ABFALLKÜBEL
// ------------------------------------------

const binsLayer =
    L.layerGroup();


// Beispielpunkt
// Später ersetzen wir diese durch echte
// Gemeinde-Daten.

L.marker(
    [47.3375, 8.6675]
)
.bindPopup(
    "<strong>Abfallkübel</strong><br>" +
    "Beispielpunkt"
)
.addTo(binsLayer);


// ------------------------------------------
// 12. WINTERDIENST
// ------------------------------------------

const winterLayer =
    L.layerGroup();


// Beispiel-Winterdienstpunkt

L.marker(
    [47.3355, 8.6655]
)
.bindPopup(
    "<strong>Winterdienst</strong><br>" +
    "Beispielpunkt"
)
.addTo(winterLayer);


// ------------------------------------------
// 13. SONDERPUNKTE
// ------------------------------------------

const specialLayer =
    L.layerGroup();


// Beispiel Sonderpunkt

L.marker(
    [47.339, 8.669]
)
.bindPopup(
    "<strong>Sonderpunkt</strong><br>" +
    "Strassendienst"
)
.addTo(specialLayer);


// ------------------------------------------
// 14. GEMEINDELIEGENSCHAFTEN
// ------------------------------------------

const propertiesLayer =
    L.layerGroup();


// Beispielpunkt

L.marker(
    [47.336, 8.666]
)
.bindPopup(
    "<strong>Gemeindeliegenschaft</strong>"
)
.addTo(propertiesLayer);


// ------------------------------------------
// 15. CHECKBOXEN
// ------------------------------------------

const roadsCheckbox =
    document.getElementById(
        "roadsLayer"
    );


const binsCheckbox =
    document.getElementById(
        "binsLayer"
    );


const winterCheckbox =
    document.getElementById(
        "winterLayer"
    );


const specialCheckbox =
    document.getElementById(
        "specialLayer"
    );


const propertiesCheckbox =
    document.getElementById(
        "propertiesLayer"
    );


// ------------------------------------------
// STRASSEN
// ------------------------------------------

if (roadsCheckbox) {

    roadsCheckbox.addEventListener(
        "change",
        () => {

            if (
                roadsCheckbox.checked
            ) {

                roadsLayer.addTo(
                    map
                );

            } else {

                map.removeLayer(
                    roadsLayer
                );
            }
        }
    );
}


// ------------------------------------------
// ABFALLKÜBEL
// ------------------------------------------

if (binsCheckbox) {

    binsCheckbox.addEventListener(
        "change",
        () => {

            if (
                binsCheckbox.checked
            ) {

                binsLayer.addTo(
                    map
                );

            } else {

                map.removeLayer(
                    binsLayer
                );
            }
        }
    );
}


// ------------------------------------------
// WINTERDIENST
// ------------------------------------------

if (winterCheckbox) {

    winterCheckbox.addEventListener(
        "change",
        () => {

            if (
                winterCheckbox.checked
            ) {

                winterLayer.addTo(
                    map
                );

            } else {

                map.removeLayer(
                    winterLayer
                );
            }
        }
    );
}


// ------------------------------------------
// SONDERPUNKTE
// ------------------------------------------

if (specialCheckbox) {

    specialCheckbox.addEventListener(
        "change",
        () => {

            if (
                specialCheckbox.checked
            ) {

                specialLayer.addTo(
                    map
                );

            } else {

                map.removeLayer(
                    specialLayer
                );
            }
        }
    );
}


// ------------------------------------------
// GEMEINDELIEGENSCHAFTEN
// ------------------------------------------

if (propertiesCheckbox) {

    propertiesCheckbox.addEventListener(
        "change",
        () => {

            if (
                propertiesCheckbox.checked
            ) {

                propertiesLayer.addTo(
                    map
                );

            } else {

                map.removeLayer(
                    propertiesLayer
                );
            }
        }
    );
}


// ------------------------------------------
// 16. INFO PANEL
// ------------------------------------------

function showInfo(
    title,
    content,
    position
) {

    const titleElement =
        document.getElementById(
            "infoTitle"
        );


    const contentElement =
        document.getElementById(
            "infoContent"
        );


    const panel =
        document.getElementById(
            "infoPanel"
        );


    if (!titleElement ||
        !contentElement ||
        !panel) {

        return;
    }


    titleElement.textContent =
        title;


    contentElement.innerHTML =
        content;


    panel.classList.remove(
        "hidden"
    );


    const navigateButton =
        document.getElementById(
            "navigateButton"
        );


    if (navigateButton) {

        navigateButton.onclick =
            () => {

                navigateTo(
                    position
                );
            };
    }
}


// ------------------------------------------
// 17. INFO SCHLIESSEN
// ------------------------------------------

function closeInfo() {

    const panel =
        document.getElementById(
            "infoPanel"
        );


    if (panel) {

        panel.classList.add(
            "hidden"
        );
    }
}


// ------------------------------------------
// 18. NAVIGATION STARTEN
// ------------------------------------------

function startNavigation() {

    if (!userPosition) {

        alert(
            "Zuerst deinen Standort bestimmen."
        );


        showMyLocation();


        return;
    }


    alert(
        "Tippe jetzt auf einen Punkt " +
        "auf der Karte."
    );


    map.once(
        "click",
        event => {

            const destination = [

                event.latlng.lat,

                event.latlng.lng

            ];


            navigateTo(
                destination
            );
        }
    );
}


// ------------------------------------------
// 19. ROUTING
// ------------------------------------------

async function navigateTo(
    destination
) {

    if (!userPosition) {

        alert(
            "Dein Standort ist noch nicht bekannt."
        );


        showMyLocation();


        return;
    }


    selectedDestination =
        destination;


    const start =
        userPosition[1] +
        "," +
        userPosition[0];


    const end =
        destination[1] +
        "," +
        destination[0];


    try {

        const response =
            await fetch(

                "https://router.project-osrm.org/" +
                "route/v1/driving/" +
                start +
                ";" +
                end +
                "?overview=full" +
                "&geometries=geojson"

            );


        if (!response.ok) {

            throw new Error(
                "Routing Fehler"
            );
        }


        const data =
            await response.json();


        if (
            !data.routes ||
            !data.routes.length
        ) {

            alert(
                "Keine Route gefunden."
            );


            return;
        }


        const route =
            data.routes[0];


        if (navigationLine) {

            map.removeLayer(
                navigationLine
            );
        }


        navigationLine =
            L.geoJSON(
                route.geometry
            )
            .addTo(map);


        map.fitBounds(
            navigationLine.getBounds(),
            {
                padding: [
                    30,
                    30
                ]
            }
        );


        const distance =
            (
                route.distance /
                1000
            ).toFixed(2);


        const duration =
            Math.round(
                route.duration /
                60
            );


        alert(

            "🧭 ROUTE\n\n" +

            "Distanz: " +
            distance +
            " km\n\n" +

            "Fahrzeit: ca. " +
            duration +
            " Min."

        );


    } catch (error) {

        console.error(error);


        alert(
            "❌ Navigation momentan " +
            "nicht verfügbar.\n\n" +
            "Bitte Internetverbindung prüfen."
        );
    }
}


// ------------------------------------------
// 20. EIGENEN PUNKT ERSTELLEN
// ------------------------------------------

function addPoint() {

    alert(
        "Tippe jetzt auf die Karte, " +
        "wo du einen eigenen Punkt " +
        "anlegen möchtest."
    );


    map.once(
        "click",
        event => {

            const title =
                prompt(
                    "Name des Punktes:"
                );


            if (!title) {

                return;
            }


            const description =
                prompt(
                    "Beschreibung (optional):"
                ) || "";


            const marker =
                L.marker(
                    event.latlng
                )
                .addTo(map);


            marker.bindPopup(

                "<strong>" +
                escapeHtml(title) +
                "</strong><br>" +

                "📍 Eigener Strassendienst-Punkt" +

                (
                    description
                    ?
                    "<br><br>" +
                    escapeHtml(
                        description
                    )
                    :
                    ""
                )

            );


            marker.openPopup();
        }
    );
}


// ------------------------------------------
// 21. SICHERER TEXT
// ------------------------------------------

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;
}


// ------------------------------------------
// 22. KARTE ZURÜCK NACH MAUR
// ------------------------------------------

function resetMap() {

    map.setView(
        MAUR_CENTER,
        14
    );
}


// ------------------------------------------
// 23. KARTENKLICK
// ------------------------------------------

map.on(
    "click",
    event => {

        console.log(
            "Kartenposition:",
            event.latlng.lat,
            event.latlng.lng
        );
    }
);


// ------------------------------------------
// 24. START
// ------------------------------------------

console.log(
    "================================="
);

console.log(
    "🚧 MAUR STRASSENDIENST"
);

console.log(
    "🗺️ Karte bereit"
);

console.log(
    "📍 GPS bereit"
);

console.log(
    "🔎 Adresssuche bereit"
);

console.log(
    "🧭 Navigation bereit"
);

console.log(
    "📌 Eigene Punkte bereit"
);

console.log(
    "🗂️ Kartenebenen bereit"
);

console.log(
    "================================="
);
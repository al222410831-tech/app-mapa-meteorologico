
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const weatherCard = document.getElementById("weather-card");
const statusText = document.getElementById("status");

// Inicializar el mapa
const map = L.map("map").setView([19.4326, -99.1332], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let marker = null;

// Convertir códigos meteorológicos en descripciones
function getCondition(code) {
    if (code === 0) return "Despejado ☀️";
    if ([1, 2, 3].includes(code)) return "Parcialmente nublado 🌤️";
    if ([45, 48].includes(code)) return "Niebla 🌫️";
    if ([51, 53, 55, 56, 57].includes(code)) return "Llovizna 🌦️";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return "Lluvia 🌧️";
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return "Nieve ❄️";
    }
    if ([95, 96, 99].includes(code)) return "Tormenta eléctrica ⛈️";

    return "Condición no disponible";
}

// Evitar interpretar los datos recibidos como HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Buscar la ubicación y consultar el clima
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const city = cityInput.value.trim();

    if (!city) {
        statusText.textContent = "⚠️ Escribe el nombre de una ciudad.";
        return;
    }

    searchBtn.disabled = true;
    statusText.textContent = "🔄 Consultando ubicación y clima...";
    weatherCard.innerHTML = "<p>Buscando información...</p>";

    try {
        // 1. Buscar la ciudad en OpenStreetMap
        const geoURL = new URL(
            "https://nominatim.openstreetmap.org/search"
        );

        geoURL.search = new URLSearchParams({
            format: "jsonv2",
            q: city,
            limit: "1",
            addressdetails: "1"
        });

        const geoResponse = await fetch(geoURL);

        if (!geoResponse.ok) {
            throw new Error("No se pudo consultar el servicio geográfico.");
        }

        const places = await geoResponse.json();

        if (places.length === 0) {
            weatherCard.innerHTML =
                "<p>No se encontró la ubicación. Intenta con otra ciudad.</p>";
            statusText.textContent = "No se encontraron resultados.";
            return;
        }

        const place = places[0];
        const latitude = Number(place.lat);
        const longitude = Number(place.lon);

        // 2. Consultar el clima actual en Open-Meteo
        const weatherURL = new URL(
            "https://api.open-meteo.com/v1/forecast"
        );

        weatherURL.search = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            current: [
                "temperature_2m",
                "relative_humidity_2m",
                "pressure_msl",
                "weather_code",
                "wind_speed_10m"
            ].join(","),
            timezone: "auto"
        });

        const weatherResponse = await fetch(weatherURL);

        if (!weatherResponse.ok) {
            throw new Error("No se pudo consultar el servicio meteorológico.");
        }

        const weatherData = await weatherResponse.json();
        const current = weatherData.current;

        if (!current) {
            throw new Error("El servicio no devolvió datos meteorológicos.");
        }

        // 3. Actualizar el mapa
        map.setView([latitude, longitude], 12);

        if (marker) {
            marker.setLatLng([latitude, longitude]);
        } else {
            marker = L.marker([latitude, longitude]).addTo(map);
        }

        marker.bindPopup(escapeHTML(place.display_name)).openPopup();

        // 4. Mostrar los resultados
        weatherCard.innerHTML = `
            <h2>📍 ${escapeHTML(city)}</h2>

            <p class="description">
                <strong>Ubicación:</strong>
                ${escapeHTML(place.display_name)}
            </p>

            <div class="geo-data">
                <p><strong>Latitud:</strong> ${latitude.toFixed(5)}</p>
                <p><strong>Longitud:</strong> ${longitude.toFixed(5)}</p>
            </div>

            <hr>

            <h3>🌦️ Parámetros meteorológicos actuales</h3>

            <div class="weather-grid">
                <div class="weather-item">
                    <span>🌡️ Temperatura</span>
                    <strong>${current.temperature_2m} °C</strong>
                </div>

                <div class="weather-item">
                    <span>💧 Humedad</span>
                    <strong>${current.relative_humidity_2m} %</strong>
                </div>

                <div class="weather-item">
                    <span>🌬️ Viento</span>
                    <strong>${current.wind_speed_10m} km/h</strong>
                </div>

                <div class="weather-item">
                    <span>🔵 Presión atmosférica</span>
                    <strong>${current.pressure_msl} hPa</strong>
                </div>
            </div>

            <p><strong>Condición:</strong>
                ${getCondition(current.weather_code)}
            </p>

            <p class="geo-data">
                Hora de referencia: ${escapeHTML(
                    weatherData.current.time
                )} (${escapeHTML(weatherData.timezone)})
            </p>

            <p class="success-footer">
                ✓ Información geográfica y meteorológica consultada.
            </p>
        `;

        statusText.textContent = "✅ Consulta completada correctamente.";

    } catch (error) {
        console.error(error);

        weatherCard.innerHTML = `
            <h2>⚠️ No se pudo completar la consulta</h2>
            <p>Verifica tu conexión a internet e inténtalo nuevamente.</p>
        `;

        statusText.textContent =
            "Error al comunicarse con uno de los servicios.";
    } finally {
        searchBtn.disabled = false;
    }
});

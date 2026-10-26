// 1. DOM ELEMENTS

// Landing panel
const ipAddressElement   = document.getElementById("ip-address");
const getInfoButton      = document.getElementById("get-info-btn");
const statusMessage      = document.getElementById("status-message");

// Dashboard toggle
const dashboard          = document.getElementById("dashboard");

// Info section
const dashIpElement      = document.getElementById("dash-ip");
const latitudeElement    = document.getElementById("latitude");
const longitudeElement   = document.getElementById("longitude");
const cityElement        = document.getElementById("city");
const regionElement      = document.getElementById("region");
const organisationElement= document.getElementById("organisation");
const hostnameElement    = document.getElementById("hostname");

// Map
const mapElement         = document.getElementById("map");

// More information section
const timezoneElement    = document.getElementById("timezone");
const currentTimeElement = document.getElementById("current-time");
const pincodeElement     = document.getElementById("pincode");
const postOfficeCount    = document.getElementById("post-office-count");

// Hidden compatibility elements (kept so no null errors if referenced)
const currentDateElement = document.getElementById("current-date");

// Post offices section
const searchInput        = document.getElementById("search-input");
const postOfficeStatus   = document.getElementById("post-office-status");
const postOfficeList     = document.getElementById("post-office-list");

// 2. GLOBAL VARIABLES
let userIp        = "";
let userTimezone  = "";
let allPostOffices= [];
let clockInterval = null;

// 3. GET USER'S PUBLIC IP ADDRESS
async function getUserIP() {
    ipAddressElement.textContent = "Loading...";
    try {
        const response = await fetch("https://api.ipify.org?format=json");
        if (!response.ok) throw new Error("Unable to retrieve IP address.");

        const data = await response.json();
        if (!data.ip) throw new Error("IP address was not returned.");

        userIp = data.ip;
        ipAddressElement.textContent = userIp;

    } catch (error) {
        console.error("IP address error:", error);
        ipAddressElement.textContent = "Unavailable";
        statusMessage.textContent = "Could not retrieve your IP address. Please try again.";
        statusMessage.className = "error";
    }
}

// 4. FETCH USER INFORMATION
async function getUserInformation() {
    if (getInfoButton.disabled) return;

    getInfoButton.disabled = true;
    getInfoButton.textContent = "Loading...";
    statusMessage.textContent = "Fetching your location information...";
    statusMessage.className = "";

    try {
        // Ensure we have an IP
        if (!userIp) {
            const ipResponse = await fetch("https://api.ipify.org?format=json");
            if (!ipResponse.ok) throw new Error("Unable to retrieve IP address.");
            const ipData = await ipResponse.json();
            if (!ipData.ip) throw new Error("IP address was not returned.");
            userIp = ipData.ip;
            ipAddressElement.textContent = userIp;
        }

        // Fetch geolocation from ipinfo.io (no token needed for basic geo fields)
        const response = await fetch(
            `https://ipinfo.io/${encodeURIComponent(userIp)}/geo`
        );
        if (!response.ok) throw new Error("Unable to fetch location information.");

        const data = await response.json();

        if (data.error) {
            throw new Error(data.reason || "The Location API returned an error.");
        }

        // ipinfo.io returns loc as "lat,lng"
        let latitude  = null;
        let longitude = null;

        if (data.loc && data.loc.includes(",")) {
            const parts = data.loc.split(",");
            latitude  = parseFloat(parts[0]);
            longitude = parseFloat(parts[1]);
        }

        if (latitude == null || longitude == null || isNaN(latitude) || isNaN(longitude)) {
            throw new Error("Location coordinates are unavailable.");
        }

        // Reveal dashboard
        dashboard.hidden = false;

        // Populate info section
        dashIpElement.textContent       = userIp;
        latitudeElement.textContent     = latitude;
        longitudeElement.textContent    = longitude;
        cityElement.textContent         = data.city     || "--";
        regionElement.textContent       = data.region   || "--";
        organisationElement.textContent = data.org      || "--";
        hostnameElement.textContent     = data.hostname || "--";

        // Update map
        displayMap(latitude, longitude);

        // Timezone & clock
        userTimezone = data.timezone || "";

        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }

        if (userTimezone) {
            updateLocalTime();
            clockInterval = setInterval(updateLocalTime, 1000);
        } else {
            currentTimeElement.textContent = "Timezone unavailable";
        }

        // Pincode
        const pincode = data.postal || "";
        pincodeElement.textContent = pincode || "--";
        timezoneElement.textContent = userTimezone || "--";

        // Post offices
        if (pincode) {
            await getPostOffices(pincode);
        } else {
            allPostOffices = [];
            postOfficeList.replaceChildren();
            searchInput.disabled = true;
            postOfficeStatus.textContent =
                "A postal code could not be determined from your IP address.";
            postOfficeCount.textContent = "0 post office(s) found.";
        }

        statusMessage.textContent = "Information retrieved successfully!";
        statusMessage.className = "success";

    } catch (error) {
        console.error("Error fetching user information:", error);
        statusMessage.textContent = error.message || "Something went wrong. Please try again.";
        statusMessage.className = "error";

    } finally {
        getInfoButton.disabled = false;
        getInfoButton.textContent = "Get Started";
    }
}

// 5. DISPLAY GOOGLE MAP
function displayMap(latitude, longitude) {
    mapElement.src =
        `https://maps.google.com/maps?q=${latitude},${longitude}&z=13&output=embed`;
}

// 6. UPDATE LOCAL TIME (called every second)
function updateLocalTime() {
    if (!userTimezone) return;

    try {
        const now = new Date();

        const timeStr = new Intl.DateTimeFormat("en-US", {
            timeZone: userTimezone,
            hour:     "2-digit",
            minute:   "2-digit",
            second:   "2-digit",
            hour12:   true
        }).format(now);

        const dateStr = new Intl.DateTimeFormat("en-US", {
            timeZone: userTimezone,
            weekday:  "long",
            year:     "numeric",
            month:    "long",
            day:      "numeric"
        }).format(now);

        // Show combined date + time in the single "Date And Time" field
        currentTimeElement.textContent = `${dateStr}, ${timeStr}`;

        // Keep hidden element in sync for compatibility
        if (currentDateElement) currentDateElement.textContent = dateStr;

    } catch (error) {
        console.error("Timezone error:", error);
        currentTimeElement.textContent = "Unable to display time";
    }
}

// 7. FETCH POST OFFICES
async function getPostOffices(pincode) {
    postOfficeList.replaceChildren();
    allPostOffices = [];
    searchInput.value = "";
    searchInput.disabled = true;
    postOfficeStatus.textContent = "Loading post offices...";
    postOfficeStatus.className = "";
    postOfficeCount.textContent = "Loading...";

    try {
        const response = await fetch(
            `https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`
        );
        if (!response.ok) throw new Error("Unable to fetch post office information.");

        const data = await response.json();

        if (
            !Array.isArray(data) ||
            !data[0] ||
            data[0].Status !== "Success" ||
            !Array.isArray(data[0].PostOffice)
        ) {
            const msg = data?.[0]?.Message || "No post offices found.";
            postOfficeStatus.textContent = msg;
            postOfficeStatus.className = "error";
            postOfficeCount.textContent = "0 post office(s) found.";
            return;
        }

        allPostOffices = data[0].PostOffice;

        if (allPostOffices.length === 0) {
            postOfficeStatus.textContent = "No post offices found for this pincode.";
            postOfficeCount.textContent = "0 post office(s) found.";
            return;
        }

        postOfficeCount.textContent =
            `Number of pincode(s) found: ${allPostOffices.length}`;

        searchInput.disabled = false;
        displayPostOffices(allPostOffices);

    } catch (error) {
        console.error("Post office API error:", error);
        postOfficeStatus.textContent = "Unable to load post offices. Please try again.";
        postOfficeStatus.className = "error";
        postOfficeCount.textContent = "--";
    }
}

// 8. RENDER POST OFFICE CARDS
function displayPostOffices(postOffices) {
    postOfficeList.replaceChildren();

    if (postOffices.length === 0) {
        postOfficeStatus.textContent = "No matching post offices found.";
        postOfficeStatus.className = "";
        return;
    }

    postOfficeStatus.textContent = `Showing ${postOffices.length} post office(s).`;
    postOfficeStatus.className = "success";

    postOffices.forEach((office) => {
        const card = document.createElement("div");
        card.className = "post-office";

        const heading = document.createElement("h3");
        heading.textContent = office.Name || "Unknown Post Office";
        card.appendChild(heading);

        const fields = [
            ["Branch Type",      office.BranchType],
            ["Delivery Status",  office.DeliveryStatus],
            ["District",         office.District],
            ["Division",         office.Division]
        ];

        fields.forEach(([label, value]) => {
            const p      = document.createElement("p");
            const strong = document.createElement("strong");
            strong.textContent = `${label}: `;
            p.appendChild(strong);
            p.appendChild(document.createTextNode(value || "Not available"));
            card.appendChild(p);
        });

        postOfficeList.appendChild(card);
    });
}

// 9. SEARCH HANDLER
function searchPostOffices() {
    const query = searchInput.value.trim().toLowerCase();

    const filtered = allPostOffices.filter((office) => {
        const name   = (office.Name       || "").toLowerCase();
        const branch = (office.BranchType || "").toLowerCase();
        return name.includes(query) || branch.includes(query);
    });

    displayPostOffices(filtered);
}

// 10. EVENT LISTENERS
getInfoButton.addEventListener("click", getUserInformation);
searchInput.addEventListener("input", searchPostOffices);

// 11. INIT
getUserIP();

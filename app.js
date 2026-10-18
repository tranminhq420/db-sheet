const form = document.querySelector("#lookup-form");
const keyInput = document.querySelector("#key");
const submitButton = document.querySelector("#submit-button");
const statusMessage = document.querySelector("#status");
const result = document.querySelector("#result");
const picture = document.querySelector("#picture");
const pictureLink = document.querySelector("#picture-link");

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add("error");
}

function getLookupConfig() {
  const config = window.SHEET_LOOKUP_CONFIG;
  if (
    !config ||
    !config.apiKey ||
    config.apiKey === "YOUR_RESTRICTED_GOOGLE_SHEETS_API_KEY" ||
    !config.spreadsheetId ||
    config.spreadsheetId === "YOUR_PUBLIC_SPREADSHEET_ID"
  ) {
    throw new Error("Set your Sheets API key and spreadsheet ID in config.js.");
  }
  return config;
}

function isWebUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function getImageDisplayUrl(value) {
  const url = new URL(value);
  if (url.hostname === "drive.google.com") {
    const fileId = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
    if (fileId) {
      const thumbnail = new URL("https://drive.google.com/thumbnail");
      thumbnail.searchParams.set("id", fileId);
      thumbnail.searchParams.set("sz", "w1600");
      return thumbnail.href;
    }
  }
  return url.href;
}

async function findPictureUrl(key, config) {
  const worksheet = (config.worksheet || "Sheet1").replaceAll("'", "''");
  const range = encodeURIComponent(`'${worksheet}'!A:B`);
  const endpoint = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      config.spreadsheetId
    )}/values/${range}`
  );
  endpoint.searchParams.set("key", config.apiKey);

  const response = await fetch(endpoint);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? "Google Sheets access failed. Check that the sheet is public and the API key is configured correctly."
        : "The lookup could not be completed. Please try again later."
    );
  }

  const rows = Array.isArray(data.values) ? data.values : [];
  const row = rows.find(
    (cells) => Array.isArray(cells) && String(cells[0] ?? "").trim() === key
  );
  return row && row.length > 1 ? String(row[1]).trim() : null;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = true;
  statusMessage.classList.remove("error");
  statusMessage.textContent = "Searching...";
  submitButton.disabled = true;

  try {
    const config = getLookupConfig();
    const key = keyInput.value.trim();
    const imageUrl = await findPictureUrl(key, config);

    if (!imageUrl) {
      throw new Error("No picture was found for that key.");
    }
    if (!isWebUrl(imageUrl)) {
      throw new Error("The picture URL in the sheet is invalid.");
    }

    const displayUrl = getImageDisplayUrl(imageUrl);
    picture.onerror = () => {
      result.hidden = true;
      showError("The picture could not be loaded. Check its sharing settings.");
    };
    picture.src = displayUrl;
    picture.referrerPolicy = "no-referrer";
    pictureLink.href = imageUrl;
    result.hidden = false;
    statusMessage.textContent = "Picture found.";
  } catch (error) {
    showError(
      error instanceof TypeError
        ? "Could not connect to Google Sheets. Check your connection and API settings."
        : error.message
    );
  } finally {
    submitButton.disabled = false;
  }
});

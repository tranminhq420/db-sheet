const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function encodeJsonBase64Url(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodePrivateKey(pem) {
  const contents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(contents);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJsonBase64Url({ alg: "RS256", typ: "JWT" });
  const claims = encodeJsonBase64Url({
    iss: serviceAccount.client_email,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const unsignedAssertion = `${header}.${claims}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodePrivateKey(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedAssertion)
  );
  const assertion = `${unsignedAssertion}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    console.error("Google OAuth token request failed:", response.status);
    throw new Error("Google authorization failed.");
  }

  const result = await response.json();
  if (typeof result.access_token !== "string") {
    throw new Error("Google authorization returned no access token.");
  }
  return result.access_token;
}

async function findPictureUrl(key, env) {
  const spreadsheetId = env.SHEETS_SPREADSHEET_ID;
  const worksheet = env.SHEETS_WORKSHEET || "Trang tính1";
  if (!spreadsheetId || !worksheet || !env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("The Sheets Worker is not configured.");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error("The service-account secret is invalid JSON.");
  }
  if (
    serviceAccount.type !== "service_account" ||
    typeof serviceAccount.client_email !== "string" ||
    typeof serviceAccount.private_key !== "string"
  ) {
    throw new Error("The service-account secret has missing fields.");
  }

  const accessToken = await createGoogleAccessToken(serviceAccount);
  const range = `'${worksheet.replaceAll("'", "''")}'!A:B`;
  const endpoint = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}`
  );
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    console.error("Google Sheets API request failed:", response.status);
    throw new Error("Google Sheets could not complete the lookup.");
  }

  const data = await response.json();
  const rows = Array.isArray(data.values) ? data.values : [];
  const row = rows.find(
    (cells) => Array.isArray(cells) && String(cells[0] ?? "").trim() === key
  );
  return row && row.length > 1 ? String(row[1]).trim() : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/lookup") {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key || key.length > 256) {
      return jsonResponse({ error: "Enter a valid lookup key." }, 400);
    }

    try {
      const imageUrl = await findPictureUrl(key, env);
      if (!imageUrl) {
        return jsonResponse({ error: "No picture was found for that key." }, 404);
      }
      let parsedImageUrl;
      try {
        parsedImageUrl = new URL(imageUrl);
      } catch {
        return jsonResponse({ error: "The picture URL in the sheet is invalid." }, 502);
      }
      if (!["http:", "https:"].includes(parsedImageUrl.protocol)) {
        return jsonResponse({ error: "The picture URL in the sheet is invalid." }, 502);
      }
      return jsonResponse({ image_url: parsedImageUrl.href }, 200);
    } catch (error) {
      console.error("Lookup failed:", error.message);
      return jsonResponse(
        { error: "The lookup service is unavailable. Please try again later." },
        503
      );
    }
  },
};

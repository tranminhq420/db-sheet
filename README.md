# Sheet Image Lookup

A static HTML, CSS, and JavaScript app that looks up a key in Google Sheets and
displays the picture URL stored beside it. It calls the Google Sheets API
directly from the browser; no server or service-account credential is used.

## Make the sheet publicly readable

The browser-based Sheets API supports public sheet data, not service-account
credentials. Anyone who can access the app can inspect its requests and read
the sheet data, so only use this setup if the spreadsheet contents are safe to
make public.

1. Enable the Google Sheets API in the Google Cloud project.
2. In the spreadsheet's sharing settings, grant **Anyone with the link** Viewer
   access. If your organization disallows public sharing, this architecture
   cannot be used for that sheet.
3. Create a Google API key. Restrict it to the **Google Sheets API** and to
   **HTTP referrers** for your GitHub Pages domain, such as
   `https://YOUR-USERNAME.github.io/*`. The key is visible in browser code;
   restrictions limit its abuse but do not make it secret. For local testing,
   also allow `http://localhost:8000/*` (and remove that referrer afterward if
   you no longer need it).
4. Put lookup keys in column A and picture or Drive URLs in column B of the
   selected tab. The app compares keys exactly after trimming whitespace and
   returns the first matching row. Standard Google Drive file-sharing links
   are converted to image thumbnails for display; the file must be shared so
   viewers can access it.

The service-account file that may be present locally is not required by this
app and must never be published or committed.

## Run locally

1. Copy `config.example.js` to `config.js`. The provided spreadsheet ID is
   already filled in.
2. Set `apiKey` to your restricted browser API key and, if needed, change
   `worksheet` in `config.js`. The supplied spreadsheet's tab is named
   `Trang tính1`.
3. Start a static web server in this folder, for example:

   ```powershell
   Copy-Item config.example.js config.js
   py -m http.server 8000
   ```

4. Replace the API key placeholder in `config.js`, then open
   <http://localhost:8000/>.

`config.js` is ignored by Git. The browser requires HTTP rather than opening
`index.html` as a local file so its Google API request can run correctly.

## Deploy to GitHub Pages

The included GitHub Actions workflow publishes only the static app files. In
the repository settings:

1. Add the repository **secret** `SHEETS_API_KEY`.
2. The supplied spreadsheet ID is configured as the workflow default. You can
   override it with the repository variable `SHEETS_SPREADSHEET_ID`.
3. Optionally add the repository variable `SHEETS_WORKSHEET` (defaults to
   `Trang tính1`).
4. Under **Settings → Pages**, select **GitHub Actions** as the build and
   deployment source.
5. Push to the `main` branch or run the workflow manually.

The workflow writes runtime configuration into its deployment artifact; it
does not publish the service-account JSON or other project files.

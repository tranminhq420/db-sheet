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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = true;
  statusMessage.classList.remove("error");
  statusMessage.textContent = "Searching...";
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: keyInput.value.trim() }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The lookup could not be completed.");
    }
    if (!isWebUrl(data.image_url)) {
      throw new Error("The picture URL in the sheet is invalid.");
    }

    const displayUrl = getImageDisplayUrl(data.image_url);
    picture.onerror = () => {
      result.hidden = true;
      showError("The picture could not be loaded. Check its sharing settings.");
    };
    picture.src = displayUrl;
    picture.referrerPolicy = "no-referrer";
    pictureLink.href = data.image_url;
    result.hidden = false;
    statusMessage.textContent = "Picture found.";
  } catch (error) {
    showError(
      error instanceof TypeError
        ? "Could not connect to the lookup service. Please try again."
        : error.message
    );
  } finally {
    submitButton.disabled = false;
  }
});

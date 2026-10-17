
const form = document.getElementById("reportForm");
const reportsContainer = document.getElementById("reports");
const reportCount = document.getElementById("reportCount");
const statusFilter = document.getElementById("statusFilter");
const formMessage = document.getElementById("formMessage");

const STORAGE_KEY = "civicproof_reports_v1";
const statuses = ["Submitted", "Under Review", "Resolved"];

let reports = loadReports();

function loadReports() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReports() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

async function createFingerprint(issue, location, description, file) {
  if (!window.crypto?.subtle) {
    return "Fingerprint unavailable in this browser context";
  }

  try {
    const fileHash = file
      ? await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
      : null;

    const fileHashText = fileHash
      ? Array.from(new Uint8Array(fileHash))
          .map(byte => byte.toString(16).padStart(2, "0")).join("")
      : "no-evidence-file";

    const data = [
      issue,
      location,
      description,
      fileHashText
    ].join("|");

    const encoded = new TextEncoder().encode(data);
    const digest = await crypto.subtle.digest("SHA-256", encoded);

    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "Fingerprint unavailable";
  }
}

function createReportId() {
  return "CP-" + Date.now().toString(36).toUpperCase()
    + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderReports() {
  const filter = statusFilter.value;
  const filtered = reports.filter(report =>
    filter === "All" || report.status === filter
  );

  reportCount.textContent =
    `${reports.length} ${reports.length === 1 ? "report" : "reports"}`;

  if (filtered.length === 0) {
    reportsContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⌁</span>
        <h4>${reports.length ? "No matching reports" : "No reports yet"}</h4>
        <p>${reports.length
          ? "Choose another status filter to see more reports."
          : "Your submitted reports will appear here, ready to track."}</p>
      </div>`;
    return;
  }

  reportsContainer.innerHTML = filtered.map(report => {
    const badgeClass = report.status === "Resolved"
      ? "resolved"
      : report.status === "Submitted"
        ? "submitted"
        : "";

    const nextStatus = statuses[statuses.indexOf(report.status) + 1];
    const fingerprint = report.fingerprint || "Not available";

    return `
      <article class="report-card">
        <div class="report-card-top">
          <span class="report-id">${escapeHTML(report.id)}</span>
          <span class="status-badge ${badgeClass}">
            ${escapeHTML(report.status)}
          </span>
        </div>

        <h4>${escapeHTML(report.issue)}</h4>
        <div class="report-location">⌖ ${escapeHTML(report.location)}</div>
        <p class="report-description">${escapeHTML(report.description)}</p>

        <div class="report-card-bottom">
          <span class="report-date">${escapeHTML(formatDate(report.createdAt))}</span>
          <div class="report-actions">
            <button class="small-action" type="button"
              data-action="fingerprint" data-id="${escapeHTML(report.id)}">
              Evidence record
            </button>
            ${nextStatus ? `
              <button class="small-action" type="button"
                data-action="advance" data-id="${escapeHTML(report.id)}">
                Demo: ${escapeHTML(nextStatus)} →
              </button>` : ""}
          </div>
        </div>

        <div class="hash-detail" hidden>
          <strong>SHA-256 EVIDENCE FINGERPRINT</strong>
          <code>${escapeHTML(fingerprint)}</code>
          <p>This fingerprint is generated locally. It is not proof of an on-chain transaction.</p>
        </div>
      </article>`;
  }).join("");
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const issue = document.getElementById("issue").value.trim();
  const location = document.getElementById("location").value.trim();
  const description = document.getElementById("description").value.trim();
  const evidenceInput = document.getElementById("evidence");
  const file = evidenceInput.files[0] || null;

  if (!issue || !location || !description) {
    formMessage.textContent = "Please complete all required fields.";
    formMessage.classList.add("error");
    return;
  }

  if (file && !file.type.startsWith("image/")) {
    formMessage.textContent = "Please select an image file.";
    formMessage.classList.add("error");
    return;
  }

  if (file && file.size > 5 * 1024 * 1024) {
    formMessage.textContent = "Please choose an image smaller than 5 MB.";
    formMessage.classList.add("error");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Creating report…";
  formMessage.classList.remove("error");
  formMessage.textContent = "Creating your local demo record…";

  try {
    const fingerprint = await createFingerprint(
      issue, location, description, file
    );

    const report = {
      id: createReportId(),
      issue,
      location,
      description,
      status: "Submitted",
      createdAt: new Date().toISOString(),
      fingerprint
    };

    reports.unshift(report);

    if (!saveReports()) {
      reports.shift();
      formMessage.textContent =
        "Browser storage is unavailable. Please enable site storage and try again.";
      formMessage.classList.add("error");
      return;
    }

    form.reset();
    statusFilter.value = "All";
    renderReports();

    formMessage.textContent =
      "Report created successfully in this browser's demo records.";
  } catch {
    formMessage.textContent = "Could not create the report. Please try again.";
    formMessage.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Create report <span>→</span>';
  }
});

statusFilter.addEventListener("change", renderReports);

reportsContainer.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const report = reports.find(item => item.id === button.dataset.id);
  if (!report) return;

  if (button.dataset.action === "fingerprint") {
    const card = button.closest(".report-card");
    const detail = card.querySelector(".hash-detail");
    detail.hidden = !detail.hidden;
    button.textContent = detail.hidden ? "Evidence record" : "Hide evidence";
    return;
  }

  if (button.dataset.action === "advance") {
    const currentIndex = statuses.indexOf(report.status);
    if (currentIndex < 0 || currentIndex >= statuses.length - 1) return;

    const previousStatus = report.status;
    report.status = statuses[currentIndex + 1];

    if (!saveReports()) {
      report.status = previousStatus;
      formMessage.textContent = "Could not save the status update.";
      formMessage.classList.add("error");
      return;
    }

    renderReports();
    formMessage.classList.remove("error");
    formMessage.textContent =
      "Demo status updated locally. No blockchain transaction was sent.";
  }
});

renderReports();

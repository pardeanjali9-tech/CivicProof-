/*
 * CivicProof frontend.
 * 1) Deploy contracts/CivicProof.sol.
 * 2) Paste the deployed address into CONTRACT_ADDRESS below.
 * 3) Open through localhost or HTTPS, install MetaMask, and switch to Sepolia.
 *
 * Local preview mode is not blockchain storage. Do not put personal/sensitive
 * information on a public blockchain.
 */
const CONTRACT_ADDRESS = "0x8A04d844466330E6623d5E2DEB78ad9eE1494ddF"; // Example: "0xYourDeployedContractAddress"
const REQUIRED_CHAIN_ID = 11155111; // Ethereum Sepolia test network

const ABI = [
  "function reportCount() view returns (uint256)",
  "function reports(uint256) view returns (uint256 id,address reporter,string category,string location,string description,bytes32 evidenceHash,uint8 status,uint256 createdAt)",
  "function submitReport(string category,string location,string description,bytes32 evidenceHash) returns (uint256)",
  "function updateStatus(uint256 reportId,uint8 newStatus)",
  "event ReportSubmitted(uint256 indexed reportId,address indexed reporter,string category,string location,bytes32 evidenceHash,uint256 createdAt)",
  "event StatusUpdated(uint256 indexed reportId,uint8 status,address indexed updatedBy)"
];

const $ = id => document.getElementById(id);
const form = $("reportForm");
const reportsList = $("reportsList");
const formMessage = $("formMessage");
const submitBtn = $("submitBtn");
const statusFilter = $("statusFilter");
let provider = null;
let signer = null;
let contract = null;
let walletAddress = null;
let onChainReports = [];
let toastTimer;

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
}
function setMessage(message, error = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", error);
}
function shortAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[ch]);
}
function statusName(value) {
  return ["Submitted", "Under Review", "Resolved"][Number(value)] || "Unknown";
}
function statusClass(status) {
  return status === "Resolved" ? "resolved" : status === "Submitted" ? "submitted" : "";
}
function setChainUI(connected, text, detail) {
  $("chainStatus").textContent = text;
  $("chainDetail").textContent = detail;
  $("networkLabel").textContent = connected ? shortAddress(walletAddress) : "Wallet not connected";
  $("networkSub").textContent = connected ? "MetaMask wallet connected" : "Connect MetaMask to use blockchain features";
  $("networkDot").style.background = connected ? "#61dfc2" : "#e9bb68";
  $("chainDot").style.background = connected ? "#61dfc2" : "#e9bb68";
}
function getLocalReports() {
  try {
    const value = JSON.parse(localStorage.getItem("civicproof_local_reports_v1") || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveLocalReports(items) {
  try { localStorage.setItem("civicproof_local_reports_v1", JSON.stringify(items)); return true; }
  catch { return false; }
}
async function sha256Hex(bytes) {
  if (!window.crypto?.subtle) throw new Error("Secure hashing requires localhost or HTTPS in this browser.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "0x" + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function evidenceFingerprint(category, location, description, file) {
  let fileHash = "no-image";
  if (file) fileHash = await sha256Hex(await file.arrayBuffer());
  const text = new TextEncoder().encode([category, location, description, fileHash].join("|"));
  return await sha256Hex(text);
}
function contractConfigured() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);
}
async function initWallet() {
  if (!window.ethereum) {
    notify("MetaMask was not detected. Install the official MetaMask extension, then reload this page.");
    return false;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    walletAddress = await signer.getAddress();
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== REQUIRED_CHAIN_ID) {
      contract = null;
      setChainUI(true, "Wrong network", `Switch MetaMask to Sepolia (chain ID ${REQUIRED_CHAIN_ID})`);
      $("connectBtn").textContent = shortAddress(walletAddress);
      notify("Please switch MetaMask to Ethereum Sepolia test network.");
      return false;
    }

    $("connectBtn").textContent = shortAddress(walletAddress);
    if (contractConfigured()) {
      contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setChainUI(true, "Sepolia connected", "Contract configured");
      $("setupNotice").textContent = "Connected to Sepolia. Report submissions require a wallet confirmation and test ETH for gas.";
      await loadChainReports();
    } else {
      contract = null;
      setChainUI(true, "Wallet connected", "Contract address not configured");
      $("setupNotice").textContent = "MetaMask is connected, but the contract address is not configured yet. Local preview remains available.";
      renderReports();
    }
    return true;
  } catch (error) {
    console.error(error);
    notify(error?.shortMessage || error?.message || "Wallet connection was cancelled or failed.");
    return false;
  }
}
async function ensureSepolia() {
  if (!window.ethereum) throw new Error("Install MetaMask first.");
  if (!provider || !signer) throw new Error("Connect MetaMask first.");
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== REQUIRED_CHAIN_ID) {
    throw new Error("Switch MetaMask to Ethereum Sepolia before submitting.");
  }
  if (!contractConfigured() || !contract) {
    throw new Error("Contract address is not configured. Follow README.md to deploy the contract and update app.js.");
  }
}
function displayDate(secondsOrDate) {
  const date = typeof secondsOrDate === "number" ? new Date(secondsOrDate * 1000) : new Date(secondsOrDate);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString(undefined, { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function renderReports() {
  const local = getLocalReports().map(r => ({...r, source:"local"}));
  const all = [...onChainReports, ...local];
  const filter = statusFilter.value;
  const filtered = all.filter(r => filter === "All" || r.status === filter);
  const countText = `${all.length} ${all.length === 1 ? "report" : "reports"}`;
  // Update the panel's count in a compact, non-intrusive way.
  const heading = $("reports").querySelector(".panel-head h3");
  if (heading) heading.title = countText;

  if (!filtered.length) {
    reportsList.innerHTML = `<div class="empty"><div>⌁</div><b>${all.length ? "No matching reports" : "No reports yet"}</b><p>${all.length ? "Choose another status filter." : "Submit a report to start the public register."}</p></div>`;
    return;
  }
  reportsList.innerHTML = filtered.slice().reverse().map(r => {
    const isChain = r.source === "chain";
    const idText = isChain ? `ON-CHAIN #${r.id}` : r.id;
    const hash = r.evidenceHash || "";
    const hashMarkup = hash ? `<div class="hash-detail" hidden><strong>${isChain ? "ON-CHAIN EVIDENCE HASH" : "LOCAL EVIDENCE FINGERPRINT"}</strong><code>${escapeHTML(hash)}</code><p>${isChain ? "Stored in the smart contract on Sepolia." : "Stored only in this browser; not a blockchain transaction."}</p></div>` : "";
    const statusControl = isChain && r.status !== "Resolved" && walletAddress && r.reporter?.toLowerCase() === walletAddress.toLowerCase()
      ? `<button class="small-action" data-action="advance" data-id="${escapeHTML(r.id)}">Update status →</button>` : "";
    return `<article class="report-card">
      <div class="report-card-top"><span class="report-id">${escapeHTML(idText)}</span><span class="status-badge ${statusClass(r.status)}">${escapeHTML(r.status)}</span></div>
      <h4>${escapeHTML(r.category)}</h4><div class="report-location">⌖ ${escapeHTML(r.location)}</div>
      <p class="report-description">${escapeHTML(r.description)}</p>
      <div class="report-card-bottom"><span class="report-date">${escapeHTML(displayDate(r.createdAt))} · ${isChain ? "Sepolia" : "Local demo"}</span>
      <div class="report-actions">${hash ? `<button class="small-action" data-action="fingerprint" data-id="${escapeHTML(r.id)}">Evidence hash</button>` : ""}${statusControl}</div></div>
      ${hashMarkup}
    </article>`;
  }).join("");
}
async function loadChainReports() {
  if (!contract) return;
  try {
    const count = Number(await contract.reportCount());
    if (count > 150) throw new Error("Too many reports to load in one demo refresh. Use a dedicated indexed backend for larger deployments.");
    const loaded = [];
    for (let i = 1; i <= count; i++) {
      const r = await contract.reports(i);
      loaded.push({
        id: r.id.toString(),
        reporter: r.reporter,
        category: r.category,
        location: r.location,
        description: r.description,
        evidenceHash: r.evidenceHash,
        status: statusName(r.status),
        createdAt: Number(r.createdAt),
        source: "chain"
      });
    }
    onChainReports = loaded;
    renderReports();
    $("setupNotice").textContent = `Connected to the deployed contract. ${count} on-chain report(s) loaded from Sepolia.`;
  } catch (error) {
    console.error(error);
    notify("Could not load contract reports: " + (error.shortMessage || error.message || "unknown error"));
  }
}
$("connectBtn").addEventListener("click", initWallet);
$("refreshBtn").addEventListener("click", async () => {
  if (contract) await loadChainReports();
  else renderReports();
  notify(contract ? "Report list refreshed from the contract." : "Local demo reports refreshed.");
});
statusFilter.addEventListener("change", renderReports);
if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", () => location.reload());
  window.ethereum.on?.("chainChanged", () => location.reload());
}

reportsList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const report = [...onChainReports, ...getLocalReports()].find(r => String(r.id) === button.dataset.id);
  if (button.dataset.action === "fingerprint") {
    const detail = button.closest(".report-card").querySelector(".hash-detail");
    detail.hidden = !detail.hidden;
    button.textContent = detail.hidden ? "Evidence hash" : "Hide hash";
    return;
  }
  if (button.dataset.action === "advance" && report && contract) {
    try {
      await ensureSepolia();
      const newStatus = report.status === "Submitted" ? 1 : 2;
      button.disabled = true;
      button.textContent = "Confirm in wallet…";
      const tx = await contract.updateStatus(report.id, newStatus);
      setMessage("Transaction sent. Waiting for network confirmation…");
      await tx.wait();
      setMessage("Status updated on Sepolia.");
      await loadChainReports();
      notify("Status transaction confirmed.");
    } catch (error) {
      console.error(error);
      setMessage(error.shortMessage || error.message || "Status update failed.", true);
      notify(error.shortMessage || error.message || "Status update failed.");
    } finally {
      button.disabled = false;
    }
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const category = $("category").value.trim();
  const locationText = $("location").value.trim();
  const description = $("description").value.trim();
  const file = $("evidence").files[0] || null;
  const useChain = $("onChainToggle").checked;

  if (!category || !locationText || !description) return setMessage("Please complete all required fields.", true);
  if (file && !file.type.startsWith("image/")) return setMessage("Choose a valid image file.", true);
  if (file && file.size > 5 * 1024 * 1024) return setMessage("Image must be smaller than 5 MB.", true);

  submitBtn.disabled = true;
  submitBtn.textContent = "Preparing report…";
  setMessage("");
  try {
    const fingerprint = await evidenceFingerprint(category, locationText, description, file);
    if (useChain && walletAddress) {
      await ensureSepolia();
      submitBtn.textContent = "Confirm in MetaMask…";
      const tx = await contract.submitReport(category, locationText, description, fingerprint);
      setMessage("Transaction submitted. Waiting for Sepolia confirmation…");
      const receipt = await tx.wait();
      await loadChainReports();
      form.reset();
      setMessage(`Report recorded on Sepolia. Transaction: ${receipt.hash}`);
      notify("Your on-chain report is confirmed.");
    } else {
      const local = getLocalReports();
      const report = {
        id: "DEMO-" + Date.now().toString(36).toUpperCase(),
        category, location: locationText, description,
        evidenceHash: fingerprint,
        status: "Submitted",
        createdAt: new Date().toISOString()
      };
      local.push(report);
      if (!saveLocalReports(local)) throw new Error("Browser storage is unavailable. Check browser privacy settings.");
      form.reset();
      renderReports();
      setMessage("Report saved in local demo mode. No blockchain transaction was sent.");
      notify("Local demo report created.");
    }
  } catch (error) {
    console.error(error);
    const message = error?.shortMessage || error?.reason || error?.message || "Could not submit report.";
    setMessage(message, true);
    notify(message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Create report <span>→</span>';
  }
});

(async function boot() {
  renderReports();
  if (!window.isSecureContext && location.hostname !== "localhost" && location.protocol !== "file:") {
    notify("For MetaMask and secure hashing, open this app through localhost or HTTPS.");
  }
  if (!window.ethers) {
    $("setupNotice").textContent = "Ethers.js did not load. Check your internet connection and reload the page.";
    setChainUI(false, "Library unavailable", "Check internet connection");
    return;
  }
  if (contractConfigured()) {
    $("setupNotice").textContent = "Contract address configured. Connect MetaMask on Sepolia to load on-chain reports.";
    setChainUI(false, "Ready to connect", "Contract address configured");
  } else {
    setChainUI(false, "Preview mode", "Contract address not configured");
  }
})();

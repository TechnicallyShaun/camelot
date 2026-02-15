// Camelot UI — Client Application
(function () {
  "use strict";

  const API = "/api";
  let ws = null;

  // --- WebSocket ---
  function connectWebSocket() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => addLog("Connected to Camelot");
    ws.onclose = () => {
      addLog("Disconnected — reconnecting...");
      setTimeout(connectWebSocket, 2000);
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    };
  }

  function handleWsMessage(msg) {
    if (msg.type === "agent-event") {
      const e = msg.data;
      if (e.type === "stdout" || e.type === "stderr") {
        addLog(`[${e.runId.slice(0, 8)}] ${e.data.trim()}`);
      } else if (e.type === "exit") {
        addLog(`[${e.runId.slice(0, 8)}] exited (code ${e.data})`);
      }
    } else if (msg.type === "ticket-created" || msg.type === "ticket-deleted") {
      loadTickets();
    } else if (msg.type === "project-created" || msg.type === "project-deleted") {
      // Future: refresh project list
    }
  }

  // --- API calls ---
  async function apiGet(path) {
    const res = await fetch(`${API}${path}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function apiDelete(path) {
    await fetch(`${API}${path}`, { method: "DELETE" });
  }

  // --- Tickets ---
  async function loadTickets() {
    const tickets = await apiGet("/tickets");
    renderTickets(tickets);
  }

  function renderTickets(tickets) {
    const list = document.getElementById("ticket-list");
    list.innerHTML = "";
    for (const t of tickets) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="ticket-info">
          <span class="ticket-title">${escapeHtml(t.title)}</span>
          <span class="ticket-stage">${t.stage}</span>
        </div>
        <button class="ticket-delete" data-id="${t.id}" title="Delete">&times;</button>
      `;
      list.appendChild(li);
    }

    // Wire up delete buttons
    list.querySelectorAll(".ticket-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await apiDelete(`/tickets/${id}`);
        loadTickets();
      });
    });
  }

  async function addTicket() {
    const input = document.getElementById("ticket-title");
    const title = input.value.trim();
    if (!title) return;
    await apiPost("/tickets", { title });
    input.value = "";
    loadTickets();
  }

  // --- Log ---
  function addLog(text) {
    const log = document.getElementById("log-content");
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<span class="timestamp">${time}</span> ${escapeHtml(text)}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  // --- Sidebar ---
  function initSidebar() {
    document.querySelectorAll(".sidebar-item").forEach((item) => {
      item.addEventListener("click", () => {
        const page = item.dataset.page;
        if (page === "main") {
          closeModal();
        } else {
          openModal(page);
        }
        document.querySelectorAll(".sidebar-item").forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
      });
    });
  }

  // --- Modal ---
  function openModal(page) {
    const overlay = document.getElementById("modal-overlay");
    const body = document.getElementById("modal-body");

    const titles = {
      skills: "Skills",
      tools: "Tools",
      projects: "Projects",
      settings: "Settings",
    };

    body.innerHTML = `<h2 style="margin-bottom: 16px; color: var(--accent-amber)">${titles[page] || page}</h2>
      <p style="color: var(--text-secondary)">Coming soon...</p>`;

    overlay.classList.remove("hidden");
  }

  function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
    document.querySelector('.sidebar-item[data-page="main"]').classList.add("active");
    document.querySelectorAll('.sidebar-item:not([data-page="main"])').forEach((i) => i.classList.remove("active"));
  }

  // --- Utils ---
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // --- Init ---
  function init() {
    connectWebSocket();
    initSidebar();
    loadTickets();

    // Ticket add
    document.getElementById("ticket-add").addEventListener("click", addTicket);
    document.getElementById("ticket-title").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addTicket();
    });

    // Modal close
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-overlay").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Terminal + button
    document.querySelector(".tab-add").addEventListener("click", () => {
      addLog("🤖 Agent spawn not yet implemented — coming in #40");
    });

    addLog("🏰 Camelot initialized");
  }

  document.addEventListener("DOMContentLoaded", init);
})();

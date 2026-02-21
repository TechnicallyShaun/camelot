// Camelot UI — Client Application
(function () {
  "use strict";

  const API = "/api";
  let ws = null;
  let terminals = new Map(); // sessionId -> { term, element, tab }
  let activeTerminalId = null;

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
    } else if (msg.type === "terminal-created") {
      addLog(`Terminal ${msg.sessionId} created`);
    } else if (msg.type === "terminal-data") {
      handleTerminalData(msg.sessionId, msg.data);
    } else if (msg.type === "terminal-exit") {
      handleTerminalExit(msg.sessionId, msg.exitCode);
    } else if (msg.type === "terminal-error") {
      addLog(`Terminal error: ${msg.error}`);
    }
  }

  // --- Terminal Management ---
  function createTerminal() {
    const sessionId = `term-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Send create message to server
    ws.send(JSON.stringify({
      type: "terminal-create",
      sessionId: sessionId
    }));

    // Create terminal instance
    const term = new Terminal({
      theme: {
        background: '#1e293b',
        foreground: '#f8fafc',
        cursor: '#f59e0b',
        selection: '#334155',
        black: '#0f172a',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      fontWeight: 400,
      fontWeightBold: 700,
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
      bellStyle: 'none'
    });

    // Add fit addon
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    // Create terminal container
    const terminalContainer = createTerminalContainer(sessionId);
    
    // Open terminal in container
    term.open(terminalContainer);
    fitAddon.fit();

    // Handle terminal input
    term.onData((data) => {
      ws.send(JSON.stringify({
        type: "terminal-input",
        sessionId: sessionId,
        data: data
      }));
    });

    // Handle terminal resize
    term.onResize((size) => {
      ws.send(JSON.stringify({
        type: "terminal-resize",
        sessionId: sessionId,
        cols: size.cols,
        rows: size.rows
      }));
    });

    // Store terminal data
    const terminalTab = createTerminalTab(sessionId, `Terminal ${terminals.size + 1}`);
    terminals.set(sessionId, { 
      term, 
      element: terminalContainer, 
      tab: terminalTab,
      fitAddon
    });

    // Switch to new terminal
    switchToTerminal(sessionId);
    
    // Resize on window resize
    const resizeObserver = new ResizeObserver(() => {
      if (activeTerminalId === sessionId) {
        setTimeout(() => fitAddon.fit(), 10);
      }
    });
    resizeObserver.observe(terminalContainer);

    addLog(`Created terminal: ${sessionId}`);
    return sessionId;
  }

  function createTerminalContainer(sessionId) {
    const container = document.createElement('div');
    container.id = `terminal-${sessionId}`;
    container.className = 'terminal-instance';
    container.style.display = 'none';
    container.style.width = '100%';
    container.style.height = '100%';
    
    const terminalArea = document.getElementById('terminal-container');
    terminalArea.appendChild(container);
    
    return container;
  }

  function createTerminalTab(sessionId, title) {
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.textContent = title;
    tab.onclick = () => switchToTerminal(sessionId);
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeTerminal(sessionId);
    };
    tab.appendChild(closeBtn);
    
    // Insert before the + button
    const tabsContainer = document.getElementById('terminal-tabs');
    const addButton = tabsContainer.querySelector('.tab-add');
    tabsContainer.insertBefore(tab, addButton);
    
    return tab;
  }

  function switchToTerminal(sessionId) {
    // Hide all terminals
    terminals.forEach((terminal, id) => {
      terminal.element.style.display = 'none';
      terminal.tab.classList.remove('active');
    });
    
    // Show selected terminal
    const terminal = terminals.get(sessionId);
    if (terminal) {
      terminal.element.style.display = 'block';
      terminal.tab.classList.add('active');
      activeTerminalId = sessionId;
      
      // Focus and fit
      terminal.term.focus();
      setTimeout(() => terminal.fitAddon.fit(), 10);
      
      // Hide placeholder if exists
      const placeholder = document.querySelector('.terminal-placeholder');
      if (placeholder) {
        placeholder.style.display = 'none';
      }
    }
  }

  function closeTerminal(sessionId) {
    const terminal = terminals.get(sessionId);
    if (!terminal) return;
    
    // Send kill message to server
    ws.send(JSON.stringify({
      type: "terminal-kill",
      sessionId: sessionId
    }));
    
    // Remove from DOM
    terminal.tab.remove();
    terminal.element.remove();
    terminals.delete(sessionId);
    
    // Switch to another terminal or show placeholder
    if (activeTerminalId === sessionId) {
      activeTerminalId = null;
      const remainingTerminals = Array.from(terminals.keys());
      if (remainingTerminals.length > 0) {
        switchToTerminal(remainingTerminals[0]);
      } else {
        showTerminalPlaceholder();
      }
    }
    
    addLog(`Closed terminal: ${sessionId}`);
  }

  function handleTerminalData(sessionId, data) {
    const terminal = terminals.get(sessionId);
    if (terminal) {
      terminal.term.write(data);
    }
  }

  function handleTerminalExit(sessionId, exitCode) {
    const terminal = terminals.get(sessionId);
    if (terminal) {
      terminal.term.write(`\r\n\x1b[31mProcess exited with code ${exitCode}\x1b[0m\r\n`);
      addLog(`Terminal ${sessionId} process exited with code ${exitCode}`);
    }
  }

  function showTerminalPlaceholder() {
    const placeholder = document.querySelector('.terminal-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
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
      const assignedHtml = t.assignedTo
        ? `<span class="ticket-assigned">assigned: ${escapeHtml(t.assignedTo)}</span>`
        : '';
      li.innerHTML = `
        <div class="ticket-info">
          <span class="ticket-title">${escapeHtml(t.title)}</span>
          <span class="ticket-stage">${t.stage}</span>
          ${assignedHtml}
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
      if (ws && ws.readyState === WebSocket.OPEN) {
        createTerminal();
      } else {
        addLog("WebSocket not connected - cannot create terminal");
      }
    });

    addLog("🏰 Camelot initialized");
  }

  document.addEventListener("DOMContentLoaded", init);
})();

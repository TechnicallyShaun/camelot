// Camelot Application JavaScript

class CamelotApp {
  constructor() {
    this.ws = null;
    this.currentSection = 'dashboard';
    this.panels = {
      sidebar: false,
      rightPanel: false,
      bottomPanel: false
    };
    this.terminals = new Map(); // sessionId -> { terminal, session, tab }
    this.activeTerminal = null;
    this.agents = [];
    this.selectedAgent = null; // Currently selected agent for new terminals
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeWebSocket();
    this.setupTabSystem();
    this.setupModals();
    this.setupPanels();
    this.setupButtonAnimations();
    this.setupTerminal();
    this.loadInitialData();
  }
  
  // Enhanced button animations
  setupButtonAnimations() {
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Add press animation
        e.currentTarget.classList.add('pressed');
        setTimeout(() => {
          e.currentTarget.classList.remove('pressed');
        }, 150);
      });
    });
  }

  // Terminal setup
  setupTerminal() {
    const newTerminalBtn = document.getElementById('newTerminalBtn');
    const terminalSettingsBtn = document.getElementById('terminalSettingsBtn');
    const terminalLauncherBtn = document.getElementById('terminalLauncherBtn');
    
    if (newTerminalBtn) {
      newTerminalBtn.addEventListener('click', () => {
        this.createNewTerminal();
      });
    }

    if (terminalSettingsBtn) {
      terminalSettingsBtn.addEventListener('click', () => {
        this.openAgentSettings();
      });
    }

    if (terminalLauncherBtn) {
      terminalLauncherBtn.addEventListener('click', () => {
        this.launchExternalTerminal();
      });
    }

    // Load agents for agent select dropdowns and setup agent selector
    this.loadAgents();
  }

  // WebSocket connection
  initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('🏰 Connected to Camelot server');
      this.showNotification('Connected to server', 'success');
    };
    
    this.ws.onmessage = (event) => {
      console.log('📨 WebSocket message:', event.data);
      this.handleWebSocketMessage(event.data);
    };
    
    this.ws.onclose = () => {
      console.log('🔌 WebSocket connection closed');
      this.showNotification('Connection lost', 'error');
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.initializeWebSocket(), 5000);
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.showNotification('Connection error', 'error');
    };
  }

  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'ticket_update':
          this.updateTicket(message.data);
          break;
        case 'agent_status':
          this.updateAgentStatus(message.data);
          break;
        case 'log_entry':
          this.addLogEntry(message.data);
          break;
        case 'terminal-created':
          this.handleTerminalCreated(message);
          break;
        case 'terminal-data':
          this.handleTerminalData(message);
          break;
        case 'terminal-exit':
          this.handleTerminalExit(message);
          break;
        case 'terminal-error':
          this.handleTerminalError(message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      // If not JSON, treat as plain text message
      this.addLogEntry({
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        message: data
      });
    }
  }

  // Event listeners setup
  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        this.switchSection(section);
      });
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        this.togglePanel('sidebar');
      });
    }

    // Panel toggles
    const rightPanelToggle = document.getElementById('rightPanelToggle');
    if (rightPanelToggle) {
      rightPanelToggle.addEventListener('click', () => {
        this.togglePanel('rightPanel');
      });
    }

    const bottomPanelToggle = document.getElementById('bottomPanelToggle');
    if (bottomPanelToggle) {
      bottomPanelToggle.addEventListener('click', () => {
        this.togglePanel('bottomPanel');
      });
    }

    // New ticket button
    const newTicketBtn = document.getElementById('newTicketBtn');
    if (newTicketBtn) {
      newTicketBtn.addEventListener('click', () => {
        this.openModal('newTicketModal');
      });
    }

    // Terminal launcher button (if it exists)
    const terminalLauncherBtn = document.getElementById('terminalLauncherBtn');
    if (terminalLauncherBtn) {
      terminalLauncherBtn.addEventListener('click', () => {
        this.launchExternalTerminal();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // Window resize handler
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Click outside to close panels on mobile
    document.addEventListener('click', (e) => {
      this.handleOutsideClick(e);
    });
  }

  // Section switching
  switchSection(sectionName) {
    // Update navigation with animation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    const navLink = document.querySelector(`[data-section="${sectionName}"]`);
    if (navLink) {
      navLink.closest('.nav-item').classList.add('active');
    }

    // Enhanced section switching with page transitions
    const currentSection = document.querySelector('.section.active');
    const targetSection = document.getElementById(`${sectionName}-section`);
    
    if (currentSection && targetSection && currentSection !== targetSection) {
      // Add leaving animation to current section
      currentSection.classList.add('leaving');
      
      setTimeout(() => {
        currentSection.classList.remove('active', 'leaving');
        
        // Show new section with entering animation
        targetSection.classList.add('active', 'entering');
        
        setTimeout(() => {
          targetSection.classList.remove('entering');
        }, 300);
        
      }, 150);
    } else if (targetSection) {
      targetSection.classList.add('active');
    }

    // Update header with smooth transition
    this.updateHeaderAnimated(sectionName);
    this.currentSection = sectionName;

    // Load section-specific data
    this.loadSectionData(sectionName);
  }
  
  updateHeaderAnimated(sectionName) {
    const pageTitle = document.querySelector('.page-title');
    const breadcrumbActive = document.querySelector('.breadcrumb-item.active');
    
    const sectionTitles = {
      dashboard: 'Dashboard',
      tickets: 'Tickets',
      agents: 'Agents',
      terminal: 'Terminal'
    };
    
    if (pageTitle) {
      pageTitle.style.transition = 'all 0.2s ease-out';
      pageTitle.style.opacity = '0.5';
      pageTitle.style.transform = 'translateY(-5px)';
      
      setTimeout(() => {
        pageTitle.textContent = sectionTitles[sectionName] || 'Camelot';
        pageTitle.style.opacity = '1';
        pageTitle.style.transform = 'translateY(0)';
      }, 100);
    }
    
    if (breadcrumbActive) {
      breadcrumbActive.style.transition = 'all 0.2s ease-out';
      breadcrumbActive.style.opacity = '0.5';
      setTimeout(() => {
        breadcrumbActive.textContent = sectionTitles[sectionName] || 'Dashboard';
        breadcrumbActive.style.opacity = '1';
      }, 100);
    }
  }

  updateHeader(sectionName) {
    const pageTitle = document.querySelector('.page-title');
    const breadcrumbActive = document.querySelector('.breadcrumb-item.active');
    
    const sectionTitles = {
      dashboard: 'Dashboard',
      tickets: 'Tickets',
      agents: 'Agents',
      terminal: 'Terminal'
    };
    
    if (pageTitle) pageTitle.textContent = sectionTitles[sectionName] || 'Camelot';
    if (breadcrumbActive) breadcrumbActive.textContent = sectionTitles[sectionName] || 'Dashboard';
  }

  // Enhanced Panel management with smooth animations
  togglePanel(panelName) {
    const panel = document.querySelector(`.${panelName.replace('Panel', '-panel')}, .sidebar`);
    if (!panel) return;

    const isCollapsed = panel.classList.contains('collapsed');
    
    // Add animation class for smooth transition
    panel.classList.add('transitioning');
    
    if (isCollapsed) {
      panel.classList.remove('collapsed');
      this.panels[panelName] = true;
      
      // Handle right panel backdrop
      if (panelName === 'rightPanel' && window.innerWidth <= 1320) {
        this.showPanelBackdrop();
      }
    } else {
      panel.classList.add('collapsed');
      this.panels[panelName] = false;
      
      // Hide right panel backdrop
      if (panelName === 'rightPanel') {
        this.hidePanelBackdrop();
      }
    }

    // Remove transitioning class after animation
    setTimeout(() => {
      panel.classList.remove('transitioning');
    }, 300);

    // Store panel state
    localStorage.setItem('camelot-panels', JSON.stringify(this.panels));
  }
  
  showPanelBackdrop() {
    let backdrop = document.querySelector('.right-panel-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'right-panel-backdrop';
      backdrop.addEventListener('click', () => this.togglePanel('rightPanel'));
      document.body.appendChild(backdrop);
    }
    
    // Force reflow for animation
    backdrop.offsetHeight;
    backdrop.classList.add('active');
  }
  
  hidePanelBackdrop() {
    const backdrop = document.querySelector('.right-panel-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.remove(), 200);
    }
  }

  // Tab system
  setupTabSystem() {
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName, e.currentTarget.closest('.panel-header'));
      });
    });
  }

  switchTab(tabName, container) {
    // Update tab buttons with animation
    container.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const activeButton = container.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
      
      // Add button press animation
      activeButton.classList.add('pressed');
      setTimeout(() => activeButton.classList.remove('pressed'), 150);
    }

    // Enhanced tab panel switching with fade animation
    const panelContainer = container.nextElementSibling;
    const currentPanel = panelContainer.querySelector('.tab-panel.active');
    
    if (currentPanel) {
      currentPanel.style.opacity = '0';
      currentPanel.style.transform = 'translateY(10px)';
      
      setTimeout(() => {
        currentPanel.classList.remove('active');
        
        const targetPanel = panelContainer.querySelector(`#${tabName}-panel`);
        if (targetPanel) {
          targetPanel.classList.add('active');
          
          // Force reflow for smooth animation
          targetPanel.offsetHeight;
          targetPanel.style.opacity = '1';
          targetPanel.style.transform = 'translateY(0)';
        }
      }, 150);
    } else {
      const targetPanel = panelContainer.querySelector(`#${tabName}-panel`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    }
  }

  // Modal system
  setupModals() {
    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(element => {
      element.addEventListener('click', (e) => {
        if (e.target === element) {
          this.closeAllModals();
        }
      });
    });

    // Form submissions
    const ticketForm = document.getElementById('ticketForm');
    if (ticketForm) {
      ticketForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleTicketSubmission(e.target);
      });
    }

    const agentForm = document.getElementById('agentForm');
    if (agentForm) {
      agentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAgentSubmission(e.target);
      });
    }

    // Cancel buttons
    document.querySelectorAll('#cancelTicketBtn, #cancelAgentBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });

    // Add agent button
    const addAgentBtn = document.getElementById('addAgentBtn');
    if (addAgentBtn) {
      addAgentBtn.addEventListener('click', () => {
        this.openAddAgentModal();
      });
    }

    // ESC key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modalOverlay');
    
    if (modal && overlay) {
      overlay.classList.add('active');
      modal.classList.add('active');
      modal.classList.add('entering');
      
      // Focus management
      const firstInput = modal.querySelector('input, textarea, select, button');
      if (firstInput) firstInput.focus();
      
      setTimeout(() => {
        modal.classList.remove('entering');
      }, 300);
    }
  }

  closeAllModals() {
    const modals = document.querySelectorAll('.modal.active');
    const overlay = document.getElementById('modalOverlay');
    
    modals.forEach(modal => {
      modal.classList.add('leaving');
      
      setTimeout(() => {
        modal.classList.remove('active', 'leaving');
      }, 300);
    });
    
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  // Panels setup
  setupPanels() {
    // Load saved panel states
    const savedPanels = localStorage.getItem('camelot-panels');
    if (savedPanels) {
      try {
        this.panels = { ...this.panels, ...JSON.parse(savedPanels) };
        
        // Apply saved states
        Object.entries(this.panels).forEach(([panelName, isOpen]) => {
          const panel = document.querySelector(`.${panelName.replace('Panel', '-panel')}, .sidebar`);
          if (panel && !isOpen) {
            panel.classList.add('collapsed');
          }
        });
      } catch (error) {
        console.warn('Failed to load saved panel states:', error);
      }
    }
  }

  // Keyboard shortcuts
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + K for search/command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      // TODO: Implement command palette
      console.log('🔍 Command palette (not implemented)');
    }
    
    // Ctrl/Cmd + N for new ticket
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      this.openModal('newTicketModal');
    }
    
    // Ctrl/Cmd + B for sidebar toggle
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      this.togglePanel('sidebar');
    }
    
    // Number keys for section switching
    if (e.key >= '1' && e.key <= '4') {
      const sections = ['dashboard', 'tickets', 'agents', 'terminal'];
      const sectionIndex = parseInt(e.key) - 1;
      if (sections[sectionIndex]) {
        this.switchSection(sections[sectionIndex]);
      }
    }
  }

  // Responsive handling
  handleResize() {
    const width = window.innerWidth;
    
    // Auto-collapse panels on smaller screens
    if (width <= 768) {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && !sidebar.classList.contains('collapsed')) {
        sidebar.classList.add('collapsed');
      }
    }
    
    if (width <= 1280) {
      const rightPanel = document.querySelector('.right-panel');
      if (rightPanel && !rightPanel.classList.contains('collapsed')) {
        rightPanel.classList.add('collapsed');
      }
    }
  }

  handleOutsideClick(e) {
    // Close mobile panels when clicking outside
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar');
      const sidebarOverlay = document.querySelector('.sidebar-overlay');
      
      if (sidebar && sidebarOverlay && 
          !sidebar.contains(e.target) && 
          !e.target.closest('[data-toggle="sidebar"]')) {
        sidebar.classList.add('collapsed');
        sidebarOverlay.classList.remove('active');
      }
    }
  }

  // Data loading and management
  async loadInitialData() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      console.log('✅ Server health:', data);
    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
      this.showNotification('Failed to connect to server', 'error');
    }
  }

  async loadSectionData(sectionName) {
    switch (sectionName) {
      case 'tickets':
        await this.loadTickets();
        break;
      case 'agents':
        await this.loadAgents();
        break;
      // Add other section loaders as needed
    }
  }

  async loadTickets() {
    try {
      const response = await fetch('/api/tickets');
      const data = await response.json();
      // TODO: Update ticket list UI
      console.log('🎫 Loaded tickets:', data);
    } catch (error) {
      console.error('❌ Failed to load tickets:', error);
    }
  }

  async loadAgents() {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      this.agents = data;
      console.log('🤖 Loaded agents:', data);
      
      // Update agent dropdowns
      this.updateAgentDropdowns();
      
      // Setup agent selector
      this.setupAgentSelector();
    } catch (error) {
      console.error('❌ Failed to load agents:', error);
    }
  }

  setupAgentSelector() {
    const agentDots = document.getElementById('agentDots');
    if (!agentDots) return;

    // Clear existing dots
    agentDots.innerHTML = '';

    // Set default selected agent to primary
    if (!this.selectedAgent) {
      this.selectedAgent = this.agents.find(agent => agent.isPrimary) || this.agents[0];
    }

    // Create dots for each agent
    this.agents.forEach(agent => {
      const dot = document.createElement('div');
      dot.className = `agent-dot ${this.getAgentType(agent)} ${agent.id === (this.selectedAgent?.id) ? 'active' : ''} available`;
      dot.title = `${agent.name} - Click to select for new terminals`;
      dot.dataset.agentId = agent.id;

      dot.addEventListener('click', () => {
        this.selectAgent(agent.id);
      });

      agentDots.appendChild(dot);
    });
  }

  getAgentType(agent) {
    // Determine agent type based on command or name
    const name = agent.name.toLowerCase();
    const command = agent.command.toLowerCase();
    
    if (name.includes('copilot') || command.includes('copilot')) {
      return 'copilot';
    } else if (name.includes('claude') || command.includes('claude')) {
      return 'claude';
    } else {
      return 'custom';
    }
  }

  selectAgent(agentId) {
    this.selectedAgent = this.agents.find(agent => agent.id === agentId);
    
    // Update active dot
    document.querySelectorAll('.agent-dot').forEach(dot => {
      dot.classList.remove('active');
    });
    
    const selectedDot = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (selectedDot) {
      selectedDot.classList.add('active');
    }
    
    console.log('🎯 Selected agent:', this.selectedAgent.name);
    this.showNotification(`Selected agent: ${this.selectedAgent.name}`, 'info');
  }

  updateAgentDropdowns() {
    // Update ticket agent dropdown
    const ticketAgentSelect = document.getElementById('ticketAgent');
    if (ticketAgentSelect) {
      // Keep existing options, add loaded agents
      const existingOptions = Array.from(ticketAgentSelect.options).map(opt => opt.value);
      
      this.agents.forEach(agent => {
        if (!existingOptions.includes(agent.id)) {
          const option = document.createElement('option');
          option.value = agent.id;
          option.textContent = agent.name;
          ticketAgentSelect.appendChild(option);
        }
      });
    }
  }

  // External Terminal Launch
  async launchExternalTerminal(agent = null) {
    const targetAgent = agent || this.selectedAgent || this.agents.find(agent => agent.isPrimary);
    if (!targetAgent) {
      this.showNotification('No agent selected. Please set up agents first.', 'error');
      return;
    }

    try {
      const response = await fetch('/api/terminal/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: targetAgent.id,
          projectPath: null // TODO: Add project selection
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.showNotification(`Launched ${result.agent} terminal`, 'success');
      } else {
        throw new Error('Failed to launch terminal');
      }
    } catch (error) {
      console.error('❌ Failed to launch external terminal:', error);
      
      // Fallback to Windows Terminal if available
      if (this.isWindows()) {
        this.launchWindowsTerminal(targetAgent);
      } else {
        this.showNotification('Failed to launch external terminal', 'error');
      }
    }
  }

  isWindows() {
    return navigator.platform.indexOf('Win') > -1 || navigator.userAgent.indexOf('Windows') > -1;
  }

  launchWindowsTerminal(agent) {
    try {
      // Construct Windows Terminal command
      const command = `${agent.command} ${agent.defaultArgs.join(' ')}`;
      const wtCommand = `wt.exe new-tab --title "Camelot - ${agent.name}" powershell -NoExit -Command "${command}"`;
      
      console.log('🪟 Attempting Windows Terminal fallback:', wtCommand);
      
      // Try to execute the command (this will only work in specific contexts like Electron)
      // For web browsers, we can only show the command to the user
      this.showWindowsTerminalFallback(wtCommand);
      
    } catch (error) {
      console.error('❌ Windows Terminal fallback failed:', error);
      this.showNotification('Terminal fallback failed. Please manually launch your terminal.', 'error');
    }
  }

  showWindowsTerminalFallback(command) {
    // Show a modal or notification with the command to run manually
    const notification = document.createElement('div');
    notification.className = 'notification notification-info windows-terminal-fallback';
    notification.innerHTML = `
      <div class="notification-content">
        <div>
          <strong>Windows Terminal Command:</strong>
          <div class="terminal-command-copy">
            <code>${command}</code>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${command.replace(/'/g, "\\'")}')">
              📋 Copy
            </button>
          </div>
          <small>Run this command in your terminal to launch ${this.selectedAgent?.name || 'the agent'}.</small>
        </div>
        <button class="notification-close" aria-label="Close notification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto-hide after 10 seconds (longer for command copying)
    setTimeout(() => this.hideNotification(notification), 10000);
    
    // Close button handler
    notification.querySelector('.notification-close').addEventListener('click', () => {
      this.hideNotification(notification);
    });
  }

  // Terminal Management
  createNewTerminal() {
    const targetAgent = this.selectedAgent || this.agents.find(agent => agent.isPrimary);
    if (!targetAgent) {
      this.showNotification('No agent selected. Please set up agents first.', 'error');
      return;
    }

    const sessionId = `term-${Date.now()}`;
    
    // Check if xterm.js is available, fallback to external terminal
    if (typeof Terminal === 'undefined') {
      console.warn('xterm.js not available, falling back to external terminal');
      this.launchExternalTerminal(targetAgent);
      return;
    }
    
    // Send WebSocket message to create terminal
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'terminal-create',
        sessionId: sessionId,
        agentId: targetAgent.id,
        projectPath: null // TODO: Add project selection
      }));
    }

    // Create terminal tab immediately for better UX
    this.createTerminalTab(sessionId, targetAgent, 'connecting');
  }

  createTerminalTab(sessionId, agent, status = 'connecting') {
    const tabsContainer = document.getElementById('terminalTabs');
    const terminalContent = document.getElementById('terminalContent');
    
    // Hide empty state
    const emptyState = terminalContent.querySelector('.terminal-empty');
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    // Create tab with enhanced display
    const tab = document.createElement('div');
    tab.className = 'terminal-tab';
    tab.dataset.sessionId = sessionId;
    
    const agentType = this.getAgentType(agent);
    const projectInfo = 'workspace'; // TODO: Get actual project from selection
    
    tab.innerHTML = `
      <div class="terminal-tab-title">
        <div class="terminal-tab-icon ${agentType}"></div>
        <div class="terminal-tab-info">
          <div class="terminal-tab-name">${agent.name}</div>
          <div class="terminal-tab-project">${projectInfo}</div>
        </div>
      </div>
      <div class="terminal-tab-status status-${status}"></div>
      <button class="terminal-tab-close" aria-label="Close terminal">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    // Tab click handler
    tab.addEventListener('click', (e) => {
      if (!e.target.closest('.terminal-tab-close')) {
        this.switchTerminal(sessionId);
      }
    });

    // Close button handler
    tab.querySelector('.terminal-tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTerminal(sessionId);
    });

    // Add tab before the new terminal button
    const newTerminalBtn = document.getElementById('newTerminalBtn');
    tabsContainer.insertBefore(tab, newTerminalBtn);

    // Create terminal container
    const terminalContainer = document.createElement('div');
    terminalContainer.className = 'terminal-instance';
    terminalContainer.dataset.sessionId = sessionId;
    
    // Initialize xterm.js
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#f0f6fc',
        selection: '#264f78'
      }
    });
    
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    terminal.open(terminalContainer);
    fitAddon.fit();
    
    // Handle terminal input
    terminal.onData(data => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'terminal-input',
          sessionId: sessionId,
          data: data
        }));
      }
    });

    // Handle resize
    terminal.onResize(size => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'terminal-resize',
          sessionId: sessionId,
          cols: size.cols,
          rows: size.rows
        }));
      }
    });

    terminalContent.appendChild(terminalContainer);
    
    // Store terminal instance
    this.terminals.set(sessionId, {
      terminal,
      fitAddon,
      tab,
      container: terminalContainer,
      agent,
      status
    });

    // Switch to this terminal
    this.switchTerminal(sessionId);

    // Setup resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (this.activeTerminal === sessionId) {
        fitAddon.fit();
      }
    });
    resizeObserver.observe(terminalContainer);

    return sessionId;
  }

  switchTerminal(sessionId) {
    // Deactivate all tabs and terminals
    document.querySelectorAll('.terminal-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.terminal-instance').forEach(instance => {
      instance.classList.remove('active');
    });

    // Activate selected terminal
    const terminalData = this.terminals.get(sessionId);
    if (terminalData) {
      terminalData.tab.classList.add('active');
      terminalData.container.classList.add('active');
      this.activeTerminal = sessionId;
      
      // Fit terminal on activation
      setTimeout(() => {
        terminalData.fitAddon.fit();
      }, 100);
    }
  }

  closeTerminal(sessionId) {
    const terminalData = this.terminals.get(sessionId);
    if (!terminalData) return;

    // Send close message to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'terminal-kill',
        sessionId: sessionId
      }));
    }

    // Remove from DOM
    terminalData.tab.remove();
    terminalData.container.remove();
    terminalData.terminal.dispose();

    // Remove from storage
    this.terminals.delete(sessionId);

    // Show empty state if no terminals left
    if (this.terminals.size === 0) {
      const emptyState = document.querySelector('.terminal-empty');
      if (emptyState) {
        emptyState.style.display = 'flex';
      }
      this.activeTerminal = null;
    } else if (this.activeTerminal === sessionId) {
      // Switch to another terminal if this was active
      const remainingTerminals = Array.from(this.terminals.keys());
      if (remainingTerminals.length > 0) {
        this.switchTerminal(remainingTerminals[0]);
      }
    }
  }

  // WebSocket terminal message handlers
  handleTerminalCreated(message) {
    const terminalData = this.terminals.get(message.sessionId);
    if (terminalData) {
      terminalData.status = 'connected';
      const statusElement = terminalData.tab.querySelector('.terminal-tab-status');
      if (statusElement) {
        statusElement.className = 'terminal-tab-status status-connected';
      }
      console.log('🔗 Terminal connected:', message.sessionId);
    }
  }

  handleTerminalData(message) {
    const terminalData = this.terminals.get(message.sessionId);
    if (terminalData) {
      terminalData.terminal.write(message.data);
    }
  }

  handleTerminalExit(message) {
    const terminalData = this.terminals.get(message.sessionId);
    if (terminalData) {
      terminalData.status = 'disconnected';
      const statusElement = terminalData.tab.querySelector('.terminal-tab-status');
      if (statusElement) {
        statusElement.className = 'terminal-tab-status status-error';
      }
      terminalData.terminal.write(`\r\n\x1b[91mProcess exited with code ${message.exitCode}\x1b[0m\r\n`);
      console.log('💀 Terminal exited:', message.sessionId, 'Exit code:', message.exitCode);
    }
  }

  handleTerminalError(message) {
    console.error('❌ Terminal error:', message.error);
    this.showNotification(message.error, 'error');
  }

  // Agent Configuration
  async openAgentSettings() {
    await this.loadAgents(); // Refresh agent list
    this.renderAgentList();
    this.openModal('agentSettingsModal');
  }

  renderAgentList() {
    const agentList = document.getElementById('agentList');
    if (!agentList) return;

    agentList.innerHTML = this.agents.map(agent => `
      <div class="agent-item ${agent.isPrimary ? 'primary' : ''}" data-agent-id="${agent.id}">
        <div class="agent-info">
          <h3 class="agent-name">
            ${agent.name}
            ${agent.isPrimary ? '<span class="agent-primary-badge">Primary</span>' : ''}
          </h3>
          <p class="agent-command">${agent.command} ${agent.defaultArgs.join(' ')}</p>
        </div>
        <div class="agent-actions">
          ${!agent.isPrimary ? `
            <button class="btn btn-sm btn-ghost" onclick="camelot.setPrimaryAgent('${agent.id}')">
              Set Primary
            </button>
          ` : ''}
          <button class="btn btn-sm btn-ghost" onclick="camelot.editAgent('${agent.id}')">
            Edit
          </button>
          ${!agent.isPrimary ? `
            <button class="btn btn-sm btn-ghost" onclick="camelot.deleteAgent('${agent.id}')">
              Delete
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  async setPrimaryAgent(agentId) {
    try {
      const response = await fetch(`/api/agents/${agentId}/set-primary`, {
        method: 'POST'
      });

      if (response.ok) {
        this.showNotification('Primary agent updated successfully!', 'success');
        await this.loadAgents();
        this.renderAgentList();
        this.setupAgentSelector();
      } else {
        throw new Error('Failed to set primary agent');
      }
    } catch (error) {
      console.error('❌ Failed to set primary agent:', error);
      this.showNotification('Failed to set primary agent', 'error');
    }
  }

  editAgent(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;

    // Pre-fill form
    document.getElementById('agentId').value = agent.id;
    document.getElementById('agentName').value = agent.name;
    document.getElementById('agentCommand').value = agent.command;
    document.getElementById('agentArgs').value = agent.defaultArgs.join(' ');
    document.getElementById('agentModel').value = agent.model || '';
    
    // Disable ID field for editing
    document.getElementById('agentId').disabled = true;
    document.getElementById('editAgentTitle').textContent = 'Edit Agent';
    document.getElementById('saveAgentBtn').textContent = 'Update Agent';
    
    // Store editing state
    this.editingAgentId = agentId;
    
    this.openModal('editAgentModal');
  }

  async deleteAgent(agentId) {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.showNotification('Agent deleted successfully!', 'success');
        await this.loadAgents();
        this.renderAgentList();
        this.setupAgentSelector();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete agent');
      }
    } catch (error) {
      console.error('❌ Failed to delete agent:', error);
      this.showNotification(error.message || 'Failed to delete agent', 'error');
    }
  }

  // Form handling
  async handleTicketSubmission(form) {
    const formData = new FormData(form);
    const ticketData = {
      title: formData.get('title') || document.getElementById('ticketTitle').value,
      description: formData.get('description') || document.getElementById('ticketDescription').value,
      priority: formData.get('priority') || document.getElementById('ticketPriority').value,
      agent: formData.get('agent') || document.getElementById('ticketAgent').value
    };

    try {
      // Add loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Creating...';
      submitBtn.disabled = true;

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketData)
      });

      if (response.ok) {
        this.showNotification('Ticket created successfully!', 'success');
        this.closeAllModals();
        form.reset();
        await this.loadTickets(); // Refresh ticket list
        
        // Add to ticket list with animation
        this.addTicketToList(ticketData);
      } else {
        throw new Error('Failed to create ticket');
      }
    } catch (error) {
      console.error('❌ Failed to create ticket:', error);
      this.showNotification('Failed to create ticket', 'error');
    } finally {
      // Remove loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Create Ticket';
      submitBtn.disabled = false;
    }
  }

  openAddAgentModal() {
    // Clear form
    document.getElementById('agentForm').reset();
    
    // Enable ID field for new agent
    document.getElementById('agentId').disabled = false;
    document.getElementById('editAgentTitle').textContent = 'Add Agent';
    document.getElementById('saveAgentBtn').textContent = 'Save Agent';
    
    // Clear editing state
    this.editingAgentId = null;
    
    this.openModal('editAgentModal');
  }

  async handleAgentSubmission(form) {
    const formData = new FormData(form);
    const agentData = {
      id: formData.get('id') || document.getElementById('agentId').value,
      name: formData.get('name') || document.getElementById('agentName').value,
      command: formData.get('command') || document.getElementById('agentCommand').value,
      defaultArgs: (formData.get('args') || document.getElementById('agentArgs').value).split(' ').filter(Boolean),
      model: formData.get('model') || document.getElementById('agentModel').value || null
    };

    try {
      // Add loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = this.editingAgentId ? 'Updating...' : 'Creating...';
      submitBtn.disabled = true;

      const url = this.editingAgentId ? `/api/agents/${this.editingAgentId}` : '/api/agents';
      const method = this.editingAgentId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData)
      });

      if (response.ok) {
        const action = this.editingAgentId ? 'updated' : 'created';
        this.showNotification(`Agent ${action} successfully!`, 'success');
        this.closeAllModals();
        form.reset();
        await this.loadAgents(); // Refresh agent list
        this.renderAgentList();
        this.setupAgentSelector();
      } else {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${this.editingAgentId ? 'update' : 'create'} agent`);
      }
    } catch (error) {
      console.error('❌ Failed to save agent:', error);
      this.showNotification(error.message || 'Failed to save agent', 'error');
    } finally {
      // Remove loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = this.editingAgentId ? 'Update Agent' : 'Save Agent';
      submitBtn.disabled = false;
    }
  }

  // UI updates
  addTicketToList(ticketData) {
    const ticketList = document.querySelector('.ticket-list');
    if (!ticketList) return;

    const ticketElement = document.createElement('div');
    ticketElement.className = 'ticket-item list-item-enter';
    ticketElement.innerHTML = `
      <div class="ticket-header">
        <span class="ticket-id">#NEW</span>
        <span class="ticket-status status-pending">Pending</span>
      </div>
      <h3 class="ticket-title">${ticketData.title}</h3>
      <div class="ticket-meta">
        <span class="ticket-priority">Priority: ${ticketData.priority}</span>
        <span class="ticket-time">Just created</span>
      </div>
    `;

    ticketList.insertBefore(ticketElement, ticketList.firstChild);
    
    // Remove animation class after animation completes
    setTimeout(() => {
      ticketElement.classList.remove('list-item-enter');
    }, 500);
  }

  updateTicket(ticketData) {
    // TODO: Update existing ticket in UI
    console.log('🎫 Updating ticket:', ticketData);
  }

  updateAgentStatus(agentData) {
    // TODO: Update agent status in UI
    console.log('🤖 Agent status update:', agentData);
  }

  addLogEntry(logData) {
    const logsPanel = document.getElementById('logs-panel');
    const logEntries = logsPanel?.querySelector('.log-entries');
    
    if (logEntries) {
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry ${logData.level?.toLowerCase() || 'info'}`;
      logEntry.innerHTML = `
        <span class="log-timestamp">${logData.timestamp || new Date().toLocaleTimeString()}</span>
        <span class="log-level">${logData.level || 'INFO'}</span>
        <span class="log-message">${logData.message}</span>
      `;
      
      logEntries.appendChild(logEntry);
      
      // Auto-scroll to bottom
      logEntries.scrollTop = logEntries.scrollHeight;
      
      // Limit log entries to prevent memory issues
      const entries = logEntries.querySelectorAll('.log-entry');
      if (entries.length > 100) {
        entries[0].remove();
      }
    }
  }

  // Notifications
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" aria-label="Close notification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto-hide after 5 seconds
    setTimeout(() => this.hideNotification(notification), 5000);
    
    // Close button handler
    notification.querySelector('.notification-close').addEventListener('click', () => {
      this.hideNotification(notification);
    });
  }

  hideNotification(notification) {
    notification.classList.add('hide');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.camelot = new CamelotApp();
  console.log('🏰 Camelot application initialized');
});

// Add notification styles if not already present
if (!document.querySelector('#notification-styles')) {
  const notificationStyles = document.createElement('style');
  notificationStyles.id = 'notification-styles';
  notificationStyles.textContent = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: 2000;
      min-width: 300px;
      max-width: 400px;
      transform: translateX(100%);
      transition: transform var(--duration-normal) var(--ease-out);
    }
    
    .notification.show {
      transform: translateX(0);
    }
    
    .notification-content {
      padding: var(--space-4);
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
    }
    
    .notification-message {
      flex: 1;
      color: var(--text-primary);
      font-size: var(--text-sm);
      line-height: 1.4;
    }
    
    .notification-close {
      color: var(--text-secondary);
      transition: color var(--duration-fast) var(--ease-out);
      padding: var(--space-1);
      border-radius: var(--radius-sm);
    }
    
    .notification-close:hover {
      color: var(--text-primary);
      background: var(--bg-secondary);
    }
    
    .notification-success {
      border-left: 4px solid var(--status-success);
    }
    
    .notification-error {
      border-left: 4px solid var(--status-error);
    }
    
    .notification-warning {
      border-left: 4px solid var(--status-warning);
    }
    
    .notification-info {
      border-left: 4px solid var(--status-info);
    }
    
    /* Windows Terminal Fallback */
    .windows-terminal-fallback {
      max-width: 500px;
    }
    
    .terminal-command-copy {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: var(--space-2) 0;
      padding: var(--space-2);
      background: var(--bg-secondary);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-secondary);
    }
    
    .terminal-command-copy code {
      flex: 1;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--text-primary);
      background: transparent;
      word-break: break-all;
    }
    
    .copy-btn {
      padding: var(--space-1) var(--space-2);
      background: var(--accent-amber);
      color: var(--text-inverse);
      border: none;
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      cursor: pointer;
      transition: background var(--duration-fast) var(--ease-out);
    }
    
    .copy-btn:hover {
      background: var(--accent-amber-light);
    }
  `;
  document.head.appendChild(notificationStyles);
}
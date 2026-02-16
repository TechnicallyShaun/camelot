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

    // Cancel buttons
    document.querySelectorAll('#cancelTicketBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });

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
      // TODO: Implement agent API endpoint
      console.log('🤖 Loading agents...');
    } catch (error) {
      console.error('❌ Failed to load agents:', error);
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
  `;
  document.head.appendChild(notificationStyles);
}
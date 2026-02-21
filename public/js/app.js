// Camelot Application JavaScript - Completely functional with real API integration

// xterm.js CDN UMD exports namespaces — unwrap the actual classes
const XTerm = (typeof Terminal !== 'undefined' && Terminal.Terminal) ? Terminal.Terminal : (typeof Terminal !== 'undefined' ? Terminal : null);
const XFitAddon = (typeof FitAddon !== 'undefined' && FitAddon.FitAddon) ? FitAddon.FitAddon : (typeof FitAddon !== 'undefined' ? FitAddon : null);

class CamelotApp {
  constructor() {
    this.ws = null;
    this.currentSection = 'dashboard';
    this.terminals = new Map(); // sessionId -> { terminal, session, tab }
    this.activeTerminal = null;
    this.agents = [];
    this.selectedAgent = null;
    this.projects = [];
    this.skills = [];
    this.tools = [];
    this.tickets = [];
    this.editingSkillId = null;
    this.editingToolId = null;
    this.editingAgentId = null;
    this.services = [];
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeWebSocket();
    this.setupTabSystem();
    this.setupModals();
    this.loadInitialData();
    this.setupTerminal();
    console.log('🏰 Camelot application initialized - fully functional mode');
  }

  // WebSocket connection for terminal functionality
  initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('🏰 Connected to Camelot server');
      this.addLogEntry({ message: 'WebSocket connected', level: 'INFO' });
      // Request reconnect to any running terminal sessions
      if (this.ws.readyState === 1) {
        this.ws.send(JSON.stringify({ type: 'terminal-reconnect' }));
      }
    };
    
    this.ws.onmessage = (event) => {
      this.handleWebSocketMessage(event.data);
    };
    
    this.ws.onclose = () => {
      console.log('🔌 WebSocket connection closed');
      this.addLogEntry({ message: 'WebSocket disconnected', level: 'WARN' });
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.initializeWebSocket(), 5000);
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.addLogEntry({ message: 'WebSocket error', level: 'ERROR' });
    };
  }

  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
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
        case 'terminal-reconnect-result':
          this.handleTerminalReconnect(message);
          break;
        default:
          console.log('Unknown WebSocket message:', message.type);
      }
    } catch (error) {
      // If not JSON, treat as plain text log
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

    // New ticket - inline inputs (dashboard and tickets page)
    this.setupNewTicketInputs();

    // Modal buttons
    const newProjectBtn = document.getElementById('newProjectBtn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => this.openModal('newProjectModal'));
    }

    const newSkillBtn = document.getElementById('newSkillBtn');
    if (newSkillBtn) {
      newSkillBtn.addEventListener('click', () => this.openNewSkillModal());
    }

    const newToolBtn = document.getElementById('newToolBtn');
    if (newToolBtn) {
      newToolBtn.addEventListener('click', () => this.openNewToolModal());
    }

    const newServiceBtn = document.getElementById('newServiceBtn');
    if (newServiceBtn) {
      newServiceBtn.addEventListener('click', () => this.openModal('serviceModal'));
    }

    const newAgentBtn = document.getElementById('newAgentBtn');
    if (newAgentBtn) {
      newAgentBtn.addEventListener('click', () => this.openNewAgentModal());
    }

    // Panel toggles
    const bottomPanelToggle = document.getElementById('bottomPanelToggle');
    if (bottomPanelToggle) {
      bottomPanelToggle.addEventListener('click', () => this.toggleBottomPanel());
    }

    // Terminal controls
    const newTerminalBtn = document.getElementById('newTerminalBtn');
    if (newTerminalBtn) {
      newTerminalBtn.addEventListener('click', () => this.createNewTerminal());
    }

    // Workload filters
    const workloadStatusFilter = document.getElementById('workloadStatusFilter');
    if (workloadStatusFilter) {
      workloadStatusFilter.addEventListener('change', () => this.loadWorkload());
    }
    const workloadAssigneeFilter = document.getElementById('workloadAssigneeFilter');
    if (workloadAssigneeFilter) {
      let debounceTimer;
      workloadAssigneeFilter.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.loadWorkload(), 300);
      });
    }
  }

  setupNewTicketInputs() {
    // Dashboard new ticket input
    const newTicketInput = document.getElementById('newTicketInput');
    const newTicketAddBtn = document.getElementById('newTicketAddBtn');

    if (newTicketInput && newTicketAddBtn) {
      const submitTicket = () => {
        const title = newTicketInput.value.trim();
        if (title) {
          this.createTicket(title);
          newTicketInput.value = '';
        }
      };

      newTicketAddBtn.addEventListener('click', submitTicket);
      newTicketInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitTicket();
        }
      });
    }

    // Tickets page input
    const ticketsPageInput = document.getElementById('ticketsPageInput');
    const ticketsPageAddBtn = document.getElementById('ticketsPageAddBtn');

    if (ticketsPageInput && ticketsPageAddBtn) {
      const submitTicketPage = () => {
        const title = ticketsPageInput.value.trim();
        if (title) {
          this.createTicket(title);
          ticketsPageInput.value = '';
        }
      };

      ticketsPageAddBtn.addEventListener('click', submitTicketPage);
      ticketsPageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitTicketPage();
        }
      });
    }
  }

  // Section switching
  switchSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    const navLink = document.querySelector(`[data-section="${sectionName}"]`);
    if (navLink) {
      navLink.closest('.nav-item').classList.add('active');
    }

    // Switch sections
    document.querySelectorAll('.section').forEach(section => {
      section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Update header
    this.updateHeader(sectionName);
    this.currentSection = sectionName;

    // Load section-specific data
    this.loadSectionData(sectionName);
  }

  updateHeader(sectionName) {
    const pageTitle = document.querySelector('.page-title');
    
    const sectionTitles = {
      dashboard: 'Dashboard',
      tickets: 'Tickets',
      projects: 'Projects',
      skills: '⚔️ Skills',
      tools: '🔧 Tools',
      services: 'Services',
      workload: '📋 Workload',
      agents: 'Agents'
    };
    
    if (pageTitle) {
      pageTitle.textContent = sectionTitles[sectionName] || 'Camelot';
    }
  }

  // Data loading and management
  async loadInitialData() {
    try {
      // Load all data on startup
      await Promise.all([
        this.loadAgents(),
        this.loadProjects(),
        this.loadSkills(),
        this.loadTools(),
        this.loadTickets(),
        this.loadActivity(),
        this.loadServices()
      ]);
      
      this.addLogEntry({ message: 'All data loaded successfully', level: 'SUCCESS' });
    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
      this.addLogEntry({ message: `Failed to load data: ${error.message}`, level: 'ERROR' });
    }
  }

  async loadSectionData(sectionName) {
    // Data is already loaded on init, just refresh if needed
    switch (sectionName) {
      case 'tickets':
        await this.loadTickets();
        break;
      case 'projects':
        await this.loadProjects();
        break;
      case 'skills':
        await this.loadSkills();
        break;
      case 'tools':
        await this.loadTools();
        break;
      case 'services':
        await this.loadServices();
        break;
      case 'agents':
        await this.loadAgents();
        break;
      case 'workload':
        await this.loadWorkload();
        break;
    }
  }

  // API methods
  async apiCall(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API call failed: ${url}`, error);
      throw error;
    }
  }

  // TICKETS - Real API integration
  async loadTickets() {
    try {
      const tickets = await this.apiCall('/api/tickets');
      this.tickets = tickets;
      this.renderTickets();
      this.renderDashboardTickets();
    } catch (error) {
      console.error('❌ Failed to load tickets:', error);
      this.showError('Failed to load tickets');
    }
  }

  async createTicket(title) {
    try {
      const selectedProjectId = document.getElementById('projectSelector')?.value;
      const body = { title };
      if (selectedProjectId) body.projectId = Number(selectedProjectId);

      const ticket = await this.apiCall('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      this.tickets.unshift(ticket);
      this.renderTickets();
      this.renderDashboardTickets();
      this.showSuccess('Ticket created successfully!');
      
      // Refresh activity to show the new ticket creation
      await this.loadActivity();
    } catch (error) {
      console.error('❌ Failed to create ticket:', error);
      this.showError('Failed to create ticket');
    }
  }

  async updateTicketStage(ticketId, stage) {
    try {
      await this.apiCall(`/api/tickets/${ticketId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage })
      });
      
      // Update local data
      const ticket = this.tickets.find(t => t.id === ticketId);
      if (ticket) {
        ticket.stage = stage;
        this.renderTickets();
        this.renderDashboardTickets();
      }
      
      this.showSuccess('Ticket updated!');
      await this.loadActivity();
    } catch (error) {
      console.error('❌ Failed to update ticket:', error);
      this.showError('Failed to update ticket');
    }
  }

  async deleteTicket(ticketId) {
    if (!confirm('Are you sure you want to delete this ticket?')) return;
    
    try {
      await this.apiCall(`/api/tickets/${ticketId}`, { method: 'DELETE' });
      
      this.tickets = this.tickets.filter(t => t.id !== ticketId);
      this.renderTickets();
      this.renderDashboardTickets();
      this.showSuccess('Ticket deleted successfully!');
      await this.loadActivity();
    } catch (error) {
      console.error('❌ Failed to delete ticket:', error);
      this.showError('Failed to delete ticket');
    }
  }

  renderTickets() {
    const ticketsList = document.getElementById('allTicketsList');
    if (!ticketsList) return;

    if (this.tickets.length === 0) {
      ticketsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <h3>No Tickets Yet</h3>
          <p>Create your first ticket to get started.</p>
        </div>
      `;
      return;
    }

    ticketsList.innerHTML = this.tickets.map(ticket => {
      const project = ticket.projectId ? this.projects.find(p => p.id === ticket.projectId) : null;
      return `
      <div class="split-list-item" data-ticket-id="${ticket.id}" onclick="camelot.showTicketDetail(${ticket.id})">
        <div class="split-list-item-info">
          <div class="split-list-item-name">${ticket.title} <span class="ticket-stage badge-${ticket.stage}">${this.formatStage(ticket.stage)}</span></div>
          ${project ? `<div class="split-list-item-meta">${project.name}</div>` : ''}
        </div>
      </div>
    `;
    }).join('');
  }

  getParameterisedSkills() {
    return this.skills.filter(s => /\{\{[^}]+\}\}/.test(s.content));
  }

  launchSkillForTicket(skillId, ticketId) {
    const skill = this.skills.find(s => s.id === skillId);
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!skill || !ticket) return;

    const project = ticket.projectId ? this.projects.find(p => p.id === ticket.projectId) : null;

    // Replace parameters in skill content
    let prompt = skill.content
      .replace(/\{\{ticket_number\}\}/g, ticket.title)
      .replace(/\{\{ticket_id\}\}/g, String(ticket.id))
      .replace(/\{\{ticket_title\}\}/g, ticket.title)
      .replace(/\{\{project_name\}\}/g, project ? project.name : '')
      .replace(/\{\{project_path\}\}/g, project ? project.location : '');

    if (!this.selectedAgent) {
      this.showError('Please select an agent first');
      return;
    }

    // Set project selector if ticket has a project
    if (ticket.projectId) {
      const selector = document.getElementById('projectSelector');
      if (selector) selector.value = String(ticket.projectId);
    }

    // Switch to dashboard
    this.switchSection('dashboard');

    // Create terminal with the skill prompt
    const sessionId = `term-${Date.now()}`;
    const projectPath = project ? project.location : this.getSelectedProjectPath();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'terminal-create',
        sessionId: sessionId,
        agentId: this.selectedAgent.id,
        projectPath: projectPath,
        prompt: prompt
      }));
    }

    this.createTerminalTab(sessionId, this.selectedAgent);

    // Store context for this terminal and show context bar immediately
    const termData = this.terminals.get(sessionId);
    if (termData) {
      termData.ticketId = ticketId;
      termData.projectId = ticket.projectId;
      termData.skillPrompt = prompt;
      this.updateTerminalContextBar(termData);
    }
  }

  renderDashboardTickets() {
    const ticketsList = document.getElementById('ticketsList');
    if (!ticketsList) return;

    // Only show open tickets
    const openTickets = this.tickets.filter(t => t.stage === 'open');
    const paramSkills = this.getParameterisedSkills();

    if (openTickets.length === 0) {
      ticketsList.innerHTML = `
        <div class="empty-state">
          <p>No open tickets.</p>
        </div>
      `;
      return;
    }

    ticketsList.innerHTML = openTickets.map(ticket => {
      const skillButtons = paramSkills.map(s => 
        `<button class="ticket-skill-btn" onclick="event.stopPropagation(); camelot.launchSkillForTicket('${s.id}', ${ticket.id})" title="${s.name}">⚡</button>`
      ).join('');

      return `
      <div class="ticket-item" data-ticket-id="${ticket.id}" onclick="camelot.selectTicket(${ticket.id})" onmouseenter="this.querySelector('.ticket-actions').style.opacity=1" onmouseleave="this.querySelector('.ticket-actions').style.opacity=0">
        <span class="ticket-title">${ticket.title}</span>
        <div class="ticket-actions" style="opacity:0; display:flex; gap:2px; flex-shrink:0;">
          ${skillButtons}
          <button class="ticket-close" onclick="event.stopPropagation(); camelot.closeTicket(${ticket.id})" title="Close ticket">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    }).join('');
  }

  updateTerminalContextBar(termData) {
    const bar = document.getElementById('terminalContextBar');
    const text = document.getElementById('terminalContextText');
    if (!bar || !text) return;

    if (termData.ticketId || termData.projectId) {
      const ticket = termData.ticketId ? this.tickets.find(t => t.id === termData.ticketId) : null;
      const project = termData.projectId ? this.projects.find(p => p.id === termData.projectId) : null;
      const parts = [];
      if (project) parts.push(`📁 ${project.name}`);
      if (ticket) parts.push(`🎫 #${ticket.id} ${ticket.title}`);
      text.textContent = parts.join('  ·  ');
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  selectTicket(ticketId) {
    this.selectedTicketId = ticketId;
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (ticket && ticket.projectId) {
      const selector = document.getElementById('projectSelector');
      if (selector) selector.value = String(ticket.projectId);
    }
  }

  async closeTicket(ticketId) {
    try {
      await this.apiCall(`/api/tickets/${ticketId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'closed' })
      });
      const ticket = this.tickets.find(t => t.id === ticketId);
      if (ticket) ticket.stage = 'closed';
      this.renderDashboardTickets();
      this.renderTickets();
    } catch (error) {
      console.error('❌ Failed to close ticket:', error);
      this.showError('Failed to close ticket');
    }
  }

  formatStage(stage) {
    return stage === 'open' ? 'Open' : stage === 'closed' ? 'Closed' : stage;
  }

  async showTicketDetail(ticketId) {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const project = ticket.projectId ? this.projects.find(p => p.id === ticket.projectId) : null;

    // Load activity for this ticket
    let activities = [];
    try {
      activities = await this.apiCall(`/api/ticket-activity?ticketId=${ticketId}`);
    } catch (e) { /* ignore */ }

    const ticketsList = document.getElementById('allTicketsList');
    if (!ticketsList) return;

    // Highlight selected
    ticketsList.querySelectorAll('.split-list-item').forEach(el => el.classList.remove('active'));
    const card = ticketsList.querySelector(`[data-ticket-id="${ticketId}"]`);
    if (card) card.classList.add('active');

    // Show detail panel
    const detailPanel = document.getElementById('ticketDetailPanel');
    if (!detailPanel) return;

    const activityHtml = activities.length === 0
      ? '<p class="text-muted">No activity recorded.</p>'
      : activities.map(a => {
          const dt = new Date(a.timestamp);
          const time = dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          return `<div class="activity-item-sm"><span class="activity-action-badge">${a.action}</span> <span class="text-muted">${time}</span> ${a.metadata ? `<span class="text-muted">— ${a.metadata}</span>` : ''}</div>`;
        }).join('');

    detailPanel.innerHTML = `
      <div class="detail-header">
        <div>
          <h2 class="detail-title">#${ticket.id} ${ticket.title}</h2>
          <div class="detail-meta">${this.formatStage(ticket.stage)} ${project ? `· ${project.name}` : ''}</div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-sm btn-secondary" onclick="camelot.deleteTicket(${ticket.id})">Delete</button>
        </div>
      </div>
      <h4 style="margin-top: var(--space-4);">Activity Log</h4>
      <div class="ticket-activity-feed">${activityHtml}</div>
    `;
  }

  async showStandup() {
    const date = new Date().toISOString().slice(0, 10);
    try {
      const summary = await this.apiCall(`/api/daily-summary?date=${date}`);
      const msg = `📋 Standup for ${date}\nCreated: ${summary.tickets.created} | Updated: ${summary.tickets.updated} | Completed: ${summary.tickets.completed}\nActivities: ${summary.activities.total}${summary.effortBullets.length ? '\n' + summary.effortBullets.map(b => '• ' + b).join('\n') : ''}`;
      alert(msg);
    } catch (e) {
      this.showError('Failed to generate standup');
    }
  }

  // ACTIVITY - Real API integration
  async loadActivity() {
    try {
      const activities = await this.apiCall('/api/ticket-activity?limit=20');
      this.renderActivity(activities);
    } catch (error) {
      console.error('❌ Failed to load activity:', error);
      this.showError('Failed to load activity');
    }
  }

  renderActivity(activities) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    if (activities.length === 0) {
      activityList.innerHTML = `
        <div class="empty-state">
          <p>No recent activity.</p>
        </div>
      `;
      return;
    }

    // Sort newest first, limit 20
    const sorted = [...activities].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    ).slice(0, 20);

    activityList.innerHTML = sorted.map(activity => {
      const dt = new Date(activity.timestamp);
      const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const actionIcon = this.getActivityIcon(activity.action);
      const actionClass = this.getActivityClass(activity.action);
      
      return `
        <div class="activity-item">
          <div class="activity-icon ${actionClass}">
            ${actionIcon}
          </div>
          <div class="activity-content">
            <div class="activity-title">${this.formatActivityAction(activity)}</div>
            <div class="activity-meta">${activity.sessionId} • ${dateStr} ${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  getActivityIcon(action) {
    const icons = {
      'created': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
      'stage_changed': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20,6 9,17 4,12"/></svg>',
      'deleted': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,6 5,6 21,6"/><path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/></svg>'
    };
    return icons[action] || icons.created;
  }

  getActivityClass(action) {
    const classes = {
      'created': 'success',
      'stage_changed': 'info',
      'deleted': 'warning'
    };
    return classes[action] || 'info';
  }

  formatActivityAction(activity) {
    const ticket = this.tickets.find(t => t.id === activity.ticketId);
    const ticketTitle = ticket ? ticket.title : `Ticket #${activity.ticketId}`;
    
    switch (activity.action) {
      case 'created':
        return `Created ticket: ${ticketTitle}`;
      case 'stage_changed':
        const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};
        return `Changed ${ticketTitle} to ${this.formatStage(metadata.newStage || 'unknown')}`;
      case 'deleted':
        return `Deleted ${ticketTitle}`;
      default:
        return `${activity.action} on ${ticketTitle}`;
    }
  }

  // PROJECTS - Real API integration
  renderProjectSelector() {
    const selector = document.getElementById('projectSelector');
    if (!selector) return;
    const current = selector.value;
    selector.innerHTML = '<option value="">No project</option>' +
      this.projects.map(p => `<option value="${p.id}" data-location="${p.location}">${p.name}</option>`).join('');
    if (current) selector.value = current;
  }

  getSelectedProjectPath() {
    const selector = document.getElementById('projectSelector');
    if (!selector || !selector.value) return null;
    const opt = selector.selectedOptions[0];
    return opt ? opt.dataset.location || null : null;
  }

  getSelectedProjectId() {
    const selector = document.getElementById('projectSelector');
    return selector ? (selector.value || null) : null;
  }

  async loadProjects() {
    try {
      const projects = await this.apiCall('/api/projects');
      this.projects = projects;
      this.renderProjects();
      this.renderProjectSelector();
    } catch (error) {
      console.error('❌ Failed to load projects:', error);
      this.showError('Failed to load projects');
    }
  }

  renderProjects() {
    const list = document.getElementById('projectsList');
    if (!list) return;

    if (this.projects.length === 0) {
      list.innerHTML = '<div class="detail-empty"><p>No projects yet</p></div>';
      return;
    }

    list.innerHTML = this.projects.map(project => `
      <div class="split-list-item" data-id="${project.id}" onclick="camelot.showProjectDetail(${project.id})">
        <div class="split-list-item-info">
          <div class="split-list-item-name">${project.name}</div>
          <div class="split-list-item-meta">${project.location}</div>
        </div>
      </div>
    `).join('');
  }

  showProjectDetail(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    document.querySelectorAll('#projectsList .split-list-item').forEach(el => el.classList.remove('active'));
    const item = document.querySelector(`#projectsList [data-id="${projectId}"]`);
    if (item) item.classList.add('active');

    const detail = document.getElementById('projectsDetail');
    const createdDate = new Date(project.createdAt).toLocaleDateString();
    detail.innerHTML = `
      <div class="detail-header">
        <div>
          <h2 class="detail-title">${project.name}</h2>
          <div class="detail-meta">${project.location}</div>
          <div class="detail-meta">Created ${createdDate}</div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-sm btn-secondary" onclick="camelot.deleteProject(${project.id})">Delete</button>
        </div>
      </div>
    `;
  }

  async deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await this.apiCall(`/api/projects/${projectId}`, { method: 'DELETE' });
      this.projects = this.projects.filter(p => p.id !== projectId);
      this.renderProjects();
      this.showSuccess('Project deleted successfully!');
    } catch (error) {
      console.error('❌ Failed to delete project:', error);
      this.showError('Failed to delete project');
    }
  }

  // SKILLS - Real API integration  
  async loadSkills() {
    try {
      const skills = await this.apiCall('/api/skills');
      this.skills = skills;
      this.renderSkills();
    } catch (error) {
      console.error('❌ Failed to load skills:', error);
      this.showError('Failed to load skills');
    }
  }

  renderSkills() {
    const list = document.getElementById('skillsList');
    if (!list) return;

    if (this.skills.length === 0) {
      list.innerHTML = '<div class="detail-empty"><p>No skills yet</p></div>';
      return;
    }

    list.innerHTML = this.skills.map(skill => `
      <div class="split-list-item" data-id="${skill.id}" onclick="camelot.showSkillDetail('${skill.id}')">
        <div class="split-list-item-info">
          <div class="split-list-item-name">${skill.name}</div>
          <div class="split-list-item-meta">${skill.fileName}</div>
        </div>
      </div>
    `).join('');
  }

  showSkillDetail(skillId, editMode = false) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return;

    document.querySelectorAll('#skillsList .split-list-item').forEach(el => el.classList.remove('active'));
    const item = document.querySelector(`#skillsList [data-id="${skillId}"]`);
    if (item) item.classList.add('active');

    const detail = document.getElementById('skillsDetail');

    if (editMode) {
      detail.innerHTML = `
        <div class="detail-header">
          <div><h2 class="detail-title">Edit Skill</h2></div>
          <div class="detail-actions">
            <button class="btn btn-sm btn-secondary" onclick="camelot.showSkillDetail('${skillId}')">Cancel</button>
            <button class="btn btn-sm btn-primary" onclick="camelot.saveSkillInline('${skillId}')">Save</button>
          </div>
        </div>
        <div class="detail-edit-form">
          <div class="form-row-inline">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input class="form-input" type="text" id="inlineSkillName" value="${skill.name}">
            </div>
            <div class="form-group">
              <label class="form-label">File Name</label>
              <input class="form-input" type="text" id="inlineSkillFileName" value="${skill.fileName}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <input class="form-input" type="text" id="inlineSkillDescription" value="${skill.description || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Content</label>
            <textarea class="form-input form-textarea" id="inlineSkillContent" rows="16">${skill.content}</textarea>
          </div>
        </div>
      `;
      return;
    }

    const createdDate = new Date(skill.createdAt).toLocaleDateString();
    const hasSetupSteps = skill.content.includes('## Setup') || skill.content.includes('## Prerequisites');
    const hasParams = /\{\{[^}]+\}\}/.test(skill.content);
    detail.innerHTML = `
      <div class="detail-header">
        <div>
          <h2 class="detail-title">${skill.name}</h2>
          ${skill.description ? `<div class="detail-subtitle">${skill.description}</div>` : ''}
          <div class="detail-meta">
            ${skill.fileName} · Created ${createdDate}
            ${hasSetupSteps ? ' · <span class="skill-badge setup">Setup Guide</span>' : ''}
            ${hasParams ? ' · <span class="skill-badge param">Parameterised</span>' : ''}
          </div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-sm btn-primary" onclick="camelot.executeSkill('${skillId}')">▶ Run</button>
          <button class="btn btn-sm btn-secondary" onclick="camelot.showSkillDetail('${skillId}', true)">Edit</button>
          <button class="btn btn-sm btn-secondary" onclick="camelot.publishSkill('${skillId}')">Publish</button>
          <button class="btn btn-sm btn-secondary" onclick="camelot.deleteSkill('${skillId}')">Delete</button>
        </div>
      </div>
      <div class="detail-body">
        <pre>${skill.content}</pre>
      </div>
    `;
  }

  async saveSkillInline(skillId) {
    const data = {
      name: document.getElementById('inlineSkillName').value,
      fileName: document.getElementById('inlineSkillFileName').value,
      description: document.getElementById('inlineSkillDescription').value,
      content: document.getElementById('inlineSkillContent').value,
    };
    try {
      const updated = await this.apiCall(`/api/skills/${skillId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const idx = this.skills.findIndex(s => s.id === skillId);
      if (idx !== -1) this.skills[idx] = updated;
      this.renderSkills();
      this.showSkillDetail(skillId);
      this.showSuccess('Skill updated!');
    } catch (error) {
      this.showError('Failed to update skill');
    }
  }

  async executeSkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return;

    // Try to parse content to check for profiles
    let profiles = [];
    try {
      const parsed = JSON.parse(skill.content);
      if (parsed.profiles) {
        profiles = Object.keys(parsed.profiles);
      }
    } catch {
      // Try YAML-style profile detection
      const profileMatch = skill.content.match(/profiles:\s*\n((?:\s+\w+:.*\n?)*)/);
      if (profileMatch) {
        const lines = profileMatch[1].split('\n');
        for (const line of lines) {
          const m = line.match(/^\s{2,4}(\w+):/);
          if (m) profiles.push(m[1]);
        }
      }
    }

    let profile = undefined;
    if (profiles.length > 0) {
      profile = prompt(`Select profile (${profiles.join(', ')}):`);
      if (profile === null) return; // Cancelled
      if (profile && !profiles.includes(profile)) {
        this.showError(`Unknown profile: ${profile}`);
        return;
      }
    }

    const detail = document.getElementById('skillsDetail');
    const actionsHtml = detail.querySelector('.detail-actions');
    if (actionsHtml) {
      actionsHtml.innerHTML += '<span class="skill-running">⏳ Running...</span>';
    }

    try {
      const result = await this.apiCall(`/api/skills/${skillId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profile || undefined })
      });

      if (result.success) {
        this.showSuccess(`Skill "${skill.name}" executed successfully (${result.steps?.length || 0} steps)`);
      } else {
        this.showError(`Skill execution failed: ${result.error || 'Unknown error'}`);
      }

      // Show execution result in detail panel
      const body = detail.querySelector('.detail-body');
      if (body) {
        body.innerHTML += `
          <div class="skill-execution-result ${result.success ? 'success' : 'failure'}">
            <h4>${result.success ? '✅ Execution Succeeded' : '❌ Execution Failed'}</h4>
            ${result.error ? `<p class="error-text">${result.error}</p>` : ''}
            ${result.steps?.length ? `<p>${result.steps.length} step(s) completed</p>` : ''}
            <pre>${JSON.stringify(result.output || [], null, 2)}</pre>
          </div>
        `;
      }
    } catch (error) {
      this.showError(`Failed to execute skill: ${error.message}`);
    }

    // Remove running indicator
    const running = detail.querySelector('.skill-running');
    if (running) running.remove();
  }

  openNewSkillModal() {
    document.getElementById('skillForm').reset();
    document.getElementById('skillModalTitle').textContent = 'Create New Skill';
    document.getElementById('saveSkillBtn').textContent = 'Create Skill';
    this.editingSkillId = null;
    this.openModal('skillModal');
  }

  editSkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return;

    document.getElementById('skillName').value = skill.name;
    document.getElementById('skillFileName').value = skill.fileName;
    document.getElementById('skillDescription').value = skill.description || '';
    document.getElementById('skillContent').value = skill.content;
    
    document.getElementById('skillModalTitle').textContent = 'Edit Skill';
    document.getElementById('saveSkillBtn').textContent = 'Update Skill';
    this.editingSkillId = skillId;
    
    this.openModal('skillModal');
  }

  async deleteSkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill || !confirm(`Delete skill "${skill.name}"?`)) return;

    try {
      await this.apiCall(`/api/skills/${skillId}`, { method: 'DELETE' });
      this.skills = this.skills.filter(s => s.id !== skillId);
      this.renderSkills();
      this.showSuccess('Skill deleted successfully!');
    } catch (error) {
      console.error('❌ Failed to delete skill:', error);
      this.showError('Failed to delete skill');
    }
  }

  async publishSkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill || !confirm(`Publish skill "${skill.name}" to filesystem?`)) return;

    try {
      const result = await this.apiCall(`/api/skills/${skillId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      this.showSuccess(`Skill published to ${result.filePath}`);
    } catch (error) {
      console.error('❌ Failed to publish skill:', error);
      this.showError('Failed to publish skill');
    }
  }

  // TOOLS - Real API integration
  async loadTools() {
    try {
      const tools = await this.apiCall('/api/tools');
      this.tools = tools;
      this.renderTools();
    } catch (error) {
      console.error('❌ Failed to load tools:', error);
      this.showError('Failed to load tools');
    }
  }

  renderTools() {
    const list = document.getElementById('toolsList');
    if (!list) return;

    if (this.tools.length === 0) {
      list.innerHTML = '<div class="detail-empty"><p>No tools yet</p></div>';
      return;
    }

    list.innerHTML = this.tools.map(tool => `
      <div class="split-list-item" data-id="${tool.id}" onclick="camelot.showToolDetail('${tool.id}')">
        <div class="split-list-item-info">
          <div class="split-list-item-name">${tool.name}</div>
          <div class="split-list-item-meta">${tool.fileName}</div>
        </div>
      </div>
    `).join('');
  }

  showToolDetail(toolId, editMode = false) {
    const tool = this.tools.find(t => t.id === toolId);
    if (!tool) return;

    document.querySelectorAll('#toolsList .split-list-item').forEach(el => el.classList.remove('active'));
    const item = document.querySelector(`#toolsList [data-id="${toolId}"]`);
    if (item) item.classList.add('active');

    const detail = document.getElementById('toolsDetail');

    if (editMode) {
      detail.innerHTML = `
        <div class="detail-header">
          <div><h2 class="detail-title">Edit Tool</h2></div>
          <div class="detail-actions">
            <button class="btn btn-sm btn-secondary" onclick="camelot.showToolDetail('${toolId}')">Cancel</button>
            <button class="btn btn-sm btn-primary" onclick="camelot.saveToolInline('${toolId}')">Save</button>
          </div>
        </div>
        <div class="detail-edit-form">
          <div class="form-row-inline">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input class="form-input" type="text" id="inlineToolName" value="${tool.name}">
            </div>
            <div class="form-group">
              <label class="form-label">File Name</label>
              <input class="form-input" type="text" id="inlineToolFileName" value="${tool.fileName}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <input class="form-input" type="text" id="inlineToolDescription" value="${tool.description || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Content</label>
            <textarea class="form-input form-textarea" id="inlineToolContent" rows="16">${tool.content}</textarea>
          </div>
        </div>
      `;
      return;
    }

    const createdDate = new Date(tool.createdAt).toLocaleDateString();
    detail.innerHTML = `
      <div class="detail-header">
        <div>
          <h2 class="detail-title">${tool.name}</h2>
          ${tool.description ? `<div class="detail-subtitle">${tool.description}</div>` : ''}
          <div class="detail-meta">${tool.fileName} · Created ${createdDate}</div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-sm btn-secondary" onclick="camelot.showToolDetail('${toolId}', true)">Edit</button>
          <button class="btn btn-sm btn-secondary" onclick="camelot.deleteTool('${toolId}')">Delete</button>
        </div>
      </div>
      <div class="detail-body">
        <pre>${tool.content}</pre>
      </div>
    `;
  }

  async saveToolInline(toolId) {
    const data = {
      name: document.getElementById('inlineToolName').value,
      fileName: document.getElementById('inlineToolFileName').value,
      description: document.getElementById('inlineToolDescription').value,
      content: document.getElementById('inlineToolContent').value,
    };
    try {
      const updated = await this.apiCall(`/api/tools/${toolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const idx = this.tools.findIndex(t => t.id === toolId);
      if (idx !== -1) this.tools[idx] = updated;
      this.renderTools();
      this.showToolDetail(toolId);
      this.showSuccess('Tool updated!');
    } catch (error) {
      this.showError('Failed to update tool');
    }
  }

  openNewToolModal() {
    document.getElementById('toolForm').reset();
    document.getElementById('toolModalTitle').textContent = 'Create New Tool';
    document.getElementById('saveToolBtn').textContent = 'Create Tool';
    this.editingToolId = null;
    this.openModal('toolModal');
  }

  editTool(toolId) {
    const tool = this.tools.find(t => t.id === toolId);
    if (!tool) return;

    document.getElementById('toolName').value = tool.name;
    document.getElementById('toolFileName').value = tool.fileName;
    document.getElementById('toolDescription').value = tool.description || '';
    document.getElementById('toolContent').value = tool.content;
    
    document.getElementById('toolModalTitle').textContent = 'Edit Tool';
    document.getElementById('saveToolBtn').textContent = 'Update Tool';
    this.editingToolId = toolId;
    
    this.openModal('toolModal');
  }

  async deleteTool(toolId) {
    const tool = this.tools.find(t => t.id === toolId);
    if (!tool || !confirm(`Delete tool "${tool.name}"?`)) return;

    try {
      await this.apiCall(`/api/tools/${toolId}`, { method: 'DELETE' });
      this.tools = this.tools.filter(t => t.id !== toolId);
      this.renderTools();
      this.showSuccess('Tool deleted successfully!');
    } catch (error) {
      console.error('❌ Failed to delete tool:', error);
      this.showError('Failed to delete tool');
    }
  }

  // SERVICES - Real API integration
  async loadServices() {
    try {
      const services = await this.apiCall('/api/services');
      this.services = services;
      this.renderServices();
    } catch (error) {
      console.error('❌ Failed to load services:', error);
    }
  }

  renderServices() {
    const list = document.getElementById('servicesList');
    if (!list) return;

    if (!this.services || this.services.length === 0) {
      list.innerHTML = '<div class="detail-empty"><p>No services yet</p></div>';
      return;
    }

    list.innerHTML = this.services.map(svc => `
      <div class="split-list-item" data-id="${svc.id}" onclick="camelot.showServiceDetail('${svc.id}')">
        <div class="split-list-item-info">
          <div class="split-list-item-name">${svc.name}</div>
          <div class="split-list-item-meta">${svc.provider || 'No provider'}</div>
        </div>
      </div>
    `).join('');
  }

  showServiceDetail(serviceId) {
    const svc = this.services.find(s => s.id === serviceId);
    if (!svc) return;

    document.querySelectorAll('#servicesList .split-list-item').forEach(el => el.classList.remove('active'));
    const item = document.querySelector(`#servicesList [data-id="${serviceId}"]`);
    if (item) item.classList.add('active');

    const detail = document.getElementById('servicesDetail');
    const createdDate = new Date(svc.createdAt).toLocaleDateString();
    detail.innerHTML = `
      <div class="detail-header">
        <div>
          <h2 class="detail-title">${svc.name}</h2>
          ${svc.description ? `<div class="detail-subtitle">${svc.description}</div>` : ''}
          <div class="detail-meta">${svc.provider} · ${svc.authType} · ${svc.status}</div>
          ${svc.baseUrl ? `<div class="detail-meta">${svc.baseUrl}</div>` : ''}
          <div class="detail-meta">Created ${createdDate}</div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-sm btn-secondary" onclick="camelot.deleteService('${serviceId}')">Delete</button>
        </div>
      </div>
    `;
  }

  async deleteService(serviceId) {
    if (!confirm('Delete this service?')) return;
    try {
      await this.apiCall(`/api/services/${serviceId}`, { method: 'DELETE' });
      this.services = this.services.filter(s => s.id !== serviceId);
      this.renderServices();
      document.getElementById('servicesDetail').innerHTML = '<div class="detail-empty"><p>Select a service to view details</p></div>';
      this.showSuccess('Service deleted!');
    } catch (error) {
      this.showError('Failed to delete service');
    }
  }

  // WORKLOAD - Ticket Dashboard
  async loadWorkload() {
    const listEl = document.getElementById('workloadList');
    if (!listEl) return;

    try {
      const statusFilter = document.getElementById('workloadStatusFilter')?.value || '';
      const assigneeFilter = document.getElementById('workloadAssigneeFilter')?.value || '';

      let url = '/api/workload/tickets';
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (assigneeFilter) params.set('assignee', assigneeFilter);
      if (params.toString()) url += '?' + params.toString();

      const tickets = await this.apiCall(url);

      if (!tickets || tickets.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>No workload tickets found. Configure a workload adapter first.</p></div>';
        return;
      }

      listEl.innerHTML = tickets.map(ticket => `
        <div class="workload-ticket" data-ticket-id="${ticket.id}" onclick="app.showWorkloadTicket('${ticket.id}')">
          <div class="workload-ticket-header">
            <span class="workload-status-badge workload-status-${(ticket.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}">${ticket.status || 'Unknown'}</span>
            <span class="workload-ticket-title">${ticket.title}</span>
          </div>
          ${ticket.assignee ? `<span class="workload-ticket-assignee">👤 ${ticket.assignee}</span>` : ''}
          ${ticket.labels?.length ? `<div class="workload-ticket-labels">${ticket.labels.map(l => `<span class="workload-label">${l}</span>`).join('')}</div>` : ''}
        </div>
      `).join('');
    } catch (error) {
      listEl.innerHTML = `<div class="empty-state"><p>Failed to load workload: ${error.message}</p></div>`;
    }
  }

  async showWorkloadTicket(ticketId) {
    const detailEl = document.getElementById('workloadDetail');
    const contentEl = document.getElementById('workloadDetailContent');
    if (!detailEl || !contentEl) return;

    try {
      const ticket = await this.apiCall(`/api/workload/tickets/${ticketId}`);
      detailEl.style.display = 'block';

      contentEl.innerHTML = `
        <div class="workload-detail-header">
          <h3>${ticket.title}</h3>
          <span class="workload-status-badge workload-status-${(ticket.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}">${ticket.status || 'Unknown'}</span>
        </div>
        ${ticket.assignee ? `<p><strong>Assignee:</strong> ${ticket.assignee}</p>` : ''}
        ${ticket.labels?.length ? `<p><strong>Labels:</strong> ${ticket.labels.join(', ')}</p>` : ''}
        ${ticket.description ? `<div class="workload-description">${ticket.description}</div>` : ''}
        ${ticket.url ? `<p><a href="${ticket.url}" target="_blank" class="btn btn-secondary">View in source</a></p>` : ''}
        <div class="workload-actions">
          <select id="workloadStatusChange" class="form-select">
            <option value="">Change status...</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
          <button class="btn btn-primary" onclick="app.changeWorkloadTicketStatus('${ticketId}')">Update</button>
          <button class="btn btn-secondary" onclick="document.getElementById('workloadDetail').style.display='none'">Close</button>
        </div>
      `;
    } catch (error) {
      contentEl.innerHTML = `<p>Failed to load ticket: ${error.message}</p>`;
      detailEl.style.display = 'block';
    }
  }

  async changeWorkloadTicketStatus(ticketId) {
    const statusSelect = document.getElementById('workloadStatusChange');
    const status = statusSelect?.value;
    if (!status) return;

    try {
      await this.apiCall(`/api/workload/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      await this.loadWorkload();
      document.getElementById('workloadDetail').style.display = 'none';
    } catch (error) {
      alert('Failed to update status: ' + error.message);
    }
  }

  // AGENTS - Real API integration
  async loadAgents() {
    try {
      const agents = await this.apiCall('/api/agents');
      this.agents = agents;
      this.renderAgents();
      this.setupAgentSelector();
      this.renderAgentStatus();
    } catch (error) {
      console.error('❌ Failed to load agents:', error);
      this.showError('Failed to load agents');
    }
  }

  renderAgents() {
    const agentsList = document.getElementById('agentsList');
    if (!agentsList) return;

    if (this.agents.length === 0) {
      agentsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <h3>No Agents Configured</h3>
          <p>Create your first agent to start terminal sessions.</p>
          <button class="btn btn-primary" onclick="camelot.openNewAgentModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create Agent
          </button>
        </div>
      `;
      return;
    }

    agentsList.innerHTML = this.agents.map(agent => `
      <div class="agent-item ${agent.isPrimary ? 'primary' : ''}" data-agent-id="${agent.id}">
        <div class="agent-info">
          <h3 class="agent-name">
            ${agent.name}
            ${agent.isPrimary ? '<span class="agent-primary-badge">Primary</span>' : ''}
          </h3>
          <p class="agent-command">${agent.command} ${agent.defaultArgs.join(' ')}</p>
          ${agent.model ? `<p class="agent-model">Model: ${agent.model}</p>` : ''}
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

  renderAgentStatus() {
    const agentStatusList = document.getElementById('agentStatusList');
    if (!agentStatusList) return;

    if (this.agents.length === 0) {
      agentStatusList.innerHTML = '<p>No agents configured</p>';
      return;
    }

    // Show agent status (currently just shows configured agents)
    agentStatusList.innerHTML = this.agents.map(agent => `
      <div class="agent-status">
        <span class="agent-name">${agent.name}</span>
        <span class="agent-state ${agent.isPrimary ? 'primary' : 'idle'}">${agent.isPrimary ? 'Primary' : 'Available'}</span>
        <span class="agent-task">Ready for terminal sessions</span>
      </div>
    `).join('');
  }

  setupAgentSelector() {
    const agentDots = document.getElementById('agentDots');
    if (!agentDots) return;

    agentDots.innerHTML = '';

    if (!this.selectedAgent) {
      this.selectedAgent = this.agents.find(agent => agent.isPrimary) || this.agents[0];
    }

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
    
    document.querySelectorAll('.agent-dot').forEach(dot => {
      dot.classList.remove('active');
    });
    
    const selectedDot = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (selectedDot) {
      selectedDot.classList.add('active');
    }
    
    this.showSuccess(`Selected agent: ${this.selectedAgent.name}`);
  }

  openNewAgentModal() {
    document.getElementById('agentForm').reset();
    document.getElementById('agentModalTitle').textContent = 'Create New Agent';
    document.getElementById('saveAgentBtn').textContent = 'Create Agent';
    document.getElementById('agentId').disabled = false;
    this.editingAgentId = null;
    this.openModal('agentModal');
  }

  editAgent(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;

    document.getElementById('agentId').value = agent.id;
    document.getElementById('agentName').value = agent.name;
    document.getElementById('agentCommand').value = agent.command;
    document.getElementById('agentArgs').value = agent.defaultArgs.join(' ');
    document.getElementById('agentModel').value = agent.model || '';
    
    document.getElementById('agentId').disabled = true;
    document.getElementById('agentModalTitle').textContent = 'Edit Agent';
    document.getElementById('saveAgentBtn').textContent = 'Update Agent';
    
    this.editingAgentId = agentId;
    this.openModal('agentModal');
  }

  async setPrimaryAgent(agentId) {
    try {
      await this.apiCall(`/api/agents/${agentId}/set-primary`, { method: 'POST' });
      await this.loadAgents();
      this.showSuccess('Primary agent updated successfully!');
    } catch (error) {
      console.error('❌ Failed to set primary agent:', error);
      this.showError('Failed to set primary agent');
    }
  }

  async deleteAgent(agentId) {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      await this.apiCall(`/api/agents/${agentId}`, { method: 'DELETE' });
      this.agents = this.agents.filter(a => a.id !== agentId);
      this.renderAgents();
      this.setupAgentSelector();
      this.renderAgentStatus();
      this.showSuccess('Agent deleted successfully!');
    } catch (error) {
      console.error('❌ Failed to delete agent:', error);
      this.showError('Failed to delete agent');
    }
  }

  // TERMINAL FUNCTIONALITY with xterm.js
  setupTerminal() {
    // Terminal functionality is set up in event listeners
  }

  createNewTerminal() {
    if (!this.selectedAgent) {
      this.showError('Please select an agent first');
      return;
    }

    // Check if Terminal class is available (xterm.js)
    if (!XTerm) {
      console.warn('xterm.js not available, falling back to external terminal');
      this.showError('Terminal not available. Please ensure xterm.js is loaded.');
      return;
    }

    const sessionId = `term-${Date.now()}`;
    const projectPath = this.getSelectedProjectPath();
    
    // Send WebSocket message to create terminal
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'terminal-create',
        sessionId: sessionId,
        agentId: this.selectedAgent.id,
        projectPath: projectPath
      }));
    }

    // Create terminal tab and instance
    this.createTerminalTab(sessionId, this.selectedAgent);

    // Store project context for context bar
    const selectedProjectId = document.getElementById('projectSelector')?.value;
    if (selectedProjectId) {
      const termData = this.terminals.get(sessionId);
      if (termData) {
        termData.projectId = Number(selectedProjectId);
        this.updateTerminalContextBar(termData);
      }
    }
  }

  createTerminalTab(sessionId, agent) {
    const tabsContainer = document.getElementById('terminalTabs');
    const terminalContent = document.getElementById('terminalContent');
    
    // Hide empty state
    const emptyState = terminalContent.querySelector('.terminal-empty');
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    // Create tab
    const tab = document.createElement('div');
    tab.className = 'terminal-tab';
    tab.dataset.sessionId = sessionId;
    
    tab.innerHTML = `
      <div class="terminal-tab-title">
        <div class="terminal-tab-icon ${this.getAgentType(agent)}"></div>
        <div class="terminal-tab-info">
          <div class="terminal-tab-name">${agent.name}</div>
        </div>
      </div>
      <button class="terminal-tab-close" onclick="camelot.closeTerminal('${sessionId}')" aria-label="Close terminal">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    tab.addEventListener('click', (e) => {
      if (!e.target.closest('.terminal-tab-close')) {
        this.switchTerminal(sessionId);
      }
    });

    const newTerminalBtn = document.getElementById('newTerminalBtn');
    tabsContainer.insertBefore(tab, newTerminalBtn);

    // Create terminal container
    const terminalContainer = document.createElement('div');
    terminalContainer.className = 'terminal-instance';
    terminalContainer.dataset.sessionId = sessionId;
    
    // Initialize xterm.js
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      scrollback: 5000,
      allowProposedApi: true,
      theme: {
        background: '#070a0f',
        foreground: '#e2e5ed',
        cursor: '#f59e0b',
        selection: '#1e2533',
        black: '#0b0e14',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e2e5ed',
        brightBlack: '#525b6e',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      }
    });
    
    const fitAddon = new XFitAddon();
    terminal.loadAddon(fitAddon);
    
    terminal.open(terminalContainer);
    fitAddon.fit();
    
    // Re-fit terminal when container resizes
    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch(e) {}
    });
    resizeObserver.observe(terminalContainer);
    
    // Listen for bell character (agent completion signal)
    terminal.onBell(() => {
      const termData = this.terminals.get(sessionId);
      if (termData && this.activeTerminal !== sessionId) {
        termData.tab.classList.add('terminal-tab-alert');
      }
    });

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

    // Handle terminal resize — sync PTY dimensions for TUI apps
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
    
    this.terminals.set(sessionId, {
      terminal,
      fitAddon,
      tab,
      container: terminalContainer,
      agent
    });

    this.switchTerminal(sessionId);
    
    // Write welcome message
    terminal.write(`🏰 Camelot Terminal - ${agent.name}\r\nConnecting...\r\n`);
  }

  switchTerminal(sessionId) {
    document.querySelectorAll('.terminal-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.terminal-instance').forEach(instance => {
      instance.classList.remove('active');
    });

    const terminalData = this.terminals.get(sessionId);
    if (terminalData) {
      terminalData.tab.classList.add('active');
      terminalData.tab.classList.remove('terminal-tab-alert');
      terminalData.container.classList.add('active');
      this.activeTerminal = sessionId;
      
      // Update context bar
      this.updateTerminalContextBar(terminalData);
      
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

    terminalData.tab.remove();
    terminalData.container.remove();
    terminalData.terminal.dispose();

    this.terminals.delete(sessionId);

    if (this.terminals.size === 0) {
      const emptyState = document.querySelector('.terminal-empty');
      if (emptyState) {
        emptyState.style.display = 'flex';
      }
      this.activeTerminal = null;
    } else if (this.activeTerminal === sessionId) {
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
      terminalData.terminal.write('\r\n✅ Connected!\r\n');
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
      terminalData.terminal.write(`\r\n\x1b[91mProcess exited with code ${message.exitCode}\x1b[0m\r\n`);
      // Show completion indicator on tab
      terminalData.tab.classList.add('terminal-tab-exited');
      if (this.activeTerminal !== message.sessionId) {
        terminalData.tab.classList.add('terminal-tab-alert');
      }
    }
  }

  handleTerminalError(message) {
    console.error('❌ Terminal error:', message.error);
    this.showError(`Terminal error: ${message.error}`);
  }

  handleTerminalReconnect(message) {
    const sessions = message.sessions || [];
    if (sessions.length === 0) return;

    console.log(`🔄 Reconnecting ${sessions.length} terminal session(s)`);
    for (const session of sessions) {
      // Check if we already have this terminal
      if (this.terminals.has(session.id)) continue;

      // Create a new xterm instance for the reconnected session
      const Terminal = window.Terminal?.Terminal || window.Terminal;
      const FitAddon = window.FitAddon?.FitAddon || window.FitAddon;

      if (!Terminal) continue;

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        theme: { background: '#1a1b2e', foreground: '#c0caf5' }
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Find or create a tab for this session
      const tabContainer = document.querySelector('.terminal-tabs');
      const terminalContainer = document.querySelector('.terminal-container');
      if (!tabContainer || !terminalContainer) continue;

      const tab = document.createElement('div');
      tab.className = 'terminal-tab active';
      tab.dataset.sessionId = session.id;
      tab.innerHTML = `<span>${session.agentId || 'Terminal'}</span><button class="tab-close" onclick="app.closeTerminalTab('${session.id}')">&times;</button>`;
      tabContainer.appendChild(tab);

      const termDiv = document.createElement('div');
      termDiv.id = `terminal-${session.id}`;
      termDiv.style.width = '100%';
      termDiv.style.height = '100%';
      terminalContainer.appendChild(termDiv);

      terminal.open(termDiv);
      fitAddon.fit();

      // Write scrollback buffer
      if (session.scrollback) {
        terminal.write(session.scrollback);
      }

      // Wire input
      terminal.onData(data => {
        if (this.ws?.readyState === 1) {
          this.ws.send(JSON.stringify({ type: 'terminal-input', sessionId: session.id, data }));
        }
      });

      this.terminals.set(session.id, { terminal, session: { id: session.id }, tab, fitAddon });
      this.addLogEntry({ message: `Reconnected to terminal session ${session.id}`, level: 'INFO' });
    }
  }

  // MODAL SYSTEM
  setupModals() {
    // Modal close buttons - each close button closes modals on click
    document.querySelectorAll('.modal-close').forEach(element => {
      element.addEventListener('click', () => {
        this.closeAllModals();
      });
    });

    // Overlay click closes modals
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        this.closeAllModals();
      });
    }

    // Form submissions
    this.setupFormHandlers();

    // ESC key to close modals + Ctrl+1-0 for terminal tabs
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
      // Ctrl+1 through Ctrl+0 to switch terminal tabs
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          const index = num === 0 ? 9 : num - 1; // Ctrl+0 = 10th tab
          const sessionIds = Array.from(this.terminals.keys());
          if (index < sessionIds.length) {
            this.switchTerminal(sessionIds[index]);
          }
        }
      }
    });
  }

  setupFormHandlers() {
    const projectForm = document.getElementById('projectForm');
    if (projectForm) {
      projectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleProjectSubmission(e.target);
      });
    }

    const skillForm = document.getElementById('skillForm');
    if (skillForm) {
      skillForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSkillSubmission(e.target);
      });
    }

    const toolForm = document.getElementById('toolForm');
    if (toolForm) {
      toolForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleToolSubmission(e.target);
      });
    }

    const serviceForm = document.getElementById('serviceForm');
    if (serviceForm) {
      serviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          name: document.getElementById('serviceName').value,
          provider: document.getElementById('serviceProvider').value,
          baseUrl: document.getElementById('serviceBaseUrl').value,
          authType: document.getElementById('serviceAuthType').value,
          description: document.getElementById('serviceDescription').value,
        };
        if (!data.name) { this.showError('Name is required'); return; }
        try {
          const svc = await this.apiCall('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          this.services.unshift(svc);
          this.renderServices();
          this.closeAllModals();
          serviceForm.reset();
          this.showSuccess('Service created!');
        } catch (error) {
          this.showError('Failed to create service');
        }
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
    document.querySelectorAll('#cancelProjectBtn, #cancelSkillBtn, #cancelToolBtn, #cancelServiceBtn, #cancelAgentBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modalOverlay');
    
    if (modal && overlay) {
      overlay.classList.add('active');
      modal.classList.add('active');
      
      const firstInput = modal.querySelector('input, textarea, select');
      if (firstInput) firstInput.focus();
    }
  }

  closeAllModals() {
    const modals = document.querySelectorAll('.modal.active');
    const overlay = document.getElementById('modalOverlay');
    
    modals.forEach(modal => {
      modal.classList.remove('active');
    });
    
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  // FORM HANDLERS
  async handleProjectSubmission(form) {
    const projectData = {
      name: document.getElementById('projectName').value,
      location: document.getElementById('projectLocation').value
    };

    if (!projectData.name || !projectData.location) {
      this.showError('Please fill in both project name and location');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      const project = await this.apiCall('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      this.projects.unshift(project);
      this.renderProjects();
      this.closeAllModals();
      form.reset();
      this.showSuccess('Project created successfully!');
    } catch (error) {
      console.error('❌ Failed to create project:', error);
      this.showError(error.message || 'Failed to create project');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = '+ Project';
    }
  }

  async handleSkillSubmission(form) {
    const skillData = {
      name: document.getElementById('skillName').value,
      description: document.getElementById('skillDescription').value || '',
      fileName: document.getElementById('skillFileName').value,
      content: document.getElementById('skillContent').value
    };

    if (!skillData.name || !skillData.fileName || !skillData.content) {
      this.showError('Please fill in skill name, filename, and content');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      const isEditing = this.editingSkillId;
      submitBtn.disabled = true;
      submitBtn.textContent = isEditing ? 'Updating...' : 'Creating...';

      const url = isEditing ? `/api/skills/${this.editingSkillId}` : '/api/skills';
      const method = isEditing ? 'PUT' : 'POST';

      const skill = await this.apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skillData)
      });

      if (isEditing) {
        const index = this.skills.findIndex(s => s.id === this.editingSkillId);
        if (index !== -1) {
          this.skills[index] = skill;
        }
      } else {
        this.skills.unshift(skill);
      }
      
      this.renderSkills();
      this.closeAllModals();
      form.reset();
      this.showSuccess(`Skill ${isEditing ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('❌ Failed to save skill:', error);
      this.showError(error.message || 'Failed to save skill');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = this.editingSkillId ? 'Update Skill' : 'Create Skill';
    }
  }

  async handleToolSubmission(form) {
    const toolData = {
      name: document.getElementById('toolName').value,
      description: document.getElementById('toolDescription').value || '',
      fileName: document.getElementById('toolFileName').value,
      content: document.getElementById('toolContent').value
    };

    if (!toolData.name || !toolData.fileName || !toolData.content) {
      this.showError('Please fill in tool name, filename, and content');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      const isEditing = this.editingToolId;
      submitBtn.disabled = true;
      submitBtn.textContent = isEditing ? 'Updating...' : 'Creating...';

      const url = isEditing ? `/api/tools/${this.editingToolId}` : '/api/tools';
      const method = isEditing ? 'PUT' : 'POST';

      const tool = await this.apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolData)
      });

      if (isEditing) {
        const index = this.tools.findIndex(t => t.id === this.editingToolId);
        if (index !== -1) {
          this.tools[index] = tool;
        }
      } else {
        this.tools.unshift(tool);
      }
      
      this.renderTools();
      this.closeAllModals();
      form.reset();
      this.showSuccess(`Tool ${isEditing ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('❌ Failed to save tool:', error);
      this.showError(error.message || 'Failed to save tool');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = this.editingToolId ? 'Update Tool' : 'Create Tool';
    }
  }

  async handleAgentSubmission(form) {
    const agentData = {
      id: document.getElementById('agentId').value,
      name: document.getElementById('agentName').value,
      command: document.getElementById('agentCommand').value,
      defaultArgs: document.getElementById('agentArgs').value.split(' ').filter(Boolean),
      model: document.getElementById('agentModel').value || null
    };

    if (!agentData.id || !agentData.name || !agentData.command) {
      this.showError('Please fill in agent ID, name, and command');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      const isEditing = this.editingAgentId;
      submitBtn.disabled = true;
      submitBtn.textContent = isEditing ? 'Updating...' : 'Creating...';

      const url = isEditing ? `/api/agents/${this.editingAgentId}` : '/api/agents';
      const method = isEditing ? 'PUT' : 'POST';

      const agent = await this.apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData)
      });

      await this.loadAgents();
      this.closeAllModals();
      form.reset();
      this.showSuccess(`Agent ${isEditing ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('❌ Failed to save agent:', error);
      this.showError(error.message || 'Failed to save agent');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = this.editingAgentId ? 'Update Agent' : 'Create Agent';
    }
  }

  // TAB SYSTEM
  setupTabSystem() {
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName, e.currentTarget.closest('.panel-header'));
      });
    });
  }

  switchTab(tabName, container) {
    container.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const activeButton = container.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }

    const panelContainer = container.nextElementSibling;
    panelContainer.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    
    const targetPanel = panelContainer.querySelector(`#${tabName}-panel`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }
  }

  // PANEL MANAGEMENT
  toggleBottomPanel() {
    // Bottom panel removed
  }

  // NOTIFICATIONS AND LOGGING
  addLogEntry(logData) {
    // Bottom panel removed — log to console only
    console.log(`[${logData.level || 'INFO'}] ${logData.message}`);
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
    this.addLogEntry({ message, level: 'SUCCESS' });
  }

  showError(message) {
    this.showNotification(message, 'error');
    this.addLogEntry({ message, level: 'ERROR' });
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentNode.parentNode.remove()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.add('hide');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.camelot = new CamelotApp();
  console.log('🏰 Camelot application initialized - fully functional with real APIs');
});

// Notification styles - inject into head
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--bg-tertiary, #1e1e1e);
    border: 1px solid var(--border-primary, #333);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 2000;
    min-width: 300px;
    max-width: 400px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    color: white;
  }
  
  .notification.show {
    transform: translateX(0);
  }
  
  .notification-content {
    padding: 16px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  
  .notification-message {
    flex: 1;
    font-size: 14px;
    line-height: 1.4;
  }
  
  .notification-close {
    background: none;
    border: none;
    color: currentColor;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }
  
  .notification-close:hover {
    opacity: 1;
  }
  
  .notification-success {
    border-left: 4px solid #22c55e;
  }
  
  .notification-error {
    border-left: 4px solid #ef4444;
  }
  
  .notification-info {
    border-left: 4px solid #3b82f6;
  }
  
  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #888;
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #333;
    border-top: 3px solid #666;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: #888;
  }
  
  .empty-icon svg {
    margin-bottom: 16px;
    opacity: 0.5;
  }
  
  .empty-state h3 {
    margin-bottom: 8px;
    color: #ccc;
  }
`;
document.head.appendChild(notificationStyles);
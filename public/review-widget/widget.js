(function() {
  'use strict';
  
  const API_BASE = window.location.origin.includes('localhost') 
    ? 'http://localhost:3000'  // Portfolio dev server
    : 'https://www.loveondev.com';  // Production uses www subdomain
  
  // Styles
  const styles = `
    #client-review-widget * { box-sizing: border-box; }
    #client-review-widget {
      --crw-primary: #3b82f6;
      --crw-danger: #ef4444;
      --crw-success: #10b981;
      --crw-high: #ef4444;
      --crw-medium: #f59e0b;
      --crw-low: #a855f7;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 999999;
    }
    
    .crw-toggle-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--crw-primary);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
      z-index: 999999;
    }
    .crw-toggle-btn:hover { transform: scale(1.1); }
    .crw-toggle-btn.crw-active { background: var(--crw-danger); }
    
    .crw-marker {
      position: absolute;
      z-index: 999998;
      cursor: pointer;
      width: 40px;
      height: 40px;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
      animation: crw-bounce 0.5s ease;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }
    @keyframes crw-bounce {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, -50%) scale(1.2); }
    }
    .crw-marker.crw-priority-high { filter: drop-shadow(0 0 8px var(--crw-high)); }
    .crw-marker.crw-priority-medium { filter: drop-shadow(0 0 8px var(--crw-medium)); }
    .crw-marker.crw-priority-low { filter: drop-shadow(0 0 8px var(--crw-low)); }
    .crw-marker.crw-status-resolved { filter: drop-shadow(0 0 8px var(--crw-success)) !important; }
    
    .crw-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000000;
    }
    .crw-modal {
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .crw-modal h2 {
      margin: 0 0 20px 0;
      font-size: 24px;
      font-weight: 600;
      color: #111;
    }
    .crw-modal form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .crw-modal input, .crw-modal textarea, .crw-modal select {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
    }
    .crw-modal textarea { min-height: 120px; resize: vertical; }
    .crw-modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    .crw-modal button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .crw-modal button[type="submit"] {
      background: var(--crw-primary);
      color: white;
    }
    .crw-modal button[type="button"] {
      background: #f3f4f6;
      color: #374151;
    }
    .crw-modal button.crw-btn-danger {
      background: var(--crw-danger);
      color: white;
    }
    .crw-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000001;
    }
    .crw-notification-success { background: var(--crw-success); color: white; }
    .crw-notification-error { background: var(--crw-danger); color: white; }
    .crw-comment-details { display: flex; flex-direction: column; gap: 12px; }
    .crw-comment-details p { margin: 0; font-size: 14px; color: #555; line-height: 1.6; }
    .crw-priority-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .crw-priority-badge.crw-priority-high { background: #fee2e2; color: var(--crw-high); }
    .crw-priority-badge.crw-priority-medium { background: #fef3c7; color: #d97706; }
    .crw-priority-badge.crw-priority-low { background: #f3e8ff; color: #9333ea; }
  `;

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // Widget class
  class ReviewWidget {
    constructor() {
      this.isActive = false;
      this.comments = [];
      this.container = null;
      this.projectId = null;
      this.userId = null;
      this.init();
    }

    async init() {
      // Only activate on SUBDOMAINS of loveondev.com (not loveondev.com itself)
      if (!this.isReviewableDomain()) {
        console.log('[Review Widget] Not a subdomain, widget disabled');
        return;
      }

      console.log('[Review Widget] Initializing on', window.location.hostname);
      this.createContainer();
      
      // Check if user is authenticated
      console.log('[Review Widget] Checking session...');
      const session = await this.checkSession();
      
      // Handle loop detection sentinel
      if (session && session._loopDetected) {
        return;  // Error already shown by checkSession
      }
      
      console.log('[Review Widget] Session result:', session ? 'authenticated' : 'not authenticated');
      
      if (!session) {
        console.log('[Review Widget] Redirecting to login');
        this.redirectToLogin();
        return;
      }

      // Clean the review_authed marker from URL if present
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('review_authed')) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
      }

      this.userId = session.user.id;
      console.log('[Review Widget] User ID:', this.userId);

      // Get project for this domain
      console.log('[Review Widget] Looking up project...');
      const project = await this.getProject();
      if (!project) {
        console.error('[Review Widget] Could not find project for this domain');
        return;
      }

      console.log('[Review Widget] Project found:', project.name);
      this.projectId = project.id;
      await this.loadComments();
      console.log('[Review Widget] Initialized successfully');
    }

    isReviewableDomain() {
      const hostname = window.location.hostname;
      
      // Allow localhost for development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true;
      }
      
      // Check if it's a subdomain of loveondev.com
      // firehousearts.loveondev.com -> YES
      // www.firehousearts.loveondev.com -> YES
      // loveondev.com -> NO
      const parts = hostname.split('.');
      
      // Must have at least 3 parts (subdomain.loveondev.com)
      if (parts.length < 3) {
        return false;
      }
      
      // Check if it ends with loveondev.com
      const domain = parts.slice(-2).join('.');
      return domain === 'loveondev.com';
    }

    async checkSession() {
      try {
        const response = await fetch(`${API_BASE}/api/review/session`, {
          credentials: 'include'  // Send session cookies cross-subdomain
        });
        
        if (response.ok) {
          return await response.json();
        }
        
        // Loop-breaker: if we just came back from login but still have no session,
        // something is broken — stop instead of redirecting again.
        const urlParams = new URLSearchParams(window.location.search);
        const alreadyAuthed = urlParams.get('review_authed');
        if (alreadyAuthed && response.status === 401) {
          console.error('[Review Widget] Auth failed even after login redirect');
          this.showPersistentError('Authentication failed. Please contact support.');
          // Return a special sentinel so init() knows to stop
          return { _loopDetected: true };
        }
        
        return null;
      } catch (error) {
        console.error('Session check failed:', error);
        return null;
      }
    }

    redirectToLogin() {
      // Pass return URL as query param
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = `${API_BASE}/auth/login?review_return=${returnTo}`;
    }

    async getProject() {
      try {
        const domain = window.location.hostname;
        const response = await fetch(
          `${API_BASE}/api/review/projects?domain=${encodeURIComponent(domain)}`,
          { credentials: 'include' }
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.project;  // API returns { project: {...} }
        }
        return null;
      } catch (error) {
        console.error('Project lookup failed:', error);
        return null;
      }
    }

    createContainer() {
      this.container = document.createElement('div');
      this.container.id = 'client-review-widget';
      this.container.innerHTML = '<button class="crw-toggle-btn" id="crw-toggle">💬</button>';
      document.body.appendChild(this.container);
      
      document.getElementById('crw-toggle').addEventListener('click', () => this.toggleActive());
      document.addEventListener('click', (e) => this.handlePageClick(e));
    }

    toggleActive() {
      this.isActive = !this.isActive;
      const btn = document.getElementById('crw-toggle');
      btn.classList.toggle('crw-active', this.isActive);
      btn.textContent = this.isActive ? '❌' : '💬';
      document.body.style.cursor = this.isActive ? 'crosshair' : '';
    }

    async loadComments() {
      try {
        const url = `${API_BASE}/api/review/comments?project_id=${this.projectId}&url=${encodeURIComponent(window.location.pathname)}`;
        const response = await fetch(url, { credentials: 'include' });
        
        if (response.ok) {
          this.comments = await response.json();
          this.comments.forEach(comment => this.createMarker(comment));
        }
      } catch (error) {
        console.error('Failed to load comments:', error);
      }
    }

    createMarker(comment) {
      if (!comment.x_position || !comment.y_position) return;
      
      const marker = document.createElement('div');
      // Apply priority class and status class for resolved comments
      const statusClass = comment.status === 'resolved' ? 'crw-status-resolved' : '';
      marker.className = `crw-marker crw-priority-${comment.priority} ${statusClass}`.trim();
      marker.style.left = `${comment.x_position}px`;
      marker.style.top = `${comment.y_position}px`;
      marker.textContent = '📌';
      marker.dataset.commentId = comment.id;
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showCommentDetails(comment);
      });
      document.body.appendChild(marker);
    }

    handlePageClick(e) {
      if (!this.isActive) return;
      const target = e.target;
      if (target.closest('#client-review-widget')) return;
      if (target.classList.contains('crw-marker')) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      this.showCommentModal(e.pageX, e.pageY);
      this.toggleActive();
    }

    showCommentModal(x, y) {
      const modal = this.createModal(`
        <h2>Add Comment</h2>
        <form id="crw-comment-form">
          <textarea id="crw-comment-text" placeholder="Describe the issue or feedback..." required></textarea>
          <select id="crw-priority">
            <option value="low">Low Priority</option>
            <option value="medium" selected>Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          <div class="crw-modal-actions">
            <button type="button" id="crw-cancel">Cancel</button>
            <button type="submit">Submit</button>
          </div>
        </form>
      `);
      
      modal.querySelector('#crw-comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('crw-comment-text').value;
        const priority = document.getElementById('crw-priority').value;
        await this.createComment(x, y, text, priority);
      });
      
      modal.querySelector('#crw-cancel').addEventListener('click', () => this.closeModal());
    }

    async createComment(x, y, text, priority) {
      try {
        const response = await fetch(`${API_BASE}/api/review/comments`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: this.projectId,
            url: window.location.pathname,
            x_position: x,
            y_position: y,
            viewport_width: window.innerWidth,
            comment_text: text,
            priority
          })
        });
        
        if (response.ok) {
          const comment = await response.json();
          this.comments.push(comment);
          this.createMarker(comment);
          this.closeModal();
          this.showNotification('Comment submitted successfully!');
        } else {
          this.showNotification('Failed to submit comment', 'error');
        }
      } catch (error) {
        console.error('Failed to create comment:', error);
        this.showNotification('Failed to submit comment', 'error');
      }
    }

    showCommentDetails(comment) {
      const canDelete = comment.client_id === this.userId;
      const authorName = comment.profiles?.display_name || comment.profiles?.email || 'Unknown';
      
      const modal = this.createModal(`
        <h2>Comment Details</h2>
        <div class="crw-comment-details">
          <p><strong>Author:</strong> ${authorName}</p>
          <p><strong>Comment:</strong> ${comment.comment_text}</p>
          <p><strong>Priority:</strong> <span class="crw-priority-badge crw-priority-${comment.priority}">${comment.priority}</span></p>
          <p><strong>Status:</strong> ${comment.status}</p>
          <p><strong>Created:</strong> ${new Date(comment.created_at).toLocaleString()}</p>
        </div>
        <div class="crw-modal-actions" style="margin-top: 16px;">
          ${canDelete ? '<button type="button" id="crw-delete" class="crw-btn-danger">Delete</button>' : ''}
          <button type="button" id="crw-close-details">Close</button>
        </div>
      `);
      
      modal.querySelector('#crw-close-details').addEventListener('click', () => this.closeModal());
      
      if (canDelete) {
        modal.querySelector('#crw-delete').addEventListener('click', async () => {
          if (confirm('Are you sure you want to delete this comment?')) {
            await this.deleteComment(comment.id);
          }
        });
      }
    }

    async deleteComment(commentId) {
      try {
        const response = await fetch(
          `${API_BASE}/api/review/comments?id=${commentId}`,
          { method: 'DELETE', credentials: 'include' }
        );
        
        if (response.ok) {
          // Remove from array
          this.comments = this.comments.filter(c => c.id !== commentId);
          
          // Remove marker from DOM
          const marker = document.querySelector(`[data-comment-id="${commentId}"]`);
          if (marker) marker.remove();
          
          this.closeModal();
          this.showNotification('Comment deleted successfully!');
        } else {
          this.showNotification('Failed to delete comment', 'error');
        }
      } catch (error) {
        console.error('Failed to delete comment:', error);
        this.showNotification('Failed to delete comment', 'error');
      }
    }

    createModal(content) {
      const overlay = document.createElement('div');
      overlay.className = 'crw-modal-overlay';
      overlay.innerHTML = `<div class="crw-modal">${content}</div>`;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });
      this.container.appendChild(overlay);
      return overlay;
    }

    closeModal() {
      const modal = this.container.querySelector('.crw-modal-overlay');
      if (modal) modal.remove();
    }

    showNotification(message, type = 'success') {
      const notification = document.createElement('div');
      notification.className = `crw-notification crw-notification-${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    }

    showPersistentError(message) {
      // Show an error that doesn't auto-dismiss (for critical failures)
      const error = document.createElement('div');
      error.className = 'crw-notification crw-notification-error';
      error.style.cursor = 'pointer';
      error.textContent = message + ' (click to dismiss)';
      error.addEventListener('click', () => error.remove());
      document.body.appendChild(error);
    }
  }

  // Initialize widget
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ReviewWidget());
  } else {
    new ReviewWidget();
  }
})();

const nativeFetch = window.fetch.bind(window);
window.fetch = (resource, options = {}) => nativeFetch(resource, { credentials: 'include', ...options });

const AuthApp = {
    user: null,
    loginRole: document.body.dataset.loginRole || 'admin',

    loginPage(role = this.loginRole) {
        return role === 'staff' ? 'staff-login.html' : 'login.html';
    },

    getApiUrl() {
        if (window.VYAPAR_API_URL?.trim()) return window.VYAPAR_API_URL.trim().replace(/\/+$/, '');
        const savedUrl = localStorage.getItem('vyapar_api_url');
        if (savedUrl?.trim()) return savedUrl.trim().replace(/\/+$/, '');
        return `${window.location.origin}/api`;
    },

    async request(path, options = {}) {
        const response = await fetch(`${this.getApiUrl()}${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Request failed');
        return data;
    },

    showPanel(id) {
        document.querySelectorAll('.auth-panel').forEach(panel => panel.classList.toggle('active', panel.id === id));
        this.message('');
    },

    message(text, type = 'error') {
        const element = document.getElementById('authMessage');
        element.textContent = text;
        element.className = `auth-message ${text ? 'visible' : ''} ${type}`;
    },

    showSetup(user) {
        this.user = user;
        const pinField = document.getElementById('pinSetupField');
        const pinInput = document.getElementById('newRecoveryPin');
        if (pinField) pinField.hidden = user.role !== 'admin';
        if (pinInput) pinInput.required = user.role === 'admin' && user.mustSetPin;
        document.getElementById('setupMessage').textContent = user.role === 'staff'
            ? 'Replace the temporary password supplied by your administrator.'
            : 'Update your password and configure your private recovery PIN.';
        this.showPanel('setupPanel');
    },

    async init() {
        document.querySelectorAll('[data-show-panel]').forEach(button => {
            button.addEventListener('click', () => this.showPanel(button.dataset.showPanel));
        });
        document.getElementById('loginForm')?.addEventListener('submit', event => this.login(event));
        document.getElementById('recoveryForm')?.addEventListener('submit', event => this.recover(event));
        document.getElementById('setupForm')?.addEventListener('submit', event => this.changePassword(event));
        document.getElementById('setupLogout')?.addEventListener('click', () => this.logout());

        try {
            const data = await this.request('/auth/me');
            localStorage.setItem('vyapar_login_role', data.user.role);
            if (data.user.role !== this.loginRole) {
                window.location.replace(`${this.loginPage(data.user.role)}${new URLSearchParams(window.location.search).has('setup') ? '?setup=1' : ''}`);
                return;
            }
            if (new URLSearchParams(window.location.search).has('setup') || data.user.mustChangePassword || data.user.mustSetPin) {
                this.showSetup(data.user);
            } else {
                window.location.replace('index.html');
            }
        } catch (_) {
            this.showPanel('loginPanel');
        }
    },

    async login(event) {
        event.preventDefault();
        this.message('Signing in...', 'info');
        try {
            const data = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: document.getElementById('loginEmail').value.trim(),
                    password: document.getElementById('loginPassword').value,
                    role: this.loginRole
                })
            });
            localStorage.setItem('vyapar_login_role', data.user.role);
            if (data.user.mustChangePassword || data.user.mustSetPin) return this.showSetup(data.user);
            window.location.replace('index.html');
        } catch (error) {
            this.message(error.message);
        }
    },

    async recover(event) {
        event.preventDefault();
        this.message('Verifying recovery PIN...', 'info');
        try {
            const data = await this.request('/auth/recover', {
                method: 'POST',
                body: JSON.stringify({
                    email: document.getElementById('recoveryEmail').value.trim(),
                    recoveryPin: document.getElementById('recoveryPin').value,
                    newPassword: document.getElementById('recoveryPassword').value
                })
            });
            this.showPanel('loginPanel');
            this.message(data.message, 'success');
        } catch (error) {
            this.message(error.message);
        }
    },

    async changePassword(event) {
        event.preventDefault();
        this.message('Saving account...', 'info');
        try {
            await this.request('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword: document.getElementById('currentPassword').value,
                    newPassword: document.getElementById('newPassword').value,
                    recoveryPin: document.getElementById('newRecoveryPin')?.value || undefined
                })
            });
            window.location.replace('index.html');
        } catch (error) {
            this.message(error.message);
        }
    },

    async logout() {
        await this.request('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
        window.location.replace(this.loginPage());
    }
};

document.addEventListener('DOMContentLoaded', () => AuthApp.init());

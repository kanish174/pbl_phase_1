// Global variables
let currentUser = null;
let token = localStorage.getItem('token');
const API_BASE = '/api';
let hrDashboardSelectedMonth = null;
let employeeModalMonthContext = null;
let employeesSectionMode = 'management';
let googleLoginInitialized = false;
let googleLoginClientId = '';

function toMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyToDate(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return null;
    const [yearStr, monthStr] = monthKey.split('-');
    return new Date(Number(yearStr), Number(monthStr) - 1, 1);
}

function formatMonthKey(monthKey) {
    const date = monthKeyToDate(monthKey);
    if (!date) return monthKey;
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getRecentMonthKeys(count = 12, endMonthKey = toMonthKey(new Date())) {
    const baseDate = monthKeyToDate(endMonthKey) || new Date();
    const keys = [];
    for (let i = 0; i < count; i += 1) {
        const d = new Date(baseDate);
        d.setMonth(baseDate.getMonth() - i);
        keys.push(toMonthKey(d));
    }
    return keys;
}

function clearAuthAndShowLogin() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    showLogin();
}

function parseJwtPayload(jwtToken) {
    if (!jwtToken || !jwtToken.includes('.')) return null;
    try {
        return JSON.parse(atob(jwtToken.split('.')[1]));
    } catch (error) {
        return null;
    }
}

function isTokenExpired(payload) {
    if (!payload || !payload.exp) return true;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowInSeconds;
}

// API call helper
async function apiCall(endpoint, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response. Check server logs.');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                clearAuthAndShowLogin();
            }
            throw new Error(data.message || 'Request failed');
        }
        return data;
    } catch (error) {
        if (error.name === 'SyntaxError') {
            console.error('JSON parsing error:', error);
            throw new Error('Invalid response from server. Please check server logs.');
        }
        if (error instanceof TypeError && String(error.message).toLowerCase().includes('fetch')) {
            throw new Error(`Network error while calling ${API_BASE}${endpoint}. Confirm server is running on ${window.location.origin}.`);
        }
        throw error;
    }
}

// Authentication functions
async function login(event) {
    event.preventDefault();
    
    try {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Signing In...';
        submitBtn.disabled = true;
        
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        showDashboard();
        if (currentUser.mustChangePassword) {
            setTimeout(() => {
                openChangePasswordModal(true);
            }, 100);
        }
        
    } catch (error) {
        alert('Login failed: ' + error.message);
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Sign In';
            submitBtn.disabled = false;
        }
    }
}

function waitForGoogleLibrary(maxAttempts = 25, delayMs = 200) {
    return new Promise((resolve) => {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts += 1;
            if (window.google && window.google.accounts && window.google.accounts.id) {
                clearInterval(timer);
                resolve(true);
                return;
            }
            if (attempts >= maxAttempts) {
                clearInterval(timer);
                resolve(false);
            }
        }, delayMs);
    });
}

async function initializeGoogleLogin() {
    const section = document.getElementById('googleLoginSection');
    const buttonContainer = document.getElementById('googleLoginButton');
    if (!section || !buttonContainer) return;

    section.style.display = 'none';

    let config;
    try {
        config = await apiCall('/auth/google-config');
    } catch (error) {
        return;
    }

    if (!config || !config.enabled || !config.clientId) {
        return;
    }

    const googleLoaded = await waitForGoogleLibrary();
    if (!googleLoaded) {
        return;
    }

    if (googleLoginInitialized && googleLoginClientId === config.clientId) {
        section.style.display = 'block';
        return;
    }

    googleLoginClientId = config.clientId;
    window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: handleGoogleCredentialResponse
    });

    buttonContainer.innerHTML = '';
    window.google.accounts.id.renderButton(buttonContainer, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 280
    });

    section.style.display = 'block';
    googleLoginInitialized = true;
}

async function handleGoogleCredentialResponse(googleResponse) {
    try {
        if (!googleResponse || !googleResponse.credential) {
            throw new Error('Google login token was not received');
        }

        const data = await apiCall('/auth/google-login', {
            method: 'POST',
            body: JSON.stringify({ credential: googleResponse.credential })
        });

        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        showDashboard();
        if (currentUser.mustChangePassword) {
            setTimeout(() => {
                openChangePasswordModal(true);
            }, 100);
        }
    } catch (error) {
        alert(`Google login failed: ${error.message}`);
    }
}

function showLogin() {
    document.getElementById('loginForm').style.display = 'flex';
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    initializeGoogleLogin();
}

function showRegister() {
    alert('Self-signup is disabled. Please contact HR for your account credentials.');
}

function logout() {
    clearAuthAndShowLogin();
    location.reload();
}

function openChangePasswordModal(forceChange = false) {
    const existingModal = document.getElementById('changePasswordModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'changePasswordModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 460px;">
            <div class="modal-header">
                <h3>${forceChange ? 'Set New Password' : 'Change Password'}</h3>
                ${forceChange ? '' : `
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                `}
            </div>
            <form onsubmit="submitPasswordChange(event, ${forceChange ? 'true' : 'false'})" class="modal-form">
                <div class="form-group">
                    <label>Current Password</label>
                    <input type="password" id="currentPassword" required>
                </div>
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" id="newPassword" required minlength="6">
                </div>
                <div class="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" id="confirmPassword" required minlength="6">
                </div>
                <div class="modal-actions">
                    ${forceChange ? '' : '<button type="button" class="btn btn-secondary" onclick="this.closest(\'.modal\').remove()">Cancel</button>'}
                    <button type="submit" class="btn btn-primary">${forceChange ? 'Update Password' : 'Save'}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitPasswordChange(event, forceChange) {
    event.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 6) {
        alert('New password must be at least 6 characters.');
        return;
    }
    if (newPassword !== confirmPassword) {
        alert('New password and confirm password do not match.');
        return;
    }
    if (newPassword === currentPassword) {
        alert('New password must be different from current password.');
        return;
    }

    try {
        await apiCall('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        currentUser.mustChangePassword = false;
        alert('Password updated successfully.');
        const modal = document.getElementById('changePasswordModal');
        if (modal) modal.remove();
    } catch (error) {
        alert(`Could not change password: ${error.message}`);
        if (forceChange) {
            openChangePasswordModal(true);
        }
    }
}

// Dashboard functions
function showDashboard() {
    document.getElementById('loginForm').style.display = 'none';
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.style.display = 'none';
    const dashboard = document.getElementById('dashboard');
    dashboard.style.display = 'flex';
    
    document.getElementById('userInfo').textContent = currentUser.username;
    document.getElementById('userRole').textContent = (currentUser.roles || [currentUser.role]).join(', ');
    
    // Show/hide navigation based on role
    updateNavigationForRole();
    
    // Check if employee - redirect to My Performance
    const roles = currentUser.roles || [currentUser.role];
    const isEmployee = !roles.some(r => ['hr'].includes(r));
    const isHR = roles.includes('hr');
    dashboard.classList.toggle('hr-mode', isHR);

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.style.display = isHR ? 'inline-flex' : 'none';
    }
    
    // Hide search bar initially for HR and Employee
    const searchContainer = document.querySelector('.search-container');
    if (isHR || isEmployee) {
        searchContainer.style.visibility = 'hidden';
    }
    
    if (isEmployee) {
        showSection('myperformance');
    } else {
        showSection('overview');
    }
}

function updateNavigationForRole() {
    const roles = currentUser.roles || [currentUser.role];
    const isHR = roles.includes('hr');
    const isEmployee = !roles.some(r => ['hr'].includes(r));
    
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const span = item.querySelector('span');
        if (!span) return;
        
        const text = span.textContent;
        
        if (isHR) {
            // HR sees Dashboard, Employees, Projects, and Leaves
            if (text === 'Dashboard' || text === 'Employees' || text === 'Projects' || text === 'Leaves') {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        } else if (isEmployee) {
            // Employee sees My Performance, Projects, and Leaves
            if (text === 'My Performance' || text === 'Projects' || text === 'Leaves') {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        } else {
            item.style.display = 'flex';
        }
    });
}

function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    const sectionElement = document.getElementById(section + 'Section');
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const span = item.querySelector('span');
        if (span) {
            const itemSection = {
                'Dashboard': 'overview',
                'My Performance': 'myperformance',
                'Reviews': 'reviews',
                'Employees': 'employees',
                'Projects': 'projects',
                'Leaves': 'leaves',
                'Forms': 'forms',
                'Reports': 'reports'
            }[span.textContent];
            
            if (itemSection === section) {
                item.classList.add('active');
            }
        }
    });
    
    // Show/hide search bar based on role and section
    const roles = currentUser.roles || [currentUser.role];
    const isHR = roles.includes('hr');
    const isEmployee = !roles.some(r => ['hr'].includes(r));
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('searchInput');
    
    if (isHR) {
        // HR: show search on employees and projects pages
        searchContainer.style.visibility = (section === 'employees' || section === 'projects') ? 'visible' : 'hidden';
        if (searchInput) searchInput.value = '';
    } else if (isEmployee) {
        // Employee: show search only on projects page
        searchContainer.style.visibility = section === 'projects' ? 'visible' : 'hidden';
        if (searchInput) searchInput.value = '';
    } else {
        searchContainer.style.visibility = 'visible';
    }
    
    loadSectionData(section);
}

function loadSectionData(section) {
    switch(section) {
        case 'overview':
            loadDashboardData();
            break;
        case 'myperformance':
            loadPerformanceDashboard(currentUser.id, true);
            break;
        case 'reviews':
            loadAllReviews();
            break;
        case 'employees':
            loadEmployeesList();
            break;
        case 'projects':
            loadProjectsSection();
            break;
        case 'leaves':
            loadLeavesSection();
            break;
        case 'forms':
            loadFormsSection();
            break;
    }
}

async function loadAllReviews() {
    try {
        const container = document.getElementById('myReviews');
        container.innerHTML = '<div class="table-card"><div class="table-header"><h4>Loading...</h4></div></div>';
        
        const roles = currentUser.roles || [currentUser.role];
        const isEmployee = !roles.some(r => ['hr'].includes(r));
        
        if (isEmployee) {
            const reviews = await apiCall(`/reviews/employee/${currentUser.id}`);
            displayEmployeeReviews(reviews);
        } else {
            try {
                const reviews = await apiCall('/reviews/all');
                displayAllReviews(reviews);
            } catch (error) {
                displayAllReviews([]);
            }
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        document.getElementById('myReviews').innerHTML = '<div class="table-card"><div class="table-header"><h4>No reviews available</h4></div></div>';
    }
}

function displayEmployeeReviews(reviews) {
    const container = document.getElementById('myReviews');
    
    if (reviews.length === 0) {
        container.innerHTML = '<div class="table-card"><div class="table-header"><h4>My Reviews</h4></div><p style="padding: 24px;">No reviews found</p></div>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-card">
            <div class="table-header">
                <h4>My Performance Reviews</h4>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Period</th>
                            <th>Reviewer</th>
                            <th>Rating</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reviews.map(review => `
                            <tr>
                                <td>${review.period}</td>
                                <td>${review.reviewer?.username || 'N/A'}</td>
                                <td><div class="rating-stars">${'★'.repeat(Math.floor(review.overallScore || 0))}${'☆'.repeat(5 - Math.floor(review.overallScore || 0))}</div></td>
                                <td><span class="status-badge status-${review.status}">${review.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function displayAllReviews(reviews) {
    const container = document.getElementById('myReviews');
    
    container.innerHTML = `
        <div class="table-card">
            <div class="table-header">
                <h4>All Performance Reviews</h4>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Reviewer</th>
                            <th>Period</th>
                            <th>Rating</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reviews.length === 0 ? 
                            '<tr><td colspan="5">No reviews found</td></tr>' :
                            reviews.map(review => `
                                <tr>
                                    <td>${review.employee?.username || 'N/A'}</td>
                                    <td>${review.reviewer?.username || 'N/A'}</td>
                                    <td>${review.period || 'N/A'}</td>
                                    <td><div class="rating-stars">${'★'.repeat(Math.floor(review.overallScore || 0))}${'☆'.repeat(5 - Math.floor(review.overallScore || 0))}</div></td>
                                    <td><span class="status-badge status-${review.status || 'draft'}">${review.status || 'Draft'}</span></td>
                                </tr>
                            `).join('')
                        }
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function loadFormsSection() {
    const container = document.getElementById('formsSection');
    container.innerHTML = `
        <div class="form-card">
            <h3>Add Performance Criteria</h3>
            <form onsubmit="addCriteria(event)" class="form-grid">
                <div class="form-group">
                    <label>Criteria Name</label>
                    <input type="text" id="criteriaName" required placeholder="e.g., Communication Skills">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="criteriaDesc" rows="3" placeholder="Describe what this criteria measures"></textarea>
                </div>
                <div class="form-group">
                    <label>Weight</label>
                    <input type="number" id="criteriaWeight" value="1" min="1" max="10">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Add Criteria</button>
                </div>
            </form>
        </div>
        <div id="criteriaList"></div>
    `;
    loadCriteriaList();
}

async function loadCriteriaList() {
    try {
        const criteria = await apiCall('/criteria');
        const container = document.getElementById('criteriaList');
        
        if (criteria.length === 0) {
            container.innerHTML = `
                <div class="table-card" style="margin-top: 24px;">
                    <div class="table-header">
                        <h4>Performance Criteria</h4>
                    </div>
                    <div style="padding: 24px; text-align: center; color: #64748b;">
                        <p>No criteria created yet. Add your first criteria above.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="table-card" style="margin-top: 24px;">
                <div class="table-header">
                    <h4>Performance Criteria</h4>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Weight</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${criteria.map(c => `
                                <tr>
                                    <td>${c.name}</td>
                                    <td>${c.description || 'N/A'}</td>
                                    <td>${c.weight}</td>
                                    <td><span class="status-badge status-${c.isActive ? 'completed' : 'draft'}">${c.isActive ? 'Active' : 'Inactive'}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading criteria:', error);
    }
}

async function addCriteria(event) {
    event.preventDefault();
    try {
        const criteriaData = {
            name: document.getElementById('criteriaName').value,
            description: document.getElementById('criteriaDesc').value,
            weight: parseInt(document.getElementById('criteriaWeight').value)
        };
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        await apiCall('/criteria', {
            method: 'POST',
            body: JSON.stringify(criteriaData)
        });
        
        alert('Criteria added successfully');
        event.target.reset();
        document.getElementById('criteriaWeight').value = '1';
        loadCriteriaList();
        
    } catch (error) {
        alert('Error adding criteria: ' + error.message);
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Add Criteria';
            submitBtn.disabled = false;
        }
    }
}

// Review form functions
function showReviewForm() {
    document.getElementById('reviewModal').style.display = 'flex';
    loadEmployeesForReview();
}

function closeReviewForm() {
    document.getElementById('reviewModal').style.display = 'none';
    document.getElementById('reviewModal').querySelector('form').reset();
}

async function loadEmployeesForReview() {
    try {
        const users = await apiCall('/users');
        const select = document.getElementById('reviewEmployee');
        select.innerHTML = '<option value="">Select Employee</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user._id;
            const roles = user.roles ? user.roles.join(', ') : user.role;
            option.textContent = `${user.username} (${roles})`;
            select.appendChild(option);
        });
        
        // Try to load criteria
        try {
            const criteria = await apiCall('/criteria');
            const ratingsDiv = document.getElementById('criteriaRatings');
            ratingsDiv.innerHTML = '';
            
            if (criteria.length === 0) {
                ratingsDiv.innerHTML = `
                    <div style="padding: 16px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; color: #92400e;">
                        <strong>No criteria available!</strong>
                        <p style="margin-top: 8px; font-size: 14px;">Please create performance criteria first before creating reviews.</p>
                        <p style="margin-top: 8px; font-size: 14px;">Go to Forms section to add criteria.</p>
                    </div>
                `;
                // Disable submit button
                const submitBtn = document.querySelector('#reviewModal button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Create Criteria First';
                }
                return;
            }
            
            criteria.forEach(c => {
                const div = document.createElement('div');
                div.className = 'rating-item';
                div.innerHTML = `
                    <h4>${c.name}</h4>
                    <select name="score-${c._id}" required>
                        <option value="">Select Rating</option>
                        <option value="1">1 - Poor</option>
                        <option value="2">2 - Below Average</option>
                        <option value="3">3 - Average</option>
                        <option value="4">4 - Good</option>
                        <option value="5">5 - Excellent</option>
                    </select>
                    <textarea name="comment-${c._id}" placeholder="Comments" rows="2"></textarea>
                `;
                ratingsDiv.appendChild(div);
            });
            
            // Enable submit button
            const submitBtn = document.querySelector('#reviewModal button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Review';
            }
        } catch (error) {
            const ratingsDiv = document.getElementById('criteriaRatings');
            ratingsDiv.innerHTML = `
                <div style="padding: 16px; background: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; color: #991b1b;">
                    <strong>Error loading criteria!</strong>
                    <p style="margin-top: 8px; font-size: 14px;">${error.message}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading employees for review:', error);
        alert('Error loading form data: ' + error.message);
    }
}

async function createReview(event) {
    event.preventDefault();
    
    try {
        const employee = document.getElementById('reviewEmployee').value;
        const period = document.getElementById('reviewPeriod').value;
        const feedback = document.getElementById('reviewFeedback').value;
        
        if (!employee) {
            alert('Please select an employee');
            return;
        }
        
        if (!period.trim()) {
            alert('Please enter a review period');
            return;
        }
        
        const ratings = [];
        const criteria = await apiCall('/criteria');
        
        let hasErrors = false;
        criteria.forEach(c => {
            const scoreElement = document.querySelector(`[name="score-${c._id}"]`);
            const score = scoreElement ? scoreElement.value : '';
            const comment = document.querySelector(`[name="comment-${c._id}"]`)?.value || '';
            
            if (!score) {
                alert(`Please select a rating for ${c.name}`);
                hasErrors = true;
            } else {
                ratings.push({
                    criteria: c._id,
                    score: parseInt(score),
                    comment
                });
            }
        });
        
        if (hasErrors) return;
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        
        await apiCall('/reviews', {
            method: 'POST',
            body: JSON.stringify({
                employee,
                period: period.trim(),
                ratings,
                feedback: feedback.trim(),
                status: 'completed'
            })
        });
        
        alert('Review created successfully');
        closeReviewForm();
        loadDashboardData();
        
    } catch (error) {
        console.error('Error creating review:', error);
        alert('Error creating review: ' + error.message);
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Save Review';
            submitBtn.disabled = false;
        }
    }
}

async function loadDashboardData(selectedMonthKey = null) {
    try {
        const roles = currentUser.roles || [currentUser.role];
        const isHR = roles.includes('hr');

        // Keep the existing dashboard widgets for non-HR users.
        if (!isHR) {
            let users = [];
            let reviews = [];
            try {
                users = await apiCall('/users');
            } catch (err) {
                console.error('Error loading users:', err);
            }
            try {
                reviews = await apiCall('/reviews/all');
            } catch (err) {
                console.error('Error loading reviews:', err);
            }

            const employees = users.filter(u => {
                const userRoles = u.roles || [u.role];
                return userRoles.includes('employee');
            });
            const completedReviews = reviews.filter(r => r.status === 'completed').length;
            const avgRating = reviews.length > 0
                ? (reviews.reduce((sum, r) => sum + (r.overallScore || 0), 0) / reviews.length).toFixed(1)
                : '0.0';
            const completionRate = reviews.length > 0
                ? Math.round((completedReviews / reviews.length) * 100)
                : 0;

            const totalEmployeesEl = document.getElementById('totalEmployees');
            const avgRatingEl = document.getElementById('avgRating');
            const completionRateEl = document.getElementById('completionRate');
            if (totalEmployeesEl) totalEmployeesEl.textContent = employees.length;
            if (avgRatingEl) avgRatingEl.textContent = avgRating;
            if (completionRateEl) completionRateEl.textContent = `${completionRate}%`;

            updateRatingDistribution(reviews);
            updateReviewStatus(reviews);
            loadRecentReviews(reviews);
            return;
        }

        const [users, projects, leaves, reviews] = await Promise.all([
            apiCall('/users'),
            apiCall('/projects').catch(() => []),
            apiCall('/leaves').catch(() => []),
            apiCall('/reviews/all').catch(() => [])
        ]);
        const currentMonthKey = toMonthKey(new Date());
        hrDashboardSelectedMonth = selectedMonthKey || hrDashboardSelectedMonth || currentMonthKey;
        const dashboardMonthKey = hrDashboardSelectedMonth;
        const dashboardMonthLabel = formatMonthKey(dashboardMonthKey);

        const employees = users.filter(u => {
            const userRoles = u.roles || [u.role];
            return userRoles.includes('employee');
        });

        const employeePerfDetails = await Promise.all(
            employees.map(async (employee) => {
                try {
                    const perf = await apiCall(`/performance/${employee._id}`);
                    return { id: employee._id, data: perf };
                } catch (error) {
                    return { id: employee._id, data: null };
                }
            })
        );

        const performanceMap = new Map(employeePerfDetails.map(item => [item.id, item.data]));

        const employeePerformance = employees.map(employee => {
            const perfData = performanceMap.get(employee._id);
            const metrics = perfData?.performanceMetrics || {};
            const circularScore = Number(metrics.circularScore || 0);
            const attendance = Number(metrics.attendance || 0);
            const monthlyPerformance = perfData?.monthlyPerformance || [];
            const selectedMonthEntry = monthlyPerformance.find(entry => entry.month === dashboardMonthKey);
            const selectedScore = dashboardMonthKey === currentMonthKey
                ? circularScore
                : Number(selectedMonthEntry?.score || 0);
            return {
                id: employee._id,
                username: employee.username || 'Employee',
                department: employee.department || 'General',
                score: circularScore,
                selectedScore,
                attendance,
                monthlyPerformance
            };
        });

        const topPerformers = employeePerformance
            .filter(item => item.selectedScore > 0)
            .sort((a, b) => b.selectedScore - a.selectedScore)
            .slice(0, 5);

        const bandCounts = { excellent: 0, good: 0, average: 0, poor: 0 };
        employeePerformance.forEach(item => {
            if (item.selectedScore >= 90) bandCounts.excellent += 1;
            else if (item.selectedScore >= 75) bandCounts.good += 1;
            else if (item.selectedScore >= 60) bandCounts.average += 1;
            else bandCounts.poor += 1;
        });
        const maxBand = Math.max(...Object.values(bandCounts), 1);

        const scoreValues = employeePerformance.map(item => item.selectedScore).filter(score => score > 0);
        const companyAverageScore = scoreValues.length > 0
            ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
            : 0;

        const monthReviews = reviews.filter(review => {
            const sourceDate = review.completedAt || review.createdAt;
            if (!sourceDate) return false;
            const reviewDate = new Date(sourceDate);
            const reviewKey = toMonthKey(reviewDate);
            return reviewKey === dashboardMonthKey;
        });
        const completedReviews = monthReviews.filter(r => r.status === 'completed').length;
        const completionRate = monthReviews.length > 0 ? Math.round((completedReviews / monthReviews.length) * 100) : 0;
        const pendingLeaves = leaves.filter(l => l.status === 'pending').length;

        const attendanceValues = employeePerformance.map(item => item.attendance).filter(value => value > 0);
        const averageAttendance = attendanceValues.length > 0
            ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length)
            : 0;
        const lowAttendanceCount = employeePerformance.filter(item => item.attendance > 0 && item.attendance < 75).length;
        const monthlyLeaves = leaves.filter(leave => {
            if (!leave.createdAt) return false;
            return toMonthKey(new Date(leave.createdAt)) === dashboardMonthKey;
        });
        const monthlyRejectedLeaves = monthlyLeaves.filter(leave => leave.status === 'rejected').length;

        const departmentMap = new Map();
        employeePerformance.forEach(item => {
            const existing = departmentMap.get(item.department) || { total: 0, count: 0 };
            existing.total += item.selectedScore;
            existing.count += 1;
            departmentMap.set(item.department, existing);
        });

        const departmentRows = Array.from(departmentMap.entries())
            .map(([name, value]) => ({
                name,
                score: value.count > 0 ? Math.round(value.total / value.count) : 0,
                employees: value.count
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 4);

        const monthLabels = [];
        const monthValues = [];
        const trendEndMonth = monthKeyToDate(dashboardMonthKey) || new Date();
        for (let i = 3; i >= 0; i -= 1) {
            const date = new Date(trendEndMonth);
            date.setMonth(trendEndMonth.getMonth() - i);
            const monthKey = toMonthKey(date);
            monthLabels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));

            const scores = monthKey === currentMonthKey
                ? employeePerformance
                    .map(item => Number(item.score || 0))
                    .filter(score => score > 0)
                : employeePerformance
                    .flatMap(item => item.monthlyPerformance || [])
                    .filter(entry => entry.month === monthKey)
                    .map(entry => Number(entry.score || 0))
                    .filter(score => score > 0);

            if (scores.length > 0) {
                monthValues.push(Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length));
            } else {
                const monthReviews = reviews.filter(review => {
                    const sourceDate = review.completedAt || review.createdAt;
                    if (!sourceDate) return false;
                    return toMonthKey(new Date(sourceDate)) === monthKey;
                });
                const monthAverage = monthReviews.length > 0
                    ? monthReviews.reduce((sum, r) => sum + Number(r.overallScore || 0), 0) / monthReviews.length
                    : 0;
                monthValues.push(Math.round((monthAverage / 5) * 100));
            }
        }
        const trendWidth = 520;
        const trendHeight = 190;
        const chartPad = 20;
        const trendMin = Math.min(...monthValues, 50);
        const trendMax = Math.max(...monthValues, 100);
        const trendRange = Math.max(trendMax - trendMin, 1);
        const trendPoints = monthValues.map((value, index) => {
            const x = chartPad + (index * ((trendWidth - (chartPad * 2)) / Math.max(monthValues.length - 1, 1)));
            const y = trendHeight - chartPad - (((value - trendMin) / trendRange) * (trendHeight - (chartPad * 2)));
            return { x, y, value, label: monthLabels[index] };
        });
        const trendPolyline = trendPoints.map(point => `${point.x},${point.y}`).join(' ');
        const trendAreaPath = `${trendPolyline} ${trendPoints[trendPoints.length - 1]?.x || chartPad},${trendHeight - chartPad} ${trendPoints[0]?.x || chartPad},${trendHeight - chartPad}`;

        const recentActivities = [
            ...reviews.slice(0, 4).map(review => ({
                icon: 'fa-star',
                text: `${review.employee?.username || 'Employee'} completed review ${review.period || ''}`.trim(),
                time: review.createdAt
            })),
            ...leaves.slice(0, 3).map(leave => ({
                icon: 'fa-calendar-check',
                text: `${leave.employee?.username || 'Employee'} requested ${leave.leaveType} leave`,
                time: leave.createdAt
            })),
            ...projects.slice(0, 2).map(project => ({
                icon: 'fa-folder-open',
                text: `Project "${project.name}" is active`,
                time: project.updatedAt || project.createdAt
            }))
        ]
            .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
            .slice(0, 6);

        const overviewSection = document.getElementById('overviewSection');
        overviewSection.innerHTML = `
            <div class="hr-modern">
                <div class="hr-modern-header">
                    <div class="hr-modern-header-top">
                        <div>
                            <h2>Online Performance Review System</h2>
                            <p>HR Dashboard</p>
                        </div>
                        <div class="hr-modern-header-actions">
                            <select id="hrDashboardMonthSelector" class="btn btn-secondary btn-sm" onchange="changeHRDashboardMonth(this.value)" style="min-width: 170px;">
                                ${getRecentMonthKeys(12).map(monthKey => `
                                    <option value="${monthKey}" ${monthKey === dashboardMonthKey ? 'selected' : ''}>
                                        ${formatMonthKey(monthKey)}
                                    </option>
                                `).join('')}
                            </select>
                            <span class="hr-modern-user">${currentUser.username}</span>
                            <button class="btn btn-secondary btn-sm" onclick="logout()">
                                <i class="fas fa-sign-out-alt"></i> Logout
                            </button>
                        </div>
                    </div>
                </div>

                <div class="hr-action-row">
                    <button class="btn btn-primary" onclick="showSection('employees')">
                        <i class="fas fa-user-plus"></i> Add Employee
                    </button>
                </div>

                <div class="hr-modern-grid">
                    <div class="hr-main-col">
                        <div class="table-card hr-panel">
                            <div class="table-header">
                                <h4>Employee Performance Distribution</h4>
                            </div>
                            <div class="hr-distribution">
                                <div class="hr-distribution-bars">
                                    <div class="hr-dist-item">
                                        <div class="hr-dist-count">${bandCounts.excellent}</div>
                                        <div class="hr-dist-bar bar-excellent" style="height: ${(bandCounts.excellent / maxBand) * 140 + 18}px;"></div>
                                        <small>Excellent</small>
                                    </div>
                                    <div class="hr-dist-item">
                                        <div class="hr-dist-count">${bandCounts.good}</div>
                                        <div class="hr-dist-bar bar-good" style="height: ${(bandCounts.good / maxBand) * 140 + 18}px;"></div>
                                        <small>Good</small>
                                    </div>
                                    <div class="hr-dist-item">
                                        <div class="hr-dist-count">${bandCounts.average}</div>
                                        <div class="hr-dist-bar bar-average" style="height: ${(bandCounts.average / maxBand) * 140 + 18}px;"></div>
                                        <small>Average</small>
                                    </div>
                                    <div class="hr-dist-item">
                                        <div class="hr-dist-count">${bandCounts.poor}</div>
                                        <div class="hr-dist-bar bar-poor" style="height: ${(bandCounts.poor / maxBand) * 140 + 18}px;"></div>
                                        <small>Poor</small>
                                    </div>
                                </div>
                                <div class="hr-score-ring" style="--completion:${companyAverageScore};">
                                    <div class="hr-score-ring-inner">
                                        <strong>${companyAverageScore}%</strong>
                                        <span>Company Avg Score</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="table-card hr-panel">
                            <div class="table-header">
                                <h4>Attendance Overview</h4>
                            </div>
                            <div class="hr-attendance">
                                <div class="hr-attendance-ring" style="--attendance:${averageAttendance};">
                                    <div class="hr-attendance-ring-inner">
                                        <strong>${averageAttendance}%</strong>
                                        <span>Average Attendance</span>
                                    </div>
                                </div>
                                <div class="hr-attendance-stats">
                                    <div class="hr-kpi-mini">
                                        <span>Employees Below 75%</span>
                                        <strong>${lowAttendanceCount}</strong>
                                    </div>
                                    <div class="hr-kpi-mini">
                                        <span>Leaves (${dashboardMonthLabel})</span>
                                        <strong>${monthlyLeaves.length}</strong>
                                    </div>
                                    <div class="hr-kpi-mini">
                                        <span>Rejected Leaves</span>
                                        <strong>${monthlyRejectedLeaves}</strong>
                                    </div>
                                    <div class="hr-kpi-mini">
                                        <span>Review Completion (${dashboardMonthLabel})</span>
                                        <strong>${completionRate}%</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="table-card hr-panel">
                            <div class="table-header">
                                <h4>Monthly Performance Trend</h4>
                            </div>
                            <div class="hr-trend-line-wrap">
                                <svg class="hr-trend-svg" viewBox="0 0 ${trendWidth} ${trendHeight}" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="hrTrendFill" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stop-color="#67c4de" stop-opacity="0.35"></stop>
                                            <stop offset="100%" stop-color="#67c4de" stop-opacity="0.03"></stop>
                                        </linearGradient>
                                    </defs>
                                    <path d="M ${trendAreaPath}" fill="url(#hrTrendFill)"></path>
                                    <polyline points="${trendPolyline}" fill="none" stroke="#2da5c8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
                                    ${trendPoints.map(point => `
                                        <circle cx="${point.x}" cy="${point.y}" r="5" fill="#1f9ac0" stroke="#ffffff" stroke-width="2"></circle>
                                        <text x="${point.x}" y="${point.y - 12}" text-anchor="middle" class="hr-trend-value">${point.value}%</text>
                                    `).join('')}
                                </svg>
                                <div class="hr-trend-labels">
                                    ${monthLabels.map(label => `<span>${label}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="hr-side-col">
                        <div class="table-card hr-panel">
                            <div class="table-header">
                                <h4>Top Performers</h4>
                            </div>
                            <div class="hr-list">
                                ${topPerformers.length === 0
                                    ? '<p class="hr-empty">No completed reviews yet</p>'
                                    : topPerformers.map((person, index) => `
                                        <div class="hr-list-item">
                                            <div class="hr-avatar">${getInitials(person.username)}</div>
                                            <div class="hr-list-text">
                                                <strong>${person.username}</strong>
                                                <small>${person.department}</small>
                                            </div>
                                            <div class="hr-list-score ${index === 0 ? 'is-top' : ''}">${person.selectedScore}%</div>
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>

                        <div class="table-card hr-panel">
                            <div class="table-header">
                                <h4>Department Wise Performance</h4>
                            </div>
                            <div class="hr-list">
                                ${departmentRows.length === 0
                                    ? '<p class="hr-empty">No department data</p>'
                                    : departmentRows.map(row => `
                                        <div class="hr-list-item">
                                            <div class="hr-list-text">
                                                <strong>${row.name}</strong>
                                                <small>${row.employees} employees</small>
                                            </div>
                                            <div class="hr-list-score">${row.score}%</div>
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>

                        <div class="table-card hr-panel">
                            <div class="table-header">
                                <h4>Recent Activities</h4>
                            </div>
                            <div class="hr-list">
                                <div class="hr-kpi-mini">
                                    <span>Total Employees</span>
                                    <strong>${employees.length}</strong>
                                </div>
                                <div class="hr-kpi-mini">
                                    <span>Open Projects</span>
                                    <strong>${projects.length}</strong>
                                </div>
                                <div class="hr-kpi-mini">
                                    <span>Pending Leaves</span>
                                    <strong>${pendingLeaves}</strong>
                                </div>
                                ${recentActivities.map(activity => `
                                    <div class="hr-activity">
                                        <i class="fas ${activity.icon}"></i>
                                        <span>${activity.text}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).slice(0, 2);
    if (parts.length === 0) return 'U';
    return parts.map(p => p[0].toUpperCase()).join('');
}

function changeHRDashboardMonth(monthKey) {
    hrDashboardSelectedMonth = monthKey;
    loadDashboardData(monthKey);
}

function hrDashboardAction(actionName) {
    if (actionName === 'Send Warning Email') {
        openWarningEmailEmployeePage();
        return;
    }
    alert(`${actionName} is available in the next update.`);
}

function openWarningEmailEmployeePage() {
    employeesSectionMode = 'warning-email';
    showSection('employees');
}

function openGmailWarningCompose(recipientEmail, employeeName) {
    const subject = `Performance Warning - ${employeeName}`;
    const body = `Hi ${employeeName},%0A%0AThis is a warning regarding your recent performance. Please meet HR to discuss next steps.%0A%0ARegards,%0AHR Team`;
    const hrEmail = (currentUser && currentUser.email) ? String(currentUser.email).trim().toLowerCase() : 'hr.reviewpro@gmail.com';
    const gmailUrl = `https://mail.google.com/mail/?authuser=${encodeURIComponent(hrEmail)}&view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${body}`;
    const win = window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
        window.location.href = gmailUrl;
    }
}

// HR Projects List (separate from employee projects)
async function showHRProjectsList() {
    try {
        const projects = await apiCall('/projects');
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>All Projects</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 24px;">
                    <button class="btn btn-primary" onclick="showCreateProjectModal(); this.closest('.modal').remove();" style="margin-bottom: 24px;">
                        <i class="fas fa-plus"></i> Create New Project
                    </button>
                    ${projects.length === 0 ? 
                        '<div style="text-align: center; padding: 48px; color: #64748b;"><i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i><p>No projects yet</p></div>' :
                        `<div class="projects-grid">
                            ${projects.map(p => renderHRProjectCard(p)).join('')}
                        </div>`
                    }
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error loading projects: ' + error.message);
    }
}

function renderHRProjectCard(project) {
    const statusColors = {
        'active': 'success',
        'completed': 'info',
        'on-hold': 'warning',
        'cancelled': 'danger'
    };
    
    const teamCount = project.teamMembers ? project.teamMembers.length : 0;
    
    return `
        <div class="project-card">
            <div class="project-header">
                <h3>${project.name}</h3>
                <span class="status-badge status-${statusColors[project.status]}">${project.status}</span>
            </div>
            <p class="project-description">${project.description || 'No description'}</p>
            <div class="project-meta">
                <div><i class="fas fa-calendar"></i> ${new Date(project.startDate).toLocaleDateString()}</div>
                <div><i class="fas fa-users"></i> ${teamCount} members</div>
            </div>
            <div class="project-actions">
                <button class="btn btn-primary btn-sm" onclick="viewHRProjectDetails('${project._id}')">View Details</button>
            </div>
        </div>
    `;
}

async function viewHRProjectDetails(projectId) {
    try {
        const project = await apiCall(`/projects/${projectId}`);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>${project.name}</h3>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); showAddMemberModal('${project._id}')">
                            <i class="fas fa-user-plus"></i> Add Member
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteProject('${project._id}', '${project.name}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div style="padding: 24px;">
                    <p><strong>Description:</strong> ${project.description || 'No description'}</p>
                    <p><strong>Status:</strong> <span class="status-badge">${project.status}</span></p>
                    <p><strong>Start Date:</strong> ${new Date(project.startDate).toLocaleDateString()}</p>
                    ${project.endDate ? `<p><strong>End Date:</strong> ${new Date(project.endDate).toLocaleDateString()}</p>` : ''}
                    
                    <h4 style="margin-top: 24px;">Team Members</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px;">
                        ${project.teamMembers && project.teamMembers.length > 0 ? 
                            project.teamMembers.map(m => `<span class="badge">${m.username || m.email || 'Unknown'}</span>`).join('') :
                            '<span style="color: #64748b;">No team members</span>'
                        }
                    </div>
                    
                    <h4>Daily Logs</h4>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Employee</th>
                                    <th>Work Done</th>
                                    <th>Hours</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${!project.dailyLogs || project.dailyLogs.length === 0 ? 
                                    '<tr><td colspan="5" style="text-align: center;">No logs submitted yet</td></tr>' :
                                    project.dailyLogs.sort((a, b) => new Date(b.date) - new Date(a.date)).map(log => `
                                        <tr>
                                            <td>${new Date(log.date).toLocaleDateString()}</td>
                                            <td>${log.employee?.username || 'Unknown'}</td>
                                            <td>${log.workDone}</td>
                                            <td>${log.hoursSpent}h</td>
                                            <td><span class="status-badge status-${log.status === 'completed' ? 'completed' : log.status === 'blocked' ? 'draft' : 'pending'}">${log.status}</span></td>
                                        </tr>
                                    `).join('')
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error loading project details: ' + error.message);
    }
}

function updateRatingDistribution(reviews) {
    const ratingCounts = [0, 0, 0, 0, 0];
    
    reviews.forEach(review => {
        const rating = Math.floor(review.overallScore || 0);
        if (rating >= 1 && rating <= 5) {
            ratingCounts[rating - 1]++;
        }
    });
    
    const maxCount = Math.max(...ratingCounts, 1);
    const chartHtml = ratingCounts.map((count, index) => {
        const height = maxCount > 0 ? (count / maxCount * 100) : 0;
        return `<div class="bar" style="height: ${height}%"><span>${index + 1}★</span><small>${count}</small></div>`;
    }).join('');
    
    document.getElementById('ratingsChart').innerHTML = `<div class="bar-chart">${chartHtml}</div>`;
}

function updateReviewStatus(reviews) {
    const total = reviews.length;
    const completed = reviews.filter(r => r.status === 'completed').length;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('statusChart').innerHTML = `
        <div class="donut-chart">
            <div class="donut-center">
                <span>${completionPercent}%</span>
                <small>Complete</small>
            </div>
            <div class="donut-info">
                <p><strong>${completed}</strong> Completed</p>
                <p><strong>${total - completed}</strong> Pending</p>
                <p><strong>${total}</strong> Total</p>
            </div>
        </div>
    `;
}

function loadRecentReviews(reviews = []) {
    const tbody = document.getElementById('reviewsTableBody');
    
    if (reviews.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No reviews found</td></tr>';
        return;
    }
    
    tbody.innerHTML = reviews.slice(0, 5).map(review => `
        <tr>
            <td>${review.employee?.username || 'N/A'}</td>
            <td>${review.reviewer?.username || 'N/A'}</td>
            <td><div class="rating-stars">${'★'.repeat(Math.floor(review.overallScore || 0))}${'☆'.repeat(5 - Math.floor(review.overallScore || 0))}</div></td>
            <td>${review.period || 'N/A'}</td>
            <td><span class="status-badge status-${review.status || 'draft'}">${review.status || 'Draft'}</span></td>
            <td><button class="btn btn-secondary btn-sm">View</button></td>
        </tr>
    `).join('');
}

function openCreateEmployeeModal() {
    const existingModal = document.getElementById('createEmployeeModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'createEmployeeModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 560px;">
            <div class="modal-header">
                <h3>Create Employee Account</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="createEmployeeAccount(event)" class="modal-form">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="newEmployeeUsername" required placeholder="e.g., ramesh">
                </div>
                <div class="form-group">
                    <label>Department (optional)</label>
                    <input type="text" id="newEmployeeDepartment" placeholder="e.g., Engineering">
                </div>
                <div class="form-group">
                    <label>Login Policy</label>
                    <div style="padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #475569; font-size: 13px;">
                        Employee email is auto-generated as <strong>name.reviewpro@gmail.com</strong> and login is <strong>Google-only</strong>.
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create Employee</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function createEmployeeAccount(event) {
    event.preventDefault();
    const username = document.getElementById('newEmployeeUsername').value.trim();
    const department = document.getElementById('newEmployeeDepartment').value.trim();

    if (!username) {
        alert('Username is required.');
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
    }

    try {
        const response = await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify({
                username,
                department: department || undefined
            })
        });

        const approvedEmail = response?.user?.email || response?.onboarding?.approvedGoogleEmail || 'generated email';
        alert(
            `Employee "${username}" created.\n` +
            `Approved Google email: ${approvedEmail}\n` +
            `Login policy: Google-only`
        );

        const modal = document.getElementById('createEmployeeModal');
        if (modal) modal.remove();
        await loadEmployeesList();
    } catch (error) {
        alert(`Could not create employee: ${error.message}`);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Employee';
        }
    }
}

async function loadEmployeesList() {
    try {
        const users = await apiCall('/users');
        const container = document.getElementById('employeesList');
        
        // Filter to show only employees
        const employees = users.filter(u => {
            const roles = u.roles || [u.role];
            return roles.includes('employee');
        });

        if (employeesSectionMode === 'warning-email') {
            container.innerHTML = `
                <div class="table-card">
                    <div class="table-header">
                        <h4>Send Warning Email</h4>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="color: #64748b; font-size: 14px;">${employees.length} Employees</span>
                            <button class="btn btn-secondary btn-sm" onclick="employeesSectionMode='management'; loadEmployeesList();">
                                <i class="fas fa-arrow-left"></i> Back to Employee Management
                            </button>
                        </div>
                    </div>
                    <div style="padding: 16px 24px; color: #64748b;">
                        Click an employee name to open Gmail compose addressed to that employee.
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Employee Name</th>
                                    <th>Email</th>
                                    <th>Department</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employees.length === 0
                                    ? '<tr><td colspan="3" style="text-align: center; padding: 32px; color: #64748b;">No employees found.</td></tr>'
                                    : employees.map(user => `
                                        <tr>
                                            <td>
                                                <button class="btn btn-link" style="padding: 0; font-weight: 600;" onclick="openGmailWarningCompose('${user.email}', '${String(user.username || '').replace(/'/g, "\\'")}')">
                                                    ${user.username}
                                                </button>
                                            </td>
                                            <td>${user.email}</td>
                                            <td>${user.department || 'Not specified'}</td>
                                        </tr>
                                    `).join('')
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="table-card">
                <div class="table-header">
                    <h4>Employee Management</h4>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="color: #64748b; font-size: 14px;">${employees.length} Employees</span>
                        <button class="btn btn-primary btn-sm" onclick="openCreateEmployeeModal()">
                            <i class="fas fa-user-plus"></i> Create Employee
                        </button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Department</th>
                                <th>Joined Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${employees.length === 0 ? 
                                '<tr><td colspan="5" style="text-align: center; padding: 32px; color: #64748b;">No employees found. Use "Create Employee" to add the first employee.</td></tr>' :
                                employees.map(user => `
                                    <tr>
                                        <td><strong>${user.username}</strong></td>
                                        <td>${user.email}</td>
                                        <td>${user.department || 'Not specified'}</td>
                                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <button class="btn btn-primary btn-sm" onclick="viewEmployeeDashboard('${user._id}', '${user.username}')">View Dashboard</button>
                                            ${currentUser.roles.includes('hr') ? 
                                                `<button class="btn btn-danger btn-sm" style="margin-left: 8px;" onclick="deleteEmployee('${user._id}', '${user.username}')">Delete</button>` : ''}
                                        </td>
                                    </tr>
                                `).join('')
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading employees:', error);
        document.getElementById('employeesList').innerHTML = '<div class="table-card"><div class="table-header"><h4>Error loading employees</h4></div></div>';
    }
}

async function viewEmployeeDashboard(employeeId, employeeName) {
    try {
        const perfData = await apiCall(`/performance/${employeeId}`);
        const reviews = await apiCall(`/reviews/employee/${employeeId}`);
        const currentYear = new Date().getFullYear();
        
        let attendanceFromLeaves = null;
        let leaveDaysThisYear = 0;
        let hasLeaveData = false;
        try {
            const allLeaves = await apiCall('/leaves');
            const approvedEmployeeLeaves = allLeaves.filter(leave => {
                const leaveEmployeeId = leave.employee?._id || leave.employee;
                return String(leaveEmployeeId) === String(employeeId) && leave.status === 'approved';
            });
            hasLeaveData = true;
            leaveDaysThisYear = approvedEmployeeLeaves.reduce((sum, leave) => {
                return sum + calculateLeaveDaysInYear(leave.startDate, leave.endDate, currentYear);
            }, 0);
            const daysInYear = isLeapYear(currentYear) ? 366 : 365;
            attendanceFromLeaves = Math.max(0, Math.min(100, Math.round(((daysInYear - leaveDaysThisYear) / daysInYear) * 100)));
        } catch (leaveError) {
            console.error('Could not compute leave-based attendance:', leaveError);
        }
        
        const avgRating = reviews.length > 0 ? 
            (reviews.reduce((sum, r) => sum + (r.overallScore || 0), 0) / reviews.length).toFixed(1) : '0';
        const completedReviews = reviews.filter(r => r.status === 'completed').length;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1200px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>${employeeName}'s Performance Dashboard</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="employeePerformanceModal" style="padding: 24px;"></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const container = document.getElementById('employeePerformanceModal');
        const metrics = perfData.performanceMetrics || {};
        const attendanceValue = attendanceFromLeaves !== null ? attendanceFromLeaves : (metrics.attendance || 0);
        const computedCurrentScore = Math.round((
            Number(attendanceValue || 0) +
            Number(metrics.tasks || 0) +
            Number(metrics.teamwork || 0) +
            Number(metrics.punctuality || 0)
        ) / 4);
        let computedPerformanceLevel = 'Poor';
        if (computedCurrentScore >= 90) computedPerformanceLevel = 'Excellent';
        else if (computedCurrentScore >= 75) computedPerformanceLevel = 'Good';
        else if (computedCurrentScore >= 60) computedPerformanceLevel = 'Average';
        else if (computedCurrentScore >= 40) computedPerformanceLevel = 'Below Average';
        const attendanceSource = attendanceFromLeaves !== null
            ? `Auto from approved leave in ${currentYear}: ${leaveDaysThisYear} day(s)`
            : 'Attendance metric';
        const achievements = perfData.achievements || [];
        const canEdit = currentUser.roles.some(r => ['hr'].includes(r));
        
        const currentMonth = toMonthKey(new Date());
        const monthOptions = getRecentMonthKeys(12)
            .map(monthKey => `<option value="${monthKey}" ${monthKey === currentMonth ? 'selected' : ''}>${formatMonthKey(monthKey)}</option>`)
            .join('');
        employeeModalMonthContext = {
            currentMonth,
            currentScore: computedCurrentScore,
            monthlyMap: new Map((perfData.monthlyPerformance || []).map(entry => [entry.month, Number(entry.score || 0)]))
        };
        
        container.innerHTML = `
            <div class="performance-dashboard">
                <div style="margin-bottom: 24px;">
                    <label>Select Month: </label>
                    <select id="monthSelector" onchange="updateEmployeeDashboard('${employeeId}', this.value)" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
                        ${monthOptions}
                    </select>
                </div>
                
                <div class="performance-overview">
                    <div class="circular-score-card">
                        <h3>Overall Performance Score</h3>
                        <div class="circular-score">
                            <svg width="180" height="180">
                                <circle cx="90" cy="90" r="70" fill="none" stroke="#f1f5f9" stroke-width="12"/>
                                <circle cx="90" cy="90" r="70" fill="none" stroke="#3b82f6" stroke-width="12"
                                    data-employee-score-circle="true"
                                    stroke-dasharray="${2 * Math.PI * 70}" 
                                    stroke-dashoffset="${2 * Math.PI * 70 * (1 - (computedCurrentScore / 100))}"
                                    stroke-linecap="round"/>
                            </svg>
                            <div class="circular-score-text">
                                <div class="circular-score-value" data-employee-score-value="true">${computedCurrentScore}</div>
                                <div class="circular-score-label">out of 100</div>
                            </div>
                        </div>
                        <div class="performance-level-badge level-${computedPerformanceLevel.toLowerCase().replace(' ', '-')}" data-employee-performance-level="true">
                            ${computedPerformanceLevel}
                        </div>
                    </div>
                    
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <h4>Attendance</h4>
                            <div class="metric-value" data-employee-metric="attendance">${attendanceValue}%</div>
                            <div style="font-size: 12px; color: #64748b;">${attendanceSource}</div>
                            ${hasLeaveData ? `<button class="btn btn-sm btn-secondary" style="margin-top: 10px;" onclick="showEmployeeLeaveDaysModal('${employeeId}', '${employeeName}', ${currentYear})">View Leave Days</button>` : ''}
                        </div>
                        <div class="metric-card">
                            <h4>Tasks</h4>
                            <div class="metric-value" data-employee-metric="tasks">${metrics.tasks || 0}%</div>
                            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="editEmployeeModalMetric('${employeeId}', 'tasks')">Edit</button>` : ''}
                        </div>
                        <div class="metric-card">
                            <h4>Teamwork</h4>
                            <div class="metric-value" data-employee-metric="teamwork">${metrics.teamwork || 0}%</div>
                            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="editEmployeeModalMetric('${employeeId}', 'teamwork')">Edit</button>` : ''}
                        </div>
                        <div class="metric-card">
                            <h4>Punctuality</h4>
                            <div class="metric-value" data-employee-metric="punctuality">${metrics.punctuality || 0}%</div>
                            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="editEmployeeModalMetric('${employeeId}', 'punctuality')">Edit</button>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="leaderboard-card">
                    <h3><i class="fas fa-trophy"></i> Monthly Leaderboard</h3>
                    <div id="modalLeaderboardContainer" class="leaderboard-list"></div>
                </div>
                
                <div class="table-card" style="margin-top: 24px;">
                    <div class="table-header">
                        <h4>Performance Reviews</h4>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Period</th>
                                    <th>Reviewer</th>
                                    <th>Rating</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reviews.length === 0 ? 
                                    '<tr><td colspan="5" style="text-align: center; padding: 24px;">No reviews yet</td></tr>' :
                                    reviews.map(review => `
                                        <tr>
                                            <td>${review.period}</td>
                                            <td>${review.reviewer?.username || 'N/A'}</td>
                                            <td><div class="rating-stars">${'★'.repeat(Math.floor(review.overallScore || 0))}${'☆'.repeat(5 - Math.floor(review.overallScore || 0))}</div></td>
                                            <td><span class="status-badge status-${review.status}">${review.status}</span></td>
                                            <td>${new Date(review.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    `).join('')
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        updateEmployeeDashboard(employeeId, currentMonth);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
    } catch (error) {
        console.error('Error loading employee dashboard:', error);
        alert('Error loading employee dashboard: ' + error.message);
    }
}

function generateEmployeeRatingChart(reviews) {
    const ratingCounts = [0, 0, 0, 0, 0];
    
    reviews.forEach(review => {
        const rating = Math.floor(review.overallScore || 0);
        if (rating >= 1 && rating <= 5) {
            ratingCounts[rating - 1]++;
        }
    });
    
    const maxCount = Math.max(...ratingCounts, 1);
    const bars = ratingCounts.map((count, index) => {
        const height = maxCount > 0 ? (count / maxCount * 100) : 0;
        return `<div class="bar" style="height: ${height}%"><span>${index + 1}★</span><small>${count}</small></div>`;
    }).join('');
    
    return `<div class="bar-chart">${bars}</div>`;
}

// Delete employee function
async function deleteEmployee(employeeId, employeeName) {
    if (!confirm(`Are you sure you want to delete employee "${employeeName}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        await apiCall(`/users/${employeeId}`, {
            method: 'DELETE'
        });
        
        alert('Employee deleted successfully!');
        loadEmployeesList();
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting employee: ' + error.message);
    }
}

// Delete project function
async function deleteProject(projectId, projectName) {
    if (!confirm(`Are you sure you want to delete project "${projectName}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        await apiCall(`/projects/${projectId}`, {
            method: 'DELETE'
        });
        
        document.querySelectorAll('.modal').forEach(m => m.remove());
        alert('Project deleted successfully!');
        showHRProjectsList();
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting project: ' + error.message);
    }
}

// Search handler
function handleSearch(query) {
    const roles = currentUser.roles || [currentUser.role];
    const isHR = roles.includes('hr');
    const isEmployee = !roles.some(r => ['hr'].includes(r));
    
    if (isHR) {
        searchEmployees(query);
    } else if (isEmployee) {
        searchProjects(query);
    }
}

function searchEmployees(query) {
    const rows = document.querySelectorAll('#employeesList tbody tr');
    const searchTerm = query.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function searchProjects(query) {
    const cards = document.querySelectorAll('.project-card');
    const searchTerm = query.toLowerCase();
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Create project modal
async function showCreateProjectModal() {
    try {
        const users = await apiCall('/users');
        const employees = users.filter(u => (u.roles || [u.role]).includes('employee'));
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>Create New Project</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form onsubmit="createProject(event)" class="modal-form">
                    <div class="form-group">
                        <label>Project Name</label>
                        <input type="text" id="projectName" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="projectDescription" rows="4" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Tech Stack (comma separated)</label>
                        <input type="text" id="projectTechStack" placeholder="e.g., React, Node.js, MongoDB" required>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="projectStatus" required>
                            <option value="ongoing">Ongoing</option>
                            <option value="completed">Completed</option>
                            <option value="on-hold">On Hold</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="date" id="projectStartDate" required>
                    </div>
                    <div class="form-group">
                        <label>Completed Date (optional)</label>
                        <input type="date" id="projectCompletedDate">
                    </div>
                    <div class="form-group">
                        <label>Team Members</label>
                        <div id="teamMembersContainer"></div>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="addTeamMemberField()" style="margin-top: 8px;">
                            <i class="fas fa-plus"></i> Add Team Member
                        </button>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Project</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        window.projectEmployees = employees;
        addTeamMemberField();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function addTeamMemberField() {
    const container = document.getElementById('teamMembersContainer');
    const index = container.children.length;
    
    const div = document.createElement('div');
    div.className = 'team-member-field';
    div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
    div.innerHTML = `
        <select name="teamMember${index}" style="flex: 2;" required>
            <option value="">Select Employee</option>
            ${window.projectEmployees.map(e => `<option value="${e._id}">${e.username}</option>`).join('')}
        </select>
        <input type="text" name="teamRole${index}" placeholder="Role (e.g., Developer)" style="flex: 1;" required>
        <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
}

async function createProject(event) {
    event.preventDefault();
    
    try {
        const container = document.getElementById('teamMembersContainer');
        const teamMembers = [];
        
        for (let i = 0; i < container.children.length; i++) {
            const employeeSelect = document.querySelector(`[name="teamMember${i}"]`);
            const roleInput = document.querySelector(`[name="teamRole${i}"]`);
            
            if (employeeSelect && roleInput && employeeSelect.value) {
                teamMembers.push({
                    employee: employeeSelect.value,
                    role: roleInput.value
                });
            }
        }
        
        const techStack = document.getElementById('projectTechStack').value
            .split(',')
            .map(t => t.trim())
            .filter(t => t);
        
        const completedDateValue = document.getElementById('projectCompletedDate').value;
        
        const projectData = {
            name: document.getElementById('projectName').value,
            description: document.getElementById('projectDescription').value,
            techStack,
            status: document.getElementById('projectStatus').value,
            startDate: document.getElementById('projectStartDate').value,
            teamMembers
        };
        
        if (completedDateValue) {
            projectData.completedDate = completedDateValue;
        }
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;
        
        await apiCall('/projects', {
            method: 'POST',
            body: JSON.stringify(projectData)
        });
        
        document.querySelectorAll('.modal').forEach(m => m.remove());
        alert('Project created successfully!');
        showHRProjectsList();
    } catch (error) {
        console.error('Error creating project:', error);
        alert('Error creating project: ' + error.message);
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Create Project';
            submitBtn.disabled = false;
        }
    }
}

// Add member to existing project
async function showAddMemberModal(projectId) {
    try {
        const users = await apiCall('/users');
        const employees = users.filter(u => (u.roles || [u.role]).includes('employee'));
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Add Team Member</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form onsubmit="addMemberToProject(event, '${projectId}')" class="modal-form">
                    <div class="form-group">
                        <label>Select Employee</label>
                        <select id="newMemberEmployee" required>
                            <option value="">Select Employee</option>
                            ${employees.map(e => `<option value="${e._id}">${e.username}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Role in Project</label>
                        <input type="text" id="newMemberRole" placeholder="e.g., Developer, Designer" required>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Member</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function addMemberToProject(event, projectId) {
    event.preventDefault();
    
    try {
        const employeeId = document.getElementById('newMemberEmployee').value;
        const role = document.getElementById('newMemberRole').value;
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        const project = await apiCall(`/projects/${projectId}`);
        
        // Check if member already exists
        const exists = project.teamMembers.some(tm => tm.employee._id === employeeId);
        if (exists) {
            alert('This employee is already a member of this project!');
            return;
        }
        
        project.teamMembers.push({ employee: employeeId, role });
        
        await apiCall(`/projects/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(project)
        });
        
        document.querySelectorAll('.modal').forEach(m => m.remove());
        alert('Team member added successfully!');
        viewHRProjectDetails(projectId);
    } catch (error) {
        alert('Error adding member: ' + error.message);
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Add Member';
            submitBtn.disabled = false;
        }
    }
}

// Monthly leaderboard and dashboard functions
async function loadMonthlyLeaderboard(month) {
    try {
        const currentMonth = toMonthKey(new Date());
        const endpoint = month === currentMonth
            ? '/performance/leaderboard/all'
            : `/performance/leaderboard/monthly?month=${encodeURIComponent(month)}`;
        const leaderboard = await apiCall(endpoint);
        const container = document.getElementById('modalLeaderboardContainer');
        
        if (leaderboard.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #64748b;">No data available</p>';
            return;
        }
        
        container.innerHTML = leaderboard.map((user, index) => `
            <div class="leaderboard-item" style="display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid #eee;">
                <div class="rank" style="font-weight: bold;">#${index + 1}</div>
                <div class="user-info" style="flex: 1; margin-left: 12px;">
                    <strong>${user.username}</strong>
                    <small style="display: block; color: #666;">${user.department}</small>
                </div>
                <div class="score" style="font-weight: bold; color: #3b82f6;">${user.score}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        document.getElementById('modalLeaderboardContainer').innerHTML = '<p style="text-align: center; color: #64748b;">Error loading leaderboard</p>';
    }
}

function updateEmployeeDashboard(employeeId, month) {
    if (employeeModalMonthContext) {
        const monthScore = month === employeeModalMonthContext.currentMonth
            ? employeeModalMonthContext.currentScore
            : Number(employeeModalMonthContext.monthlyMap.get(month) || 0);
        const scoreEl = document.querySelector('#employeePerformanceModal [data-employee-score-value="true"]');
        if (scoreEl) scoreEl.textContent = monthScore;
        const circleEl = document.querySelector('#employeePerformanceModal [data-employee-score-circle="true"]');
        if (circleEl) {
            const circumference = 2 * Math.PI * 70;
            const offset = circumference * (1 - (monthScore / 100));
            circleEl.setAttribute('stroke-dashoffset', offset);
        }
    }
    loadMonthlyLeaderboard(month);
}

// Edit metric function for HR employee modal
function editEmployeeModalMetric(employeeId, metricType) {
    if (metricType === 'attendance') {
        alert('Attendance is auto-calculated from approved yearly leave and cannot be edited manually.');
        return;
    }
    let currentValue = 0;
    const metricEl = document.querySelector(`#employeePerformanceModal [data-employee-metric="${metricType}"]`);
    if (metricEl) {
        currentValue = parseInt(String(metricEl.textContent || '0').replace('%', ''), 10) || 0;
    }
    const newValue = prompt(`Enter new ${metricType} value (0-100):`, currentValue);
    if (newValue !== null && !isNaN(newValue) && newValue >= 0 && newValue <= 100) {
        updateEmployeeMetric(employeeId, metricType, parseInt(newValue));
    }
}

async function updateEmployeeMetric(employeeId, metricType, value) {
    try {
        if (metricType === 'attendance') {
            alert('Attendance is auto-calculated from approved yearly leave and cannot be edited manually.');
            return;
        }
        const updateData = {};
        updateData[metricType] = value;
        
        const response = await apiCall(`/performance/${employeeId}/metrics`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });

        if (response && response.performanceMetrics) {
            updateEmployeeModalMetricsUI(response.performanceMetrics);
        }
        
        // Refresh HR dashboard immediately in background
        const roles = currentUser.roles || [currentUser.role];
        const isHR = roles.includes('hr');
        if (isHR) {
            // Update dashboard silently without closing modal
            await loadDashboardData();
        }
        
        alert('Metric updated successfully! Dashboard trend updated.');
    } catch (error) {
        alert('Error updating metric: ' + error.message);
    }
}

function updateEmployeeModalMetricsUI(metrics) {
    if (!metrics) return;

    ['tasks', 'teamwork', 'punctuality'].forEach((metricType) => {
        if (metrics[metricType] === undefined) return;
        const metricEl = document.querySelector(`#employeePerformanceModal [data-employee-metric="${metricType}"]`);
        if (metricEl) {
            metricEl.textContent = `${metrics[metricType]}%`;
        }
    });

    const attendanceEl = document.querySelector('#employeePerformanceModal [data-employee-metric="attendance"]');
    const tasksEl = document.querySelector('#employeePerformanceModal [data-employee-metric="tasks"]');
    const teamworkEl = document.querySelector('#employeePerformanceModal [data-employee-metric="teamwork"]');
    const punctualityEl = document.querySelector('#employeePerformanceModal [data-employee-metric="punctuality"]');

    const attendance = parseInt(String(attendanceEl?.textContent || '0').replace('%', ''), 10) || 0;
    const tasks = parseInt(String(tasksEl?.textContent || '0').replace('%', ''), 10) || 0;
    const teamwork = parseInt(String(teamworkEl?.textContent || '0').replace('%', ''), 10) || 0;
    const punctuality = parseInt(String(punctualityEl?.textContent || '0').replace('%', ''), 10) || 0;
    const computedScore = Math.round((attendance + tasks + teamwork + punctuality) / 4);

    if (employeeModalMonthContext) {
        employeeModalMonthContext.currentScore = computedScore;
    }

    const scoreEl = document.querySelector('#employeePerformanceModal [data-employee-score-value="true"]');
    if (scoreEl) {
        scoreEl.textContent = computedScore;
    }

    const circleEl = document.querySelector('#employeePerformanceModal [data-employee-score-circle="true"]');
    if (circleEl) {
        const circumference = 2 * Math.PI * 70;
        const offset = circumference * (1 - (computedScore / 100));
        circleEl.setAttribute('stroke-dashoffset', offset);
    }

    const levelEl = document.querySelector('#employeePerformanceModal [data-employee-performance-level="true"]');
    if (levelEl) {
        let level = 'Poor';
        if (computedScore >= 90) level = 'Excellent';
        else if (computedScore >= 75) level = 'Good';
        else if (computedScore >= 60) level = 'Average';
        else if (computedScore >= 40) level = 'Below Average';

        levelEl.className = `performance-level-badge level-${level.toLowerCase().replace(' ', '-')}`;
        levelEl.textContent = level;
    }
}

async function showEmployeeLeaveDaysModal(employeeId, employeeName, year) {
    try {
        const allLeaves = await apiCall('/leaves');
        const approvedLeaves = allLeaves
            .filter(leave => {
                const leaveEmployeeId = leave.employee?._id || leave.employee;
                return String(leaveEmployeeId) === String(employeeId) && leave.status === 'approved';
            })
            .map(leave => {
                const dayList = enumerateLeaveDatesInYear(leave.startDate, leave.endDate, year);
                return {
                    leaveType: leave.leaveType || 'other',
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    reason: leave.reason || '',
                    days: dayList
                };
            })
            .filter(leave => leave.days.length > 0)
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        const allDays = approvedLeaves.flatMap(leave => leave.days);
        const uniqueDays = [...new Set(allDays)].sort();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>${employeeName} - Approved Leave Days (${year})</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 0 24px 24px;">
                    <div class="table-card" style="margin-bottom: 16px;">
                        <div class="table-header">
                            <h4>Total Leave Days</h4>
                            <span style="font-weight: 700; color: #1e40af;">${uniqueDays.length}</span>
                        </div>
                        <div style="padding: 16px;">
                            ${uniqueDays.length === 0
                                ? '<p style="color:#64748b;">No approved leave days in this year.</p>'
                                : `<div style="display:flex;flex-wrap:wrap;gap:8px;">
                                    ${uniqueDays.map(day => `<span class="status-badge status-pending" style="text-transform:none;">${formatUtcDate(day)}</span>`).join('')}
                                </div>`
                            }
                        </div>
                    </div>

                    <div class="table-card">
                        <div class="table-header">
                            <h4>Leave Applications</h4>
                        </div>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Days in ${year}</th>
                                        <th>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${approvedLeaves.length === 0
                                        ? '<tr><td colspan="5" style="text-align:center;">No approved leave records found</td></tr>'
                                        : approvedLeaves.map(leave => `
                                            <tr>
                                                <td style="text-transform: capitalize;">${leave.leaveType}</td>
                                                <td>${formatUtcDate(leave.startDate)}</td>
                                                <td>${formatUtcDate(leave.endDate)}</td>
                                                <td>${leave.days.length}</td>
                                                <td>${leave.reason || '-'}</td>
                                            </tr>
                                        `).join('')
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error loading leave days: ' + error.message);
    }
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function calculateLeaveDaysInYear(startDate, endDate, year) {
    if (!startDate || !endDate) return 0;
    const leaveStart = new Date(startDate);
    const leaveEnd = new Date(endDate);

    if (Number.isNaN(leaveStart.getTime()) || Number.isNaN(leaveEnd.getTime())) {
        return 0;
    }

    const yearStart = Date.UTC(year, 0, 1);
    const yearEnd = Date.UTC(year, 11, 31);

    const leaveStartUtc = Date.UTC(leaveStart.getUTCFullYear(), leaveStart.getUTCMonth(), leaveStart.getUTCDate());
    const leaveEndUtc = Date.UTC(leaveEnd.getUTCFullYear(), leaveEnd.getUTCMonth(), leaveEnd.getUTCDate());

    const overlapStart = Math.max(leaveStartUtc, yearStart);
    const overlapEnd = Math.min(leaveEndUtc, yearEnd);

    if (overlapEnd < overlapStart) return 0;
    return Math.floor((overlapEnd - overlapStart) / 86400000) + 1;
}

function enumerateLeaveDatesInYear(startDate, endDate, year) {
    if (!startDate || !endDate) return [];

    const leaveStart = new Date(startDate);
    const leaveEnd = new Date(endDate);
    if (Number.isNaN(leaveStart.getTime()) || Number.isNaN(leaveEnd.getTime())) {
        return [];
    }

    const yearStart = Date.UTC(year, 0, 1);
    const yearEnd = Date.UTC(year, 11, 31);

    let current = Math.max(
        Date.UTC(leaveStart.getUTCFullYear(), leaveStart.getUTCMonth(), leaveStart.getUTCDate()),
        yearStart
    );
    const last = Math.min(
        Date.UTC(leaveEnd.getUTCFullYear(), leaveEnd.getUTCMonth(), leaveEnd.getUTCDate()),
        yearEnd
    );

    if (last < current) return [];

    const days = [];
    while (current <= last) {
        days.push(new Date(current).toISOString().slice(0, 10));
        current += 86400000;
    }
    return days;
}

function formatUtcDate(dateInput) {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Projects functions - removed, now in projects.js

// Initialize app
if (token) {
    const payload = parseJwtPayload(token);
    if (!payload || isTokenExpired(payload)) {
        clearAuthAndShowLogin();
    } else {
        currentUser = {
            id: payload.id,
            username: payload.username || 'User',
            email: payload.email || '',
            roles: payload.roles || ['employee'],
            role: payload.roles ? payload.roles[0] : 'employee',
            mustChangePassword: Boolean(payload.mustChangePassword)
        };
        showDashboard();
        if (currentUser.mustChangePassword) {
            setTimeout(() => {
                openChangePasswordModal(true);
            }, 100);
        }
    }
} else {
    initializeGoogleLogin();
}

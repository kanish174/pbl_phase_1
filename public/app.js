// Global variables
let currentUser = null;
let token = localStorage.getItem('token');
const API_BASE = '/api';

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
        
        if (!response.ok) throw new Error(data.message || 'Request failed');
        return data;
    } catch (error) {
        if (error.name === 'SyntaxError') {
            console.error('JSON parsing error:', error);
            throw new Error('Invalid response from server. Please check server logs.');
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
        
    } catch (error) {
        alert('Login failed: ' + error.message);
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Sign In';
            submitBtn.disabled = false;
        }
    }
}

async function register(event) {
    event.preventDefault();
    
    try {
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const department = document.getElementById('regDepartment').value.trim();
        
        if (!username || !email || !password) {
            alert('Username, email, and password are required');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;
        
        console.log('Sending registration request...');
        
        // New employees automatically get 'employee' role
        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username,
                email,
                password,
                roles: ['employee'],
                department: department || undefined
            })
        });
        
        alert('Registration successful! You can now log in.');
        showLogin();
        event.target.reset();
        
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed: ' + error.message);
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Create Account';
            submitBtn.disabled = false;
        }
    }
}

function showLogin() {
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    location.reload();
}

// Dashboard functions
function showDashboard() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    
    document.getElementById('userInfo').textContent = currentUser.username;
    document.getElementById('userRole').textContent = (currentUser.roles || [currentUser.role]).join(', ');
    
    // Show/hide navigation based on role
    updateNavigationForRole();
    
    // Check if employee - redirect to My Performance
    const roles = currentUser.roles || [currentUser.role];
    const isEmployee = roles.includes('employee') && !roles.some(r => ['admin', 'manager', 'hr'].includes(r));
    const isHR = roles.includes('hr');
    
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
    const isEmployee = roles.includes('employee') && !roles.some(r => ['admin', 'manager', 'hr'].includes(r));
    
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const span = item.querySelector('span');
        if (!span) return;
        
        const text = span.textContent;
        
        if (isHR) {
            // HR sees only Dashboard and Employees
            if (text === 'Dashboard' || text === 'Employees') {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        } else if (isEmployee) {
            // Employee sees My Performance and Projects
            if (text === 'My Performance' || text === 'Projects') {
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
    const isEmployee = roles.includes('employee') && !roles.some(r => ['admin', 'manager', 'hr'].includes(r));
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('searchInput');
    
    if (isHR) {
        // HR: show search only on employees page
        searchContainer.style.visibility = section === 'employees' ? 'visible' : 'hidden';
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
        const isEmployee = roles.includes('employee') && !roles.some(r => ['admin', 'manager', 'hr'].includes(r));
        
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

async function loadDashboardData() {
    try {
        const users = await apiCall('/users');
        const employees = users.filter(u => {
            const userRoles = u.roles || [u.role];
            return userRoles.includes('employee');
        });
        
        const projects = await apiCall('/projects');
        
        const overviewSection = document.getElementById('overviewSection');
        overviewSection.innerHTML = `
            <div class="hr-dashboard">
                <h2 style="margin-bottom: 32px; color: #1e293b;">HR Dashboard</h2>
                <div class="hr-cards-grid">
                    <div class="hr-card" onclick="showSection('employees')" style="cursor: pointer;">
                        <div class="hr-card-icon" style="background: #dbeafe; color: #1e40af;">
                            <i class="fas fa-users" style="font-size: 32px;"></i>
                        </div>
                        <div class="hr-card-content">
                            <h3>${employees.length}</h3>
                            <p>No. of Employees</p>
                        </div>
                    </div>
                    <div class="hr-card" onclick="showHRProjectsList()" style="cursor: pointer;">
                        <div class="hr-card-icon" style="background: #dcfce7; color: #166534;">
                            <i class="fas fa-project-diagram" style="font-size: 32px;"></i>
                        </div>
                        <div class="hr-card-content">
                            <h3>${projects.length}</h3>
                            <p>No. of Projects</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
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

async function loadEmployeesList() {
    try {
        const users = await apiCall('/users');
        const container = document.getElementById('employeesList');
        
        // Filter to show only employees (not admins/managers)
        const employees = users.filter(u => {
            const roles = u.roles || [u.role];
            return roles.includes('employee');
        });
        
        container.innerHTML = `
            <div class="table-card">
                <div class="table-header">
                    <h4>Employee Management</h4>
                    <span style="color: #64748b; font-size: 14px;">${employees.length} Employees</span>
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
                                '<tr><td colspan="5" style="text-align: center; padding: 32px; color: #64748b;">No employees found. New employees will appear here when they register.</td></tr>' :
                                employees.map(user => `
                                    <tr>
                                        <td><strong>${user.username}</strong></td>
                                        <td>${user.email}</td>
                                        <td>${user.department || 'Not specified'}</td>
                                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <button class="btn btn-primary btn-sm" onclick="viewEmployeeDashboard('${user._id}', '${user.username}')">View Dashboard</button>
                                            ${currentUser.roles.includes('hr') || currentUser.roles.includes('admin') ? 
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
        const achievements = perfData.achievements || [];
        const canEdit = currentUser.roles.some(r => ['admin', 'hr'].includes(r));
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        container.innerHTML = `
            <div class="performance-dashboard">
                <div style="margin-bottom: 24px;">
                    <label>Select Month: </label>
                    <select id="monthSelector" onchange="updateEmployeeDashboard('${employeeId}', this.value)" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
                        <option value="${currentMonth}">${new Date().toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}</option>
                        <option value="${new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().slice(0, 7)}">${new Date(new Date().setMonth(new Date().getMonth()-1)).toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}</option>
                        <option value="${new Date(new Date().setMonth(new Date().getMonth()-2)).toISOString().slice(0, 7)}">${new Date(new Date().setMonth(new Date().getMonth()-2)).toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}</option>
                    </select>
                </div>
                
                <div class="performance-overview">
                    <div class="circular-score-card">
                        <h3>Overall Performance Score</h3>
                        <div class="circular-score">
                            <svg width="180" height="180">
                                <circle cx="90" cy="90" r="70" fill="none" stroke="#f1f5f9" stroke-width="12"/>
                                <circle cx="90" cy="90" r="70" fill="none" stroke="#3b82f6" stroke-width="12"
                                    stroke-dasharray="${2 * Math.PI * 70}" 
                                    stroke-dashoffset="${2 * Math.PI * 70 * (1 - (metrics.circularScore || 0) / 100)}"
                                    stroke-linecap="round"/>
                            </svg>
                            <div class="circular-score-text">
                                <div class="circular-score-value">${metrics.circularScore || 0}</div>
                                <div class="circular-score-label">out of 100</div>
                            </div>
                        </div>
                        <div class="performance-level-badge level-${(metrics.performanceLevel || 'average').toLowerCase().replace(' ', '-')}">
                            ${metrics.performanceLevel || 'Average'}
                        </div>
                    </div>
                    
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <h4>Attendance</h4>
                            <div class="metric-value">${metrics.attendance || 0}%</div>
                            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="editMetric('${employeeId}', 'attendance', ${metrics.attendance || 0})">Edit</button>` : ''}
                        </div>
                        <div class="metric-card">
                            <h4>Tasks</h4>
                            <div class="metric-value">${metrics.tasks || 0}%</div>
                            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="editMetric('${employeeId}', 'tasks', ${metrics.tasks || 0})">Edit</button>` : ''}
                        </div>
                        <div class="metric-card">
                            <h4>Teamwork</h4>
                            <div class="metric-value">${metrics.teamwork || 0}%</div>
                            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="editMetric('${employeeId}', 'teamwork', ${metrics.teamwork || 0})">Edit</button>` : ''}
                        </div>
                        <div class="metric-card">
                            <h4>Punctuality</h4>
                            <div class="metric-value">${metrics.punctuality || 0}%</div>
                            ${canEdit ? `<button class="btn btn-sm btn-secondary" onclick="editMetric('${employeeId}', 'punctuality', ${metrics.punctuality || 0})">Edit</button>` : ''}
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
        
        loadMonthlyLeaderboard(currentMonth);
        
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
    const isEmployee = roles.includes('employee') && !roles.some(r => ['admin', 'manager', 'hr'].includes(r));
    
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
        const leaderboard = await apiCall(`/performance/leaderboard/all`);
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
    loadMonthlyLeaderboard(month);
}

// Edit metric function
function editMetric(employeeId, metricType, currentValue) {
    const newValue = prompt(`Enter new ${metricType} value (0-100):`, currentValue);
    if (newValue !== null && !isNaN(newValue) && newValue >= 0 && newValue <= 100) {
        updateEmployeeMetric(employeeId, metricType, parseInt(newValue));
    }
}

async function updateEmployeeMetric(employeeId, metricType, value) {
    try {
        const updateData = {};
        updateData[metricType] = value;
        
        await apiCall(`/performance/${employeeId}/metrics`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        alert('Metric updated successfully!');
        // Refresh the modal
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
            const employeeName = modal.querySelector('h3').textContent.replace("'s Performance Dashboard", '');
            viewEmployeeDashboard(employeeId, employeeName);
        }
    } catch (error) {
        alert('Error updating metric: ' + error.message);
    }
}

// Projects functions - removed, now in projects.js

// Initialize app
if (token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUser = {
            id: payload.id,
            username: payload.username || 'User',
            roles: payload.roles || ['employee'],
            role: payload.roles ? payload.roles[0] : 'employee'
        };
        showDashboard();
    } catch (error) {
        localStorage.removeItem('token');
        token = null;
    }
}

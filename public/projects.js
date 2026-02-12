// Load projects section
async function loadProjectsSection() {
    try {
        const projects = await apiCall('/projects');
        const container = document.getElementById('projectsSection');
        const userRoles = currentUser.roles || [currentUser.role] || [];
        const isHR = userRoles.includes('admin') || userRoles.includes('hr');
        
        container.innerHTML = `
            <div class="table-card">
                <div class="table-header">
                    <h4>My Projects</h4>
                    ${isHR ? '<button class="btn btn-primary" onclick="showCreateProjectModal()"><i class="fas fa-plus"></i> Create Project</button>' : ''}
                </div>
                <div class="projects-grid">
                    ${projects.length === 0 ? 
                        '<div style="padding: 48px; text-align: center; color: #64748b;"><i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i><p>No projects assigned yet</p></div>' :
                        projects.map(p => renderProjectCard(p, isHR)).join('')
                    }
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Render project card
function renderProjectCard(project, isHR) {
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
                <button class="btn btn-primary btn-sm" onclick="viewProjectDetails('${project._id}')">View Details</button>
                ${isHR ? `<button class="btn btn-danger btn-sm" onclick="deleteProject('${project._id}')"><i class="fas fa-trash"></i> Delete</button>` : ''}
                ${!isHR ? `<button class="btn btn-secondary btn-sm" onclick="showDailyLogModal('${project._id}')"><i class="fas fa-plus"></i> Add Log</button>` : ''}
            </div>
        </div>
    `;
}

// Show create project modal
async function showCreateProjectModal() {
    try {
        const users = await apiCall('/users');
        const employees = users.filter(u => (u.roles || [u.role]).includes('employee'));
        
        // Store globally
        window.projectEmployees = employees;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Create New Project</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 24px;">
                    <div class="form-group">
                        <label>Project Name</label>
                        <input type="text" id="projectName" required autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="projectDescription" rows="3" autocomplete="off"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="date" id="projectStartDate" required>
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="date" id="projectEndDate">
                    </div>
                    <div class="form-group">
                        <label>Team Members</label>
                        <div id="teamMembersContainer"></div>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="addProjectTeamMember()" style="margin-top: 8px;">
                            <i class="fas fa-plus"></i> Add Team Member
                        </button>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitCreateProject()">Create Project</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add first team member dropdown
        addProjectTeamMember();
    } catch (error) {
        alert('Error loading form: ' + error.message);
    }
}

// Add team member dropdown
function addProjectTeamMember() {
    const container = document.getElementById('teamMembersContainer');
    const index = container.children.length;
    
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
    div.innerHTML = `
        <select class="team-member-select" style="flex: 1;" required>
            <option value="">Select Employee</option>
            ${window.projectEmployees.map(e => `<option value="${e._id}">${e.username} (${e.email})</option>`).join('')}
        </select>
        ${index > 0 ? '<button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>' : ''}
    `;
    container.appendChild(div);
}

// Submit create project
async function submitCreateProject() {
    try {
        const name = document.getElementById('projectName').value.trim();
        const startDate = document.getElementById('projectStartDate').value;
        
        if (!name) {
            alert('Please enter project name');
            return;
        }
        
        if (!startDate) {
            alert('Please select start date');
            return;
        }
        
        // Get all selected team members
        const selects = document.querySelectorAll('.team-member-select');
        const teamMembers = Array.from(selects)
            .map(s => s.value)
            .filter(v => v);
        
        if (teamMembers.length === 0) {
            alert('Please select at least one team member');
            return;
        }
        
        const projectData = {
            name,
            description: document.getElementById('projectDescription').value.trim(),
            startDate,
            teamMembers
        };
        
        const endDate = document.getElementById('projectEndDate').value;
        if (endDate) {
            projectData.endDate = endDate;
        }
        
        await apiCall('/projects', {
            method: 'POST',
            body: JSON.stringify(projectData)
        });
        
        document.querySelector('.modal').remove();
        alert('Project created successfully!');
        loadProjectsSection();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// View project details
async function viewProjectDetails(projectId) {
    try {
        const project = await apiCall(`/projects/${projectId}`);
        const userRoles = currentUser.roles || [currentUser.role] || [];
        const isHR = userRoles.includes('admin') || userRoles.includes('hr');
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>${project.name}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
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
                    ${!isHR ? `<button class="btn btn-secondary btn-sm" style="margin-bottom: 16px;" onclick="this.closest('.modal').remove(); showDailyLogModal('${projectId}')">
                        <i class="fas fa-plus"></i> Add Today's Log
                    </button>` : ''}
                    
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
                                            <td style="max-width: 300px; word-wrap: break-word;">${log.workDone || 'No description'}</td>
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

// Show daily log modal
function showDailyLogModal(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Submit Daily Log</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="submitDailyLog(event, '${projectId}')" class="modal-form">
                <div class="form-group">
                    <label>Work Done Today</label>
                    <textarea id="logWorkDone" rows="4" required placeholder="Describe what you accomplished today..."></textarea>
                </div>
                <div class="form-group">
                    <label>Hours Spent</label>
                    <input type="number" id="logHours" min="0" max="24" step="0.5" required>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="logStatus" required>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Submit Log</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// Submit daily log
async function submitDailyLog(event, projectId) {
    event.preventDefault();
    try {
        const workDone = document.getElementById('logWorkDone').value;
        const hoursSpent = parseFloat(document.getElementById('logHours').value);
        const status = document.getElementById('logStatus').value;
        
        if (!workDone || !hoursSpent || !status) {
            alert('Please fill all fields');
            return;
        }
        
        console.log('Submitting log:', { projectId, workDone, hoursSpent, status });
        console.log('Token:', token);
        console.log('API URL:', `${API_BASE}/projects/${projectId}/logs`);
        
        const response = await fetch(`${API_BASE}/projects/${projectId}/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ workDone, hoursSpent, status })
        });
        
        console.log('Response status:', response.status);
        const text = await response.text();
        console.log('Response text:', text);
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error('Server returned: ' + text.substring(0, 200));
        }
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        event.target.closest('.modal').remove();
        alert('Daily log submitted successfully!');
        loadProjectsSection();
    } catch (error) {
        console.error('Submit log error:', error);
        alert('Error submitting log: ' + error.message);
    }
}

// Delete project
async function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
        return;
    }
    
    try {
        await apiCall(`/projects/${projectId}`, { method: 'DELETE' });
        alert('Project deleted successfully!');
        loadProjectsSection();
    } catch (error) {
        alert('Error deleting project: ' + error.message);
    }
}

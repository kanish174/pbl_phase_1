// Load projects section
async function loadProjectsSection() {
    try {
        const projects = await apiCall('/projects');
        const container = document.getElementById('projectsSection');
        const userRoles = currentUser.roles || [currentUser.role] || [];
        const isHR = userRoles.includes('hr');
        
        console.log('Loading projects section');
        console.log('Current user:', currentUser);
        console.log('User roles:', userRoles);
        console.log('Is HR:', isHR);
        
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
    console.log('Rendering project card, isHR:', isHR);
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
                ${isHR ? `<button class="btn btn-secondary btn-sm" onclick="setDeadline('${project._id}')"><i class="fas fa-clock"></i> Set Deadline</button>` : ''}
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
        const isHR = userRoles.includes('hr');
        
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
                    
                    ${project.logDeadline && project.logDeadline.date ? `
                        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                            <strong><i class="fas fa-clock"></i> Deadline:</strong> 
                            ${new Date(project.logDeadline.date).toLocaleDateString()} at ${project.logDeadline.time || '23:59'}
                            ${project.logDeadline.message ? `<br><small>${project.logDeadline.message}</small>` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Employee</th>
                                    <th>Work Done</th>
                                    <th>Hours</th>
                                    <th>Status</th>
                                    ${isHR ? '<th>Action</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${!project.dailyLogs || project.dailyLogs.length === 0 ? 
                                    `<tr><td colspan="${isHR ? 6 : 5}" style="text-align: center;">No logs submitted yet</td></tr>` :
                                    project.dailyLogs.sort((a, b) => new Date(b.date) - new Date(a.date)).map(log => `
                                        ${(() => {
                                            const rawReasonStatus = log.reasonReviewStatus || (log.reasonApproved ? 'approved' : '');
                                            const reasonStatus = log.missedDeadline
                                                ? ((rawReasonStatus === 'approved' || rawReasonStatus === 'rejected') ? rawReasonStatus : 'pending')
                                                : 'not_required';
                                            const reasonStatusHtml = log.missedDeadline
                                                ? `<br><small style="display:inline-block;margin-top:4px;" class="status-badge status-${reasonStatus === 'approved' ? 'completed' : reasonStatus === 'rejected' ? 'draft' : 'pending'}">Reason ${reasonStatus}</small>`
                                                : '';
                                            const actionHtml = (isHR && reasonStatus === 'pending')
                                                ? `<td style="white-space: nowrap;">
                                                    <button class="btn btn-primary btn-sm" onclick="approveReason('${project._id}', '${log._id}')">Approve</button>
                                                    <button class="btn btn-danger btn-sm" style="margin-left: 6px;" onclick="rejectReason('${project._id}', '${log._id}')">Reject</button>
                                                </td>`
                                                : (isHR ? '<td>-</td>' : '');
                                            return `
                                        <tr style="${log.missedDeadline && !log.reasonApproved ? 'background: #fef3c7;' : ''}">
                                            <td>${new Date(log.date).toLocaleDateString()}</td>
                                            <td>${log.employee?.username || 'Unknown'}</td>
                                            <td style="max-width: 300px; word-wrap: break-word;">
                                                ${log.workDone || 'No description'}
                                                ${log.missedDeadline ? '<br><span style="color: #f59e0b; font-size: 12px;"><i class="fas fa-exclamation-triangle"></i> Missed Deadline</span>' : ''}
                                                ${log.missedReason ? `<br><small style="color: #64748b;">Reason: ${log.missedReason}</small>` : ''}
                                                ${reasonStatusHtml}
                                            </td>
                                            <td>${log.hoursSpent}h</td>
                                            <td><span class="status-badge status-${log.status === 'completed' ? 'completed' : log.status === 'blocked' ? 'draft' : 'pending'}">${log.status}</span></td>
                                            ${actionHtml}
                                        </tr>
                                    `;
                                        })()}
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
    // First check if deadline passed
    apiCall(`/projects/${projectId}`).then(project => {
        let deadlinePassed = false;
        if (project.logDeadline && project.logDeadline.date) {
            const deadlineDate = new Date(project.logDeadline.date);
            const [hours, minutes] = (project.logDeadline.time || '23:59').split(':');
            deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            deadlinePassed = new Date() > deadlineDate;
        }
        
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
                    ${deadlinePassed ? `
                        <div style="background: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 12px; margin-bottom: 16px; color: #991b1b;">
                            <strong><i class="fas fa-exclamation-circle"></i> Deadline Passed!</strong>
                            <p style="margin-top: 8px; font-size: 14px;">You must provide a reason for late submission. HR will review and approve.</p>
                        </div>
                        <div class="form-group">
                            <label>Reason for Late Submission *</label>
                            <textarea id="missedReason" rows="3" required placeholder="Explain why you couldn't submit on time..."></textarea>
                        </div>
                    ` : ''}
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
    }).catch(error => {
        alert('Error loading project: ' + error.message);
    });
}

// Submit daily log
async function submitDailyLog(event, projectId) {
    event.preventDefault();
    try {
        const workDone = document.getElementById('logWorkDone').value;
        const hoursSpent = parseFloat(document.getElementById('logHours').value);
        const status = document.getElementById('logStatus').value;
        const missedReasonEl = document.getElementById('missedReason');
        const missedReason = missedReasonEl ? missedReasonEl.value : null;
        
        if (!workDone || !hoursSpent || !status) {
            alert('Please fill all fields');
            return;
        }
        
        const logData = { workDone, hoursSpent, status };
        if (missedReason) {
            logData.missedReason = missedReason;
        }
        
        const response = await fetch(`${API_BASE}/projects/${projectId}/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(logData)
        });
        
        const text = await response.text();
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
        alert(data.message);
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

// Set deadline for daily logs (HR only)
async function setDeadline(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Set Daily Log Deadline</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="submitDeadline(event, '${projectId}')" class="modal-form">
                <div class="form-group">
                    <label>Deadline Date</label>
                    <input type="date" id="deadlineDate" required>
                </div>
                <div class="form-group">
                    <label>Deadline Time</label>
                    <input type="time" id="deadlineTime" value="23:59" required>
                </div>
                <div class="form-group">
                    <label>Message to Team (Optional)</label>
                    <textarea id="deadlineMessage" rows="2" placeholder="e.g., Please submit logs by end of day"></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Set Deadline</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// Submit deadline
async function submitDeadline(event, projectId) {
    event.preventDefault();
    try {
        const date = document.getElementById('deadlineDate').value;
        const time = document.getElementById('deadlineTime').value;
        const message = document.getElementById('deadlineMessage').value;
        
        await apiCall(`/projects/${projectId}/deadline`, {
            method: 'PUT',
            body: JSON.stringify({ date, time, message })
        });
        
        event.target.closest('.modal').remove();
        alert('Deadline set successfully!');
        loadProjectsSection();
    } catch (error) {
        alert('Error setting deadline: ' + error.message);
    }
}

// Approve missed log reason (HR only)
async function approveReason(projectId, logId) {
    if (!confirm('Approve this late submission reason?')) {
        return;
    }
    
    try {
        await apiCall(`/projects/${projectId}/logs/${logId}/approve`, {
            method: 'PUT'
        });
        
        alert('Reason approved!');
        // Refresh the current view
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
            viewProjectDetails(projectId);
        }
    } catch (error) {
        alert('Error approving reason: ' + error.message);
    }
}

// Reject missed log reason (HR only)
async function rejectReason(projectId, logId) {
    if (!confirm('Reject this late submission reason?')) {
        return;
    }
    
    try {
        await apiCall(`/projects/${projectId}/logs/${logId}/reject`, {
            method: 'PUT'
        });
        
        alert('Reason rejected!');
        // Refresh the current view
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.remove();
            viewProjectDetails(projectId);
        }
    } catch (error) {
        alert('Error rejecting reason: ' + error.message);
    }
}

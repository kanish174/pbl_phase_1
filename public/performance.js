// Load performance dashboard for a user
async function loadPerformanceDashboard(userId, isOwnDashboard = true) {
    try {
        const data = await apiCall(`/performance/${userId}`);
        renderPerformanceDashboard(data, userId, isOwnDashboard);
    } catch (error) {
        console.error('Error loading performance dashboard:', error);
        document.getElementById('performanceDashboard').innerHTML = `
            <div class="table-card">
                <div class="table-header">
                    <h4>Performance Dashboard</h4>
                </div>
                <div style="padding: 24px; text-align: center; color: #64748b;">
                    <p>Unable to load performance data. ${error.message}</p>
                </div>
            </div>
        `;
    }
}

// Render performance dashboard
function renderPerformanceDashboard(data, userId, isOwnDashboard) {
    const container = document.getElementById('performanceDashboard');
    const canEdit = currentUser.roles.some(r => ['admin', 'hr'].includes(r));
    
    const metrics = data.performanceMetrics || {};
    const monthlyData = data.monthlyPerformance || [];
    const achievements = data.achievements || [];
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    container.innerHTML = `
        <div class="performance-dashboard">
            <div style="margin-bottom: 24px;">
                <h2>Employee Name: ${data.username}</h2>
                <label>Select Month: </label>
                <select id="employeeMonthSelector" onchange="updateEmployeePerformance(this.value)" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
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
                    ${renderMetricCard('Attendance', metrics.attendance || 0, 'calendar-check', 'attendance', userId, canEdit)}
                    ${renderMetricCard('Tasks', metrics.tasks || 0, 'tasks', 'tasks', userId, canEdit)}
                    ${renderMetricCard('Teamwork', metrics.teamwork || 0, 'users', 'teamwork', userId, canEdit)}
                    ${renderMetricCard('Punctuality', metrics.punctuality || 0, 'clock', 'punctuality', userId, canEdit)}
                </div>
            </div>
            
            <div class="leaderboard-card">
                <h3><i class="fas fa-trophy"></i> Monthly Leaderboard</h3>
                <div id="leaderboardContainer" class="leaderboard-list"></div>
            </div>
            
            <div class="achievements-card">
                <div class="achievements-header">
                    <h3><i class="fas fa-trophy"></i> Achievements & Badges</h3>
                    ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="addAchievement('${userId}')">
                        <i class="fas fa-plus"></i> Add Achievement
                    </button>` : ''}
                </div>
                <div class="achievements-grid">
                    ${achievements.length === 0 ? 
                        '<div class="achievement-empty"><i class="fas fa-award" style="font-size: 48px; margin-bottom: 12px; opacity: 0.3;"></i><p>No achievements yet. Keep up the great work!</p></div>' :
                        achievements.map(a => renderAchievementBadge(a, userId, canEdit)).join('')
                    }
                </div>
            </div>
        </div>
    `;
    
    loadLeaderboard();
}

function updateEmployeePerformance(month) {
    loadLeaderboard();
}

// Render metric card
function renderMetricCard(title, value, icon, type, userId, canEdit) {
    return `
        <div class="metric-card">
            <div class="metric-header">
                <h4>${title}</h4>
                <div class="metric-icon metric-${type}">
                    <i class="fas fa-${icon}"></i>
                </div>
            </div>
            <div class="metric-value">${value}%</div>
            <div class="metric-progress">
                <div class="metric-progress-bar progress-${type}" style="width: ${value}%"></div>
            </div>
            ${canEdit ? `<button class="edit-metric-btn" style="margin-top: 12px;" onclick="editMetric('${userId}', '${type}', ${value})">
                <i class="fas fa-edit"></i> Edit
            </button>` : ''}
        </div>
    `;
}

// Render monthly performance graph
function renderMonthlyGraph(monthlyData) {
    if (monthlyData.length === 0) {
        return '<div style="width: 100%; text-align: center; color: #64748b;">No monthly data available</div>';
    }
    
    const maxScore = Math.max(...monthlyData.map(d => d.score), 100);
    const last12Months = monthlyData.slice(-12);
    
    return last12Months.map(data => {
        const height = (data.score / maxScore) * 100;
        return `
            <div class="graph-bar">
                <div class="graph-bar-fill" style="height: ${height}%">
                    <span class="graph-bar-value">${data.score}</span>
                </div>
                <div class="graph-bar-label">${data.month}</div>
            </div>
        `;
    }).join('');
}

// Render achievement badge
function renderAchievementBadge(achievement, userId, canEdit) {
    const date = new Date(achievement.earnedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `
        <div class="achievement-badge" onclick="showAchievementDetails('${achievement.title}', '${achievement.description}', '${date}')">
            <div class="achievement-icon">${achievement.icon || '🏆'}</div>
            <div class="achievement-title">${achievement.title}</div>
            <div class="achievement-date">${date}</div>
            ${canEdit && currentUser.roles.some(r => ['admin', 'hr'].includes(r)) ? 
                `<button class="btn btn-secondary btn-sm" style="position: absolute; top: 4px; right: 4px; padding: 4px 8px;" 
                    onclick="event.stopPropagation(); deleteAchievement('${userId}', '${achievement._id}')">
                    <i class="fas fa-times"></i>
                </button>` : ''}
        </div>
    `;
}



// Edit metric
async function editMetric(userId, metricType, currentValue) {
    const metricNames = {
        attendance: 'Attendance',
        tasks: 'Tasks Completion',
        teamwork: 'Teamwork',
        punctuality: 'Punctuality'
    };
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit ${metricNames[metricType]}</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="saveMetric(event, '${userId}', '${metricType}')" class="modal-form">
                <div class="form-group">
                    <label>${metricNames[metricType]} Score (0-100%)</label>
                    <input type="number" id="metricValue" min="0" max="100" value="${currentValue}" required>
                </div>
                <div class="info-box" style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 12px; margin: 16px 0; color: #0c4a6e;">
                    <i class="fas fa-calculator"></i>
                    <strong>Auto-calculation:</strong> Overall performance score will be automatically calculated as the average of all four metrics.
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// Save metric
async function saveMetric(event, userId, metricType) {
    event.preventDefault();
    try {
        const value = parseInt(document.getElementById('metricValue').value);
        const updateData = {};
        updateData[metricType] = value;
        
        console.log('Saving metric:', metricType, 'with value:', value);
        console.log('Update data:', updateData);
        console.log('User ID:', userId);
        
        const response = await apiCall(`/performance/${userId}/metrics`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        console.log('Metric update response:', response);
        
        event.target.closest('.modal').remove();
        
        // Immediately update UI with returned data
        if (response.performanceMetrics) {
            updatePerformanceUI(userId, response.performanceMetrics);
        }
        
        alert('Metric updated successfully!');
    } catch (error) {
        console.error('Error updating metric:', error);
        alert('Error updating metric: ' + error.message);
    }
}

// Update performance UI without full reload
function updatePerformanceUI(userId, metrics) {
    console.log('Updating UI with metrics:', metrics);
    
    // Update circular score
    const scoreValue = document.querySelector('.circular-score-value');
    if (scoreValue) {
        scoreValue.textContent = metrics.circularScore || 0;
        console.log('Updated score to:', metrics.circularScore);
    }
    
    // Update performance level badge
    const levelBadge = document.querySelector('.performance-level-badge');
    if (levelBadge) {
        const newLevel = (metrics.performanceLevel || 'average').toLowerCase().replace(' ', '-');
        levelBadge.className = `performance-level-badge level-${newLevel}`;
        levelBadge.textContent = metrics.performanceLevel || 'Average';
        console.log('Updated level badge to:', metrics.performanceLevel);
    }
    
    // Update circular progress
    const circle = document.querySelector('.circular-score svg circle:last-child');
    if (circle) {
        const circumference = 2 * Math.PI * 70;
        const offset = circumference * (1 - (metrics.circularScore || 0) / 100);
        circle.setAttribute('stroke-dashoffset', offset);
        console.log('Updated circle progress for score:', metrics.circularScore);
    }
    
    // Update individual metric cards
    document.querySelectorAll('.metric-card').forEach(card => {
        const title = card.querySelector('h4')?.textContent;
        let metricType = '';
        if (title?.includes('Attendance')) metricType = 'attendance';
        else if (title?.includes('Tasks')) metricType = 'tasks';
        else if (title?.includes('Teamwork')) metricType = 'teamwork';
        else if (title?.includes('Punctuality')) metricType = 'punctuality';
        
        if (metricType && metrics[metricType] !== undefined) {
            const valueEl = card.querySelector('.metric-value');
            const progressBar = card.querySelector('.metric-progress-bar');
            if (valueEl) valueEl.textContent = metrics[metricType] + '%';
            if (progressBar) progressBar.style.width = metrics[metricType] + '%';
            console.log(`Updated ${metricType} to:`, metrics[metricType]);
        }
    });
}

// Add monthly performance
async function addMonthlyPerformance(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add Monthly Performance</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="saveMonthlyPerformance(event, '${userId}')" class="modal-form">
                <div class="form-group">
                    <label>Month</label>
                    <input type="text" id="monthName" placeholder="e.g., Jan 2024" required>
                </div>
                <div class="form-group">
                    <label>Performance Score (0-100)</label>
                    <input type="number" id="monthScore" min="0" max="100" required>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// Save monthly performance
async function saveMonthlyPerformance(event, userId) {
    event.preventDefault();
    try {
        const month = document.getElementById('monthName').value;
        const score = parseInt(document.getElementById('monthScore').value);
        
        await apiCall(`/performance/${userId}/monthly`, {
            method: 'POST',
            body: JSON.stringify({ month, score })
        });
        
        event.target.closest('.modal').remove();
        loadPerformanceDashboard(userId, userId === currentUser.id);
        alert('Monthly performance added successfully!');
    } catch (error) {
        alert('Error adding monthly performance: ' + error.message);
    }
}

// Add achievement
async function addAchievement(userId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add Achievement</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="saveAchievement(event, '${userId}')" class="modal-form">
                <div class="form-group">
                    <label>Achievement Title</label>
                    <input type="text" id="achievementTitle" placeholder="e.g., Employee of the Month" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="achievementDesc" rows="3" placeholder="Describe the achievement..."></textarea>
                </div>
                <div class="form-group">
                    <label>Icon (Emoji)</label>
                    <input type="text" id="achievementIcon" placeholder="🏆" maxlength="2" value="🏆">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// Save achievement
async function saveAchievement(event, userId) {
    event.preventDefault();
    try {
        const title = document.getElementById('achievementTitle').value;
        const description = document.getElementById('achievementDesc').value;
        const icon = document.getElementById('achievementIcon').value;
        
        await apiCall(`/performance/${userId}/achievements`, {
            method: 'POST',
            body: JSON.stringify({ title, description, icon })
        });
        
        event.target.closest('.modal').remove();
        loadPerformanceDashboard(userId, userId === currentUser.id);
        alert('Achievement added successfully!');
    } catch (error) {
        alert('Error adding achievement: ' + error.message);
    }
}

// Delete achievement
async function deleteAchievement(userId, achievementId) {
    if (!confirm('Are you sure you want to delete this achievement?')) return;
    
    try {
        await apiCall(`/performance/${userId}/achievements/${achievementId}`, {
            method: 'DELETE'
        });
        
        loadPerformanceDashboard(userId, userId === currentUser.id);
        alert('Achievement deleted successfully!');
    } catch (error) {
        alert('Error deleting achievement: ' + error.message);
    }
}

// Show achievement details
function showAchievementDetails(title, description, date) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="padding: 24px;">
                <p style="color: #64748b; margin-bottom: 12px;">${description || 'No description available'}</p>
                <p style="color: #94a3b8; font-size: 14px;">Earned: ${date}</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Load leaderboard
async function loadLeaderboard() {
    try {
        const leaderboard = await apiCall('/performance/leaderboard/all');
        const container = document.getElementById('leaderboardContainer');
        
        if (!container) return;
        
        if (!leaderboard || leaderboard.length === 0) {
            container.innerHTML = '<div class="leaderboard-empty"><i class="fas fa-trophy"></i><p>No employees with performance scores yet. HR can add scores in employee dashboards.</p></div>';
            return;
        }
        
        container.innerHTML = leaderboard.map(item => `
            <div class="leaderboard-item">
                <div class="leaderboard-rank ${item.rank <= 3 ? `rank-${item.rank}` : 'rank-other'}">${item.rank}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${item.username}</div>
                    <div class="leaderboard-dept">${item.department}</div>
                </div>
                <div class="leaderboard-score">
                    <div class="leaderboard-score-value">${item.score}</div>
                    <div class="leaderboard-score-label">Score</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        const container = document.getElementById('leaderboardContainer');
        if (container) {
            container.innerHTML = `<div class="leaderboard-empty"><p>Error loading leaderboard: ${error.message}</p></div>`;
        }
    }
}

// Load leaderboard in modal
async function loadModalLeaderboard() {
    try {
        const leaderboard = await apiCall('/performance/leaderboard/all');
        const container = document.getElementById('modalLeaderboardContainer');
        
        if (!container) return;
        
        console.log('Modal leaderboard data:', leaderboard);
        
        if (!leaderboard || leaderboard.length === 0) {
            container.innerHTML = '<div class="leaderboard-empty"><i class="fas fa-trophy"></i><p>No employees with performance scores yet</p></div>';
            return;
        }
        
        container.innerHTML = leaderboard.map(item => {
            const rankClass = item.rank <= 3 ? `rank-${item.rank}` : 'rank-other';
            return `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank ${rankClass}">${item.rank}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${item.username}</div>
                        <div class="leaderboard-dept">${item.department}</div>
                    </div>
                    <div class="leaderboard-score">
                        <div class="leaderboard-score-value">${item.score}</div>
                        <div class="leaderboard-score-label">Score</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading modal leaderboard:', error);
        const container = document.getElementById('modalLeaderboardContainer');
        if (container) {
            container.innerHTML = `<div class="leaderboard-empty"><p>Error: ${error.message}</p></div>`;
        }
    }
}

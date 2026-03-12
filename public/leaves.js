// Load leaves section
async function loadLeavesSection() {
    try {
        console.log('Loading leaves section...');
        const leaves = await apiCall('/leaves');
        console.log('Leaves data:', leaves);
        const container = document.getElementById('leavesSection');
        
        if (!container) {
            console.error('Leaves section container not found');
            return;
        }
        
        const userRoles = currentUser.roles || [currentUser.role] || [];
        const isHR = userRoles.includes('hr');
        
        container.innerHTML = `
            <div class="table-card">
                <div class="table-header">
                    <h4>${isHR ? 'Leave Requests' : 'My Leave Applications'}</h4>
                    ${!isHR ? '<button class="btn btn-primary" onclick="showApplyLeaveModal()"><i class="fas fa-plus"></i> Apply Leave</button>' : ''}
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                ${isHR ? '<th>Employee</th>' : ''}
                                <th>Leave Type</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Days</th>
                                <th>Reason</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${leaves.length === 0 ? 
                                `<tr><td colspan="${isHR ? 8 : 7}" style="text-align: center;">No leave applications</td></tr>` :
                                leaves.map(leave => renderLeaveRow(leave, isHR)).join('')
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading leaves:', error);
        const container = document.getElementById('leavesSection');
        if (container) {
            container.innerHTML = `
                <div class="table-card">
                    <div class="table-header">
                        <h4>Error Loading Leaves</h4>
                    </div>
                    <div style="padding: 24px; text-align: center; color: #ef4444;">
                        <p>${error.message}</p>
                    </div>
                </div>
            `;
        }
    }
}

// Render leave row
function renderLeaveRow(leave, isHR) {
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    const statusColors = {
        'pending': 'pending',
        'approved': 'completed',
        'rejected': 'draft'
    };
    
    return `
        <tr>
            ${isHR ? `<td>${leave.employee?.username || 'Unknown'}</td>` : ''}
            <td style="text-transform: capitalize;">${leave.leaveType}</td>
            <td>${startDate.toLocaleDateString()}</td>
            <td>${endDate.toLocaleDateString()}</td>
            <td>${days}</td>
            <td style="max-width: 200px;">${leave.reason}</td>
            <td><span class="status-badge status-${statusColors[leave.status]}">${leave.status}</span></td>
            <td>
                ${isHR && leave.status === 'pending' ? 
                    `<button class="btn btn-primary btn-sm" onclick="reviewLeave('${leave._id}', '${leave.employee?.username}')">Review</button>` :
                    `<button class="btn btn-secondary btn-sm" onclick="viewLeaveDetails('${leave._id}')">View</button>`
                }
                ${!isHR && leave.status === 'pending' ? 
                    `<button class="btn btn-danger btn-sm" onclick="deleteLeave('${leave._id}')"><i class="fas fa-trash"></i></button>` : ''
                }
            </td>
        </tr>
    `;
}

// Show apply leave modal
function showApplyLeaveModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Apply for Leave</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="submitLeaveApplication(event)" class="modal-form">
                <div class="form-group">
                    <label>Leave Type</label>
                    <select id="leaveType" required>
                        <option value="">Select Type</option>
                        <option value="sick">Sick Leave</option>
                        <option value="casual">Casual Leave</option>
                        <option value="vacation">Vacation</option>
                        <option value="personal">Personal Leave</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Start Date</label>
                    <input type="date" id="startDate" required>
                </div>
                <div class="form-group">
                    <label>End Date</label>
                    <input type="date" id="endDate" required>
                </div>
                <div class="form-group">
                    <label>Reason</label>
                    <textarea id="leaveReason" rows="4" required placeholder="Explain the reason for leave..."></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Submit Application</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// Submit leave application
async function submitLeaveApplication(event) {
    event.preventDefault();
    try {
        const leaveType = document.getElementById('leaveType').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const reason = document.getElementById('leaveReason').value;
        
        if (new Date(endDate) < new Date(startDate)) {
            alert('End date cannot be before start date');
            return;
        }
        
        await apiCall('/leaves', {
            method: 'POST',
            body: JSON.stringify({ leaveType, startDate, endDate, reason })
        });
        
        document.querySelector('.modal').remove();
        alert('Leave application submitted successfully!');
        loadLeavesSection();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Review leave (HR)
async function reviewLeave(leaveId, employeeName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Review Leave - ${employeeName}</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="submitLeaveReview(event, '${leaveId}')" class="modal-form">
                <div class="form-group">
                    <label>Decision</label>
                    <select id="leaveStatus" required>
                        <option value="">Select Decision</option>
                        <option value="approved">Approve</option>
                        <option value="rejected">Reject</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Comment (Optional)</label>
                    <textarea id="reviewComment" rows="3" placeholder="Add any comments..."></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Submit Review</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// Submit leave review
async function submitLeaveReview(event, leaveId) {
    event.preventDefault();
    try {
        const status = document.getElementById('leaveStatus').value;
        const reviewComment = document.getElementById('reviewComment').value;
        
        await apiCall(`/leaves/${leaveId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, reviewComment })
        });
        
        document.querySelector('.modal').remove();
        alert(`Leave ${status} successfully!`);
        loadLeavesSection();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// View leave details
async function viewLeaveDetails(leaveId) {
    try {
        const leaves = await apiCall('/leaves');
        const leave = leaves.find(l => l._id === leaveId);
        
        if (!leave) {
            alert('Leave not found');
            return;
        }
        
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Leave Details</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 24px;">
                    ${leave.employee ? `<p><strong>Employee:</strong> ${leave.employee.username}</p>` : ''}
                    <p><strong>Leave Type:</strong> <span style="text-transform: capitalize;">${leave.leaveType}</span></p>
                    <p><strong>Start Date:</strong> ${startDate.toLocaleDateString()}</p>
                    <p><strong>End Date:</strong> ${endDate.toLocaleDateString()}</p>
                    <p><strong>Duration:</strong> ${days} day(s)</p>
                    <p><strong>Reason:</strong> ${leave.reason}</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${leave.status === 'approved' ? 'completed' : leave.status === 'rejected' ? 'draft' : 'pending'}">${leave.status}</span></p>
                    ${leave.reviewedBy ? `<p><strong>Reviewed By:</strong> ${leave.reviewedBy.username}</p>` : ''}
                    ${leave.reviewedAt ? `<p><strong>Reviewed At:</strong> ${new Date(leave.reviewedAt).toLocaleString()}</p>` : ''}
                    ${leave.reviewComment ? `<p><strong>Review Comment:</strong> ${leave.reviewComment}</p>` : ''}
                    <p><strong>Applied On:</strong> ${new Date(leave.createdAt).toLocaleString()}</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error loading leave details: ' + error.message);
    }
}

// Delete leave
async function deleteLeave(leaveId) {
    if (!confirm('Are you sure you want to delete this leave application?')) {
        return;
    }
    
    try {
        await apiCall(`/leaves/${leaveId}`, { method: 'DELETE' });
        alert('Leave application deleted successfully!');
        loadLeavesSection();
    } catch (error) {
        alert('Error deleting leave: ' + error.message);
    }
}

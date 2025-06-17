const jobs = ['戰士', '法師', '牧師', '盜賊', '獵人', '騎士', '薩滿', '術士', '德魯伊'];

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">${content}</div>`;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
}

// 防抖函數
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 初始化側邊欄
function initSidebar(user) {
    const sidebar = document.getElementById('sidebar');
    const links = [
        { text: '首頁', href: '/home.html', icon: 'fas fa-home' },
        { text: '更換職業', href: '/applications/job_change.html', icon: 'fas fa-user-cog' },
        { text: '更改遊戲 ID', href: '/applications/id_change.html', icon: 'fas fa-id-card' },
        { text: '請假申請', href: '/applications/leave.html', icon: 'fas fa-calendar-times' },
        { text: '代報名', href: '/applications/proxy_registration.html', icon: 'fas fa-user-plus' },
        { text: '出勤記錄', href: '/records/attendance.html', icon: 'fas fa-check-circle' }
    ];
    if (user.isAdmin) {
        links.push(
            { text: '幫戰管理', href: '/admin/battle_management.html', icon: 'fas fa-shield-alt' },
            { text: '成員管理', href: '/admin/member_management.html', icon: 'fas fa-users' },
            { text: '出戰表', href: '/admin/formation_management.html', icon: 'fas fa-table' },
            { text: '統計報表', href: '/admin/statistics.html', icon: 'fas fa-chart-bar' },
            { text: '異動記錄', href: '/admin/change_logs.html', icon: 'fas fa-history' }
        );
    }
    sidebar.innerHTML = links.map(link => `
        <a href="${link.href}" data-tooltip="${link.text}">
            <i class="${link.icon}"></i> ${link.text}
        </a>
    `).join('');
}

// 登出
async function logout() {
    try {
        const res = await fetch('/auth/logout', { credentials: 'include' });
        const data = await res.json();
        if (data.success) window.location.href = '/';
    } catch (err) {
        showNotification('登出失敗', 'error');
    }
}

// 渲染出戰表（避免重複渲染）
function renderFormationTable(formation, readonly = false) {
    const table = document.querySelector('.battle-formation table');
    if (!table || JSON.stringify(formation) === table.dataset.lastFormation) return; // 避免重複渲染
    table.dataset.lastFormation = JSON.stringify(formation);
    table.innerHTML = `
        <tr><th>團</th><th>小隊</th><th>職業</th><th>玩家</th></tr>
        ${formation.groups.map(group => `
            ${formation.teams.map(team => `
                ${jobs.map(job => `
                    <tr>
                        <td>${group}</td>
                        <td>${team}</td>
                        <td>${job}</td>
                        <td>${readonly ? (formation.assignments[group]?.[team]?.[job] || '-') : `
                            <select onchange="updateAssignment('${group}', '${team}', '${job}', this.value)">
                                <option value="">無</option>
                                ${registeredUsers.filter(u => u.job === job).map(u => `
                                    <option value="${u.gameId}" ${formation.assignments[group]?.[team]?.[job] === u.gameId ? 'selected' : ''}>${u.gameId}</option>
                                `).join('')}
                            </select>
                        `}</td>
                    </tr>
                `).join('')}
            `).join('')}
        `).join('')}
    `;
}

// 側邊欄切換
document.getElementById('hamburger').addEventListener('click', debounce(() => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('mainContent').classList.toggle('shifted');
}, 100));

// 初始化用戶資訊
async function initUserInfo() {
    try {
        const res = await fetch('/api/user/current', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            const userInfo = document.getElementById('userInfo');
            userInfo.innerHTML = `
                <span>歡迎，${data.user.gameId} (${data.user.job})</span>
                <button class="btn btn-danger" onclick="logout()">登出</button>
            `;
            initSidebar(data.user);
        } else {
            window.location.href = '/';
        }
    } catch (err) {
        window.location.href = '/';
    }
}

document.addEventListener('DOMContentLoaded', initUserInfo);
const jobs = ['鐵衣', '素問', '碎夢', '龍吟', '九靈', '神相', '血河'];
const teamNames = ['進攻隊', '防守隊', '機動隊', '空拆隊', '拆塔隊'];

async function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    try {
        const res = await fetch('/api/user/current', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) {
            window.location.href = '/index.html';
            return;
        }
        const { user } = data;
        document.getElementById('userInfo').innerHTML = `
            <span>歡迎，${user.gameId} (${user.job})</span>
            <button class="btn btn-danger" onclick="logout()">登出</button>
        `;
        sidebar.innerHTML = `
            <ul class="nav-list">
                <li class="nav-item"><a href="/home.html">🏠 首頁</a></li>
                <li class="nav-item">
                    <a href="#">📝 申請專區</a>
                    <ul class="nav-list">
                        <li class="nav-item"><a href="/applications/job_change.html">更換職業</a></li>
                        <li class="nav-item"><a href="/applications/id_change.html">更改遊戲 ID</a></li>
                        <li class="nav-item"><a href="/applications/leave.html">請假申請</a></li>
                        <li class="nav-item"><a href="/applications/proxy_registration.html">代報名</a></li>
                    </ul>
                </li>
                <li class="nav-item">
                    <a href="#">📊 出勤紀錄</a>
                    <ul class="nav-list">
                        <li class="nav-item"><a href="/records/attendance.html">個人出勤紀錄</a></li>
                    </ul>
                </li>
                ${user.isAdmin ? `
                    <li class="nav-item">
                        <a href="#">🔧 管理員板塊</a>
                        <ul class="nav-list">
                            <li class="nav-item"><a href="/admin/battle_management.html">幫戰管理</a></li>
                            <li class="nav-item"><a href="/admin/member_management.html">成員管理</a></li>
                            <li class="nav-item"><a href="/admin/formation_management.html">出戰表</a></li>
                            <li class="nav-item"><a href="/admin/statistics.html">統計報表</a></li>
                            <li class="nav-item"><a href="/admin/change_logs.html">異動記錄</a></li>
                        </ul>
                    </li>
                ` : ''}
            </ul>
        `;
        initHamburger();
    } catch (err) {
        window.location.href = '/index.html';
    }
}

function initHamburger() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    if (hamburger && sidebar) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showModal(content) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = content + '<button class="close-modal" onclick="closeModal()">×</button>';
    modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('show');
}

async function logout() {
    try {
        await fetch('/auth/logout', { credentials: 'include' });
        window.location.href = '/index.html';
    } catch (err) {
        showNotification('登出失敗', 'error');
    }
}

function renderFormationTable(group, teams, assignments, registeredUsers, readonly = false) {
    return `
        <div class="formation-container">
            <table class="formation-table${readonly ? ' readonly' : ''}">
                <tr>
                    ${teams.map(team => `<th colspan="2" class="team-header">${readonly ? team : `<select onchange="updateTeam('${group}', this.value, ${teams.indexOf(team)})">${teamNames.map(t => `<option value="${t}" ${t === team ? 'selected' : ''}>${t}</option>`).join('')}</select>`}</th>`).join('')}
                </tr>
                ${jobs.map(job => `
                    <tr>
                        ${teams.flatMap(team => [
                            `<td>${job}</td>`,
                            `<td>${readonly ? (assignments[team]?.[job] || '-') : `<select onchange="updateAssignment('${group}', '${team}', '${job}', this.value)"><option value="">無</option>${registeredUsers.filter(u => u.job === job).map(u => `<option value="${u.gameId}" ${assignments[team]?.[job] === u.gameId ? 'selected' : ''}>${u.gameId}</option>`).join('')}</select>`}</td>`
                        ]).join('')}
                    </tr>
                `).join('')}
            </table>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('sidebar')) initSidebar();
});
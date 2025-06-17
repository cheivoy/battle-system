const jobs = ['素問', '血河', '九靈', '龍吟', '碎夢', '神相', '鐵衣'];
const teamNames = ['進攻隊', '防守隊', '機動隊', '空拆隊', '拆塔隊'];
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    fetch('/api/user/current', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                window.location.href = '/index.html';
                return;
            }
            const isAdmin = data.user.isAdmin;
            sidebar.innerHTML = `
                <div class="sidebar-header"><h2>🛡️ 幫戰系統</h2></div>
                <ul class="sidebar-nav">
                    <li><a href="/home.html"><i class="fas fa-home"></i> 首頁</a></li>
                    <li><button onclick="toggleSubMenu('applicationsMenu')"><i class="fas fa-file-alt"></i> 申請專區</button>
                        <ul id="applicationsMenu" class="sub-menu">
                            <li><a href="/applications/job_change.html">更換職業</a></li>
                            <li><a href="/applications/id_change.html">更改遊戲 ID</a></li>
                            <li><a href="/applications/leave.html">請假申請</a></li>
                            <li><a href="/applications/proxy_registration.html">代報名</a></li>
                        </ul>
                    </li>
                    <li><button onclick="toggleSubMenu('recordsMenu')"><i class="fas fa-chart-bar"></i> 出勤紀錄</button>
                        <ul id="recordsMenu" class="sub-menu">
                            <li><a href="/records/attendance.html">個人出勤</a></li>
                        </ul>
                    </li>
                    ${isAdmin ? `
                        <li><button onclick="toggleSubMenu('adminMenu')"><i class="fas fa-user-shield"></i> 管理員</button>
                            <ul id="adminMenu" class="sub-menu">
                                <li><a href="/admin/battle_management.html">幫戰管理</a></li>
                                <li><a href="/admin/member_management.html">成員管理</a></li>
                                <li><a href="/admin/formation_management.html">出戰表</a></li>
                                <li><a href="/admin/statistics.html">統計報表</a></li>
                                <li><a href="/admin/change_logs.html">異動記錄</a></li>
                            </ul>
                        </li>
                    ` : ''}
                </ul>
            `;
            document.getElementById('hamburger')?.addEventListener('click', () => toggleSidebar());
            document.getElementById('mainContent')?.addEventListener('click', () => {
                if (window.innerWidth <= 767) toggleSidebar(false);
            });
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                userInfo.innerHTML = `
                    <strong>${data.user.gameId}</strong> | ${data.user.job}
                    <button onclick="logout()" class="btn btn-danger">登出</button>
                `;
            }
        });
}
function toggleSubMenu(menuId) {
    document.getElementById(menuId)?.classList.toggle('active');
}
function toggleSidebar(show = null) {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    if (sidebar && mainContent) {
        if (show === null) {
            sidebar.classList.toggle('active');
        } else {
            sidebar.classList.toggle('active', show && window.innerWidth <= 767);
        }
        mainContent.classList.toggle('full-width', !sidebar.classList.contains('active'));
    }
}
function showModal(content) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    if (modal && modalContent) {
        modalContent.innerHTML = content;
        modal.classList.add('active');
    }
}
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('modalContent').innerHTML = '';
    }
}
async function logout() {
    try {
        await fetch('/auth/logout', { credentials: 'include' });
        window.location.href = '/index.html';
    } catch (err) {
        alert('登出失敗');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname !== '/index.html') initSidebar();
});
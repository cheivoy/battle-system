const jobs = ['鐵衣', '素問', '九靈', '碎夢', '龍吟', '血河', '神相'];
const teamNames = ['進攻隊', '防守隊', '機動隊', '空拆隊', '拆塔隊'];

async function checkUserStatus() {
    try {
        const res = await fetch('/api/user/status', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) {
            console.log('User not logged in, redirecting to login');
            if (window.location.pathname !== '/login.html') {
                window.location.href = '/login.html?error=unauthenticated';
            }
            return null;
        }
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.innerHTML = `
                <span>歡迎，${data.user.gameId || data.user.discordId}</span>
                <a href="/auth/logout" class="btn btn-out">登出</a>
            `;
        }
        return data.user;
    } catch (err) {
        console.error('Error checking user status:', err);
        if (window.location.pathname !== '/login.html') {
            window.location.href = '/login.html?error=check_status';
        }
        return null;
    }
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `fixed top-4 right-4 p-4 rounded shadow-lg ${type === 'success' ? 'success' : 'error'}`;
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 5000);
    } else {
        console.warn('Notification element not found');
        // 如果找不到通知元素，就用 alert 作為備用
        alert(message);
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('hidden', !show);
    } else {
        console.warn('Loading element not found');
        // 如果沒有 loading 元素，在控制台顯示載入狀態
        console.log(show ? 'Loading...' : 'Loading complete');
    }
}

function showModal(content) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = content + '<button class="close-modal" onclick="closeModal()">×</button>';
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
}

async function initSidebar() {
    try {
        const res = await fetch('/api/user/current', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) {
            window.location.href = '/';
            return;
        }
        const { user } = data;
        const sidebar = document.getElementById('sidebar');
        const userInfo = document.getElementById('userInfo');
        userInfo.innerHTML = `
            <img src="https://via.placeholder.com/40" alt="User Avatar">
            <span>${user.gameId} (${user.job})</span>
            <a href="/auth/logout" class="btn btn-danger">登出</a>
        `;
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <h2>選單</h2>
            </div>
            <ul class="sidebar-menu">
                <li onclick="navigate('/home.html')"><i class="fas fa-home"></i> 首頁</li>
                <li class="dropdown">
                    <span><i class="fas fa-file-alt"></i> 申請專區</span>
                    <ul class="dropdown-menu">
                        <li onclick="navigate('/applications/job_change.html')">更換職業</li>
                        <li onclick="navigate('/applications/id_change.html')">更改遊戲 ID</li>
                        <li onclick="navigate('/applications/leave.html')">請假申請</li>
                        <li onclick="navigate('/applications/proxy_registration.html')">代報名</li>
                    </ul>
                </li>
                <li class="dropdown">
                    <span><i class="fas fa-chart-line"></i> 出勤紀錄</span>
                    <ul class="dropdown-menu">
                        <li onclick="navigate('/records/attendance.html')">個人出勤紀錄</li>
                    </ul>
                </li>
                ${user.isAdmin ? `
                    <li class="dropdown">
                        <span><i class="fas fa-cogs"></i> 管理員板塊</span>
                        <ul class="dropdown-menu">
                            <li onclick="navigate('/admin/battle_management.html')">幫戰管理</li>
                            <li onclick="navigate('/admin/member_management.html')">成員管理</li>
                            <li onclick="navigate('/admin/formation_management.html')">出戰表</li>
                            <li onclick="navigate('/admin/registered_members.html')">已報名成員</li>
                            <li onclick="navigate('/admin/statistics.html')">統計報表</li>
                            <li onclick="navigate('/admin/change_logs.html')">異動記錄</li>
                        </ul>
                    </li>
                ` : ''}
            </ul>
        `;
        const hamburger = document.getElementById('hamburger');
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            document.getElementById('mainContent').classList.toggle('shifted');
        });
        document.querySelectorAll('.dropdown > span').forEach(dropdown => {
            dropdown.addEventListener('click', () => {
                const menu = dropdown.nextElementSibling;
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            });
        });
        highlightCurrentPage();
    } catch (err) {
        showNotification('無法載入用戶資訊', 'error');
    }
}

function navigate(url) {
    window.location.href = url;
}

function highlightCurrentPage() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        const link = li.getAttribute('onclick')?.match(/navigate\('([^']+)'\)/)?.[1];
        if (link === currentPath) {
            li.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', initSidebar);
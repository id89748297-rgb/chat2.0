// === UTILS: базовые помощники для чат-приложения ===

// Безопасное экранирование текста (защита от XSS — как в основном приложении)
function escapeHtml(str) {
return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Переключение «страниц» приложения
function showPage(id) {
document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
const targetPage = document.getElementById(id);
if (targetPage) {
targetPage.classList.add('active');
}
window.scrollTo(0, 0);
saveAppState();
}

// Закрытие модального окна
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

// Запоминание текущей страницы (для восстановления после перезагрузки)
function saveAppState() {
const activePage = document.querySelector('.page.active');
const membersModal = document.getElementById('modal-team-members');
const membersModalTeamId = (membersModal && membersModal.classList.contains('show')) ? currentMembersTeamId : null;
localStorage.setItem('clc_state', JSON.stringify({ page: activePage ? activePage.id : 'page-home', membersModalTeamId }));
}

// Темы оформления
function updateThemeButtons(icon) {
document.querySelectorAll('.theme-toggle').forEach(b => b.innerText = icon);
}
function toggleTheme() {
const body = document.body;
if (body.classList.contains('dark')) {
body.classList.remove('dark');
body.classList.add('dark-white');
updateThemeButtons('🌑');
localStorage.setItem('clc_theme', 'dark-white');
} else if (body.classList.contains('dark-white')) {
body.classList.remove('dark-white');
body.classList.add('light');
updateThemeButtons('☀️');
localStorage.setItem('clc_theme', 'light');
} else {
body.classList.remove('light');
body.classList.add('dark');
updateThemeButtons('🌙');
localStorage.setItem('clc_theme', 'dark');
}
}
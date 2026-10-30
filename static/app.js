const state = { role: 'HocVien', page: 'dashboard', userId: 'HV001', dashboard: null, foods: [], exercises: [], charts: {} };
const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
  meals: '<svg viewBox="0 0 24 24"><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3v18M17 3c3 2 4 5 4 8h-4"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h17M8 16v-5M13 16V7M18 16v-8"/></svg>',
  plans: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18M8 13h3M8 17h7"/></svg>',
  students: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6"/></svg>',
  catalog: '<svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M11 17v4"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v8M17 11h6"/></svg>'
};
const roleUser = { HocVien: 'HV001', HLV: 'PT001', Admin: 'AD001' };
const roleNames = { HocVien: 'Học viên', HLV: 'Huấn luyện viên', Admin: 'Quản trị viên' };
const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thể hoàn tất yêu cầu.');
  return data;
}
function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}
function formatNumber(number) { return new Intl.NumberFormat('vi-VN').format(Math.round(number || 0)); }
function dateLabel(date = new Date()) { return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date); }
function setNavigation() {
  const common = [{ id: 'dashboard', label: 'Tổng quan' }];
  const items = state.role === 'HocVien'
    ? [...common, { id: 'meals', label: 'Nhật ký dinh dưỡng' }, { id: 'reports', label: 'Báo cáo sức khỏe' }, { id: 'plans', label: 'Kế hoạch tập' }]
    : state.role === 'HLV'
      ? [...common, { id: 'students', label: 'Học viên của tôi' }, { id: 'plans', label: 'Kế hoạch tập' }]
      : [...common, { id: 'catalog', label: 'Danh mục' }, { id: 'users', label: 'Tài khoản' }];
  if (!items.some((item) => item.id === state.page)) state.page = 'dashboard';
  $('#navigation').innerHTML = items.map((item) => `<button class="nav-item ${state.page === item.id ? 'active' : ''}" data-page="${item.id}"><span class="nav-icon">${icons[item.id]}</span>${item.label}</button>`).join('');
  const active = items.find((item) => item.id === state.page);
  $('#pageLabel').textContent = active.label;
}
function destroyCharts() {
  Object.values(state.charts).forEach((chart) => chart?.destroy());
  state.charts = {};
}
function makeStat(label, value, unit, symbol, foot) {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-symbol">${symbol}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-foot">${foot}</div></article>`;
}
function mealRows(meals) {
  if (!meals.length) return '<tr><td colspan="4" class="empty-state">Chưa có món ăn hôm nay. Ghi món đầu tiên để theo dõi dinh dưỡng.</td></tr>';
  const emojis = ['🍗', '🍚', '🥚', '🍜', '🍌', '🥣'];
  return meals.map((meal, index) => {
    const calories = meal.CaloPer100g * meal.KhoiLuongGram / 100;
    return `<tr><td class="food-name"><span class="food-thumb">${emojis[index % emojis.length]}</span>${escapeHtml(meal.TenMon)}</td><td><span class="meal-tag">${escapeHtml(meal.BuoiAn)}</span></td><td>${formatNumber(meal.KhoiLuongGram)} g</td><td class="meal-calories">${formatNumber(calories)} kcal</td></tr>`;
  }).join('');
}
function dashboardMarkup(data) {
  const percent = Math.round(data.todayCalories / data.tdee * 100);
  const safePercent = Math.min(percent, 100);
  const warning = data.todayCalories > data.tdee ? '<div class="alert-banner"><span>!</span>CẢNH BÁO: Lượng calo nạp hôm nay đã vượt mức TDEE cho phép!</div>' : '';
  const remaining = Math.max(data.tdee - data.todayCalories, 0);
  const quickFoods = state.foods.slice(0, 3).map((food, index) => `<button class="quick-add" data-quick-food="${food.MaMon}"><span class="quick-food"><span class="quick-food-icon">${['🍗', '🍚', '🥚'][index]}</span><span><b>${escapeHtml(food.TenMon)}</b><small>${formatNumber(food.CaloPer100g)} kcal / 100 g</small></span></span><span class="quick-cal">+ Ghi món</span></button>`).join('');
  return `<section class="welcome-row animate-in"><div><div class="eyebrow">${state.role === 'HocVien' ? 'HÀNH TRÌNH CỦA BẠN' : 'KHÔNG GIAN LÀM VIỆC'}</div><h1>${state.role === 'HocVien' ? `Chào ${escapeHtml(data.user.name.split(' ').slice(-1)[0])}, hôm nay thế nào?` : `Xin chào, ${roleNames[state.role]}`}</h1><p>${state.role === 'HocVien' ? `Mục tiêu hôm nay: ${escapeHtml(data.user.goal)}. Mỗi lựa chọn tốt đều tạo nên khác biệt.` : 'Theo dõi tiến độ và duy trì nhịp tập luyện hiệu quả.'}</p></div><div class="date-chip"><span>◷</span>${dateLabel()}</div></section>
  <section class="stats-grid animate-in">${makeStat('Chỉ số BMI', data.bmi, 'kg/m²', '↗', `<strong>${data.bmi < 18.5 ? 'Thiếu cân' : data.bmi < 25 ? 'Khỏe mạnh' : data.bmi < 30 ? 'Thừa cân' : 'Béo phì'}</strong> · cân nặng ${data.user.weight} kg`)}${makeStat('BMR cơ bản', formatNumber(data.bmr), 'kcal', '⌁', 'Năng lượng tiêu hao khi nghỉ ngơi')}${makeStat('TDEE mục tiêu', formatNumber(data.tdee), 'kcal', '◉', `Hệ số vận động · ${data.user.goal}`)}${makeStat('Đã nạp hôm nay', formatNumber(data.todayCalories), 'kcal', '＋', `Còn lại ${formatNumber(remaining)} kcal trong mục tiêu`)}</section>
  <section class="progress-card"><div><div class="progress-title">Tiến độ năng lượng hôm nay</div><div class="progress-subtitle">${formatNumber(data.todayCalories)} / ${formatNumber(data.tdee)} kcal</div><div class="progress-track"><div class="progress-fill" style="width:${safePercent}%"></div></div><div class="progress-values"><span>0 kcal</span><span>Mục tiêu ${formatNumber(data.tdee)} kcal</span></div></div><div class="progress-number">${percent}<small>%</small></div></section>${warning}
  <section class="dashboard-grid"><article class="panel"><div class="panel-heading"><div><h2>Calo nạp trong tuần</h2><p>So sánh lượng nạp với TDEE mỗi ngày</p></div><button class="panel-menu" aria-label="Tùy chọn">···</button></div><div class="chart-wrap"><canvas id="weekChart" aria-label="Biểu đồ calo trong tuần"></canvas></div></article><article class="panel"><div class="panel-heading"><div><h2>Phân bổ dinh dưỡng</h2><p>Tổng macro đã ghi hôm nay</p></div></div><div class="macro-layout"><div class="macro-chart"><canvas id="macroChart" aria-label="Biểu đồ macro"></canvas></div><div class="macro-legend" id="macroLegend"></div></div></article></section>
  <section class="bottom-grid"><article class="panel table-panel"><div class="panel-heading"><div><h2>Bữa ăn hôm nay</h2><p>Các món đã ghi vào nhật ký</p></div><button class="panel-link" data-page="meals">+ Thêm món ăn</button></div><table class="meal-table"><thead><tr><th>MÓN ĂN</th><th>BỮA</th><th>KHỐI LƯỢNG</th><th>NĂNG LƯỢNG</th></tr></thead><tbody>${mealRows(data.meals)}</tbody></table></article><article class="panel"><div class="panel-heading"><div><h2>Ghi nhanh món ăn</h2><p>Chọn món để thêm vào nhật ký</p></div></div>${quickFoods || '<div class="empty-state">Chưa có dữ liệu món ăn</div>'}</article></section>`;
}
function drawDashboardCharts(data) {
  if (!window.Chart) return;
  const week = data.week || [];
  const labels = week.map((item) => new Date(`${item.date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' }));
  state.charts.week = new Chart($('#weekChart'), { type: 'bar', data: { labels, datasets: [
    { type: 'line', label: 'TDEE mục tiêu', data: week.map(() => data.tdee), borderColor: '#dc9767', backgroundColor: '#dc9767', borderWidth: 2, pointRadius: 2, pointHoverRadius: 4, tension: .35 },
    { label: 'Calo nạp', data: week.map((item) => item.calories), backgroundColor: '#7c9c65', hoverBackgroundColor: '#54794d', borderRadius: 4, maxBarThickness: 26 }
  ] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6, color: '#87938a', font: { family: 'DM Sans', size: 10 }, padding: 18 } }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatNumber(context.raw)} kcal` } } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: '#98a29b', font: { family: 'DM Sans', size: 9 } } }, y: { beginAtZero: true, suggestedMax: data.tdee + 500, grid: { color: '#f0f2ed' }, border: { display: false }, ticks: { color: '#98a29b', font: { family: 'DM Sans', size: 9 }, callback: (value) => `${value}` } } } } });
  const macro = data.macros;
  const values = [macro.protein * 4, macro.carb * 4, macro.fat * 9];
  const colors = ['#789761', '#e4b46a', '#df8b67'];
  const names = ['Protein', 'Carb', 'Fat'];
  const total = values.reduce((sum, item) => sum + item, 0);
  $('#macroLegend').innerHTML = names.map((name, index) => `<div class="macro-legend-item"><span class="legend-dot" style="background:${colors[index]}"></span><span>${name}<b>${formatNumber(macro[['protein', 'carb', 'fat'][index]])} g</b></span></div>`).join('');
  state.charts.macro = new Chart($('#macroChart'), { type: 'doughnut', data: { labels: names, datasets: [{ data: total ? values : [1, 1, 1], backgroundColor: total ? colors : ['#edf0e9', '#f3f0e9', '#f1ece9'], borderWidth: 0, hoverOffset: 3 }] }, options: { maintainAspectRatio: false, cutout: '74%', plugins: { legend: { display: false }, tooltip: { enabled: !!total } } } });
}
async function renderDashboard() {
  if (!state.foods.length) state.foods = await api('/api/foods');
  const data = await api(`/api/dashboard?user=${encodeURIComponent(state.role === 'HocVien' ? state.userId : 'HV001')}`);
  state.dashboard = data;
  $('#appContent').innerHTML = dashboardMarkup(data);
  drawDashboardCharts(data);
}
async function renderMeals() {
  const data = state.dashboard || await api(`/api/dashboard?user=${state.userId}`);
  $('#appContent').innerHTML = `<section class="section-head"><div><div class="eyebrow">NHẬT KÝ CỦA BẠN</div><h1 class="section-title">Dinh dưỡng hôm nay</h1><p class="section-subtitle">Ghi món ăn để theo dõi năng lượng và macro.</p></div><button class="primary-button" id="addMealButton">＋ Ghi món ăn</button></section>${data.todayCalories > data.tdee ? '<div class="alert-banner"><span>!</span>CẢNH BÁO: Lượng calo nạp hôm nay đã vượt mức TDEE cho phép!</div>' : ''}<section class="stats-grid">${makeStat('Tổng calo', formatNumber(data.todayCalories), 'kcal', '＋', `Mục tiêu ${formatNumber(data.tdee)} kcal`)}${makeStat('Protein', data.macros.protein, 'g', 'P', 'Mục tiêu tham khảo 1.6 g/kg')}${makeStat('Carbohydrate', data.macros.carb, 'g', 'C', 'Nguồn năng lượng chính')}${makeStat('Chất béo', data.macros.fat, 'g', 'F', 'Ưu tiên chất béo tốt')}</section><section class="panel table-panel"><div class="panel-heading"><div><h2>Danh sách bữa ăn</h2><p>${dateLabel()}</p></div></div><table class="meal-table"><thead><tr><th>MÓN ĂN</th><th>BỮA</th><th>KHỐI LƯỢNG</th><th>NĂNG LƯỢNG</th></tr></thead><tbody>${mealRows(data.meals)}</tbody></table></section>`;
}
async function renderReports() {
  const report = await api(`/api/reports?user=${state.userId}`);
  $('#appContent').innerHTML = `<section class="section-head"><div><div class="eyebrow">DỮ LIỆU CỦA BẠN</div><h1 class="section-title">Báo cáo sức khỏe</h1><p class="section-subtitle">Theo dõi lượng calo và cân bằng dinh dưỡng trong 7 ngày gần nhất.</p></div><div class="date-chip"><span>◷</span>7 ngày</div></section><section class="dashboard-grid"><article class="panel"><div class="panel-heading"><div><h2>Calo nạp & TDEE</h2><p>Đơn vị: kcal · theo ngày</p></div></div><div class="chart-wrap"><canvas id="reportWeekChart"></canvas></div></article><article class="panel"><div class="panel-heading"><div><h2>Macro hôm nay</h2><p>Phân bổ năng lượng theo nhóm chất</p></div></div><div class="macro-layout"><div class="macro-chart"><canvas id="reportMacroChart"></canvas></div><div class="macro-legend" id="reportMacroLegend"></div></div></article></section><section class="panel"><div class="panel-heading"><div><h2>Lịch sử calo</h2><p>So sánh nhanh từng ngày</p></div></div><table class="meal-table"><thead><tr><th>NGÀY</th><th>CALO NẠP</th><th>TDEE</th><th>CHÊNH LỆCH</th></tr></thead><tbody>${report.week.map((item) => `<tr><td>${new Date(`${item.date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</td><td class="meal-calories">${formatNumber(item.calories)} kcal</td><td>${formatNumber(report.tdee)} kcal</td><td>${item.calories > report.tdee ? '+' : ''}${formatNumber(item.calories - report.tdee)} kcal</td></tr>`).join('')}</tbody></table></section>`;
  const data = { ...report, user: state.dashboard?.user || {} };
  drawDashboardChartsForReport(data);
}
function drawDashboardChartsForReport(data) {
  const temporary = $('#appContent');
  const weekCanvas = $('#reportWeekChart');
  const macroCanvas = $('#reportMacroChart');
  if (!window.Chart) return;
  const labels = data.week.map((item) => new Date(`${item.date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' }));
  state.charts.week = new Chart(weekCanvas, { type: 'bar', data: { labels, datasets: [
    { type: 'line', label: 'TDEE mục tiêu', data: data.week.map(() => data.tdee), borderColor: '#dc9767', backgroundColor: '#dc9767', borderWidth: 2, pointRadius: 2, tension: .35 },
    { label: 'Calo nạp', data: data.week.map((item) => item.calories), backgroundColor: '#7c9c65', borderRadius: 4, maxBarThickness: 26 }
  ] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, color: '#87938a', font: { family: 'DM Sans', size: 10 } } } }, scales: { x: { grid: { display: false }, ticks: { color: '#98a29b', font: { size: 9 } } }, y: { beginAtZero: true, suggestedMax: data.tdee + 500, grid: { color: '#f0f2ed' }, ticks: { color: '#98a29b', font: { size: 9 } } } } } });
  const macro = data.macros;
  const values = [macro.protein * 4, macro.carb * 4, macro.fat * 9];
  const colors = ['#789761', '#e4b46a', '#df8b67'];
  const names = ['Protein', 'Carb', 'Fat'];
  const total = values.reduce((sum, item) => sum + item, 0);
  $('#reportMacroLegend').innerHTML = names.map((name, index) => `<div class="macro-legend-item"><span class="legend-dot" style="background:${colors[index]}"></span><span>${name}<b>${formatNumber(macro[['protein', 'carb', 'fat'][index]])} g</b></span></div>`).join('');
  state.charts.macro = new Chart(macroCanvas, { type: 'doughnut', data: { labels: names, datasets: [{ data: total ? values : [1, 1, 1], backgroundColor: total ? colors : ['#edf0e9', '#f3f0e9', '#f1ece9'], borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '74%', plugins: { legend: { display: false }, tooltip: { enabled: !!total } } } });
}
async function renderPlans() {
  const student = state.role === 'HocVien' ? state.userId : ($('#studentFilter')?.value || 'HV001');
  const plans = await api(`/api/plans?student=${encodeURIComponent(student)}`);
  const trainerControls = state.role === 'HLV' ? '<button class="primary-button" id="createPlanButton">＋ Tạo kế hoạch</button>' : '';
  const cards = plans.length ? plans.map((plan) => `<article class="plan-card"><h3>${escapeHtml(plan.name)}</h3><div class="plan-trainer">Huấn luyện viên ${escapeHtml(plan.trainer)}</div>${plan.items.map((item) => `<div class="plan-item"><span class="day-square">${escapeHtml(item.dayName.replace('Thứ ', 'T'))}</span><span class="plan-item-copy"><strong>${escapeHtml(item.exercise)}</strong><small>${escapeHtml(item.muscle)} · ${item.minutes} phút</small></span><span class="plan-calories">-${formatNumber(item.calories)} kcal</span></div>`).join('')}</article>`).join('') : '<div class="panel empty-state">Chưa có kế hoạch tập luyện.</div>';
  $('#appContent').innerHTML = `<section class="section-head"><div><div class="eyebrow">LỊCH TẬP THEO TUẦN</div><h1 class="section-title">${state.role === 'HLV' ? 'Kế hoạch tập luyện' : 'Kế hoạch của bạn'}</h1><p class="section-subtitle">${state.role === 'HLV' ? 'Xây dựng lịch tập phù hợp cho từng học viên.' : 'Lịch tập do huấn luyện viên thiết kế cho bạn.'}</p></div>${trainerControls}</section>${state.role === 'HLV' ? '<div class="field" style="max-width:280px;margin-bottom:15px"><label>HỌC VIÊN</label><select class="select-input" id="studentFilter"></select></div>' : ''}<section class="plans-grid">${cards}</section>`;
  if (state.role === 'HLV') {
    const students = await api('/api/students');
    $('#studentFilter').innerHTML = students.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    $('#studentFilter').value = student;
  }
}
async function renderStudents() {
  const students = await api('/api/students');
  $('#appContent').innerHTML = `<section class="section-head"><div><div class="eyebrow">THEO DÕI TIẾN ĐỘ</div><h1 class="section-title">Học viên của tôi</h1><p class="section-subtitle">Tình hình mục tiêu năng lượng và cân nặng hôm nay.</p></div><button class="primary-button" data-page="plans">Tạo kế hoạch tập</button></section><section class="role-grid">${students.map((student) => `<article class="student-card"><div class="student-head"><span class="student-avatar">${escapeHtml(student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase())}</span><div><h3>${escapeHtml(student.name)}</h3><p>${escapeHtml(student.goal)} · ${student.weight} kg</p></div></div><div class="student-stats"><span>TDEE<b>${formatNumber(student.tdee)} kcal</b></span><span>Đã nạp hôm nay<b>${formatNumber(student.calories)} kcal</b></span></div><div class="small-progress"><i style="width:${student.progress}%"></i></div><div class="student-progress-label"><span>Tiến độ calo</span><span>${student.progress}%</span></div><button class="panel-link" style="padding:13px 0 0" data-plan-student="${escapeHtml(student.id)}">Xem kế hoạch →</button></article>`).join('')}</section>`;
}
async function renderCatalog() {
  state.foods = await api('/api/foods');
  state.exercises = await api('/api/exercises');
  const foodRows = state.foods.map((food) => `<div class="catalog-row" data-catalog-name="${escapeHtml(food.TenMon.toLocaleLowerCase())}"><span><strong>${escapeHtml(food.TenMon)}</strong><small>${formatNumber(food.CaloPer100g)} kcal · P ${food.Protein}g · C ${food.Carb}g · F ${food.Fat}g / 100g</small></span><span class="row-actions"><button class="icon-button" title="Sửa" data-edit-food="${food.MaMon}">✎</button><button class="icon-button danger" title="Xóa" data-delete-food="${food.MaMon}">×</button></span></div>`).join('');
  const exerciseRows = state.exercises.map((exercise) => `<div class="catalog-row" data-catalog-name="${escapeHtml(exercise.TenBaiTap.toLocaleLowerCase())}"><span><strong>${escapeHtml(exercise.TenBaiTap)}</strong><small>${escapeHtml(exercise.NhomCo)} · ${exercise.LoaiBaiTap} · ${exercise.CaloPerMinute} kcal/phút</small></span><span class="row-actions"><button class="icon-button" title="Sửa" data-edit-exercise="${exercise.MaBT}">✎</button><button class="icon-button danger" title="Xóa" data-delete-exercise="${exercise.MaBT}">×</button></span></div>`).join('');
  $('#appContent').innerHTML = `<section class="section-head"><div><div class="eyebrow">QUẢN TRỊ DỮ LIỆU</div><h1 class="section-title">Danh mục hệ thống</h1><p class="section-subtitle">Quản lý món ăn, dinh dưỡng và bài tập chuẩn.</p></div></section><div class="filters" style="margin-bottom:14px"><input class="search-input" id="catalogSearch" type="search" placeholder="Tìm món ăn hoặc bài tập…" aria-label="Tìm món ăn hoặc bài tập"></div><section class="catalog-layout"><article class="catalog-panel"><div class="panel-heading"><div><h2>Món ăn</h2><p>${state.foods.length} món trong danh mục</p></div><button class="primary-button" data-add-catalog="food">＋ Thêm món</button></div><div class="catalog-list">${foodRows || '<div class="empty-state">Chưa có món ăn.</div>'}</div></article><article class="catalog-panel"><div class="panel-heading"><div><h2>Bài tập</h2><p>${state.exercises.length} bài tập chuẩn</p></div><button class="primary-button" data-add-catalog="exercise">＋ Thêm bài tập</button></div><div class="catalog-list">${exerciseRows || '<div class="empty-state">Chưa có bài tập.</div>'}</div></article></section>`;
}
async function renderUsers() {
  const users = await api('/api/users');
  $('#appContent').innerHTML = `<section class="section-head"><div><div class="eyebrow">QUẢN LÝ TÀI KHOẢN</div><h1 class="section-title">Người dùng hệ thống</h1><p class="section-subtitle">Danh sách học viên, huấn luyện viên và quản trị viên.</p></div><button class="primary-button" id="addUserButton">＋ Tạo tài khoản</button></section><div class="panel" style="overflow-x:auto;padding:0"><table class="users-table"><thead><tr><th>MÃ TÀI KHOẢN</th><th>HỌ VÀ TÊN</th><th>EMAIL</th><th>SỐ ĐIỆN THOẠI</th><th>VAI TRÒ</th></tr></thead><tbody>${users.map((user) => `<tr><td>${escapeHtml(user.MaND)}</td><td><strong>${escapeHtml(user.HoTen)}</strong></td><td>${escapeHtml(user.Email)}</td><td>${escapeHtml(user.SoDienThoai || '—')}</td><td><span class="role-pill ${user.VaiTro === 'Admin' ? 'admin' : user.VaiTro === 'HLV' ? 'hlv' : ''}">${escapeHtml(roleNames[user.VaiTro])}</span></td></tr>`).join('')}</tbody></table></div>`;
}
async function render() {
  destroyCharts();
  setNavigation();
  try {
    if (state.page === 'dashboard') await renderDashboard();
    else if (state.page === 'meals') await renderMeals();
    else if (state.page === 'reports') await renderReports();
    else if (state.page === 'plans') await renderPlans();
    else if (state.page === 'students') await renderStudents();
    else if (state.page === 'catalog') await renderCatalog();
    else if (state.page === 'users') await renderUsers();
  } catch (error) {
    $('#appContent').innerHTML = `<div class="panel empty-state">${escapeHtml(error.message)}<br><button class="secondary-button" onclick="render()">Thử tải lại</button></div>`;
  }
}
function openModal(title, body, submitLabel = 'Lưu') {
  $('#modal').innerHTML = `<div class="modal-header"><h2>${title}</h2><button class="close-modal" type="button" data-close-modal aria-label="Đóng">×</button></div>${body}<div class="modal-footer"><button class="secondary-button" type="button" data-close-modal>Hủy</button><button class="primary-button" type="submit" form="modalForm">${submitLabel}</button></div>`;
  $('#modalBackdrop').hidden = false;
  $('#modalForm')?.querySelector('input,select')?.focus();
}
function closeModal() { $('#modalBackdrop').hidden = true; }
function mealModal() {
  const options = state.foods.map((food) => `<option value="${food.MaMon}">${escapeHtml(food.TenMon)} · ${formatNumber(food.CaloPer100g)} kcal/100g</option>`).join('');
  openModal('Ghi nhật ký dinh dưỡng', `<form id="modalForm"><div class="form-grid"><div class="field full"><label for="foodSearch">TÌM MÓN ĂN</label><input id="foodSearch" type="search" placeholder="Nhập tên món ăn…"></div><div class="field full"><label for="mealFood">MÓN ĂN</label><select id="mealFood" name="food_id" required>${options}</select></div><div class="field"><label for="mealGrams">KHỐI LƯỢNG (GRAM)</label><input id="mealGrams" name="grams" type="number" min="1" max="3000" value="150" required></div><div class="field"><label for="mealTime">BỮA ĂN</label><select id="mealTime" name="meal"><option>Sáng</option><option>Trưa</option><option>Tối</option><option>Phụ</option></select></div><div class="field full" id="mealEstimate" style="color:#718752;font-size:11px">Năng lượng ước tính sẽ cập nhật theo khẩu phần.</div></div></form>`);
  const foodSelect = $('#mealFood');
  const updateOptions = () => {
    const query = $('#foodSearch').value.trim().toLocaleLowerCase();
    const matches = state.foods.filter((food) => food.TenMon.toLocaleLowerCase().includes(query));
    foodSelect.innerHTML = matches.map((food) => `<option value="${food.MaMon}">${escapeHtml(food.TenMon)} · ${formatNumber(food.CaloPer100g)} kcal/100g</option>`).join('');
    $('#mealEstimate').textContent = matches.length ? 'Năng lượng ước tính sẽ cập nhật theo khẩu phần.' : 'Không tìm thấy món ăn phù hợp.';
    updateEstimate();
  };
  const updateEstimate = () => {
    const food = state.foods.find((item) => item.MaMon === Number(foodSelect.value));
    if (!food) return;
    $('#mealEstimate').textContent = `Ước tính: ${formatNumber(food.CaloPer100g * Number($('#mealGrams').value || 0) / 100)} kcal · Protein ${Math.round(food.Protein * Number($('#mealGrams').value || 0) / 100)}g · Carb ${Math.round(food.Carb * Number($('#mealGrams').value || 0) / 100)}g · Fat ${Math.round(food.Fat * Number($('#mealGrams').value || 0) / 100)}g`;
  };
  $('#foodSearch').addEventListener('input', updateOptions);
  foodSelect.addEventListener('change', updateEstimate);
  $('#mealGrams').addEventListener('input', updateEstimate);
  updateEstimate();
}
function planModal() {
  const body = `<form id="modalForm"><div class="form-grid"><div class="field full"><label>TÊN KẾ HOẠCH</label><input name="name" value="Kế hoạch sức mạnh" required></div><div class="field full"><label>HỌC VIÊN</label><select name="student_id" id="planStudent" required></select></div><div class="field full"><label>BÀI TẬP</label><div id="planRows"></div><button class="secondary-button" id="addPlanRow" type="button" style="margin-top:8px">＋ Thêm buổi tập</button></div><div class="field full" id="planEstimate" style="color:#718752;font-size:11px">Tổng calo tiêu hao dự kiến: 0 kcal</div></div></form>`;
  openModal('Tạo kế hoạch tập luyện', body, 'Giao kế hoạch');
  Promise.all([api('/api/students'), api('/api/exercises')]).then(([students, exercises]) => {
    $('#planStudent').innerHTML = students.map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}</option>`).join('');
    const addRow = () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'form-grid plan-entry';
      wrapper.style.cssText = 'grid-template-columns:1.6fr .8fr .8fr;margin:8px 0';
      wrapper.innerHTML = `<div class="field"><select name="exercise_id">${exercises.map((item) => `<option value="${item.MaBT}" data-rate="${item.CaloPerMinute}">${escapeHtml(item.TenBaiTap)}</option>`).join('')}</select></div><div class="field"><select name="day">${days.map((day, index) => `<option value="${index + 1}">${day}</option>`).join('')}</select></div><div class="field"><input name="minutes" type="number" min="1" max="300" value="30" aria-label="Thời lượng phút"></div>`;
      $('#planRows').append(wrapper);
      wrapper.addEventListener('input', updatePlanEstimate);
      updatePlanEstimate();
    };
    const updatePlanEstimate = () => {
      const total = [...document.querySelectorAll('.plan-entry')].reduce((sum, row) => sum + Number($('option:checked', row)?.dataset.rate || 0) * Number($('[name="minutes"]', row)?.value || 0), 0);
      $('#planEstimate').textContent = `Tổng calo tiêu hao dự kiến: ${formatNumber(total)} kcal / tuần`;
    };
    $('#addPlanRow').addEventListener('click', addRow);
    addRow();
  }).catch((error) => showToast(error.message, true));
}
function catalogModal(kind, existing = null) {
  const isFood = kind === 'food';
  const item = existing || {};
  const fields = isFood
    ? [['TenMon', 'Tên món ăn', 'text'], ['CaloPer100g', 'Calo / 100 g', 'number'], ['Protein', 'Protein (g)', 'number'], ['Carb', 'Carb (g)', 'number'], ['Fat', 'Fat (g)', 'number']]
    : [['TenBaiTap', 'Tên bài tập', 'text'], ['NhomCo', 'Nhóm cơ', 'text'], ['LoaiBaiTap', 'Loại bài tập', 'select'], ['CaloPerMinute', 'Calo / phút', 'number']];
  const inputs = fields.map(([key, label, type]) => `<div class="field ${fields.length === 5 && key !== 'TenMon' ? '' : key === 'TenMon' || key === 'TenBaiTap' ? 'full' : ''}"><label>${label.toUpperCase()}</label>${type === 'select' ? `<select name="${key}"><option value="Cardio" ${item[key] === 'Cardio' ? 'selected' : ''}>Cardio</option><option value="Strength" ${item[key] === 'Strength' ? 'selected' : ''}>Strength</option></select>` : `<input name="${key}" type="${type}" min="${type === 'number' ? '0' : ''}" step="any" value="${escapeHtml(item[key] ?? '')}" required>`}</div>`).join('');
  openModal(`${existing ? 'Sửa' : 'Thêm'} ${isFood ? 'món ăn' : 'bài tập'}`, `<form id="modalForm" data-kind="${kind}" data-id="${existing ? (item.MaMon || item.MaBT) : ''}"><div class="form-grid">${inputs}</div></form>`);
}
function userModal() {
  openModal('Tạo tài khoản người dùng', `<form id="modalForm"><div class="form-grid"><div class="field"><label>MÃ TÀI KHOẢN</label><input name="id" placeholder="HV003" required></div><div class="field"><label>VAI TRÒ</label><select name="role"><option value="HocVien">Học viên</option><option value="HLV">Huấn luyện viên</option></select></div><div class="field full"><label>HỌ VÀ TÊN</label><input name="name" required></div><div class="field"><label>EMAIL</label><input name="email" type="email" required></div><div class="field"><label>SỐ ĐIỆN THOẠI</label><input name="phone"></div><div class="field"><label>CHIỀU CAO (CM)</label><input name="height" type="number" value="170"></div><div class="field"><label>CÂN NẶNG (KG)</label><input name="weight" type="number" value="70"></div><div class="field full" id="studentFields"><div class="form-grid"><div class="field"><label>TUỔI</label><input name="age" type="number" value="25"></div><div class="field"><label>GIỚI TÍNH</label><select name="gender"><option>Nam</option><option>Nữ</option></select></div><div class="field"><label>HỆ SỐ VẬN ĐỘNG</label><select name="activity"><option value="1.2">1.2 · Ít vận động</option><option value="1.375">1.375 · Nhẹ</option><option value="1.55" selected>1.55 · Trung bình</option><option value="1.725">1.725 · Cao</option></select></div><div class="field"><label>MỤC TIÊU</label><select name="goal"><option>Tăng cơ</option><option>Giảm mỡ</option><option>Duy trì</option></select></div></div></div></div></form>`);
  $('[name="role"]', $('#modal')).addEventListener('change', (event) => { $('#studentFields').style.display = event.target.value === 'HocVien' ? 'block' : 'none'; });
}

$('#roleSelect').addEventListener('change', (event) => {
  state.role = event.target.value;
  state.userId = roleUser[state.role];
  state.page = 'dashboard';
  $('#profileButton .profile-copy b').textContent = state.role === 'HocVien' ? 'Minh Anh' : roleNames[state.role];
  $('#profileButton .profile-copy small').textContent = 'Chế độ xem';
  render();
});
$('#navigation').addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (button) { state.page = button.dataset.page; render(); $('#sidebar').classList.remove('open'); }
});
$('#appContent').addEventListener('click', async (event) => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { state.page = pageButton.dataset.page; await render(); return; }
  const quick = event.target.closest('[data-quick-food]');
  if (quick) { mealModal(); $('#mealFood').value = quick.dataset.quickFood; $('#mealFood').dispatchEvent(new Event('change')); return; }
  if (event.target.closest('#addMealButton')) { mealModal(); return; }
  if (event.target.closest('#createPlanButton')) { planModal(); return; }
  if (event.target.closest('#addUserButton')) { userModal(); return; }
  if (event.target.closest('[data-add-catalog]')) { catalogModal(event.target.closest('[data-add-catalog]').dataset.addCatalog); return; }
  const planStudent = event.target.closest('[data-plan-student]');
  if (planStudent) { state.page = 'plans'; state.role = 'HLV'; $('#roleSelect').value = 'HLV'; await render(); const select = $('#studentFilter'); if (select) { select.value = planStudent.dataset.planStudent; select.dispatchEvent(new Event('change')); } return; }
  const editFood = event.target.closest('[data-edit-food]');
  const editExercise = event.target.closest('[data-edit-exercise]');
  if (editFood || editExercise) { const kind = editFood ? 'food' : 'exercise'; const list = kind === 'food' ? state.foods : state.exercises; const id = Number((editFood || editExercise).dataset[kind === 'food' ? 'editFood' : 'editExercise']); catalogModal(kind, list.find((item) => (item.MaMon || item.MaBT) === id)); return; }
  const deleteFood = event.target.closest('[data-delete-food]');
  const deleteExercise = event.target.closest('[data-delete-exercise]');
  if (deleteFood || deleteExercise) {
    const isFood = !!deleteFood; const id = Number((deleteFood || deleteExercise).dataset[isFood ? 'deleteFood' : 'deleteExercise']);
    if (confirm('Xóa mục này khỏi danh mục?')) { try { await api(`/api/${isFood ? 'foods' : 'exercises'}/${id}`, { method: 'DELETE' }); showToast('Đã xóa khỏi danh mục.'); await render(); } catch (error) { showToast(error.message, true); } }
  }
});
$('#appContent').addEventListener('change', async (event) => {
  if (event.target.id === 'studentFilter') { try { const plans = await api(`/api/plans?student=${encodeURIComponent(event.target.value)}`); const section = $('.plans-grid'); section.innerHTML = plans.length ? plans.map((plan) => `<article class="plan-card"><h3>${escapeHtml(plan.name)}</h3><div class="plan-trainer">Huấn luyện viên ${escapeHtml(plan.trainer)}</div>${plan.items.map((item) => `<div class="plan-item"><span class="day-square">${escapeHtml(item.dayName.replace('Thứ ', 'T'))}</span><span class="plan-item-copy"><strong>${escapeHtml(item.exercise)}</strong><small>${escapeHtml(item.muscle)} · ${item.minutes} phút</small></span><span class="plan-calories">-${formatNumber(item.calories)} kcal</span></div>`).join('')}</article>`).join('') : '<div class="panel empty-state">Chưa có kế hoạch tập luyện.</div>'; } catch (error) { showToast(error.message, true); } }
});
$('#appContent').addEventListener('input', (event) => {
  if (event.target.id !== 'catalogSearch') return;
  const query = event.target.value.trim().toLocaleLowerCase();
  document.querySelectorAll('.catalog-row').forEach((row) => {
    row.hidden = !row.dataset.catalogName.includes(query);
  });
});
$('#modalBackdrop').addEventListener('click', (event) => { if (event.target === $('#modalBackdrop') || event.target.closest('[data-close-modal]')) closeModal(); });
$('#modal').addEventListener('submit', async (event) => {
  if (event.target.id !== 'modalForm') return;
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    if (state.page === 'meals' || form.querySelector('[name="food_id"]')) {
      await api('/api/meals', { method: 'POST', body: JSON.stringify({ ...values, food_id: Number(values.food_id), grams: Number(values.grams), user_id: state.userId }) });
      showToast('Đã thêm món ăn vào nhật ký.');
    } else if (form.querySelector('.plan-entry')) {
      const items = [...form.querySelectorAll('.plan-entry')].map((row) => ({ exercise_id: Number($('[name="exercise_id"]', row).value), day: Number($('[name="day"]', row).value), minutes: Number($('[name="minutes"]', row).value) }));
      await api('/api/plans', { method: 'POST', body: JSON.stringify({ name: values.name, student_id: values.student_id, trainer_id: 'PT001', items }) });
      showToast('Đã giao kế hoạch tập luyện.');
    } else if (form.dataset.kind) {
      const isFood = form.dataset.kind === 'food';
      const endpoint = isFood ? '/api/foods' : '/api/exercises';
      const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, ['CaloPer100g', 'Protein', 'Carb', 'Fat', 'CaloPerMinute'].includes(key) ? Number(value) : value]));
      await api(form.dataset.id ? `${endpoint}/${form.dataset.id}` : endpoint, { method: form.dataset.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      showToast(form.dataset.id ? 'Đã cập nhật danh mục.' : 'Đã thêm vào danh mục.');
    } else {
      const payload = { ...values, height: Number(values.height), weight: Number(values.weight), age: Number(values.age), activity: Number(values.activity) };
      await api('/api/users', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Đã tạo tài khoản.');
    }
    closeModal();
    await render();
  } catch (error) { showToast(error.message, true); }
});
$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#todayLabel').textContent = dateLabel();
render();
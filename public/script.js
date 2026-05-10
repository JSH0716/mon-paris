/* ============================================================
   MON PARIS — script.js
   ============================================================ */

const CAT_COLORS = {
  '관광지':   '#4a7c59',
  '레스토랑': '#8b3a3a',
  '카페':     '#6b4f2a',
  '빵집':     '#7a5c2e',
  '액티비티': '#2a5c7a',
};

const CAT_ICONS = {
  '관광지':   '🏛️',
  '레스토랑': '🍽️',
  '카페':     '☕',
  '빵집':     '🥐',
  '액티비티': '🎭',
};

let allPlaces = [];
let selectedNames = new Set();
let currentCategory = '전체';

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/paris_travel_info.json');
    allPlaces = await res.json();
    renderCards('전체');
    setupTabs();
  } catch (e) {
    showError('장소 목록을 불러오지 못했습니다. 서버가 실행 중인지 확인하세요.');
  }
});

// ===================== TABS =====================
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      renderCards(currentCategory);
    });
  });
}

// ===================== RENDER CARDS =====================
function renderCards(category) {
  const grid = document.getElementById('places-grid');
  const filtered = category === '전체'
    ? allPlaces
    : allPlaces.filter(p => p.category === category);

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); font-family:var(--ff-ui); padding:2rem;">해당 카테고리의 장소가 없습니다.</p>';
    return;
  }

  filtered.forEach((place, i) => {
    const card = document.createElement('div');
    card.className = 'place-card' + (selectedNames.has(place.name) ? ' selected' : '');
    card.style.animationDelay = `${i * 0.04}s`;
    card.style.setProperty('--cat-color', CAT_COLORS[place.category] || 'var(--gold)');
    card.dataset.name = place.name;

    const fee = place.entrance_fee || place.price_range || '입장료 정보 없음';
    const hours = place.operating_hours || '';
    const isSelected = selectedNames.has(place.name);

    card.innerHTML = `
      ${place.image ? `<div class="card-image-container"><img src="${place.image}" alt="${place.name}" class="card-img"></div>` : ''}
      <div class="card-content-wrapper">
        <div class="card-header">
          <span class="card-category-badge" style="background:${CAT_COLORS[place.category] || 'var(--gold)'}">${CAT_ICONS[place.category] || '📍'} ${place.category}</span>
          <div class="card-check">${isSelected ? '✓' : ''}</div>
        </div>
        <div class="card-name">${place.name}</div>
        <div class="card-location">📍 ${(place.location || '').split('/')[0].trim()}</div>
        <div class="card-info-row">
          ${fee ? `<div class="card-info-item"><span class="card-info-icon">💶</span><span class="card-info-text">${fee.length > 22 ? fee.substring(0, 22) + '…' : fee}</span></div>` : ''}
          ${hours ? `<div class="card-info-item"><span class="card-info-icon">🕐</span><span class="card-info-text">${hours.split(' (')[0].substring(0, 20)}${hours.length > 20 ? '…' : ''}</span></div>` : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => togglePlace(place.name, card));
    grid.appendChild(card);
  });
}

// ===================== TOGGLE SELECTION =====================
function togglePlace(name, cardEl) {
  if (selectedNames.has(name)) {
    selectedNames.delete(name);
    cardEl.classList.remove('selected');
    cardEl.querySelector('.card-check').textContent = '';
  } else {
    selectedNames.add(name);
    cardEl.classList.add('selected');
    cardEl.querySelector('.card-check').textContent = '✓';
  }
  updateSelectedBar();
}

function updateSelectedBar() {
  const bar = document.getElementById('selected-bar');
  const countEl = document.getElementById('selected-count');
  const tagsEl = document.getElementById('selected-tags');

  countEl.textContent = `${selectedNames.size}개 선택됨`;
  tagsEl.innerHTML = '';

  selectedNames.forEach(name => {
    const tag = document.createElement('span');
    tag.className = 'selected-tag';
    tag.textContent = name.split('(')[0].trim();
    tagsEl.appendChild(tag);
  });
}

function clearSelection() {
  selectedNames.clear();
  document.querySelectorAll('.place-card.selected').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('.card-check').textContent = '';
  });
  updateSelectedBar();
}

// ===================== GENERATE PLAN =====================
async function generatePlan() {
  if (selectedNames.size === 0) {
    showError('최소 1개 이상의 장소를 선택해주세요.');
    return;
  }

  const daysInput = document.querySelector('input[name="days"]:checked');
  const transportInput = document.querySelector('input[name="transport"]:checked');
  
  const days = daysInput ? parseInt(daysInput.value) : 2;
  const hotel = document.getElementById('hotel').value.trim() || '파리 시내 중심부';
  const transport = transportInput ? transportInput.value : '도보 및 지하철(메트로)';

  showLoading(true);
  hideResult();

  try {
    const selectedPlaces = allPlaces.filter(p => selectedNames.has(p.name));

    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedPlaces,
        days,
        hotel,
        transport
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'AI 서버 오류가 발생했습니다.');
    }

    renderPlan(data.plan);

  } catch (e) {
    showError(e.message);
  } finally {
    showLoading(false);
  }
}

// ===================== RENDER PLAN =====================
function renderPlan(plan) {
  document.getElementById('plan-title').textContent = plan.title || '나만의 파리 여행';
  document.getElementById('plan-summary').textContent = plan.summary || '';

  const container = document.getElementById('timeline-container');
  container.innerHTML = '';

  (plan.days || []).forEach((dayData, idx) => {
    const block = document.createElement('div');
    block.className = 'day-block';
    block.style.animationDelay = `${idx * 0.1}s`;

    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `
      <span class="day-badge">Jour ${dayData.day} · ${dayData.day}일차</span>
      <span class="day-theme">${dayData.theme || ''}</span>
    `;

    const list = document.createElement('div');
    list.className = 'schedule-list';

    (dayData.schedule || []).forEach(item => {
      const catColor = CAT_COLORS[item.category] || 'var(--gold)';
      const catIcon  = CAT_ICONS[item.category]  || '📍';

      const el = document.createElement('div');
      el.className = 'schedule-item';
      el.innerHTML = `
        <div class="schedule-time">${item.time || ''}</div>
        <div class="schedule-body">
          ${item.is_golden_hour ? `<div class="golden-hour-badge">가장 아름다운 시간</div>` : ''}
          <div class="schedule-name">${item.name || ''}</div>
          <span class="schedule-cat-badge" style="background:${catColor}">${catIcon} ${item.category || ''}</span>
          <div class="schedule-location">📍 ${(item.location || '').split('/')[0].trim()}</div>
          ${item.recommended_menu ? `<div class="schedule-menu">✨ 추천 메뉴: <em>${item.recommended_menu}</em></div>` : ''}
          ${item.is_golden_hour && item.golden_hour_reason ? `<div class="golden-hour-note">"${item.golden_hour_reason}"</div>` : `<div class="schedule-tip">${item.tip || ''}</div>`}
          ${item.golden_hour_alert ? `<div class="golden-hour-alert">💡 ${item.golden_hour_alert}</div>` : ''}
        </div>
      `;
      list.appendChild(el);
    });

    block.appendChild(header);
    block.appendChild(list);

    // Day Footer (Expenses & Preparation)
    const footer = document.createElement('div');
    footer.className = 'day-footer';
    
    let prepHtml = '';
    if (dayData.preparation && dayData.preparation.length > 0) {
      prepHtml = `
        <div class="prep-section">
          <div class="footer-label">🎒 오늘의 준비물</div>
          <div class="prep-list">${dayData.preparation.map(p => `<span>#${p}</span>`).join(' ')}</div>
        </div>
      `;
    }

    let expenseHtml = '';
    if (dayData.daily_expenses) {
      const euro = dayData.daily_expenses.euro || 0;
      const krw = dayData.daily_expenses.krw || 0;
      expenseHtml = `
        <div class="expense-section">
          <div class="footer-label">💰 일일 예상 지출</div>
          <div class="expense-values">
            <span class="val-euro">€${euro.toLocaleString()}</span>
            <span class="val-krw">약 ${krw.toLocaleString()}원</span>
          </div>
        </div>
      `;
    }

    if (prepHtml || expenseHtml) {
      footer.innerHTML = prepHtml + expenseHtml;
      block.appendChild(footer);
    }

    container.appendChild(block);
  });

  const section = document.getElementById('result-section');
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===================== RESET =====================
function resetAll() {
  clearSelection();
  hideResult();
  document.getElementById('step-1').scrollIntoView({ behavior: 'smooth' });
}

// ===================== UTILS =====================
function showLoading(show) {
  document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function hideResult() {
  document.getElementById('result-section').style.display = 'none';
}

function showError(msg) {
  const toast = document.getElementById('error-toast');
  document.getElementById('error-msg').textContent = msg;
  toast.style.display = 'flex';
  setTimeout(() => { toast.style.display = 'none'; }, 5000);
}

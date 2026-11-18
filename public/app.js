// مغز صفحه‌ی «موتور جست‌وجوگر ماهان» — نسخه‌ی پنجم؛ با جاوااسکریپت ساده، بدون هیچ کتابخانه‌ای.
// کارش: آگهی‌ها را از برنامه می‌گیرد، کارت می‌سازد، تایمر تازه‌سازی را نشان می‌دهد
// و بعد از هر تازه‌سازی، یک پیام در چت وضعیت می‌گذارد.

// هر صفحه ۱۰ آگهی نشان می‌دهد.
const PAGE_SIZE = 10;

// بخش‌های پنل کناری؛ هر بخش یک فیلتر روی همان لیست است.
// 'rent-residential' یعنی اجاره‌ی مسکونی، 'rent-office' یعنی اجاره‌ی اداری،
// 'buy-residential' یعنی خرید مسکونی، 'buy-office' یعنی خرید دفترکار،
// 'budget' یعنی سرچ بودجه (از سرور می‌آید)، 'new' یعنی آگهی‌های جدید (خوانده‌نشده).
const VIEW_TITLES = {
  all: 'همه‌ی آگهی‌ها',
  'rent-residential': 'اجاره مسکونی',
  'rent-office': 'اجاره اداری',
  'buy-residential': 'خرید مسکونی',
  'buy-office': 'خرید دفترکار',
  budget: 'سرچ بودجه',
  new: 'آگهی‌های جدید',
};

// وضعیت صفحه؛ همه‌چیز همین‌جا جمع است.
const state = {
  allListings: [], // همه‌ی آگهی‌های ذخیره‌شده.
  unreadTokens: new Set(), // شناسه‌ی آگهی‌هایی که هنوز خوانده نشده‌اند.
  view: 'all', // بخش انتخاب‌شده.
  page: 1, // صفحه‌ی فعلی.
  source: 'all', // فیلتر منبع؛ 'all' یعنی همه، 'divar' یعنی فقط دیوار، 'sheypoor' یعنی فقط شیپور.
  landOnly: false, // اگر درست باشد، فقط زمین نشان داده می‌شود.
  budgetResults: null, // نتیجه‌ی آخرین سرچ بودجه؛ خالی یعنی هنوز سرچ نشده است.
  nextRunAt: null, // وقتی که تازه‌سازی خودکار بعدی انجام می‌شود.
  intervalMinutes: 30, // فاصله‌ی بین دو تازه‌سازی خودکار، به دقیقه.
  userName: '', // اسم کسی که وارد شده است.
};

// متن‌های سایت را تمیز می‌کنیم تا اگر در تیتر آگهی علامت خاصی بود، صفحه خراب نشود.
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// یک مبلغ تومان را به زبان آدم می‌نویسد؛ مثلاً 2000000000 می‌شود «۲ میلیارد تومان».
function formatToman(amount) {
  const fa = (n) => n.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
  if (amount >= 1000000000) {
    return `${fa(amount / 1000000000)} میلیارد تومان`;
  }
  if (amount >= 1000000) {
    return `${fa(amount / 1000000)} میلیون تومان`;
  }
  return `${fa(amount)} تومان`;
}

// ساعت را به زبان آدم می‌نویسد؛ مثلاً «۱۷:۳۲».
function formatTime(date) {
  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

// آگهی‌ها را تازه‌ترین اول مرتب می‌کند؛ چون `fetchedAt` تاریخ گرفتن آگهی است.
function newestFirst(listings) {
  return [...listings].sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));
}

// لیست آگهی‌های بخش انتخاب‌شده را می‌دهد؛ فیلتر منبع و زمین هم روی آن اعمال می‌شود.
function visibleListings() {
  const sorted = newestFirst(state.allListings);
  let list;
  if (state.view === 'budget') {
    // سرچ بودجه از سرور آمده؛ همان را نشان می‌دهیم، فقط فیلتر منبع رویش می‌خورد.
    list = state.budgetResults ? [...state.budgetResults] : [];
  } else if (state.view === 'new') {
    list = sorted.filter((listing) => state.unreadTokens.has(listing.token));
  } else if (state.view === 'rent-residential') {
    list = sorted.filter((listing) => listing.category === 'apartment-rent');
  } else if (state.view === 'rent-office') {
    list = sorted.filter((listing) => listing.category === 'office-rent');
  } else if (state.view === 'buy-residential') {
    list = sorted.filter((listing) => listing.category === 'apartment-sell');
  } else if (state.view === 'buy-office') {
    list = sorted.filter((listing) => listing.category === 'office-sell');
  } else {
    list = sorted;
  }
  if (state.landOnly) {
    list = list.filter((listing) => listing.category === 'plot-old');
  }
  if (state.source !== 'all') {
    list = list.filter((listing) => listing.source === state.source);
  }
  return list;
}

// یک آیکون امکان؛ سبز یعنی «دارد»، قرمز یعنی «ندارد»، خاکستری یعنی «معلوم نیست».
// «معلوم نیست» برای آگهی‌های قدیمی است که متنشان ذخیره نشده؛ قرمز نیست چون نگفته ندارد.
function featureIcon(value, label) {
  if (value === true) {
    return `<span class="feat on" title="${label} دارد">✓ ${label}</span>`;
  }
  if (value === false) {
    return `<span class="feat off" title="${label} ندارد">✗ ${label}</span>`;
  }
  return `<span class="feat unknown" title="${label} معلوم نیست">؟ ${label}</span>`;
}

// یک کارت آگهی می‌سازد؛ عکس بالا، متن پایین.
// اگر «معادل رهن کامل» داده شود، روی کارت دو خط اضافه می‌شود:
// رهن و اجاره‌ی اصلی آگهی، و معادل رهن کامل آن — تا معلوم باشد چرا این آگهی پیدا شده است.
function cardHtml(listing, isNew, equivalentRahn) {
  const photo = listing.imageUrl
    ? `<img class="card-photo" src="${escapeHtml(listing.imageUrl)}" alt="عکس آگهی" loading="lazy" onerror="this.outerHTML='<div class=&quot;card-photo-placeholder&quot;>🏠</div>'">`
    : '<div class="card-photo-placeholder">🏠</div>';
  const sourceName = listing.source === 'sheypoor' ? 'شیپور' : 'دیوار';
  const newBadge = isNew ? '<span class="badge new">🆕 جدید</span>' : '';
  const equivalentLine =
    equivalentRahn === undefined
      ? ''
      : `<p class="card-equivalent">معادل رهن کامل: ${formatToman(equivalentRahn)}</p>
        <p class="card-original">رهن: ${formatToman(listing.rahnAmount ?? 0)} • اجاره: ${formatToman(listing.ejareAmount ?? 0)} در ماه</p>`;
  const features = listing.features ?? null;
  const featuresLine = features
    ? `<div class="features">
        ${featureIcon(features.parking, 'پارکینگ')}
        ${featureIcon(features.storage, 'انباری')}
        ${featureIcon(features.elevator, 'آسانسور')}
        ${features.highlight ? `<span class="badge highlight">✦ ${escapeHtml(features.highlight)}</span>` : ''}
      </div>`
    : '';
  return `
    <article class="card">
      ${photo}
      <div class="card-body">
        <h3>${escapeHtml(listing.title)}</h3>
        <p class="card-price">${escapeHtml(listing.priceText)}</p>
        ${equivalentLine}
        <p class="card-meta">${escapeHtml(listing.district)} • ${escapeHtml(listing.categoryLabel)}</p>
        ${featuresLine}
        <div class="badges">
          <span class="badge source">${sourceName}</span>
          ${newBadge}
        </div>
        <a class="card-link" href="${escapeHtml(listing.url)}" target="_blank" rel="noopener">دیدن آگهی ←</a>
      </div>
    </article>`;
}

// صفحه را می‌کشد: عنوان بخش، کارت‌های صفحه‌ی فعلی و دکمه‌های صفحه‌بندی.
function render() {
  const list = visibleListings();
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (state.page > totalPages) {
    state.page = totalPages;
  }
  const start = (state.page - 1) * PAGE_SIZE;
  const pageList = list.slice(start, start + PAGE_SIZE);

  document.getElementById('view-title').textContent = VIEW_TITLES[state.view];
  document.getElementById('count').textContent =
    list.length === 0 ? '' : `${list.length} آگهی — صفحه‌ی ${state.page} از ${totalPages}`;
  document.getElementById('list').innerHTML = pageList
    .map((listing) =>
      cardHtml(
        listing,
        state.unreadTokens.has(listing.token),
        state.view === 'budget' ? listing.equivalentRahn : undefined,
      ),
    )
    .join('');
  document.getElementById('empty').hidden = list.length !== 0;

  // عدد آگهی‌های جدید روی دکمه‌ی پنل کناری.
  const newCount = document.getElementById('new-count');
  newCount.textContent = state.unreadTokens.size === 0 ? '' : `(${state.unreadTokens.size})`;

  // دکمه‌های صفحه‌بندی؛ اگر فقط یک صفحه باشد، چیزی نشان نمی‌دهیم.
  const pager = document.getElementById('pager');
  if (totalPages <= 1) {
    pager.innerHTML = '';
    return;
  }
  let buttons = '';
  buttons += `<button class="pager-btn" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>قبلی ←</button>`;
  for (let p = 1; p <= totalPages; p++) {
    buttons += `<button class="pager-btn ${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }
  buttons += `<button class="pager-btn" data-page="${state.page + 1}" ${state.page >= totalPages ? 'disabled' : ''}>→ بعدی</button>`;
  pager.innerHTML = buttons;
}

// یک پیام در چت وضعیت می‌گذارد؛ تازه‌ترین پیام بالا می‌آید.
function addChatMessage(text) {
  const box = document.getElementById('chat-messages');
  const time = formatTime(new Date());
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-time">${time}</span><span>${escapeHtml(text)}</span>`;
  box.prepend(div);
}

// پیام یک دور تازه‌سازی؛ از نتیجه‌ی برنامه ساخته می‌شود.
function refreshChatMessage(result, manual) {
  const kind = manual ? 'دستی' : 'خودکار';
  const bySource = (item) => `دیوار ${item.divar}، شیپور ${item.sheypoor}`;
  return `تازه‌سازی ${kind} تمام شد: ${result.fetched} آگهی گرفته شد (${bySource(result.fetchedBySource ?? { divar: 0, sheypoor: 0 })})؛ ${result.added} تازه اضافه شد (${bySource(result.addedBySource ?? { divar: 0, sheypoor: 0 })})؛ در کل ${result.total} آگهی هست.`;
}

// لیست آگهی‌ها، اعلان‌ها و وضعیت زمان‌بندی را از برنامه می‌گیرد و صفحه را تازه می‌کند.
async function load() {
  try {
    const [listingsResponse, notificationsResponse, statusResponse] = await Promise.all([
      fetch('/listings'),
      fetch('/notifications'),
      fetch('/scheduler/status'),
    ]);
    if (listingsResponse.status === 401 || notificationsResponse.status === 401) {
      window.location.href = '/login';
      return;
    }
    state.allListings = await listingsResponse.json();
    const notifications = await notificationsResponse.json();
    state.unreadTokens = new Set(notifications.map((item) => item.token));
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      state.nextRunAt = status.nextRunAt;
      state.intervalMinutes = status.intervalMinutes ?? 30;
    }
    render();
    updateTimer();
  } catch (error) {
    document.getElementById('status').textContent = 'گرفتن آگهی‌ها نشد؛ صفحه را تازه کن.';
  }
}

// تایمر تا تازه‌سازی بعدی؛ هر ۱۰ ثانیه به‌روز می‌شود.
function updateTimer() {
  const timer = document.getElementById('timer');
  if (!state.nextRunAt) {
    timer.textContent = 'زمان‌بندی ثبت نشده است';
    return;
  }
  const left = new Date(state.nextRunAt).getTime() - Date.now();
  if (left <= 0) {
    timer.textContent = 'تازه‌سازی بعدی: به‌زودی…';
    return;
  }
  const totalSeconds = Math.floor(left / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const two = (n) => String(n).padStart(2, '0');
  timer.textContent = `تازه‌سازی بعدی: ${two(minutes)}:${two(seconds)}`;
}

// دکمه‌ی تازه‌سازی؛ یک دور تازه از دیوار و شیپور می‌گیرد (حدود یک دقیقه طول می‌کشد).
// بعد تایمر از اول می‌افتد؛ یعنی تازه‌سازی بعدی ۳۰ دقیقه بعد از همین لحظه است.
async function refresh() {
  const button = document.getElementById('refresh');
  const status = document.getElementById('status');
  button.disabled = true;
  status.textContent = 'در حال تازه‌سازی…';
  try {
    const response = await fetch('/listings/refresh', { method: 'POST' });
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }
    const result = await response.json();
    status.textContent = '';
    addChatMessage(refreshChatMessage(result, true));
    await load();
  } catch (error) {
    status.textContent = 'تازه‌سازی نشد؛ دوباره امتحان کن.';
  }
  button.disabled = false;
}

// دکمه‌ی «خوانده شد»؛ همه‌ی اعلان‌ها را خوانده‌شده می‌کند و به بخش «همه» می‌رود.
async function readAll() {
  await fetch('/notifications/read-all', { method: 'POST' });
  await load();
  setView('all');
}

// جست‌وجو بر اساس بودجه؛ دو عدد را از ورودی‌ها می‌خواند و آگهی‌هایی را می‌آورد
// که معادل رهن کامل آن‌ها زیر سقف باشد؛ نزدیک‌ترین به هدف اول است.
async function searchBudget() {
  const target = Number(document.getElementById('budget-target').value);
  const max = Number(document.getElementById('budget-max').value);
  const status = document.getElementById('budget-status');
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(max) || max <= 0 || max < target) {
    status.textContent = 'عددها درست نیستند؛ سقف باید از هدف کمتر نباشد.';
    return;
  }
  status.textContent = 'در حال جست‌وجو…';
  try {
    const response = await fetch(`/listings/budget?target=${target}&max=${max}`);
    if (!response.ok) {
      status.textContent = 'جست‌وجو نشد؛ دوباره امتحان کن.';
      return;
    }
    state.budgetResults = await response.json();
    state.page = 1;
    status.textContent =
      state.budgetResults.length === 0
        ? 'آگهی‌ای با این بودجه پیدا نشد.'
        : `${state.budgetResults.length} آگهی با معادل رهن کامل زیر ${formatToman(max)} پیدا شد؛ نزدیک‌ترین به ${formatToman(target)} اول است.`;
    render();
  } catch (error) {
    status.textContent = 'جست‌وجو نشد؛ دوباره امتحان کن.';
  }
}

// بخش را عوض می‌کند؛ صفحه از اول می‌شود و فرم بودجه فقط در بخش خودش دیده می‌شود.
function setView(view) {
  state.view = view;
  state.page = 1;
  state.landOnly = false;
  document.getElementById('land-chip').classList.remove('active');
  document.querySelectorAll('.side-btn').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  document.getElementById('budget-form').hidden = view !== 'budget';
  document.getElementById('new-actions').hidden = view !== 'new';
  document.getElementById('quick-filters').style.display = view === 'budget' ? 'none' : '';
  render();
}

// اسم کسی که وارد شده را می‌گیرد و سلام می‌کند.
async function loadMe() {
  try {
    const response = await fetch('/auth/me');
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }
    const me = await response.json();
    if (me && me.name) {
      state.userName = me.name;
      document.getElementById('greeting-text').textContent = `سلام ${me.name} 👋`;
    }
  } catch (error) {
    // اگر اسم نیامد، سلام بدون اسم می‌ماند؛ صفحه خراب نمی‌شود.
  }
}

// دکمه‌های پنل کناری.
document.getElementById('sections').addEventListener('click', (event) => {
  const button = event.target.closest('.side-btn');
  if (!button) {
    return;
  }
  setView(button.dataset.view);
});

// دکمه‌های فیلتر منبع.
document.getElementById('filters').addEventListener('click', (event) => {
  const button = event.target.closest('.filter-btn');
  if (!button) {
    return;
  }
  state.source = button.dataset.source;
  state.page = 1;
  document.querySelectorAll('#filters .filter-btn').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  render();
});

// دکمه‌ی زمین؛ فقط آگهی‌های زمین را نشان می‌دهد.
document.getElementById('land-chip').addEventListener('click', (event) => {
  const button = event.currentTarget;
  state.landOnly = !state.landOnly;
  button.classList.toggle('active', state.landOnly);
  if (state.landOnly && state.view !== 'all') {
    setView('all');
    state.landOnly = true;
    button.classList.add('active');
  }
  state.page = 1;
  render();
});

// دکمه‌های صفحه‌بندی.
document.getElementById('pager').addEventListener('click', (event) => {
  const button = event.target.closest('.pager-btn');
  if (!button || button.disabled) {
    return;
  }
  state.page = Number(button.dataset.page);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('refresh').addEventListener('click', refresh);
document.getElementById('read-all').addEventListener('click', readAll);
document.getElementById('budget-search').addEventListener('click', searchBudget);

// خروج؛ نشست پاک می‌شود و به صفحه‌ی ورود می‌رود.
document.getElementById('logout').addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/login';
});

// اول اسم را می‌گیریم و صفحه را پر می‌کنیم؛
// اگر آگهی خوانده‌نشده هست، بخش «آگهی‌های جدید» اول باز می‌شود، وگرنه «همه».
// بعد هر ۶۰ ثانیه خودبه‌خود تازه می‌شود و تایمر هم هر ۱۰ ثانیه به‌روز می‌شود.
(async function init() {
  await loadMe();
  await load();
  if (state.unreadTokens.size > 0) {
    setView('new');
  }
  addChatMessage(
    state.userName
      ? `سلام ${state.userName} 👋 به موتور جست‌وجوگر خوش آمدی.`
      : 'به موتور جست‌وجوگر خوش آمدی.',
  );
  setInterval(load, 60000);
  setInterval(updateTimer, 10000);
})();

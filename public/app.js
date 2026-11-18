// مغز صفحه‌ی «موتور جست‌وجوگر ماهان» — نسخه‌ی ۵٫۱؛ با جاوااسکریپت ساده، بدون هیچ کتابخانه‌ای.
// کارش: آگهی‌ها را از برنامه می‌گیرد، کارت می‌سازد، تایمر تازه‌سازی را نشان می‌دهد
// و بعد از هر تازه‌سازی، یک پیام در چت وضعیت می‌گذارد.
// نسخه‌ی ۵٫۱ اضافه می‌کند: مشتری‌یاب، دفترچه‌ی مشتری‌ها، محله‌های قابل‌تغییر،
/// گالری عکس، وضعیت و یادداشت روی هر آگهی، و متری و میانگین محله روی کارت.

// هر صفحه ۱۰ آگهی نشان می‌دهد.
const PAGE_SIZE = 10;

// نسبت تبدیل رهن به اجاره؛ همان ۳٪ ماهان. معادل رهن کامل یعنی رهن + اجاره تقسیم بر ۰٫۰۳.
const RAHN_RATIO = 0.03;

// بخش‌های پنل کناری؛ هر بخش یک فیلتر روی همان لیست است.
// 'rent-residential' یعنی اجاره‌ی مسکونی، 'rent-office' یعنی اجاره‌ی اداری،
// 'buy-residential' یعنی خرید مسکونی، 'buy-office' یعنی خرید دفترکار،
// 'budget' یعنی سرچ بودجه (از سرور می‌آید)، 'new' یعنی آگهی‌های جدید (خوانده‌نشده)،
// 'match' یعنی مشتری‌یاب، 'clients' یعنی دفترچه‌ی مشتری‌ها، 'districts' یعنی محله‌ها.
const VIEW_TITLES = {
  all: 'همه‌ی آگهی‌ها',
  'rent-residential': 'اجاره مسکونی',
  'rent-office': 'اجاره اداری',
  'buy-residential': 'خرید مسکونی',
  'buy-office': 'خرید دفترکار',
  budget: 'سرچ بودجه',
  new: 'آگهی‌های جدید',
  match: 'مشتری‌یاب',
  clients: 'مشتری‌ها',
  districts: 'محله‌ها',
};

// وضعیت‌های آگهی؛ همان چهار وضعیتی که ماهان روی کارت انتخاب می‌کند.
const STATUS_LABELS = {
  called: 'زنگ زدم',
  visited: 'بازدید رفت',
  done: 'معامله شد',
  rejected: 'رد شد',
};

// وضعیت صفحه؛ همه‌چیز همین‌جا جمع است.
const state = {
  allListings: [], // همه‌ی آگهی‌های ذخیره‌شده.
  unreadTokens: new Set(), // شناسه‌ی آگهی‌هایی که هنوز خوانده نشده‌اند.
  view: 'all', // بخش انتخاب‌شده.
  page: 1, // صفحه‌ی فعلی.
  source: 'all', // فیلتر منبع؛ 'all' یعنی همه، 'divar' یعنی فقط دیوار، 'sheypoor' یعنی فقط شیپور.
  landOnly: false, // اگر درست باشد، فقط زمین نشان داده می‌شود.
  district: '', // فیلتر محله؛ خالی یعنی همه‌ی محله‌ها.
  statusFilter: '', // فیلتر وضعیت؛ خالی یعنی همه‌ی وضعیت‌ها.
  budgetResults: null, // نتیجه‌ی آخرین سرچ بودجه؛ خالی یعنی هنوز سرچ نشده است.
  matchResults: null, // نتیجه‌ی آخرین مشتری‌یاب؛ خالی یعنی هنوز چیزی جست‌وجو نشده است.
  matchSummary: '', // خلاصه‌ی چیزی که مشتری‌یاب از جمله فهمید.
  clientMatches: null, // آگهی‌های مناسب مشتری انتخاب‌شده؛ خالی یعنی مشتری‌ای انتخاب نشده است.
  clientName: '', // اسم مشتری انتخاب‌شده.
  clients: [], // مشتری‌های دفترچه.
  districts: [], // محله‌های پیکربندی‌شده؛ از تنظیمات می‌آیند.
  newBudgetAll: true, // تیک «همه‌ی بودجه‌ها را نمایش بده» در بخش آگهی‌های جدید؛ پیش‌فرض روشن است.
  galleryIndex: {}, // عکس فعلی هر کارت در گالری؛ کلیدش شناسه‌ی آگهی است.
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

// یک عدد را سه‌رقم سه‌رقم با رقم‌های فارسی می‌نویسد؛ مثلاً 2000000000 می‌شود «۲٬۰۰۰٬۰۰۰٬۰۰۰».
function formatNumber(amount) {
  return Number(amount).toLocaleString('fa-IR');
}

// یک مبلغ تومان را به زبان آدم می‌نویسد؛ مثلاً 2000000000 می‌شود «۲ میلیارد تومان».
// عددها سه‌رقم سه‌رقم جدا می‌شوند.
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

// معادل رهن کامل یک آگهی، با همان نسبت ۳٪؛ برای اجاره رهن + اجاره تقسیم بر ۰٫۰۳،
// برای خرید قیمت فروش. اگر عددها خوانده نشده باشند، خالی است؛ حدس نمی‌زنیم.
function equivalentOf(listing) {
  if (listing.category === 'apartment-sell' || listing.category === 'office-sell' || listing.category === 'plot-old') {
    return listing.saleAmount ?? null;
  }
  if (listing.rahnAmount === null || listing.rahnAmount === undefined) {
    return null;
  }
  return listing.rahnAmount + (listing.ejareAmount ?? 0) / RAHN_RATIO;
}

// لیست آگهی‌های بخش انتخاب‌شده را می‌دهد؛ فیلتر منبع و زمین و محله و وضعیت هم روی آن اعمال می‌شود.
function visibleListings() {
  const sorted = newestFirst(state.allListings);
  let list;
  if (state.view === 'budget') {
    // سرچ بودجه از سرور آمده؛ همان را نشان می‌دهیم، فقط فیلتر منبع رویش می‌خورد.
    list = state.budgetResults ? [...state.budgetResults] : [];
  } else if (state.view === 'new') {
    list = sorted.filter((listing) => state.unreadTokens.has(listing.token));
    // فیلتر بودجه‌ی آگهی‌های جدید؛ اگر تیک «همه‌ی بودجه‌ها» برداشته شده باشد و بودجه داده شده باشد،
    // فقط آگهی‌های تازه‌ای می‌آیند که معادل رهن کامل آن‌ها زیر سقف باشد؛ با همان نسبت ۳٪.
    if (!state.newBudgetAll) {
      const target = Number(document.getElementById('new-budget-target').value);
      const max = Number(document.getElementById('new-budget-max').value);
      if (Number.isFinite(target) && target > 0 && Number.isFinite(max) && max > 0 && max >= target) {
        list = list.filter((listing) => {
          const equivalent = equivalentOf(listing);
          return equivalent !== null && equivalent > 0 && equivalent <= max;
        });
        // نزدیک‌ترین به هدف اول.
        list.sort((a, b) => Math.abs(equivalentOf(a) - target) - Math.abs(equivalentOf(b) - target));
      }
    }
  } else if (state.view === 'match') {
    list = state.matchResults ? [...state.matchResults] : [];
  } else if (state.view === 'clients') {
    list = state.clientMatches ? [...state.clientMatches] : [];
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
  if (state.district) {
    list = list.filter((listing) => listing.district === state.district);
  }
  if (state.source !== 'all') {
    list = list.filter((listing) => listing.source === state.source);
  }
  if (state.statusFilter) {
    list = list.filter((listing) => listing.status === state.statusFilter);
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

// عکس‌های یک آگهی؛ اگر گالری بیش از یک عکس داشته باشد، همه اینجاست،
// وگرنه همان عکس تکی. اگر هیچ عکسی نباشد، لیست خالی است.
function photosOf(listing) {
  if (listing.imageUrls && listing.imageUrls.length > 0) {
    return listing.imageUrls;
  }
  if (listing.imageUrl) {
    return [listing.imageUrl];
  }
  return [];
}

// عکس کارت؛ اگر بیش از یک عکس باشد، گالری با دکمه‌های قبلی و بعدی و نقطه‌هاست.
// کلیک روی خود عکس (نه دکمه‌ها) آگهی اصلی را باز می‌کند؛ مثل قبل.
function photoHtml(listing) {
  const photos = photosOf(listing);
  if (photos.length === 0) {
    return '<div class="card-photo-placeholder">🏠</div>';
  }
  const index = state.galleryIndex[listing.token] ?? 0;
  const current = photos[Math.min(index, photos.length - 1)];
  const img = `<img class="card-photo" src="${escapeHtml(current)}" alt="عکس آگهی" loading="lazy" data-photo-link="${escapeHtml(listing.url)}" onerror="this.outerHTML='<div class=&quot;card-photo-placeholder&quot;>🏠</div>'">`;
  if (photos.length === 1) {
    return img;
  }
  const dots = photos
    .map((_, i) => `<span class="gallery-dot ${i === index ? 'active' : ''}" data-token="${escapeHtml(listing.token)}" data-index="${i}"></span>`)
    .join('');
  return `<div class="gallery">
    ${img}
    <button class="gallery-arrow prev" data-token="${escapeHtml(listing.token)}" data-dir="-1" aria-label="عکس قبلی">‹</button>
    <button class="gallery-arrow next" data-token="${escapeHtml(listing.token)}" data-dir="1" aria-label="عکس بعدی">›</button>
    <div class="gallery-dots">${dots}</div>
    <span class="gallery-count">${index + 1} از ${photos.length}</span>
  </div>`;
}

// یک کارت آگهی می‌سازد؛ عکس بالا، متن پایین.
// اگر «معادل رهن کامل» داده شود، روی کارت دو خط اضافه می‌شود:
// رهن و اجاره‌ی اصلی آگهی، و معادل رهن کامل آن — تا معلوم باشد چرا این آگهی پیدا شده است.
// زیر آگهی هم متراژ و متری و میانگین محله می‌آید تا ماهان یک نگاه مقایسه کند.
function cardHtml(listing, isNew, equivalentRahn) {
  const sourceName = listing.source === 'sheypoor' ? 'شیپور' : 'دیوار';
  const newBadge = isNew ? '<span class="badge new">🆕 جدید</span>' : '';
  const belowBadge = listing.belowAverage
    ? '<span class="badge below">📉 زیر قیمت</span>'
    : '';
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
  // متراژ و متری؛ اگر متراژ معلوم نباشد، متری هم نشان داده نمی‌شود.
  // میانگین محله کنار متری خود کارت می‌آید تا مقایسه یک نگاه باشد.
  const meterLine =
    listing.areaSqm && listing.perMeter
      ? `<p class="card-meter">متراژ: ${formatNumber(listing.areaSqm)} متر • متری ${formatNumber(Math.round(listing.perMeter))} تومان${listing.districtAveragePerMeter ? ` • میانگین ${escapeHtml(listing.district)}: ${formatNumber(Math.round(listing.districtAveragePerMeter))} تومان` : ''}</p>`
      : '';
  // وضعیت و یادداشت ماهان روی این آگهی؛ با تازه‌سازی پاک نمی‌شود.
  const statusOptions = `<option value="">وضعیت…</option>` +
    Object.entries(STATUS_LABELS)
      .map(([value, label]) => `<option value="${value}" ${listing.status === value ? 'selected' : ''}>${label}</option>`)
      .join('');
  const statusLine = `
    <div class="card-status" data-token="${escapeHtml(listing.token)}">
      <select class="status-select" aria-label="وضعیت آگهی">${statusOptions}</select>
      <input class="note-input" type="text" placeholder="یادداشت…" value="${escapeHtml(listing.note ?? '')}" aria-label="یادداشت">
      <button class="btn small status-save">ثبت</button>
      ${listing.status ? `<span class="badge status-badge">${STATUS_LABELS[listing.status]}</span>` : ''}
    </div>`;
  return `
    <article class="card">
      ${photoHtml(listing)}
      <div class="card-body">
        <h3>${escapeHtml(listing.title)}</h3>
        <p class="card-price">${escapeHtml(listing.priceText)}</p>
        ${equivalentLine}
        ${meterLine}
        <p class="card-meta">${escapeHtml(listing.district)} • ${escapeHtml(listing.categoryLabel)}</p>
        ${featuresLine}
        <div class="badges">
          <span class="badge source">${sourceName}</span>
          ${newBadge}
          ${belowBadge}
        </div>
        ${statusLine}
        <a class="card-link" href="${escapeHtml(listing.url)}" target="_blank" rel="noopener">دیدن آگهی ←</a>
      </div>
    </article>`;
}

// صفحه را می‌کشد: عنوان بخش، کارت‌های صفحه‌ی فعلی و دکمه‌های صفحه‌بندی.
function render() {
  const isDistricts = state.view === 'districts';
  document.getElementById('list').style.display = isDistricts ? 'none' : '';
  document.getElementById('pager').style.display = isDistricts ? 'none' : '';
  document.getElementById('empty').hidden = isDistricts;
  if (isDistricts) {
    document.getElementById('view-title').textContent = VIEW_TITLES[state.view];
    document.getElementById('count').textContent = `${state.districts.length} محله`;
    renderDistricts();
    return;
  }
  const list = visibleListings();
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (state.page > totalPages) {
    state.page = totalPages;
  }
  const start = (state.page - 1) * PAGE_SIZE;
  const pageList = list.slice(start, start + PAGE_SIZE);

  let title = VIEW_TITLES[state.view];
  if (state.view === 'clients' && state.clientName) {
    title = `آگهی‌های مناسب ${state.clientName}`;
  }
  document.getElementById('view-title').textContent = title;
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

// اگر آگهی تازه‌ای به درد مشتری‌ای خورد، چت وضعیت همان‌جا اعلام می‌کند.
function announceClientMatches(matches) {
  if (!matches || matches.length === 0) {
    return;
  }
  const byClient = {};
  for (const match of matches) {
    if (!byClient[match.clientName]) {
      byClient[match.clientName] = [];
    }
    byClient[match.clientName].push(match.title);
  }
  for (const [name, titles] of Object.entries(byClient)) {
    const shown = titles.slice(0, 3).map((title) => `«${title}»`).join('، ');
    const more = titles.length > 3 ? ` و ${titles.length - 3} آگهی دیگر` : '';
    addChatMessage(`این آگهی به درد مشتری ${name} می‌خوره: ${shown}${more}`);
  }
}

// لیست آگهی‌ها، اعلان‌ها، وضعیت زمان‌بندی، مشتری‌ها و محله‌ها را از برنامه می‌گیرد و صفحه را تازه می‌کند.
async function load() {
  try {
    const [listingsResponse, notificationsResponse, statusResponse, clientsResponse, districtsResponse] = await Promise.all([
      fetch('/listings'),
      fetch('/notifications'),
      fetch('/scheduler/status'),
      fetch('/clients'),
      fetch('/settings/districts'),
    ]);
    if (
      listingsResponse.status === 401 ||
      notificationsResponse.status === 401 ||
      clientsResponse.status === 401 ||
      districtsResponse.status === 401
    ) {
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
    if (clientsResponse.ok) {
      state.clients = await clientsResponse.json();
    }
    if (districtsResponse.ok) {
      const data = await districtsResponse.json();
      state.districts = data.districts ?? [];
    }
    renderDistrictChips();
    renderClientDistrictOptions();
    renderClients();
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
    announceClientMatches(result.clientMatches);
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

// «مشتری‌یاب»؛ جمله‌ی فارسی را به برنامه می‌دهد و آگهی‌های مناسبش را می‌آورد.
// اگر جمله چیزی نداشت که فهمیده شود، همان را می‌گوید و یک مثال می‌دهد.
async function searchMatch() {
  const text = document.getElementById('match-text').value.trim();
  const status = document.getElementById('match-status');
  const summary = document.getElementById('match-summary');
  if (!text) {
    status.textContent = 'اول جمله‌ی مشتری را بنویس.';
    return;
  }
  status.textContent = 'در حال جست‌وجو…';
  summary.hidden = true;
  try {
    const response = await fetch('/listings/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      status.textContent = 'جست‌وجو نشد؛ دوباره امتحان کن.';
      return;
    }
    const result = await response.json();
    state.page = 1;
    if (!result.understood) {
      state.matchResults = [];
      status.textContent =
        'از این جمله چیزی نفهمیدم. مثلاً بنویس: «من مشتری دارم، اجاره می‌خواد، پارکینگ می‌خواد، پولش نهایت ۵۰۰ ودیعه با اجاره ۷۰ میلیون».';
      render();
      return;
    }
    state.matchResults = result.results ?? [];
    summary.textContent = `فهمیدم: ${result.summary}`;
    summary.hidden = false;
    status.textContent =
      state.matchResults.length === 0
        ? 'آگهی‌ای با این خواسته پیدا نشد.'
        : `${state.matchResults.length} آگهی مناسب پیدا شد؛ نزدیک‌ترین به خواسته‌ی مشتری اول است.`;
    render();
  } catch (error) {
    status.textContent = 'جست‌وجو نشد؛ دوباره امتحان کن.';
  }
}

// فهرست مشتری‌های دفترچه را می‌کشد؛ هر مشتری یک دکمه‌ی «آگهی‌هایش» و یک دکمه‌ی حذف دارد.
function renderClients() {
  const box = document.getElementById('clients-list');
  if (state.clients.length === 0) {
    box.innerHTML = '<p class="hint">هنوز مشتری‌ای ثبت نشده است.</p>';
    return;
  }
  box.innerHTML = state.clients
    .map((client) => {
      const kindLabel = client.kind === 'buy' ? 'خرید' : 'اجاره';
      const budgetLine =
        client.kind === 'buy'
          ? client.maxDeposit
            ? `سقف قیمت: ${formatToman(client.maxDeposit)}`
            : 'سقف قیمت: ندارد'
          : [
              client.maxDeposit ? `ودیعه تا ${formatToman(client.maxDeposit)}` : '',
              client.maxRent ? `اجاره تا ${formatToman(client.maxRent)}` : '',
            ]
              .filter(Boolean)
              .join(' • ') || 'سقف بودجه: ندارد';
      const wants = [
        client.wantsParking ? 'پارکینگ' : '',
        client.wantsStorage ? 'انباری' : '',
        client.wantsElevator ? 'آسانسور' : '',
      ]
        .filter(Boolean)
        .join('، ');
      return `<div class="client-row" data-id="${client.id}">
        <div>
          <strong>${escapeHtml(client.name)}</strong> — ${kindLabel}${client.district ? ` • ${escapeHtml(client.district)}` : ''}
          <br><span class="hint">${budgetLine}${wants ? ` • می‌خواهد: ${wants}` : ''}${client.note ? ` • ${escapeHtml(client.note)}` : ''}</span>
        </div>
        <div class="client-actions">
          <button class="btn small gold client-matches">آگهی‌هایش</button>
          <button class="btn small ghost client-delete">حذف</button>
        </div>
      </div>`;
    })
    .join('');
}

// محله‌های فرم مشتری را از محله‌های پیکربندی‌شده پر می‌کند.
function renderClientDistrictOptions() {
  const select = document.getElementById('client-district');
  select.innerHTML =
    '<option value="">هر محله‌ای</option>' +
    state.districts.map((d) => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join('');
}

// دکمه‌های محله در نوار فیلتر؛ از همان محله‌های پیکربندی‌شده ساخته می‌شوند.
function renderDistrictChips() {
  const box = document.getElementById('district-chips');
  const all = `<button class="filter-btn chip ${state.district === '' ? 'active' : ''}" data-district="">همه‌ی محله‌ها</button>`;
  box.innerHTML =
    all +
    state.districts
      .map(
        (d) =>
          `<button class="filter-btn chip ${state.district === d.name ? 'active' : ''}" data-district="${escapeHtml(d.name)}">${escapeHtml(d.name)}</button>`,
      )
      .join('');
}

// فهرست محله‌های بخش «محله‌ها»؛ هر محله یک دکمه‌ی حذف دارد.
function renderDistricts() {
  const box = document.getElementById('districts-list');
  if (state.districts.length === 0) {
    box.innerHTML = '<p class="hint">محله‌ای ثبت نشده است.</p>';
    return;
  }
  box.innerHTML = state.districts
    .map(
      (d) => `<div class="client-row">
        <div><strong>${escapeHtml(d.name)}</strong>${d.id ? ` — شناسه‌ی ${d.id}` : ' — بدون شناسه؛ در تازه‌سازی جست‌وجو نمی‌شود'}</div>
        <div class="client-actions">
          <button class="btn small ghost district-delete" data-id="${d.id ?? ''}" data-name="${escapeHtml(d.name)}">حذف</button>
        </div>
      </div>`,
    )
    .join('');
}

// افزودن مشتری تازه از فرم دفترچه.
async function addClient() {
  const status = document.getElementById('client-status');
  const name = document.getElementById('client-name').value.trim();
  if (!name) {
    status.textContent = 'اسم مشتری لازم است.';
    return;
  }
  const body = {
    name,
    kind: document.getElementById('client-kind').value,
    maxDeposit: Number(document.getElementById('client-max-deposit').value) || null,
    maxRent: Number(document.getElementById('client-max-rent').value) || null,
    district: document.getElementById('client-district').value || null,
    wantsParking: document.getElementById('client-parking').checked,
    wantsStorage: document.getElementById('client-storage').checked,
    wantsElevator: document.getElementById('client-elevator').checked,
    note: document.getElementById('client-note').value.trim() || null,
  };
  status.textContent = 'در حال اضافه کردن…';
  try {
    const response = await fetch('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      status.textContent = 'مشتری اضافه نشد؛ عددها را چک کن.';
      return;
    }
    document.getElementById('client-name').value = '';
    document.getElementById('client-max-deposit').value = '';
    document.getElementById('client-max-rent').value = '';
    document.getElementById('client-note').value = '';
    document.getElementById('client-parking').checked = false;
    document.getElementById('client-storage').checked = false;
    document.getElementById('client-elevator').checked = false;
    status.textContent = 'مشتری اضافه شد.';
    await load();
  } catch (error) {
    status.textContent = 'مشتری اضافه نشد؛ دوباره امتحان کن.';
  }
}

// آگهی‌های مناسب یک مشتری؛ با همان منطق مشتری‌یاب، ولی با خواسته‌های ذخیره‌شده‌ی او.
async function showClientMatches(id, name) {
  state.clientName = name;
  state.page = 1;
  try {
    const response = await fetch(`/clients/${id}/matches`);
    if (!response.ok) {
      return;
    }
    const result = await response.json();
    state.clientMatches = result.results ?? [];
    render();
  } catch (error) {
    // اگر نشد، لیست همان‌طور می‌ماند.
  }
}

// افزودن محله‌ی تازه؛ اسم لازم است، شناسه اختیاری است.
async function addDistrict() {
  const status = document.getElementById('district-status');
  const name = document.getElementById('district-name').value.trim();
  const idRaw = document.getElementById('district-id').value;
  if (!name) {
    status.textContent = 'اسم محله لازم است.';
    return;
  }
  status.textContent = 'در حال اضافه کردن…';
  try {
    const response = await fetch('/settings/districts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id: idRaw ? Number(idRaw) : undefined }),
    });
    const result = await response.json();
    if (!response.ok) {
      status.textContent = result.message ?? 'محله اضافه نشد.';
      return;
    }
    document.getElementById('district-name').value = '';
    document.getElementById('district-id').value = '';
    status.textContent = result.resolvedId
      ? `محله‌ی ${name} اضافه شد؛ از تازه‌سازی بعدی جست‌وجو می‌شود.`
      : `محله‌ی ${name} ذخیره شد ولی شناسه ندارد؛ تا شناسه‌اش را ندادی، در تازه‌سازی جست‌وجو نمی‌شود.`;
    await load();
  } catch (error) {
    status.textContent = 'محله اضافه نشد؛ دوباره امتحان کن.';
  }
}

// ثبت وضعیت و یادداشت روی یک آگهی؛ با تازه‌سازی پاک نمی‌شود.
async function saveListingStatus(token, box) {
  const select = box.querySelector('.status-select');
  const noteInput = box.querySelector('.note-input');
  const statusValue = select.value || null;
  const noteValue = noteInput.value.trim() || null;
  try {
    const response = await fetch(`/listings/${encodeURIComponent(token)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusValue, note: noteValue }),
    });
    if (!response.ok) {
      return;
    }
    const saved = await response.json();
    const listing = state.allListings.find((item) => item.token === token);
    if (listing) {
      listing.status = saved.status;
      listing.note = saved.note;
    }
    render();
  } catch (error) {
    // اگر نشد، کارت همان‌طور می‌ماند.
  }
}

// بخش را عوض می‌کند؛ صفحه از اول می‌شود و فرم هر بخش فقط در بخش خودش دیده می‌شود.
function setView(view) {
  state.view = view;
  state.page = 1;
  state.landOnly = false;
  document.getElementById('land-chip').classList.remove('active');
  document.querySelectorAll('.side-btn').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  document.getElementById('budget-form').hidden = view !== 'budget';
  document.getElementById('match-form').hidden = view !== 'match';
  document.getElementById('clients-section').hidden = view !== 'clients';
  document.getElementById('districts-section').hidden = view !== 'districts';
  document.getElementById('new-actions').hidden = view !== 'new';
  document.getElementById('quick-filters').style.display =
    view === 'budget' || view === 'districts' ? 'none' : '';
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

// دکمه‌های محله؛ از محله‌های پیکربندی‌شده ساخته می‌شوند.
document.getElementById('district-chips').addEventListener('click', (event) => {
  const button = event.target.closest('.filter-btn');
  if (!button) {
    return;
  }
  state.district = button.dataset.district ?? '';
  state.page = 1;
  renderDistrictChips();
  render();
});

// فیلتر وضعیت؛ فقط آگهی‌هایی با همان وضعیت نشان داده می‌شوند.
document.getElementById('status-filter').addEventListener('change', (event) => {
  state.statusFilter = event.target.value;
  state.page = 1;
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

// کلیک روی کارت‌ها؛ گالری، وضعیت و یادداشت.
// کلیک روی خود عکس آگهی اصلی را باز می‌کند؛ کلیک روی دکمه‌های گالری عکس را عوض می‌کند.
document.getElementById('list').addEventListener('click', (event) => {
  const arrow = event.target.closest('.gallery-arrow');
  if (arrow) {
    event.stopPropagation();
    const token = arrow.dataset.token;
    const listing = state.allListings.find((item) => item.token === token);
    if (!listing) {
      return;
    }
    const photos = photosOf(listing);
    const current = state.galleryIndex[token] ?? 0;
    const next = (current + Number(arrow.dataset.dir) + photos.length) % photos.length;
    state.galleryIndex[token] = next;
    render();
    return;
  }
  const dot = event.target.closest('.gallery-dot');
  if (dot) {
    event.stopPropagation();
    state.galleryIndex[dot.dataset.token] = Number(dot.dataset.index);
    render();
    return;
  }
  const photo = event.target.closest('[data-photo-link]');
  if (photo) {
    window.open(photo.dataset.photoLink, '_blank', 'noopener');
    return;
  }
  const saveButton = event.target.closest('.status-save');
  if (saveButton) {
    const box = saveButton.closest('.card-status');
    if (box) {
      saveListingStatus(box.dataset.token, box);
    }
  }
});

// دکمه‌های دفترچه‌ی مشتری‌ها؛ «آگهی‌هایش» و حذف.
document.getElementById('clients-list').addEventListener('click', async (event) => {
  const row = event.target.closest('.client-row');
  if (!row) {
    return;
  }
  const id = Number(row.dataset.id);
  if (event.target.closest('.client-matches')) {
    const name = row.querySelector('strong')?.textContent ?? '';
    await showClientMatches(id, name);
    return;
  }
  if (event.target.closest('.client-delete')) {
    await fetch(`/clients/${id}`, { method: 'DELETE' });
    await load();
  }
});

// دکمه‌ی حذف محله؛ با شناسه‌ی عددی دیوار حذف می‌شود.
document.getElementById('districts-list').addEventListener('click', async (event) => {
  const button = event.target.closest('.district-delete');
  if (!button) {
    return;
  }
  const id = button.dataset.id;
  if (!id) {
    return;
  }
  await fetch(`/settings/districts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await load();
});

// تیک «همه‌ی بودجه‌ها» در بخش آگهی‌های جدید؛ برداشتنش فیلتر بودجه را روشن می‌کند.
document.getElementById('new-budget-all').addEventListener('change', (event) => {
  state.newBudgetAll = event.target.checked;
  state.page = 1;
  render();
});
document.getElementById('new-budget-target').addEventListener('input', () => {
  if (state.view === 'new') {
    state.page = 1;
    render();
  }
});
document.getElementById('new-budget-max').addEventListener('input', () => {
  if (state.view === 'new') {
    state.page = 1;
    render();
  }
});

document.getElementById('refresh').addEventListener('click', refresh);
document.getElementById('read-all').addEventListener('click', readAll);
document.getElementById('budget-search').addEventListener('click', searchBudget);
document.getElementById('match-search').addEventListener('click', searchMatch);
document.getElementById('client-add').addEventListener('click', addClient);
document.getElementById('district-add').addEventListener('click', addDistrict);

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

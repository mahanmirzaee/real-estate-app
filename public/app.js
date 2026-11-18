// مغز صفحه‌ی «موتور جست‌وجوگر ماهان»؛ با جاوااسکریپت ساده، بدون هیچ کتابخانه‌ای.
// کارش: آگهی‌ها را از برنامه می‌گیرد، کارت می‌سازد و هر ۶۰ ثانیه تازه می‌کند.

// فیلترهای صفحه؛ همه‌ی فیلترها در همین یک شیء جمع‌اند تا اضافه کردن فیلتر تازه راحت باشد.
// فعلاً فقط منبع (همه، دیوار، شیپور) فعال است؛
// در قدم بعد «محله» (district) و «رهن/خرید» (kind) هم همین‌جا اضافه می‌شوند —
// داده‌شان از قبل آماده است: برنامه `?district=` را می‌فهمد و پنج دسته‌ی خرید/رهن را هم دارد.
const filters = {
  source: 'all', // 'all' یعنی همه، 'divar' یعنی فقط دیوار، 'sheypoor' یعنی فقط شیپور.
  district: null, // بعداً: محله‌ی انتخاب‌شده؛ مثلاً 'مهران'. خالی یعنی همه‌ی محله‌ها.
  kind: null, // بعداً: 'rent' یعنی فقط رهن/اجاره، 'sell' یعنی فقط خرید/فروش. خالی یعنی هر دو.
};

// همه‌ی فیلترها را با هم روی لیست اعمال می‌کند؛
// هر فیلتر تازه‌ای که اضافه شود، فقط یک شرط دیگر همین‌جا می‌آید.
function applyFilters(listings) {
  return listings.filter((listing) => {
    if (filters.source !== 'all' && listing.source !== filters.source) {
      return false;
    }
    // قدم بعد، همین‌جا:
    // if (filters.district && !listing.district.includes(filters.district)) return false;
    // if (filters.kind === 'rent' && !listing.category.endsWith('-rent')) return false;
    // if (filters.kind === 'sell' && !listing.category.endsWith('-sell') && listing.category !== 'plot-old') return false;
    return true;
  });
}

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

// یک کارت آگهی می‌سازد؛ عکس کنار کارت است و اگر عکس نبود، قاب طلایی با خانه می‌گذاریم.
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
  return `
    <article class="card">
      ${photo}
      <div class="card-body">
        <h3>${escapeHtml(listing.title)}</h3>
        <p class="card-price">${escapeHtml(listing.priceText)}</p>
        ${equivalentLine}
        <p class="card-meta">${escapeHtml(listing.district)} • ${escapeHtml(listing.categoryLabel)}</p>
        <div class="badges">
          <span class="badge source">${sourceName}</span>
          ${newBadge}
        </div>
        <a class="card-link" href="${escapeHtml(listing.url)}" target="_blank" rel="noopener">دیدن آگهی ←</a>
      </div>
    </article>`;
}

// آگهی‌ها را تازه‌ترین اول مرتب می‌کند؛ چون `fetchedAt` تاریخ گرفتن آگهی است.
function newestFirst(listings) {
  return [...listings].sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));
}

// هر دو بخش صفحه را می‌کشد: «آگهی‌های جدید» بالا و «همه‌ی آگهی‌ها» پایین.
function render() {
  const sorted = newestFirst(allListings);

  // بخش آگهی‌های جدید؛ همان‌هایی که هنوز خوانده نشده‌اند.
  const unread = sorted.filter((listing) => unreadTokens.has(listing.token));
  document.getElementById('new-list').innerHTML = unread
    .map((listing) => cardHtml(listing, true))
    .join('');
  document.getElementById('new-empty').style.display = unread.length === 0 ? 'block' : 'none';

  // بخش همه‌ی آگهی‌ها؛ همه‌ی فیلترها با هم اعمال می‌شوند.
  const shown = applyFilters(sorted);
  document.getElementById('list').innerHTML = shown
    .map((listing) => cardHtml(listing, unreadTokens.has(listing.token)))
    .join('');
  document.getElementById('count').textContent =
    shown.length === 0 ? 'آگهی‌ای نیست.' : `${shown.length} آگهی`;
}

// لیست آگهی‌ها و اعلان‌ها را از برنامه می‌گیرد و صفحه را تازه می‌کند.
async function load() {
  try {
    const [listingsResponse, notificationsResponse] = await Promise.all([
      fetch('/listings'),
      fetch('/notifications'),
    ]);
    allListings = await listingsResponse.json();
    const notifications = await notificationsResponse.json();
    unreadTokens = new Set(notifications.map((item) => item.token));
    render();
  } catch (error) {
    document.getElementById('status').textContent = 'گرفتن آگهی‌ها نشد؛ صفحه را تازه کن.';
  }
}

// دکمه‌ی تازه‌سازی؛ یک دور تازه از دیوار و شیپور می‌گیرد (حدود یک دقیقه طول می‌کشد).
async function refresh() {
  const button = document.getElementById('refresh');
  const status = document.getElementById('status');
  button.disabled = true;
  status.textContent = 'در حال تازه‌سازی…';
  try {
    const response = await fetch('/listings/refresh', { method: 'POST' });
    const result = await response.json();
    status.textContent = `تازه‌سازی تمام شد: ${result.fetched} آگهی گرفته شد، ${result.added} تازه اضافه شد، در کل ${result.total} آگهی هست.`;
    await load();
  } catch (error) {
    status.textContent = 'تازه‌سازی نشد؛ دوباره امتحان کن.';
  }
  button.disabled = false;
}

// دکمه‌ی «خوانده شد»؛ همه‌ی اعلان‌ها را خوانده‌شده می‌کند و بخش تازه‌ها خالی می‌شود.
async function readAll() {
  await fetch('/notifications/read-all', { method: 'POST' });
  await load();
}

// جست‌وجو بر اساس بودجه؛ دو عدد را از ورودی‌ها می‌خواند و آگهی‌هایی را می‌آورد
// که معادل رهن کامل آن‌ها زیر سقف باشد؛ نزدیک‌ترین به هدف اول است.
async function searchBudget() {
  const target = Number(document.getElementById('budget-target').value);
  const max = Number(document.getElementById('budget-max').value);
  const status = document.getElementById('budget-status');
  const list = document.getElementById('budget-list');
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
    const results = await response.json();
    status.textContent =
      results.length === 0
        ? 'آگهی‌ای با این بودجه پیدا نشد.'
        : `${results.length} آگهی با معادل رهن کامل زیر ${formatToman(max)} پیدا شد؛ نزدیک‌ترین به ${formatToman(target)} اول است.`;
    list.innerHTML = results
      .map((listing) => cardHtml(listing, unreadTokens.has(listing.token), listing.equivalentRahn))
      .join('');
  } catch (error) {
    status.textContent = 'جست‌وجو نشد؛ دوباره امتحان کن.';
  }
}

// دکمه‌های فیلتر؛ دکمه‌ی انتخاب‌شده طلایی می‌شود.
document.getElementById('filters').addEventListener('click', (event) => {
  const button = event.target.closest('.filter-btn');
  if (!button) {
    return;
  }
  filters.source = button.dataset.source;
  document.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  render();
});

document.getElementById('refresh').addEventListener('click', refresh);
document.getElementById('read-all').addEventListener('click', readAll);
document.getElementById('budget-search').addEventListener('click', searchBudget);

// اول صفحه را پر می‌کنیم و بعد هر ۶۰ ثانیه خودبه‌خود تازه می‌شود؛
// آگهی تازه که بیاید، خودش بالای لیست می‌آید.
load();
setInterval(load, 60000);

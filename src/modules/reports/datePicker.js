const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const weekDaysBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

function toISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function toDDMMYYYY(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * container এর ভেতরে একটা "dd/mm/yyyy" বাটন + ক্যালেন্ডার পপআপ বসায়।
 * initialISO: 'YYYY-MM-DD', onChange(iso) কল হয় তারিখ বাছাই করলে।
 * রিটার্ন করে { getValue, setValue } — বাইরে থেকে মান পড়া/বদলানোর জন্য।
 */
export function mountDatePicker(container, initialISO, onChange) {
  let [year, month, day] = initialISO.split('-').map(Number);
  month -= 1; // 0-indexed
  let viewYear = year;
  let viewMonth = month;

  container.innerHTML = `
    <div class="date-picker-wrapper">
      <button type="button" class="date-picker-btn"><span class="dp-label"></span></button>
      <div class="date-picker-popup hidden"></div>
    </div>
  `;

  const btn = container.querySelector('.date-picker-btn');
  const labelEl = container.querySelector('.dp-label');
  const popup = container.querySelector('.date-picker-popup');

  function updateLabel() {
    labelEl.textContent = toDDMMYYYY(toISO(year, month, day));
  }

  function renderCalendar() {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    let cells = '';
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells += `<span class="dp-day dp-empty"></span>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = d === day && viewMonth === month && viewYear === year;
      cells += `<span class="dp-day ${isSelected ? 'dp-selected' : ''}" data-day="${d}">${d}</span>`;
    }

    popup.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-dir="-1">◀</button>
        <span>${monthNamesBn[viewMonth]} ${viewYear}</span>
        <button type="button" class="dp-nav" data-dir="1">▶</button>
      </div>
      <div class="dp-weekdays">
        ${weekDaysBn.map((w) => `<span>${w}</span>`).join('')}
      </div>
      <div class="dp-days">${cells}</div>
    `;

    popup.querySelectorAll('.dp-nav').forEach((navBtn) => {
      navBtn.addEventListener('click', () => {
        viewMonth += Number(navBtn.dataset.dir);
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear -= 1;
        } else if (viewMonth > 11) {
          viewMonth = 0;
          viewYear += 1;
        }
        renderCalendar();
      });
    });

    popup.querySelectorAll('.dp-day[data-day]').forEach((dayEl) => {
      dayEl.addEventListener('click', () => {
        day = Number(dayEl.dataset.day);
        month = viewMonth;
        year = viewYear;
        updateLabel();
        popup.classList.add('hidden');
        onChange(toISO(year, month, day));
      });
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    viewYear = year;
    viewMonth = month;
    renderCalendar();
    popup.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) popup.classList.add('hidden');
  });

  updateLabel();

  return {
    getValue: () => toISO(year, month, day),
    setValue: (iso) => {
      let [y, m, d] = iso.split('-').map(Number);
      year = y;
      month = m - 1;
      day = d;
      updateLabel();
    },
  };
}

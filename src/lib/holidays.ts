export interface CalendarEvent {
  date: string; // YYYY-MM-DD or MM-DD for recurring
  title: string;
  category: 'holiday' | 'festival' | 'celebration' | 'observance';
  icon: string;
  isNationalHoliday?: boolean;
  description?: string;
}

export const REAL_CALENDAR_EVENTS: CalendarEvent[] = [
  // --- JANUARY ---
  { date: '01-01', title: "New Year's Day", category: 'holiday', icon: '🎆', isNationalHoliday: true, description: 'Global celebration of the first day of the year.' },
  { date: '01-14', title: 'Makar Sankranti', category: 'festival', icon: '🌾', isNationalHoliday: true, description: 'Harvest festival dedicated to the Sun God.' },
  { date: '01-15', title: 'Pongal', category: 'festival', icon: '🍲', isNationalHoliday: false, description: 'Tamil harvest festival celebration.' },
  { date: '01-26', title: 'Republic Day', category: 'holiday', icon: '🇮🇳', isNationalHoliday: true, description: 'Honors the date on which the Constitution of India came into effect.' },

  // --- FEBRUARY ---
  { date: '02-04', title: 'World Cancer Day', category: 'observance', icon: '🎗️', isNationalHoliday: false, description: 'Global awareness day led by UICC.' },
  { date: '02-14', title: "Valentine's Day", category: 'celebration', icon: '💖', isNationalHoliday: false, description: 'Celebration of love and affection.' },
  { date: '02-28', title: 'National Science Day', category: 'observance', icon: '🔬', isNationalHoliday: false, description: 'Marks discovery of Raman Effect by C. V. Raman.' },

  // --- MARCH ---
  { date: '03-08', title: "International Women's Day", category: 'celebration', icon: '👩‍💼', isNationalHoliday: false, description: 'Global day celebrating women’s achievements.' },
  { date: '03-15', title: 'World Consumer Rights Day', category: 'observance', icon: '🛡️', isNationalHoliday: false, description: 'Promotes consumer rights and needs.' },
  { date: '03-21', title: 'International Day of Forests', category: 'observance', icon: '🌳', isNationalHoliday: false, description: 'Awareness of the importance of all types of forests.' },
  { date: '03-22', title: 'World Water Day', category: 'observance', icon: '💧', isNationalHoliday: false, description: 'Focuses on the importance of freshwater.' },

  // --- APRIL ---
  { date: '04-01', title: "April Fools' Day", category: 'celebration', icon: '🃏', isNationalHoliday: false, description: 'Annual custom of practical jokes.' },
  { date: '04-07', title: 'World Health Day', category: 'observance', icon: '🩺', isNationalHoliday: false, description: 'Global health awareness day under WHO.' },
  { date: '04-14', title: 'Ambedkar Jayanti / Tamil New Year', category: 'festival', icon: '📜', isNationalHoliday: true, description: 'Birthday of Dr. B. R. Ambedkar & Tamil New Year (Puthandu).' },
  { date: '04-22', title: 'Earth Day', category: 'observance', icon: '🌍', isNationalHoliday: false, description: 'Annual event to demonstrate support for environmental protection.' },

  // --- MAY ---
  { date: '05-01', title: "International Workers' Day", category: 'holiday', icon: '🛠️', isNationalHoliday: true, description: 'Labor Day / May Day honoring workers worldwide.' },
  { date: '05-08', title: 'World Red Cross Day', category: 'observance', icon: '🔴', isNationalHoliday: false, description: 'Commemorating the birth anniversary of Henry Dunant.' },
  { date: '05-31', title: 'World No-Tobacco Day', category: 'observance', icon: '🚭', isNationalHoliday: false, description: 'WHO initiative against tobacco use.' },

  // --- JUNE ---
  { date: '06-05', title: 'World Environment Day', category: 'observance', icon: '🌿', isNationalHoliday: false, description: 'UN ecosystem conservation awareness day.' },
  { date: '06-08', title: 'World Oceans Day', category: 'observance', icon: '🌊', isNationalHoliday: false, description: 'Celebrating ocean conservation and marine life.' },
  { date: '06-21', title: 'International Yoga Day', category: 'celebration', icon: '🧘', isNationalHoliday: false, description: 'Global day for wellness & yoga practice.' },

  // --- JULY ---
  { date: '07-01', title: "National Doctors' Day", category: 'celebration', icon: '🩺', isNationalHoliday: false, description: 'Honors the contributions of physicians.' },
  { date: '07-11', title: 'World Population Day', category: 'observance', icon: '👥', isNationalHoliday: false, description: 'Focuses attention on population issues.' },
  { date: '07-26', title: 'Kargil Vijay Diwas', category: 'observance', icon: '🎖️', isNationalHoliday: false, description: 'Honors Indian Armed Forces heroes.' },

  // --- AUGUST ---
  { date: '08-15', title: 'Independence Day', category: 'holiday', icon: '🇮🇳', isNationalHoliday: true, description: 'Commemorates India’s independence in 1947.' },
  { date: '08-19', title: 'World Photography Day', category: 'celebration', icon: '📸', isNationalHoliday: false, description: 'Celebrates the art and science of photography.' },
  { date: '08-29', title: 'National Sports Day', category: 'celebration', icon: '🏒', isNationalHoliday: false, description: 'Birth anniversary of hockey legend Major Dhyan Chand.' },

  // --- SEPTEMBER ---
  { date: '09-05', title: "Teachers' Day", category: 'celebration', icon: '📚', isNationalHoliday: false, description: 'Honors teachers & Dr. Sarvepalli Radhakrishnan.' },
  { date: '09-08', title: 'International Literacy Day', category: 'observance', icon: '📖', isNationalHoliday: false, description: 'UNESCO literacy awareness day.' },
  { date: '09-15', title: "Engineers' Day", category: 'celebration', icon: '🏗️', isNationalHoliday: false, description: 'Tribute to Sir M. Visvesvaraya.' },
  { date: '09-27', title: 'World Tourism Day', category: 'observance', icon: '✈️', isNationalHoliday: false, description: 'Fosters global tourism awareness.' },

  // --- OCTOBER ---
  { date: '10-02', title: 'Gandhi Jayanti', category: 'holiday', icon: '🕊️', isNationalHoliday: true, description: 'Birthday of Mahatma Gandhi & International Day of Non-Violence.' },
  { date: '10-08', title: 'Indian Air Force Day', category: 'observance', icon: '✈️', isNationalHoliday: false, description: 'Celebrating official establishment of IAF.' },
  { date: '10-16', title: 'World Food Day', category: 'observance', icon: '🍞', isNationalHoliday: false, description: 'Global food security awareness.' },
  { date: '10-31', title: 'Halloween', category: 'celebration', icon: '🎃', isNationalHoliday: false, description: 'Annual holiday filled with costumes and festivities.' },

  // --- NOVEMBER ---
  { date: '11-01', title: 'Karnataka Rajyotsava / Haryana Day', category: 'holiday', icon: '🚩', isNationalHoliday: false, description: 'State formation day celebration.' },
  { date: '11-14', title: "Children's Day", category: 'celebration', icon: '🧒', isNationalHoliday: false, description: 'Birthday of Pandit Jawaharlal Nehru.' },
  { date: '11-19', title: "International Men's Day", category: 'celebration', icon: '👨', isNationalHoliday: false, description: 'Focuses on men’s health and well-being.' },
  { date: '11-26', title: 'Constitution Day', category: 'observance', icon: '📜', isNationalHoliday: false, description: 'Adoption of Constitution of India.' },

  // --- DECEMBER ---
  { date: '12-01', title: 'World AIDS Day', category: 'observance', icon: '🎗️', isNationalHoliday: false, description: 'Global health awareness day.' },
  { date: '12-04', title: 'Indian Navy Day', category: 'observance', icon: '⚓', isNationalHoliday: false, description: 'Commemorating Operation Trident achievements.' },
  { date: '12-10', title: 'Human Rights Day', category: 'observance', icon: '⚖️', isNationalHoliday: false, description: 'Honors the Universal Declaration of Human Rights.' },
  { date: '12-25', title: 'Christmas Day', category: 'holiday', icon: '🎄', isNationalHoliday: true, description: 'Celebration of the birth of Jesus Christ.' },
  { date: '12-31', title: "New Year's Eve", category: 'celebration', icon: '🥂', isNationalHoliday: false, description: 'Eve of New Year celebrations.' },

  // --- MOVEABLE & YEAR-SPECIFIC FESTIVALS ---
  // 2026 Festivals
  { date: '2026-03-04', title: 'Holi (Festival of Colors)', category: 'festival', icon: '🎨', isNationalHoliday: true, description: 'Festival of colors and spring celebration.' },
  { date: '2026-03-20', title: 'Eid al-Fitr', category: 'festival', icon: '🌙', isNationalHoliday: true, description: 'Islamic festival marking the end of Ramadan.' },
  { date: '2026-04-03', title: 'Good Friday', category: 'holiday', icon: '✝️', isNationalHoliday: true, description: 'Christian holiday commemorating the crucifixion.' },
  { date: '2026-04-05', title: 'Easter Sunday', category: 'festival', icon: '🥚', isNationalHoliday: false, description: 'Celebration of the Resurrection.' },
  { date: '2026-05-27', title: 'Eid al-Adha (Bakrid)', category: 'festival', icon: '🌙', isNationalHoliday: true, description: 'Feast of Sacrifice in Islam.' },
  { date: '2026-06-26', title: 'Ashura (10th Muharram)', category: 'festival', icon: '🕌', isNationalHoliday: true, description: 'Day of remembrance in Islam.' },
  { date: '2026-08-26', title: "Prophet's Birthday (Mawlid)", category: 'festival', icon: '👳', isNationalHoliday: true, description: 'Birth anniversary of Prophet Muhammad.' },
  { date: '2026-08-28', title: 'Onam', category: 'festival', icon: '🌾', isNationalHoliday: false, description: 'Major harvest festival of Kerala.' },
  { date: '2026-09-04', title: 'Janmashtami', category: 'festival', icon: '🪷', isNationalHoliday: true, description: 'Birth anniversary of Lord Krishna.' },
  { date: '2026-09-14', title: 'Ganesh Chaturthi', category: 'festival', icon: '🐘', isNationalHoliday: true, description: 'Festival celebrating Lord Ganesha.' },
  { date: '2026-10-20', title: 'Dussehra / Vijayadashami', category: 'festival', icon: '🏹', isNationalHoliday: true, description: 'Victory of good over evil.' },
  { date: '2026-11-08', title: 'Diwali (Festival of Lights)', category: 'festival', icon: '🪔', isNationalHoliday: true, description: 'Deepavali festival of lights and joy.' },
  { date: '2026-11-24', title: 'Guru Nanak Jayanti', category: 'festival', icon: '👳', isNationalHoliday: true, description: 'Birth anniversary of Guru Nanak Dev Ji.' },

  // 2025 Fallbacks
  { date: '2025-03-14', title: 'Holi', category: 'festival', icon: '🎨', isNationalHoliday: true, description: 'Festival of colors.' },
  { date: '2025-03-31', title: 'Eid al-Fitr', category: 'festival', icon: '🌙', isNationalHoliday: true, description: 'Ramadan Eid.' },
  { date: '2025-06-07', title: 'Eid al-Adha', category: 'festival', icon: '🌙', isNationalHoliday: true, description: 'Bakrid festival.' },
  { date: '2025-10-02', title: 'Dussehra', category: 'festival', icon: '🏹', isNationalHoliday: true, description: 'Vijayadashami festival.' },
  { date: '2025-10-20', title: 'Diwali', category: 'festival', icon: '🪔', isNationalHoliday: true, description: 'Deepavali festival.' },
];

/**
 * Returns all real calendar events for a given date formatted as YYYY-MM-DD.
 */
export function getEventsForDate(dateStr: string): CalendarEvent[] {
  const [yyyy, mm, dd] = dateStr.split('-');
  const mmdd = `${mm}-${dd}`;

  return REAL_CALENDAR_EVENTS.filter((e) => e.date === dateStr || e.date === mmdd);
}

/**
 * Returns all real calendar events for a given month formatted as YYYY-MM.
 */
export function getEventsForMonth(monthStr: string): { dateStr: string; event: CalendarEvent }[] {
  const [yyyy, mm] = monthStr.split('-');
  const results: { dateStr: string; event: CalendarEvent }[] = [];

  // Match YYYY-MM-DD and MM-DD events
  REAL_CALENDAR_EVENTS.forEach((e) => {
    if (e.date.startsWith(`${monthStr}-`)) {
      results.push({ dateStr: e.date, event: e });
    } else if (e.date.startsWith(`${mm}-`)) {
      const fullDate = `${monthStr}-${e.date.split('-')[1]}`;
      // Avoid duplicate if explicit YYYY-MM-DD exists
      if (!results.some((r) => r.dateStr === fullDate && r.event.title === e.title)) {
        results.push({ dateStr: fullDate, event: e });
      }
    }
  });

  return results.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

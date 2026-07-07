const SHORT = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

export function shortDays(days) {
  return days.map((d) => SHORT[d] ?? d).join(' / ');
}

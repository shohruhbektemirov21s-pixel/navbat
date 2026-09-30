import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportDataParams {
  business: {
    name: string;
    phone?: string;
    address?: string;
    subscription_plan_code?: string;
  };
  stats?: {
    today_bookings?: number;
    confirmed_count?: number;
    completed_count?: number;
    cancelled_count?: number;
    total_revenue_uzs?: number;
    total_customers?: number;
  };
  bookings: Array<{
    id?: string;
    booking_number?: string;
    customer_name?: string;
    customer_phone?: string;
    service_name?: string;
    staff_name?: string;
    booking_date?: string;
    start_time?: string;
    end_time?: string;
    price_uzs?: number;
    status?: string;
    created_at?: string;
  }>;
  filterPeriod?: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\u0400-\u04FF-]/g, '_').toLowerCase();
}

function formatStatusUz(status?: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Tasdiqlangan';
    case 'COMPLETED':
      return 'Yakunlangan';
    case 'CANCELLED':
      return 'Bekor qilingan';
    case 'NO_SHOW':
      return 'Kelmadi';
    case 'PENDING':
    default:
      return 'Kutilmoqda';
  }
}

// -------------------------------------------------------------
// 1. EXPORT APPOINTMENTS TO CSV
// -------------------------------------------------------------
export function exportAppointmentsToCSV(
  bookings: ExportDataParams['bookings'],
  businessName: string,
  filterPeriod: string = 'Barcha davr'
) {
  const headers = [
    'Bron Raqami',
    'Mijoz Ismi',
    'Telefon Raqami',
    'Xizmat',
    'Mutaxassis',
    'Sana',
    'Boshlanish Vaqti',
    'Tugash Vaqti',
    'Narxi (so‘m)',
    'Holati',
    'Yaratilgan Vaqt'
  ];

  const escapeCSV = (str: string | number | undefined | null) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = bookings.map((b) => [
    escapeCSV(b.booking_number || '—'),
    escapeCSV(b.customer_name || 'Mijoz'),
    escapeCSV(b.customer_phone || '—'),
    escapeCSV(b.service_name || 'Standart xizmat'),
    escapeCSV(b.staff_name || 'Bosh mutaxassis'),
    escapeCSV(b.booking_date || '—'),
    escapeCSV(b.start_time || '—'),
    escapeCSV(b.end_time || '—'),
    escapeCSV(b.price_uzs ? b.price_uzs.toLocaleString('uz-UZ') : '0'),
    escapeCSV(formatStatusUz(b.status)),
    escapeCSV(b.created_at ? b.created_at.slice(0, 16) : '—')
  ]);

  const csvContent =
    '\uFEFF' + // UTF-8 BOM for perfect Excel support
    [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `navbatbor_bronlar_${sanitizeFilename(businessName)}_${dateStr}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// 2. EXPORT PERFORMANCE & STATISTICS TO CSV
// -------------------------------------------------------------
export function exportPerformanceToCSV(
  stats: ExportDataParams['stats'],
  bookings: ExportDataParams['bookings'],
  businessName: string,
  filterPeriod: string = 'Barcha davr'
) {
  const totalRevenue = stats?.total_revenue_uzs || bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + (b.price_uzs || 0), 0);
  const completedCount = stats?.completed_count || bookings.filter(b => b.status === 'COMPLETED').length;
  const confirmedCount = stats?.confirmed_count || bookings.filter(b => b.status === 'CONFIRMED').length;
  const cancelledCount = stats?.cancelled_count || bookings.filter(b => b.status === 'CANCELLED').length;
  const totalBookings = bookings.length;
  const averageCheck = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

  const escapeCSV = (str: string | number | undefined | null) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = [
    ['Hisobot Turi', 'NavbatBor Biznes Samaradorlik va Statistika Hisoboti'],
    ['Muassasa Nomi', businessName],
    ['Hisobot Davri', filterPeriod],
    ['Chop etilgan Sana', new Date().toLocaleString('uz-UZ')],
    ['', ''],
    ['ASOSIY KO‘RSATKICHLAR (KPI)', 'QIYMAT'],
    ['Bugungi Bronlar', stats?.today_bookings || 0],
    ['Jami Bronlar Soni', totalBookings],
    ['Muvaffaqiyatli Yakunlangan Bronlar', completedCount],
    ['Kutilayotgan / Tasdiqlangan Bronlar', confirmedCount],
    ['Bekor Qilingan Bronlar', cancelledCount],
    ['Jami Tushum (so‘m)', totalRevenue.toLocaleString('uz-UZ')],
    ['O‘rtacha Xarid / Chek (so‘m)', averageCheck.toLocaleString('uz-UZ')],
    ['Muvaffaqiyat Foizi', totalBookings > 0 ? `${Math.round((completedCount / totalBookings) * 100)}%` : '0%']
  ];

  // Service breakdown
  const serviceStats: Record<string, { count: number; revenue: number }> = {};
  bookings.forEach((b) => {
    const sName = b.service_name || 'Boshqa';
    if (!serviceStats[sName]) serviceStats[sName] = { count: 0, revenue: 0 };
    serviceStats[sName].count += 1;
    if (b.status === 'COMPLETED') {
      serviceStats[sName].revenue += b.price_uzs || 0;
    }
  });

  rows.push(['', '']);
  rows.push(['XIZMATLAR BO‘YICHA TAQSIMOT', 'BRONLAR SONI', 'TUSHUM (so‘m)']);
  Object.entries(serviceStats).forEach(([sName, data]) => {
    rows.push([sName, String(data.count), data.revenue.toLocaleString('uz-UZ')]);
  });

  const csvContent =
    '\uFEFF' +
    rows.map((r) => r.map((val) => escapeCSV(val)).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `navbatbor_statistika_${sanitizeFilename(businessName)}_${dateStr}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// 3. EXPORT COMPLETE PDF REPORT (APPOINTMENTS & PERFORMANCE)
// -------------------------------------------------------------
export function exportToPDF(params: ExportDataParams) {
  const { business, stats, bookings, filterPeriod = 'Barcha davr' } = params;

  const totalRevenue =
    stats?.total_revenue_uzs ||
    bookings
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + (b.price_uzs || 0), 0);
  const completedCount =
    stats?.completed_count ||
    bookings.filter((b) => b.status === 'COMPLETED').length;
  const confirmedCount =
    stats?.confirmed_count ||
    bookings.filter((b) => b.status === 'CONFIRMED').length;
  const cancelledCount =
    stats?.cancelled_count ||
    bookings.filter((b) => b.status === 'CANCELLED').length;
  const totalBookings = bookings.length;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // --- BRAND HEADER ---
  // Blue banner header
  doc.setFillColor(30, 58, 138); // Deep Indigo/Navy #1E3A8A
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('NAVBATBOR', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Raqamli Bron & Navbat Boshqaruv Tizimi', 14, 19);

  // Business info right-aligned in header
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(business.name, pageWidth - 14, 12, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const contactText = [business.phone, business.address].filter(Boolean).join(' | ');
  doc.text(contactText || 'Rasmiy Hisobot', pageWidth - 14, 18, { align: 'right' });

  // --- DOCUMENT TITLE & SUBTITLE ---
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('BRONLAR VA SAMARADORLIK STATISTIKASI', 14, 38);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Slate-500
  const dateGenerated = new Date().toLocaleString('uz-UZ');
  doc.text(`Davr: ${filterPeriod} | Yaratildi: ${dateGenerated}`, 14, 44);

  // --- KPI STAT METRIC BOXES ---
  const boxWidth = (pageWidth - 28 - 9) / 4;
  const boxHeight = 18;
  const startY = 48;

  const kpis = [
    { title: 'JAMI BRONLAR', value: String(totalBookings), color: [241, 245, 249], text: [15, 23, 42] },
    { title: 'YAKUNLANGAN', value: String(completedCount), color: [236, 253, 245], text: [4, 120, 87] },
    { title: 'KUTILMOQDA', value: String(confirmedCount), color: [239, 246, 255], text: [29, 78, 216] },
    { title: 'JAMI TUSHUM', value: `${totalRevenue.toLocaleString('uz-UZ')} UZS`, color: [238, 242, 255], text: [67, 56, 202] }
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (boxWidth + 3);
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.roundedRect(x, startY, boxWidth, boxHeight, 2, 2, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + 3, startY + 5.5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
    doc.text(kpi.value, x + 3, startY + 13.5);
  });

  // --- APPOINTMENTS TABLE ---
  const tableData = bookings.map((b, i) => [
    i + 1,
    b.booking_number || '—',
    b.customer_name || 'Mijoz',
    b.customer_phone || '—',
    b.service_name || 'Standart',
    b.staff_name || 'Mutaxassis',
    `${b.booking_date || ''} ${b.start_time || ''}`.trim(),
    b.price_uzs ? `${b.price_uzs.toLocaleString('uz-UZ')} so‘m` : '0',
    formatStatusUz(b.status)
  ]);

  autoTable(doc, {
    startY: 72,
    head: [[
      '#',
      'Bron №',
      'Mijoz',
      'Telefon',
      'Xizmat',
      'Xodim',
      'Vaqt',
      'Narx',
      'Holat'
    ]],
    body: tableData.length > 0 ? tableData : [['—', '—', 'Hozircha bronlar mavjud emas', '—', '—', '—', '—', '—', '—']],
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 24 },
      4: { cellWidth: 28 },
      5: { cellWidth: 22 },
      6: { cellWidth: 24 },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 19, halign: 'center', fontStyle: 'bold' }
    },
    didDrawPage: (data) => {
      // Footer with page numbering & security note
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);

      doc.text(
        `NavbatBor Platformasi orqali generatsiya qilindi • www.navbatbor.uz`,
        14,
        doc.internal.pageSize.getHeight() - 8
      );

      doc.text(
        `Sahifa ${currentPage} / ${pageCount}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    }
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`navbatbor_hisobot_${sanitizeFilename(business.name)}_${dateStr}.pdf`);
}

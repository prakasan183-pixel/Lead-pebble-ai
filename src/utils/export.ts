import type { Lead } from './leadScoring.ts';

export function exportLeadsToCsv(leads: Lead[], filename = 'leadpulse_leads.csv') {
  if (!leads.length) return;

  const headers = [
    'Company Name',
    'Category',
    'Sub-Category',
    'Phone Number',
    'Email',
    'Address',
    'City',
    'State',
    'Website Status',
    'Website URL',
    'Verification Notes',
    'Google Maps URL',
    'Rating',
    'Review Count',
    'Lead Score',
    'Opportunity Tier',
    'CRM Status',
    'Estimated Revenue',
    'Notes',
    'Created Date',
  ];

  const escapeCsv = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = leads.map((l) => [
    escapeCsv(l.companyName),
    escapeCsv(l.category),
    escapeCsv(l.subCategory),
    escapeCsv(l.phoneNumber),
    escapeCsv(l.email),
    escapeCsv(l.fullAddress),
    escapeCsv(l.city),
    escapeCsv(l.state),
    escapeCsv(l.websiteStatus),
    escapeCsv(l.websiteUrl),
    escapeCsv(l.verificationDetails?.notes),
    escapeCsv(l.googleMapsUrl),
    l.rating ?? '',
    l.reviewCount ?? '',
    l.leadScore ?? '',
    escapeCsv(l.opportunityTier),
    escapeCsv(l.crmStatus),
    escapeCsv(l.estimatedRevenueTier),
    escapeCsv((l.notes || []).join(' | ')),
    escapeCsv(l.createdAt),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import * as XLSX from 'xlsx';
import { BankStatementData, ParsedTransaction } from './pdfParser';

export interface ExportOptions {
  includeCategories: boolean;
  includeBalance: boolean;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  currency: string;
  groupByMonth: boolean;
  includeSummary: boolean;
}

export function exportToExcel(data: BankStatementData, options: ExportOptions): void {
  const workbook = XLSX.utils.book_new();
  
  // Create transactions sheet
  const transactionsSheet = createTransactionsSheet(data.transactions, options);
  XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions');
  
  // Create summary sheet if requested
  if (options.includeSummary) {
    const summarySheet = createSummarySheet(data, options);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }
  
  // Create monthly breakdown if requested
  if (options.groupByMonth) {
    const monthlySheet = createMonthlySheet(data.transactions, options);
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Breakdown');
  }
  
  // Generate filename
  const filename = `bank_statement_${data.bankName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Save file
  XLSX.writeFile(workbook, filename);
}

function createTransactionsSheet(transactions: ParsedTransaction[], options: ExportOptions): XLSX.WorkSheet {
  const headers = ['Date', 'Description', 'Amount', 'Type'];
  
  if (options.includeBalance) {
    headers.push('Balance');
  }
  
  if (options.includeCategories) {
    headers.push('Category');
  }
  
  const data = [headers];
  
  transactions.forEach(transaction => {
    const row: any[] = [
      formatDate(transaction.date, options.dateFormat),
      transaction.description,
      formatCurrency(transaction.amount, options.currency),
      transaction.type === 'credit' ? 'Credit' : 'Debit'
    ];
    
    if (options.includeBalance && transaction.balance !== undefined) {
      row.push(formatCurrency(transaction.balance, options.currency));
    } else if (options.includeBalance) {
      row.push('');
    }
    
    if (options.includeCategories) {
      row.push(transaction.category || 'Uncategorized');
    }
    
    data.push(row);
  });
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 40 }, // Description
    { wch: 15 }, // Amount
    { wch: 10 }, // Type
  ];
  
  if (options.includeBalance) {
    colWidths.push({ wch: 15 }); // Balance
  }
  
  if (options.includeCategories) {
    colWidths.push({ wch: 20 }); // Category
  }
  
  worksheet['!cols'] = colWidths;
  
  // Style header row
  const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    
    worksheet[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'E3F2FD' } },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
    };
  }
  
  return worksheet;
}

function createSummarySheet(data: BankStatementData, options: ExportOptions): XLSX.WorkSheet {
  const totalCredits = data.transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalDebits = data.transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const categoryTotals = data.transactions.reduce((acc, transaction) => {
    const category = transaction.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { credits: 0, debits: 0, count: 0 };
    }
    
    if (transaction.type === 'credit') {
      acc[category].credits += transaction.amount;
    } else {
      acc[category].debits += transaction.amount;
    }
    acc[category].count++;
    
    return acc;
  }, {} as Record<string, { credits: number; debits: number; count: number }>);
  
  const summaryData = [
    ['Bank Statement Summary'],
    [''],
    ['Bank Name', data.bankName],
    ['Account Number', data.accountNumber],
    ['Statement Period', data.statementPeriod],
    [''],
    ['Transaction Summary'],
    ['Total Transactions', data.transactions.length],
    ['Total Credits', formatCurrency(totalCredits, options.currency)],
    ['Total Debits', formatCurrency(totalDebits, options.currency)],
    ['Net Amount', formatCurrency(totalCredits - totalDebits, options.currency)],
    [''],
    ['Category Breakdown'],
    ['Category', 'Credits', 'Debits', 'Net', 'Count']
  ];
  
  Object.entries(categoryTotals).forEach(([category, totals]) => {
    summaryData.push([
      category,
      formatCurrency(totals.credits, options.currency),
      formatCurrency(totals.debits, options.currency),
      formatCurrency(totals.credits - totals.debits, options.currency),
      totals.count.toString()
    ]);
  });
  
  const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 10 }
  ];
  
  return worksheet;
}

function createMonthlySheet(transactions: ParsedTransaction[], options: ExportOptions): XLSX.WorkSheet {
  const monthlyData = transactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = { credits: 0, debits: 0, count: 0, transactions: [] };
    }
    
    if (transaction.type === 'credit') {
      acc[monthKey].credits += transaction.amount;
    } else {
      acc[monthKey].debits += transaction.amount;
    }
    acc[monthKey].count++;
    acc[monthKey].transactions.push(transaction);
    
    return acc;
  }, {} as Record<string, { credits: number; debits: number; count: number; transactions: ParsedTransaction[] }>);
  
  const data = [
    ['Monthly Breakdown'],
    [''],
    ['Month', 'Credits', 'Debits', 'Net', 'Transaction Count']
  ];
  
  Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([month, totals]) => {
      const monthName = new Date(month + '-01').toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      data.push([
        monthName,
        formatCurrency(totals.credits, options.currency),
        formatCurrency(totals.debits, options.currency),
        formatCurrency(totals.credits - totals.debits, options.currency),
        totals.count.toString()
      ]);
    });
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 }
  ];
  
  return worksheet;
}

function formatDate(dateStr: string, format: ExportOptions['dateFormat']): string {
  const date = new Date(dateStr);
  
  switch (format) {
    case 'MM/DD/YYYY':
      return date.toLocaleDateString('en-US');
    case 'DD/MM/YYYY':
      return date.toLocaleDateString('en-GB');
    case 'YYYY-MM-DD':
      return date.toISOString().split('T')[0];
    default:
      return date.toLocaleDateString();
  }
}

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$',
    AUD: 'A$',
    JPY: '¥'
  };
  
  const symbol = symbols[currency] || '$';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
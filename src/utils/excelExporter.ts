import * as XLSX from "xlsx";
import { BankStatementData, ParsedTransaction } from "./pdfParser";
import { ai } from "./geminiModel";

export interface ExportOptions {
  includeCategories: boolean;
  includeBalance: boolean;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  currency: string;
  groupByMonth: boolean;
  includeSummary: boolean;
  useAICategorization?: boolean;
}

// SDK-powered helper function
async function callAI(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: prompt,
    });
    const content = response.text;

    if (!content) {
      throw new Error("No response from AI API");
    }
    return content;
  } catch (error: any) {
    console.error(` API error :`, error.message);
    throw error;
  }
}

// NEW: This single function replaces both categorizeTransactionAI and refineCategoryName.
async function categorizeAndRefineTransactionAI(
  description: string
): Promise<{ category: string; confidence: number }> {
  const prompt = `
    Given the following transaction description, provide a single, concise, and user-friendly category name and a confidence score.
    Examples of good categories: 'Groceries', 'Utilities', 'Salary', 'Travel', 'Rent', 'Shopping'.
    Examples of bad categories: 'DEBIT CARD PURCHASE 123', 'Transfer'.
    
    Return a single JSON object with the keys 'category' and 'confidence' (a number between 0 and 1).
    
    Transaction Description: "${description}"
    
    Only respond with the JSON object.
  `;
  const response = await callAI(prompt);
  return JSON.parse(response);
}

// NOTE: The retrainCategoryFromFeedback function remains as it is for a separate purpose (user feedback).
async function retrainCategoryFromFeedback(
  description: string,
  correctCategory: string
): Promise<string[]> {
  const prompt = `The user corrected the category of "${description}" to "${correctCategory}". Suggest new keywords or features to improve future classification. Return as an array of strings.`;
  const response = await callAI(prompt);
  return JSON.parse(response);
}

export async function exportToExcel(
  data: BankStatementData,
  options: ExportOptions
): Promise<void> {
  const workbook = XLSX.utils.book_new();

  let transactions = data.transactions;
  if (options.useAICategorization) {
    // UPDATED: Now calling the single, new function for categorization and refinement.
    transactions = await Promise.all(
      data.transactions.map(async (t) => {
        try {
          const { category, confidence } =
            await categorizeAndRefineTransactionAI(t.description);
          return { ...t, category, confidence };
        } catch (error) {
          console.warn(
            `AI categorization failed for "${t.description}", using original`,
            error
          );
          return t;
        }
      })
    );
  }

  const transactionsSheet = createTransactionsSheet(transactions, options);
  XLSX.utils.book_append_sheet(workbook, transactionsSheet, "Transactions");

  if (options.includeSummary) {
    const summarySheet = await createSummarySheet(
      { ...data, transactions },
      options
    );
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  }

  if (options.groupByMonth) {
    const monthlySheet = createMonthlySheet(transactions, options);
    XLSX.utils.book_append_sheet(workbook, monthlySheet, "Monthly Breakdown");
  }

  const filename = `bank_statement_${data.bankName.replace(/\s+/g, "_")}_${
    new Date().toISOString().split("T")[0]
  }.xlsx`;
  XLSX.writeFile(workbook, filename);
}

function createTransactionsSheet(
  transactions: ParsedTransaction[],
  options: ExportOptions
): XLSX.WorkSheet {
  const headers = ["Date", "Description", "Amount", "Type"];

  // The 'balance' and 'confidence' fields were removed from ParsedTransaction
  // in the previous update. The following code needs to be adjusted.
  // We'll add 'balance' back to the headers only if the option is enabled,
  // and 'confidence' only if AICategorization is enabled.

  if (options.includeBalance) {
    headers.push("Balance");
  }

  if (options.includeCategories) {
    headers.push("Category");
    if (options.useAICategorization) {
      headers.push("Confidence");
    }
  }

  const data = [headers];

  transactions.forEach((transaction: any) => {
    // Cast to 'any' to access 'balance' and 'confidence' which are no longer in ParsedTransaction interface. This is a temporary fix. A better solution would be to update the interface in pdfParser.ts.
    const row: any[] = [
      formatDate(transaction.date, options.dateFormat),
      transaction.description,
      formatCurrency(transaction.amount, transaction.currency), // Use transaction.currency
      transaction.type === "credit" ? "Credit" : "Debit",
    ];

    if (options.includeBalance && transaction.balance !== undefined) {
      row.push(formatCurrency(transaction.balance, transaction.currency));
    } else if (options.includeBalance) {
      row.push("");
    }

    if (options.includeCategories) {
      row.push(transaction.category || "Uncategorized");
      if (options.useAICategorization && transaction.confidence !== undefined) {
        row.push(transaction.confidence.toFixed(2));
      }
    }

    data.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  const colWidths = [
    { wch: 12 }, // Date
    { wch: 40 }, // Description
    { wch: 15 }, // Amount
    { wch: 10 }, // Type
  ];

  if (options.includeBalance) {
    colWidths.push({ wch: 15 });
  }

  if (options.includeCategories) {
    colWidths.push({ wch: 20 });
    if (options.useAICategorization) {
      colWidths.push({ wch: 10 });
    }
  }

  worksheet["!cols"] = colWidths;

  const headerRange = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;

    worksheet[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "E3F2FD" } },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }

  return worksheet;
}

async function createSummarySheet(
  data: BankStatementData,
  options: ExportOptions
): Promise<XLSX.WorkSheet> {
  const totalCredits = data.transactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebits = data.transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);

  const categoryTotals = data.transactions.reduce((acc, transaction: any) => {
    // Cast to 'any' for confidence
    const category = transaction.category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = { credits: 0, debits: 0, count: 0, confidenceSum: 0 };
    }

    if (transaction.type === "credit") {
      acc[category].credits += transaction.amount;
    } else {
      acc[category].debits += transaction.amount;
    }
    acc[category].count++;
    if (options.useAICategorization && transaction.confidence !== undefined) {
      acc[category].confidenceSum += transaction.confidence;
    }

    return acc;
  }, {} as Record<string, { credits: number; debits: number; count: number; confidenceSum: number }>);

  const summaryData = [
    ["Bank Statement Summary"],
    [""],
    ["Bank Name", data.bankName],
    ["Account Number", data.accountNumber],
    ["Statement Period", data.statementPeriod],
    [""],
    ["Transaction Summary"],
    ["Total Transactions", data.transactions.length],
    ["Total Credits", formatCurrency(totalCredits, options.currency)],
    ["Total Debits", formatCurrency(totalDebits, options.currency)],
    [
      "Net Amount",
      formatCurrency(totalCredits - totalDebits, options.currency),
    ],
    [""],
    ["Category Breakdown"],
    [
      "Category",
      "Credits",
      "Debits",
      "Net",
      "Count",
      ...(options.useAICategorization ? ["Avg Confidence"] : []),
    ],
  ];

  Object.entries(categoryTotals).forEach(([category, totals]) => {
    const row = [
      category,
      formatCurrency(totals.credits, options.currency),
      formatCurrency(totals.debits, options.currency),
      formatCurrency(totals.credits - totals.debits, options.currency),
      totals.count.toString(),
    ];
    if (options.useAICategorization) {
      row.push((totals.confidenceSum / totals.count).toFixed(2));
    }
    summaryData.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(summaryData);

  const colWidths = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 10 },
  ];
  if (options.useAICategorization) {
    colWidths.push({ wch: 15 });
  }

  worksheet["!cols"] = colWidths;

  return worksheet;
}

function createMonthlySheet(
  transactions: ParsedTransaction[],
  options: ExportOptions
): XLSX.WorkSheet {
  const monthlyData = transactions.reduce((acc, transaction: any) => {
    // Cast to 'any' for confidence
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!acc[monthKey]) {
      acc[monthKey] = {
        credits: 0,
        debits: 0,
        count: 0,
        confidenceSum: 0,
        transactions: [],
      };
    }

    if (transaction.type === "credit") {
      acc[monthKey].credits += transaction.amount;
    } else {
      acc[monthKey].debits += transaction.amount;
    }
    acc[monthKey].count++;
    if (options.useAICategorization && transaction.confidence !== undefined) {
      acc[monthKey].confidenceSum += transaction.confidence;
    }
    acc[monthKey].transactions.push(transaction);

    return acc;
  }, {} as Record<string, { credits: number; debits: number; count: number; confidenceSum: number; transactions: ParsedTransaction[] }>);

  const data = [
    ["Monthly Breakdown"],
    [""],
    [
      "Month",
      "Credits",
      "Debits",
      "Net",
      "Transaction Count",
      ...(options.useAICategorization ? ["Avg Confidence"] : []),
    ],
  ];

  Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([month, totals]) => {
      const monthName = new Date(month + "-01").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });

      const row = [
        monthName,
        formatCurrency(totals.credits, options.currency),
        formatCurrency(totals.debits, options.currency),
        formatCurrency(totals.credits - totals.debits, options.currency),
        totals.count.toString(),
      ];
      if (options.useAICategorization) {
        row.push((totals.confidenceSum / totals.count).toFixed(2));
      }
      data.push(row);
    });

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];
  if (options.useAICategorization) {
    worksheet["!cols"].push({ wch: 15 });
  }

  return worksheet;
}

function formatDate(
  dateStr: string,
  format: ExportOptions["dateFormat"]
): string {
  const date = new Date(dateStr);

  switch (format) {
    case "MM/DD/YYYY":
      return date.toLocaleDateString("en-US");
    case "DD/MM/YYYY":
      return date.toLocaleDateString("en-GB");
    case "YYYY-MM-DD":
      return date.toISOString().split("T")[0];
    default:
      return date.toLocaleDateString();
  }
}

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
  };

  const symbol = symbols[currency] || "$";
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function handleCategoryFeedback(
  description: string,
  correctCategory: string
): Promise<string[]> {
  try {
    return await retrainCategoryFromFeedback(description, correctCategory);
  } catch (error) {
    console.warn(`Failed to retrain category for "${description}"`, error);
    return [];
  }
}

import * as pdfjsLib from "pdfjs-dist";
import "/node_modules/pdfjs-dist/build/pdf.worker.mjs";

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  type: "debit" | "credit";
  category?: string;
}

export interface BankStatementData {
  bankName: string;
  accountNumber: string;
  statementPeriod: string;
  transactions: ParsedTransaction[];
  openingBalance?: number;
  closingBalance?: number;
}

// Bank patterns for different statement formats
const BANK_PATTERNS = {
  chase: {
    name: "Chase Bank",
    datePattern: /(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2})/g,
    amountPattern: /[\$]?[\-]?[\d,]+\.[\d]{2}/g,
    accountPattern: /Account\s+Number[:\s]+(\d+)/i,
    transactionPattern:
      /(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2})\s+(.+?)\s+([\-\$\d,\.]+)\s*([\$\d,\.]+)?/g,
  },
  bankOfAmerica: {
    name: "Bank of America",
    datePattern: /(\d{2}\/\d{2}\/\d{4})/g,
    amountPattern: /[\$]?[\-]?[\d,]+\.[\d]{2}/g,
    accountPattern: /Account\s+number[:\s]+(\d+)/i,
    transactionPattern:
      /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\-\$\d,\.]+)\s*([\$\d,\.]+)?/g,
  },
  wellsFargo: {
    name: "Wells Fargo",
    datePattern: /(\d{2}\/\d{2}\/\d{4})/g,
    amountPattern: /[\$]?[\-]?[\d,]+\.[\d]{2}/g,
    accountPattern: /Account\s+Number[:\s]+(\d+)/i,
    transactionPattern:
      /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\-\$\d,\.]+)\s*([\$\d,\.]+)?/g,
  },
  generic: {
    name: "Generic Bank",
    datePattern: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
    amountPattern: /[\$]?[\-]?[\d,]+\.[\d]{2}/g,
    accountPattern: /(?:Account|Acct)[\s#:]+(\d+)/i,
    transactionPattern:
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\-\$\d,\.]+)(?:\s+([\$\d,\.]+))?/g,
  },
};

export async function parsePDFStatement(
  file: File
): Promise<BankStatementData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Fix: properly type the textContent items
      const pageText = textContent.items
        .map((item: any) => {
          // Some items might not have str property
          return item.str || "";
        })
        .join(" ");
      fullText += pageText + "\n";
    }

    // Detect bank type
    const bankType = detectBankType(fullText);
    const pattern = BANK_PATTERNS[bankType];

    // Extract account information
    const accountMatch = fullText.match(pattern.accountPattern);
    const accountNumber = accountMatch ? accountMatch[1] : "Unknown";

    // Extract statement period
    const statementPeriod = extractStatementPeriod(fullText);

    // Parse transactions
    const transactions = parseTransactions(fullText, pattern);

    // Extract balances
    const { openingBalance, closingBalance } = extractBalances(fullText);

    return {
      bankName: pattern.name,
      accountNumber,
      statementPeriod,
      transactions,
      openingBalance,
      closingBalance,
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error(
      `Failed to parse PDF statement: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please ensure the file is a valid bank statement.`
    );
  }
}

function detectBankType(text: string): keyof typeof BANK_PATTERNS {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("chase") || lowerText.includes("jpmorgan")) {
    return "chase";
  } else if (
    lowerText.includes("bank of america") ||
    lowerText.includes("bofa")
  ) {
    return "bankOfAmerica";
  } else if (lowerText.includes("wells fargo")) {
    return "wellsFargo";
  }

  return "generic";
}

function extractStatementPeriod(text: string): string {
  // Look for common statement period patterns
  const periodPatterns = [
    /Statement\s+Period[:\s]+(.+?)(?:\n|$)/i,
    /Period[:\s]+(.+?)(?:\n|$)/i,
    /From\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})\s+through\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of periodPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] + (match[2] ? ` - ${match[2]}` : "");
    }
  }

  return "Unknown Period";
}

function parseTransactions(text: string, pattern: any): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const match = line.match(pattern.transactionPattern);
    if (match) {
      const [, date, description, amount, balance] = match;

      // Fix: Add null checks before calling replace
      if (!date || !description || !amount) {
        continue; // Skip this transaction if essential fields are missing
      }

      // Fix: better amount parsing to handle negative signs with null checks
      const cleanAmountStr = amount.replace(/[\$,]/g, "");
      const cleanAmount = parseFloat(cleanAmountStr);

      const cleanBalance = balance
        ? parseFloat(balance.replace(/[\$,]/g, ""))
        : undefined;

      if (!isNaN(cleanAmount)) {
        transactions.push({
          date: normalizeDate(date),
          description: description.trim(),
          amount: Math.abs(cleanAmount),
          balance: cleanBalance,
          type: cleanAmount < 0 ? "debit" : "credit",
          category: categorizeTransaction(description),
        });
      }
    }
  }

  // If no transactions found with regex, try alternative parsing
  if (transactions.length === 0) {
    return parseTransactionsAlternative(text);
  }

  return transactions.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function parseTransactionsAlternative(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for date patterns
    const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) {
      const date = dateMatch[1];

      // Look for amount in the same line or next few lines
      let description = "";
      let amount = 0;
      let balance: number | undefined;

      // Extract description and amount from current and next lines
      for (let j = 0; j < 3 && i + j < lines.length; j++) {
        const currentLine = lines[i + j];
        const amountMatch = currentLine.match(/([\-\$]?[\d,]+\.[\d]{2})/g);

        if (amountMatch && amountMatch.length > 0) {
          // First amount is usually the transaction amount
          const amountStr = amountMatch[0].replace(/[\$,]/g, "");
          amount = parseFloat(amountStr);

          // Second amount might be balance
          if (amountMatch.length > 1) {
            const balanceStr = amountMatch[1].replace(/[\$,]/g, "");
            balance = parseFloat(balanceStr);
          }

          // Extract description (text before the amount)
          description = currentLine
            .replace(/([\-\$]?[\d,]+\.[\d]{2})/g, "")
            .replace(dateMatch[0], "") // Remove the date
            .trim();
          break;
        } else {
          description += " " + currentLine.replace(dateMatch[0], "").trim();
        }
      }

      if (!isNaN(amount) && amount !== 0 && description.trim()) {
        transactions.push({
          date: normalizeDate(date),
          description: description.trim(),
          amount: Math.abs(amount),
          balance,
          type: amount < 0 ? "debit" : "credit",
          category: categorizeTransaction(description),
        });
      }
    }
  }

  return transactions.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

function normalizeDate(dateStr: string): string {
  try {
    // Convert various date formats to ISO format
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }

    // Try different parsing approaches
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      let month: number, day: number, year: number;

      // Handle 2-digit years
      let yearPart = parseInt(parts[2]);
      if (yearPart < 100) {
        yearPart += yearPart < 50 ? 2000 : 1900;
      }

      // Assume MM/DD/YYYY format (common in US bank statements)
      month = parseInt(parts[0]) - 1; // JavaScript months are 0-indexed
      day = parseInt(parts[1]);
      year = yearPart;

      const parsedDate = new Date(year, month, day);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split("T")[0];
      }
    }
  } catch (error) {
    console.warn(`Failed to normalize date: ${dateStr}`, error);
  }

  // Return original string if parsing fails
  return dateStr;
}

function categorizeTransaction(description: string): string {
  const desc = description.toLowerCase();

  if (
    desc.includes("deposit") ||
    desc.includes("salary") ||
    desc.includes("payroll") ||
    desc.includes("direct dep")
  ) {
    return "Income";
  } else if (
    desc.includes("grocery") ||
    desc.includes("food") ||
    desc.includes("restaurant") ||
    desc.includes("dining")
  ) {
    return "Food & Dining";
  } else if (
    desc.includes("gas") ||
    desc.includes("fuel") ||
    desc.includes("transport") ||
    desc.includes("uber") ||
    desc.includes("lyft")
  ) {
    return "Transportation";
  } else if (desc.includes("atm") || desc.includes("withdrawal")) {
    return "Cash & ATM";
  } else if (desc.includes("transfer")) {
    return "Transfers";
  } else if (desc.includes("fee") || desc.includes("charge")) {
    return "Fees & Charges";
  } else if (
    desc.includes("payment") ||
    desc.includes("bill") ||
    desc.includes("utility") ||
    desc.includes("electric") ||
    desc.includes("water") ||
    desc.includes("internet")
  ) {
    return "Bills & Utilities";
  } else if (
    desc.includes("shopping") ||
    desc.includes("store") ||
    desc.includes("amazon") ||
    desc.includes("walmart") ||
    desc.includes("target")
  ) {
    return "Shopping";
  } else if (
    desc.includes("medical") ||
    desc.includes("pharmacy") ||
    desc.includes("doctor") ||
    desc.includes("hospital")
  ) {
    return "Healthcare";
  }

  return "Other";
}

function extractBalances(text: string): {
  openingBalance?: number;
  closingBalance?: number;
} {
  const openingPatterns = [
    /Beginning\s+Balance[:\s]+([\$\d,\.]+)/i,
    /Opening\s+Balance[:\s]+([\$\d,\.]+)/i,
    /Previous\s+Balance[:\s]+([\$\d,\.]+)/i,
    /Starting\s+Balance[:\s]+([\$\d,\.]+)/i,
  ];

  const closingPatterns = [
    /Ending\s+Balance[:\s]+([\$\d,\.]+)/i,
    /Closing\s+Balance[:\s]+([\$\d,\.]+)/i,
    /Current\s+Balance[:\s]+([\$\d,\.]+)/i,
    /Final\s+Balance[:\s]+([\$\d,\.]+)/i,
  ];

  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  for (const pattern of openingPatterns) {
    const match = text.match(pattern);
    if (match) {
      const balance = parseFloat(match[1].replace(/[\$,]/g, ""));
      if (!isNaN(balance)) {
        openingBalance = balance;
        break;
      }
    }
  }

  for (const pattern of closingPatterns) {
    const match = text.match(pattern);
    if (match) {
      const balance = parseFloat(match[1].replace(/[\$,]/g, ""));
      if (!isNaN(balance)) {
        closingBalance = balance;
        break;
      }
    }
  }

  return { openingBalance, closingBalance };
}

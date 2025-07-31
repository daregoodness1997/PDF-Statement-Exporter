import * as pdfjsLib from "pdfjs-dist";
import "/node_modules/pdfjs-dist/build/pdf.worker.mjs";
import { ai } from "./geminiModel";

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  balance?: number;
  type: "debit" | "credit";
  category?: string;
  confidence?: number;
}

export interface BankStatementData {
  bankName: string;
  accountNumber: string;
  statementPeriod: string;
  transactions: ParsedTransaction[];
  openingBalance?: number;
  closingBalance?: number;
}

interface ColumnDefinition {
  name: string;
  dataType: "date" | "text" | "amount" | "balance";
  confidence: number;
}

//  SDK-powered helper function
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
    console.error(`nAI API error (model: ):`, error.message);
    throw error;
  }
}

// AI-powered bank name detection
async function detectBankNameAI(text: string): Promise<string> {
  const prompt = `Extract the bank name from the following PDF text:\n\n${text}\n\nOnly respond with the bank name.`;
  return callAI(prompt);
}

// AI-powered column structure inference
async function inferColumnsAI(headerLine: string): Promise<ColumnDefinition[]> {
  const prompt = `Given this table header from a bank statement: "${headerLine}", map each column to a standard data type (date, text, amount, balance). Respond as JSON with keys: name, dataType, confidence (0-1).`;
  const response = await callAI(prompt);
  return JSON.parse(response);
}

// AI-powered transaction categorization
async function categorizeTransactionAI(
  description: string
): Promise<{ category: string; confidence: number }> {
  const prompt = `Categorize this transaction description: "${description}". Return the category (like Food, Travel, Income) and confidence score between 0 and 1 as JSON.`;
  const response = await callAI(prompt);
  return JSON.parse(response);
}

// Fallback patterns
const BANK_PATTERNS = {
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
    let headerLine = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || "")
        .join(" ");
      fullText += pageText + "\n";

      if (i === 1) {
        const lines = pageText.split("\n");
        headerLine =
          lines.find((line) =>
            line.match(/date|description|amount|balance/i)
          ) || "";
      }
    }

    const bankName = await detectBankNameAI(fullText);
    const accountMatch = fullText.match(BANK_PATTERNS.generic.accountPattern);
    const accountNumber = accountMatch ? accountMatch[1] : "Unknown";
    const statementPeriod = extractStatementPeriod(fullText);

    let columns: ColumnDefinition[] = [];
    if (headerLine) {
      try {
        columns = await inferColumnsAI(headerLine);
      } catch (error) {
        console.warn("AI column inference failed, using fallback", error);
        columns = [
          { name: "Date", dataType: "date", confidence: 0.9 },
          { name: "Description", dataType: "text", confidence: 0.9 },
          { name: "Amount", dataType: "amount", confidence: 0.9 },
          { name: "Balance", dataType: "balance", confidence: 0.8 },
        ];
      }
    }

    const transactions = await parseTransactions(fullText, columns);
    const { openingBalance, closingBalance } = extractBalances(fullText);

    return {
      bankName,
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

// Rest of the functions (parseTransactions, parseTransactionsAlternative, normalizeDate, categorizeTransaction, extractStatementPeriod, extractBalances) remain unchanged from the previous version.

async function parseTransactions(
  text: string,
  columns: ColumnDefinition[]
): Promise<ParsedTransaction[]> {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n");
  const pattern = BANK_PATTERNS.generic;

  for (const line of lines) {
    const match = line.match(pattern.transactionPattern);
    if (match) {
      const [, date, description, amount, balance] = match;

      if (!date || !description || !amount) {
        continue;
      }

      const cleanAmountStr = amount.replace(/[\$,]/g, "");
      const cleanAmount = parseFloat(cleanAmountStr);
      const cleanBalance = balance
        ? parseFloat(balance.replace(/[\$,]/g, ""))
        : undefined;

      if (!isNaN(cleanAmount)) {
        let categoryInfo: { category: string; confidence: number } = {
          category: "Other",
          confidence: 0.5,
        };
        try {
          categoryInfo = await categorizeTransactionAI(description);
        } catch (error) {
          console.warn(
            `AI categorization failed for "${description}", using fallback`,
            error
          );
          categoryInfo.category = categorizeTransaction(description);
        }

        transactions.push({
          date: normalizeDate(date),
          description: description.trim(),
          amount: Math.abs(cleanAmount),
          balance: cleanBalance,
          type: cleanAmount < 0 ? "debit" : "credit",
          category: categoryInfo.category,
          confidence: categoryInfo.confidence,
        });
      }
    }
  }

  if (transactions.length === 0) {
    return parseTransactionsAlternative(text);
  }

  return transactions.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

async function parseTransactionsAlternative(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) {
      const date = dateMatch[1];
      let description = "";
      let amount = 0;
      let balance: number | undefined;

      for (let j = 0; j < 3 && i + j < lines.length; j++) {
        const currentLine = lines[i + j];
        const amountMatch = currentLine.match(/([\-\$]?[\d,]+\.[\d]{2})/g);

        if (amountMatch && amountMatch.length > 0) {
          const amountStr = amountMatch[0].replace(/[\$,]/g, "");
          amount = parseFloat(amountStr);
          if (amountMatch.length > 1) {
            const balanceStr = amountMatch[1].replace(/[\$,]/g, "");
            balance = parseFloat(balanceStr);
          }
          description = currentLine
            .replace(/([\-$]?[\d,]+\.[\d]{2})/g, "")
            .replace(dateMatch[0], "")
            .trim();
          break;
        } else {
          description += " " + currentLine.replace(dateMatch[0], "").trim();
        }
      }

      if (!isNaN(amount) && amount !== 0 && description.trim()) {
        let categoryInfo: { category: string; confidence: number } = {
          category: "Other",
          confidence: 0.5,
        };
        try {
          categoryInfo = await categorizeTransactionAI(description);
        } catch (error) {
          console.warn(
            `AI categorization failed for "${description}", using fallback`,
            error
          );
          categoryInfo.category = categorizeTransaction(description);
        }

        transactions.push({
          date: normalizeDate(date),
          description: description.trim(),
          amount: Math.abs(amount),
          balance,
          type: amount < 0 ? "debit" : "credit",
          category: categoryInfo.category,
          confidence: categoryInfo.confidence,
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
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }

    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      let month: number, day: number, year: number;
      let yearPart = parseInt(parts[2]);
      if (yearPart < 100) {
        yearPart += yearPart < 50 ? 2000 : 1900;
      }
      month = parseInt(parts[0]) - 1;
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

function extractStatementPeriod(text: string): string {
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

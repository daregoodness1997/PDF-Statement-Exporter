import * as pdfjsLib from "pdfjs-dist";
import "/node_modules/pdfjs-dist/build/pdf.worker.mjs";
import { ai } from "./geminiModel";

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  currency: string;
  category: string;
  // The 'balance' and 'confidence' fields are removed to simplify the output,
  // as the new query focuses on core transaction data.
}

export interface BankStatementData {
  bankName: string;
  accountNumber: string;
  statementPeriod: string;
  transactions: ParsedTransaction[];
  openingBalance?: number;
  closingBalance?: number;
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
    console.error(`nAI API error (model: ):`, error.message);
    throw error;
  }
}

// New AI-powered comprehensive data extraction
async function extractBankStatementData(
  text: string
): Promise<BankStatementData> {
  // IMPROVED PROMPT
  const prompt = `
    You are an expert at parsing bank statements from various banks and formats. Your task is to extract all relevant information from the provided bank statement text.
    
    The information you need to extract is:
    - **bankName**: The name of the bank.
    - **accountNumber**: The account number.
    - **statementPeriod**: The date range of the statement.
    - **openingBalance**: The balance at the beginning of the statement period.
    - **closingBalance**: The balance at the end of the statement period.
    - **transactions**: A list of all transactions. For each transaction, extract the following details:
        - **date**: The transaction date in 'YYYY-MM-DD' format.
        - **description**: A clear, concise description of the transaction.
        - **amount**: The monetary value of the transaction. The amount should be a positive number.
        - **type**: The type of transaction, either "debit" (money going out) or "credit" (money coming in).
        - **currency**: The currency of the transaction (e.g., USD, CAD, EUR). If not explicitly mentioned, infer it from common banking practices or state "Unknown".
        - **category**: Categorize the transaction into a standard category like 'Food', 'Travel', 'Income', 'Bills', 'Shopping', etc.

    The amount field in the transactions list should be a positive number. Determine the transaction type ("debit" or "credit") based on whether the amount is an expense or an income. For example, a negative number or a number in a debit column should be a "debit" type, and a positive number or a number in a credit column should be a "credit" type. The currency should be based on the currency symbol found (e.g., $, €).

    Respond with a single JSON object that conforms to the following TypeScript interface. Do not include any pre-text, post-text, or explanations. Just the raw JSON.

    export interface ParsedTransaction {
      date: string;
      description: string;
      amount: number;
      type: "debit" | "credit";
      currency: string;
      category: string;
    }

    export interface BankStatementData {
      bankName: string;
      accountNumber: string;
      statementPeriod: string;
      transactions: ParsedTransaction[];
      openingBalance?: number;
      closingBalance?: number;
    }
    
    \`\`\`json
    {
      "bankName": "...",
      "accountNumber": "...",
      "statementPeriod": "...",
      "transactions": [
        {
          "date": "...",
          "description": "...",
          "amount": 0,
          "type": "debit" | "credit",
          "currency": "...",
          "category": "..."
        }
      ]
    }
    \`\`\`

    Here is the bank statement text to parse:
    
    ${text}

    Only respond with the JSON object.
  `;

  try {
    const response = await callAI(prompt);

    // Attempt to parse the response. This is a common point of failure.
    // We add a check for the code block delimiters to be safe.
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      // If a JSON code block is found, parse its content.
      return JSON.parse(jsonMatch[1]);
    } else {
      // Otherwise, attempt to parse the entire response string.
      // This handles cases where the model still omits the delimiters.
      return JSON.parse(response);
    }
  } catch (error: any) {
    // ROBUST ERROR HANDLING
    // This catch block is crucial. It will catch the parsing error and
    // provide a more informative message, including the raw response
    // from the AI, which is essential for debugging.
    console.error("Failed to parse AI response as JSON.");
    console.error("Raw AI response:");
    throw new Error(
      "The AI model returned invalid JSON. Please check the raw response for details."
    );
  }
}

// Main parsing function
export async function parsePDFStatement(
  file: File
): Promise<BankStatementData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || "")
        .join(" ");
      fullText += pageText + "\n";
    }

    // Call the single, comprehensive AI function
    const bankStatementData = await extractBankStatementData(fullText);

    return bankStatementData;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error(
      `Failed to parse PDF statement: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please ensure the file is a valid bank statement.`
    );
  }
}

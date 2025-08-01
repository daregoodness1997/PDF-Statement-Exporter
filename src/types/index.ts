// types/bankTemplate.ts
export interface BankTemplate {
  id: string;
  bankName: string;
  templateName: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  usageCount: number;
  isVerified: boolean; // Templates verified by admin or high usage

  // Template configuration for parsing
  parsing: {
    dateFormats: string[];
    amountPatterns: RegExp[];
    descriptionPatterns: RegExp[];
    balancePatterns: RegExp[];
    accountNumberPattern: RegExp;
    statementPeriodPattern: RegExp;
    transactionIndicators: {
      creditKeywords: string[];
      debitKeywords: string[];
    };
  };

  // AI-generated parsing instructions
  aiInstructions?: {
    extractionPrompt: string;
    validationRules: string[];
    categoryMappings: Record<string, string>;
  };

  // Template metadata
  metadata: {
    supportedFormats: ("pdf" | "csv" | "excel")[];
    language: string;
    region: string;
    currency: string;
    avgAccuracy: number; // Based on user feedback
    sampleStatements?: string[]; // Anonymized samples for reference
  };
}

export interface TemplateMatchResult {
  template: BankTemplate;
  confidence: number;
  matchedFeatures: string[];
}

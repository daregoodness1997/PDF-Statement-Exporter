// services/templateService.ts
import { BankTemplate, TemplateMatchResult } from "../types";
import { BankStatementData } from "./pdfParser";

export class TemplateService {
  private templates: Map<string, BankTemplate> = new Map();

  // Load templates from database
  async loadTemplates(): Promise<void> {
    try {
      // Replace with actual database call
      const templatesData = await this.fetchTemplatesFromDB();
      templatesData.forEach((template) => {
        this.templates.set(template.id, template);
      });
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  }

  // Get all available bank templates
  getAvailableTemplates(): BankTemplate[] {
    return Array.from(this.templates.values()).sort(
      (a, b) => b.usageCount - a.usageCount
    );
  }

  // Find templates by bank name
  getTemplatesByBank(bankName: string): BankTemplate[] {
    return Array.from(this.templates.values())
      .filter((template) =>
        template.bankName.toLowerCase().includes(bankName.toLowerCase())
      )
      .sort((a, b) => b.avgAccuracy - a.avgAccuracy);
  }

  // Intelligent template matching based on statement content
  async findBestTemplate(
    statementText: string
  ): Promise<TemplateMatchResult | null> {
    const candidates: TemplateMatchResult[] = [];

    for (const template of this.templates.values()) {
      const confidence = await this.calculateTemplateMatch(
        statementText,
        template
      );
      if (confidence > 0.3) {
        // Minimum confidence threshold
        candidates.push({
          template,
          confidence,
          matchedFeatures: this.getMatchedFeatures(statementText, template),
        });
      }
    }

    // Return the best match
    return candidates.sort((a, b) => b.confidence - a.confidence)[0] || null;
  }

  // Create new template from AI parsing results
  async createTemplateFromAI(
    bankStatementData: BankStatementData,
    originalText: string,
    userId: string
  ): Promise<BankTemplate> {
    const template: BankTemplate = {
      id: this.generateTemplateId(),
      bankName: bankStatementData.bankName,
      templateName: `${bankStatementData.bankName} - Auto Generated`,
      version: "1.0.0",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      usageCount: 1,
      isVerified: false,

      parsing: await this.extractParsingPatterns(
        originalText,
        bankStatementData
      ),
      aiInstructions: {
        extractionPrompt: this.generateExtractionPrompt(bankStatementData),
        validationRules: this.generateValidationRules(bankStatementData),
        categoryMappings: this.generateCategoryMappings(
          bankStatementData.transactions
        ),
      },

      metadata: {
        supportedFormats: ["pdf"],
        language: "en",
        region: this.detectRegion(bankStatementData),
        currency: this.detectCurrency(bankStatementData.transactions),
        avgAccuracy: 0.85, // Initial estimate
        sampleStatements: [this.anonymizeStatement(originalText)],
      },
    };

    // Save to database and local cache
    await this.saveTemplate(template);
    this.templates.set(template.id, template);

    return template;
  }

  // Update template usage and accuracy based on user feedback
  async updateTemplateMetrics(
    templateId: string,
    accuracy: number,
    userFeedback?: string
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) return;

    template.usageCount++;
    template.metadata.avgAccuracy =
      (template.metadata.avgAccuracy * (template.usageCount - 1) + accuracy) /
      template.usageCount;
    template.updatedAt = new Date();

    // Mark as verified if it meets criteria
    if (template.usageCount >= 10 && template.metadata.avgAccuracy >= 0.9) {
      template.isVerified = true;
    }

    await this.updateTemplateInDB(template);
    this.templates.set(templateId, template);
  }

  // Private helper methods
  private async calculateTemplateMatch(
    statementText: string,
    template: BankTemplate
  ): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // Check bank name match
    maxScore += 30;
    if (statementText.toLowerCase().includes(template.bankName.toLowerCase())) {
      score += 30;
    }

    // Check account number pattern
    maxScore += 20;
    if (template.parsing.accountNumberPattern.test(statementText)) {
      score += 20;
    }

    // Check date format patterns
    maxScore += 25;
    const dateMatches = template.parsing.dateFormats.some((format) => {
      const regex = this.dateFormatToRegex(format);
      return regex.test(statementText);
    });
    if (dateMatches) score += 25;

    // Check transaction indicators
    maxScore += 25;
    const creditKeywords =
      template.parsing.transactionIndicators.creditKeywords;
    const debitKeywords = template.parsing.transactionIndicators.debitKeywords;

    const hasCredits = creditKeywords.some((keyword) =>
      statementText.toLowerCase().includes(keyword.toLowerCase())
    );
    const hasDebits = debitKeywords.some((keyword) =>
      statementText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasCredits && hasDebits) score += 25;
    else if (hasCredits || hasDebits) score += 15;

    return maxScore > 0 ? score / maxScore : 0;
  }

  private getMatchedFeatures(
    statementText: string,
    template: BankTemplate
  ): string[] {
    const features: string[] = [];

    if (statementText.toLowerCase().includes(template.bankName.toLowerCase())) {
      features.push("Bank Name");
    }

    if (template.parsing.accountNumberPattern.test(statementText)) {
      features.push("Account Number Format");
    }

    // Add more feature detection logic...

    return features;
  }

  private async extractParsingPatterns(
    text: string,
    data: BankStatementData
  ): Promise<BankTemplate["parsing"]> {
    // Analyze the text to extract patterns used in successful parsing
    return {
      dateFormats: this.detectDateFormats(text, data.transactions),
      amountPatterns: this.detectAmountPatterns(text, data.transactions),
      descriptionPatterns: this.detectDescriptionPatterns(
        text,
        data.transactions
      ),
      balancePatterns: [/balance.*?[\$\€\£]?([\d,]+\.?\d*)/gi],
      accountNumberPattern: new RegExp(
        data.accountNumber.replace(/\d/g, "\\d")
      ),
      statementPeriodPattern:
        /statement period.*?(\d{1,2}\/\d{1,2}\/\d{4}).*?(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      transactionIndicators: {
        creditKeywords: [
          "deposit",
          "credit",
          "transfer in",
          "salary",
          "refund",
        ],
        debitKeywords: ["withdrawal", "debit", "purchase", "payment", "fee"],
      },
    };
  }

  private generateExtractionPrompt(data: BankStatementData): string {
    return `
      Extract bank statement data for ${data.bankName}. 
      Expected format includes account number pattern similar to ${data.accountNumber.replace(
        /\d/g,
        "X"
      )}.
      Statement period format: ${data.statementPeriod}.
      Typical transaction count: ${data.transactions.length}.
    `;
  }

  private generateValidationRules(data: BankStatementData): string[] {
    return [
      `Bank name should be "${data.bankName}"`,
      `Account number should match pattern: ${data.accountNumber.replace(
        /\d/g,
        "X"
      )}`,
      `Transactions should have dates in statement period`,
      `All amounts should be positive numbers`,
      `Transaction types should be either 'credit' or 'debit'`,
    ];
  }

  private generateCategoryMappings(
    transactions: any[]
  ): Record<string, string> {
    const mappings: Record<string, string> = {};

    transactions.forEach((t) => {
      if (t.category && t.description) {
        // Create mappings based on successful categorizations
        const key = t.description.toLowerCase().substring(0, 20);
        mappings[key] = t.category;
      }
    });

    return mappings;
  }

  // Database interaction methods (implement based on your DB)
  private async fetchTemplatesFromDB(): Promise<BankTemplate[]> {
    // Implement database fetch
    return [];
  }

  private async saveTemplate(template: BankTemplate): Promise<void> {
    // Implement database save
    console.log("Saving template:", template.id);
  }

  private async updateTemplateInDB(template: BankTemplate): Promise<void> {
    // Implement database update
    console.log("Updating template:", template.id);
  }

  // Utility methods
  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private detectDateFormats(text: string, transactions: any[]): string[] {
    // Analyze transaction dates to detect format patterns
    const formats = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
    return formats; // Simplified - implement actual detection
  }

  private detectAmountPatterns(text: string, transactions: any[]): RegExp[] {
    return [
      /\$?([\d,]+\.?\d{0,2})/g,
      /€([\d,]+\.?\d{0,2})/g,
      /£([\d,]+\.?\d{0,2})/g,
    ];
  }

  private detectDescriptionPatterns(
    text: string,
    transactions: any[]
  ): RegExp[] {
    return [/^[A-Z\s\d\-\.]+$/]; // Simplified pattern
  }

  private dateFormatToRegex(format: string): RegExp {
    const patterns = {
      "MM/DD/YYYY": /\d{1,2}\/\d{1,2}\/\d{4}/,
      "DD/MM/YYYY": /\d{1,2}\/\d{1,2}\/\d{4}/,
      "YYYY-MM-DD": /\d{4}-\d{1,2}-\d{1,2}/,
    };
    return patterns[format as keyof typeof patterns] || patterns["MM/DD/YYYY"];
  }

  private detectRegion(data: BankStatementData): string {
    // Implement region detection based on bank name, format patterns, etc.
    return "US"; // Default
  }

  private detectCurrency(transactions: any[]): string {
    // Detect currency from transaction data
    return transactions[0]?.currency || "USD";
  }

  private anonymizeStatement(text: string): string {
    // Remove sensitive information for template samples
    return text
      .replace(/\d{4,}/g, "XXXX") // Replace long numbers
      .replace(/[A-Z]{2}\d{2}[A-Z\d]+/g, "XXXXXXXX") // Replace account numbers
      .substring(0, 500); // Limit length
  }
}

// Enhanced parser with template support
export class EnhancedPDFParser {
  private templateService: TemplateService;

  constructor() {
    this.templateService = new TemplateService();
  }

  async initialize(): Promise<void> {
    await this.templateService.loadTemplates();
  }

  // Main parsing method with template selection
  async parseWithTemplateSelection(
    file: File,
    selectedTemplateId?: string,
    userId?: string
  ): Promise<{
    data: BankStatementData;
    templateUsed: BankTemplate | null;
    isNewTemplate: boolean;
  }> {
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

    let templateUsed: BankTemplate | null = null;
    let isNewTemplate = false;

    // Try to use selected template first
    if (selectedTemplateId) {
      const availableTemplates = this.templateService.getAvailableTemplates();
      templateUsed =
        availableTemplates.find((t) => t.id === selectedTemplateId) || null;
    }

    // If no template selected, try to find best match
    if (!templateUsed) {
      const matchResult = await this.templateService.findBestTemplate(fullText);
      templateUsed = matchResult?.template || null;
    }

    let bankStatementData: BankStatementData;

    // Parse using template-specific logic or fallback to AI
    if (templateUsed) {
      try {
        bankStatementData = await this.parseWithTemplate(
          fullText,
          templateUsed
        );

        // Update template usage metrics
        await this.templateService.updateTemplateMetrics(
          templateUsed.id,
          0.9 // Default accuracy - could be measured
        );
      } catch (error) {
        console.warn("Template parsing failed, falling back to AI:", error);
        bankStatementData = await this.parseWithAI(fullText);
      }
    } else {
      // Use AI parsing
      bankStatementData = await this.parseWithAI(fullText);

      // Create new template from successful AI parsing
      if (userId && bankStatementData.transactions.length > 0) {
        templateUsed = await this.templateService.createTemplateFromAI(
          bankStatementData,
          fullText,
          userId
        );
        isNewTemplate = true;
      }
    }

    return {
      data: bankStatementData,
      templateUsed,
      isNewTemplate,
    };
  }

  // Get available templates for user selection
  getAvailableTemplates(): BankTemplate[] {
    return this.templateService.getAvailableTemplates();
  }

  // Search templates by bank name
  searchTemplates(bankName: string): BankTemplate[] {
    return this.templateService.getTemplatesByBank(bankName);
  }

  // Template-based parsing (implement based on template patterns)
  private async parseWithTemplate(
    text: string,
    template: BankTemplate
  ): Promise<BankStatementData> {
    // Implement template-based parsing logic
    // This would use the template's parsing patterns and rules

    // For now, fallback to AI with template context
    const enhancedPrompt = `
      ${template.aiInstructions?.extractionPrompt || ""}
      
      Use these validation rules:
      ${template.aiInstructions?.validationRules.join("\n") || ""}
      
      Known category mappings:
      ${JSON.stringify(template.aiInstructions?.categoryMappings || {})}
      
      Parse the following bank statement:
      ${text}
    `;

    return await this.callEnhancedAI(enhancedPrompt);
  }

  // AI-based parsing (your existing method)
  private async parseWithAI(text: string): Promise<BankStatementData> {
    // Your existing AI parsing logic from the original code
    return await extractBankStatementData(text);
  }

  private async callEnhancedAI(prompt: string): Promise<BankStatementData> {
    // Enhanced AI call with template context
    // Implementation similar to your existing callAI function
    return await extractBankStatementData(prompt);
  }
}

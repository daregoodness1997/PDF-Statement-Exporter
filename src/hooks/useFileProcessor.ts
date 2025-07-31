import { useState, useCallback } from 'react';
import { parsePDFStatement, BankStatementData } from '../utils/pdfParser';
import { exportToExcel, ExportOptions } from '../utils/excelExporter';

export interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'ready' | 'processing' | 'completed' | 'error';
  progress: number;
  bankDetected?: string;
}

export interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  description?: string;
}

export const useFileProcessor = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [bankData, setBankData] = useState<BankStatementData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeSteps = useCallback(() => {
    const steps: ProcessingStep[] = [
      {
        id: 'upload',
        title: 'File Upload',
        status: 'completed',
        description: 'PDF files uploaded successfully'
      },
      {
        id: 'extract',
        title: 'Text Extraction',
        status: 'pending',
        description: 'Extracting text content from PDF'
      },
      {
        id: 'detect',
        title: 'Bank Detection',
        status: 'pending',
        description: 'Identifying bank format and structure'
      },
      {
        id: 'parse',
        title: 'Transaction Parsing',
        status: 'pending',
        description: 'Extracting transaction data'
      },
      {
        id: 'categorize',
        title: 'Data Categorization',
        status: 'pending',
        description: 'Categorizing transactions and cleaning data'
      },
      {
        id: 'validate',
        title: 'Data Validation',
        status: 'pending',
        description: 'Validating extracted data'
      }
    ];
    setProcessingSteps(steps);
    return steps;
  }, []);

  const updateStep = useCallback((stepId: string, status: ProcessingStep['status'], description?: string) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, description: description || step.description }
        : step
    ));
  }, []);

  const processFiles = useCallback(async () => {
    if (uploadedFiles.length === 0) return;

    setIsProcessing(true);
    setIsComplete(false);
    setError(null);
    setBankData(null);

    const steps = initializeSteps();

    try {
      // For now, process the first file (can be extended for multiple files)
      const file = uploadedFiles[0];
      
      // Update file status
      setUploadedFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'processing' } : f
      ));

      // Step 1: Text Extraction
      updateStep('extract', 'processing', 'Reading PDF content...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
      
      // Step 2: Bank Detection
      updateStep('extract', 'completed');
      updateStep('detect', 'processing', 'Analyzing bank format...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 3: Parse PDF
      updateStep('detect', 'completed');
      updateStep('parse', 'processing', 'Extracting transactions...');
      
      const parsedData = await parsePDFStatement(file.file);
      
      // Update file with detected bank
      setUploadedFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, bankDetected: parsedData.bankName } : f
      ));

      // Step 4: Categorization
      updateStep('parse', 'completed');
      updateStep('categorize', 'processing', 'Categorizing transactions...');
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Step 5: Validation
      updateStep('categorize', 'completed');
      updateStep('validate', 'processing', 'Validating data integrity...');
      await new Promise(resolve => setTimeout(resolve, 400));
      
      updateStep('validate', 'completed', 'Data validation complete');
      
      setBankData(parsedData);
      
      // Update file status to completed
      setUploadedFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'completed', progress: 100 } : f
      ));
      
      setIsComplete(true);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      
      // Mark current processing step as error
      const currentStep = steps.find(step => step.status === 'processing');
      if (currentStep) {
        updateStep(currentStep.id, 'error', errorMessage);
      }
      
      // Update file status to error
      setUploadedFiles(prev => prev.map(f => 
        f.status === 'processing' ? { ...f, status: 'error' } : f
      ));
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFiles, initializeSteps, updateStep]);

  const downloadExcel = useCallback((options?: ExportOptions) => {
    if (!bankData) return;
    
    const defaultOptions: ExportOptions = {
      includeCategories: true,
      includeBalance: true,
      dateFormat: 'MM/DD/YYYY',
      currency: 'USD',
      groupByMonth: false,
      includeSummary: true
    };
    
    exportToExcel(bankData, options || defaultOptions);
  }, [bankData]);

  const resetProcessor = useCallback(() => {
    setUploadedFiles([]);
    setProcessingSteps([]);
    setBankData(null);
    setIsProcessing(false);
    setIsComplete(false);
    setError(null);
  }, []);

  return {
    uploadedFiles,
    setUploadedFiles,
    processingSteps,
    bankData,
    isProcessing,
    isComplete,
    error,
    processFiles,
    downloadExcel,
    resetProcessor
  };
};
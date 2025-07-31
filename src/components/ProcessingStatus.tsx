import React from 'react';
import { CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';

interface ProcessingStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  description?: string;
}

interface ProcessingStatusProps {
  steps: ProcessingStep[];
  onDownload: () => void;
  isComplete: boolean;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ steps, onDownload, isComplete }) => {
  const getStepIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return (
          <div className="w-5 h-5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        );
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStepColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-700';
      case 'processing':
        return 'text-blue-700';
      case 'error':
        return 'text-red-700';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center space-x-2 mb-6">
        <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-full"></div>
        </div>
        <h3 className="text-xl font-bold text-gray-900">Processing Status</h3>
      </div>
      
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start space-x-4">
            <div className="flex-shrink-0 mt-0.5">
              {getStepIcon(step.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${getStepColor(step.status)}`}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-sm text-gray-600 mt-1">{step.description}</p>
              )}
            </div>
            
            {index < steps.length - 1 && (
              <div className="absolute left-[1.375rem] mt-8 w-px h-6 bg-gray-200" />
            )}
          </div>
        ))}
      </div>
      
      {isComplete && (
        <div className="mt-8 pt-6 border-t border-gray-200/50">
          <button
            onClick={onDownload}
            className="w-full inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-[1.02]"
          >
            <Download className="w-5 h-5 mr-2" />
            Download Excel File
          </button>
          
          <p className="text-center text-sm text-gray-500 mt-3 font-medium">
            Your converted file is ready for download
          </p>
        </div>
      )}
    </div>
  );
};
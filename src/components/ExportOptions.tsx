import React, { useState } from 'react';
import { FileSpreadsheet, Settings, CheckSquare, Square } from 'lucide-react';
import { ExportOptions as ExportOptionsType } from '../utils/excelExporter';

interface ExportOptionsProps {
  onExport: (options: ExportOptionsType) => void;
  isDisabled?: boolean;
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({ onExport, isDisabled = false }) => {
  const [settings, setSettings] = useState<ExportOptionsType>({
    includeCategories: true,
    includeBalance: true,
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    groupByMonth: false,
    includeSummary: true
  });

  const handleExport = () => {
    onExport(settings);
  };

  const toggleSetting = (key: keyof ExportOptionsType) => {
    if (typeof settings[key] === 'boolean') {
      setSettings(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center space-x-2 mb-6">
        <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Export Options</h3>
      </div>
      
      <div className="space-y-6">
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Include Data</h4>
          <div className="space-y-2">
            {[
              { key: 'includeCategories', label: 'Transaction Categories' },
              { key: 'includeBalance', label: 'Running Balance' },
              { key: 'groupByMonth', label: 'Group by Month' },
              { key: 'includeSummary', label: 'Summary Sheet' }
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center space-x-3 cursor-pointer">
                <button
                  onClick={() => toggleSetting(key as keyof ExportOptionsType)}
                  className="flex-shrink-0 transition-transform duration-200 hover:scale-110"
                >
                  {settings[key as keyof ExportOptionsType] ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Format
          </label>
          <select
            value={settings.dateFormat}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              dateFormat: e.target.value as ExportOptionsType['dateFormat']
            }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white/80 backdrop-blur-xl"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Currency
          </label>
          <select
            value={settings.currency}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              currency: e.target.value
            }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-white/80 backdrop-blur-xl"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD (C$)</option>
            <option value="AUD">AUD (A$)</option>
            <option value="JPY">JPY (¥)</option>
          </select>
        </div>
        
        <button
          onClick={handleExport}
          disabled={isDisabled}
          className={`w-full inline-flex items-center justify-center px-8 py-4 font-semibold rounded-xl transition-all duration-300 shadow-xl ${
            isDisabled 
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
              : 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 hover:shadow-2xl transform hover:scale-[1.02]'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5 mr-2" />
          Export to Excel
        </button>
      </div>
    </div>
  );
};
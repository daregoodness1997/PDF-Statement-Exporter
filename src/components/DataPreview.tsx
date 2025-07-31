import React from 'react';
import { Calendar, DollarSign, Building, Tag } from 'lucide-react';
import { BankStatementData } from '../utils/pdfParser';

interface DataPreviewProps {
  bankData: BankStatementData;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ bankData }) => {
  const { transactions, bankName, accountNumber, statementPeriod } = bankData;
  
  const totalCredits = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalDebits = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-8 border-b border-gray-200/50">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Data Preview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-xl p-5 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-gray-600">Bank</span>
            </div>
            <p className="font-semibold text-gray-900 mt-1">{bankName}</p>
            <p className="text-sm text-gray-500">Account: {accountNumber}</p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl rounded-xl p-5 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Period</span>
            </div>
            <p className="font-semibold text-gray-900 mt-1">{statementPeriod}</p>
            <p className="text-sm text-gray-500">{transactions.length} transactions</p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl rounded-xl p-5 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Total Credits</span>
            </div>
            <p className="font-semibold text-green-700 mt-1">
              ${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl rounded-xl p-5 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600">Total Debits</span>
            </div>
            <p className="font-semibold text-red-700 mt-1">
              ${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((transaction, index) => (
                <tr key={`${transaction.date}-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900 max-w-xs truncate">
                    {transaction.description}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Tag className="w-3 h-3 mr-1" />
                      {transaction.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-sm text-right font-medium ${
                    transaction.type === 'credit' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {transaction.type === 'credit' ? '+' : '-'}
                    ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                    {transaction.balance ? `$${transaction.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {transactions.length > 10 && (
            <div className="text-center py-4 text-sm text-gray-500">
              Showing first 10 of {transactions.length} transactions
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
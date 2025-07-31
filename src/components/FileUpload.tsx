import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'ready' | 'processing' | 'completed' | 'error';
  progress: number;
  bankDetected?: string;
}

interface FileUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesUploaded, uploadedFiles }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (files.length > 0) {
      const newFiles: UploadedFile[] = files.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        status: 'ready',
        progress: 0
      }));
      
      onFilesUploaded([...uploadedFiles, ...newFiles]);
    }
  }, [onFilesUploaded, uploadedFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      file => file.type === 'application/pdf'
    );
    
    if (files.length > 0) {
      const newFiles: UploadedFile[] = files.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        status: 'ready',
        progress: 0
      }));
      
      onFilesUploaded([...uploadedFiles, ...newFiles]);
    }
  }, [onFilesUploaded, uploadedFiles]);

  const removeFile = useCallback((fileId: string) => {
    onFilesUploaded(uploadedFiles.filter(f => f.id !== fileId));
  }, [onFilesUploaded, uploadedFiles]);

  return (
    <div className="space-y-6">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
          isDragOver
            ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 scale-[1.02]'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-gradient-to-br hover:from-indigo-25 hover:to-purple-25'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-110 transition-transform duration-300">
            <Upload className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Upload Bank Statements
            </h3>
            <p className="text-lg text-gray-600 mb-6">
              Drag and drop PDF files here, or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports 1000+ banks worldwide • Maximum 10MB per file
            </p>
          </div>
          
          <button className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105">
            <Upload className="w-5 h-5 mr-2" />
            Choose Files
          </button>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-bold text-gray-900 text-lg">Uploaded Files ({uploadedFiles.length})</h4>
          
          {uploadedFiles.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-5 bg-white/80 backdrop-blur-xl rounded-xl border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.01]">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-red-600" />
                </div>
                
                <div>
                  <p className="font-medium text-gray-900 truncate max-w-xs">
                    {file.file.name}
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>{(file.file.size / 1024 / 1024).toFixed(1)} MB</span>
                    {file.bankDetected && (
                      <>
                        <span>•</span>
                        <span className="text-green-600 font-medium">{file.bankDetected}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {file.status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                
                {file.status === 'processing' && (
                  <div className="w-5 h-5">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
                
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
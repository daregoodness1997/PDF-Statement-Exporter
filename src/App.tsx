import React from "react";
import { FileUpload } from "./components/FileUpload";
import { ProcessingStatus } from "./components/ProcessingStatus";
import { DataPreview } from "./components/DataPreview";
import { ExportOptions } from "./components/ExportOptions";
import { useFileProcessor } from "./hooks/useFileProcessor";
import {
  Building2,
  Shield,
  Globe,
  Zap,
  Sparkles,
  TrendingUp,
  Users,
  Award,
} from "lucide-react";

function App() {
  const {
    uploadedFiles,
    setUploadedFiles,
    processingSteps,
    bankData,
    isProcessing,
    isComplete,
    error,
    processFiles,
    downloadExcel,
    resetProcessor,
  } = useFileProcessor();

  const handleExport = (
    options: import("./utils/excelExporter").ExportOptions
  ) => {
    downloadExcel(options);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-25 to-pink-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-600/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  BankConverter Pro
                </h1>
                <p className="text-sm text-gray-600 font-medium">
                  Transform PDF statements into Excel magic ✨
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-8 text-sm">
              <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-full">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="text-green-700 font-medium">
                  Bank-grade Security
                </span>
              </div>
              <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-full">
                <Globe className="w-4 h-4 text-blue-600" />
                <span className="text-blue-700 font-medium">1000+ Banks</span>
              </div>
              <div className="flex items-center space-x-2 bg-yellow-50 px-3 py-2 rounded-full">
                <Zap className="w-4 h-4 text-yellow-600" />
                <span className="text-yellow-700 font-medium">
                  Lightning Fast
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero Section */}
        {uploadedFiles.length === 0 && !isProcessing && !isComplete && (
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-6 shadow-lg">
              <Sparkles className="w-4 h-4" />
              <span>Trusted by 50,000+ users worldwide</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Made for{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                finance
              </span>
              ,
              <br />
              designed to{" "}
              <span className="bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent">
                love
              </span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Transform messy PDF bank statements into beautiful, organized
              Excel files. Support for 1000+ banks worldwide with AI-powered
              accuracy.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload and Processing */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl   p-8  transition-all duration-300">
              <FileUpload
                onFilesUploaded={setUploadedFiles}
                uploadedFiles={uploadedFiles}
              />

              {uploadedFiles.length > 0 && !isProcessing && !isComplete && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={processFiles}
                    className="w-full inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 transition-all duration-300  hover:shadow-2xl transform hover:scale-[1.02]"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Start Processing
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50/80 backdrop-blur-xl  rounded-2xl p-6 shadow-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-5 h-5 bg-red-500/20 rounded-full flex items-center justify-center">
                    <span className="text-red-500 text-xs">!</span>
                  </div>
                  <h3 className="text-lg font-semibold text-red-600">
                    Processing Error
                  </h3>
                </div>
                <p className="text-red-700 mb-4">{error}</p>
                <button
                  onClick={resetProcessor}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 shadow-lg hover: transform hover:scale-105"
                >
                  Try Again
                </button>
              </div>
            )}

            {(isProcessing || isComplete) && (
              <ProcessingStatus
                steps={processingSteps}
                onDownload={downloadExcel}
                isComplete={isComplete}
              />
            )}

            {isComplete && bankData && <DataPreview bankData={bankData} />}
          </div>

          {/* Right Column - Export Options */}
          <div className="space-y-6">
            {isComplete && (
              <ExportOptions onExport={handleExport} isDisabled={!bankData} />
            )}

            {/* Features */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl  p-6  transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Why Choose BankConverter Pro?
              </h3>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Globe className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Universal Support
                    </p>
                    <p className="text-sm text-gray-600">
                      Works with 1000+ banks worldwide including major
                      institutions from US, EU, UK, Canada, Australia, and Asia.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Shield className="w-3 h-3 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Secure Processing
                    </p>
                    <p className="text-sm text-gray-600">
                      All processing happens locally in your browser. Your
                      financial data never leaves your device.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-3 h-3 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Smart Recognition
                    </p>
                    <p className="text-sm text-gray-600">
                      AI-powered format detection and automatic transaction
                      categorization for clean, organized data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl text-white p-6  hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
              <h3 className="text-lg font-semibold mb-4">
                Trusted by Users Worldwide
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">1,000+</p>
                  <p className="text-sm opacity-90">Banks Supported</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">50K+</p>
                  <p className="text-sm opacity-90">Files Converted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">99.9%</p>
                  <p className="text-sm opacity-90">Accuracy Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">30s</p>
                  <p className="text-sm opacity-90">Avg. Process Time</p>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20  p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Award className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Industry Recognition
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">
                    #1 PDF Converter 2024
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">
                    50K+ Happy Users
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

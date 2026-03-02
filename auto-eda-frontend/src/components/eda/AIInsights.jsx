import React from "react";

import ReactMarkdown from "react-markdown";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

export default function AIInsights({ insights, isLoading, onRefresh }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-violet-100 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                AI-Powered Insights
              </h3>
              <p className="text-sm text-slate-500">
                Intelligent analysis of your data
              </p>
            </div>
          </div>

          {insights && !isLoading && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-violet-200 hover:bg-violet-100 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 min-h-[200px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-violet-400/20"
              />
            </div>
            <p className="text-slate-600 font-medium">
              Analyzing your data...
            </p>
            <p className="text-slate-400 text-sm">
              This may take a moment
            </p>
          </div>
        ) : insights ? (
          <div className="prose prose-slate prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold text-slate-800 mt-6 mb-3">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-slate-800 mt-5 mb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-slate-700 mt-4 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-slate-600 leading-relaxed mb-3">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 text-slate-600 mb-3">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 mb-3">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-slate-600">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-slate-800">
                    {children}
                  </strong>
                ),
                code: ({ children }) => (
                  <code className="bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded text-xs font-mono">
                    {children}
                  </code>
                ),
              }}
            >
              {insights}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Sparkles className="w-12 h-12 text-violet-300 mb-4" />
            <p className="text-slate-500">
              AI insights will appear here after analysis
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

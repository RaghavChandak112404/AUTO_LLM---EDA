import React, { useState } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Brain, Loader2, Wrench, Lightbulb, RefreshCw } from "lucide-react";

export default function MLRecommendations({ recommendations, isLoading, onRefresh }) {
  const [activeTab, setActiveTab] = useState("models");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border border-blue-200 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-blue-100 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">ML Recommendations</h3>
              <p className="text-sm text-slate-500">
                Models & preprocessing suggestions
              </p>
            </div>
          </div>

          {recommendations && !isLoading && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-blue-200 hover:bg-blue-100 transition"
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
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-blue-400/20"
              />
            </div>
            <p className="text-slate-600 font-medium">
              Generating recommendations...
            </p>
            <p className="text-slate-400 text-sm">Analyzing data patterns</p>
          </div>
        ) : recommendations ? (
          <>
            {/* Tabs (simple buttons) */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab("models")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${activeTab === "models"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-700"
                  }`}
              >
                <Lightbulb className="w-4 h-4" />
                Models
              </button>

              <button
                onClick={() => setActiveTab("preprocessing")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${activeTab === "preprocessing"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-700"
                  }`}
              >
                <Wrench className="w-4 h-4" />
                Preprocessing
              </button>
            </div>

            {/* Tab Content */}
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
                    <code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-mono">
                      {children}
                    </code>
                  ),
                }}
              >
                {activeTab === "models"
                  ? recommendations.models ||
                  "No model recommendations available."
                  : recommendations.preprocessing ||
                  "No preprocessing recommendations available."}
              </ReactMarkdown>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Brain className="w-12 h-12 text-blue-300 mb-4" />
            <p className="text-slate-500">
              ML recommendations will appear here after analysis
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

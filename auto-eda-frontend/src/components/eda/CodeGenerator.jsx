import React, { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Code, Copy, Check, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function CodeGenerator({ code, isLoading, onRefresh }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!code) return;
        await navigator.clipboard.writeText(code);
        setCopied(true);
        toast.success('Code copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        if (!code) return;
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'eda_analysis.py';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Code downloaded as eda_analysis.py');
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
        >
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Code className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Python Code</h3>
                            <p className="text-sm text-slate-400">Ready-to-run EDA script</p>
                        </div>
                    </div>
                    {code && !isLoading && (
                        <div className="flex items-center gap-2">
                            <button
                                variant="ghost"
                                size="sm"
                                onClick={onRefresh}
                                className="text-slate-400 hover:text-white hover:bg-slate-700"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Regenerate
                            </button>
                            <button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="text-slate-400 hover:text-white hover:bg-slate-700"
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 mr-2 text-emerald-400" />
                                ) : (
                                    <Copy className="w-4 h-4 mr-2" />
                                )}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                                variant="ghost"
                                size="sm"
                                onClick={handleDownload}
                                className="text-slate-400 hover:text-white hover:bg-slate-700"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 min-h-[300px] max-h-[600px] overflow-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                            </div>
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 rounded-full bg-emerald-400/20"
                            />
                        </div>
                        <p className="text-slate-300 font-medium">Generating Python code...</p>
                        <p className="text-slate-500 text-sm">Creating visualizations and analysis</p>
                    </div>
                ) : code ? (
                    <pre className="text-sm font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                        <code>
                            {code.split('\n').map((line, i) => {
                                // Simple syntax highlighting
                                let highlightedLine = line;

                                // Comments
                                if (line.trim().startsWith('#')) {
                                    return <div key={i} className="text-slate-500">{line}</div>;
                                }

                                // Keywords
                                const keywords = ['import', 'from', 'def', 'return', 'if', 'else', 'elif', 'for', 'while', 'in', 'as', 'with', 'class', 'True', 'False', 'None'];
                                keywords.forEach(kw => {
                                    const regex = new RegExp(`\\b${kw}\\b`, 'g');
                                    highlightedLine = highlightedLine.replace(regex, `<span class="text-violet-400">${kw}</span>`);
                                });

                                // Strings
                                highlightedLine = highlightedLine.replace(/(["'])(.*?)\1/g, '<span class="text-emerald-400">$&</span>');

                                // Numbers
                                highlightedLine = highlightedLine.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-400">$1</span>');

                                return (
                                    <div
                                        key={i}
                                        className="hover:bg-slate-800/50 px-2 -mx-2 rounded"
                                        dangerouslySetInnerHTML={{ __html: highlightedLine || '&nbsp;' }}
                                    />
                                );
                            })}
                        </code>
                    </pre>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                        <Code className="w-12 h-12 text-slate-600 mb-4" />
                        <p className="text-slate-500">Python code will be generated here</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
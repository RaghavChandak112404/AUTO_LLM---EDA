import React, { useState, useCallback, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
//import { base44 } from '@/api/base44Client';
import { BarChart3, Sparkles, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import FileUploader from "../components/eda/FileUploader";
import DataPreview from "../components/eda/DataPreview";
import StatsSummary from "../components/eda/StatsSummary";
import DataVisualizations from "../components/eda/DataVisualizations";
import AIInsights from "../components/eda/AIInsights";
import MLRecommendations from "../components/eda/MLRecommendations";
import CodeGenerator from "../components/eda/CodeGenerator";
import { ErrorBoundary } from "../components/ErrorBoundary";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function EDAPage() {
    const [data, setData] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [rawFile, setRawFile] = useState(null);
    const [backendReady, setBackendReady] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiInsights, setAiInsights] = useState(null);
    const [mlRecommendations, setMlRecommendations] = useState(null);
    const [pythonCode, setPythonCode] = useState(null);
    const [loadingStates, setLoadingStates] = useState({
        insights: false,
        recommendations: false,
        code: false
    });

    // Compute stats summary (local, for display widgets)
    const dataSummary = useMemo(() => {
        if (!data) return null;
        const { headers, rows } = data;
        const columnInfo = headers.map(header => {
            const values = rows.map(row => row[header]).filter(v => v !== '' && v != null);
            const numericValues = values.filter(v => !isNaN(parseFloat(v)) && isFinite(v));
            const isNumeric = numericValues.length > values.length * 0.8;
            const uniqueCount = new Set(values).size;
            const missingCount = rows.length - values.length;
            let stats = { name: header, type: isNumeric ? 'numeric' : 'categorical', uniqueCount, missingCount };
            if (isNumeric) {
                const nums = numericValues.map(v => parseFloat(v)).sort((a, b) => a - b);
                stats.min = nums[0];
                stats.max = nums[nums.length - 1];
                stats.mean = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
            }
            return stats;
        });
        return { rowCount: rows.length, columnCount: headers.length, columns: columnInfo };
    }, [data]);

    // ── Upload file to backend ────────────────────────────────────────────
    const uploadToBackend = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `Upload failed: ${res.status}`);
            }
            return true;
        } catch (err) {
            console.warn('Backend upload failed:', err.message);
            return false;
        }
    }, []);

    // ── Insights: call Gemini /llm/insights ──────────────────────────────
    const generateInsights = useCallback(async () => {
        if (!data) return;
        setLoadingStates(prev => ({ ...prev, insights: true }));
        try {
            if (backendReady) {
                const res = await fetch(`${API_BASE}/llm/insights`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setAiInsights(json.insights || 'No insights returned.');
            } else {
                // Local fallback — at least uses actual column names
                const numericCount = dataSummary.columns.filter(c => c.type === 'numeric').length;
                const categoricalCount = dataSummary.columns.filter(c => c.type === 'categorical').length;
                const missingColumns = dataSummary.columns.filter(c => c.missingCount > 0);
                const lines = [];
                lines.push(`- Dataset has **${dataSummary.rowCount.toLocaleString()} rows** and **${dataSummary.columnCount} columns**.`);
                lines.push(`- Numeric columns: **${numericCount}**; categorical columns: **${categoricalCount}**.`);
                if (missingColumns.length > 0) {
                    lines.push(`- Missing values in: ${missingColumns.map(c => `\`${c.name}\``).join(', ')}.`);
                } else {
                    lines.push('- No missing values detected — dataset appears complete.');
                }
                lines.push('');
                lines.push('⚠️ *Backend unavailable — start the backend for Gemini-powered insights.*');
                setAiInsights(lines.join('\n'));
            }
        } catch (error) {
            toast.error('Failed to generate insights');
            console.error(error);
            setAiInsights('Failed to generate insights. Please ensure the backend is running.');
        } finally {
            setLoadingStates(prev => ({ ...prev, insights: false }));
        }
    }, [data, dataSummary, backendReady]);

    // ── ML Recommendations: call Gemini /llm/recommend-ml ────────────────
    const generateRecommendations = useCallback(async () => {
        if (!data) return;
        setLoadingStates(prev => ({ ...prev, recommendations: true }));
        try {
            if (backendReady) {
                const res = await fetch(`${API_BASE}/llm/recommend-ml`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setMlRecommendations({
                    models: json.models || 'No model recommendations returned.',
                    preprocessing: json.preprocessing || 'No preprocessing recommendations returned.',
                });
            } else {
                // Local fallback using actual column names
                const numericCols = dataSummary.columns.filter(c => c.type === 'numeric').map(c => c.name);
                const catCols = dataSummary.columns.filter(c => c.type === 'categorical').map(c => c.name);
                const hasMissing = dataSummary.columns.some(c => c.missingCount > 0);

                const modelsLines = [];
                if (numericCols.length > 0) {
                    modelsLines.push(`- **RandomForestRegressor**: suitable if predicting a numeric column such as \`${numericCols[0]}\`.`);
                }
                if (catCols.length > 0) {
                    modelsLines.push(`- **RandomForestClassifier**: suitable if predicting a categorical column such as \`${catCols[0]}\`.`);
                }
                modelsLines.push('');
                modelsLines.push('⚠️ *Start the backend for Gemini-powered, dataset-specific model recommendations.*');

                const prepLines = [];
                if (hasMissing) {
                    prepLines.push(`- Impute missing values in: ${dataSummary.columns.filter(c => c.missingCount > 0).map(c => `\`${c.name}\``).join(', ')}.`);
                } else {
                    prepLines.push('- No missing values detected — no imputation needed.');
                }
                if (catCols.length > 0) {
                    prepLines.push(`- Encode categorical columns: ${catCols.map(c => `\`${c}\``).join(', ')}.`);
                }
                if (numericCols.length > 0) {
                    prepLines.push(`- Scale numeric features for model compatibility: ${numericCols.slice(0, 5).map(c => `\`${c}\``).join(', ')}.`);
                }
                if (dataSummary.columnCount >= 5) {
                    prepLines.push('- Consider PCA or feature selection to reduce dimensionality.');
                }
                prepLines.push('');
                prepLines.push('⚠️ *Start the backend for Gemini-powered, dataset-specific preprocessing steps.*');

                setMlRecommendations({ models: modelsLines.join('\n'), preprocessing: prepLines.join('\n') });
            }
        } catch (error) {
            toast.error('Failed to generate recommendations');
            console.error(error);
            setMlRecommendations({ models: 'Failed to generate model recommendations.', preprocessing: 'Failed to generate preprocessing recommendations.' });
        } finally {
            setLoadingStates(prev => ({ ...prev, recommendations: false }));
        }
    }, [data, dataSummary, backendReady]);

    // ── Code Generator: call Gemini /llm/generate-code ───────────────────
    const generateCode = useCallback(async () => {
        if (!data) return;
        setLoadingStates(prev => ({ ...prev, code: true }));
        try {
            if (backendReady) {
                const res = await fetch(`${API_BASE}/llm/generate-code`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setPythonCode(json.code || '# No code returned.');
            } else {
                // Fallback: generate code using actual column names from the parsed CSV
                const allCols = dataSummary.columns.map(c => c.name);
                const numericCols = dataSummary.columns.filter(c => c.type === 'numeric').map(c => c.name);
                const catCols = dataSummary.columns.filter(c => c.type === 'categorical').map(c => c.name);
                const targetCol = allCols[allCols.length - 1];
                const featureCols = allCols.slice(0, -1);
                const isClassification = catCols.includes(targetCol);
                const modelClass = isClassification ? 'RandomForestClassifier' : 'RandomForestRegressor';

                const numericFeatureCols = numericCols.filter(c => featureCols.includes(c));
                const catFeatureCols = catCols.filter(c => featureCols.includes(c));

                let code = `import pandas as pd\n`;
                code += `from sklearn.model_selection import train_test_split\n`;
                code += `from sklearn.ensemble import ${modelClass}\n`;
                code += `from sklearn.impute import SimpleImputer\n`;
                code += `from sklearn.preprocessing import LabelEncoder`;
                if (catFeatureCols.length > 0) code += `, OrdinalEncoder`;
                code += `\n\n`;
                code += `# Load data\n`;
                code += `df = pd.read_csv('your-file.csv')  # Replace with your filename\n`;
                code += `print("Shape:", df.shape)\n`;
                code += `print(df.dtypes)\n`;
                code += `print(df.describe())\n`;
                code += `print("Missing values:\\n", df.isnull().sum())\n\n`;
                code += `# Features and target\n`;
                code += `X = df[${JSON.stringify(featureCols)}]\n`;
                code += `y = df['${targetCol}']\n\n`;
                if (numericFeatureCols.length > 0) {
                    code += `# Impute numeric columns\n`;
                    code += `num_cols = ${JSON.stringify(numericFeatureCols)}\n`;
                    code += `X.loc[:, num_cols] = SimpleImputer(strategy='median').fit_transform(X[num_cols])\n\n`;
                }
                if (catFeatureCols.length > 0) {
                    code += `# Encode categorical columns\n`;
                    code += `cat_cols = ${JSON.stringify(catFeatureCols)}\n`;
                    code += `X.loc[:, cat_cols] = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1).fit_transform(X[cat_cols])\n\n`;
                }
                if (isClassification) {
                    code += `# Encode target column\n`;
                    code += `y = LabelEncoder().fit_transform(y)\n\n`;
                }
                code += `# Train/test split and model training\n`;
                code += `X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)\n`;
                code += `model = ${modelClass}(n_estimators=100, random_state=42)\n`;
                code += `model.fit(X_train, y_train)\n`;
                code += `print('Score:', model.score(X_test, y_test))\n\n`;
                code += `# NOTE: Connect the backend for Gemini-generated, fully tailored code.`;
                setPythonCode(code);
            }
        } catch (error) {
            toast.error('Failed to generate code');
            console.error(error);
            setPythonCode('# Failed to generate Python code.');
        } finally {
            setLoadingStates(prev => ({ ...prev, code: false }));
        }
    }, [data, dataSummary, backendReady]);

    // ── File upload handler ───────────────────────────────────────────────
    const handleFileUpload = useCallback(async (uploadedData, file) => {
        setData(uploadedData);
        setRawFile(file || null);
        setAiInsights(null);
        setMlRecommendations(null);
        setPythonCode(null);
        setBackendReady(false);
        toast.success('File uploaded successfully!');

        if (file) {
            const ok = await uploadToBackend(file);
            setBackendReady(ok);
            if (ok) {
                toast.success('Dataset sent to backend — Gemini analysis ready!');
            } else {
                toast.warning('Backend unavailable — using local fallback analysis.');
            }
        }
    }, [uploadToBackend]);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const handleAnalyze = useCallback(async () => {
        setIsProcessing(true);
        try {
            await generateInsights();
            await sleep(2000);           // 2s gap before next call
            await generateRecommendations();
            await sleep(2000);           // 2s gap before next call
            await generateCode();
        } finally {
            setIsProcessing(false);
        }
    }, [generateInsights, generateRecommendations, generateCode]);

    const handleReset = useCallback(async () => {
        setData(null);
        setRawFile(null);
        setBackendReady(false);
        setAiInsights(null);
        setMlRecommendations(null);
        setPythonCode(null);
        try { await fetch(`${API_BASE}/session`, { method: 'DELETE' }); } catch { /* ignore */ }
    }, []);

    console.log("EDAPage Render", { data, isProcessing, aiInsights, backendReady });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
                                <BarChart3 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                                    AI-Powered EDA
                                </h1>
                                <p className="text-sm text-slate-500">
                                    Automated exploratory data analysis with intelligent insights
                                </p>
                            </div>
                        </div>
                        {data && (
                            <button
                                onClick={handleReset}
                                className="flex items-center px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <AnimatePresence mode="wait">
                    {!data ? (
                        <motion.div
                            key="uploader"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="max-w-2xl mx-auto py-12"
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-slate-800 mb-3">
                                    Upload your dataset
                                </h2>
                                <p className="text-slate-500 max-w-md mx-auto">
                                    Drop a CSV file to get instant AI-powered insights, ML recommendations, and ready-to-use Python code
                                </p>
                            </div>
                            <FileUploader onFileUpload={handleFileUpload} isProcessing={isProcessing} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="analysis"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-8"
                        >
                            <ErrorBoundary>
                                <DataPreview data={data} />
                            </ErrorBoundary>

                            <ErrorBoundary>
                                <StatsSummary data={data} />
                            </ErrorBoundary>

                            <ErrorBoundary>
                                <DataVisualizations data={data} />
                            </ErrorBoundary>

                            {/* Analyze Button */}
                            {!aiInsights && !loadingStates.insights && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-center py-4"
                                >
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isProcessing}
                                        className="flex items-center bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all font-semibold disabled:opacity-60"
                                    >
                                        <Sparkles className="w-5 h-5 mr-2" />
                                        Generate AI Analysis
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </button>
                                </motion.div>
                            )}

                            {/* AI Sections */}
                            {(aiInsights || loadingStates.insights) && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <AIInsights
                                        insights={aiInsights}
                                        isLoading={loadingStates.insights}
                                        onRefresh={generateInsights}
                                    />
                                    <MLRecommendations
                                        recommendations={mlRecommendations}
                                        isLoading={loadingStates.recommendations}
                                        onRefresh={generateRecommendations}
                                    />
                                </div>
                            )}

                            {/* Code Generator */}
                            {(pythonCode || loadingStates.code) && (
                                <CodeGenerator
                                    code={pythonCode}
                                    isLoading={loadingStates.code}
                                    onRefresh={generateCode}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
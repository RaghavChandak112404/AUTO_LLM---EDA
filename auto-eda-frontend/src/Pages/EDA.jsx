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


export default function EDAPage() {
    const [data, setData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiInsights, setAiInsights] = useState(null);
    const [mlRecommendations, setMlRecommendations] = useState(null);
    const [pythonCode, setPythonCode] = useState(null);
    const [loadingStates, setLoadingStates] = useState({
        insights: false,
        recommendations: false,
        code: false
    });

    // Compute stats summary
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

        return {
            rowCount: rows.length,
            columnCount: headers.length,
            columns: columnInfo
        };
    }, [data]);

    const generateInsights = useCallback(async () => {
        if (!data || !dataSummary) return;

        setLoadingStates(prev => ({ ...prev, insights: true }));

        try {
            // Basic local insight generation (works without backend/OpenAI key)
            const numericCount = dataSummary.columns.filter(col => col.type === 'numeric').length;
            const categoricalCount = dataSummary.columns.filter(col => col.type === 'categorical').length;
            const missingColumns = dataSummary.columns.filter(col => col.missingCount > 0);

            let insightLines = [];
            insightLines.push(`- Dataset has **${dataSummary.rowCount.toLocaleString()} rows** and **${dataSummary.columnCount} columns**.`);
            insightLines.push(`- Numeric columns: **${numericCount}**; categorical columns: **${categoricalCount}**.`);
            if (missingColumns.length > 0) {
                insightLines.push(`- Missing values found in ${missingColumns.length} column(s): ${missingColumns.map(c => c.name).join(', ')}.`);
            } else {
                insightLines.push('- No missing values detected.');
            }

            const topNumeric = dataSummary.columns
                .filter(col => col.type === 'numeric')
                .sort((a, b) => (a.missingCount - b.missingCount))
                .slice(0, 3)
                .map(col => `${col.name} (mean ${col.mean ?? 'n/a'})`);
            if (topNumeric.length) {
                insightLines.push(`- Key numeric columns: ${topNumeric.join(', ')}.`);
            }

            setAiInsights(insightLines.join('\n'));
        } catch (error) {
            toast.error('Failed to generate insights');
            console.error(error);
            setAiInsights('Failed to generate insights.');
        } finally {
            setLoadingStates(prev => ({ ...prev, insights: false }));
        }
    }, [data, dataSummary]);

    const generateRecommendations = useCallback(async () => {
        if (!data || !dataSummary) return;

        setLoadingStates(prev => ({ ...prev, recommendations: true }));

        try {
            const preprocessing = [];
            preprocessing.push(`- Consider using **train/test split, standard scaling, and one-hot encoding** for your data preprocessing.`);
            preprocessing.push(`- Check for duplicate rows and inconsistent missing value encoding (e.g., "NA", "N/A", "?").`);

            const models = [];
            if (dataSummary.columns.some(col => col.type === 'numeric')) {
                models.push('- For numeric targets, try **RandomForestRegressor** or **XGBRegressor** (if available).');
            }
            if (dataSummary.columns.some(col => col.type === 'categorical')) {
                models.push('- For classification targets, consider **RandomForestClassifier** or **LogisticRegression** with one-hot encoding.');
            }

            if (dataSummary.columns.length >= 5) {
                preprocessing.push('- Perform **PCA** or **feature selection** to reduce dimensionality for large column sets.');
            }

            setMlRecommendations({
                models: models.length ? models.join('\n') : 'No specific model recommendation available for this dataset composition.',
                preprocessing: preprocessing.join('\n'),
            });
        } catch (error) {
            toast.error('Failed to generate recommendations');
            console.error(error);
            setMlRecommendations({
                models: 'Failed to generate model recommendations.',
                preprocessing: 'Failed to generate preprocessing recommendations.',
            });
        } finally {
            setLoadingStates(prev => ({ ...prev, recommendations: false }));
        }
    }, [data, dataSummary]);

    const generateCode = useCallback(async () => {
        if (!data || !dataSummary) return;

        setLoadingStates(prev => ({ ...prev, code: true }));

        try {
            const sampleColumns = dataSummary.columns.slice(0, 4).map(c => c.name);
            const codeSnippet = `import pandas as pd\n\n# Load CSV data\ndf = pd.read_csv('your-file.csv')\n\n# Basic information\nprint(df.shape)\nprint(df.dtypes)\n\n# Handle missing values\ndf = df.dropna()\n\n# Example feature/target setup\nX = df[[${sampleColumns.map(c => `'${c}'`).join(', ')}]]\ny = df['${dataSummary.columns[0].name}']${dataSummary.columns[0]?.type === 'numeric' ? '' : ' # replace with target'}\n\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.ensemble import RandomForest${dataSummary.columns[0]?.type === 'numeric' ? 'Regressor' : 'Classifier'}\n\nX_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)\nmodel = RandomForest${dataSummary.columns[0]?.type === 'numeric' ? 'Regressor' : 'Classifier'}(n_estimators=100, random_state=42)\nmodel.fit(X_train, y_train)\nprint('score:', model.score(X_test, y_test))`;

            setPythonCode(codeSnippet);
        } catch (error) {
            toast.error('Failed to generate code');
            console.error(error);
            setPythonCode('Failed to generate Python code.');
        } finally {
            setLoadingStates(prev => ({ ...prev, code: false }));
        }
    }, [data, dataSummary]);

    const handleFileUpload = useCallback((uploadedData) => {
        setData(uploadedData);
        setAiInsights(null);
        setMlRecommendations(null);
        setPythonCode(null);
        toast.success('File uploaded successfully!');
    }, []);

    const handleAnalyze = useCallback(() => {
        setIsProcessing(true);
        generateInsights();
        generateRecommendations();
        generateCode();
        setIsProcessing(false);
    }, [generateInsights, generateRecommendations, generateCode]);

    const handleReset = useCallback(() => {
        setData(null);
        setAiInsights(null);
        setMlRecommendations(null);
        setPythonCode(null);
    }, []);

    console.log("EDAPage Render", { data, isProcessing, aiInsights });

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
                                {/* Data Preview */}
                                <DataPreview data={data} />
                            </ErrorBoundary>

                            <ErrorBoundary>
                                {/* Stats Summary */}
                                <StatsSummary data={data} />
                            </ErrorBoundary>

                            <ErrorBoundary>
                                {/* Visualizations */}
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
                                        className="flex items-center bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all font-semibold"
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
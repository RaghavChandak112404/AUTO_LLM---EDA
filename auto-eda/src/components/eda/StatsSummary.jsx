import React, { useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Hash, Type, Calendar, AlertTriangle, BarChart3, Percent } from 'lucide-react';
import { Badge } from '../ui/badge';

export default function StatsSummary({ data }) {
    const { headers, rows } = data;

    const columnStats = useMemo(() => {
        return headers.map(header => {
            const values = rows.map(row => row[header]);
            const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
            const missingCount = values.length - nonEmpty.length;
            const missingPercent = ((missingCount / values.length) * 100).toFixed(1);

            // Detect type
            const numericValues = nonEmpty.filter(v => !isNaN(parseFloat(v)) && isFinite(v));
            const isNumeric = numericValues.length > nonEmpty.length * 0.8;

            const uniqueValues = new Set(nonEmpty);
            const uniqueCount = uniqueValues.size;
            const isCategorical = !isNumeric && uniqueCount <= Math.min(20, nonEmpty.length * 0.5);

            // Check for date patterns
            const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}|^\d{2}[-/]\d{2}[-/]\d{4}/;
            const dateValues = nonEmpty.filter(v => datePattern.test(String(v)));
            const isDate = dateValues.length > nonEmpty.length * 0.8;

            let type = 'text';
            if (isNumeric) type = 'numeric';
            else if (isDate) type = 'date';
            else if (isCategorical) type = 'categorical';

            // Numeric stats
            let numericStats = null;
            if (isNumeric) {
                const nums = numericValues.map(v => parseFloat(v)).sort((a, b) => a - b);
                const sum = nums.reduce((a, b) => a + b, 0);
                const mean = sum / nums.length;
                const variance = nums.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nums.length;
                const std = Math.sqrt(variance);
                const median = nums.length % 2 === 0
                    ? (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2
                    : nums[Math.floor(nums.length / 2)];

                numericStats = {
                    min: nums[0],
                    max: nums[nums.length - 1],
                    mean: mean,
                    median: median,
                    std: std
                };
            }

            return {
                name: header,
                type,
                uniqueCount,
                missingCount,
                missingPercent,
                numericStats,
                topValues: isCategorical ? Array.from(uniqueValues).slice(0, 5) : null
            };
        });
    }, [headers, rows]);

    const typeIcons = {
        numeric: Hash,
        categorical: BarChart3,
        date: Calendar,
        text: Type
    };

    const typeColors = {
        numeric: 'from-blue-500 to-blue-600',
        categorical: 'from-violet-500 to-violet-600',
        date: 'from-amber-500 to-amber-600',
        text: 'from-slate-500 to-slate-600'
    };

    const typeBadgeColors = {
        numeric: 'bg-blue-100 text-blue-700',
        categorical: 'bg-violet-100 text-violet-700',
        date: 'bg-amber-100 text-amber-700',
        text: 'bg-slate-100 text-slate-700'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">Column Statistics</h3>
                <div className="flex items-center gap-2">
                    {['numeric', 'categorical', 'date', 'text'].map(type => {
                        const count = columnStats.filter(c => c.type === type).length;
                        if (count === 0) return null;
                        return (
                            <Badge key={type} className={typeBadgeColors[type]}>
                                {count} {type}
                            </Badge>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {columnStats.map((col, index) => {
                    const Icon = typeIcons[col.type];
                    return (
                        <motion.div
                            key={col.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${typeColors[col.type]} flex items-center justify-center shadow-sm`}>
                                        <Icon className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-800 text-sm truncate max-w-[120px]" title={col.name}>
                                            {col.name}
                                        </h4>
                                        <p className="text-xs text-slate-400 capitalize">{col.type}</p>
                                    </div>
                                </div>
                                {col.missingCount > 0 && (
                                    <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="text-xs font-medium">{col.missingPercent}%</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Unique values</span>
                                    <span className="font-medium text-slate-700">{col.uniqueCount.toLocaleString()}</span>
                                </div>

                                {col.numericStats && (
                                    <>
                                        <div className="h-px bg-slate-100" />
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Min</span>
                                                <span className="font-medium text-slate-700">{col.numericStats.min.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Max</span>
                                                <span className="font-medium text-slate-700">{col.numericStats.max.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Mean</span>
                                                <span className="font-medium text-slate-700">{col.numericStats.mean.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Std</span>
                                                <span className="font-medium text-slate-700">{col.numericStats.std.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {col.topValues && (
                                    <>
                                        <div className="h-px bg-slate-100" />
                                        <div className="flex flex-wrap gap-1">
                                            {col.topValues.map((val, i) => (
                                                <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full truncate max-w-[80px]" title={val}>
                                                    {val}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}
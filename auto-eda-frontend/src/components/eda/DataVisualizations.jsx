import React, { useMemo, useState } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon, Grid3X3, AlertTriangle, FileQuestion } from "lucide-react";

export default function DataVisualizations({ data }) {
  const COLORS = [
    "#8b5cf6",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
  ];
  const { headers, rows } = data;

  const { numericColumns, categoricalColumns } = useMemo(() => {
    const numeric = [];
    const categorical = [];

    headers.forEach((header) => {
      const values = rows.map((row) => row[header]).filter((v) => v !== "" && v != null);
      const numericValues = values.filter((v) => !isNaN(parseFloat(v)));
      const isNumeric = numericValues.length > values.length * 0.8;
      const uniqueValues = new Set(values);

      if (isNumeric) numeric.push(header);
      else if (uniqueValues.size <= 20) categorical.push(header);
    });

    return { numericColumns: numeric, categoricalColumns: categorical };
  }, [headers, rows]);

  const [activeTab, setActiveTab] = useState("distribution");
  const [selectedNumeric, setSelectedNumeric] = useState(numericColumns[0] || "");
  const [selectedCategorical, setSelectedCategorical] = useState(categoricalColumns[0] || "");

  const histogramData = useMemo(() => {
    if (!selectedNumeric) return [];

    const values = rows
      .map((row) => parseFloat(row[selectedNumeric]))
      .filter((v) => !isNaN(v));

    if (!values.length) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = 10;
    const size = (max - min) / bins;

    const data = Array.from({ length: bins }, (_, i) => ({
      range: (min + i * size).toFixed(1),
      count: 0,
    }));

    values.forEach((v) => {
      const idx = Math.min(Math.floor((v - min) / size), bins - 1);
      data[idx].count++;
    });

    return data;
  }, [rows, selectedNumeric]);

  const categoricalData = useMemo(() => {
    if (!selectedCategorical) return [];

    const counts = {};
    rows.forEach((row) => {
      const val = row[selectedCategorical] || "N/A";
      counts[val] = (counts[val] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .slice(0, 10);
  }, [rows, selectedCategorical]);

  const correlationMatrix = useMemo(() => {
    if (numericColumns.length < 2) return [];

    const calculatePearson = (validPairs) => {
      const n = validPairs.length;
      if (n === 0) return 0;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (let i = 0; i < n; i++) {
        const { x, y } = validPairs[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
      }
      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      return denominator === 0 ? 0 : numerator / denominator;
    };

    const matrix = [];
    for (let current of numericColumns) {
      const row = { name: current };
      for (let other of numericColumns) {
        const validPairs = rows
          .map((r) => ({
            x: parseFloat(r[current]),
            y: parseFloat(r[other]),
          }))
          .filter((p) => !isNaN(p.x) && !isNaN(p.y));

        row[other] = calculatePearson(validPairs);
      }
      matrix.push(row);
    }
    return matrix;
  }, [rows, numericColumns]);

  const missingData = useMemo(() => {
    return headers.map(header => {
      let missingCount = 0;
      rows.forEach(row => {
        const v = row[header];
        if (v === "" || v == null || v === "N/A" || typeof v === "undefined" || (typeof v === "number" && isNaN(v))) {
          missingCount++;
        }
      });
      return {
        name: header,
        percentage: rows.length ? parseFloat(((missingCount / rows.length) * 100).toFixed(2)) : 0,
        count: missingCount
      };
    }).filter(col => col.percentage > 0).sort((a, b) => b.percentage - a.percentage);
  }, [headers, rows]);

  const outliersData = useMemo(() => {
    if (!numericColumns.length) return [];
    return numericColumns.map(col => {
      const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      if (!values.length) return { name: col, outliers: 0 };

      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) return { name: col, outliers: 0 };

      let outlierCount = 0;
      values.forEach(v => {
        const z = Math.abs((v - mean) / stdDev);
        if (z > 3) outlierCount++;
      });

      return { name: col, outliers: outlierCount };
    }).filter(col => col.outliers > 0).sort((a, b) => b.outliers - a.outliers);
  }, [rows, numericColumns]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 p-6"
    >
      <h3 className="text-lg font-semibold mb-4">Data Visualizations</h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("distribution")}
          className={`px-4 py-2 rounded ${activeTab === "distribution" ? "bg-violet-600 text-white" : "bg-slate-200"
            }`}
        >
          <BarChart3 className="inline w-4 h-4 mr-1" />
          Distribution
        </button>

        <button
          onClick={() => setActiveTab("categorical")}
          className={`px-4 py-2 rounded ${activeTab === "categorical" ? "bg-violet-600 text-white" : "bg-slate-200"
            }`}
        >
          <PieChartIcon className="inline w-4 h-4 mr-1" />
          Categories
        </button>

        {numericColumns.length >= 2 && (
          <button
            onClick={() => setActiveTab("correlation")}
            className={`px-4 py-2 rounded ${activeTab === "correlation" ? "bg-violet-600 text-white" : "bg-slate-200"
              }`}
          >
            <Grid3X3 className="inline w-4 h-4 mr-1" />
            Correlation
          </button>
        )}

        <button
          onClick={() => setActiveTab("missing")}
          className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === "missing" ? "bg-violet-600 text-white" : "bg-slate-200"
            }`}
        >
          <FileQuestion className="inline w-4 h-4 mr-1" />
          Missing Data
        </button>

        {numericColumns.length > 0 && (
          <button
            onClick={() => setActiveTab("outliers")}
            className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === "outliers" ? "bg-violet-600 text-white" : "bg-slate-200"
              }`}
          >
            <AlertTriangle className="inline w-4 h-4 mr-1" />
            Outliers
          </button>
        )}
      </div>

      {/* Distribution */}
      {activeTab === "distribution" && (
        <>
          <select
            value={selectedNumeric}
            onChange={(e) => setSelectedNumeric(e.target.value)}
            className="mb-4 border p-2 rounded"
          >
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>

          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={histogramData}>
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Categorical */}
      {activeTab === "categorical" && (
        <>
          <select
            value={selectedCategorical}
            onChange={(e) => setSelectedCategorical(e.target.value)}
            className="mb-4 border p-2 rounded"
          >
            {categoricalColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
            <ResponsiveContainer>
              <BarChart data={categoricalData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>

            <ResponsiveContainer>
              <PieChart>
                <Pie data={categoricalData} dataKey="value" outerRadius={80}>
                  {categoricalData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Correlation */}
      {activeTab === "correlation" && (
        <div className="overflow-auto border rounded-lg max-h-96">
          <table className="w-full text-sm text-center border-collapse">
            <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
              <tr>
                <th className="p-2 border"></th>
                {numericColumns.map((col) => (
                  <th key={col} className="p-2 border text-xs font-semibold whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlationMatrix.map((row) => (
                <tr key={row.name}>
                  <td className="p-2 border font-semibold text-xs text-left sticky left-0 bg-slate-50 z-0 whitespace-nowrap shadow-sm">
                    {row.name}
                  </td>
                  {numericColumns.map((col) => {
                    const val = row[col];
                    const alpha = Math.min(Math.abs(val), 1);
                    // Blue for positive, Red for negative
                    const color = val > 0
                      ? `rgba(59, 130, 246, ${alpha})`
                      : `rgba(239, 68, 68, ${alpha})`;
                    const textColor = alpha > 0.5 ? "white" : "black";

                    return (
                      <td
                        key={col}
                        className="p-3 border text-xs transition-colors hover:brightness-110 cursor-help"
                        style={{ backgroundColor: color, color: textColor }}
                        title={`${row.name} ↔ ${col}\nCorrelation: ${val.toFixed(4)}`}
                      >
                        {val.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Missing Data */}
      {activeTab === "missing" && (
        <div className="h-64 flex flex-col items-center justify-center">
          {missingData.length === 0 ? (
            <div className="text-slate-500 text-lg flex items-center">
              <span className="text-2xl mr-2">🎉</span> No missing values found in any column!
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={missingData} layout="vertical" margin={{ left: 40, right: 20 }}>
                <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value, name, props) => [`${value}% (${props.payload.count} rows)`, "Missing"]} />
                <Bar dataKey="percentage" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Outliers */}
      {activeTab === "outliers" && (
        <div className="h-64 flex flex-col items-center justify-center">
          {outliersData.length === 0 ? (
            <div className="text-slate-500 text-lg flex items-center">
              <span className="text-2xl mr-2">🌟</span> No extreme outliers (Z &gt; 3) found in numeric columns!
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={outliersData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [value, "Outliers"]} />
                <Bar dataKey="outliers" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </motion.div>
  );
}

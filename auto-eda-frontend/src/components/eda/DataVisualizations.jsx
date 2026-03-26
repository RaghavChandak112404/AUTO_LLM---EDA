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
  ScatterChart,
  Scatter,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon, Grid3X3 } from "lucide-react";

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

  const scatterData = useMemo(() => {
    if (numericColumns.length < 2) return [];

    return rows
      .map((row) => ({
        x: parseFloat(row[numericColumns[0]]),
        y: parseFloat(row[numericColumns[1]]),
      }))
      .filter((d) => !isNaN(d.x) && !isNaN(d.y));
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
        <div className="h-64">
          <ResponsiveContainer>
            <ScatterChart>
              <XAxis dataKey="x" />
              <YAxis dataKey="y" />
              <Tooltip />
              <Scatter data={scatterData} fill="#8b5cf6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

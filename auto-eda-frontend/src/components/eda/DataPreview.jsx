import React, { useState } from "react";

// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";

export default function DataPreview({ data }) {
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 10;

  const { headers, rows, fileName } = data;
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const displayedRows = rows.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">{fileName}</h3>
              <p className="text-sm text-slate-500">
                {rows.length.toLocaleString()} rows × {headers.length} columns
              </p>
            </div>
          </div>

          <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
            Preview
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80">
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap border-b border-slate-100"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: rowIndex * 0.02 }}
                className="hover:bg-slate-50/50 transition-colors"
              >
                {headers.map((header, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap border-b border-slate-50 max-w-[200px] truncate"
                    title={row[header]}
                  >
                    {row[header] || (
                      <span className="text-slate-300 italic">null</span>
                    )}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {currentPage * rowsPerPage + 1} –{" "}
            {Math.min((currentPage + 1) * rowsPerPage, rows.length)} of{" "}
            {rows.length}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className={`h-8 w-8 flex items-center justify-center rounded border ${currentPage === 0
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-slate-100"
                }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-sm text-slate-600 px-2">
              {currentPage + 1} / {totalPages}
            </span>

            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={currentPage === totalPages - 1}
              className={`h-8 w-8 flex items-center justify-center rounded border ${currentPage === totalPages - 1
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-slate-100"
                }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

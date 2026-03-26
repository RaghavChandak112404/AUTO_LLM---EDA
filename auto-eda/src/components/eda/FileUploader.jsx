import React, { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";

export default function FileUploader({ onFileUpload, isProcessing }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFile = useCallback(
    (file) => {
      setError(null);

      if (!file.name.endsWith(".csv")) {
        setError("Please upload a CSV file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        console.log("FileUploader read text:", text.substring(0, 100));
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length < 2) {
          console.error("FileUploader: Not enough lines");
          setError("CSV must have headers and at least one data row");
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
        console.log("FileUploader headers:", headers);

        const rows = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          const row = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || "";
          });
          return row;
        });

        console.log("FileUploader calling onFileUpload with", { rowsCount: rows.length });
        onFileUpload({ headers, rows, fileName: file.name, rawText: text });
      };
      reader.readAsText(file);
    },
    [onFileUpload]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer
          bg-gradient-to-br from-slate-50 to-white
          ${isDragging
            ? "border-violet-500 bg-violet-50/50 scale-[1.02]"
            : "border-slate-200 hover:border-violet-300 hover:bg-slate-50/50"
          }
          ${isProcessing ? "pointer-events-none opacity-60" : ""}
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input").click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileInput}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <motion.div
            animate={{
              scale: isDragging ? 1.1 : 1,
              rotate: isDragging ? 5 : 0,
            }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center
              bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/25"
          >
            {isDragging ? (
              <FileSpreadsheet className="w-10 h-10 text-white" />
            ) : (
              <Upload className="w-10 h-10 text-white" />
            )}
          </motion.div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-slate-800">
              {isDragging ? "Drop your file here" : "Upload your CSV file"}
            </h3>
            <p className="text-slate-500 text-sm">
              Drag and drop or click to browse
            </p>
            <p className="text-slate-400 text-xs">
              Maximum file size: 10MB
            </p>
          </div>
        </div>

        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-violet-500/5 rounded-2xl pointer-events-none"
            />
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setError(null);
              }}
              className="ml-auto hover:bg-red-100 p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

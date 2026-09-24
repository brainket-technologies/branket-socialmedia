"use client";

import { useState } from "react";
import { Calendar, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Calendar generated successfully!");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to generate calendar.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>

      <div className="max-w-2xl w-full z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 rounded-3xl mb-4 border border-emerald-500/20 backdrop-blur-sm">
            <Sparkles className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Brainket Social
          </h1>
          <p className="text-lg text-slate-400 font-medium">
            AI-Powered Content Calendar Automation
          </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative z-10 flex flex-col items-center gap-6">
            <p className="text-slate-300 text-center leading-relaxed">
              Click the button below to instantly generate a 30-day content calendar tailored for Brainket Technologies. This will automatically sync to your connected Google Sheet.
            </p>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`
                relative flex items-center justify-center gap-3 px-8 py-4 text-lg font-bold rounded-2xl w-full sm:w-auto transition-all duration-300
                ${loading 
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700" 
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] hover:-translate-y-1"
                }
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Generating via AI...
                </>
              ) : (
                <>
                  <Calendar className="w-6 h-6" />
                  Generate Calendar
                </>
              )}
            </button>

            {/* Status Messages */}
            {status === "success" && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-3 rounded-xl w-full justify-center border border-emerald-500/20 animate-in zoom-in duration-300">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">{message}</span>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-4 py-3 rounded-xl w-full justify-center border border-rose-500/20 animate-in zoom-in duration-300">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{message}</span>
              </div>
            )}

            {status === "success" && (
              <a 
                href="https://docs.google.com/spreadsheets/d/1_2rTY0mj3ix293Bt2gz5VMuDYL68Je8lBSFLjpWFncY/edit#gid=0"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 text-sm font-medium transition-colors"
              >
                Open Google Sheet ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

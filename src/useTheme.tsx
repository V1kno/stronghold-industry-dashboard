import { useState, useEffect } from "react";

const DARK = {
  bg: "#060b18", card: "#0d1425", border: "#1a2744", cardBorder: "#1a2744",
  accent: "#f59e0b", text: "#f1f5f9", muted: "#94a3b8", dim: "#64748b",
  blue: "#3b82f6", purple: "#a78bfa", cyan: "#06b6d4",
  green: "#22c55e", red: "#ef4444", orange: "#f97316", pink: "#ec4899",
  gold: "#fbbf24", teal: "#14b8a6",
  // AI Wins specific
  cardAlt: "#111d35", accentAlt: "#a855f7", accentGlow: "rgba(192,132,252,0.12)",
  goldGlow: "rgba(245,158,11,0.12)", textMuted: "#94a3b8", textDim: "#64748b",
  gridLine: "#1a2744", cyber: "#06b6d4", cyberGlow: "rgba(6,182,212,0.15)",
  shieldGrad1: "#7c3aed", shieldGrad2: "#c084fc",
  automate: "#ef4444", augment: "#f59e0b", humanLed: "#22c55e",
  inputBg: "#0a1128", inputBg2: "#0a1020", inputBg3: "#0a0d24", inputBg4: "#080e22",
};

const LIGHT = {
  bg: "#f8fafc", card: "#ffffff", border: "#e2e8f0", cardBorder: "#e2e8f0",
  accent: "#d97706", text: "#0f172a", muted: "#475569", dim: "#94a3b8",
  blue: "#2563eb", purple: "#7c3aed", cyan: "#0891b2",
  green: "#16a34a", red: "#dc2626", orange: "#ea580c", pink: "#db2777",
  gold: "#d97706", teal: "#0d9488",
  // AI Wins specific
  cardAlt: "#f1f5f9", accentAlt: "#7c3aed", accentGlow: "rgba(124,58,237,0.08)",
  goldGlow: "rgba(217,119,6,0.08)", textMuted: "#475569", textDim: "#94a3b8",
  gridLine: "#e2e8f0", cyber: "#0891b2", cyberGlow: "rgba(8,145,178,0.1)",
  shieldGrad1: "#7c3aed", shieldGrad2: "#a78bfa",
  automate: "#dc2626", augment: "#d97706", humanLed: "#16a34a",
  inputBg: "#f1f5f9", inputBg2: "#f1f5f9", inputBg3: "#f1f5f9", inputBg4: "#f1f5f9",
};

export type ThemeColors = typeof DARK;

export function useTheme() {
  const [mode, setMode] = useState<"dark" | "light">(() => {
    try {
      return (localStorage.getItem("sd_theme") as "dark" | "light") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try { localStorage.setItem("sd_theme", mode); } catch {}
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const toggle = () => setMode(m => m === "dark" ? "light" : "dark");
  const colors = mode === "dark" ? DARK : LIGHT;

  return { mode, toggle, colors };
}

export function ThemeToggle({ mode, toggle }: { mode: string; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 36, height: 36, borderRadius: 10,
        border: `1px solid ${mode === "dark" ? "#1a2744" : "#e2e8f0"}`,
        background: mode === "dark" ? "#0d1425" : "#ffffff",
        color: mode === "dark" ? "#f59e0b" : "#7c3aed",
        fontSize: 18, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.3s ease",
      }}
    >
      {mode === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

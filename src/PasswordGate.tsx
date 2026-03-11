import React, { useState, useEffect } from "react";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const token = window.sessionStorage.getItem("sd_auth");
    if (token === "authenticated") {
      setAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleSubmit = async () => {
    if (!password.trim()) return;
    setChecking(true);
    setError("");
    try {
      const resp = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await resp.json();
      if (data.success) {
        window.sessionStorage.setItem("sd_auth", "authenticated");
        setAuthenticated(true);
      } else {
        setError("Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Connection error. Try again.");
    }
    setChecking(false);
  };

  if (loading) return null;
  if (authenticated) return <>{children}</>;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060b18",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        padding: "40px 32px",
        background: "#0d1425",
        border: "1px solid #1a2744",
        borderRadius: 20,
        textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px", fontSize: 24,
        }}>
          🔒
        </div>
        <div style={{
          fontSize: 20, fontWeight: 800, color: "#f1f5f9",
          marginBottom: 4,
        }}>
          STRONGHOLD DATA
        </div>
        <div style={{
          fontSize: 11, color: "#64748b", letterSpacing: "0.08em",
          marginBottom: 24,
        }}>
          A New Charter Technologies Operating Company
        </div>
        <div style={{
          fontSize: 14, color: "#94a3b8", marginBottom: 20,
        }}>
          Enter password to access this dashboard
        </div>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="Password"
          autoFocus
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: 12,
            border: error ? "1px solid #ef4444" : "1px solid #1a2744",
            background: "#0a1020",
            color: "#f1f5f9",
            fontSize: 16,
            outline: "none",
            textAlign: "center",
            letterSpacing: "0.15em",
            marginBottom: 12,
          }}
        />
        {error && (
          <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={checking || !password.trim()}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: checking ? "#1a2744" : "linear-gradient(135deg, #7c3aed, #06b6d4)",
            color: checking ? "#64748b" : "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: checking ? "wait" : "pointer",
          }}
        >
          {checking ? "Verifying..." : "Access Dashboard"}
        </button>
        <div style={{
          fontSize: 11, color: "#334155", marginTop: 20,
        }}>
          Contact your administrator for access
        </div>
      </div>
    </div>
  );
}
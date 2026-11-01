
"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError || !data.user) {
        throw new Error("Невалиден имейл или парола.");
      }

      const { data: admin, error: adminError } =
        await supabase
          .from("tach_admins")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();

      if (adminError) {
        await supabase.auth.signOut();
        throw new Error(
          "Грешка при проверката на администраторските права."
        );
      }

      if (!admin) {
        await supabase.auth.signOut();
        throw new Error(
          "Този профил няма администраторски права за TACH."
        );
      }

      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Възникна грешка при вход."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={{ textAlign: "center", marginBottom: 35 }}>
          <h1 style={styles.logo}>
            TACH<span style={{ color: "#d71920" }}>.</span>
          </h1>

          <p style={styles.subtitle}>
            ADMIN CONTROL PANEL
          </p>
        </div>

        <h2 style={styles.title}>
          Администраторски вход
        </h2>

        <p style={styles.description}>
          Въведи имейла и паролата си, за да управляваш
          машините, цените и снимките.
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 22 }}>
            <label htmlFor="admin-email" style={styles.label}>
              Имейл адрес
            </label>

            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              placeholder="Въведи имейл"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
              style={styles.input}
            />
          </div>

          <div style={{ marginBottom: 25 }}>
            <label htmlFor="admin-password" style={styles.label}>
              Парола
            </label>

            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="Въведи парола"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
              style={styles.input}
            />
          </div>

          {error && (
            <p role="alert" style={styles.error}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "ПРОВЕРКА..." : "ВЛЕЗ В АДМИН ПАНЕЛА"}
          </button>
        </form>

        <p style={styles.footer}>
          TACH MACHINES © 2026
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0b0d",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 470,
    background: "#171719",
    border: "1px solid #333",
    borderRadius: 18,
    padding: "42px 32px",
    boxShadow: "0 25px 70px rgba(0,0,0,0.4)",
  },

  logo: {
    fontSize: 54,
    fontWeight: 900,
    letterSpacing: 2,
    margin: 0,
  },

  subtitle: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 3,
    marginTop: 8,
  },

  title: {
    fontSize: 25,
    fontWeight: 800,
    marginBottom: 12,
  },

  description: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 1.7,
    marginBottom: 30,
  },

  label: {
    display: "block",
    color: "#ccc",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 9,
  },

  input: {
    width: "100%",
    padding: "15px",
    background: "#101012",
    border: "1px solid #444",
    borderRadius: 9,
    color: "#fff",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },

  button: {
    width: "100%",
    padding: "16px",
    background: "#d71920",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0.5,
  },

  error: {
    color: "#ff7777",
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 20,
  },

  footer: {
    textAlign: "center",
    color: "#666",
    fontSize: 12,
    marginTop: 35,
  },
};

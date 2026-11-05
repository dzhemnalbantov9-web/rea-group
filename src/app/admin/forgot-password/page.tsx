"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo:
              window.location.origin +
              "/admin/reset-password",
          }
        );

      if (resetError) throw resetError;

      setMessage(
        "Ако имейлът е регистриран, ще получиш линк за възстановяване на паролата."
      );
    } catch {
      setError(
        "Неуспешно изпращане. Опитай отново по-късно."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0b0b0d",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }}>
      <div style={{
        width: "100%",
        maxWidth: 440,
        background: "#171719",
        border: "1px solid #333",
        borderRadius: 18,
        padding: 32
      }}>
        <h1 style={{ textAlign: "center" }}>
          REA GROUP
        </h1>

        <h2>Възстановяване на парола</h2>

        <p style={{ color: "#aaa" }}>
          Въведи имейла на администраторския си профил.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Имейл адрес"
            style={{
              width: "100%",
              padding: 14,
              marginBottom: 16,
              background: "#101012",
              color: "#fff",
              border: "1px solid #444",
              borderRadius: 8,
              boxSizing: "border-box"
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 15,
              background: "#d71920",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "wait" : "pointer"
            }}
          >
            {loading ? "ИЗПРАЩАНЕ..." : "ИЗПРАТИ ЛИНК"}
          </button>
        </form>

        {message && (
          <p role="status" style={{ color: "#80d6a0" }}>
            {message}
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: "#ff7777" }}>
            {error}
          </p>
        )}

        <p style={{ marginTop: 25 }}>
          <a
            href="/admin/login"
            style={{ color: "#ff7777" }}
          >
            Обратно към входа
          </a>
        </p>
      </div>
    </main>
  );
}

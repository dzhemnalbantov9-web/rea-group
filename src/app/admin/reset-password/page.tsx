"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function checkRecovery() {
      try {
        const params = new URLSearchParams(
          window.location.search
        );

        const code = params.get("code");

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;

          window.history.replaceState(
            {},
            "",
            "/admin/reset-password"
          );

          if (active) setReady(true);
          return;
        }

        const hash = new URLSearchParams(
          window.location.hash.substring(1)
        );

        if (hash.get("type") === "recovery") {
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");

          if (!accessToken || !refreshToken) {
            throw new Error("Невалиден линк.");
          }

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          window.history.replaceState(
            {},
            "",
            "/admin/reset-password"
          );

          if (active) setReady(true);
          return;
        }

        if (active) {
          setError(
            "Отвори страницата чрез линка за възстановяване, изпратен на имейла ти."
          );
        }
      } catch {
        if (active) {
          setError(
            "Линкът е невалиден или изтекъл. Заяви нов."
          );
        }
      }
    }

    void checkRecovery();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!ready || loading) return;

    if (password.length < 8) {
      setError("Паролата трябва да е поне 8 символа.");
      return;
    }

    if (password !== confirm) {
      setError("Двете пароли не съвпадат.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) throw updateError;

      await supabase.auth.signOut();

      setSuccess(
        "Паролата е сменена успешно! Вече можеш да влезеш."
      );

      setReady(false);
      setPassword("");
      setConfirm("");
    } catch {
      setError(
        "Неуспешна смяна на паролата. Заяви нов линк."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: 14,
    marginBottom: 16,
    background: "#101012",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 8,
    boxSizing: "border-box" as const,
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0b0b0d",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 440,
        background: "#171719",
        border: "1px solid #333",
        borderRadius: 18,
        padding: 32,
      }}>
        <h1 style={{ textAlign: "center" }}>
          REA GROUP
        </h1>

        <h2>Нова парола</h2>

        {ready && !success && (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="Нова парола"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Повтори новата парола"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={inputStyle}
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
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "ЗАПАЗВАНЕ..." : "СМЕНИ ПАРОЛАТА"}
            </button>
          </form>
        )}

        {!ready && !error && !success && (
          <p>Проверка на линка...</p>
        )}

        {error && (
          <p role="alert" style={{ color: "#ff7777" }}>
            {error}
          </p>
        )}

        {success && (
          <p role="status" style={{ color: "#80d6a0" }}>
            {success}
          </p>
        )}

        <p style={{ marginTop: 25 }}>
          <a
            href="/admin/login"
            style={{ color: "#ff7777" }}
          >
            Към администраторския вход
          </a>
        </p>

        <p>
          <a
            href="/admin/forgot-password"
            style={{ color: "#aaa" }}
          >
            Заяви нов линк
          </a>
        </p>
      </div>
    </main>
  );
}

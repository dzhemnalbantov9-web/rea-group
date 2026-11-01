
"use client";

import { useState } from "react";

const photos = Array.from({ length: 66 }, (_, i) => {
  const number = String(i + 1).padStart(2, "0");
  return `/products/tach-photo-${number}.jpg`;
});

export default function MachineGallery() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <section
      id="machine-gallery"
      style={{
        padding: "70px 5%",
        background: "#101010",
        color: "white",
      }}
    >
      <p style={{ color: "#e53935", fontWeight: 700 }}>
        TACH / ПРОДУКТОВА ГАЛЕРИЯ
      </p>

      <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)" }}>
        ПРОФЕСИОНАЛНА ТЕХНИКА
      </h2>

      <p style={{ color: "#aaa", marginBottom: 30 }}>
        Разгледайте нашата селекция от машини и оборудване.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 18,
        }}
      >
        {photos.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setSelected(src)}
            style={{
              background: "#1b1b1b",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 12,
              cursor: "pointer",
              color: "white",
              textAlign: "left",
            }}
          >
            <img
              src={src}
              alt={`Машина TACH - снимка ${index + 1}`}
              loading="lazy"
              style={{
                width: "100%",
                height: 210,
                objectFit: "contain",
                background: "#fff",
                borderRadius: 8,
              }}
            />

            <p style={{ marginTop: 12, fontWeight: 600 }}>
              Машина №{String(index + 1).padStart(2, "0")}
            </p>

            <span style={{ color: "#e53935", fontSize: 13 }}>
              Виж снимката →
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.94)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 25,
            cursor: "pointer",
          }}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Затвори"
            style={{
              position: "absolute",
              top: 20,
              right: 25,
              color: "white",
              fontSize: 36,
              background: "transparent",
              border: 0,
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <img
            src={selected}
            alt="Увеличена снимка на машина"
            style={{
              maxWidth: "95%",
              maxHeight: "90vh",
              objectFit: "contain",
            }}
          />
        </div>
      )}
    </section>
  );
}

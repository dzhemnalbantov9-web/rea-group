
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Product = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number | null;
  currency: string;
  price_on_request: boolean;
  in_stock: boolean;
  is_active: boolean;
  images: string[];
};

type ProductForm = {
  name: string;
  category: string;
  description: string;
  price: string;
  price_on_request: boolean;
  in_stock: boolean;
};

type GalleryItem =
  | { key: string; kind: "saved"; url: string }
  | { key: string; kind: "new"; file: File; url: string };

const RED = "#d71920";
const MAX_IMAGES = 15;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const panel: CSSProperties = {
  background: "#171719",
  border: "1px solid #353538",
  borderRadius: 16,
  padding: 22,
};

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  background: "#101012",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: 9,
  fontSize: 15,
  boxSizing: "border-box",
};

const buttonStyle: CSSProperties = {
  background: RED,
  color: "#fff",
  border: 0,
  borderRadius: 9,
  padding: "12px 17px",
  fontWeight: 800,
  cursor: "pointer",
};

const smallButton: CSSProperties = {
  ...buttonStyle,
  background: "#38383d",
  padding: "8px 10px",
  fontSize: 12,
};

const labelStyle: CSSProperties = {
  display: "block",
  color: "#ccc",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
};

function emptyForm(): ProductForm {
  return {
    name: "",
    category: "",
    description: "",
    price: "",
    price_on_request: true,
    in_stock: true,
  };
}

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Възникна неочаквана грешка.";
}

function parsePrice(form: ProductForm): number | null {
  const raw = form.price.trim().replace(",", ".");

  if (!raw) {
    if (!form.price_on_request) {
      throw new Error(
        "Въведи цена или избери „Цена при запитване“."
      );
    }
    return null;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(
      "Цената трябва да има максимум 2 цифри след запетаята."
    );
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value > 9999999999.99) {
    throw new Error("Невалидна цена.");
  }

  return value;
}

function Field({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 19 }}>
      <label style={labelStyle}>{title}</label>
      {children}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [accessError, setAccessError] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState<"add" | "edit" | null>(
    null
  );
  const [editingId, setEditingId] = useState<number | null>(
    null
  );
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  const [localPaths, setLocalPaths] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(
    null
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const busy = saving || actionId !== null;

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const supabase = createClient();
        const { data, error: authError } =
          await supabase.auth.getUser();

        if (!active) return;

        if (authError || !data.user) {
          router.replace("/admin/login");
          return;
        }

        const { data: admin, error: adminError } =
          await supabase
            .from("tach_admins")
            .select("user_id")
            .eq("user_id", data.user.id)
            .maybeSingle();

        if (!active) return;

        if (adminError) {
          setAccessError(
            "Грешка при проверка на администраторския достъп."
          );
        } else {
          setAuthorized(Boolean(admin));
        }
      } catch {
        if (active) {
          setAccessError("Неуспешна проверка на достъпа.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void check();

    return () => {
      active = false;
    };
  }, [router]);

  async function token() {
    const supabase = createClient();
    const { data, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !data.session?.access_token) {
      throw new Error("Сесията е изтекла. Влез отново.");
    }

    return data.session.access_token;
  }

  async function api(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: unknown
  ) {
    const accessToken = await token();

    const response = await fetch("/api/admin/products", {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Грешка при заявката.");
    }

    return result;
  }

  async function loadProducts() {
    if (loadingProducts || busy) return;

    setLoadingProducts(true);
    setError("");

    try {
      const result = await api("GET");
      setProducts(
        Array.isArray(result.products) ? result.products : []
      );
      setLoaded(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoadingProducts(false);
    }
  }

  function clearGallery() {
    setGallery((previous) => {
      previous.forEach((item) => {
        if (item.kind === "new") {
          URL.revokeObjectURL(item.url);
        }
      });
      return [];
    });
  }

  function openAdd() {
    if (busy) return;

    clearGallery();
    setForm(emptyForm());
    setLocalPaths("");
    setEditingId(null);
    setError("");
    setSuccess("");
    setModal("add");
  }

  function openEdit(product: Product) {
    if (busy) return;

    clearGallery();

    setForm({
      name: product.name,
      category: product.category,
      description: product.description || "",
      price:
        product.price === null ? "" : String(product.price),
      price_on_request: product.price_on_request,
      in_stock: product.in_stock,
    });

    setGallery(
      (product.images || []).map((url, index) => ({
        key: `saved-${index}-${url}`,
        kind: "saved" as const,
        url,
      }))
    );

    setLocalPaths("");
    setEditingId(product.id);
    setError("");
    setSuccess("");
    setModal("edit");
  }

  function closeModal() {
    if (saving) return;

    clearGallery();
    setModal(null);
    setEditingId(null);
    setError("");
  }

  function updateForm<K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length || saving) return;

    const invalid = files.find(
      (file) =>
        !ALLOWED.includes(file.type) ||
        file.size === 0 ||
        file.size > MAX_SIZE
    );

    if (invalid) {
      setError(
        `Невалидна снимка: ${invalid.name}. Използвай JPG, PNG или WEBP до 5 MB.`
      );
      return;
    }

    const pathCount =
      modal === "add"
        ? localPaths.split(/\r?\n/).filter((p) => p.trim()).length
        : 0;

    if (gallery.length + files.length + pathCount > MAX_IMAGES) {
      setError("Максимум 15 снимки на машина.");
      return;
    }

    const additions: GalleryItem[] = files.map((file) => ({
      key: `new-${crypto.randomUUID()}`,
      kind: "new",
      file,
      url: URL.createObjectURL(file),
    }));

    setGallery((previous) => [...previous, ...additions]);
    setError("");
  }

  function removeImage(key: string) {
    if (saving) return;

    setGallery((previous) => {
      const target = previous.find((item) => item.key === key);

      if (target?.kind === "new") {
        URL.revokeObjectURL(target.url);
      }

      return previous.filter((item) => item.key !== key);
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    if (saving) return;

    setGallery((previous) => {
      const target = index + direction;

      if (target < 0 || target >= previous.length) {
        return previous;
      }

      const copy = [...previous];
      [copy[index], copy[target]] = [
        copy[target],
        copy[index],
      ];

      return copy;
    });
  }

  function makePrimary(index: number) {
    if (saving || index === 0) return;

    setGallery((previous) => {
      const copy = [...previous];
      const [chosen] = copy.splice(index, 1);
      copy.unshift(chosen);
      return copy;
    });
  }

  async function uploadFiles(
    files: File[],
    accessToken: string
  ): Promise<string[]> {
    if (!files.length) return [];

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    setUploading(true);

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Неуспешно качване на снимките."
        );
      }

      if (
        !Array.isArray(result.images) ||
        result.images.length !== files.length ||
        !result.images.every(
          (value: unknown) => typeof value === "string"
        )
      ) {
        throw new Error(
          "Сървърът върна невалиден списък със снимки."
        );
      }

      return result.images;
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!modal || saving) return;

    setError("");
    setSuccess("");

    let uploaded = false;

    try {
      const name = form.name.trim();
      const category = form.category.trim();

      if (
        !name ||
        name.length > 200 ||
        !category ||
        category.length > 100
      ) {
        throw new Error("Въведи валидно име и категория.");
      }

      if (form.description.length > 10000) {
        throw new Error("Описанието е прекалено дълго.");
      }

      const price = parsePrice(form);
      const isAdd = modal === "add";

      if (!isAdd && editingId === null) {
        throw new Error("Не е избрана машина за редактиране.");
      }

      const paths = isAdd
        ? localPaths
            .split(/\r?\n/)
            .map((path) => path.trim())
            .filter(Boolean)
        : [];

      const pathPattern =
        /^\/products\/[a-zA-Z0-9._/-]+\.(jpg|jpeg|png|webp)$/i;

      if (
        paths.some(
          (path) =>
            path.length > 500 ||
            path.includes("..") ||
            !pathPattern.test(path)
        )
      ) {
        throw new Error(
          "Локалните снимки трябва да са във формат /products/ime.jpg"
        );
      }

      if (paths.length + gallery.length > MAX_IMAGES) {
        throw new Error("Максимум 15 снимки на машина.");
      }

      const newItems = gallery.filter(
        (item): item is Extract<GalleryItem, { kind: "new" }> =>
          item.kind === "new"
      );

      setSaving(true);

      const accessToken = await token();

      const uploadedUrls = await uploadFiles(
        newItems.map((item) => item.file),
        accessToken
      );

      uploaded = uploadedUrls.length > 0;

      const uploadedByKey = new Map(
        newItems.map((item, index) => [
          item.key,
          uploadedUrls[index],
        ])
      );

      const orderedImages = gallery.map((item) =>
        item.kind === "saved"
          ? item.url
          : uploadedByKey.get(item.key) || ""
      );

      const images = isAdd
        ? [...paths, ...orderedImages]
        : orderedImages;

      if (
        images.some((url) => !url) ||
        new Set(images).size !== images.length
      ) {
        throw new Error(
          "Списъкът със снимки съдържа невалидни или повтарящи се записи."
        );
      }

      const payload = {
        ...(!isAdd ? { id: editingId } : {}),
        name,
        category,
        description: form.description,
        price,
        price_on_request: form.price_on_request,
        in_stock: form.in_stock,
        images,
      };

      const result = await api(
        isAdd ? "POST" : "PATCH",
        payload
      );

      const saved = result.product as Product;

      if (isAdd) {
        setProducts((previous) => [...previous, saved]);
        setLoaded(true);
        setSearch("");
      } else {
        setProducts((previous) =>
          previous.map((item) =>
            item.id === saved.id ? saved : item
          )
        );
      }

      clearGallery();
      setModal(null);
      setEditingId(null);

      setSuccess(
        isAdd
          ? `Машината „${saved.name}“ е добавена успешно!`
          : `Промените по „${saved.name}“ са запазени успешно!`
      );
    } catch (err) {
      const message = errorText(err);

      setError(
        uploaded
          ? `${message} Снимките са качени, но записът не е завършен. При повторен опит може да се качат отново.`
          : message
      );
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function toggleVisibility(product: Product) {
    if (busy) return;

    setActionId(product.id);
    setError("");
    setSuccess("");

    try {
      const result = await api("PATCH", {
        id: product.id,
        is_active: !product.is_active,
      });

      const updated = result.product as Product;

      setProducts((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      setSuccess(
        updated.is_active
          ? `Машината „${updated.name}“ вече се показва в сайта.`
          : `Машината „${updated.name}“ е скрита от сайта.`
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setActionId(null);
    }
  }

  async function deleteProduct() {
    if (!deleteTarget || busy) return;

    const product = deleteTarget;

    setActionId(product.id);
    setError("");
    setSuccess("");

    try {
      await api("DELETE", { id: product.id });

      setProducts((previous) =>
        previous.filter((item) => item.id !== product.id)
      );

      setDeleteTarget(null);
      setSuccess(
        `Машината „${product.name}“ е изтрита успешно.`
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setActionId(null);
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const filtered = useMemo(
    () =>
      products.filter((product) =>
        `${product.name} ${product.category}`
          .toLocaleLowerCase("bg")
          .includes(search.trim().toLocaleLowerCase("bg"))
      ),
    [products, search]
  );

  const activeCount = products.filter(
    (product) => product.is_active
  ).length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b0d",
        color: "#fff",
        padding: "35px 20px 90px",
      }}
    >
      {checking ? (
        <p>Проверка на администраторския достъп...</p>
      ) : !authorized ? (
        <div style={{ maxWidth: 800, margin: "auto" }}>
          <h1>Достъпът е отказан</h1>
          <p style={{ color: "#aaa", marginTop: 15 }}>
            {accessError || "Нямате права за TACH ADMIN."}
          </p>
          <button
            type="button"
            onClick={logout}
            style={{ ...buttonStyle, marginTop: 20 }}
          >
            КЪМ ВХОДА
          </button>
        </div>
      ) : (
        <div style={{ maxWidth: 1400, margin: "auto" }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 38,
                  fontWeight: 900,
                  letterSpacing: 1,
                }}
              >
                TACH<span style={{ color: RED }}>.</span> ADMIN
              </h1>
              <p style={{ color: "#aaa", marginTop: 6 }}>
                CONTROL PANEL
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              style={buttonStyle}
            >
              ИЗХОД
            </button>
          </header>

          <section style={{ marginTop: 55 }}>
            <h2 style={{ fontSize: 29, fontWeight: 800 }}>
              Управление на машини
            </h2>
            <p
              style={{
                color: "#aaa",
                marginTop: 12,
                marginBottom: 25,
              }}
            >
              Добавяй машини, управлявай снимки, цени,
              наличности и видимост.
            </p>

            <div style={panel}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={busy}
                  onClick={openAdd}
                >
                  + ДОБАВИ НОВА МАШИНА
                </button>

                <button
                  type="button"
                  style={{
                    ...buttonStyle,
                    background: "#38383d",
                  }}
                  disabled={busy || loadingProducts}
                  onClick={() => void loadProducts()}
                >
                  {loadingProducts
                    ? "ЗАРЕЖДАНЕ..."
                    : loaded
                      ? "ОБНОВИ СПИСЪКА"
                      : "ЗАРЕДИ МАШИНИ"}
                </button>
              </div>
            </div>
          </section>

          {success && (
            <p
              role="status"
              style={{
                color: "#75e3a2",
                marginTop: 22,
                fontWeight: 700,
              }}
            >
              ✓ {success}
            </p>
          )}

          {error && !modal && (
            <p
              role="alert"
              style={{
                color: "#ff7777",
                marginTop: 22,
                fontWeight: 700,
              }}
            >
              {error}
            </p>
          )}

          {loaded && (
            <section style={{ marginTop: 38 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 15,
                  flexWrap: "wrap",
                  marginBottom: 22,
                }}
              >
                <h2 style={{ fontSize: 26, fontWeight: 800 }}>
                  Машини в каталога
                </h2>

                <div
                  style={{
                    display: "flex",
                    gap: 9,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ ...smallButton, background: RED }}>
                    ОБЩО: {products.length}
                  </span>
                  <span
                    style={{
                      ...smallButton,
                      background: "#236b43",
                    }}
                  >
                    ВИДИМИ: {activeCount}
                  </span>
                  <span style={smallButton}>
                    СКРИТИ: {products.length - activeCount}
                  </span>
                </div>
              </div>

              <input
                type="search"
                placeholder="Търси машина или категория..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                style={{
                  ...fieldStyle,
                  maxWidth: 470,
                  marginBottom: 28,
                }}
              />

              {filtered.length === 0 ? (
                <div style={panel}>Няма намерени машини.</div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                    gap: 20,
                  }}
                >
                  {filtered.map((product) => (
                    <article
                      key={product.id}
                      style={{
                        ...panel,
                        padding: 17,
                        opacity: product.is_active ? 1 : 0.75,
                        alignSelf: "start",
                      }}
                    >
                      <div
                        style={{
                          height: 210,
                          background: "#fff",
                          borderRadius: 10,
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <span style={{ color: "#666" }}>
                            Няма снимка
                          </span>
                        )}
                      </div>

                      <div style={{ padding: "19px 3px 3px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              color: RED,
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {product.category}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              background: product.is_active
                                ? "#236b43"
                                : "#444",
                              padding: "7px 9px",
                              borderRadius: 6,
                            }}
                          >
                            {product.is_active
                              ? "ВИДИМА"
                              : "СКРИТА"}
                          </span>
                        </div>

                        <h3
                          style={{
                            fontSize: 20,
                            fontWeight: 800,
                            marginTop: 12,
                          }}
                        >
                          {product.name}
                        </h3>

                        {product.description && (
                          <p
                            style={{
                              color: "#aaa",
                              fontSize: 13,
                              lineHeight: 1.6,
                              marginTop: 12,
                            }}
                          >
                            {product.description.length > 120
                              ? `${product.description.slice(0, 120)}...`
                              : product.description}
                          </p>
                        )}

                        <div
                          style={{
                            marginTop: 20,
                            paddingTop: 17,
                            borderTop: "1px solid #333",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 19,
                              fontWeight: 800,
                            }}
                          >
                            {product.price_on_request ||
                            product.price === null
                              ? "Цена при запитване"
                              : `${Number(product.price).toFixed(2)} ${product.currency || "EUR"}`}
                          </p>

                          <p
                            style={{
                              color: product.in_stock
                                ? "#54d38a"
                                : "#ff7777",
                              marginTop: 12,
                              fontWeight: 700,
                            }}
                          >
                            {product.in_stock
                              ? "● В наличност"
                              : "● Изчерпан"}
                          </p>

                          <p
                            style={{
                              color: "#999",
                              fontSize: 12,
                              marginTop: 8,
                            }}
                          >
                            ID: {product.id} · Снимки:{" "}
                            {product.images?.length || 0}
                          </p>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openEdit(product)}
                            style={{
                              ...buttonStyle,
                              width: "100%",
                              marginTop: 20,
                            }}
                          >
                            РЕДАКТИРАЙ
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void toggleVisibility(product)
                            }
                            style={{
                              ...buttonStyle,
                              width: "100%",
                              marginTop: 9,
                              background: product.is_active
                                ? "#ad7818"
                                : "#236b43",
                            }}
                          >
                            {actionId === product.id
                              ? "ОБРАБОТКА..."
                              : product.is_active
                                ? "СКРИЙ ОТ САЙТА"
                                : "ПОКАЖИ В САЙТА"}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              setDeleteTarget(product);
                            }}
                            style={{
                              ...buttonStyle,
                              width: "100%",
                              marginTop: 9,
                              background: "#681b20",
                              border: "1px solid #b93842",
                            }}
                          >
                            ИЗТРИЙ
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {modal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(0,0,0,0.9)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: 15,
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-dialog-title"
                style={{
                  width: "100%",
                  maxWidth: 850,
                  maxHeight: "94vh",
                  overflowY: "auto",
                  background: "#18181b",
                  border: "1px solid #444",
                  borderRadius: 16,
                  padding: 25,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 15,
                    alignItems: "center",
                  }}
                >
                  <h2
                    id="product-dialog-title"
                    style={{
                      fontSize: 25,
                      fontWeight: 800,
                    }}
                  >
                    {modal === "add"
                      ? "Добавяне на нова машина"
                      : `Редактиране на машина #${editingId}`}
                  </h2>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    style={{
                      ...smallButton,
                      fontSize: 22,
                    }}
                  >
                    ×
                  </button>
                </div>

                <form
                  onSubmit={saveProduct}
                  style={{ marginTop: 28 }}
                >
                  <Field title="Име на машината">
                    <input
                      style={fieldStyle}
                      required
                      maxLength={200}
                      disabled={saving}
                      value={form.name}
                      onChange={(event) =>
                        updateForm("name", event.target.value)
                      }
                    />
                  </Field>

                  <Field title="Категория">
                    <input
                      style={fieldStyle}
                      required
                      maxLength={100}
                      disabled={saving}
                      value={form.category}
                      onChange={(event) =>
                        updateForm("category", event.target.value)
                      }
                    />
                  </Field>

                  <Field title="Описание">
                    <textarea
                      style={{
                        ...fieldStyle,
                        minHeight: 125,
                        resize: "vertical",
                      }}
                      maxLength={10000}
                      disabled={saving}
                      value={form.description}
                      onChange={(event) =>
                        updateForm(
                          "description",
                          event.target.value
                        )
                      }
                    />
                  </Field>

                  <Field title="Цена в евро">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Например: 1250.00"
                      style={fieldStyle}
                      disabled={saving}
                      value={form.price}
                      onChange={(event) =>
                        updateForm("price", event.target.value)
                      }
                    />
                  </Field>

                  <label
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      marginBottom: 18,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.price_on_request}
                      disabled={saving}
                      onChange={(event) =>
                        updateForm(
                          "price_on_request",
                          event.target.checked
                        )
                      }
                    />
                    Цена при запитване
                  </label>

                  <label
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      marginBottom: 25,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.in_stock}
                      disabled={saving}
                      onChange={(event) =>
                        updateForm(
                          "in_stock",
                          event.target.checked
                        )
                      }
                    />
                    Машината е в наличност
                  </label>

                  <div
                    style={{
                      ...panel,
                      background: "#111113",
                      marginBottom: 25,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 21,
                        fontWeight: 800,
                        marginBottom: 12,
                      }}
                    >
                      📷 Управление на снимките
                    </h3>

                    <p
                      style={{
                        color: "#aaa",
                        fontSize: 13,
                        lineHeight: 1.7,
                        marginBottom: 20,
                      }}
                    >
                      До 15 снимки, JPG, PNG или WEBP, максимум
                      5 MB всяка. Първата снимка е основната.
                      Можеш да добавяш, премахваш и пренареждаш.
                    </p>

                    <label
                      htmlFor="tach-images-upload"
                      style={{
                        ...buttonStyle,
                        display: "inline-block",
                        cursor: saving
                          ? "not-allowed"
                          : "pointer",
                      }}
                    >
                      + ДОБАВИ СНИМКИ ОТ КОМПЮТЪРА
                    </label>

                    <input
                      id="tach-images-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={saving}
                      onChange={selectImages}
                      style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        opacity: 0,
                      }}
                    />

                    <p
                      style={{
                        marginTop: 17,
                        color: "#bbb",
                        fontSize: 13,
                      }}
                    >
                      Снимки: {gallery.length} / {MAX_IMAGES}
                    </p>

                    {gallery.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(155px, 1fr))",
                          gap: 13,
                          marginTop: 20,
                        }}
                      >
                        {gallery.map((item, index) => (
                          <div
                            key={item.key}
                            style={{
                              background: "#232326",
                              border:
                                index === 0
                                  ? "2px solid #54d38a"
                                  : "1px solid #444",
                              borderRadius: 11,
                              padding: 9,
                            }}
                          >
                            <div
                              style={{
                                background: "#fff",
                                height: 120,
                                borderRadius: 7,
                                overflow: "hidden",
                              }}
                            >
                              <img
                                src={item.url}
                                alt={`Снимка ${index + 1}`}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                }}
                              />
                            </div>

                            <p
                              style={{
                                fontSize: 11,
                                marginTop: 9,
                                color:
                                  index === 0
                                    ? "#75e3a2"
                                    : "#bbb",
                                fontWeight: 800,
                              }}
                            >
                              {index === 0
                                ? "★ ОСНОВНА СНИМКА"
                                : `СНИМКА ${index + 1}`}
                            </p>

                            {item.kind === "new" && (
                              <p
                                title={item.file.name}
                                style={{
                                  color: "#aaa",
                                  fontSize: 10,
                                  overflowWrap: "anywhere",
                                  marginTop: 5,
                                }}
                              >
                                {item.file.name}
                              </p>
                            )}

                            <div
                              style={{
                                display: "flex",
                                gap: 5,
                                marginTop: 10,
                              }}
                            >
                              <button
                                type="button"
                                title="Премести наляво"
                                disabled={saving || index === 0}
                                onClick={() =>
                                  moveImage(index, -1)
                                }
                                style={{
                                  ...smallButton,
                                  flex: 1,
                                }}
                              >
                                ←
                              </button>

                              <button
                                type="button"
                                title="Премести надясно"
                                disabled={
                                  saving ||
                                  index === gallery.length - 1
                                }
                                onClick={() =>
                                  moveImage(index, 1)
                                }
                                style={{
                                  ...smallButton,
                                  flex: 1,
                                }}
                              >
                                →
                              </button>
                            </div>

                            {index > 0 && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => makePrimary(index)}
                                style={{
                                  ...smallButton,
                                  width: "100%",
                                  marginTop: 6,
                                  background: "#236b43",
                                }}
                              >
                                ★ НАПРАВИ ОСНОВНА
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                removeImage(item.key)
                              }
                              style={{
                                ...smallButton,
                                width: "100%",
                                marginTop: 6,
                                background: "#681b20",
                              }}
                            >
                              ПРЕМАХНИ
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {modal === "add" && (
                      <details style={{ marginTop: 22 }}>
                        <summary
                          style={{
                            cursor: "pointer",
                            color: "#ccc",
                            fontSize: 13,
                          }}
                        >
                          Имам снимки в public/products
                        </summary>

                        <p
                          style={{
                            color: "#aaa",
                            fontSize: 12,
                            marginTop: 12,
                          }}
                        >
                          Въведи по един път на ред.
                          Например: /products/machine.jpg
                        </p>

                        <textarea
                          style={{
                            ...fieldStyle,
                            minHeight: 100,
                            marginTop: 10,
                          }}
                          disabled={saving}
                          value={localPaths}
                          onChange={(event) =>
                            setLocalPaths(event.target.value)
                          }
                          placeholder={"/products/machine-1.jpg"}
                        />
                      </details>
                    )}
                  </div>

                  {error && (
                    <p
                      role="alert"
                      style={{
                        color: "#ff7777",
                        marginBottom: 20,
                        lineHeight: 1.6,
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        ...buttonStyle,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {uploading
                        ? "КАЧВАНЕ НА СНИМКИТЕ..."
                        : saving
                          ? "ЗАПАЗВАНЕ..."
                          : modal === "add"
                            ? "ДОБАВИ МАШИНАТА"
                            : "ЗАПАЗИ ПРОМЕНИТЕ"}
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={closeModal}
                      style={{
                        ...buttonStyle,
                        background: "#444",
                      }}
                    >
                      ОТКАЗ
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {deleteTarget && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1100,
                background: "rgba(0,0,0,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Потвърждение за изтриване"
                style={{
                  ...panel,
                  maxWidth: 500,
                  width: "100%",
                }}
              >
                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#ff7777",
                  }}
                >
                  Изтриване на машина
                </h2>

                <p
                  style={{
                    marginTop: 20,
                    lineHeight: 1.7,
                  }}
                >
                  Сигурен ли си, че искаш да изтриеш
                  машината <strong>{deleteTarget.name}</strong>?
                </p>

                <p
                  style={{
                    color: "#aaa",
                    fontSize: 13,
                    marginTop: 12,
                  }}
                >
                  Машината ще бъде премахната от базата
                  данни. Действието не може да се отмени.
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 25,
                  }}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteProduct()}
                    style={{
                      ...buttonStyle,
                      background: "#a51e28",
                    }}
                  >
                    {busy
                      ? "ИЗТРИВАНЕ..."
                      : "ДА, ИЗТРИЙ"}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleteTarget(null)}
                    style={{
                      ...buttonStyle,
                      background: "#444",
                    }}
                  >
                    ОТКАЗ
                  </button>
                </div>

                {error && (
                  <p
                    role="alert"
                    style={{
                      color: "#ff7777",
                      marginTop: 16,
                    }}
                  >
                    {error}
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type ProductUpdate = {
  name?: string;
  category?: string;
  description?: string;
  price?: number | null;
  price_on_request?: boolean;
  in_stock?: boolean;
  is_active?: boolean;
  images?: string[];
};

function reply(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function authenticateAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) return null;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) return null;

  const { data: admin, error: adminError } = await supabase
    .from("tach_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !admin) return null;

  return supabase;
}

function getAdminDb() {
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function validImagePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) {
    return false;
  }

  if (
    /^\/products\/[a-zA-Z0-9._/-]+\.(jpg|jpeg|png|webp)$/i.test(
      value
    ) &&
    !value.includes("..")
  ) {
    return true;
  }

  try {
    const imageUrl = new URL(value);
    const projectUrl = new URL(supabaseUrl);

    if (
      imageUrl.protocol !== "https:" ||
      imageUrl.origin !== projectUrl.origin ||
      imageUrl.search ||
      imageUrl.hash
    ) {
      return false;
    }

    const prefix =
      "/storage/v1/object/public/tach-products/";

    if (!imageUrl.pathname.startsWith(prefix)) {
      return false;
    }

    const filename = imageUrl.pathname.slice(prefix.length);

    return /^[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/i.test(
      filename
    );
  } catch {
    return false;
  }
}

function validImages(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 15 &&
    value.every(validImagePath)
  );
}

function validPrice(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 9999999999.99)
  );
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function onlyFields(
  input: Record<string, unknown>,
  allowed: string[]
) {
  return Object.keys(input).every((key) =>
    allowed.includes(key)
  );
}

function validId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

// ЗАРЕЖДАНЕ НА ВСИЧКИ МАШИНИ В ADMIN
export async function GET(request: NextRequest) {
  try {
    const supabase = await authenticateAdmin(request);

    if (!supabase) {
      return reply("Нямате администраторски достъп.", 403);
    }

    const { data, error } = await supabase
      .from("tach_products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("TACH GET ERROR:", error);
      return reply("Неуспешно зареждане на машините.", 500);
    }

    return NextResponse.json(
      { products: data ?? [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("TACH GET ERROR:", error);
    return reply("Вътрешна грешка.", 500);
  }
}

// РЕДАКТИРАНЕ НА МАШИНА, СНИМКИ И ВИДИМОСТ
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await authenticateAdmin(request);

    if (!supabase) {
      return reply("Нямате администраторски достъп.", 403);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return reply("Невалиден JSON.", 400);
    }

    if (!isObject(body)) {
      return reply("Невалидни данни.", 400);
    }

    const input = body;
    const id = input.id;

    if (!validId(id)) {
      return reply("Невалиден идентификатор.", 400);
    }

    if (
      !onlyFields(input, [
        "id",
        "name",
        "category",
        "description",
        "price",
        "price_on_request",
        "in_stock",
        "is_active",
        "images",
      ])
    ) {
      return reply(
        "Непозволено поле за редактиране.",
        400
      );
    }

    const updates: ProductUpdate = {};

    if ("name" in input) {
      if (
        typeof input.name !== "string" ||
        !input.name.trim() ||
        input.name.length > 200
      ) {
        return reply("Невалидно име.", 400);
      }

      updates.name = input.name.trim();
    }

    if ("category" in input) {
      if (
        typeof input.category !== "string" ||
        !input.category.trim() ||
        input.category.length > 100
      ) {
        return reply("Невалидна категория.", 400);
      }

      updates.category = input.category.trim();
    }

    if ("description" in input) {
      if (
        typeof input.description !== "string" ||
        input.description.length > 10000
      ) {
        return reply("Невалидно описание.", 400);
      }

      updates.description = input.description;
    }

    if ("price" in input) {
      if (!validPrice(input.price)) {
        return reply("Невалидна цена.", 400);
      }

      updates.price = input.price;
    }

    if ("price_on_request" in input) {
      if (typeof input.price_on_request !== "boolean") {
        return reply("Невалиден тип цена.", 400);
      }

      updates.price_on_request = input.price_on_request;
    }

    if ("in_stock" in input) {
      if (typeof input.in_stock !== "boolean") {
        return reply("Невалидна наличност.", 400);
      }

      updates.in_stock = input.in_stock;
    }

    if ("is_active" in input) {
      if (typeof input.is_active !== "boolean") {
        return reply("Невалиден статус на видимост.", 400);
      }

      updates.is_active = input.is_active;
    }

    // НОВО: РЕДАКТИРАНЕ НА СНИМКИТЕ
    if ("images" in input) {
      if (!validImages(input.images)) {
        return reply(
          "Невалиден списък със снимки. Максимум 15 снимки от каталога или TACH Storage.",
          400
        );
      }

      if (
        new Set(input.images).size !== input.images.length
      ) {
        return reply("Има повтарящи се снимки.", 400);
      }

      updates.images = input.images;
    }

    if (Object.keys(updates).length === 0) {
      return reply("Няма промени за записване.", 400);
    }

    const adminDb = getAdminDb();

    const { data: existing, error: lookupError } =
      await adminDb
        .from("tach_products")
        .select("id, price, price_on_request")
        .eq("id", id)
        .maybeSingle();

    if (lookupError) {
      console.error("TACH LOOKUP ERROR:", lookupError);
      return reply("Грешка при проверка на машината.", 500);
    }

    if (!existing) {
      return reply("Машината не е намерена.", 404);
    }

    const finalPrice =
      updates.price !== undefined
        ? updates.price
        : existing.price;

    const finalOnRequest =
      updates.price_on_request !== undefined
        ? updates.price_on_request
        : existing.price_on_request;

    if (finalOnRequest === false && finalPrice === null) {
      return reply(
        "Въведи цена или избери цена при запитване.",
        400
      );
    }

    const { data: product, error: updateError } =
      await adminDb
        .from("tach_products")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

    if (updateError) {
      console.error("TACH PATCH ERROR:", updateError);
      return reply(
        "Неуспешно записване на промените.",
        500
      );
    }

    return NextResponse.json(
      { success: true, product },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("TACH PATCH ERROR:", error);
    return reply("Вътрешна грешка.", 500);
  }
}

// ДОБАВЯНЕ НА НОВА МАШИНА
export async function POST(request: NextRequest) {
  try {
    const supabase = await authenticateAdmin(request);

    if (!supabase) {
      return reply("Нямате администраторски достъп.", 403);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return reply("Невалиден JSON.", 400);
    }

    if (!isObject(body)) {
      return reply("Невалидни данни.", 400);
    }

    const input = body;

    if (
      !onlyFields(input, [
        "name",
        "category",
        "description",
        "price",
        "price_on_request",
        "in_stock",
        "images",
      ])
    ) {
      return reply("Непозволено поле.", 400);
    }

    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : "";

    const category =
      typeof input.category === "string"
        ? input.category.trim()
        : "";

    if (
      !name ||
      name.length > 200 ||
      !category ||
      category.length > 100
    ) {
      return reply(
        "Въведи валидно име и категория.",
        400
      );
    }

    if (
      input.description !== undefined &&
      typeof input.description !== "string"
    ) {
      return reply("Невалидно описание.", 400);
    }

    const description =
      typeof input.description === "string"
        ? input.description.trim()
        : "";

    if (description.length > 10000) {
      return reply("Описанието е прекалено дълго.", 400);
    }

    const price = input.price ?? null;

    if (!validPrice(price)) {
      return reply("Невалидна цена.", 400);
    }

    const priceOnRequest =
      input.price_on_request === undefined
        ? true
        : input.price_on_request;

    const inStock =
      input.in_stock === undefined
        ? true
        : input.in_stock;

    if (
      typeof priceOnRequest !== "boolean" ||
      typeof inStock !== "boolean"
    ) {
      return reply("Невалидни настройки.", 400);
    }

    if (!priceOnRequest && price === null) {
      return reply(
        "Въведи цена или избери „Цена при запитване“.",
        400
      );
    }

    const images = input.images ?? [];

    if (!validImages(images)) {
      return reply(
        "Невалиден списък със снимки. Използвай снимки от каталога или от TACH Storage.",
        400
      );
    }

    if (new Set(images).size !== images.length) {
      return reply("Има повтарящи се снимки.", 400);
    }

    const adminDb = getAdminDb();

    const { data: lastProduct, error: orderError } =
      await adminDb
        .from("tach_products")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (orderError) {
      console.error("TACH ORDER ERROR:", orderError);
      return reply(
        "Грешка при определяне на подредбата.",
        500
      );
    }

    const nextOrder =
      Number(lastProduct?.sort_order ?? 0) + 1;

    const { data: product, error: insertError } =
      await adminDb
        .from("tach_products")
        .insert({
          name,
          category,
          description,
          price,
          currency: "EUR",
          price_on_request: priceOnRequest,
          in_stock: inStock,
          images,
          is_active: true,
          sort_order: nextOrder,
        })
        .select("*")
        .single();

    if (insertError) {
      console.error("TACH INSERT ERROR:", insertError);
      return reply(
        "Неуспешно добавяне на машината.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        product,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("TACH POST ERROR:", error);
    return reply("Вътрешна грешка.", 500);
  }
}

// ИЗТРИВАНЕ НА МАШИНА
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await authenticateAdmin(request);

    if (!supabase) {
      return reply("Нямате администраторски достъп.", 403);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return reply("Невалиден JSON.", 400);
    }

    if (!isObject(body) || !onlyFields(body, ["id"])) {
      return reply("Невалидни данни за изтриване.", 400);
    }

    const id = body.id;

    if (!validId(id)) {
      return reply("Невалиден идентификатор.", 400);
    }

    const adminDb = getAdminDb();

    const { data: deleted, error: deleteError } =
      await adminDb
        .from("tach_products")
        .delete()
        .eq("id", id)
        .select("id, name")
        .maybeSingle();

    if (deleteError) {
      console.error("TACH DELETE ERROR:", deleteError);
      return reply("Неуспешно изтриване на машината.", 500);
    }

    if (!deleted) {
      return reply("Машината не е намерена.", 404);
    }

    return NextResponse.json(
      {
        success: true,
        deletedId: deleted.id,
        deletedName: deleted.name,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("TACH DELETE ERROR:", error);
    return reply("Вътрешна грешка.", 500);
  }
}

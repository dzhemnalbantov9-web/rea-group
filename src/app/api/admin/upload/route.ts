
import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";


const BUCKET = "tach-products";
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 15;

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !secretKey) {
      return NextResponse.json(
        { error: "Липсва конфигурация на Supabase." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Необходим е администраторски вход." },
        { status: 401 }
      );
    }

    const token = authorization.slice(7).trim();

    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: userData, error: userError } =
      await authClient.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Невалидна сесия." },
        { status: 401 }
      );
    }

    const { data: admin, error: adminError } =
      await authClient
        .from("tach_admins")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: "Нямате администраторски права." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files");

    if (
      files.length === 0 ||
      files.length > MAX_FILES ||
      !files.every((item) => item instanceof File)
    ) {
      return NextResponse.json(
        { error: "Избери между 1 и 15 снимки." },
        { status: 400 }
      );
    }

    const images = files as File[];

    for (const file of images) {
      if (
        !allowedTypes[file.type] ||
        file.size === 0 ||
        file.size > MAX_SIZE
      ) {
        return NextResponse.json(
          {
            error:
              "Позволени са JPG, PNG и WEBP до 5 MB на снимка.",
          },
          { status: 400 }
        );
      }
    }

    const adminDb = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const uploadedPaths: string[] = [];
    const uploadedUrls: string[] = [];

    for (const file of images) {
      const extension = allowedTypes[file.type];
      const path = `${randomUUID()}.${extension}`;

      const { error: uploadError } =
        await adminDb.storage
          .from(BUCKET)
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });

      if (uploadError) {
        console.error("TACH UPLOAD ERROR:", uploadError);

        if (uploadedPaths.length > 0) {
          await adminDb.storage
            .from(BUCKET)
            .remove(uploadedPaths);
        }

        return NextResponse.json(
          { error: "Неуспешно качване на снимките." },
          { status: 500 }
        );
      }

      uploadedPaths.push(path);

      const { data } = adminDb.storage
        .from(BUCKET)
        .getPublicUrl(path);

      uploadedUrls.push(data.publicUrl);
    }

    return NextResponse.json({
      success: true,
      images: uploadedUrls,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("TACH UPLOAD ERROR:", error);

    return NextResponse.json(
      { error: "Вътрешна грешка при качване." },
      { status: 500 }
    );
  }
}

import { type ActionFunctionArgs } from "react-router";
import { db } from "~/utils/db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const email = formData.get("email");

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return Response.json({ error: "Email inválido." }, { status: 400 });
  }

  try {
    await db.subscriber.create({
      data: { email },
    });
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') { // Unique constraint code
        // Email already defined, treat as success to avoid leaking info or just say welcome back
        return { success: true };
    }
    console.error("Newsletter error:", error);
    return Response.json({ error: "Erro ao salvar inscrição. Tente novamente." }, { status: 500 });
  }
}

import { type ActionFunctionArgs } from "react-router";
import { NewsletterService } from "~/services/newsletter.server";

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
    await NewsletterService.subscribe(email);
    return { success: true };
  } catch (error: any) {
    console.error("Newsletter error:", error);
    return Response.json({ error: "Erro ao salvar inscrição. Tente novamente." }, { status: 500 });
  }
}

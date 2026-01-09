import { db } from "~/utils/db.server";

export const NewsletterService = {
  async subscribe(email: string) {
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
      throw error;
    }
  }
};

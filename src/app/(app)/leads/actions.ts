"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, hasPerm } from "@/lib/auth";
import {
  createLeadUseCase,
  type CreateLeadInput,
} from "@/modules/leads/application/create-lead.use-case";
import { ValidationError } from "@/modules/leads/domain/dynamic-field.validator";

export async function createLeadAction(input: CreateLeadInput) {
  const auth = await requireAuth();
  if (!hasPerm(auth, "lead:create")) throw new Error("You don't have permission to do that.");
  try {
    const lead = await createLeadUseCase(auth, input);
    revalidatePath("/leads");
    revalidatePath("/");
    return { ok: true as const, lead };
  } catch (e) {
    if (e instanceof ValidationError) {
      return { ok: false as const, errors: e.errors };
    }
    throw e;
  }
}

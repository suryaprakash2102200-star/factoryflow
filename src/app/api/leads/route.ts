import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { createLeadUseCase } from "@/modules/leads/application/create-lead.use-case";
import { ValidationError } from "@/modules/leads/domain/dynamic-field.validator";

const CreateLeadSchema = z.object({
  title: z.string().min(1),
  stageId: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
  source: z.string().optional(),
  estimatedValue: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  customValues: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await getAuth();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateLeadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const lead = await createLeadUseCase(auth, parsed.data);
    return NextResponse.json(lead, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ errors: e.errors }, { status: 422 });
    }
    throw e;
  }
}

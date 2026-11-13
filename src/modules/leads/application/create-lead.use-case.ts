import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/tenant-context";
import {
  DynamicFieldValidator,
  FieldDefinitionDTO,
} from "../domain/dynamic-field.validator";

export interface CreateLeadInput {
  title: string;
  stageId: string;
  ownerId?: string;
  source?: string;
  estimatedValue?: number;
  currency?: string;
  customValues?: Record<string, unknown>;
}

export interface AuthContext {
  tenantId: string;
  userId: string;
}

export async function createLeadUseCase(
  auth: AuthContext,
  input: CreateLeadInput,
) {
  return withTenant(auth.tenantId, async (tx) => {
    const defs = await tx.fieldDefinition.findMany({
      where: { entity: "lead", isActive: true },
      orderBy: { orderIndex: "asc" },
    });

    const customValues = DynamicFieldValidator.validate(
      input.customValues ?? {},
      defs as unknown as FieldDefinitionDTO[],
    );

    const stage = await tx.leadStage.findUniqueOrThrow({
      where: { id: input.stageId },
    });

    return tx.lead.create({
      data: {
        tenantId: auth.tenantId,
        pipelineId: stage.pipelineId,
        stageId: input.stageId,
        ownerId: input.ownerId ?? auth.userId,
        title: input.title,
        source: input.source,
        estimatedValue: input.estimatedValue,
        currency: input.currency ?? "USD",
        customValues: customValues as Prisma.InputJsonValue,
        lastActivityAt: new Date(),
      },
    });
  });
}

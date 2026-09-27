import { describe, expect, it } from "vitest";
import { toActionError } from "@/server/actions/utils";
import { ForbiddenError, NotFoundError } from "@/server/authz/errors";

const GENERIC = "Algo deu errado. Tente novamente.";

describe("toActionError", () => {
  it("relays messages thrown deliberately by services", () => {
    expect(toActionError(new Error("Embarque não encontrado."))).toEqual({
      error: "Embarque não encontrado.",
    });
    expect(toActionError(new ForbiddenError()).error).toMatch(/permissão/);
    expect(toActionError(new NotFoundError("Tarefa não encontrada.")).error).toBe(
      "Tarefa não encontrada.",
    );
  });

  it("never relays a bug's message to the browser", () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'supplierId')");
    expect(toActionError(bug)).toEqual({ error: GENERIC });
  });

  it("never relays an unmapped database error", () => {
    const dbError = Object.assign(new Error('relation "Task" violates check constraint'), {
      name: "PrismaClientKnownRequestError",
      code: "P2004",
    });
    expect(toActionError(dbError)).toEqual({ error: GENERIC });
  });
});

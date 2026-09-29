import { describe, expect, it } from "vitest";
import { z } from "zod";
import { redirect } from "next/navigation";
import { localizeActionState, toActionError } from "@/server/actions/utils";
import { ForbiddenError, NotFoundError } from "@/server/authz/errors";
import { errorText } from "@/lib/i18n/error-text";
import { matchErrorKey, translateError } from "@/lib/i18n/translate-error";
import { errorsPtBR, type ErrorKey } from "@/lib/i18n/dictionaries/errors.pt-BR";
import { errorsEn } from "@/lib/i18n/dictionaries/errors.en";
import { errorsZh } from "@/lib/i18n/dictionaries/errors.zh";

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

  it("lets framework control flow through instead of reporting it", () => {
    let thrown: unknown;
    try {
      redirect("/login");
    } catch (error) {
      thrown = error;
    }
    // An expired session must reach the login page, not a "NEXT_REDIRECT" toast.
    expect(() => toActionError(thrown)).toThrow();
    expect(() => toActionError(thrown, "en")).toThrow();
  });
});

describe("toActionError for the Vionex team (pt-BR)", () => {
  it("says exactly what it said before the catalog existed", () => {
    const schema = z.object({ name: z.string().min(2, errorText("nameRequired")) });
    const parsed = schema.safeParse({ name: "" });
    expect(toActionError(parsed.error)).toEqual({
      error: "Verifique os campos destacados.",
      fieldErrors: { name: ["Informe o nome."] },
    });
    expect(toActionError(new ForbiddenError()).error).toBe(
      "Você não tem permissão para executar esta ação.",
    );
    expect(toActionError(new NotFoundError()).error).toBe("Registro não encontrado.");
    expect(toActionError(new Error(errorText("fileTooLarge", { size: 25 }))).error).toBe(
      "O arquivo excede o limite de 25 MB.",
    );
    const duplicate = Object.assign(new Error("Unique constraint"), {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
    expect(toActionError(duplicate).error).toBe("Já existe um registro com estes dados.");
    expect(toActionError(new Error("x"), "pt-BR")).toEqual({ error: "x" });
  });
});

describe("toActionError in the supplier's language", () => {
  it("translates the generic fallbacks", () => {
    const bug = new TypeError("boom");
    expect(toActionError(bug, "en")).toEqual({ error: "Something went wrong. Please try again." });
    expect(toActionError(bug, "zh")).toEqual({ error: errorsZh.generic });

    const fk = Object.assign(new Error("Foreign key"), {
      name: "PrismaClientKnownRequestError",
      code: "P2003",
    });
    expect(toActionError(fk, "en").error).toBe(errorsEn.invalidReference);
  });

  it("translates service refusals and authorization errors", () => {
    expect(toActionError(new Error(errorText("ownCompanyManage")), "en").error).toBe(
      "You can only manage users of your own company.",
    );
    expect(toActionError(new Error(errorText("requestInReview")), "en").error).toBe(
      errorsEn.requestInReview,
    );
    expect(toActionError(new ForbiddenError(), "en").error).toBe(errorsEn.forbidden);
    expect(toActionError(new NotFoundError(), "en").error).toBe(errorsEn.notFound);
    expect(toActionError(new NotFoundError(errorText("threadNotFound")), "en").error).toBe(
      "Conversation not found.",
    );
    expect(toActionError(new ForbiddenError(errorText("uploadOtherThread")), "zh").error).toBe(
      errorsZh.uploadOtherThread,
    );
  });

  it("carries the values of a templated message into the translation", () => {
    const tooLarge = new Error(errorText("fileTooLarge", { size: 25 }));
    expect(toActionError(tooLarge, "en").error).toBe("The file exceeds the 25 MB limit.");
    expect(toActionError(tooLarge, "zh").error).toBe("文件超过 25 MB 的限制。");
  });

  it("translates zod field errors and the banner above them", () => {
    const schema = z
      .object({
        name: z.string().min(2, errorText("nameRequired")),
        email: z.string().email(errorText("emailInvalid")),
        password: z.string().min(8, errorText("passwordMin")),
        confirm: z.string(),
      })
      .refine((value) => value.password === value.confirm, {
        message: errorText("passwordMismatch"),
        path: ["confirm"],
      });
    const parsed = schema.safeParse({ name: "", email: "nope", password: "12345678", confirm: "x" });

    expect(toActionError(parsed.error, "en")).toEqual({
      error: "Please check the highlighted fields.",
      fieldErrors: {
        name: ["Enter the name."],
        email: ["Invalid email address."],
        confirm: ["The passwords don't match."],
      },
    });
  });

  it("leaves a message outside the catalog as it is", () => {
    expect(toActionError(new Error("Embarque não encontrado."), "en")).toEqual({
      error: "Embarque não encontrado.",
    });
  });

  it("translates what is relayed, never relays more", () => {
    // A bug whose text happens to match a catalog sentence is still a bug.
    const bug = new TypeError(errorText("ownCompanyManage"));
    expect(toActionError(bug, "en")).toEqual({ error: errorsEn.generic });

    const dbError = Object.assign(new Error(errorText("projectNotFound")), {
      name: "PrismaClientKnownRequestError",
      code: "P2004",
    });
    expect(toActionError(dbError, "en")).toEqual({ error: errorsEn.generic });

    const long = new Error(`${errorText("fileEmpty")} ${"x".repeat(250)}`);
    expect(toActionError(long, "en")).toEqual({ error: errorsEn.generic });
  });

  it("localises a state an action builds by hand", () => {
    const wrong = errorText("currentPasswordWrong");
    const state = { error: wrong, fieldErrors: { currentPassword: [wrong] } };
    expect(localizeActionState(state, "en")).toEqual({
      error: errorsEn.currentPasswordWrong,
      fieldErrors: { currentPassword: [errorsEn.currentPasswordWrong] },
    });
    expect(localizeActionState(state, "pt-BR")).toBe(state);
  });
});

describe("the error catalog", () => {
  const keys = Object.keys(errorsPtBR) as ErrorKey[];
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it("has unique Portuguese sentences, so a message maps back to one key", () => {
    const texts = Object.values(errorsPtBR);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("is complete in English and Chinese, with the same placeholders", () => {
    for (const catalog of [errorsEn, errorsZh]) {
      expect(Object.keys(catalog).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        expect(catalog[key].trim(), key).not.toBe("");
        expect(placeholders(catalog[key]), key).toEqual(placeholders(errorsPtBR[key]));
      }
    }
  });

  it("recognises every sentence it produces", () => {
    for (const key of keys) {
      const text = errorText(key, { size: 25 });
      expect(matchErrorKey(text)?.key, key).toBe(key);
      expect(translateError(text, "en"), key).not.toBe(text);
    }
  });
});

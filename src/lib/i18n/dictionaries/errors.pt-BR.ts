/**
 * Refusals the server sends back to a form, in the canonical language.
 *
 * Kept apart from the main dictionary for one reason: services and schemas
 * build their messages from here (`errorText`), and some of those modules are
 * also imported by client components — this file is small enough to ride
 * along, the full dictionary is not.
 *
 * Every sentence is also a lookup key in reverse: `translateError` recognises
 * a relayed Portuguese message and re-renders it in the caller's language. So
 * the texts must stay unique — `tests/unit/action-error.test.ts` checks it.
 */
export const errorsPtBR = {
  // Generic fallbacks of `toActionError`.
  validation: "Verifique os campos destacados.",
  generic: "Algo deu errado. Tente novamente.",
  duplicate: "Já existe um registro com estes dados.",
  invalidReference: "Registro relacionado inválido.",

  // Authorization.
  forbidden: "Você não tem permissão para executar esta ação.",
  roleNotAllowed: "Seu perfil não permite esta ação.",
  sessionExpired: "Sessão expirada. Faça login novamente.",
  notFound: "Registro não encontrado.",
  projectNotFound: "Projeto não encontrado.",
  taskNotFound: "Tarefa não encontrada.",
  documentNotFound: "Documento não encontrado.",
  fileNotFound: "Arquivo não encontrado.",
  requestNotFound: "Solicitação não encontrada.",
  supplierNotFound: "Fornecedor não encontrado.",
  threadNotFound: "Conversa não encontrada.",

  // Files and uploads.
  fileMissing: "Nenhum arquivo enviado.",
  fileEmpty: "O arquivo está vazio.",
  fileTooLarge: "O arquivo excede o limite de {size} MB.",
  fileTypeNotAllowed: "Tipo de arquivo não permitido.",
  fileExtensionMismatch: "A extensão do arquivo não corresponde ao seu tipo.",
  uploadExpired: "O envio expirou. Tente novamente.",
  uploadOtherSession: "Este envio pertence a outra sessão.",
  uploadNotReceived: "O arquivo não chegou ao armazenamento. Tente novamente.",
  uploadOtherProject: "O envio pertence a outro projeto.",
  uploadOtherThread: "O envio pertence a outra conversa.",
  uploadPrepareFailed: "Não foi possível preparar o envio.",
  projectRequired: "Selecione um projeto.",

  // Document requests.
  requestCancelled: "Esta solicitação foi cancelada.",
  requestInReview: "Esta solicitação está em análise. Aguarde o retorno da Vionex.",
  requestApproved: "Esta solicitação já foi aprovada.",
  requestEmpty: "Anexe um arquivo ou escreva uma resposta.",

  // Messages.
  messageEmpty: "Escreva uma mensagem ou anexe um arquivo.",

  // Users.
  portalRolesOnlyCreate: "Você só pode criar usuários do portal.",
  ownCompanyCreate: "Você só pode criar usuários da sua própria empresa.",
  ownCompanyManage: "Você só pode gerenciar usuários da sua própria empresa.",
  portalRolesOnlyAssign: "Você só pode atribuir papéis do portal.",
  supplierLinkRequired: "Usuário de fornecedor precisa estar vinculado a um fornecedor.",
  internalWithSupplier: "Usuário interno não pode estar vinculado a um fornecedor.",
  supplierInvalid: "Fornecedor inválido.",
  emailTaken: "Já existe um usuário com este e-mail.",
  userNotFound: "Usuário não encontrado.",
  roleSwitch: "Não é possível alternar entre papéis internos e de fornecedor.",
  lastAdmin: "Esta empresa ficaria sem nenhum administrador ativo. Promova outro usuário antes.",

  // Field errors.
  nameRequired: "Informe o nome.",
  emailInvalid: "E-mail inválido.",
  passwordMin: "A senha deve ter ao menos 8 caracteres.",
  currentPasswordRequired: "Informe a senha atual.",
  currentPasswordWrong: "Senha atual incorreta.",
  newPasswordMin: "A nova senha deve ter ao menos 8 caracteres.",
  confirmPasswordRequired: "Confirme a nova senha.",
  passwordMismatch: "As senhas não coincidem.",
  passwordUnchanged: "A nova senha deve ser diferente da atual.",
} as const;

export type ErrorKey = keyof typeof errorsPtBR;
export type ErrorCatalog = Record<ErrorKey, string>;

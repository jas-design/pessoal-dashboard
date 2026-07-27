# Integração Microsoft

## Componentes

- Microsoft Entra ID App Registration;
- Microsoft Graph;
- OneDrive;
- Outlook;
- OAuth 2.0.

## Princípio

Conceder a menor permissão possível.

Começar com leitura:

- usuário;
- arquivos necessários;
- e-mails necessários;
- acesso offline quando indispensável.

Adicionar escrita somente quando a funcionalidade estiver pronta e protegida por aprovação.

## OneDrive

Fonte original de documentos Microsoft.

No Supabase salvar:

- ID externo;
- nome;
- caminho;
- URL;
- datas;
- checksum;
- categoria;
- status;
- dados extraídos.

Evitar duplicar permanentemente todos os arquivos sem necessidade.

## Outlook

Primeira fase:

- ler;
- classificar;
- resumir;
- sugerir resposta;
- criar aprovação.

Não enviar automaticamente.

## Tokens

- armazenar em credencial segura do n8n ou secret manager;
- nunca no navegador;
- não registrar token em logs;
- prever expiração e renovação;
- revogar ao encerrar contrato.

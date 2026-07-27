# Padrões de código

## Geral

- TypeScript sempre que possível.
- Evitar `any`.
- Funções pequenas e nomeadas.
- Validar entradas nas fronteiras.
- Não duplicar clientes Supabase.
- Reutilizar componentes existentes.
- Não adicionar dependência sem necessidade.
- Não fazer refatoração ampla dentro de correção pequena.
- Comentários devem explicar “por quê”, não repetir o código.

## Astro

- UI em componentes `.astro`.
- Interatividade somente onde necessária.
- Lógica sensível em endpoints server-side.
- Não importar módulos server-only em código enviado ao navegador.
- Confirmar se o projeto usa SSR, hybrid ou static antes de criar endpoints.

## SCSS

- Preferir estilos por componente ou página.
- Usar tokens existentes.
- Evitar valores duplicados.
- Não usar `!important` sem justificativa.
- Preservar responsividade.
- Não substituir todo o design system para corrigir um elemento.

## Supabase client

Separar cliente público e servidor.

Exemplo conceitual:

```text
client.ts
- URL pública
- anon key
- usado no navegador

server.ts
- execução server-side
- sessão/cookies
- service role somente em função explicitamente autorizada
```

## Respostas de API

Formato preferido:

```json
{
  "success": true,
  "data": {},
  "requestId": "uuid"
}
```

Erro:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Mensagem segura"
  },
  "requestId": "uuid"
}
```

## Testes mínimos

Para toda feature:

- caminho feliz;
- entrada inválida;
- usuário não autenticado;
- usuário sem permissão;
- falha do serviço externo;
- estado vazio;
- timeout ou job com falha.

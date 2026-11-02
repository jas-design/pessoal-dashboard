# Etapa 07C.13B.10 — validação técnica do CSV PgBouncer

Data da validação: 23/10/2026. Estado: **CSV VALIDADO QUANTO À IDENTIDADE
BINÁRIA, ESTRUTURA E CONTEÚDO TEMPORAL; COMPLETUDE DA EXPORTAÇÃO E DA FONTE NÃO
COMPROVADAS; INCIDENTE NÃO ENCERRADO**.

## Objetivo e escopo autorizado

Esta etapa reproduziu verificações estruturais e temporais no arquivo
explicitamente autorizado:

```text
C:\FABIO-AUDITORIA\07C13B\supabase_logs (2).csv
```

A autorização foi aplicada somente a esse arquivo. Nenhum outro arquivo do
diretório foi enumerado, aberto ou lido. Não houve acesso a `.env`, JSONL,
credenciais, Supabase, PostgreSQL, Management API, n8n, migrations, workflows
ou configurações de produção. Não foram executados SQL, autenticação ou
operação destrutiva.

O CSV foi lido em memória e permaneceu sem alteração. Não foi criada cópia,
exportação intermediária ou versão reformatada. Este relatório contém apenas
metadados seguros e resultados agregados; nenhuma mensagem, URL, identificador
interno ou valor de `auth_user` foi reproduzido.

## Métodos utilizados

- `Get-Item` para existência, tamanho e timestamps do arquivo;
- `Get-FileHash -Algorithm SHA256` antes e depois da análise;
- `Import-Csv` para o modelo tabular;
- `Microsoft.VisualBasic.FileIO.TextFieldParser` para validar quantidade de
  campos e registros malformados, respeitando campos entre aspas;
- parsing em memória com `DateTimeOffset` para correlação temporal;
- agrupamentos em memória para IDs, registros duplicados e lacunas;
- busca exata pelo token `cli_login_postgres` em todas as colunas;
- classificação lexical agregada do campo de mensagem, sem emitir conteúdo.

Nenhum comando utilizado escreveu no local autorizado.

## Integridade do arquivo

| Verificação | Resultado |
| --- | --- |
| arquivo existente | sim |
| tamanho | 119.962 bytes |
| última modificação UTC | 23/10/2026 19:53:09.4688355 UTC |
| criação no sistema de arquivos UTC | 23/10/2026 21:12:31.4785621 UTC |
| SHA-256 antes da análise | `5e8d2e90497c1962da94f366e122052ce77865fe4a25e023b9ef26ad4190f684` |
| SHA-256 depois da análise | `5e8d2e90497c1962da94f366e122052ce77865fe4a25e023b9ef26ad4190f684` |
| correspondência com B.9A | sim |

Conclusão de integridade: o conteúdo binário permaneceu idêntico durante esta
análise e corresponde ao digest confirmado anteriormente pelo operador. O
timestamp de criação do arquivo no local autorizado é posterior ao de última
modificação, situação compatível com cópia/preservação em outro diretório, mas
a origem e a cadeia de custódia dessa transferência ainda devem ser confirmadas
por revisão humana.

O hash comprova identidade dos bytes comparados. Ele não comprova que a
exportação incluiu todas as páginas nem que a fonte registrou todos os eventos.

## Estrutura do CSV

O parser CSV identificou 484 registros físicos/lógicos incluindo o cabeçalho:
um cabeçalho e 483 registros de dados. Todos continham 12 campos e nenhum
registro foi classificado como malformado.

Colunas, na ordem encontrada:

1. `id`;
2. `date`;
3. `method`;
4. `pathname`;
5. `status`;
6. `timestamp`;
7. `level`;
8. `event_message`;
9. `log_type`;
10. `log_count`;
11. `logs`;
12. `auth_user`.

### Preenchimento estrutural

| Coluna/grupo | Resultado agregado |
| --- | --- |
| `id`, `date`, `timestamp`, `level`, `event_message`, `log_type`, `log_count`, `logs`, `auth_user` | 483 valores não vazios em cada coluna |
| `method`, `pathname`, `status` | 483 valores vazios em cada coluna |
| registros com quantidade diferente de 12 campos | 0 |
| registros malformados | 0 |

Os campos HTTP vazios são compatíveis com um corpus de logs de pooler, mas
limitam correlações por método, caminho e status. A coluna `auth_user` possui um
único valor distinto em todo o corpus; o valor não foi reproduzido.

## Contagem reproduzida

| Métrica | Resultado |
| --- | --- |
| registros de dados parseados | 483 |
| contagem informada anteriormente | 483 |
| diferença | 0 |
| `log_type` | 483 eventos classificados pela origem como PgBouncer |
| `level` | 483 eventos classificados pela origem como sucesso |

A contagem de 483 registros foi reproduzida no arquivo. Isso confirma o corpus
preservado, mas não confirma que a consulta na origem retornava somente ou
exatamente 483 eventos.

## Interpretação dos timestamps

A coluna `timestamp` contém seis dígitos de fração de segundo, mas não inclui
marcador de timezone. A coluna `date` contém representação ISO 8601 com `Z`,
envolvida por aspas textuais adicionais dentro do campo CSV.

Após remover somente essas aspas externas em memória:

- 483/483 valores de `date` apresentaram `Z` e foram parseados como UTC;
- 483/483 valores de `timestamp` foram parseados;
- cada par `date`/`timestamp` caiu no mesmo segundo UTC;
- diferença absoluta máxima entre os pares: 0,999 ms;
- diferença absoluta média: 0,467308 ms.

Conclusão: para este corpus, a associação linha a linha com `date` sustenta a
interpretação de `timestamp` como UTC e fornece a precisão adicional usada nas
contagens. Não se está presumindo genericamente que qualquer timestamp sem
offset seja UTC.

Intervalo observado no arquivo:

```text
2026-10-22 21:00:04.555392 UTC
até
2026-10-22 21:59:49.552950 UTC
```

Não foram encontrados timestamps ausentes ou inválidos.

## Eventos nas janelas do incidente

Os limites foram tratados como inclusivos.

| Grupo | Intervalo | Eventos |
| --- | --- | ---: |
| janela crítica | 21:23:41.265–21:28:48.000 UTC | 40 |
| janela ampliada, incluindo a crítica | 21:08:41.000–21:43:48.000 UTC | 283 |
| janela ampliada, excluindo a crítica | mesmo intervalo, fora da crítica | 243 |
| fora da janela ampliada | antes de 21:08:41 ou depois de 21:43:48 UTC | 200 |
| total reconciliado | todos os grupos | 483 |

Cobertura observada nos limites:

| Janela | Primeiro evento | Distância do início | Último evento | Distância do fim |
| --- | --- | ---: | --- | ---: |
| ampliada | 21:08:49.555048 UTC | 8,555048 s | 21:43:34.553119 UTC | 13,446881 s |
| crítica | 21:23:49.553248 UTC | 8,288248 s | 21:28:34.553293 UTC | 13,446707 s |

A inexistência de evento exatamente nos limites não indica, por si, perda de
logs; o corpus apresenta uma cadência observada de vários segundos entre
eventos. Também não comprova cobertura contínua da origem.

## IDs, duplicidades e consistência de linhas

| Verificação | Resultado |
| --- | ---: |
| IDs ausentes | 0 |
| grupos de IDs duplicados | 0 |
| registros pertencentes a grupos de IDs duplicados | 0 |
| timestamps distintos | 483 |
| grupos de registros integralmente duplicados | 0 |
| registros integralmente duplicados | 0 |

Não foram encontradas duplicidades por ID, timestamp ou conteúdo completo no
corpus preservado.

## Referências à credencial investigada

A busca exata, sensível a maiúsculas e minúsculas, pelo token delimitado
`cli_login_postgres` foi aplicada a todas as 12 colunas.

| Resultado | Contagem |
| --- | ---: |
| registros correspondentes | 0 |
| ocorrências totais | 0 |

Conclusão permitida: nenhuma referência exata a `cli_login_postgres` foi
identificada neste CSV.

Conclusão não permitida: o resultado não demonstra ausência de autenticação ou
acesso, porque o nome do papel pode não ter sido registrado e a completude da
fonte/exportação não está comprovada.

## Classificação agregada dos eventos

A classificação abaixo utiliza somente sinais lexicais funcionais do campo
`event_message`. As categorias são mutuamente exclusivas por prioridade e não
reproduzem mensagens:

| Categoria primária | Eventos |
| --- | ---: |
| sinais compatíveis com autenticação | 240 |
| sinais de ciclo de conexão | 242 |
| outro evento de sucesso | 1 |
| erro ou falha | 0 |
| query ou statement | 0 |
| transação | 0 |
| roteamento/backend/pool explícito | 0 |
| total | 483 |

Buscas adicionais não encontraram sinais lexicais de falha de autenticação,
timeout, capacidade excedida, erro ou severidade não bem-sucedida. Isso
classifica o texto presente, mas não transforma eventos genéricos de
autenticação em autenticações atribuíveis a `cli_login_postgres`.

## Lacunas temporais observadas

Todos os 483 timestamps são distintos.

| Métrica | Resultado |
| --- | --- |
| maior intervalo entre eventos em todo o corpus | 15,308 s |
| limites do maior intervalo | 21:52:19.553788–21:52:34.861792 UTC |
| intervalos superiores a 60 s | 0 |
| intervalos superiores a 300 s | 0 |
| maior intervalo entre eventos dentro da janela ampliada | 15,135 s |
| limites dentro da janela ampliada | 21:22:49.553396–21:23:04.688680 UTC |

Não foi observada lacuna temporal longa em relação à cadência deste corpus. A
ausência de intervalos superiores a 60 segundos reduz a suspeita de um corte
grosseiro dentro do arquivo, mas não comprova continuidade da ingestão. Sem
contador sequencial da origem, heartbeat documentado ou total da consulta, não
é possível diferenciar silêncio legítimo de evento não registrado.

## Anomalias e observações

1. `timestamp` não possui offset; a interpretação UTC depende da correlação
   consistente com `date`, que possui `Z`.
2. `date` contém aspas textuais adicionais, mas os 483 valores são parseáveis
   após remoção apenas desse invólucro em memória.
3. `method`, `pathname` e `status` estão vazios em todos os registros, impedindo
   correlação por metadados HTTP.
4. Creation Time posterior ao Last Write Time sugere que o arquivo foi copiado
   para o local de preservação; a cadeia de custódia precisa explicar essa
   transferência.
5. O corpus é restrito a aproximadamente uma hora e não contém metadados
   suficientes para comprovar como a janela foi solicitada na origem.
6. Todos os eventos têm `level=success`; essa uniformidade pode refletir a
   natureza/filtro da exportação e deve ser confrontada com os filtros da
   origem.
7. Não há duplicidades, registros malformados, IDs ausentes ou timestamps
   inválidos no arquivo analisado.
8. Não há referência exata ao papel investigado.

Nenhuma dessas observações, isoladamente, indica adulteração ou atividade
maliciosa.

## Integridade versus completude

| Dimensão | Resultado desta etapa |
| --- | --- |
| identidade binária | confirmada pelo SHA-256 antes/depois e correspondência com B.9A |
| estrutura CSV | válida para os 483 registros, sem linha malformada |
| consistência temporal interna | válida; timestamps parseáveis e reconciliados |
| duplicidade interna | nenhuma identificada |
| completude do arquivo em relação à exportação | não demonstrada |
| completude da exportação em relação à consulta | não demonstrada |
| completude da consulta em relação à fonte | não demonstrada |
| cobertura de todas as autenticações relevantes | não demonstrada |

Um arquivo íntegro e internamente consistente ainda pode representar somente
uma página, um filtro parcial ou uma fonte que não registrava toda a atividade.

## Limitações da evidência

Ainda não foram fornecidos:

- consulta/filtros originais usados na exportação;
- janela efetivamente aceita pela interface/API;
- ordenação e colunas selecionadas na origem;
- total informado antes da exportação;
- limite máximo, número de páginas, offsets ou cursores;
- confirmação de ausência de erro, timeout ou truncamento na coleta;
- retenção e disponibilidade da fonte no momento da exportação;
- semântica formal dos eventos PgBouncer exportados;
- configuração histórica de logging de conexões/desconexões;
- cadeia de custódia completa entre aquisição e diretório autorizado.

O CSV não permite resolver as limitações de PostgreSQL, Supavisor ou
Organization Audit Logs já registradas nas etapas anteriores.

## Pendências para revisão independente

O segundo responsável deve:

- [ ] recalcular o SHA-256 ou testemunhar a verificação no arquivo autorizado;
- [ ] confirmar tamanho, timestamps e explicação da transferência para o local
      de preservação;
- [ ] confirmar parser, 12 colunas, 483 registros e zero linhas malformadas;
- [ ] reproduzir as contagens de 40 eventos na janela crítica e 283 na ampliada;
- [ ] reproduzir zero IDs duplicados, zero timestamps inválidos e zero
      referências exatas ao papel;
- [ ] revisar a classificação lexical sem acessar ou divulgar valores
      sensíveis desnecessários;
- [ ] obter e reconciliar filtros, limites, total da origem e paginação;
- [ ] confirmar a cadeia de custódia e o custodiante;
- [ ] manter separadas integridade do arquivo e completude dos logs;
- [ ] avaliar as limitações junto às demais fontes do incidente;
- [ ] registrar decisão, ressalvas, riscos aceitos, responsável e prazo;
- [ ] manter pendente a decisão de retenção do JSONL conforme a Etapa B.9.

## Veredito desta etapa

**CSV ÍNTEGRO E ESTRUTURALMENTE CONSISTENTE; 483 REGISTROS REPRODUZIDOS; 40
EVENTOS NA JANELA CRÍTICA; 283 NA JANELA AMPLIADA; NENHUMA REFERÊNCIA EXATA A
`cli_login_postgres`; COMPLETUDE DA EXPORTAÇÃO E DA FONTE NÃO COMPROVADAS.**

Não foi identificada anomalia interna que indique alteração do CSV. Ainda assim,
esta validação não demonstra ausência de acesso indevido e não autoriza encerrar
o incidente. Permanecem pendentes a evidência de filtros/paginação da origem, a
revisão independente, a decisão sobre retenção do JSONL e o aceite humano dos
riscos residuais.

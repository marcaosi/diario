# Diário do joelho

Registro diário de sono, dor no joelho, musculação, outras atividades, refeições do plano alimentar, suplementos e bem-estar. Gera um resumo em texto pronto para colar na conversa com o Claude.

## Estrutura

```
api/index.js      entrada das funções da Vercel (rotas /api/*)
lib/app.js        API em Express
lib/auth.js       login e sessão (cookie assinado)
lib/store.js      banco de dados JSON (db.json local ou Upstash Redis na Vercel)
public/           interface (HTML, CSS, JS puro, sem build)
public/plan.js    refeições, treinos e suplementos — edite aqui quando o plano mudar
local.js          servidor para rodar no seu computador
vercel.json       configuração da Vercel
```

## Rodar no computador

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Login padrão: `administrador` / `admin123`.
Os registros ficam em `db.json`, na raiz do projeto.

## Publicar na Vercel

### Por que não dá para usar o db.json na Vercel

As funções da Vercel rodam em um sistema de arquivos somente leitura, que é descartado a cada execução. Um `db.json` gravado lá desaparece em minutos, e você perderia os registros. Por isso, em produção o mesmo documento JSON fica guardado no **Upstash Redis**, que tem plano gratuito e se conecta à Vercel em poucos cliques. O formato dos dados é idêntico ao do `db.json`, e o botão "Baixar backup" na aba Resumo exporta tudo nesse formato.

### Passo a passo

1. Suba o projeto para um repositório no GitHub (o `db.json` já está no `.gitignore`, para seus dados de saúde não irem parar no repositório).
2. Na Vercel, clique em **Add New → Project** e importe o repositório. Não é preciso configurar build.
3. No projeto, abra **Storage**, escolha **Upstash → Redis** (no Marketplace), crie o banco no plano gratuito e conecte ao projeto. A Vercel cria sozinha as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
4. Em **Settings → Environment Variables**, adicione:
   - `SESSION_SECRET`: um texto aleatório longo. Para gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ADMIN_USER`: seu usuário (se não definir, fica `administrador`)
   - `ADMIN_PASSWORD`: sua senha (se não definir, fica `admin123`)
5. Faça um novo deploy (**Deployments → Redeploy**) para as variáveis valerem.

> **Importante:** troque a senha padrão antes de publicar. O site fica acessível na internet e guarda dados de saúde; `admin123` é uma das primeiras senhas que qualquer robô testa.

## Personalizar

Tudo que é específico da rotina está em `public/plan.js`: horários e descrição das refeições, treinos A a E, quais treinos são de perna, atividades, suplementos e o texto da escala de dor. Edite, faça commit e a Vercel publica a nova versão.

## Formato dos dados

```json
{
  "entries": {
    "2026-10-02": {
      "date": "2026-10-02",
      "sono": { "horas": 7, "qualidade": 3, "local": "cama", "descansado": "sim" },
      "joelho": { "acordar": 4, "escada": 4, "pior": 4, "sinais": [] },
      "treino": { "tipo": "E", "fisio": "sim", "durante": 4, "depois": 4, "sensacao": "leve", "ajustes": "" },
      "atividades": { "lista": ["muaythai"], "dorMuay": 5, "dorVolei": null, "minErgo": 20, "minRua": 30 },
      "refeicoes": { "lanche_18": { "status": "trocou", "oque": "salgados" } },
      "suplementos": ["creatina", "glifage_almoco"],
      "agua": 4,
      "bemestar": { "energia": 3, "mental": 2, "intestino": "ok" },
      "obs": "",
      "updatedAt": "2026-10-02T23:00:00.000Z"
    }
  }
}
```

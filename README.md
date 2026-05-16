# Quest Game

Juego online en tiempo real para conocerse mejor entre hermanos / amigos.
Cada ronda aparece una pregunta tipo *"Comida favorita"* y todos responden:
- una respuesta sobre **sí mismos**
- una respuesta sobre **cada uno de los otros jugadores**

Después se compara: gana puntos quien más acierta sobre el resto.
Hay una vista **TV/host** opcional pensada para una compu conectada al televisor.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind v4
- Supabase (Postgres + Realtime) — sincronización en tiempo real entre dispositivos
- Despliegue en Vercel

## Setup local

### 1. Crear proyecto en Supabase

1. Andá a [supabase.com](https://supabase.com) y creá un nuevo proyecto (free tier alcanza).
2. En el SQL editor, pegá y ejecutá el contenido de [`supabase/schema.sql`](./supabase/schema.sql).
   Esto crea las tablas, RLS y habilita Realtime.
3. En *Project Settings → API*, copiá:
   - **Project URL**
   - **anon public key**
   - **service_role key** (¡secreta!)

### 2. Variables de entorno

Copiá `.env.example` a `.env.local` y completalo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Correr en dev

```bash
npm install
npm run dev
```

Abrir <http://localhost:3000>.

## Cómo se juega

1. **Host** (compu conectada al TV): andá a `/` → *"Crear partida"*. Configurá cantidad de preguntas y tiempo. Te lleva a la vista del TV con un **código de 5 letras** y un **QR**.
2. **Jugadores**: escanean el QR (o entran a `/play` y tipean el código) desde el celular. Ponen su nombre y caen en el lobby.
3. El host clickea *"Empezar partida"* cuando hay ≥ 2 jugadores.
4. Por cada pregunta:
   - Cada jugador llena 1 input por sí mismo + 1 por cada otro jugador.
   - Cuenta regresiva. Cuando termina (o el host fuerza el cierre), el sistema **auto-juzga** las respuestas (normaliza tildes/mayúsculas + similitud Levenshtein).
   - Las respuestas dudosas (similitud media) quedan **pendientes** y aparecen en la pantalla del host con botones ✓/✗ para que decida.
   - Cada acierto sobre otro jugador = **+1 punto**.
5. Al final, ranking y ganador.

### El "host" es opcional

La vista `/host/[id]` se puede abrir aunque no seas el creador (solo controla quien tiene el `hostToken` en su localStorage). Si abrís esa URL en el TV es modo **espectador**: ves el código, los jugadores, las respuestas y el ranking en vivo, pero no podés avanzar la partida ni juzgar respuestas pendientes. Esto es útil para entregar premios viendo el progreso.

> El `hostToken` se guarda en `localStorage` del navegador donde creaste la partida.
> Si querés controlar la partida desde otro dispositivo, copiá manualmente la entrada
> `host:<gameId>` del localStorage o creá la partida directamente desde ese dispositivo.

## Deploy a Vercel

1. Subí este repo a GitHub.
2. *New Project* en Vercel → importá el repo.
3. En *Environment Variables* agregá las 3 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. Deploy. Listo.

## Estructura

```
src/
  app/
    page.tsx                       # landing
    host/page.tsx                  # crear partida (form de host)
    host/[id]/page.tsx             # vista TV (lobby/playing/reveal/finished)
    play/page.tsx                  # input de código para unirse
    play/[code]/page.tsx           # vista jugador
    api/games/route.ts             # POST crear partida
    api/games/[code]/join/route.ts # POST unirse
    api/games/[id]/start/route.ts
    api/games/[id]/end-question/route.ts
    api/games/[id]/next/route.ts
    api/games/[id]/answers/route.ts
    api/games/[id]/verdict/route.ts
  lib/
    supabase.ts        # clientes browser (anon) y server (service role)
    useGameState.ts    # hook realtime: snapshot + suscripción a postgres_changes
    questions.ts       # banco de preguntas
    normalize.ts       # normalización + autoVerdict
    judge.ts           # juicio automático + recomputo de scores
    auth.ts            # validación de tokens host/jugador
    codes.ts           # generación de código de partida
    types.ts
supabase/schema.sql    # esquema de la base
```

## Próximas ideas

- Permitir que el creador comparta el control con otro dispositivo (host link con token).
- Banco de preguntas customizable por partida.
- Modo "premio" donde el host marca cuándo entregó un premio físico.
- Persistir historial de partidas y estadísticas por hermano.

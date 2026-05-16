#!/usr/bin/env python3
"""Reset the Supabase `questions` table with kid-friendly prompts.

Reads SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from .env.local.
Run: python3 scripts/reseed_questions.py
"""
import json
import os
import sys
import ssl
import urllib.request
import urllib.error
from pathlib import Path

# macOS Python often lacks system CA bundle; fall back to certifi if available,
# otherwise create an unverified context (safe for short-lived admin scripts).
try:
    import certifi  # type: ignore
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl._create_unverified_context()

QUESTIONS = [
    ("¿Cuál es mi color favorito?", "favoritos"),
    ("¿Cuál es mi comida favorita en todo el mundo?", "favoritos"),
    ("Si solo pudiera ver una película o serie por el resto del año, ¿cuál elegiría?", "favoritos"),
    ("¿Cuál es mi postre o golosina favorita?", "favoritos"),
    ("¿Qué materia de la escuela es la que menos me gusta?", "favoritos"),
    ("¿Qué materia de la escuela es la que más me gusta?", "favoritos"),
    ("¿Cuál es mi animal favorito?", "favoritos"),
    ("¿Cuál es mi canción favorita ahora mismo?", "favoritos"),
    ("¿Cuál es mi YouTuber favorito?", "favoritos"),
    ("¿Cuál es mi videojuego favorito?", "favoritos"),
    ("¿Cuál es mi meme favorito?", "favoritos"),
    ("¿Cuál es mi emoji favorito?", "favoritos"),
    ("¿Cuál es mi libro o cómic favorito?", "favoritos"),
    ("¿Mi sabor de jugo preferido?", "favoritos"),
    ("¿Mi sabor de helado favorito?", "favoritos"),
    ("¿Mi personaje de ficción favorito?", "favoritos"),
    ("¿Mi deporte favorito (para hacer o para mirar)?", "favoritos"),
    ("¿Mi red social o app favorita?", "favoritos"),
    ("¿Mi galletita favorita?", "favoritos"),
    ("¿Comida dulce o comida salada?", "esto_o_aquello"),
    ("¿Playa o montaña?", "esto_o_aquello"),
    ("¿Verano o invierno?", "esto_o_aquello"),
    ("¿Té o jugo?", "esto_o_aquello"),
    ("¿Pizza o hamburguesa?", "esto_o_aquello"),
    ("¿Chocolate o dulce de leche?", "esto_o_aquello"),
    ("¿Perro o gato?", "esto_o_aquello"),
    ("¿Levantarme temprano los fines de semana o quedarme despierto hasta tarde?", "esto_o_aquello"),
    ("¿Jugar videojuegos o salir a jugar algún deporte (tenis, pádel, fútbol)?", "esto_o_aquello"),
    ("¿Superpoder: volar o ser invisible?", "esto_o_aquello"),
    ("¿Película de terror o de comedia?", "esto_o_aquello"),
    ("¿Lluvia o sol?", "esto_o_aquello"),
    ("¿Tener un dragón mascota o un dinosaurio mascota?", "esto_o_aquello"),
    ("¿TikTok o YouTube?", "esto_o_aquello"),
    ("¿Vivir en la ciudad o en el campo?", "esto_o_aquello"),
    ("¿Helado en cucurucho o en vasito?", "esto_o_aquello"),
    ("¿Milanesa con puré o milanesa con papas fritas?", "esto_o_aquello"),
    ("Si nuestro ovejero alemán Sable aprendiera a hablar de la nada, ¿qué es lo primero que diría sobre mí?", "hipoteticas"),
    ("Si me encuentro plata tirada en la calle, lo primero que me compro es...", "hipoteticas"),
    ("Si se corta la luz y el internet en casa por todo un día, yo...", "hipoteticas"),
    ("Si me dejaran comer lo que yo quiera en el desayuno, comería...", "hipoteticas"),
    ("Si pudiera inventar una regla que toda la familia tenga que cumplir sí o sí, sería...", "hipoteticas"),
    ("Si me sobrara una semana sin clases, lo primero que haría es...", "hipoteticas"),
    ("Si pudiera teletransportarme a cualquier lugar del mundo ahora, iría a...", "hipoteticas"),
    ("Si tuviera que cantar en un escenario frente a toda la escuela, cantaría...", "hipoteticas"),
    ("Si me regalaran un millón de pesos solo para gastar en boludeces, los gastaría en...", "hipoteticas"),
    ("Si fuera famoso/a, sería conocido/a por...", "hipoteticas"),
    ("Si pudiera intercambiar la vida con alguien por un día, sería con...", "hipoteticas"),
    ("Si me encuentro un genio que me da 3 deseos, mi primer deseo sería...", "hipoteticas"),
    ("Si los animales pudieran hablar, el primero que querría escuchar es...", "hipoteticas"),
    ("Lo que más me hace reír a carcajadas es...", "personalidad"),
    ("La costumbre mía que más te molesta o te hace perder la paciencia es...", "personalidad"),
    ("Lo que mejor me sale hacer (mi mayor talento oculto) es...", "personalidad"),
    ("Si tuviera que describirme con un solo emoji, sería...", "personalidad"),
    ("Mi mayor miedo es...", "personalidad"),
    ("Cuando estoy aburrido/a en casa, lo primero que hago es...", "personalidad"),
    ("La frase o palabra que más repito es...", "personalidad"),
    ("Lo que más me da vergüenza es...", "personalidad"),
    ("La cosa más rara que hice de chico/a fue...", "personalidad"),
    ("Mi mejor amigo/a actual se llama...", "personalidad"),
    ("La comida que más odio es...", "personalidad"),
    ("Mi recuerdo más feliz de la familia es...", "personalidad"),
    ("Cuando me enojo, lo que hago es...", "personalidad"),
    ("Si tuviera que quedarme con un solo juguete o cosa para siempre, elegiría...", "personalidad"),
]


def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    env = load_env(root / ".env.local")
    url = env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing SUPABASE env vars", file=sys.stderr)
        return 1

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    # 1. Delete all
    req = urllib.request.Request(
        f"{url}/rest/v1/questions?id=neq.00000000-0000-0000-0000-000000000000",
        method="DELETE",
        headers={**headers, "Prefer": "return=minimal"},
    )
    with urllib.request.urlopen(req, context=SSL_CTX) as r:
        print(f"DELETE {r.status}")

    # 2. Bulk insert
    payload = json.dumps(
        [{"prompt": p, "category": c} for p, c in QUESTIONS]
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{url}/rest/v1/questions",
        method="POST",
        data=payload,
        headers={**headers, "Prefer": "return=minimal"},
    )
    try:
        with urllib.request.urlopen(req, context=SSL_CTX) as r:
            print(f"INSERT {r.status} ({len(QUESTIONS)} questions)")
    except urllib.error.HTTPError as e:
        print(f"INSERT failed {e.code}: {e.read().decode()}", file=sys.stderr)
        return 1

    # 3. Verify
    req = urllib.request.Request(
        f"{url}/rest/v1/questions?select=count",
        headers={**headers, "Prefer": "count=exact", "Range": "0-0"},
    )
    with urllib.request.urlopen(req, context=SSL_CTX) as r:
        print(f"VERIFY content-range: {r.headers.get('content-range')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

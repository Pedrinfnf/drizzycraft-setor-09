#!/usr/bin/env python3
"""
DrizzyCraft: Setor 09 — Neural Cassette Voiceover Generator
Generates authentic multi-language MP3 voiceovers using Microsoft Edge Neural TTS
for Web Audio API analog cassette DSP playback (TapeAudioPlayer.ts).
"""

import asyncio
from pathlib import Path
import edge_tts

RATE = "-10%"
PITCH = "-4Hz"

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_BASE = ROOT_DIR / "public" / "audio" / "tapes"

TAPES = [
    # Portuguese (Brazil)
    {
        "path": OUTPUT_BASE / "pt" / "tape_01.mp3",
        "voice": "pt-BR-AntonioNeural",
        "text": (
            "Fita zero um... Vigia Marcos falando da Cabine zero nove A. "
            "Se você encontrou esta gravação... escute com atenção. "
            "O P. Drizzy não está mais respondendo ao protocolo de contenção... "
            "ele está patrulhando os corredores no escuro, e ouve qualquer passo apressado. "
            "Não pise nas tábuas soltas e rangentes do piso sem agachar... "
            "um único estalo entrega a sua posição na hora. "
            "E se ele aparecer na sua frente... dispare o flash da Câmera Polaroid direto no rosto dele. "
            "A claridade atordoa a visão dele por alguns segundos... "
            "o tempo exato para você correr e se esconder. Boa sorte."
        ),
    },
    {
        "path": OUTPUT_BASE / "pt" / "tape_02.mp3",
        "voice": "pt-BR-FranciscaNeural",
        "text": (
            "Fita zero dois... registro de emergência da Doutora Helena. "
            "A Interferência Neural está se intensificando por todo o Setor zero nove... "
            "no breu total, e perto do Sujeito zero nove, a estática começa a distorcer a percepção. "
            "Mantenha a lanterna acesa sempre que possível... "
            "e tome as pílulas de Supressor de Frequência assim que o sinal começar a falhar. "
            "Se a saída principal estiver bloqueada... procure o Sótão Secreto. "
            "Atrás dele existe um Elevador de Carga oculto... "
            "é o único acesso que desce direto para o Capítulo Dois. "
            "Não deixe a frequência dominar você."
        ),
    },
    # English (US)
    {
        "path": OUTPUT_BASE / "en" / "tape_01.mp3",
        "voice": "en-US-GuyNeural",
        "text": (
            "Tape zero one... Night Watchman Marcos speaking from Cabin zero nine A. "
            "If you are listening to this... stay sharp. "
            "P. Drizzy broke containment... "
            "he is stalking the hallways in the dark, and he tracks every careless sound. "
            "Never walk across the creaking floorboards standing up... "
            "crouch low, or the wood will give you away instantly. "
            "And if he corners you... hit him right in the face with the Polaroid Camera flash. "
            "The burst blinds and stuns him for a few critical seconds... "
            "just enough to break away and hide. Stay alive."
        ),
    },
    {
        "path": OUTPUT_BASE / "en" / "tape_02.mp3",
        "voice": "en-US-JennyNeural",
        "text": (
            "Tape zero two... emergency log from Doctor Helena. "
            "Neural Interference is spiking across Sector zero nine... "
            "in pitch darkness, and whenever Subject zero nine gets close, the static starts tearing at your mind. "
            "Keep your light steady... "
            "and take the Frequency Suppressor pills the moment the distortion rises. "
            "If the main perimeter fails... find the Secret Attic. "
            "Behind it lies a hidden Cargo Elevator... "
            "it leads straight down into Chapter Two. "
            "Do not let the signal take hold."
        ),
    },
    # Spanish (Mexico)
    {
        "path": OUTPUT_BASE / "es" / "tape_01.mp3",
        "voice": "es-MX-JorgeNeural",
        "text": (
            "Cinta cero uno... el vigilante Marcos hablando desde la Cabina cero nueve A. "
            "Si encontraste esta grabación... presta mucha atención. "
            "P. Drizzy rompió la contención... "
            "está patrullando los pasillos en la oscuridad, y escucha cada paso descuidado. "
            "Nunca pises las tablas sueltas y crujientes sin agacharte... "
            "un solo crujido delatará tu posición al instante. "
            "Y si logra acorralarte... dispara el flash de la Cámara Polaroid directo a su rostro. "
            "El destello lo aturde durante unos segundos vitales... "
            "el tiempo justo para escapar y ocultarte. Mucha suerte."
        ),
    },
    {
        "path": OUTPUT_BASE / "es" / "tape_02.mp3",
        "voice": "es-MX-DaliaNeural",
        "text": (
            "Cinta cero dos... registro de emergencia de la Doctora Helena. "
            "La Interferencia Neural se está agravando en todo el Sector cero nueve... "
            "en la oscuridad total, y cerca del Sujeto cero nueve, la estática distorsiona los sentidos. "
            "Mantén tu linterna encendida... "
            "y toma las píldoras del Supresor de Frecuencia en cuanto la señal empiece a fallar. "
            "Si la salida principal cae... busca el Ático Secreto. "
            "Detrás se oculta un Ascensor de Carga escondido... "
            "que desciende directamente hacia el Capítulo Dos. "
            "No dejes que la frecuencia te controle."
        ),
    },
]


async def generate_one(entry: dict) -> None:
    out_path: Path = entry["path"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicator = edge_tts.Communicate(
        text=entry["text"],
        voice=entry["voice"],
        rate=RATE,
        pitch=PITCH,
    )
    await communicator.save(str(out_path))
    size = out_path.stat().st_size
    if size <= 0:
        raise RuntimeError(f"Generated empty MP3: {out_path}")
    print(f"[OK] {out_path.relative_to(ROOT_DIR)} ({size:,} bytes) [{entry['voice']}]")


async def main() -> None:
    print(f"Generating {len(TAPES)} neural audio tapes (rate={RATE}, pitch={PITCH})...")
    for entry in TAPES:
        await generate_one(entry)
    print("All neural voiceover tapes generated successfully.")


if __name__ == "__main__":
    asyncio.run(main())

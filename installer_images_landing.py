"""
Script — Installer les images de la landing page Pointage360
Exécutez ce script avec Python pour extraire les 4 photos de la
conversation et les copier dans frontend/public/images/.

Double-cliquez sur ce fichier OU lancez : python installer_images_landing.py
"""

import json, base64, os, sys

JSONL = r"C:\Users\ELIITEBOOK\AppData\Roaming\Claude\local-agent-mode-sessions\9c08cd8f-3852-4521-a345-f7e4bed96cdc\69ce0f6a-be87-47de-97e4-db8bf33a5a2f\local_743a4469-7f46-4c8b-a19a-a8c3bf54568d\.claude\projects\C--Users-ELIITEBOOK-AppData-Roaming-Claude-local-agent-mode-sessions-9c08cd8f-3852-4521-a345-f7e4bed96cdc-69ce0f6a-be87-47de-97e4-db8bf33a5a2f-local-743a4469-7f46-4c8b-a19a-a8c3bf54568d-outputs\d5c5f5dc-5bbf-4435-b192-04d7b6046bee.jsonl"

DEST = r"C:\Users\ELIITEBOOK\Desktop\Pointage\frontend\public\images"

NAMES = [
    "hero-controle.jpg",   # Salle de controle HV/LV
    "hero-terrain.jpg",    # Technicien sur tableau electrique
    "hero-securite.jpg",   # Armoire DANGER HIGH VOLTAGE / ARC FLASH
    "hero-formation.jpg",  # Formation IEC 60617 NORMES
]

def extract_images(jsonl_path):
    images = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                d = json.loads(line)
                msg = d.get('message', d)
                content = msg.get('content', [])
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get('type') == 'image':
                            src = block.get('source', {})
                            if src.get('type') == 'base64':
                                images.append(src.get('data', ''))
            except Exception:
                pass
    return images

def main():
    print("=== Installer images landing page Pointage360 ===\n")

    if not os.path.exists(JSONL):
        print(f"ERREUR: Fichier JSONL introuvable:\n  {JSONL}")
        input("\nAppuyez sur Entree pour quitter...")
        sys.exit(1)

    os.makedirs(DEST, exist_ok=True)
    print(f"Dossier destination: {DEST}\n")

    images = extract_images(JSONL)
    print(f"Images trouvees dans la conversation: {len(images)}")

    if len(images) < 4:
        print("ERREUR: Pas assez d'images trouvees (attendu: au moins 4).")
        input("\nAppuyez sur Entree pour quitter...")
        sys.exit(1)

    # Les 4 dernieres images = les 4 photos uploadees
    last4 = images[-4:]

    for name, b64 in zip(NAMES, last4):
        out = os.path.join(DEST, name)
        data = base64.b64decode(b64)
        with open(out, 'wb') as f:
            f.write(data)
        print(f"  OK  {name}  ({len(data)//1024} KB)")

    print(f"\nSUCCES: 4 images copiees dans:\n   {DEST}")
    print("\nRelancez le serveur de developpement pour les voir.")
    input("\nAppuyez sur Entree pour quitter...")

if __name__ == "__main__":
    main()

import argparse
import getpass
import json
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "http://127.0.0.1:8003"


def request(method, path, token=None, payload=None):
    headers = {"Accept": "application/json"}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        BASE_URL + path,
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read().decode("utf-8")
            return response.status, json.loads(content)

    except urllib.error.HTTPError as error:
        content = error.read().decode("utf-8")

        try:
            body = json.loads(content)
        except json.JSONDecodeError:
            body = {"detail": content}

        return error.code, body


def reserve(token, payload, barrier):
    # Ambas solicitudes esperan hasta estar listas.
    barrier.wait(timeout=15)

    return request(
        "POST",
        "/reservations",
        token=token,
        payload=payload,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", required=True)
    parser.add_argument("--section", type=int, required=True)
    parser.add_argument("--seat", type=int, required=True)

    args = parser.parse_args()

    print("\nPRUEBA DE CONCURRENCIA - CONCIERTA")
    print("----------------------------------")

    token1 = getpass.getpass("JWT del cliente 1: ").strip()
    token2 = getpass.getpass("JWT del cliente 2: ").strip()

    if not token1 or not token2 or token1 == token2:
        print("ERROR: necesitas dos tokens diferentes.")
        return

    # Comprobar que el asiento no esté ocupado.
    status, availability = request(
        "GET",
        f"/availability/{args.event}",
    )

    if status != 200:
        print(f"ERROR consultando disponibilidad: {status}")
        print(availability)
        return

    occupied = any(
        seat.get("seat_id") == args.seat
        for seat in availability.get("taken", [])
    )

    if occupied:
        print("ERROR: el asiento ya está ocupado.")
        print("Selecciona otro asiento libre.")
        return

    payload = {
        "event_id": args.event,
        "items": [
            {
                "section_id": args.section,
                "seat_id": args.seat,
                "quantity": 1,
            }
        ],
    }

    print(f"\nEvento: {args.event}")
    print(f"Sección: {args.section}")
    print(f"Asiento: {args.seat}")
    print("Enviando dos solicitudes concurrentes...\n")

    barrier = threading.Barrier(2)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(
            reserve, token1, payload, barrier
        )
        second = executor.submit(
            reserve, token2, payload, barrier
        )

        results = [first.result(), second.result()]

    for i, (status, body) in enumerate(results, start=1):
        print(f"Cliente {i}: HTTP {status}")

        if status == 201:
            print("  Reserva creada:", body.get("code"))
            print("  ID:", body.get("id"))
        else:
            print("  Respuesta:", body.get("detail", body))

    successes = sum(
        status == 201 for status, _ in results
    )

    conflicts = sum(
        status == 409 for status, _ in results
    )

    print("\nRESULTADO")
    print("---------")

    if successes == 1 and conflicts == 1:
        print("PASS: una reserva creada y una rechazada.")
        print("No se detectó doble reserva en esta ejecución.")

    elif successes == 2:
        print("FAIL: ambos clientes pudieron reservar.")
        print("Existe un problema de concurrencia.")

    else:
        print("INCONCLUSO: resultado diferente al esperado.")
        print("Verifica los JWT, los límites y las respuestas.")

    print("\nVerifica también en PostgreSQL que no existan duplicados.")


if __name__ == "__main__":
    main()
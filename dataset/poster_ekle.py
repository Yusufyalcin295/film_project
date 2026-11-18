
import csv
from pathlib import Path

klasor = Path(__file__).resolve().parent

giris = klasor / "imdb_top_250.csv"
cikis = klasor / "imdb_top_250_posterli.csv"
poster_klasoru = klasor / "posters"

with open(giris, "r", encoding="utf-8-sig", newline="") as dosya:
    okuyucu = csv.DictReader(dosya)

    sutunlar = list(okuyucu.fieldnames or [])

    if "Rank" not in sutunlar:
        raise ValueError("CSV dosyasında Rank sütunu bulunamadı!")

    if "poster_path" not in sutunlar:
        sutunlar.append("poster_path")

    filmler = list(okuyucu)

eksikler = []

for film in filmler:
    rank = int(film["Rank"])
    poster = f"posters/{rank}.png"

    film["poster_path"] = poster

    if not (poster_klasoru / f"{rank}.png").is_file():
        eksikler.append(rank)

with open(cikis, "w", encoding="utf-8-sig", newline="") as dosya:
    yazici = csv.DictWriter(dosya, fieldnames=sutunlar)
    yazici.writeheader()
    yazici.writerows(filmler)

print(f"{len(filmler)} filmin poster yolu eklendi.")
print(f"Yeni CSV oluşturuldu: {cikis.name}")

if eksikler:
    print("Eksik poster numaraları:", eksikler)
else:
    print("Tüm poster dosyaları bulundu!")

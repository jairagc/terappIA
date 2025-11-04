import requests
import json

# VE A LA CONSOLA DE FIREBASE -> Project Settings (engranaje) -> General
# Y COPIA TU "Web API Key" aquí
API_KEY = "AIzaSyA95AB_ZtRvGlaw-lvcbcWyyNyloX9teb8"

email = "test@terappia.com"
password = "contraseña123"

url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
data = {"email": email, "password": password, "returnSecureToken": True}

response = requests.post(url, data=data)

if response.status_code == 200:
    token_data = response.json()
    print("¡Token obtenido con éxito! Cópialo y pégalo en FastAPI Docs.")
    print("\n" + token_data['idToken'])
else:
    print("Error al obtener el token:")
    print(response.text)
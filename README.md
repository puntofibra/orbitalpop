# ORBITAL POP

Juego tipo Puzzle Bobble de FuturMovil · https://puntofibra.github.io/orbitalpop/

- `index.html`: el juego (GitHub Pages). Se genera juntando los archivos de `src/` con `build.sh`.
- `Code.gs`: copia del backend de Apps Script (proyecto "orbitalpop").
- `img/`: imágenes propias (PNG sin fondo). Si existen, sustituyen al dibujo básico:
  - `b1.png` … `b8.png`: burbujas (1 cian · 2 magenta · 3 ámbar · 4 verde · 5 rojo · 6 violeta · 7 hielo · 8 naranja)
  - `metal.png`, `bomba.png`: burbujas especiales
  - `lanzador.png`: cañón apuntando hacia arriba · `robot.png`: robot junto al cañón
  - `logo.png`: logo del juego · `fondo.jpg`: fondo del tablero
- Al cambiar imágenes, pulsa "Recargar imágenes" en el panel admin (10 toques al título + llave NFC).
- Al publicar cambios, sube a la vez `version.json` y `APP_V` de `index.html` con el mismo número.

# Old School Fighters

Juego de lucha 2D para navegador con Chamo, Nacho, Pablo, Ruffo y Ortega. Contra la CPU (tres dificultades) o dos jugadores en el mismo teclado. Gana el primero que consigue dos rondas.

**Jugar online: <https://jechamo.github.io/oldschoolfighters/>**

## Jugar en local

No requiere instalar paquetes ni compilar:

```sh
python3 -m http.server 8080 --directory dist
```

Abre http://localhost:8080. Todo el juego y sus imágenes se sirven desde `dist`; puede alojarse en cualquier servidor web estático con HTTPS.

## Controles

| Acción | Jugador 1 | Jugador 2 |
| --- | --- | --- |
| Andar | A / D | Flechas izquierda / derecha |
| Saltar | W | Flecha arriba |
| Agacharse | S | Flecha abajo |
| Puñetazo | F | K |
| Patada | G | L |
| Bloquear | H | O |
| Pausar | Esc | Esc |

Pulsa puño hasta tres veces para encadenar jab, directo y gancho. Mantenerlo pulsado produce un solo golpe. Las pulsaciones se conservan durante la pausa breve del impacto. El salto permite pasar sobre el rival.

En móviles aparece un joystick con diagonales y botones semitransparentes. Arriba salta; abajo se agacha. Se recomienda horizontal. El modo de dos jugadores utiliza un teclado compartido.

La música original de combate se sintetiza localmente y comienza después de pulsar «A la arena». El botón de sonido controla música y efectos. La música se pausa al interrumpir el combate.

## Animación y assets

Las hojas de personajes derivan de los dibujos proporcionados por el propietario. Se han generado posturas adicionales para patadas, tres puñetazos, salto y agacharse; los atlas incluyen transparencia y márgenes. Chamo y Nacho utilizan sus dibujos originales de andar. Los movimientos se reproducen con dibujos completos, sin mezclar siluetas mediante optical flow ni estirar las piernas de la imagen de reposo. La simulación funciona a 120 pasos por segundo; la animación utiliza fotogramas dibujados con tiempos específicos para anticipación, impacto y recuperación.

Los assets necesarios están incluidos. `tools/import_movement.py` normaliza hojas 4×4 a partir de un JSON que relaciona `personaje-locomotion` y `personaje-combat` con sus rutas. `tools/import_original_walk.py` importa los dibujos de andar desde la carpeta de originales y `source-map.json`. Ambos requieren Pillow, numpy y scipy. No hacen falta para jugar.

## Comprobaciones

```sh
node tools/verify.mjs
```

Comprueba combate, combos, guardia, saltos, colisiones, rondas, CPU, referencias de los sprites y márgenes visibles. Las comprobaciones automatizadas no sustituyen una revisión visual en un dispositivo real.

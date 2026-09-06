# Old School Fighters

Juego de lucha 2D para navegador con Chamo, Nacho, Pablo, Ruffo, Ortega, Luna y Titán. Dos modos: el combate **clásico** uno contra uno y un **Battle Royale** de hasta ocho luchadores por la ciudad.

**Jugar online: <https://jechamo.github.io/oldschoolfighters/>**

## Jugar en local

No requiere instalar paquetes ni compilar:

```sh
python3 -m http.server 8080 --directory dist
```

Abre http://localhost:8080. Todo el juego y sus imágenes se sirven desde `dist`; puede alojarse en cualquier servidor web estático con HTTPS. `index.html` es el selector de modo, `classic.html` el combate uno contra uno y `royale.html` el Battle Royale.

## Modo clásico

Contra la CPU (tres dificultades) o dos jugadores en el mismo teclado. Gana el primero que consigue dos rondas.

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

## Battle Royale

Ocho luchadores por el metro, la calle y las azoteas. Se recogen técnicas, la tormenta cierra la zona y, con dos supervivientes, empieza un duelo de 75 segundos sin loot ni terceros. Si se acaba el tiempo gana quien conserve más vida; desempatan las eliminaciones y el Ki.

| Acción | Teclado | Mando |
| --- | --- | --- |
| Mover / agacharse | A, D / S | Stick izquierdo |
| Saltar | W / Espacio | A / ✕ |
| Rápido / Fuerte / Especial | F / G / H | X / Y / B |
| Guardia / parry | J | LB / L1 |
| Dash / Chase | Shift | RB / R1 |
| Burst / Super | R / Q | LT / RT |
| Recoger técnica | E | Cruceta abajo |
| Elegir recompensa | 1 / 2 / 3 | Cruceta izq. / arriba / der. |

Rápido ×3 encadena tres puñetazos y rápido ×2 → fuerte lanza al rival. ↑ + fuerte es un launcher, ↑ + especial asciende y ↓ + especial crea una onda. Tras un golpe fuerte, pulsa dash durante el aviso CHASE para perseguir. La guardia justo antes del impacto hace parry y el burst rompe el combo cuando su barra está llena.

Cada luchador tiene su rasgo: Nacho hace doble salto, Luna encadena un dash aéreo por 6 de Ki y Titán aguanta mejor los empujones. ↓ + salto atraviesa las plataformas y saltar junto a una pared permite rebotar.

Se puede jugar contra siete CPU sin conexión, o crear una sala online de hasta ocho con un código de 8 caracteres. Las partidas online son punto a punto (PeerJS, cargado desde jsDelivr): no hay servidor propio y la sala vive mientras el anfitrión mantenga la página abierta.

## Animación y assets

Las hojas de personajes derivan de los dibujos proporcionados por el propietario. Se han generado posturas adicionales para patadas, tres puñetazos, salto y agacharse; los atlas incluyen transparencia y márgenes. Chamo y Nacho utilizan sus dibujos originales de andar. Los movimientos se reproducen con dibujos completos, sin mezclar siluetas mediante optical flow ni estirar las piernas de la imagen de reposo. La simulación funciona a 120 pasos por segundo; la animación utiliza fotogramas dibujados con tiempos específicos para anticipación, impacto y recuperación.

El Battle Royale usa sus propios atlas (`assets/*-royale.webp`, descritos en `assets/royale-fighters.json`), los retratos del selector de modo y los escenarios `royale-city.webp` y `royale-metro.webp`.

Los assets necesarios están incluidos. `tools/import_movement.py` normaliza hojas 4×4 a partir de un JSON que relaciona `personaje-locomotion` y `personaje-combat` con sus rutas. `tools/import_original_walk.py` importa los dibujos de andar desde la carpeta de originales y `source-map.json`. Ambos requieren Pillow, numpy y scipy. No hacen falta para jugar.

## Comprobaciones

```sh
node tools/verify.mjs
```

Comprueba el modo clásico: combate, combos, guardia, saltos, colisiones, rondas, CPU, referencias de los sprites y márgenes visibles. Las comprobaciones automatizadas no sustituyen una revisión visual en un dispositivo real.

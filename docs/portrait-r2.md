# Retratos MM3 en R2 — publicación controlada

El juego utiliza 24 IDs de retrato estables (4 canónicos + 20 de galería).
**Los 24 originales ya son WebP**, están versionados en
`frontend/src/assets/chronicles/` y se conservan como fallback.

## Modelo

- Bucket propiedad de Chronicles: `chronicles`.
- CDN existente: `https://assets.chronicles.shadowops.dpdns.org`.
- Objetos inmutables: `portraits/<portrait-id>/<awake|sleep>-<sha256-16>.webp`.
- Los guardados solo contienen el `portraitId` histórico, nunca URLs ni hashes.
- `frontend/src/chronicles/chroniclesPortraitR2Manifest.json` es la **única lista aprobada** de URLs remotas. Comienza vacía.
- Para cada imagen cargada por R2 se mantiene un WebP local como fallback ante
  404, error de red o dominio no disponible. Un WebP `sleep` auténtico reemplaza
  los párpados CSS cuando termina de cargar; de lo contrario, se mantiene el
  retrato normal con el efecto CSS.
- No se consultan manifiestos remotos dinámicos ni se permiten dominios arbitrarios
  o nombres de fichero mutables.

## Crear un paquete reproducible (sin publicar)

Desde la raíz de este repositorio:

```bash
node frontend/scripts/prepare-portrait-r2.mjs
```

Se genera `frontend/.portrait-r2-stage/` con los 24 WebP originales,
`sha256sums.json` y `manifest.candidate.json`. Es una carpeta generada,
ignorada por Git; repetir el comando la reconstruye desde los WebP canónicos.

Para variantes dormidas ya revisadas visualmente:

```bash
node frontend/scripts/prepare-portrait-r2.mjs --sleep-dir=/ruta/a/retratos-aprobados
```

El directorio opcional acepta `matthias.webp`, `rook.webp`, `bishop.webp`,
`knight.webp` y, si existen, `male-01.webp` a `female-10.webp`.
La herramienta valida que sean WebP y que sus dimensiones coincidan con los
originales. **No puede demostrar fidelidad artística:** comprobar que los ojos
cerrados pertenecen al retrato canónico y no a una recreación nueva. No subir
las anteriores imágenes de previsualización como originales definitivos.

## Publicación y activación

La infraestructura y las credenciales de Cloudflare pertenecen a
`evilsysadmin/shadowops-infra`. Este repositorio **no publica** en R2;
el paquete es una entrada preparada para el pipeline autorizado de Infra.
No guardar tokens ni claves S3 en este repositorio.

1. Operador de Infra: publicar únicamente los WebP del paquete en el bucket
   `chronicles`, con claves exactas de `sha256sums.json`, Content-Type
   `image/webp` y Cache-Control `public,max-age=31536000,immutable`.
   La subida debe comprobar previamente cualquier objeto existente y negarse
   a sobrescribir bytes diferentes con la misma clave.
2. Comprobar que el CDN público entrega cada clave con HTTP 200, el MIME
   correcto y bytes cuyo SHA-256 coincide con el paquete. Verificar también
   navegador/HTTPS y que no hay problemas de acceso o cache.
3. Copiar **solo las entradas publicadas y comprobadas** de
   `manifest.candidate.json` a `chroniclesPortraitR2Manifest.json`
   mediante PR de código, dejando el resto en local.
4. Validar tests, build y Chromium, habilitar automerge y comprobar el
   despliegue con retratos visibles. Mantener los originales locales como
   rollback hasta que otro cambio explícito rediseñe ese fallback.

Para cambiar una expresión en el futuro se publica un nuevo WebP con otro
hash y se cambia solo su entrada de manifiesto. La versión antigua puede
conservarse durante el rollback; no usar `?v=`, nombres fijos mutables ni
borrar objetos todavía referenciados por releases activas.

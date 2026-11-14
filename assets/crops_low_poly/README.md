# Crops (low poly) — split binary buffer

`scene.bin` from the original glTF asset, split into 4 MB ZIP volumes so it can
be stored and downloaded in parts.

## Files

| File | Size | Purpose |
| --- | ---: | --- |
| `scene.zip.001` | 4.0 MB | first ZIP volume |
| `scene.zip.002` | 835 KB | second ZIP volume |
| `SHA256SUMS.txt` | — | checksums for both volumes |
| `LICENSE.txt` | — | original model license and attribution |

## Reconstruct

With 7-Zip:

```bash
7z x scene.zip.001
```

Or concatenate the volumes first:

```bash
cat scene.zip.001 scene.zip.002 > scene.zip
unzip scene.zip
```

The result is `scene.bin` (18,906,008 bytes). It is the binary buffer referenced
by `scene.gltf`; the glTF file and `textures/` are not included in this folder.

## Attribution

This work is based on "Crops (low poly)"
(https://sketchfab.com/3d-models/crops-low-poly-637198c4b8be41e6aeaca8cea8fb81f4)
by Bumroker (https://sketchfab.com/Bumroker), licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/).

See `LICENSE.txt` for the original notice.

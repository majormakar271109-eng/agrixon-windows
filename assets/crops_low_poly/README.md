# Crops (low poly) — glTF asset

Low-poly crop models used as a 3D reference asset. The binary buffer
(`scene.bin`) is split into 4 MB ZIP volumes so it can be stored and downloaded
in parts.

## Files

| File | Size | Purpose |
| --- | ---: | --- |
| `scene.gltf` | 42 KB | glTF scene description |
| `scene.zip.001` | 4.0 MB | first ZIP volume with `scene.bin` |
| `scene.zip.002` | 835 KB | second ZIP volume with `scene.bin` |
| `textures/Carrot_baseColor.png` | 97 KB | carrot base color |
| `textures/Potatoe_baseColor.png` | 135 KB | potato base color |
| `textures/Tomatoe_baseColor.png` | 148 KB | tomato base color |
| `textures/Wheat_baseColor.png` | 34 KB | wheat base color |
| `SHA256SUMS.txt` | — | checksums for both ZIP volumes |
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

The result is `scene.bin` (18,906,008 bytes). Keep it next to `scene.gltf`;
the `textures/` folder is already in the expected relative location. The asset
can then be opened in any glTF viewer.

## Attribution

This work is based on "Crops (low poly)"
(https://sketchfab.com/3d-models/crops-low-poly-637198c4b8be41e6aeaca8cea8fb81f4)
by Bumroker (https://sketchfab.com/Bumroker), licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/).

See `LICENSE.txt` for the original notice.

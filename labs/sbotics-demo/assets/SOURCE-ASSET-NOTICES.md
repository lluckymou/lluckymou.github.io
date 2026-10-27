# Bundled asset provenance

The runtime uses files from this folder only. `source-provenance.json` lists source paths, hashes, available Unity GUIDs, and license authorities for copied and bundled assets.

The sBotics logo and icon are covered by `RIGHTS.md`, which records the project-owner authorization. Tile line art, FBX meshes and the noise texture retain their original source paths/GUIDs. Tile and Arena catalog thumbnails, complete Robot thumbnails, and Robot component previews are generated dynamically in 3D; neither `tile_icons/` nor the legacy `robot-previews/` PNGs are shipped. The local `assets/logo-obr.png` and `assets/medals/` sprites were already part of this prototype.

The Codicons font is copied from the Monaco Editor 0.31.1 distribution used by sBotics and retains the applicable Microsoft MIT notice in `fonts/monaco-editor.LICENSE.txt`. Noto Sans v42 (Latin variable WOFF2), Noto Sans Mono v37 (Latin variable WOFF2), Noto Color Emoji v47 and the Noto Sans Symbols 2 arrow subset are bundled from official Google Fonts build URLs with their SIL Open Font License 1.1 notices beside the files. The UI loads these local assets; no font CDN is used.

# Chronicles · Premium 2D item portraits

Each recognized item ID may opt into a transparent 512×512 authored 2D sprite in `chroniclesShopItemArt.js`. No runtime URL generation and no swapping based on translated display names. The material is part of the canonical ID; `wooden-longbow` must never be painted as a steel longbow and vice versa.

The sprite is shared by the small merchant row and the large selected-item detail via `ShopItemVisual`. Unmapped IDs retain the existing SVG glyph, so no missing illustration can hide an item. Item art remains presentation only: no changes to buy/sell, gold, class checks or inventory.

New item sheets should be single-object artwork (not shop mockups or UI), crisp at 49px and at up to ~210px, with transparent backgrounds. Favor a painterly, rich material palette and restrained highlights; avoid flat schematic UI icons, text and 3D runtime. Keep sprites small and local. Expand the exact-ID map incrementally PR by PR and inspect Chromium screenshots on desktop/mobile before merging.
